import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface SpotifyTrackItem {
  title: string;
  artist: string;
  durationSec: number;
}

interface SpotifyResource {
  kind: 'playlist' | 'album';
  id: string;
}

function parseSpotifyResource(input: string): SpotifyResource | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Accept spotify URI: spotify:playlist:<id> or spotify:album:<id>
  const uriMatch = trimmed.match(/^spotify:(playlist|album):([a-zA-Z0-9]{15,32})$/);
  if (uriMatch) {
    return { kind: uriMatch[1] as 'playlist' | 'album', id: uriMatch[2] };
  }

  // Accept bare Spotify ID
  if (/^[a-zA-Z0-9]{15,32}$/.test(trimmed)) {
    return { kind: 'playlist', id: trimmed };
  }

  // Strictly parse HTTP(S) Spotify URL and allowlist open.spotify.com only (prevents SSRF)
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.hostname !== 'open.spotify.com' && parsed.hostname !== 'play.spotify.com') {
      return null;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    // Support /intl-fr/playlist/<id> or /embed/playlist/<id> or /playlist/<id>
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (seg === 'playlist' || seg === 'album') {
        const idCandidate = segments[i + 1];
        if (/^[a-zA-Z0-9]{15,32}$/.test(idCandidate)) {
          return { kind: seg, id: idCandidate };
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function extractNextDataJson(html: string): any | null {
  const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractYtInitialData(html: string): any | null {
  const markers = [
    'var ytInitialData = ',
    'window["ytInitialData"] = ',
    'ytInitialData = ',
  ];
  for (const marker of markers) {
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) continue;
    const jsonStart = html.indexOf('{', startIdx + marker.length);
    if (jsonStart === -1) continue;
    const endTag = html.indexOf(';</script>', jsonStart);
    if (endTag === -1) continue;
    try {
      return JSON.parse(html.slice(jsonStart, endTag));
    } catch {
      // Try next marker
    }
  }
  return null;
}

function parseDurationTextToSec(text: string): number {
  const parts = text
    .trim()
    .split(':')
    .map((p) => parseInt(p, 10))
    .filter((n) => !Number.isNaN(n));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 210;
}

function collectVideoRenderers(node: any, out: any[] = [], depth = 0): any[] {
  if (!node || typeof node !== 'object' || depth > 14 || out.length >= 12) return out;
  if (node.videoRenderer && typeof node.videoRenderer.videoId === 'string') {
    out.push(node.videoRenderer);
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectVideoRenderers(item, out, depth + 1);
      if (out.length >= 12) break;
    }
  } else {
    for (const key of Object.keys(node)) {
      collectVideoRenderers(node[key], out, depth + 1);
      if (out.length >= 12) break;
    }
  }
  return out;
}

interface GroqSegment {
  start: number;
  end: number;
  text: string;
}

interface GroqCachedResult {
  text: string;
  segments: GroqSegment[];
  language?: string;
  duration?: number;
  uncertain: boolean;
  incomplete: boolean;
}

const ytSearchCache = new Map<string, { tracks: any[]; expiresAt: number }>();
const groqTranscriptionCache = new Map<string, { result: GroqCachedResult; expiresAt: number }>();

interface TikTokResolvedMedia {
  id: string;
  title: string;
  videoTitle: string;
  artist: string;
  authorHandle: string;
  duration: number;
  durationFormatted: string;
  thumbnail: string;
  sourceUrl: string;
  mediaUrls: string[];
  cookies?: string;
  expiresAt: number;
}

const tiktokMediaCache = new Map<string, TikTokResolvedMedia>();

const ALLOWED_TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
]);

const ALLOWED_TIKTOK_CDN_SUFFIXES = [
  '.tiktokcdn.com',
  '.tiktokcdn-us.com',
  '.tiktokcdn-eu.com',
  '.tiktokcdn-in.com',
  '.tiktokcdn-ca.com',
  '.tiktokv.com',
  '.tiktokv.eu',
  '.tiktokw.us',
  '.tiktokw.eu',
  '.tiktok.com',
  '.tikwm.com',
  '.byteoversea.com',
  '.bytefcdn.com',
  '.bytefcdn-oversea.com',
  '.ibytedtos.com',
  '.ibyteimg.com',
  '.muscdn.com',
  '.musical.ly',
];

