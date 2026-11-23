import { Playlist, TasteProfile, Track, UserSettings } from '../types/music';

const STORAGE_KEYS = {
  FAVORITES: 'hmd_favorites_v1',
  PLAYLISTS: 'hmd_playlists_v1',
  HISTORY: 'hmd_history_v1',
  SETTINGS: 'hmd_settings_v1',
  LAST_TRACK: 'hmd_last_track_v1',
  LAST_QUEUE: 'hmd_last_queue_v1',
  LAST_TIME: 'hmd_last_time_v1',
  PLAY_COUNTS: 'hmd_play_counts_v1',
  TRACK_CACHE: 'hmd_track_cache_v1',
  TASTE_PROFILE: 'hmd_taste_profile_v1',
};

const IDB_NAME = 'hmd_music_local_db';
const IDB_STORE = 'kv';
const MAX_TRACK_CACHE = 450;

export const DEFAULT_YOUTUBE_API_KEY = 'AIzaSyDu0gMHVMUefuBqvQUNo9xzo--m6VQN7O8';

export const DEFAULT_SETTINGS: UserSettings = {
  youtubeApiKey: DEFAULT_YOUTUBE_API_KEY,
  theme: 'dark',
  volume: 75,
  glassBlurIntensity: 'high',
  autoPlayNext: true,
  mouseGlowEffect: true,
  audioVisualizer: true,
  fullscreenEdgeVisualizer: true,
  customPauseKey: 'Space',
  customPauseKeyLabel: 'Espace',
  ultraMode: true,
  ultraClassicFullscreen: false,
  spotifyMode: false,
};

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function mirrorSetIdb(key: string, value: string): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
  } catch {
    // Ignore IDB quota/lock errors
  }
}

async function mirrorDeleteIdb(key: string): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
  } catch {}
}

function setKey(key: string, value: unknown): void {
  try {
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    void mirrorSetIdb(key, raw);
  } catch (e) {
    console.error(`Error saving ${key}:`, e);
  }
}

