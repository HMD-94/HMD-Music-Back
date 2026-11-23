import { TasteProfile, Track } from '../types/music';
import { StorageService } from './storage';
import { MULTI_GENRE_TRACKS, YouTubeService } from './youtube';

const RECO_CACHE_KEY = 'hmd_reco_cache_v1';
const REQUIRED_LISTENS_FOR_PROFILE = 3;

// Infer genre/vibe from a track when category isn't explicitly set (e.g. YouTube search results)
function inferTrackGenre(track: Track): string {
  if (track.category) return track.category;

  const combined = `${track.title} ${track.artist} ${track.album || ''}`.toLowerCase();

  // French Rap signals
  const rapFrArtists = [
    'pnl', 'ninho', 'jul', 'gims', 'niska', 'booba', 'damso', 'orelsan', 'sch', 'naps',
    'kaaris', 'soprano', 'tiakola', 'hamza', 'sdm', 'werenoi', 'freeze', 'ziak', 'leto',
    'koba', 'maes', 'plk', 'nekfeu', 'alpha wann', 'lomepal', 'dinos', 'laylow', 'josman',
    'heuss', '13 organise', '13 organisé', 'vegedream', 'lartiste', 'lacrim', 'alonzo',
    'rohff', 'rim\'k', 'gradur', 'dadju', 'tayc', 'aya nakamura', 'gazo', 'favé', 'kerchak',
  ];
  if (rapFrArtists.some((a) => combined.includes(a)) || /\brap\s*fr\b/i.test(combined)) {
    return 'Rap FR';
  }

  // Hip-Hop US / International
  const hipHopArtists = [
    'travis scott', 'kendrick', 'drake', 'post malone', 'future', 'metro boomin', 'kanye',
    'eminem', '21 savage', 'lil uzi', 'playboi carti', 'j. cole', 'asap', 'central cee',
    'pop smoke', 'xxxtentacion', 'juice wrld', 'tyler', 'sza', 'rap', 'trap', 'hip hop', 'hip-hop',
  ];
  if (hipHopArtists.some((a) => combined.includes(a))) {
    return 'Hip-Hop';
  }

  // Electro / Synthwave / Phonk
  const electroTerms = [
    'daft punk', 'kavinsky', 'alan walker', 'petit biscuit', 'dj snake', 'david guetta',
    'fred again', 'disclosure', 'justice', 'synthwave', 'phonk', 'funk', 'electro', 'edm',
    'house', 'techno', 'remix', 'brooklynbloodpop',
  ];
  if (electroTerms.some((a) => combined.includes(a))) {
    return 'Electro';
  }

  // Lo-Fi / Chill
  const lofiTerms = ['lofi', 'lo-fi', 'chill', 'beats', 'study', 'ambient', 'nujabes', 'slowed'];
  if (lofiTerms.some((a) => combined.includes(a))) {
    return 'Lo-Fi';
  }

  // French Pop
  const frenchPopTerms = ['stromae', 'angèle', 'angele', 'indochine', 'clara luciani', 'vianney', 'louane'];
  if (frenchPopTerms.some((a) => combined.includes(a))) {
    return 'French Pop';
  }

  // Acoustic / Soundtrack
  if (combined.includes('hans zimmer') || combined.includes('interstellar') || combined.includes('ost')) {
    return 'Cinematic';
  }
  if (combined.includes('acoustic') || combined.includes('acoustique') || combined.includes('passenger')) {
    return 'Acoustique';
  }

  return 'Pop';
}

function extractPrimaryArtist(artistStr: string): string {
  return artistStr
    .replace(/\([^)]*\)/g, '')
    .split(/\b(?:ft\.?|feat\.?|featuring|x|&|,)\b/i)[0]
    .trim();
}

