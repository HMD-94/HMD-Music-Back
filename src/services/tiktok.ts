import { Track } from '../types/music';
import { StorageService } from './storage';

const TIKTOK_HISTORY_KEY = 'hmd_tiktok_songs_v1';
const TIKTOK_FALLBACK_COVER = '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png';

export interface ResolvedTikTokSong {
  track: Track;
  videoTitle: string;
  authorHandle: string;
}

export function extractTikTokUrl(rawInput: string): string | null {
  const match = rawInput.match(/https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/[^\s<>"']+/i);
  if (match) return match[0];
  return null;
}

export function isTikTokUrl(rawInput: string): boolean {
  return Boolean(extractTikTokUrl(rawInput));
}

export function isTikTokTrack(track: Track | null | undefined): boolean {
  return Boolean(track && (track.sourceType === 'tiktok' || track.id.startsWith('tiktok-')));
}

export function buildTikTokStreamUrl(
  track: Track | null | undefined,
  options?: { refresh?: boolean; cacheBust?: boolean }
): string {
  if (!track) return '';
  let base = '';
  if (track.sourceUrl && isTikTokUrl(track.sourceUrl)) {
    base = `/api/tiktok/stream?url=${encodeURIComponent(track.sourceUrl)}`;
  } else if (track.audioUrl) {
    base = track.audioUrl;
  }

  if (!base) return '';

  const params: string[] = [];
  if (options?.refresh) params.push('refresh=1');
  if (options?.cacheBust) params.push(`_t=${Date.now()}`);
  if (params.length === 0) return base;

  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${params.join('&')}`;
}

export const TikTokService = {
  async resolveLink(rawInput: string, forceRefresh = false): Promise<ResolvedTikTokSong> {
    const cleanUrl = extractTikTokUrl(rawInput.trim());
    if (!cleanUrl) {
      throw new Error(
        'Lien TikTok invalide. Collez un lien TikTok (ex: https://www.tiktok.com/@.../video/... ou https://vm.tiktok.com/...).'
      );
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 14000);

    let res: Response;
    try {
      const endpoint = `/api/tiktok/resolve?url=${encodeURIComponent(cleanUrl)}${
        forceRefresh ? '&refresh=1' : ''
      }`;
      res = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('Délai dépassé lors de la récupération du son TikTok.');
      }
      throw new Error('Erreur réseau lors de la récupération du son TikTok.');
    } finally {
      window.clearTimeout(timeout);
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      throw new Error('Réponse invalide du serveur TikTok.');
    }

    if (!res.ok || !data?.id || !data?.audioUrl) {
      throw new Error(data?.error || 'Impossible de récupérer le son de cette vidéo TikTok.');
    }

    const track: Track = {
      id: data.id,
      title: data.title || 'TikTok Song',
      artist: data.artist || data.authorHandle || 'TikTok',
      duration: Number(data.duration) || 30,
      durationFormatted: data.durationFormatted || '0:30',
      thumbnail: data.thumbnail || TIKTOK_FALLBACK_COVER,
      album: 'TikTok Song',
      category: 'TikTok',
      views: 'TikTok',
      sourceType: 'tiktok',
      audioUrl: data.audioUrl,
      sourceUrl: data.sourceUrl || cleanUrl,
    };

    return {
      track,
      videoTitle: data.videoTitle || '',
      authorHandle: data.authorHandle || '',
    };
  },

  getRecentSongs(): Track[] {
    try {
      const raw = localStorage.getItem(TIKTOK_HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((t: Track) => ({ ...t, sourceType: 'tiktok' as const }))
        : [];
    } catch {
      return [];
    }
  },

  setRecentSongs(tracks: Track[]): Track[] {
    const normalized = tracks
      .filter((t) => t && t.id)
      .map((t) => ({ ...t, sourceType: 'tiktok' as const }))
      .slice(0, 25);
    try {
      localStorage.setItem(TIKTOK_HISTORY_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore quota errors
    }
    StorageService.saveTracksToCache(normalized);
    return normalized;
  },

  saveRecentSong(track: Track): Track[] {
    const normalized: Track = { ...track, sourceType: 'tiktok' };
    const current = this.getRecentSongs();
    const updated = [normalized, ...current.filter((t) => t.id !== normalized.id)].slice(0, 25);
    try {
      localStorage.setItem(TIKTOK_HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors
    }
    StorageService.saveTracksToCache([normalized]);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hmd-tiktok-songs-updated'));
    }
    return updated;
  },

  removeRecentSong(trackId: string): Track[] {
    const updated = this.getRecentSongs().filter((t) => t.id !== trackId);
    try {
      localStorage.setItem(TIKTOK_HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hmd-tiktok-songs-updated'));
    }
    return updated;
  },
};