export const StorageService = {
  // Hydrate missing localStorage keys from IndexedDB (resilient across Android WebView APK restarts)
  async hydrateFromIndexedDB(): Promise<boolean> {
    const db = await openIdb();
    if (!db) return false;
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const keysToCheck = [
        STORAGE_KEYS.FAVORITES,
        STORAGE_KEYS.PLAYLISTS,
        STORAGE_KEYS.HISTORY,
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.LAST_TRACK,
        STORAGE_KEYS.LAST_QUEUE,
        STORAGE_KEYS.LAST_TIME,
        STORAGE_KEYS.PLAY_COUNTS,
        STORAGE_KEYS.TRACK_CACHE,
        STORAGE_KEYS.TASTE_PROFILE,
      ];

      let restoredAny = false;
      await Promise.all(
        keysToCheck.map(
          (k) =>
            new Promise<void>((resolve) => {
              if (localStorage.getItem(k) !== null) {
                resolve();
                return;
              }
              try {
                const req = store.get(k);
                req.onsuccess = () => {
                  if (typeof req.result === 'string' && req.result.length > 0) {
                    localStorage.setItem(k, req.result);
                    restoredAny = true;
                  }
                  resolve();
                };
                req.onerror = () => resolve();
              } catch {
                resolve();
              }
            })
        )
      );
      return restoredAny;
    } catch {
      return false;
    }
  },

  getFavorites(): Track[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading favorites:', e);
      return [];
    }
  },

  saveFavorites(favorites: Track[]): void {
    setKey(STORAGE_KEYS.FAVORITES, favorites);
    this.saveTracksToCache(favorites);
  },

  getPlaylists(): Playlist[] {
    const CLEANUP_FLAG = 'hmd_cleaned_default_pls_v1';
    const STARTER_IDS = new Set(['pl-favorites-mix', 'pl-chill-beats']);
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      if (data) {
        const parsed: Playlist[] = JSON.parse(data);
        if (Array.isArray(parsed)) {
          if (!localStorage.getItem(CLEANUP_FLAG)) {
            const cleaned = parsed.filter((p) => !STARTER_IDS.has(p.id));
            localStorage.setItem(CLEANUP_FLAG, '1');
            if (cleaned.length !== parsed.length) {
              this.savePlaylists(cleaned);
            }
            return cleaned;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading playlists:', e);
    }

    try {
      localStorage.setItem(CLEANUP_FLAG, '1');
    } catch {}
    return [];
  },

  savePlaylists(playlists: Playlist[]): void {
    setKey(STORAGE_KEYS.PLAYLISTS, playlists);
  },

  getHistory(): Track[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading history:', e);
      return [];
    }
  },

  saveHistory(history: Track[]): void {
    const limited = history.slice(0, 60);
    setKey(STORAGE_KEYS.HISTORY, limited);
    this.saveTracksToCache(limited);
  },

  hasSavedSettings(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.SETTINGS) !== null;
    } catch {
      return false;
    }
  },

  getSettings(): UserSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        const parsed = JSON.parse(data);
        const useSpotify = Boolean(parsed.spotifyMode);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          theme: 'dark',
          spotifyMode: useSpotify,
          ultraMode: !useSpotify,
          youtubeApiKey:
            parsed.youtubeApiKey && parsed.youtubeApiKey.trim() !== ''
              ? parsed.youtubeApiKey
              : DEFAULT_YOUTUBE_API_KEY,
        };
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings(settings: UserSettings): void {
    const useSpotify = Boolean(settings.spotifyMode);
    setKey(STORAGE_KEYS.SETTINGS, {
      ...settings,
      theme: 'dark',
      spotifyMode: useSpotify,
      ultraMode: !useSpotify,
    });
  },

  getLastTrack(): Track | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LAST_TRACK);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveLastTrack(track: Track | null): void {
    try {
      if (track) {
        setKey(STORAGE_KEYS.LAST_TRACK, track);
        this.saveTracksToCache([track]);
      } else {
        localStorage.removeItem(STORAGE_KEYS.LAST_TRACK);
        void mirrorDeleteIdb(STORAGE_KEYS.LAST_TRACK);
      }
    } catch {}
  },

  getLastTime(): number {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LAST_TIME);
      const val = data ? Number(JSON.parse(data)) : 0;
      return Number.isFinite(val) && val > 0 ? val : 0;
    } catch {
      return 0;
    }
  },

  saveLastTime(seconds: number): void {
    try {
      const safe = Math.max(0, Math.floor(seconds));
      const raw = JSON.stringify(safe);
      localStorage.setItem(STORAGE_KEYS.LAST_TIME, raw);
      void mirrorSetIdb(STORAGE_KEYS.LAST_TIME, raw);
    } catch {}
  },

  getSavedQueue(): Track[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LAST_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveQueue(queue: Track[]): void {
    const limited = queue.slice(0, 60);
    setKey(STORAGE_KEYS.LAST_QUEUE, limited);
    this.saveTracksToCache(limited);
  },

  getPlayCounts(): Record<string, number> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PLAY_COUNTS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  incrementPlayCount(trackId: string): Record<string, number> {
    try {
      const counts = this.getPlayCounts();
      counts[trackId] = (counts[trackId] || 0) + 1;
      setKey(STORAGE_KEYS.PLAY_COUNTS, counts);
      return counts;
    } catch {
      return {};
    }
  },

  // Full local Track metadata cache (ensures imported Spotify playlists & YouTube searches persist cleanly)
  getTrackCache(): Record<string, Track> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRACK_CACHE);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  saveTracksToCache(tracks: Track[]): void {
    if (!tracks || tracks.length === 0) return;
    try {
      const cache = this.getTrackCache();
      for (const t of tracks) {
        if (t && t.id) {
          cache[t.id] = t;
        }
      }
      const keys = Object.keys(cache);
      if (keys.length > MAX_TRACK_CACHE) {
        const dropCount = keys.length - MAX_TRACK_CACHE;
        for (let i = 0; i < dropCount; i++) {
          delete cache[keys[i]];
        }
      }
      setKey(STORAGE_KEYS.TRACK_CACHE, cache);
    } catch {}
  },

  getTasteProfile(): TasteProfile | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASTE_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveTasteProfile(profile: TasteProfile): void {
    setKey(STORAGE_KEYS.TASTE_PROFILE, profile);
  },

  resolveTracksByIds(ids: string[], knownTracks: Track[] = []): Track[] {
    const cache = this.getTrackCache();
    const knownMap = new Map<string, Track>();
    for (const t of knownTracks) {
      if (t && t.id && !knownMap.has(t.id)) {
        knownMap.set(t.id, t);
      }
    }

    try {
      const rawTiktok = localStorage.getItem('hmd_tiktok_songs_v1');
      if (rawTiktok) {
        const parsed = JSON.parse(rawTiktok);
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            if (t && t.id && !knownMap.has(t.id)) {
              knownMap.set(t.id, { ...t, sourceType: 'tiktok' });
            }
          }
        }
      }
    } catch {}

    return ids.map((id) => {
      const fromKnown = knownMap.get(id);
      if (fromKnown) return fromKnown;
      const fromCache = cache[id];
      if (fromCache) return fromCache;
      if (id.startsWith('tiktok-')) {
        return {
          id,
          title: 'TikTok Song',
          artist: 'TikTok',
          duration: 30,
          durationFormatted: '0:30',
          thumbnail: '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png',
          sourceType: 'tiktok',
        };
      }
      return {
        id,
        title: `Morceau YouTube (${id})`,
        artist: 'Artiste YouTube',
        duration: 210,
        durationFormatted: '3:30',
        thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
    });
  },

  clearAllData(): void {
    try {
      Object.values(STORAGE_KEYS).forEach((k) => {
        if (k !== STORAGE_KEYS.SETTINGS) {
          localStorage.removeItem(k);
          void mirrorDeleteIdb(k);
        }
      });
    } catch {}
  },
};
