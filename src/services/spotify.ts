import { SpotifyPlaylistPreview, SpotifyTrackPreview, Track } from '../types/music';
import { StorageService } from './storage';
import { CURATED_TRACKS, formatTime, MULTI_GENRE_TRACKS, YouTubeService } from './youtube';

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(feat\.?[^)]*\)|\[feat\.?[^\]]*\]|\(with [^)]*\)/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'feat', 'ft', 'prod', 'remix', 'version',
  'edit', 'radio', 'audio', 'video', 'official', 'officiel', 'clip',
  'les', 'des', 'une', 'sur', 'dans', 'par', 'pour', 'avec', 'mon', 'ton',
]);

function getMeaningfulTokens(str: string): string[] {
  return normalizeText(str)
    .split(' ')
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

function findLocalCatalogMatch(item: SpotifyTrackPreview, extraPool: Track[]): Track | null {
  const normTitle = normalizeText(item.title);
  const normArtist = normalizeText(item.artist.split(',')[0] || item.artist);
  if (normTitle.length < 2) return null;

  const pool = [...extraPool, ...MULTI_GENRE_TRACKS, ...CURATED_TRACKS];
  for (const candidate of pool) {
    const cTitle = normalizeText(candidate.title);
    const cArtist = normalizeText(candidate.artist);
    if (!cTitle) continue;

    const exactTitle = cTitle === normTitle;
    const closeTitle =
      normTitle.length >= 4 &&
      cTitle.length >= 4 &&
      (cTitle.includes(normTitle) || normTitle.includes(cTitle));

    const artistMatches =
      normArtist.length >= 2 &&
      (cArtist.includes(normArtist) || normArtist.includes(cArtist));

    if ((exactTitle || closeTitle) && (artistMatches || (!normArtist && exactTitle))) {
      return candidate;
    }
  }
  return null;
}

function isPlausibleYouTubeMatch(item: SpotifyTrackPreview, candidate: Track): boolean {
  const titleTokens = getMeaningfulTokens(item.title);
  const artistTokens = getMeaningfulTokens(item.artist.split(',')[0] || item.artist);
  const haystack = normalizeText(`${candidate.title} ${candidate.artist}`);
  if (!haystack) return false;

  if (titleTokens.length === 0) {
    const rawTitle = normalizeText(item.title);
    return rawTitle.length > 0 && haystack.includes(rawTitle);
  }

  const matchedTitleTokens = titleTokens.filter((tok) => haystack.includes(tok));
  const titleMatches =
    titleTokens.length === 1
      ? matchedTitleTokens.length === 1
      : matchedTitleTokens.length >= Math.min(2, titleTokens.length);

  if (!titleMatches) return false;

  if (artistTokens.length === 0) return true;
  const artistMatches = artistTokens.some((tok) => haystack.includes(tok));
  return artistMatches || normalizeText(item.title).length >= 6;
}

async function searchYouTubeViaBackend(query: string): Promise<Track[]> {
  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.tracks) ? (data.tracks as Track[]) : [];
  } catch {
    return [];
  }
}

