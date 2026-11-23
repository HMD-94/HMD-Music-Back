import { Track } from '../types/music';
import { DEFAULT_YOUTUBE_API_KEY } from './storage';

// Helper to format seconds into mm:ss
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Parse ISO 8601 duration (e.g., PT3M45S)
export function parseISODuration(duration: string): number {
  if (!duration) return 180;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 180;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Extract YouTube Video ID from standard URLs or direct IDs
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const patterns = [
    /(?:https?:\/\/)?(?:www\.|music\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Curated verified high-quality tracks with official YouTube IDs (Classés : Les morceaux de Rap FR les plus écoutés de l'histoire sur YouTube)
export const CURATED_TRACKS: Track[] = [
  {
    id: 'sS_j3-B3fS0',
    title: 'Sapés comme jamais',
    artist: 'GIMS ft. Niska',
    duration: 212,
    durationFormatted: '3:32',
    thumbnail: 'https://img.youtube.com/vi/sS_j3-B3fS0/hqdefault.jpg',
    album: 'Mon cœur avait raison',
    category: 'Rap FR',
    views: '680M vues',
  },
  {
    id: 'ZTb_gqT-e9g',
    title: 'Chocolat',
    artist: 'Lartiste ft. Awa Imani',
    duration: 236,
    durationFormatted: '3:56',
    thumbnail: 'https://img.youtube.com/vi/ZTb_gqT-e9g/hqdefault.jpg',
    album: 'Clandestino',
    category: 'Rap FR',
    views: '560M vues',
  },
  {
    id: 'UyD57Ram7gE',
    title: 'Ramenez la coupe à la maison',
    artist: 'Vegedream',
    duration: 198,
    durationFormatted: '3:18',
    thumbnail: 'https://img.youtube.com/vi/UyD57Ram7gE/hqdefault.jpg',
    album: 'Marchand de sable',
    category: 'Rap FR',
    views: '550M vues',
  },
  {
    id: 'kYtJ0sgEGY4',
    title: 'Bella',
    artist: 'GIMS',
    duration: 228,
    durationFormatted: '3:48',
    thumbnail: 'https://img.youtube.com/vi/kYtJ0sgEGY4/hqdefault.jpg',
    album: 'Subliminal',
    category: 'Rap FR',
    views: '530M vues',
  },
  {
    id: 'kL8mwLzB8v8',
    title: 'Bande Organisée',
    artist: '13 Organisé (Jul, SCH, Naps, Kofs, Soso Maness...)',
    duration: 367,
    durationFormatted: '6:07',
    thumbnail: 'https://img.youtube.com/vi/kL8mwLzB8v8/hqdefault.jpg',
    album: '13 Organisé',
    category: 'Rap FR',
    views: '500M vues',
  },
  {
    id: 'F_rEHfLgdcY',
    title: "J'me tire",
    artist: 'GIMS',
    duration: 251,
    durationFormatted: '4:11',
    thumbnail: 'https://img.youtube.com/vi/F_rEHfLgdcY/hqdefault.jpg',
    album: 'Subliminal',
    category: 'Rap FR',
    views: '380M vues',
  },
  {
    id: 'MhY4_eB8QeY',
    title: 'Réseaux',
    artist: 'Niska',
    duration: 197,
    durationFormatted: '3:17',
    thumbnail: 'https://img.youtube.com/vi/MhY4_eB8QeY/hqdefault.jpg',
    album: 'Commando',
    category: 'Rap FR',
    views: '360M vues',
  },
  {
    id: 'Kz4D_zF0NqM',
    title: 'Le Coach',
    artist: 'Soprano ft. Vincenzo',
    duration: 201,
    durationFormatted: '3:21',
    thumbnail: 'https://img.youtube.com/vi/Kz4D_zF0NqM/hqdefault.jpg',
    album: 'PHOENIX',
    category: 'Rap FR',
    views: '360M vues',
  },
  {
    id: 'kYtJg0D_1pQ',
    title: 'Moulaga',
    artist: "Heuss L'enfoiré ft. JuL",
    duration: 178,
    durationFormatted: '2:58',
    thumbnail: 'https://img.youtube.com/vi/kYtJg0D_1pQ/hqdefault.jpg',
    album: 'En Esprit',
    category: 'Rap FR',
    views: '340M vues',
  },
  {
    id: 'UPnMFUsKm8w',
    title: 'Mwaka Moon',
    artist: 'Kalash ft. Damso',
    duration: 242,
    durationFormatted: '4:02',
    thumbnail: 'https://img.youtube.com/vi/UPnMFUsKm8w/hqdefault.jpg',
    album: 'Mwaka Moon',
    category: 'Rap FR',
    views: '340M vues',
  },
  {
    id: 'qmtWgkxMlRw',
    title: 'Tchikita',
    artist: 'Jul',
    duration: 202,
    durationFormatted: '3:22',
    thumbnail: 'https://img.youtube.com/vi/qmtWgkxMlRw/hqdefault.jpg',
    album: 'Émotion',
    category: 'Rap FR',
    views: '305M vues',
  },
  {
    id: 'smY18_bE9d8',
    title: 'Au DD',
    artist: 'PNL',
    duration: 244,
    durationFormatted: '4:04',
    thumbnail: 'https://img.youtube.com/vi/smY18_bE9d8/hqdefault.jpg',
    album: 'Deux Frères',
    category: 'Rap FR',
    views: '230M vues',
  },
  {
    id: 'sO7PzD0zS08',
    title: 'DA',
    artist: 'PNL',
    duration: 232,
    durationFormatted: '3:52',
    thumbnail: 'https://img.youtube.com/vi/sO7PzD0zS08/hqdefault.jpg',
    album: 'Dans la légende',
    category: 'Rap FR',
    views: '215M vues',
  },
  {
    id: '3r9vJI5OiV8',
    title: 'La Kiffance',
    artist: 'Naps',
    duration: 180,
    durationFormatted: '3:00',
    thumbnail: 'https://img.youtube.com/vi/3r9vJI5OiV8/hqdefault.jpg',
    album: 'Les mains faites pour l’or',
    category: 'Rap FR',
    views: '190M vues',
  },
  {
    id: 'sK3_S0k7b24',
    title: 'Onizuka',
    artist: 'PNL',
    duration: 252,
    durationFormatted: '4:12',
    thumbnail: 'https://img.youtube.com/vi/sK3_S0k7b24/hqdefault.jpg',
    album: 'Dans la légende',
    category: 'Rap FR',
    views: '190M vues',
  },
  {
    id: '2rCVeNtZ--s',
    title: 'Mamacita',
    artist: 'Ninho',
    duration: 217,
    durationFormatted: '3:37',
    thumbnail: 'https://img.youtube.com/vi/2rCVeNtZ--s/hqdefault.jpg',
    album: 'Comme prévu',
    category: 'Rap FR',
    views: '180M vues',
  },
  {
    id: 's_ncWv_4wL8',
    title: 'DKR',
    artist: 'Booba',
    duration: 172,
    durationFormatted: '2:52',
    thumbnail: 'https://img.youtube.com/vi/s_ncWv_4wL8/hqdefault.jpg',
    album: 'Trône',
    category: 'Rap FR',
    views: '160M vues',
  },
  {
    id: 'hwtLqJyhS3Q',
    title: '92i Veyron',
    artist: 'Booba',
    duration: 226,
    durationFormatted: '3:46',
    thumbnail: 'https://img.youtube.com/vi/hwtLqJyhS3Q/hqdefault.jpg',
    album: 'Nero Nemesis',
    category: 'Rap FR',
    views: '150M vues',
  },
  {
    id: '2bjk26RwjyU',
    title: 'Basique',
    artist: 'Orelsan',
    duration: 167,
    durationFormatted: '2:47',
    thumbnail: 'https://img.youtube.com/vi/2bjk26RwjyU/hqdefault.jpg',
    album: 'La fête est finie',
    category: 'Rap FR',
    views: '125M vues',
  },
  {
    id: 'W5R3gK-kEcs',
    title: 'Tchoin',
    artist: 'Kaaris',
    duration: 154,
    durationFormatted: '2:34',
    thumbnail: 'https://img.youtube.com/vi/W5R3gK-kEcs/hqdefault.jpg',
    album: 'Okou Gnakouri',
    category: 'Rap FR',
    views: '115M vues',
  },
  {
    id: 'wuCK-oiE3rA',
    title: 'Sunset Lover',
    artist: 'Petit Biscuit',
    duration: 237,
    durationFormatted: '3:57',
    thumbnail: 'https://img.youtube.com/vi/wuCK-oiE3rA/hqdefault.jpg',
    album: 'Presence',
    category: 'Electronic',
    views: '190M vues',
  },
  {
    id: '4xDzrJKXOOY',
    title: 'Synthwave Radio & Chill Beats',
    artist: 'Lofi Girl',
    duration: 210,
    durationFormatted: '3:30',
    thumbnail: 'https://img.youtube.com/vi/4xDzrJKXOOY/hqdefault.jpg',
    album: 'Lofi Records',
    category: 'Lo-Fi',
    views: '120M vues',
  },
  {
    id: 'UDVtMYqUAyw',
    title: 'First Step (Interstellar Theme)',
    artist: 'Hans Zimmer',
    duration: 246,
    durationFormatted: '4:06',
    thumbnail: 'https://img.youtube.com/vi/UDVtMYqUAyw/hqdefault.jpg',
    album: 'Interstellar Soundtrack',
    category: 'Cinematic',
    views: '180M vues',
  },
];

export const MULTI_GENRE_TRACKS: Track[] = [
  ...CURATED_TRACKS,
  {
    id: '4NRXx6U8ABQ',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    duration: 200,
    durationFormatted: '3:20',
    thumbnail: 'https://img.youtube.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
    album: 'After Hours',
    category: 'Pop',
    views: '1.0B vues',
  },
  {
    id: '34Na4j8AVgA',
    title: 'Starboy',
    artist: 'The Weeknd ft. Daft Punk',
    duration: 230,
    durationFormatted: '3:50',
    thumbnail: 'https://img.youtube.com/vi/34Na4j8AVgA/hqdefault.jpg',
    album: 'Starboy',
    category: 'Pop',
    views: '2.5B vues',
  },
  {
    id: '5NV6Rdv1a3I',
    title: 'Get Lucky',
    artist: 'Daft Punk ft. Pharrell Williams',
    duration: 248,
    durationFormatted: '4:08',
    thumbnail: 'https://img.youtube.com/vi/5NV6Rdv1a3I/hqdefault.jpg',
    album: 'Random Access Memories',
    category: 'Electro',
    views: '780M vues',
  },
  {
    id: 'MV_3Dpw-BRY',
    title: 'Nightcall',
    artist: 'Kavinsky',
    duration: 258,
    durationFormatted: '4:18',
    thumbnail: 'https://img.youtube.com/vi/MV_3Dpw-BRY/hqdefault.jpg',
    album: 'OutRun',
    category: 'Electro',
    views: '420M vues',
  },
  {
    id: 'ApXoWvfEYVU',
    title: 'Sunflower',
    artist: 'Post Malone & Swae Lee',
    duration: 158,
    durationFormatted: '2:38',
    thumbnail: 'https://img.youtube.com/vi/ApXoWvfEYVU/hqdefault.jpg',
    album: 'Spider-Man: Into the Spider-Verse',
    category: 'Hip-Hop',
    views: '2.2B vues',
  },
  {
    id: '6ONRf7h3Mdk',
    title: 'SICKO MODE',
    artist: 'Travis Scott',
    duration: 312,
    durationFormatted: '5:12',
    thumbnail: 'https://img.youtube.com/vi/6ONRf7h3Mdk/hqdefault.jpg',
    album: 'ASTROWORLD',
    category: 'Hip-Hop',
    views: '1.2B vues',
  },
  {
    id: 'tvTRZJ-4EyI',
    title: 'HUMBLE.',
    artist: 'Kendrick Lamar',
    duration: 177,
    durationFormatted: '2:57',
    thumbnail: 'https://img.youtube.com/vi/tvTRZJ-4EyI/hqdefault.jpg',
    album: 'DAMN.',
    category: 'Hip-Hop',
    views: '1.0B vues',
  },
  {
    id: 'P3QS83ubhHE',
    title: 'Santé',
    artist: 'Stromae',
    duration: 190,
    durationFormatted: '3:10',
    thumbnail: 'https://img.youtube.com/vi/P3QS83ubhHE/hqdefault.jpg',
    album: 'Multitude',
    category: 'French Pop',
    views: '95M vues',
  },
  {
    id: 'oiKj0Z_Xnjc',
    title: 'Papaoutai',
    artist: 'Stromae',
    duration: 232,
    durationFormatted: '3:52',
    thumbnail: 'https://img.youtube.com/vi/oiKj0Z_Xnjc/hqdefault.jpg',
    album: 'Racine carrée',
    category: 'French Pop',
    views: '1.0B vues',
  },
  {
    id: 'DyDfgMOUjCI',
    title: 'bad guy',
    artist: 'Billie Eilish',
    duration: 205,
    durationFormatted: '3:25',
    thumbnail: 'https://img.youtube.com/vi/DyDfgMOUjCI/hqdefault.jpg',
    album: 'WHEN WE ALL FALL ASLEEP',
    category: 'Pop',
    views: '1.3B vues',
  },
  {
    id: 'TUVcZfQe-Kw',
    title: 'Levitating',
    artist: 'Dua Lipa',
    duration: 203,
    durationFormatted: '3:23',
    thumbnail: 'https://img.youtube.com/vi/TUVcZfQe-Kw/hqdefault.jpg',
    album: 'Future Nostalgia',
    category: 'Pop',
    views: '900M vues',
  },
  {
    id: '60ItHLz5WEA',
    title: 'Faded',
    artist: 'Alan Walker',
    duration: 213,
    durationFormatted: '3:33',
    thumbnail: 'https://img.youtube.com/vi/60ItHLz5WEA/hqdefault.jpg',
    album: 'Different World',
    category: 'Electro',
    views: '3.7B vues',
  },
  {
    id: 'RBumgq5yVrA',
    title: 'Let Her Go',
    artist: 'Passenger',
    duration: 255,
    durationFormatted: '4:15',
    thumbnail: 'https://img.youtube.com/vi/RBumgq5yVrA/hqdefault.jpg',
    album: 'All the Little Lights',
    category: 'Acoustique',
    views: '3.7B vues',
  },
];

const clientSearchCache = new Map<string, { tracks: Track[]; isFromOfficialApi: boolean; ts: number }>();
let defaultKeyQuotaExhausted = false;

export const YouTubeService = {
  // Fast YouTube search: uses backend /api/youtube/search (no quota limits) or custom user API key + memory cache
  async search(query: string, apiKey?: string): Promise<{ tracks: Track[]; isFromOfficialApi: boolean }> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { tracks: CURATED_TRACKS, isFromOfficialApi: false };
    }

    const cacheKey = cleanQuery.toLowerCase();
    const cached = clientSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      return { tracks: cached.tracks, isFromOfficialApi: cached.isFromOfficialApi };
    }

    // Check if user entered a direct YouTube video URL or ID
    const extractedId = extractYouTubeId(cleanQuery);
    if (extractedId) {
      const directTrack = await this.getTrackFromId(extractedId, apiKey);
      if (directTrack) {
        return { tracks: [directTrack], isFromOfficialApi: true };
      }
    }

    const customUserKey = apiKey && apiKey.trim().length > 10 && apiKey.trim() !== DEFAULT_YOUTUBE_API_KEY
      ? apiKey.trim()
      : null;

    // 1. If user configured a custom YouTube Data API v3 key (or default key hasn't hit quota yet), try official API with fast timeout
    const keyToTry = customUserKey || (!defaultKeyQuotaExhausted ? DEFAULT_YOUTUBE_API_KEY : null);
    if (keyToTry) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(
          cleanQuery
        )}&type=video&videoCategoryId=10&key=${keyToTry}`;

        const response = await fetch(searchUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (response.status === 403 || response.status === 429) {
          if (!customUserKey) {
            defaultKeyQuotaExhausted = true;
          }
          throw new Error(`YouTube API quota exceeded (${response.status})`);
        }

        if (!response.ok) {
          throw new Error(`YouTube API returned status ${response.status}`);
        }

        const data = await response.json();
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          const videoIds = data.items.map((item: any) => item.id.videoId).filter(Boolean).join(',');

          let detailsMap: Record<string, { duration: number; formatted: string }> = {};
          if (videoIds) {
            try {
              const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${keyToTry}`;
              const detailsRes = await fetch(detailsUrl);
              if (detailsRes.ok) {
                const detailsData = await detailsRes.json();
                detailsData.items?.forEach((v: any) => {
                  const durSec = parseISODuration(v.contentDetails?.duration || '');
                  detailsMap[v.id] = {
                    duration: durSec,
                    formatted: formatTime(durSec),
                  };
                });
              }
            } catch {
              // Ignore duration lookup failure
            }
          }

          const tracks: Track[] = data.items.map((item: any) => {
            const vidId = item.id.videoId;
            const snippet = item.snippet;
            const durationInfo = detailsMap[vidId] || { duration: 210, formatted: '3:30' };

            let rawTitle = snippet.title || 'Sans titre';
            let artist = snippet.channelTitle || 'Artiste YouTube';

            const txt = document.createElement('textarea');
            txt.innerHTML = rawTitle;
            rawTitle = txt.value;

            if (rawTitle.includes(' - ')) {
              const parts = rawTitle.split(' - ');
              artist = parts[0].trim();
              rawTitle = parts.slice(1).join(' - ').replace(/\(Official (Video|Audio|Music Video)\)/gi, '').trim();
            }

            const thumbnail =
              snippet.thumbnails?.high?.url ||
              snippet.thumbnails?.medium?.url ||
              `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;

            return {
              id: vidId,
              title: rawTitle,
              artist,
              duration: durationInfo.duration,
              durationFormatted: durationInfo.formatted,
              thumbnail,
              views: 'YouTube',
            };
          });

          clientSearchCache.set(cacheKey, { tracks, isFromOfficialApi: true, ts: Date.now() });
          return { tracks, isFromOfficialApi: true };
        }
      } catch {
        // Fall through cleanly to fast backend YouTube search
      }
    }

    // 2. Fast Backend YouTube Search (real YouTube results, zero API quota limit)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(cleanQuery)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.tracks) && data.tracks.length > 0) {
          const tracks = data.tracks as Track[];
          clientSearchCache.set(cacheKey, { tracks, isFromOfficialApi: true, ts: Date.now() });
          return { tracks, isFromOfficialApi: true };
        }
      }
    } catch {
      // Network offline fallback below
    }

    // 3. Offline/Catalog fallback only if network & backend are unreachable
    const qLower = cleanQuery.toLowerCase();
    const matched = CURATED_TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(qLower) ||
        t.artist.toLowerCase().includes(qLower) ||
        (t.album && t.album.toLowerCase().includes(qLower)) ||
        (t.category && t.category.toLowerCase().includes(qLower))
    );

    return {
      tracks: matched.length > 0 ? matched : CURATED_TRACKS,
      isFromOfficialApi: false,
    };
  },

  // Get track info from YouTube ID via YouTube Data API (official) or oEmbed
  async getTrackFromId(videoId: string, apiKey?: string): Promise<Track | null> {
    // Check if in curated first
    const existing = CURATED_TRACKS.find((t) => t.id === videoId);
    if (existing) return existing;

    const effectiveKey = (apiKey && apiKey.trim().length > 10 ? apiKey.trim() : DEFAULT_YOUTUBE_API_KEY);
    if (effectiveKey) {
      try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${effectiveKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            const item = data.items[0];
            const snippet = item.snippet;
            const durSec = parseISODuration(item.contentDetails?.duration || '');
            let rawTitle = snippet.title || 'Vidéo YouTube';
            let artist = snippet.channelTitle || 'YouTube';
            if (rawTitle.includes(' - ')) {
              const parts = rawTitle.split(' - ');
              artist = parts[0].trim();
              rawTitle = parts.slice(1).join(' - ').replace(/\(Official (Video|Audio|Music Video)\)/gi, '').trim();
            }
            return {
              id: videoId,
              title: rawTitle,
              artist,
              duration: durSec,
              durationFormatted: formatTime(durSec),
              thumbnail:
                snippet.thumbnails?.high?.url ||
                snippet.thumbnails?.medium?.url ||
                `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              views: 'YouTube',
            };
          }
        }
      } catch (e) {
        console.warn('YouTube API getTrackFromId error, falling back to oEmbed:', e);
      }
    }

    try {
      const oembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        let rawTitle = data.title || 'Vidéo YouTube';
        let artist = data.author_name || 'YouTube';

        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          artist = parts[0].trim();
          rawTitle = parts.slice(1).join(' - ').replace(/\(Official (Video|Audio|Music Video)\)/gi, '').trim();
        }

        return {
          id: videoId,
          title: rawTitle,
          artist,
          duration: 210,
          durationFormatted: '3:30',
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          views: 'Direct YouTube',
        };
      }
    } catch (e) {
      console.warn('oEmbed fetch error:', e);
    }

    // Minimal fallback
    return {
      id: videoId,
      title: `YouTube Track (${videoId})`,
      artist: 'YouTube Music',
      duration: 180,
      durationFormatted: '3:00',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  },
};