export const RecommendationService = {
  analyzeTaste(
    history: Track[],
    favorites: Track[],
    playCounts: Record<string, number>
  ): TasteProfile {
    const genreScores: Record<string, number> = {};
    const artistScores: Record<string, { name: string; score: number }> = {};

    // Unique tracks interacted with
    const interactedIds = new Set<string>();

    history.forEach((track, idx) => {
      interactedIds.add(track.id);
      const recencyWeight = Math.max(1, 5 - idx * 0.2);
      const repeatWeight = Math.min(playCounts[track.id] || 1, 8);
      const weight = recencyWeight + repeatWeight * 0.8;

      const genre = inferTrackGenre(track);
      genreScores[genre] = (genreScores[genre] || 0) + weight;

      const primary = extractPrimaryArtist(track.artist);
      if (primary) {
        const key = primary.toLowerCase();
        artistScores[key] = {
          name: primary,
          score: (artistScores[key]?.score || 0) + weight,
        };
      }
    });

    favorites.forEach((track) => {
      interactedIds.add(track.id);
      const weight = 4.5;
      const genre = inferTrackGenre(track);
      genreScores[genre] = (genreScores[genre] || 0) + weight;

      const primary = extractPrimaryArtist(track.artist);
      if (primary) {
        const key = primary.toLowerCase();
        artistScores[key] = {
          name: primary,
          score: (artistScores[key]?.score || 0) + weight,
        };
      }
    });

    const listenedIds = new Set(history.map((t) => t.id));
    const totalListens = Object.values(playCounts).reduce((a, b) => a + b, 0);
    const progressCount = Math.min(
      REQUIRED_LISTENS_FOR_PROFILE,
      Math.max(listenedIds.size, totalListens)
    );

    const topGenres = Object.entries(genreScores)
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g);

    const topArtists = Object.values(artistScores)
      .sort((a, b) => b.score - a.score)
      .map((a) => a.name);

    const hasEnoughData =
      listenedIds.size >= REQUIRED_LISTENS_FOR_PROFILE ||
      totalListens >= REQUIRED_LISTENS_FOR_PROFILE;

    let summaryLabel = 'Écoutez des morceaux pour découvrir votre style';
    if (hasEnoughData) {
      const parts: string[] = [];
      if (topGenres.length > 0) parts.push(topGenres.slice(0, 2).join(' · '));
      if (topArtists.length > 0) parts.push(topArtists.slice(0, 2).join(', '));
      summaryLabel = parts.join(' — ');
    }

    const profile: TasteProfile = {
      hasEnoughData,
      totalListens,
      progressCount,
      requiredCount: REQUIRED_LISTENS_FOR_PROFILE,
      topGenres,
      topArtists,
      summaryLabel,
    };

    StorageService.saveTasteProfile(profile);
    return profile;
  },

  getLocalPersonalizedTracks(
    history: Track[],
    favorites: Track[],
    playCounts: Record<string, number>,
    limit = 12
  ): Track[] {
    const profile = this.analyzeTaste(history, favorites, playCounts);

    // Do NOT show personalized tracks until the user has actually listened to songs
    if (!profile.hasEnoughData) {
      return [];
    }

    const recentIds = new Set(history.slice(0, 3).map((t) => t.id));
    const topGenre = profile.topGenres[0];
    const secondGenre = profile.topGenres[1];
    const artistSet = new Set(profile.topArtists.map((a) => a.toLowerCase()));

    const scored = MULTI_GENRE_TRACKS.map((track) => {
      let score = 0;
      const g = inferTrackGenre(track);
      const pArtist = extractPrimaryArtist(track.artist).toLowerCase();

      if (g === topGenre) score += 50;
      else if (g === secondGenre) score += 25;

      if (artistSet.has(pArtist)) score += 35;

      // Favor tracks they haven't just played in the last 3 songs so recommendations feel fresh
      if (recentIds.has(track.id)) score -= 25;

      return { track, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.track);
  },

  async fetchPersonalizedTracks(
    history: Track[],
    favorites: Track[],
    playCounts: Record<string, number>,
    apiKey?: string,
    forceRefresh = false
  ): Promise<{ tracks: Track[]; profile: TasteProfile }> {
    const profile = this.analyzeTaste(history, favorites, playCounts);

    if (!profile.hasEnoughData) {
      return { tracks: [], profile };
    }

    const localTracks = this.getLocalPersonalizedTracks(history, favorites, playCounts, 16);

    const signature = `${profile.topGenres.slice(0, 2).join('|')}::${profile.topArtists.slice(0, 2).join('|')}`;

    // Check short-lived cache to avoid redundant YouTube API quota calls
    if (!forceRefresh) {
      try {
        const cachedRaw = sessionStorage.getItem(RECO_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached.signature === signature && Array.isArray(cached.tracks) && cached.tracks.length > 0) {
            return { tracks: cached.tracks, profile };
          }
        }
      } catch {
        // Ignore
      }
    }

    // Build a smart YouTube query matching user's detected style & favorite artists
    const seedArtist = profile.topArtists[0] || '';
    const seedGenre = profile.topGenres[0] || '';
    const secondArtist = profile.topArtists[1] || '';

    let searchQuery = '';
    if (seedArtist && secondArtist) {
      searchQuery = `${seedArtist} ${secondArtist} ${seedGenre === 'Rap FR' ? 'rap fr' : ''} audio`;
    } else if (seedArtist) {
      searchQuery = `${seedArtist} mix ${seedGenre}`;
    } else {
      searchQuery = `${seedGenre} hits`;
    }

    try {
      const { tracks: ytTracks, isFromOfficialApi } = await YouTubeService.search(
        searchQuery.trim(),
        apiKey
      );

      if (isFromOfficialApi && ytTracks.length > 0) {
        const recentIds = new Set(history.slice(0, 2).map((t) => t.id));
        const seen = new Set<string>();
        const merged: Track[] = [];

        // Interleave fresh YouTube matches of the user's style with top local matches
        for (const t of ytTracks) {
          if (!seen.has(t.id) && !recentIds.has(t.id)) {
            seen.add(t.id);
            merged.push({ ...t, category: inferTrackGenre(t) });
          }
          if (merged.length >= 10) break;
        }
        for (const t of localTracks) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            merged.push(t);
          }
          if (merged.length >= 16) break;
        }

        try {
          sessionStorage.setItem(
            RECO_CACHE_KEY,
            JSON.stringify({ signature, tracks: merged })
          );
        } catch {
          // Ignore
        }

        return { tracks: merged, profile };
      }
    } catch (e) {
      console.warn('Personalized YouTube fetch fallback to local catalog:', e);
    }

    return { tracks: localTracks, profile };
  },
};
