import { LyricLine, LyricsErrorType, LyricsFetchOutcome, LyricsResult, Track } from '../types/music';
import { AudioPreparationError, computeFileSha256, prepareAudioUploadChunks } from './audioChunker';

const LYRICS_CACHE_KEY = 'hmd_lyrics_cache_v2';
const GROQ_FILE_CACHE_KEY = 'hmd_groq_file_cache_v1';
const LRCLIB_API_BASE = 'https://lrclib.net/api';
const REQUEST_TIMEOUT_MS = 10000;

const memoryCache = new Map<string, LyricsFetchOutcome>();
const groqHashMemoryCache = new Map<string, LyricsResult>();

class LrclibRequestError extends Error {
  errorType: LyricsErrorType;

  constructor(errorType: LyricsErrorType, message: string) {
    super(message);
    this.name = 'LrclibRequestError';
    this.errorType = errorType;
  }
}

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`´]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTrackTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\[[^\]]*(clip|official|officiel|video|audio|lyrics|paroles|hd|4k|visualizer|live|mv)[^\]]*\]/gi, '')
    .replace(/\([^)]*(clip|official|officiel|video|audio|lyrics|paroles|hd|4k|visualizer|prod\.?|directed|mv)[^)]*\)/gi, '')
    .replace(/\((ft\.?|feat\.?|featuring|avec)\s+[^)]+\)/gi, '')
    .replace(/\[(ft\.?|feat\.?|featuring|avec)\s+[^\]]+\]/gi, '')
    .replace(/\b(ft\.?|feat\.?|featuring)\s+.+$/i, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\s*[-–|]\s*(official|clip officiel|audio|lyrics|paroles|visualizer).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTempoEditSuffix(title: string): { baseTitle: string; isTempoModified: boolean } {
  const cleaned = title
    .replace(/\((slowed(\s*\+?\s*reverb)?|sped\s*up|nightcore|reverb|bass\s*boosted|8d(\s*audio)?)\)/gi, '')
    .replace(/\[(slowed(\s*\+?\s*reverb)?|sped\s*up|nightcore|reverb|bass\s*boosted|8d(\s*audio)?)\]/gi, '')
    .replace(/\s*[-–|]\s*(slowed(\s*\+?\s*reverb)?|sped\s*up|nightcore|reverb)\b.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const isTempoModified = normalizeText(cleaned) !== normalizeText(title) && cleaned.length >= 2;
  return { baseTitle: cleaned || title, isTempoModified };
}

function canonicalizeArtistAlias(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower === 'maitre gims' || lower === 'maître gims') return 'GIMS';
  if (lower === 'jul') return 'Jul';
  return name.trim();
}

function cleanArtistName(rawArtist: string): string {
  const cleaned = rawArtist
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\b(ft\.?|feat\.?|featuring|avec)\b.*$/i, '')
    .replace(/\s*[,/&]\s*.+$/i, '')
    .replace(/\s+x\s+.+$/i, '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return canonicalizeArtistAlias(cleaned || rawArtist.trim());
}

function extractArtistCandidates(rawArtist: string): string[] {
  const candidates = new Set<string>();
  const primary = cleanArtistName(rawArtist);
  if (primary) candidates.add(primary);

  const stripped = rawArtist
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .trim();
  if (stripped) candidates.add(canonicalizeArtistAlias(stripped));

  const insideParens = rawArtist.match(/\(([^)]+)\)/);
  const splitSource = [stripped, insideParens?.[1] || ''].join(',');
  for (const part of splitSource.split(/,|&|\bft\.?\b|\bfeat\.?\b|\bfeaturing\b|\bx\b/i)) {
    const cleanPart = canonicalizeArtistAlias(part.replace(/\.{2,}/g, '').trim());
    if (cleanPart.length >= 2) {
      candidates.add(cleanPart);
    }
  }

  return Array.from(candidates);
}

function isGenericYouTubeArtist(artist: string): boolean {
  const norm = normalizeText(artist);
  if (!norm) return true;
  return (
    norm === 'youtube' ||
    norm === 'youtube music' ||
    norm === 'artiste youtube' ||
    norm === 'various artists' ||
    norm === 'inconnu'
  );
}

function splitArtistAndTitleFromTrackTitle(rawTitle: string): { artist: string; title: string } | null {
  const match = rawTitle.match(/^([^–—-]+?)\s+[-–—]\s+(.+)$/);
  if (!match) return null;
  const candidateArtist = cleanArtistName(match[1]);
  const candidateTitle = cleanTrackTitle(match[2]);
  if (candidateArtist.length >= 2 && candidateTitle.length >= 2) {
    return { artist: candidateArtist, title: candidateTitle };
  }
  return null;
}

function splitReversedTitleAndArtist(rawTitle: string): { artist: string; title: string } | null {
  const parts = rawTitle.split(/\s+[-–—]\s+/);
  if (parts.length < 2) return null;
  const last = cleanArtistName(parts[parts.length - 1]);
  const first = cleanTrackTitle(parts.slice(0, -1).join(' - '));
  if (last.length >= 2 && first.length >= 2) {
    return { artist: last, title: first };
  }
  return null;
}

function cleanAlbumName(rawAlbum?: string): string | undefined {
  if (!rawAlbum) return undefined;
  const trimmed = rawAlbum.trim();
  if (!trimmed) return undefined;
  const norm = normalizeText(trimmed);
  if (norm === 'hmd music' || norm === 'youtube' || norm === 'direct youtube') {
    return undefined;
  }
  return trimmed;
}

function tokenize(str: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'le', 'la', 'les', 'de', 'du', 'des', 'et', 'and', 'ft', 'feat']);
  return normalizeText(str)
    .split(' ')
    .filter((w) => w.length >= 2 && !stopWords.has(w));
}

function tokenOverlapScore(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) {
    return normalizeText(a) === normalizeText(b) ? 1 : 0;
  }
  const setB = new Set(tokensB);
  let matches = 0;
  for (const t of tokensA) {
    if (setB.has(t)) matches++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? matches / union : 0;
}

function hasVariantMismatch(queryTitle: string, candidateTitle: string): boolean {
  const variants = [
    'remix',
    'slowed',
    'sped up',
    'nightcore',
    'instrumental',
    'karaoke',
    'cover',
    'live',
    'acoustic',
    'acoustique',
    '8d',
  ];
  const qNorm = normalizeText(queryTitle);
  const cNorm = normalizeText(candidateTitle);
  for (const v of variants) {
    const inCandidate = cNorm.includes(v);
    const inQuery = qNorm.includes(v);
    if (inCandidate && !inQuery) return true;
  }
  return false;
}

export function parseLrc(rawLrc: string): LyricLine[] {
  if (!rawLrc) return [];

  let offsetSeconds = 0;
  const offsetMatch = rawLrc.match(/\[offset:\s*([+-]?\d+)\]/i);
  if (offsetMatch) {
    offsetSeconds = parseInt(offsetMatch[1], 10) / 1000;
  }

  const prepared = rawLrc
    .replace(/\r\n/g, '\n')
    .replace(/(\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])/g, '\n$1');

  const rawLines = prepared.split('\n');
  const result: LyricLine[] = [];
  const timeTagRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^\[(ar|ti|al|au|by|offset|re|ve|length):/i.test(trimmed)) continue;

    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    timeTagRegex.lastIndex = 0;
    while ((match = timeTagRegex.exec(trimmed)) !== null) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const fracStr = match[3] || '0';
      const frac =
        fracStr.length === 3
          ? parseInt(fracStr, 10) / 1000
          : fracStr.length === 2
          ? parseInt(fracStr, 10) / 100
          : parseInt(fracStr, 10) / 10;
      const totalSec = Math.max(0, mins * 60 + secs + frac + offsetSeconds);
      timestamps.push(totalSec);
    }

    if (timestamps.length === 0) continue;

    const text = trimmed
      .replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '')
      .replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) continue;

    for (const time of timestamps) {
      result.push({ time, text });
    }
  }

  result.sort((a, b) => a.time - b.time);

  const deduped: LyricLine[] = [];
  for (const item of result) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.time - item.time) < 0.05 && prev.text === item.text) {
      continue;
    }
    deduped.push(item);
  }
  return deduped;
}

function loadPersistentCache(key: string = LYRICS_CACHE_KEY): Record<string, LyricsResult> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToPersistentCache(cacheKeyId: string, result: LyricsResult, storageKey: string = LYRICS_CACHE_KEY): void {
  try {
    const cache = loadPersistentCache(storageKey);
    const keys = Object.keys(cache);
    if (keys.length >= 80) {
      delete cache[keys[0]];
    }
    cache[cacheKeyId] = result;
    localStorage.setItem(storageKey, JSON.stringify(cache));
  } catch {
    // Ignore storage quota errors
  }
}

function removeFromPersistentCache(cacheKeyId: string, storageKey: string = LYRICS_CACHE_KEY): void {
  try {
    const cache = loadPersistentCache(storageKey);
    if (cache[cacheKeyId]) {
      delete cache[cacheKeyId];
      localStorage.setItem(storageKey, JSON.stringify(cache));
    }
  } catch {
    // Ignore storage errors
  }
}

interface LrclibRecord {
  id: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

function isValidLrclibRecord(value: unknown): value is LrclibRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  return typeof rec.id === 'number' || typeof rec.trackName === 'string';
}

function evaluateCandidate(
  candidate: LrclibRecord,
  queryTitle: string,
  artistCandidates: string[],
  targetDuration: number,
  rawQueryTitle: string
): { score: number; verified: boolean } {
  const cTitleRaw = candidate.trackName || '';
  const cArtistRaw = candidate.artistName || '';
  const cTitleClean = cleanTrackTitle(cTitleRaw);

  if (!cTitleRaw && !cArtistRaw) return { score: -1000, verified: false };
  if (!candidate.syncedLyrics && !candidate.plainLyrics && !candidate.instrumental) {
    return { score: -1000, verified: false };
  }

  if (hasVariantMismatch(rawQueryTitle, cTitleRaw)) {
    return { score: -800, verified: false };
  }

  if (candidate.duration && targetDuration > 0) {
    const diff = Math.abs(candidate.duration - targetDuration);
    if (diff > 90) {
      return { score: -700, verified: false };
    }
  }

  const titleNormQuery = normalizeText(queryTitle);
  const titleNormCand = normalizeText(cTitleClean || cTitleRaw);
  const queryTokens = tokenize(queryTitle);
  const candTokens = tokenize(cTitleClean || cTitleRaw);

  let titleScore = tokenOverlapScore(queryTitle, cTitleClean || cTitleRaw);
  if (titleNormQuery && titleNormCand) {
    if (titleNormCand === titleNormQuery) {
      titleScore = 1.25;
    } else if (
      queryTokens.length >= 2 &&
      candTokens.length >= 2 &&
      titleScore >= 0.65 &&
      (titleNormCand.includes(titleNormQuery) || titleNormQuery.includes(titleNormCand))
    ) {
      titleScore = Math.max(titleScore, 0.9);
    }
  }

  if (queryTokens.length <= 2 && candTokens.length > queryTokens.length && titleScore < 0.7) {
    return { score: -600, verified: false };
  }
  if (titleScore < 0.55) {
    return { score: -500, verified: false };
  }

  const candArtists = extractArtistCandidates(cArtistRaw);
  let bestArtistScore = 0;

  for (const qArt of artistCandidates) {
    const qNorm = normalizeText(qArt);
    if (!qNorm) continue;
    for (const cArt of candArtists) {
      const cNorm = normalizeText(cArt);
      if (!cNorm) continue;

      let s = tokenOverlapScore(qArt, cArt);
      if (qNorm === cNorm) {
        s = 1.25;
      } else if (
        qNorm.length >= 3 &&
        cNorm.length >= 3 &&
        (cNorm.includes(qNorm) || qNorm.includes(cNorm))
      ) {
        s = Math.max(s, 0.9);
      }
      if (s > bestArtistScore) {
        bestArtistScore = s;
      }
    }
  }

  if (bestArtistScore < 0.45) {
    return { score: -400, verified: false };
  }

  let score = titleScore * 55 + bestArtistScore * 40;

  if (candidate.syncedLyrics) score += 25;
  if (candidate.instrumental && !candidate.syncedLyrics && !candidate.plainLyrics) score -= 20;

  let durationClose = true;
  if (candidate.duration && targetDuration > 0) {
    const diff = Math.abs(candidate.duration - targetDuration);
    if (diff <= 4) score += 18;
    else if (diff <= 15) score += 10;
    else if (diff <= 30) score += 2;
    else if (diff > 45) {
      score -= 20;
      durationClose = false;
    }
  }

  // Only mark "Paroles vérifiées" when title, artist, and duration reliability are high
  const verified = titleScore >= 0.85 && bestArtistScore >= 0.85 && durationClose;
  return { score, verified };
}

function buildResultFromRecord(track: Track, record: LrclibRecord, verified: boolean): LyricsResult | null {
  const syncedLines = record.syncedLyrics ? parseLrc(record.syncedLyrics) : [];
  const rawPlain = record.plainLyrics || '';
  const plainLines = rawPlain
    ? rawPlain
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

  if (record.instrumental && syncedLines.length === 0 && plainLines.length === 0) {
    return {
      trackId: track.id,
      matchedTitle: record.trackName || track.title,
      matchedArtist: record.artistName || track.artist,
      matchedAlbum: record.albumName || track.album,
      synced: false,
      lines: [],
      plainLines: [],
      instrumental: true,
      source: 'lrclib',
      verified,
    };
  }

  if (syncedLines.length === 0 && plainLines.length === 0) {
    return null;
  }

  return {
    trackId: track.id,
    matchedTitle: record.trackName || track.title,
    matchedArtist: record.artistName || track.artist,
    matchedAlbum: record.albumName || track.album,
    synced: syncedLines.length > 0,
    lines: syncedLines,
    plainLines,
    instrumental: false,
    source: 'lrclib',
    verified,
  };
}

async function fetchLrclibJson(url: string, externalSignal?: AbortSignal): Promise<unknown | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (err: any) {
    window.clearTimeout(timeoutId);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);

    if (externalSignal?.aborted) {
      throw err;
    }
    throw new LrclibRequestError(
      'network',
      'Erreur réseau ou délai dépassé lors de la connexion à LRCLIB.'
    );
  } finally {
    window.clearTimeout(timeoutId);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }

  if (response.status === 404) {
    return null;
  }

  if (response.status === 429) {
    throw new LrclibRequestError(
      'rate_limit',
      'Limite de requêtes LRCLIB atteinte (429). Veuillez patienter un instant et réessayer.'
    );
  }

  if (!response.ok) {
    throw new LrclibRequestError(
      'invalid_response',
      `Le service LRCLIB a renvoyé une erreur HTTP ${response.status}.`
    );
  }

  try {
    return await response.json();
  } catch {
    throw new LrclibRequestError(
      'invalid_response',
      'Réponse API invalide reçue depuis LRCLIB (JSON corrompu).'
    );
  }
}

export const LyricsService = {
  clearCacheForTrack(trackId: string): void {
    memoryCache.delete(trackId);
    removeFromPersistentCache(trackId, LYRICS_CACHE_KEY);
  },

  async fetchLyricsDetailed(
    track: Track,
    options?: { bypassCache?: boolean; signal?: AbortSignal }
  ): Promise<LyricsFetchOutcome> {
    if (!track || !track.title) {
      return {
        status: 'not_found',
        lyrics: null,
        errorType: 'not_found',
        errorMessage: 'Musique introuvable ou titre manquant.',
      };
    }

    if (options?.bypassCache) {
      this.clearCacheForTrack(track.id);
    } else {
      if (memoryCache.has(track.id)) {
        return { ...memoryCache.get(track.id)!, fromCache: true };
      }

      const persisted = loadPersistentCache(LYRICS_CACHE_KEY);
      if (persisted[track.id]) {
        const cachedLyrics = persisted[track.id];
        const cachedOutcome: LyricsFetchOutcome = {
          status: cachedLyrics.instrumental ? 'instrumental' : 'found',
          lyrics: cachedLyrics,
          errorType: cachedLyrics.instrumental ? 'instrumental' : undefined,
          fromCache: true,
        };
        memoryCache.set(track.id, cachedOutcome);
        return cachedOutcome;
      }
    }

    const splitPair = splitArtistAndTitleFromTrackTitle(track.title);
    const reversedPair = splitReversedTitleAndArtist(track.title);
    const cleanedTitle = cleanTrackTitle(track.title);
    const { baseTitle, isTempoModified } = stripTempoEditSuffix(cleanedTitle);
    const cleanedArtist = cleanArtistName(track.artist);
    const cleanedAlbum = cleanAlbumName(track.album);
    const durationSec =
      typeof track.duration === 'number' && Number.isFinite(track.duration) && track.duration > 0
        ? Math.round(track.duration)
        : 0;

    const queryPairs: Array<{ title: string; artist: string; tempoVariant?: boolean }> = [];
    if (splitPair && isGenericYouTubeArtist(track.artist)) {
      queryPairs.push(splitPair);
      const splitBase = stripTempoEditSuffix(splitPair.title);
      if (splitBase.isTempoModified) {
        queryPairs.push({ title: splitBase.baseTitle, artist: splitPair.artist, tempoVariant: true });
      }
    }
    if (cleanedTitle && cleanedArtist && !isGenericYouTubeArtist(cleanedArtist)) {
      queryPairs.push({ title: cleanedTitle, artist: cleanedArtist });
      if (isTempoModified) {
        queryPairs.push({ title: baseTitle, artist: cleanedArtist, tempoVariant: true });
      }
    }
    if (splitPair && !queryPairs.some((p) => p.title === splitPair.title && p.artist === splitPair.artist)) {
      queryPairs.push(splitPair);
    }
    if (
      reversedPair &&
      isGenericYouTubeArtist(track.artist) &&
      !queryPairs.some((p) => p.title === reversedPair.title && p.artist === reversedPair.artist)
    ) {
      const revBase = stripTempoEditSuffix(reversedPair.title);
      queryPairs.push({
        title: revBase.isTempoModified ? revBase.baseTitle : reversedPair.title,
        artist: reversedPair.artist,
        tempoVariant: revBase.isTempoModified,
      });
    }
    if (cleanedTitle && !queryPairs.some((p) => p.title === cleanedTitle)) {
      queryPairs.push({ title: cleanedTitle, artist: cleanedArtist });
    }

    if (queryPairs.length === 0) {
      return {
        status: 'not_found',
        lyrics: null,
        errorType: 'not_found',
        errorMessage: 'Musique introuvable.',
      };
    }

    const primaryPair = queryPairs[0];
    const artistVerifyList = Array.from(
      new Set([
        ...extractArtistCandidates(track.artist),
        ...(splitPair ? [splitPair.artist] : []),
        ...(reversedPair && isGenericYouTubeArtist(track.artist) ? [reversedPair.artist] : []),
      ])
    ).filter((a) => !isGenericYouTubeArtist(a));

    const tryBuildVerifiedOutcome = (
      record: LrclibRecord,
      titleForScore: string,
      tempoVariant = false
    ): LyricsFetchOutcome | null => {
      const { score, verified } = evaluateCandidate(
        record,
        titleForScore,
        artistVerifyList.length > 0 ? artistVerifyList : [primaryPair.artist],
        tempoVariant ? 0 : durationSec,
        tempoVariant ? titleForScore : track.title
      );

      if (score < 45) return null;

      const built = buildResultFromRecord(track, record, verified);
      if (!built) return null;

      // If audio tempo is altered (slowed/sped up), display classic plain lines so timestamps don't desync
      if (tempoVariant && built.synced) {
        built.plainLines =
          built.plainLines.length > 0 ? built.plainLines : built.lines.map((l) => l.text);
        built.lines = [];
        built.synced = false;
      }

      const outcome: LyricsFetchOutcome = built.instrumental
        ? {
            status: 'instrumental',
            lyrics: built,
            errorType: 'instrumental',
          }
        : {
            status: 'found',
            lyrics: built,
          };

      memoryCache.set(track.id, outcome);
      saveToPersistentCache(track.id, built, LYRICS_CACHE_KEY);
      return outcome;
    };

    try {
      // 1. Parallelized LRCLIB lookup (/api/get + /api/search concurrently) so resolution takes ~300-600ms
      const getCandidates: Array<{ url: string; title: string; tempoVariant: boolean }> = [];
      for (let i = 0; i < Math.min(2, queryPairs.length); i++) {
        const pair = queryPairs[i];
        if (!pair.title || !pair.artist || isGenericYouTubeArtist(pair.artist)) continue;

        const exactParams = new URLSearchParams({
          track_name: pair.title,
          artist_name: pair.artist,
        });
        if (i === 0 && cleanedAlbum) {
          exactParams.set('album_name', cleanedAlbum);
        }
        if (durationSec > 0 && !pair.tempoVariant) {
          exactParams.set('duration', String(durationSec));
        }
        getCandidates.push({
          url: `${LRCLIB_API_BASE}/get?${exactParams.toString()}`,
          title: pair.title,
          tempoVariant: Boolean(pair.tempoVariant),
        });

        if (i === 0 && (durationSec > 0 || cleanedAlbum)) {
          const relaxedParams = new URLSearchParams({
            track_name: pair.title,
            artist_name: pair.artist,
          });
          getCandidates.push({
            url: `${LRCLIB_API_BASE}/get?${relaxedParams.toString()}`,
            title: pair.title,
            tempoVariant: Boolean(pair.tempoVariant),
          });
        }
      }

      const searchCandidates: Array<{ url: string; title: string; tempoVariant: boolean }> = [];
      if (primaryPair.artist && !isGenericYouTubeArtist(primaryPair.artist)) {
        const structuredSearch = new URLSearchParams({
          track_name: primaryPair.title,
          artist_name: primaryPair.artist,
        });
        searchCandidates.push({
          url: `${LRCLIB_API_BASE}/search?${structuredSearch.toString()}`,
          title: primaryPair.title,
          tempoVariant: Boolean(primaryPair.tempoVariant),
        });
        searchCandidates.push({
          url: `${LRCLIB_API_BASE}/search?q=${encodeURIComponent(`${primaryPair.artist} ${primaryPair.title}`)}`,
          title: primaryPair.title,
          tempoVariant: Boolean(primaryPair.tempoVariant),
        });
      } else {
        searchCandidates.push({
          url: `${LRCLIB_API_BASE}/search?q=${encodeURIComponent(primaryPair.title)}`,
          title: primaryPair.title,
          tempoVariant: Boolean(primaryPair.tempoVariant),
        });
      }

      if (queryPairs[1] && queryPairs[1].title !== primaryPair.title) {
        const p2 = queryPairs[1];
        const q2 = p2.artist && !isGenericYouTubeArtist(p2.artist) ? `${p2.artist} ${p2.title}` : p2.title;
        searchCandidates.push({
          url: `${LRCLIB_API_BASE}/search?q=${encodeURIComponent(q2)}`,
          title: p2.title,
          tempoVariant: Boolean(p2.tempoVariant),
        });
      }

      const [getSettled, searchSettled] = await Promise.all([
        Promise.allSettled(
          getCandidates.map(async (c) => ({
            ...c,
            data: await fetchLrclibJson(c.url, options?.signal),
          }))
        ),
        Promise.allSettled(
          searchCandidates.map(async (c) => ({
            ...c,
            data: await fetchLrclibJson(c.url, options?.signal),
          }))
        ),
      ]);

      if (options?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      let firstHardError: LrclibRequestError | null = null;
      let bestRecord: LrclibRecord | null = null;
      let bestScore = -Infinity;
      let bestTitleForScore = primaryPair.title;
      let bestTempoVariant = false;

      for (const item of getSettled) {
        if (item.status === 'rejected') {
          if (item.reason instanceof LrclibRequestError && !firstHardError) {
            firstHardError = item.reason;
          }
          continue;
        }
        const { data, title, tempoVariant } = item.value;
        if (data === null) continue;
        if (!isValidLrclibRecord(data)) continue;
        const outcome = tryBuildVerifiedOutcome(data, title, tempoVariant);
        if (outcome) return outcome;
      }

      for (const item of searchSettled) {
        if (item.status === 'rejected') {
          if (item.reason instanceof LrclibRequestError && !firstHardError) {
            firstHardError = item.reason;
          }
          continue;
        }
        const { data, title, tempoVariant } = item.value;
        if (data === null || !Array.isArray(data)) continue;

        for (const rec of data) {
          if (!isValidLrclibRecord(rec)) continue;
          const { score } = evaluateCandidate(
            rec,
            title,
            artistVerifyList.length > 0 ? artistVerifyList : [primaryPair.artist],
            tempoVariant ? 0 : durationSec,
            tempoVariant ? title : track.title
          );
          if (score > bestScore) {
            bestScore = score;
            bestRecord = rec;
            bestTitleForScore = title;
            bestTempoVariant = tempoVariant;
          }
        }
      }

      if (bestRecord && bestScore >= 45) {
        const outcome = tryBuildVerifiedOutcome(bestRecord, bestTitleForScore, bestTempoVariant);
        if (outcome) return outcome;
      }

      if (firstHardError) {
        throw firstHardError;
      }

      const notFoundOutcome: LyricsFetchOutcome = {
        status: 'not_found',
        lyrics: null,
        errorType: 'not_found',
        errorMessage: 'Paroles indisponibles sur LRCLIB pour cette musique.',
      };
      memoryCache.set(track.id, notFoundOutcome);
      return notFoundOutcome;
    } catch (err: any) {
      if (err?.name === 'AbortError' && options?.signal?.aborted) {
        throw err;
      }

      if (err instanceof LrclibRequestError) {
        return {
          status: 'error',
          lyrics: null,
          errorType: err.errorType,
          errorMessage: err.message,
        };
      }

      return {
        status: 'error',
        lyrics: null,
        errorType: 'network',
        errorMessage: 'Erreur réseau inattendue lors de la recherche des paroles.',
      };
    }
  },

  async transcribeAuthorizedAudio(
    track: Track,
    file: File,
    options: {
      authorized: boolean;
      bypassCache?: boolean;
      signal?: AbortSignal;
      onProgress?: (stepText: string) => void;
    }
  ): Promise<LyricsFetchOutcome> {
    if (!options.authorized) {
      return {
        status: 'error',
        lyrics: null,
        errorType: 'audio_inaccessible',
        errorMessage:
          "Veuillez confirmer que l'utilisation et la transcription de ce fichier audio sont autorisées.",
      };
    }

    let fileHash: string;
    try {
      fileHash = await computeFileSha256(file);
    } catch {
      return {
        status: 'error',
        lyrics: null,
        errorType: 'audio_inaccessible',
        errorMessage: 'Impossible de lire le fichier audio fourni.',
      };
    }

    // Deduplication cache: never retranscribe the exact same audio file twice
    if (!options.bypassCache) {
      const memByHash = groqHashMemoryCache.get(fileHash);
      if (memByHash) {
        const boundResult: LyricsResult = { ...memByHash, trackId: track.id };
        const outcome: LyricsFetchOutcome = { status: 'found', lyrics: boundResult, fromCache: true };
        memoryCache.set(track.id, outcome);
        saveToPersistentCache(track.id, boundResult, LYRICS_CACHE_KEY);
        return outcome;
      }

      const persistedHashMap = loadPersistentCache(GROQ_FILE_CACHE_KEY);
      if (persistedHashMap[fileHash]) {
        const boundResult: LyricsResult = { ...persistedHashMap[fileHash], trackId: track.id };
        groqHashMemoryCache.set(fileHash, boundResult);
        const outcome: LyricsFetchOutcome = { status: 'found', lyrics: boundResult, fromCache: true };
        memoryCache.set(track.id, outcome);
        saveToPersistentCache(track.id, boundResult, LYRICS_CACHE_KEY);
        return outcome;
      }
    } else {
      groqHashMemoryCache.delete(fileHash);
      removeFromPersistentCache(fileHash, GROQ_FILE_CACHE_KEY);
    }

    let chunks;
    try {
      options.onProgress?.('Préparation et vérification du fichier audio…');
      chunks = await prepareAudioUploadChunks(file);
    } catch (err: any) {
      return {
        status: 'error',
        lyrics: null,
        errorType: 'audio_inaccessible',
        errorMessage:
          err instanceof AudioPreparationError
            ? err.message
            : 'Fichier audio inaccessible ou illisible.',
      };
    }

    const mergedLines: LyricLine[] = [];
    const mergedPlain: string[] = [];
    let anyUncertain = false;
    let anyIncomplete = false;
    let succeededChunks = 0;
    let lastErrorType: LyricsErrorType = 'groq_error';
    let lastErrorMessage = 'Erreur lors de la transcription Groq.';

    for (const chunk of chunks) {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      options.onProgress?.(
        chunks.length > 1
          ? `Transcription IA Groq (segment ${chunk.chunkIndex + 1}/${chunks.length})…`
          : 'Transcription IA Groq en cours…'
      );

      try {
        const res = await fetch('/api/lyrics/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': chunk.mimeType || 'application/octet-stream',
            'X-Authorized': 'true',
            'X-File-Name': encodeURIComponent(chunk.fileName),
            'X-File-Mime': chunk.mimeType,
            'X-File-Hash': fileHash,
          },
          body: chunk.blob,
          signal: options.signal,
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          lastErrorType = 'invalid_response';
          lastErrorMessage = 'Réponse invalide du serveur lors de la transcription.';
          anyIncomplete = true;
          continue;
        }

        if (!res.ok) {
          lastErrorType = (data?.errorType as LyricsErrorType) || (res.status === 429 ? 'rate_limit' : 'groq_error');
          lastErrorMessage = data?.error || `Erreur Groq (HTTP ${res.status}).`;
          anyIncomplete = true;
          // Stop immediately on hard quota/config errors
          if (res.status === 429 || res.status === 503 || res.status === 403) {
            break;
          }
          continue;
        }

        succeededChunks++;
        if (data?.uncertain) anyUncertain = true;
        if (data?.incomplete) anyIncomplete = true;

        const segs = Array.isArray(data?.segments) ? data.segments : [];
        if (segs.length > 0) {
          for (const seg of segs) {
            const text = typeof seg?.text === 'string' ? seg.text.trim() : '';
            if (!text) continue;
            const time =
              typeof seg?.start === 'number' && Number.isFinite(seg.start)
                ? Math.max(0, seg.start + chunk.timeOffsetSec)
                : chunk.timeOffsetSec;
            mergedLines.push({ time, text });
            mergedPlain.push(text);
          }
        } else if (typeof data?.text === 'string' && data.text.trim()) {
          const lines = data.text
            .split('\n')
            .map((l: string) => l.trim())
            .filter(Boolean);
          mergedPlain.push(...lines);
          anyIncomplete = true;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' && options.signal?.aborted) {
          throw err;
        }
        lastErrorType = 'network';
        lastErrorMessage = 'Erreur réseau lors de la communication avec le serveur de transcription.';
        anyIncomplete = true;
      }
    }

    if (succeededChunks === 0 || (mergedLines.length === 0 && mergedPlain.length === 0)) {
      return {
        status: 'error',
        lyrics: null,
        errorType: lastErrorType,
        errorMessage: lastErrorMessage,
      };
    }

    const isIncomplete = anyIncomplete || succeededChunks < chunks.length;

    const groqResult: LyricsResult = {
      trackId: track.id,
      matchedTitle: track.title,
      matchedArtist: track.artist,
      matchedAlbum: track.album,
      synced: mergedLines.length > 0,
      lines: mergedLines,
      plainLines: mergedPlain,
      instrumental: false,
      source: 'groq',
      verified: false,
      uncertain: anyUncertain || isIncomplete,
      incomplete: isIncomplete,
      fileHash,
    };

    if (!isIncomplete) {
      groqHashMemoryCache.set(fileHash, groqResult);
      saveToPersistentCache(fileHash, groqResult, GROQ_FILE_CACHE_KEY);
      saveToPersistentCache(track.id, groqResult, LYRICS_CACHE_KEY);
    }

    const outcome: LyricsFetchOutcome = {
      status: 'found',
      lyrics: groqResult,
      errorType: isIncomplete ? 'transcription_incomplete' : undefined,
      errorMessage: isIncomplete
        ? 'Transcription incomplète : certains segments audio n’ont pas pu être traités.'
        : undefined,
    };

    if (!isIncomplete) {
      memoryCache.set(track.id, outcome);
    }
    return outcome;
  },

  async transcribeLiveSlice(
    audioBlob: Blob,
    options: {
      authorized: boolean;
      timeOffsetSec?: number;
      signal?: AbortSignal;
    }
  ): Promise<{
    ok: boolean;
    lines: LyricLine[];
    plainLines: string[];
    uncertain?: boolean;
    incomplete?: boolean;
    errorType?: LyricsErrorType;
    errorMessage?: string;
  }> {
    if (!options.authorized) {
      return {
        ok: false,
        lines: [],
        plainLines: [],
        errorType: 'audio_inaccessible',
        errorMessage:
          "Veuillez confirmer que l'utilisation et la transcription de ce son sont autorisées.",
      };
    }

    if (!audioBlob || audioBlob.size < 512) {
      return { ok: true, lines: [], plainLines: [] };
    }

    const rawMime = (audioBlob.type || 'audio/wav').split(';')[0].trim().toLowerCase();
    const ext = rawMime.includes('mp4')
      ? 'm4a'
      : rawMime.includes('ogg')
      ? 'ogg'
      : rawMime.includes('webm')
      ? 'webm'
      : 'wav';
    const offset =
      typeof options.timeOffsetSec === 'number' && Number.isFinite(options.timeOffsetSec)
        ? Math.max(0, options.timeOffsetSec)
        : 0;

    try {
      const res = await fetch('/api/lyrics/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': rawMime || 'audio/wav',
          'X-Authorized': 'true',
          'X-File-Name': encodeURIComponent(`live_slice.${ext}`),
          'X-File-Mime': rawMime || 'audio/wav',
        },
        body: audioBlob,
        signal: options.signal,
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        return {
          ok: false,
          lines: [],
          plainLines: [],
          errorType: 'invalid_response',
          errorMessage: 'Réponse invalide du serveur lors de la transcription.',
        };
      }

      if (!res.ok) {
        // An instrumental intro/outro slice with no vocals is non-fatal during live streaming
        if (res.status === 422 && data?.errorType === 'transcription_incomplete') {
          return { ok: true, lines: [], plainLines: [] };
        }
        return {
          ok: false,
          lines: [],
          plainLines: [],
          errorType:
            (data?.errorType as LyricsErrorType) || (res.status === 429 ? 'rate_limit' : 'groq_error'),
          errorMessage: data?.error || `Erreur Groq (HTTP ${res.status}).`,
        };
      }

      const segs = Array.isArray(data?.segments) ? data.segments : [];
      const lines: LyricLine[] = [];
      const plainLines: string[] = [];

      for (const seg of segs) {
        const text = typeof seg?.text === 'string' ? seg.text.trim() : '';
        if (!text) continue;
        const start =
          typeof seg?.start === 'number' && Number.isFinite(seg.start)
            ? Math.max(0, seg.start + offset)
            : offset;
        lines.push({ time: start, text });
        plainLines.push(text);
      }

      if (lines.length === 0 && typeof data?.text === 'string' && data.text.trim()) {
        const txtLines = data.text
          .split('\n')
          .map((l: string) => l.trim())
          .filter(Boolean);
        for (const l of txtLines) {
          lines.push({ time: offset, text: l });
          plainLines.push(l);
        }
      }

      return {
        ok: true,
        lines,
        plainLines,
        uncertain: Boolean(data?.uncertain),
        incomplete: Boolean(data?.incomplete),
      };
    } catch (err: any) {
      if (err?.name === 'AbortError' && options.signal?.aborted) {
        throw err;
      }
      return {
        ok: false,
        lines: [],
        plainLines: [],
        errorType: 'network',
        errorMessage: 'Erreur réseau pendant la transcription audio Groq.',
      };
    }
  },

  buildLiveLyricsResult(
    track: Track,
    lines: LyricLine[],
    plainLines: string[],
    uncertain = true,
    incomplete = false
  ): LyricsResult {
    return {
      trackId: track.id,
      matchedTitle: track.title,
      matchedArtist: track.artist,
      matchedAlbum: track.album,
      synced: lines.length > 0,
      lines,
      plainLines,
      instrumental: false,
      source: 'groq',
      verified: false,
      uncertain,
      incomplete,
    };
  },

  cacheLiveLyricsResult(track: Track, result: LyricsResult): void {
    const outcome: LyricsFetchOutcome = {
      status: 'found',
      lyrics: result,
    };
    memoryCache.set(track.id, outcome);
    saveToPersistentCache(track.id, result, LYRICS_CACHE_KEY);
  },

  async transcribeLiveCaptureBlob(
    track: Track,
    audioBlob: Blob,
    options: {
      authorized: boolean;
      timeOffsetSec?: number;
      signal?: AbortSignal;
    }
  ): Promise<LyricsFetchOutcome> {
    const sliceRes = await this.transcribeLiveSlice(audioBlob, options);
    if (!sliceRes.ok) {
      return {
        status: 'error',
        lyrics: null,
        errorType: sliceRes.errorType || 'groq_error',
        errorMessage: sliceRes.errorMessage || 'Erreur Groq lors de la transcription.',
      };
    }
    if (sliceRes.lines.length === 0 && sliceRes.plainLines.length === 0) {
      return {
        status: 'error',
        lyrics: null,
        errorType: 'transcription_incomplete',
        errorMessage: 'Aucune parole intelligible détectée dans cet extrait audio.',
      };
    }
    const result = this.buildLiveLyricsResult(
      track,
      sliceRes.lines,
      sliceRes.plainLines,
      true,
      Boolean(sliceRes.incomplete)
    );
    this.cacheLiveLyricsResult(track, result);
    return { status: 'found', lyrics: result };
  },

  async fetchLyrics(track: Track): Promise<LyricsResult | null> {
    const outcome = await this.fetchLyricsDetailed(track);
    return outcome.lyrics;
  },
};