function parseTikTokUrl(rawInput: string): URL | null {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > 500) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password || parsed.port) return null;
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_TIKTOK_HOSTS.has(host)) return null;
    parsed.protocol = 'https:';
    return parsed;
  } catch {
    return null;
  }
}

function isSafePublicHttpsMediaUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password || parsed.port) return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
      return false;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
      return false;
    }
    return ALLOWED_TIKTOK_CDN_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
  } catch {
    return false;
  }
}

function formatDurationSeconds(seconds: number): string {
  const safe = Math.max(1, Math.round(seconds || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const TIKTOK_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchTikTokPageSafely(
  initialUrl: URL
): Promise<{ finalUrl: string; html: string; cookies: string }> {
  let currentUrl = initialUrl;
  const cookieMap = new Map<string, string>();

  for (let hop = 0; hop < 6; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    let res: Response;
    try {
      const cookieHeader = Array.from(cookieMap.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      res = await fetch(currentUrl.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': TIKTOK_BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const sc of setCookies) {
      const firstPart = sc.split(';')[0] || '';
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx > 0) {
        cookieMap.set(firstPart.slice(0, eqIdx).trim(), firstPart.slice(eqIdx + 1).trim());
      }
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) break;
      const nextParsed = parseTikTokUrl(new URL(loc, currentUrl).toString());
      if (!nextParsed) {
        throw new Error('Redirection TikTok non autorisée.');
      }
      currentUrl = nextParsed;
      continue;
    }

    if (!res.ok) {
      throw new Error(`Impossible de charger la page TikTok (HTTP ${res.status}).`);
    }

    const html = await res.text();
    const cookies = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    return { finalUrl: currentUrl.toString(), html, cookies };
  }

  throw new Error('Trop de redirections sur le lien TikTok.');
}

function extractTikTokWebItemStruct(html: string): any | null {
  const universalMatch = html.match(
    /<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (universalMatch?.[1]) {
    try {
      const parsed = JSON.parse(universalMatch[1]);
      const scope = parsed?.__DEFAULT_SCOPE__;
      const item =
        scope?.['webapp.video-detail']?.itemInfo?.itemStruct ||
        scope?.['webapp.reflow.video.detail']?.itemInfo?.itemStruct;
      if (item && typeof item === 'object') return item;
    } catch {
      // Fall through to SIGI_STATE
    }
  }

  const sigiMatch = html.match(/<script[^>]*id=["']SIGI_STATE["'][^>]*>([\s\S]*?)<\/script>/i);
  if (sigiMatch?.[1]) {
    try {
      const parsed = JSON.parse(sigiMatch[1]);
      const itemModule = parsed?.ItemModule;
      if (itemModule && typeof itemModule === 'object') {
        const firstKey = Object.keys(itemModule)[0];
        if (firstKey && itemModule[firstKey]) return itemModule[firstKey];
      }
    } catch {
      // Ignore parse failure
    }
  }

  return null;
}

async function resolveTikTokFromWeb(tiktokUrl: URL, canonicalUrl: string): Promise<TikTokResolvedMedia> {
  const { finalUrl, html, cookies } = await fetchTikTokPageSafely(tiktokUrl);
  const item = extractTikTokWebItemStruct(html);
  if (!item) {
    throw new Error('Métadonnées TikTok introuvables dans la page.');
  }

  const bitratePlayUrls: string[] = Array.isArray(item.video?.bitrateInfo)
    ? item.video.bitrateInfo.flatMap((b: any) =>
        Array.isArray(b?.PlayAddr?.UrlList) ? b.PlayAddr.UrlList : []
      )
    : [];

  const candidateMediaUrls = Array.from(
    new Set(
      [
        item.music?.playUrl,
        item.video?.playAddr,
        item.video?.downloadAddr,
        ...bitratePlayUrls,
      ].filter((u): u is string => typeof u === 'string' && isSafePublicHttpsMediaUrl(u))
    )
  );

  if (candidateMediaUrls.length === 0) {
    throw new Error('Aucun flux audio lisible trouvé dans cette vidéo TikTok.');
  }

  const videoId =
    typeof item.id === 'string' && item.id.trim()
      ? item.id.trim()
      : crypto.createHash('sha1').update(canonicalUrl).digest('hex').slice(0, 16);

  const rawVideoTitle = typeof item.desc === 'string' ? item.desc.trim() : '';
  const musicTitle = typeof item.music?.title === 'string' ? item.music.title.trim() : '';
  const authorNick =
    (typeof item.author?.nickname === 'string' && item.author.nickname.trim()) ||
    (typeof item.author?.uniqueId === 'string' && item.author.uniqueId.trim()) ||
    'TikTok';
  const authorHandle =
    typeof item.author?.uniqueId === 'string' && item.author.uniqueId.trim()
      ? `@${item.author.uniqueId.trim()}`
      : authorNick;
  const musicAuthor =
    typeof item.music?.authorName === 'string' && item.music.authorName.trim()
      ? item.music.authorName.trim()
      : authorNick;

  const cleanTitle =
    (musicTitle && !/^son original|^original sound/i.test(musicTitle) ? musicTitle : '') ||
    rawVideoTitle ||
    musicTitle ||
    `TikTok Song (${authorHandle})`;

  const rawDuration = Number(item.music?.duration) || Number(item.video?.duration) || 30;
  const duration = Math.max(1, Math.round(rawDuration));
  const rawCover = [
    item.music?.coverLarge,
    item.music?.coverMedium,
    item.video?.cover,
    item.video?.originCover,
    item.author?.avatarLarger,
  ].find((u): u is string => typeof u === 'string' && isSafePublicHttpsMediaUrl(u));

  return {
    id: `tiktok-${videoId}`,
    title: cleanTitle.slice(0, 140),
    videoTitle: rawVideoTitle.slice(0, 200),
    artist: musicAuthor.slice(0, 80),
    authorHandle,
    duration,
    durationFormatted: formatDurationSeconds(duration),
    thumbnail: rawCover || '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png',
    sourceUrl: finalUrl || canonicalUrl,
    mediaUrls: candidateMediaUrls,
    cookies: cookies || undefined,
    expiresAt: Date.now() + 8 * 60 * 1000,
  };
}

async function resolveTikTokFromTikwm(canonicalUrl: string): Promise<TikTokResolvedMedia> {
  // Strictly allowlisted resolver endpoint (prevents SSRF)
  const resolverEndpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(canonicalUrl)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  let response: Response;
  try {
    response = await fetch(resolverEndpoint, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': TIKTOK_BROWSER_UA,
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Impossible de joindre le service TikTok (HTTP ${response.status}).`);
  }

  const payload: any = await response.json();
  if (!payload || payload.code !== 0 || !payload.data) {
    throw new Error(
      typeof payload?.msg === 'string' && payload.msg.trim()
        ? payload.msg.trim()
        : 'Vidéo TikTok introuvable, privée ou supprimée.'
    );
  }

  const d = payload.data;
  const candidateMediaUrls = Array.from(
    new Set(
      [d.music, d.music_info?.play, d.play, d.wmplay].filter(
        (u): u is string => typeof u === 'string' && isSafePublicHttpsMediaUrl(u)
      )
    )
  );

  if (candidateMediaUrls.length === 0) {
    throw new Error('Aucun flux audio lisible trouvé pour cette vidéo TikTok.');
  }

  const videoId =
    typeof d.id === 'string' && d.id.trim()
      ? d.id.trim()
      : crypto.createHash('sha1').update(canonicalUrl).digest('hex').slice(0, 16);

  const rawVideoTitle = typeof d.title === 'string' ? d.title.trim() : '';
  const musicTitle = typeof d.music_info?.title === 'string' ? d.music_info.title.trim() : '';
  const authorNick =
    (typeof d.author?.nickname === 'string' && d.author.nickname.trim()) ||
    (typeof d.author?.unique_id === 'string' && d.author.unique_id.trim()) ||
    'TikTok';
  const authorHandle =
    typeof d.author?.unique_id === 'string' && d.author.unique_id.trim()
      ? `@${d.author.unique_id.trim()}`
      : authorNick;
  const musicAuthor =
    typeof d.music_info?.author === 'string' && d.music_info.author.trim()
      ? d.music_info.author.trim()
      : authorNick;

  const cleanTitle =
    (musicTitle && !/^son original|^original sound/i.test(musicTitle) ? musicTitle : '') ||
    rawVideoTitle ||
    musicTitle ||
    `TikTok Song (${authorHandle})`;

  const rawDuration = Number(d.duration) || Number(d.music_info?.duration) || 30;
  const duration = Math.max(1, Math.round(rawDuration));
  const rawCover = [d.music_info?.cover, d.cover, d.origin_cover, d.author?.avatar].find(
    (u): u is string => typeof u === 'string' && isSafePublicHttpsMediaUrl(u)
  );

  return {
    id: `tiktok-${videoId}`,
    title: cleanTitle.slice(0, 140),
    videoTitle: rawVideoTitle.slice(0, 200),
    artist: musicAuthor.slice(0, 80),
    authorHandle,
    duration,
    durationFormatted: formatDurationSeconds(duration),
    thumbnail: rawCover || '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png',
    sourceUrl: canonicalUrl,
    mediaUrls: candidateMediaUrls,
    expiresAt: Date.now() + 8 * 60 * 1000,
  };
}

async function resolveTikTokAudio(
  tiktokUrl: URL,
  forceRefresh = false
): Promise<TikTokResolvedMedia> {
  const canonicalUrl = tiktokUrl.toString();
  if (!forceRefresh) {
    const cached = tiktokMediaCache.get(canonicalUrl);
    if (cached && cached.expiresAt > Date.now() && cached.mediaUrls.length > 0) {
      return cached;
    }
  } else {
    tiktokMediaCache.delete(canonicalUrl);
  }

  let resolved: TikTokResolvedMedia;
  try {
    resolved = await resolveTikTokFromWeb(tiktokUrl, canonicalUrl);
  } catch (webErr) {
    try {
      resolved = await resolveTikTokFromTikwm(canonicalUrl);
    } catch (tikwmErr: any) {
      throw webErr instanceof Error ? webErr : tikwmErr;
    }
  }

  if (tiktokMediaCache.size >= 150) {
    const oldest = tiktokMediaCache.keys().next().value;
    if (oldest) tiktokMediaCache.delete(oldest);
  }
  tiktokMediaCache.set(canonicalUrl, resolved);
  if (resolved.sourceUrl && resolved.sourceUrl !== canonicalUrl) {
    tiktokMediaCache.set(resolved.sourceUrl, resolved);
  }
  return resolved;
}

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_SPEECH_MODEL = 'whisper-large-v3-turbo';
const MAX_GROQ_BYTES = 25 * 1024 * 1024;
const ALLOWED_AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'm4a',
  'ogg',
  'oga',
  'flac',
  'webm',
  'mp4',
  'mpeg',
  'mpga',
  'aac',
  'opus',
]);

function sanitizeAudioFilename(rawName: unknown): string {
  const base = typeof rawName === 'string' ? path.basename(rawName).trim() : '';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = cleaned.split('.').pop()?.toLowerCase() || '';
  if (cleaned && ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
    return cleaned.slice(0, 120);
  }
  return 'audio.mp3';
}

function resolveAllowedMimeType(rawMime: unknown, fileName: string): string | null {
  const mime = typeof rawMime === 'string' ? rawMime.split(';')[0].trim().toLowerCase() : '';
  if (mime.startsWith('audio/') || mime === 'video/mp4' || mime === 'video/webm') {
    return mime;
  }
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
    if (ext === 'wav') return 'audio/wav';
    if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4';
    if (ext === 'ogg' || ext === 'oga' || ext === 'opus') return 'audio/ogg';
    if (ext === 'flac') return 'audio/flac';
    if (ext === 'webm') return 'audio/webm';
    return 'audio/mpeg';
  }
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/youtube/search', async (req, res) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!rawQ || rawQ.length > 200) {
      res.status(400).json({ tracks: [] });
      return;
    }

    const cacheKey = rawQ.toLowerCase();
    const cached = ytSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ tracks: cached.tracks });
      return;
    }

    // Strict allowlisted YouTube results URL (prevents SSRF)
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(rawQ)}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(502).json({ tracks: [] });
        return;
      }

      const html = await response.text();
      const ytData = extractYtInitialData(html);
      const renderers = ytData ? collectVideoRenderers(ytData) : [];

      const tracks = renderers
        .map((v: any) => {
          const id = typeof v.videoId === 'string' ? v.videoId : '';
          if (!id) return null;
          const titleRuns = v.title?.runs;
          const title =
            (Array.isArray(titleRuns) ? titleRuns.map((r: any) => r.text || '').join('') : v.title?.simpleText) ||
            '';
          const ownerRuns = v.ownerText?.runs || v.longBylineText?.runs;
          const artist =
            (Array.isArray(ownerRuns) ? ownerRuns[0]?.text : '') || 'YouTube';
          const lengthText = v.lengthText?.simpleText || '';
          const duration = lengthText ? parseDurationTextToSec(lengthText) : 210;
          const thumbArr = v.thumbnail?.thumbnails;
          const thumbnail =
            (Array.isArray(thumbArr) && thumbArr.length > 0 && thumbArr[thumbArr.length - 1]?.url) ||
            `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

          if (!title) return null;
          return {
            id,
            title: title.trim(),
            artist: artist.trim(),
            duration,
            durationFormatted: lengthText || '3:30',
            thumbnail,
            views: 'YouTube',
          };
        })
        .filter(Boolean);

      if (tracks.length > 0) {
        if (ytSearchCache.size > 150) {
          const firstKey = ytSearchCache.keys().next().value;
          if (firstKey) ytSearchCache.delete(firstKey);
        }
        ytSearchCache.set(cacheKey, { tracks, expiresAt: Date.now() + 10 * 60 * 1000 });
      }

      res.json({ tracks });
    } catch {
      res.status(502).json({ tracks: [] });
    }
  });

  app.get('/api/spotify/playlist', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const resource = parseSpotifyResource(rawUrl);

    if (!resource) {
      res.status(400).json({
        error:
          'Lien Spotify invalide. Collez un lien de playlist ou album Spotify (ex: https://open.spotify.com/playlist/...).',
      });
      return;
    }

    // Strict allowlisted embed URL constructed from validated resource kind + alphanumeric ID
    const embedUrl = `https://open.spotify.com/embed/${resource.kind}/${resource.id}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(embedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(404).json({
          error:
            "Impossible d'accéder à cette playlist Spotify. Vérifiez qu'elle est bien publique.",
        });
        return;
      }

      const html = await response.text();
      const nextData = extractNextDataJson(html);
      const entity = nextData?.props?.pageProps?.state?.data?.entity;

      if (!entity || !Array.isArray(entity.trackList) || entity.trackList.length === 0) {
        res.status(422).json({
          error:
            'Cette playlist semble privée ou vide. Passez-la en mode public sur Spotify, ou utilisez l’import par texte.',
        });
        return;
      }

      const title =
        typeof entity.name === 'string' && entity.name.trim()
          ? entity.name.trim()
          : typeof entity.title === 'string' && entity.title.trim()
          ? entity.title.trim()
          : 'Playlist Spotify';

      const coverSources = entity.coverArt?.sources;
      const coverImage =
        Array.isArray(coverSources) && coverSources.length > 0 && typeof coverSources[0]?.url === 'string'
          ? coverSources[0].url
          : undefined;

      const tracks: SpotifyTrackItem[] = [];
      for (const item of entity.trackList) {
        const trackTitle = typeof item?.title === 'string' ? item.title.trim() : '';
        const artistRaw = typeof item?.subtitle === 'string' ? item.subtitle.trim() : '';
        const durationMs = typeof item?.duration === 'number' ? item.duration : 200000;
        if (trackTitle) {
          tracks.push({
            title: trackTitle,
            artist: artistRaw || 'Artiste Spotify',
            durationSec: Math.max(30, Math.round(durationMs / 1000)),
          });
        }
      }

      res.json({
        id: resource.id,
        kind: resource.kind,
        title,
        coverImage,
        tracks,
        totalCount: tracks.length,
      });
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      res.status(isAbort ? 504 : 502).json({
        error: isAbort
          ? 'Délai dépassé lors de la connexion à Spotify. Réessayez ou utilisez l’import texte.'
          : 'Erreur lors de la récupération de la playlist Spotify.',
      });
    }
  });

  // TikTok Song: Resolve TikTok video link to playable audio metadata (SSRF-safe allowlist)
  app.get('/api/tiktok/resolve', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const parsedUrl = parseTikTokUrl(rawUrl);

    if (!parsedUrl) {
      res.status(400).json({
        error:
          'Lien TikTok invalide. Collez un lien TikTok valide (ex: https://www.tiktok.com/@.../video/... ou https://vm.tiktok.com/...).',
      });
      return;
    }

    try {
      const resolved = await resolveTikTokAudio(parsedUrl, forceRefresh);
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        id: resolved.id,
        title: resolved.title,
        videoTitle: resolved.videoTitle,
        artist: resolved.artist,
        authorHandle: resolved.authorHandle,
        duration: resolved.duration,
        durationFormatted: resolved.durationFormatted,
        thumbnail: resolved.thumbnail,
        sourceUrl: resolved.sourceUrl,
        audioUrl: `/api/tiktok/stream?url=${encodeURIComponent(resolved.sourceUrl)}`,
      });
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      res.status(isAbort ? 504 : 422).json({
        error: isAbort
          ? 'Délai dépassé lors de la récupération de la vidéo TikTok.'
          : err?.message || 'Impossible de récupérer le son de cette vidéo TikTok.',
      });
    }
  });

  // TikTok Song: Stream resolved audio cleanly with Range support, candidate fallback & SSRF checks
  app.get('/api/tiktok/stream', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const parsedUrl = parseTikTokUrl(rawUrl);

    if (!parsedUrl) {
      res.status(400).json({ error: 'Lien TikTok invalide.' });
      return;
    }

    const fetchCandidateStream = async (
      mediaUrl: string,
      cookies: string | undefined,
      rangeHeader: string
    ): Promise<Response | null> => {
      if (!isSafePublicHttpsMediaUrl(mediaUrl)) return null;
      const headers: Record<string, string> = {
        'User-Agent': TIKTOK_BROWSER_UA,
        Referer: 'https://www.tiktok.com/',
        ...(cookies ? { Cookie: cookies } : {}),
      };
      if (/^bytes=\d+-\d*$/.test(rangeHeader)) {
        headers.Range = rangeHeader;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      try {
        const response = await fetch(mediaUrl, {
          headers,
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.url && !isSafePublicHttpsMediaUrl(response.url)) {
          await response.body?.cancel().catch(() => {});
          return null;
        }
        const ct = (response.headers.get('content-type') || '').toLowerCase();
        if (
          (response.ok || response.status === 206) &&
          !ct.includes('text/html') &&
          !ct.includes('application/json')
        ) {
          return response;
        }
        await response.body?.cancel().catch(() => {});
        return null;
      } catch {
        clearTimeout(timeout);
        return null;
      }
    };

    try {
      const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range.trim() : '';
      let resolved = await resolveTikTokAudio(parsedUrl, forceRefresh);

      let upstream: Response | null = null;
      for (const candidate of resolved.mediaUrls) {
        upstream = await fetchCandidateStream(candidate, resolved.cookies, rangeHeader);
        if (upstream) break;
      }

      // If all cached candidates failed (expired CDN signature/cookies), force a fresh re-resolve once
      if (!upstream && !forceRefresh) {
        resolved = await resolveTikTokAudio(parsedUrl, true);
        for (const candidate of resolved.mediaUrls) {
          upstream = await fetchCandidateStream(candidate, resolved.cookies, rangeHeader);
          if (upstream) break;
        }
      }

      if (!upstream) {
        res.status(502).json({ error: 'Flux audio TikTok temporairement indisponible.' });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
      const contentLength = upstream.headers.get('content-length');
      const contentRange = upstream.headers.get('content-range');
      const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', acceptRanges);
      res.setHeader('Cache-Control', 'no-store');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);

      if (!upstream.body) {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as any);
      req.on('close', () => {
        nodeStream.destroy();
      });
      nodeStream.on('error', () => {
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      });
      nodeStream.pipe(res);
    } catch {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Erreur lors de la lecture du flux audio TikTok.' });
      }
    }
  });

  // MULTI-LYRICS AI: Secure backend audio transcription via Groq Speech-to-Text
  // GROQ_API_KEY stays strictly on the server (never exposed to browser requests).
  app.post(
    '/api/lyrics/transcribe',
    express.raw({
      type: ['audio/*', 'video/mp4', 'video/webm', 'application/octet-stream'],
      limit: '25mb',
    }),
    async (req, res) => {
      const authorizedHeader = String(req.headers['x-authorized'] || '').toLowerCase();
      if (authorizedHeader !== 'true') {
        res.status(403).json({
          errorType: 'audio_inaccessible',
          error:
            "Autorisation requise : seuls les fichiers audio dont l'utilisation et la transcription sont autorisées peuvent être traités.",
        });
        return;
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({
          errorType: 'audio_inaccessible',
          error: 'Fichier audio inaccessible ou vide.',
        });
        return;
      }

      if (req.body.length > MAX_GROQ_BYTES) {
        res.status(413).json({
          errorType: 'audio_inaccessible',
          error: 'Fichier audio trop volumineux (max 25 Mo par segment).',
        });
        return;
      }

      let decodedName = '';
      try {
        decodedName = req.headers['x-file-name']
          ? decodeURIComponent(String(req.headers['x-file-name']))
          : '';
      } catch {
        decodedName = String(req.headers['x-file-name'] || '');
      }

      const safeFileName = sanitizeAudioFilename(decodedName);
      const mimeType = resolveAllowedMimeType(req.headers['x-file-mime'], safeFileName);
      if (!mimeType) {
        res.status(415).json({
          errorType: 'audio_inaccessible',
          error: 'Format audio non supporté pour la transcription.',
        });
        return;
      }

      const audioSha256 = crypto.createHash('sha256').update(req.body).digest('hex');

      // Server-side deduplication cache: never transcribe the exact same audio buffer twice
      const cachedEntry = groqTranscriptionCache.get(audioSha256);
      if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
        res.json({
          ...cachedEntry.result,
          fileHash: audioSha256,
          cached: true,
        });
        return;
      }

      const groqApiKey = (process.env.GROQ_API_KEY || '').trim();
      if (!groqApiKey) {
        res.status(503).json({
          errorType: 'groq_error',
          error:
            'Clé API Groq (GROQ_API_KEY) non configurée sur le serveur. Ajoutez GROQ_API_KEY dans les secrets de votre environnement.',
        });
        return;
      }

      try {
        const formData = new FormData();
        const audioBlob = new Blob([new Uint8Array(req.body)], { type: mimeType });
        formData.append('file', audioBlob, safeFileName);
        formData.append('model', GROQ_SPEECH_MODEL);
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities[]', 'segment');
        formData.append('temperature', '0');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        let groqRes: Response;
        try {
          groqRes = await fetch(GROQ_TRANSCRIBE_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
            },
            body: formData,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (groqRes.status === 429) {
          res.status(429).json({
            errorType: 'rate_limit',
            error: 'Limite de requêtes Groq atteinte (429). Réessayez dans quelques instants.',
          });
          return;
        }

        if (groqRes.status === 401 || groqRes.status === 403) {
          res.status(502).json({
            errorType: 'groq_error',
            error: 'Authentification Groq refusée. Vérifiez la variable secrète GROQ_API_KEY.',
          });
          return;
        }

        if (groqRes.status === 413) {
          res.status(413).json({
            errorType: 'audio_inaccessible',
            error: 'Segment audio refusé car trop volumineux pour Groq (max 25 Mo).',
          });
          return;
        }

        if (groqRes.status === 400 || groqRes.status === 422) {
          res.status(422).json({
            errorType: 'audio_inaccessible',
            error: 'Fichier audio illisible ou corrompu lors de l’envoi à Groq.',
          });
          return;
        }

        if (!groqRes.ok) {
          res.status(502).json({
            errorType: 'groq_error',
            error: `Erreur du service Groq (HTTP ${groqRes.status}).`,
          });
          return;
        }

        let payload: any;
        try {
          payload = await groqRes.json();
        } catch {
          res.status(502).json({
            errorType: 'invalid_response',
            error: 'Réponse JSON invalide reçue depuis Groq.',
          });
          return;
        }

        const rawSegments = Array.isArray(payload?.segments) ? payload.segments : [];
        let logProbSum = 0;
        let logProbCount = 0;
        let noSpeechSum = 0;
        let noSpeechCount = 0;

        const WHISPER_BOILERPLATE_RE =
          /^(sous-titrage|subtitles by|amara\.org|merci d'avoir regard[eé]|thank you for watching|thanks for watching|\.{2,}|\u266a+)$/i;

        const segments: GroqSegment[] = [];
        for (const seg of rawSegments) {
          const text = typeof seg?.text === 'string' ? seg.text.trim() : '';
          const start = typeof seg?.start === 'number' && Number.isFinite(seg.start) ? Math.max(0, seg.start) : 0;
          const end = typeof seg?.end === 'number' && Number.isFinite(seg.end) ? Math.max(start, seg.end) : start;
          const noSpeechProb = typeof seg?.no_speech_prob === 'number' ? seg.no_speech_prob : 0;
          const avgLogProb = typeof seg?.avg_logprob === 'number' ? seg.avg_logprob : 0;

          if (!text || noSpeechProb > 0.72) continue;
          if (WHISPER_BOILERPLATE_RE.test(text) && (noSpeechProb > 0.3 || avgLogProb < -0.6)) {
            continue;
          }

          if (typeof seg?.avg_logprob === 'number') {
            logProbSum += avgLogProb;
            logProbCount++;
          }
          if (typeof seg?.no_speech_prob === 'number') {
            noSpeechSum += noSpeechProb;
            noSpeechCount++;
          }

          segments.push({ start, end, text });
        }

        const fullText =
          segments.length > 0
            ? segments.map((s) => s.text).join('\n')
            : typeof payload?.text === 'string'
            ? payload.text.trim()
            : '';

        if (!fullText) {
          res.status(422).json({
            errorType: 'transcription_incomplete',
            error:
              'Aucune parole intelligible détectée dans ce fichier audio (ou fichier purement instrumental).',
          });
          return;
        }

        const meanLogProb = logProbCount > 0 ? logProbSum / logProbCount : -0.4;
        const meanNoSpeech = noSpeechCount > 0 ? noSpeechSum / noSpeechCount : 0.1;
        const uncertain = meanLogProb < -0.75 || meanNoSpeech > 0.45;
        const incomplete = segments.length === 0 && fullText.length > 0;

        const result: GroqCachedResult = {
          text: fullText,
          segments,
          language: typeof payload?.language === 'string' ? payload.language : undefined,
          duration: typeof payload?.duration === 'number' ? payload.duration : undefined,
          uncertain,
          incomplete,
        };

        if (groqTranscriptionCache.size >= 100) {
          const oldestKey = groqTranscriptionCache.keys().next().value;
          if (oldestKey) groqTranscriptionCache.delete(oldestKey);
        }
        groqTranscriptionCache.set(audioSha256, {
          result,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });

        res.json({
          ...result,
          fileHash: audioSha256,
          cached: false,
        });
      } catch (err: any) {
        const isAbort = err?.name === 'AbortError';
        res.status(isAbort ? 504 : 502).json({
          errorType: 'network',
          error: isAbort
            ? 'Délai dépassé lors de la transcription Groq.'
            : 'Erreur réseau lors de la communication avec Groq.',
        });
      }
    }
  );

  // Return clean JSON error if Express raw body parser rejects an oversized audio segment
  app.use((err: any, _req: any, res: any, next: any) => {
    if (err?.type === 'entity.too.large') {
      res.status(413).json({
        errorType: 'audio_inaccessible',
        error: 'Fichier audio trop volumineux (max 25 Mo par segment).',
      });
      return;
    }
    next(err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HMD Music server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