export const SpotifyService = {
  async fetchPlaylistFromUrl(url: string): Promise<SpotifyPlaylistPreview> {
    const endpoint = `/api/spotify/playlist?url=${encodeURIComponent(url.trim())}`;
    const response = await fetch(endpoint);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Impossible d'importer cette playlist Spotify. Vérifiez que le lien est public."
      );
    }

    return data as SpotifyPlaylistPreview;
  },

  parseManualTrackList(rawText: string): SpotifyTrackPreview[] {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed: SpotifyTrackPreview[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip CSV header rows (Exportify / Tunemymusic)
      if (
        i === 0 &&
        /track\s*name|artist\s*name|album\s*name|uri/i.test(line) &&
        line.includes(',')
      ) {
        continue;
      }

      // Check Exportify CSV format: "Track Name","Album","Artist Name(s)" or Track,Artist
      if (line.includes(',') && !line.includes(' - ')) {
        const cols = line
          .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
          .map((c) => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 2 && cols[0]) {
          const offset = cols[0].startsWith('spotify:') ? 1 : 0;
          const title = cols[offset] || '';
          const artist = cols[offset + 2] || cols[offset + 1] || 'Artiste';
          if (title) {
            parsed.push({ title, artist, durationSec: 210 });
            continue;
          }
        }
      }

      // Clean leading numbering like "1. Artist - Title"
      const cleaned = line.replace(/^\d+[.)]\s*/, '');
      const dashParts = cleaned.split(/\s+[-–—]\s+/);
      if (dashParts.length >= 2) {
        parsed.push({
          artist: dashParts[0].trim(),
          title: dashParts.slice(1).join(' - ').trim(),
          durationSec: 210,
        });
      } else {
        parsed.push({
          title: cleaned,
          artist: '',
          durationSec: 210,
        });
      }
    }

    return parsed.slice(0, 60);
  },

  async resolveTracksToYouTube(
    items: SpotifyTrackPreview[],
    apiKey?: string,
    onProgress?: (done: number, total: number, currentTitle: string) => void
  ): Promise<{ resolved: Track[]; unmatched: SpotifyTrackPreview[] }> {
    const cachedMap = Object.values(StorageService.getTrackCache());
    const resolved: Track[] = [];
    const unmatched: SpotifyTrackPreview[] = [];
    const seenIds = new Set<string>();

    // Limit to 50 tracks per import so waiting time stays responsive
    const queueItems = items.slice(0, 50);

    for (let i = 0; i < queueItems.length; i++) {
      const item = queueItems[i];
      onProgress?.(i + 1, queueItems.length, item.title);

      // 1. Try strict local/cached match first
      const localMatch = findLocalCatalogMatch(item, cachedMap);
      if (localMatch) {
        if (!seenIds.has(localMatch.id)) {
          seenIds.add(localMatch.id);
          resolved.push(localMatch);
        }
        continue;
      }

      // 2. Search YouTube cleanly (NEVER accept curated fallback like "Sapés comme jamais")
      const primaryArtist = item.artist.split(',')[0].trim();
      const searchQuery = primaryArtist
        ? `${item.title} ${primaryArtist} audio`
        : item.title;
      const plainQuery = primaryArtist ? `${item.title} ${primaryArtist}` : item.title;

      let matchedTrack: Track | null = null;

      try {
        const { tracks, isFromOfficialApi } = await YouTubeService.search(searchQuery, apiKey);
        if (isFromOfficialApi && tracks && tracks.length > 0) {
          const valid = tracks.find((t) => isPlausibleYouTubeMatch(item, t));
          if (valid) matchedTrack = valid;
        }
      } catch {
        // Ignore and try backend search backup
      }

      if (!matchedTrack) {
        const backendTracks = await searchYouTubeViaBackend(searchQuery);
        const valid = backendTracks.find((t) => isPlausibleYouTubeMatch(item, t));
        if (valid) {
          matchedTrack = valid;
        } else if (plainQuery !== searchQuery) {
          const plainTracks = await searchYouTubeViaBackend(plainQuery);
          const validPlain = plainTracks.find((t) => isPlausibleYouTubeMatch(item, t));
          if (validPlain) matchedTrack = validPlain;
        }
      }

      if (matchedTrack) {
        if (!seenIds.has(matchedTrack.id)) {
          seenIds.add(matchedTrack.id);
          const enriched: Track = {
            ...matchedTrack,
            title: item.title || matchedTrack.title,
            artist: item.artist || matchedTrack.artist,
            duration: item.durationSec || matchedTrack.duration,
            durationFormatted:
              item.durationSec > 0 ? formatTime(item.durationSec) : matchedTrack.durationFormatted,
          };
          resolved.push(enriched);
        }
      } else {
        unmatched.push(item);
      }
    }

    if (resolved.length > 0) {
      StorageService.saveTracksToCache(resolved);
    }

    return { resolved, unmatched };
  },
};
