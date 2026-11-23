import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { get, onValue, ref, set } from 'firebase/database';
import { Playlist, Track, UserSettings } from '../types/music';
import { db, handleFirestoreError, OperationType, rtdb } from './firebase';
import { DEFAULT_SETTINGS, StorageService } from './storage';
import { TikTokService } from './tiktok';

export interface CloudSyncedSettings {
  volume: number;
  glassBlurIntensity: UserSettings['glassBlurIntensity'];
  autoPlayNext: boolean;
  mouseGlowEffect: boolean;
  audioVisualizer: boolean;
  fullscreenEdgeVisualizer: boolean;
  customPauseKey: string;
  customPauseKeyLabel: string;
  ultraMode: boolean;
  ultraClassicFullscreen?: boolean;
  spotifyMode?: boolean;
}

export interface CloudUserSyncPayload {
  uid: string;
  username: string | null;
  displayName: string | null;
  favorites: Track[];
  playlists: Playlist[];
  history: Track[];
  tiktokSongs: Track[];
  playCounts: Record<string, number>;
  trackCache: Record<string, Track>;
  lastTrack: Track | null;
  lastTime: number;
  settings: CloudSyncedSettings;
  updatedAt: number;
}

export function usernameToAuthEmail(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  const ascii = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '');

  if (ascii.length < 2) {
    throw new Error("Nom d'utilisateur invalide (minimum 2 lettres ou chiffres).");
  }
  return `${ascii}@hmdmusic.app`;
}

export function getDisplayUsername(user: {
  displayName?: string | null;
  email?: string | null;
}): string {
  if (user.displayName && user.displayName.trim()) {
    return user.displayName.trim();
  }
  if (user.email) {
    return user.email.replace(/@hmdmusic\.app$/i, '');
  }
  return 'Utilisateur';
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function sanitizeTrack(track: Track): Track {
  return stripUndefined({
    id: String(track.id),
    title: String(track.title || 'Sans titre').slice(0, 200),
    artist: String(track.artist || 'Artiste inconnu').slice(0, 120),
    duration: Number.isFinite(Number(track.duration)) ? Number(track.duration) : 180,
    durationFormatted: String(track.durationFormatted || '3:00').slice(0, 16),
    thumbnail: String(track.thumbnail || ''),
    album: track.album ? String(track.album).slice(0, 120) : undefined,
    category: track.category ? String(track.category).slice(0, 60) : undefined,
    views: track.views ? String(track.views).slice(0, 60) : undefined,
    sourceType: track.sourceType,
    audioUrl: track.audioUrl,
    sourceUrl: track.sourceUrl,
  });
}

function sanitizePlaylist(pl: Playlist): Playlist {
  return stripUndefined({
    id: String(pl.id),
    title: String(pl.title || 'Playlist').slice(0, 120),
    description: pl.description ? String(pl.description).slice(0, 300) : '',
    coverImage: pl.coverImage ? String(pl.coverImage) : undefined,
    trackIds: Array.isArray(pl.trackIds) ? Array.from(new Set(pl.trackIds.map(String))) : [],
    createdAt: Number(pl.createdAt) || Date.now(),
    updatedAt: Number(pl.updatedAt) || Date.now(),
  });
}

function normalizeTrackList(raw: unknown, max: number): Track[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof (item as any).id !== 'string') continue;
    const t = sanitizeTrack(item as Track);
    if (!seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
      if (out.length >= max) break;
    }
  }
  return out;
}

function normalizeCloudSettings(raw: Partial<CloudSyncedSettings> | undefined, fallback: UserSettings): CloudSyncedSettings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...fallback,
    ...(raw || {}),
  };
  const useSpotify = Boolean(merged.spotifyMode);
  return stripUndefined({
    volume: Number.isFinite(Number(merged.volume)) ? Number(merged.volume) : 75,
    glassBlurIntensity: merged.glassBlurIntensity || 'high',
    autoPlayNext: merged.autoPlayNext !== false,
    mouseGlowEffect: Boolean(merged.mouseGlowEffect),
    audioVisualizer: Boolean(merged.audioVisualizer),
    fullscreenEdgeVisualizer: merged.fullscreenEdgeVisualizer !== false,
    customPauseKey: String(merged.customPauseKey || 'Space'),
    customPauseKeyLabel: String(merged.customPauseKeyLabel || 'Espace'),
    ultraMode: !useSpotify,
    ultraClassicFullscreen: Boolean(merged.ultraClassicFullscreen),
    spotifyMode: useSpotify,
  });
}

function buildCompactTrackCache(
  favorites: Track[],
  history: Track[],
  playlists: Playlist[],
  tiktokSongs: Track[],
  lastTrack: Track | null,
  rawCache: Record<string, Track>
): Record<string, Track> {
  const result: Record<string, Track> = {};
  const addTrack = (t: Track | null | undefined) => {
    if (t && t.id && !result[t.id]) {
      result[t.id] = sanitizeTrack(t);
    }
  };

  favorites.forEach(addTrack);
  history.forEach(addTrack);
  tiktokSongs.forEach(addTrack);
  addTrack(lastTrack);

  for (const pl of playlists) {
    for (const id of pl.trackIds) {
      if (!result[id] && rawCache[id]) {
        result[id] = sanitizeTrack(rawCache[id]);
      }
    }
  }

  for (const [id, t] of Object.entries(rawCache)) {
    if (Object.keys(result).length >= 250) break;
    if (!result[id] && t && t.id) {
      result[id] = sanitizeTrack(t);
    }
  }

  return result;
}

export function collectLocalSyncData(
  uid: string,
  username: string | null,
  displayName: string | null
): CloudUserSyncPayload {
  const favorites = normalizeTrackList(StorageService.getFavorites(), 250);
  const history = normalizeTrackList(StorageService.getHistory(), 60);
  const playlists = StorageService.getPlaylists().map(sanitizePlaylist);
  const tiktokSongs = normalizeTrackList(TikTokService.getRecentSongs(), 25);
  const playCounts = StorageService.getPlayCounts();
  const lastTrackRaw = StorageService.getLastTrack();
  const lastTrack = lastTrackRaw ? sanitizeTrack(lastTrackRaw) : null;
  const lastTime = StorageService.getLastTime();
  const settings = StorageService.getSettings();
  const rawCache = StorageService.getTrackCache();

  return stripUndefined({
    uid,
    username,
    displayName,
    favorites,
    playlists,
    history,
    tiktokSongs,
    playCounts,
    trackCache: buildCompactTrackCache(favorites, history, playlists, tiktokSongs, lastTrack, rawCache),
    lastTrack,
    lastTime,
    settings: normalizeCloudSettings(undefined, settings),
    updatedAt: Date.now(),
  });
}

function mergeTrackLists(primary: Track[], secondary: Track[], max: number): Track[] {
  const seen = new Set<string>();
  const merged: Track[] = [];
  for (const t of [...primary, ...secondary]) {
    if (!t || !t.id || seen.has(t.id)) continue;
    seen.add(t.id);
    merged.push(sanitizeTrack(t));
    if (merged.length >= max) break;
  }
  return merged;
}

export function mergeUserSyncData(
  local: CloudUserSyncPayload,
  cloud: Partial<CloudUserSyncPayload> | null,
  options?: { preferCloudOnFreshDevice?: boolean }
): CloudUserSyncPayload {
  if (!cloud) {
    return {
      ...local,
      updatedAt: Date.now(),
    };
  }

  const cloudHistory = normalizeTrackList(cloud.history, 60);
  const cloudFavorites = normalizeTrackList(cloud.favorites, 250);
  const cloudTiktok = normalizeTrackList(cloud.tiktokSongs, 25);
  const cloudPlaylists = Array.isArray(cloud.playlists)
    ? cloud.playlists.map(sanitizePlaylist)
    : [];
  const cloudPlayCounts: Record<string, number> =
    cloud.playCounts && typeof cloud.playCounts === 'object' ? (cloud.playCounts as Record<string, number>) : {};
  const cloudUpdatedAt = Number(cloud.updatedAt) || 0;

  const preferCloud =
    (options?.preferCloudOnFreshDevice && local.history.length === 0 && local.favorites.length === 0) ||
    cloudUpdatedAt > local.updatedAt;

  const history = preferCloud
    ? mergeTrackLists(cloudHistory, local.history, 60)
    : mergeTrackLists(local.history, cloudHistory, 60);

  const favorites = preferCloud
    ? mergeTrackLists(cloudFavorites, local.favorites, 250)
    : mergeTrackLists(local.favorites, cloudFavorites, 250);

  const tiktokSongs = preferCloud
    ? mergeTrackLists(cloudTiktok, local.tiktokSongs, 25)
    : mergeTrackLists(local.tiktokSongs, cloudTiktok, 25);

  const playlistMap = new Map<string, Playlist>();
  for (const pl of local.playlists) {
    playlistMap.set(pl.id, pl);
  }
  for (const cpl of cloudPlaylists) {
    const existing = playlistMap.get(cpl.id);
    if (!existing) {
      playlistMap.set(cpl.id, cpl);
    } else {
      const winner = cpl.updatedAt >= existing.updatedAt ? cpl : existing;
      const other = winner === cpl ? existing : cpl;
      playlistMap.set(cpl.id, {
        ...winner,
        trackIds: Array.from(new Set([...winner.trackIds, ...other.trackIds])),
        updatedAt: Math.max(cpl.updatedAt, existing.updatedAt),
      });
    }
  }
  const playlists = Array.from(playlistMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);

  const playCounts: Record<string, number> = { ...local.playCounts };
  for (const [trackId, count] of Object.entries(cloudPlayCounts)) {
    const num = Number(count) || 0;
    playCounts[trackId] = Math.max(playCounts[trackId] || 0, num);
  }

  const rawCloudCache =
    cloud.trackCache && typeof cloud.trackCache === 'object'
      ? (cloud.trackCache as Record<string, Track>)
      : {};
  const mergedCache = buildCompactTrackCache(
    favorites,
    history,
    playlists,
    tiktokSongs,
    cloud.lastTrack ? sanitizeTrack(cloud.lastTrack) : local.lastTrack,
    { ...rawCloudCache, ...local.trackCache }
  );

  const isFreshLocalDevice = local.history.length === 0 && local.favorites.length === 0 && local.playlists.length === 0;
  const useCloudLastTrack =
    Boolean(cloud.lastTrack) && (isFreshLocalDevice || cloudUpdatedAt > local.updatedAt);

  const lastTrack = useCloudLastTrack && cloud.lastTrack ? sanitizeTrack(cloud.lastTrack) : local.lastTrack;
  const lastTime = useCloudLastTrack ? Number(cloud.lastTime) || 0 : local.lastTime;

  const localSettings = StorageService.getSettings();
  const useCloudSettings =
    Boolean(cloud.settings) && (!StorageService.hasSavedSettings() || options?.preferCloudOnFreshDevice);
  const settings = useCloudSettings
    ? normalizeCloudSettings(cloud.settings, localSettings)
    : local.settings;

  return stripUndefined({
    uid: local.uid,
    username: local.username ?? cloud.username ?? null,
    displayName: local.displayName ?? cloud.displayName ?? null,
    favorites,
    playlists,
    history,
    tiktokSongs,
    playCounts,
    trackCache: mergedCache,
    lastTrack,
    lastTime,
    settings,
    updatedAt: Math.max(Date.now(), cloudUpdatedAt),
  });
}

export function applySyncDataToLocal(data: CloudUserSyncPayload): UserSettings {
  const existingSettings = StorageService.getSettings();
  const nextSettings: UserSettings = {
    ...existingSettings,
    ...data.settings,
    theme: 'dark',
    spotifyMode: Boolean(data.settings.spotifyMode),
    ultraMode: !Boolean(data.settings.spotifyMode),
  };

  StorageService.saveTracksToCache(Object.values(data.trackCache || {}));
  StorageService.saveFavorites(data.favorites);
  StorageService.savePlaylists(data.playlists);
  StorageService.saveHistory(data.history);
  TikTokService.setRecentSongs(data.tiktokSongs);

  try {
    localStorage.setItem('hmd_play_counts_v1', JSON.stringify(data.playCounts || {}));
  } catch {}

  if (data.lastTrack) {
    StorageService.saveLastTrack(data.lastTrack);
  }
  if (Number.isFinite(data.lastTime) && data.lastTime > 0) {
    StorageService.saveLastTime(data.lastTime);
  }
  StorageService.saveSettings(nextSettings);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hmd-tiktok-songs-updated'));
  }

  return nextSettings;
}

const FIRESTORE_COLLECTION = 'hmdMusicUsers';

export async function readCloudUserData(uid: string): Promise<Partial<CloudUserSyncPayload> | null> {
  const firestorePath = `${FIRESTORE_COLLECTION}/${uid}`;
  let firestoreDenied = false;

  try {
    const snap = await getDoc(doc(db, FIRESTORE_COLLECTION, uid));
    if (snap.exists()) {
      return snap.data() as Partial<CloudUserSyncPayload>;
    }
  } catch (err) {
    firestoreDenied = true;
    try {
      handleFirestoreError(err, OperationType.GET, firestorePath);
    } catch {
      // Structured Firestore context logged; try Realtime Database fallback below
    }
  }

  try {
    const rtdbSnap = await get(ref(rtdb, `hmdMusicUsers/${uid}/sync`));
    if (rtdbSnap.exists()) {
      return rtdbSnap.val() as Partial<CloudUserSyncPayload>;
    }
    return null;
  } catch (rtdbErr) {
    if (firestoreDenied) {
      throw rtdbErr;
    }
    return null;
  }
}

export async function writeCloudUserData(uid: string, payload: CloudUserSyncPayload): Promise<void> {
  const cleanPayload = stripUndefined(payload);
  const firestorePath = `${FIRESTORE_COLLECTION}/${uid}`;
  let firestoreErr: unknown = null;

  try {
    await setDoc(doc(db, FIRESTORE_COLLECTION, uid), cleanPayload);
    // Mirror silently to RTDB when allowed so both backends stay consistent
    set(ref(rtdb, `hmdMusicUsers/${uid}/sync`), cleanPayload).catch(() => {});
    return;
  } catch (err) {
    firestoreErr = err;
    try {
      handleFirestoreError(err, OperationType.WRITE, firestorePath);
    } catch {
      // Structured Firestore context logged; try Realtime Database fallback below
    }
  }

  try {
    await set(ref(rtdb, `hmdMusicUsers/${uid}/sync`), cleanPayload);
  } catch (rtdbErr) {
    throw rtdbErr || firestoreErr;
  }
}

export function subscribeCloudUserData(
  uid: string,
  onRemoteData: (data: Partial<CloudUserSyncPayload>) => void
): () => void {
  let rtdbUnsub: (() => void) | null = null;
  let firestoreUnsub: (() => void) | null = null;

  const startRtdbListener = () => {
    if (rtdbUnsub) return;
    const syncRef = ref(rtdb, `hmdMusicUsers/${uid}/sync`);
    rtdbUnsub = onValue(
      syncRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onRemoteData(snapshot.val() as Partial<CloudUserSyncPayload>);
        }
      },
      () => {
        // Ignore RTDB listener permission errors silently
      }
    );
  };

  try {
    const userDocRef = doc(db, FIRESTORE_COLLECTION, uid);
    firestoreUnsub = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return;
        if (snapshot.exists()) {
          onRemoteData(snapshot.data() as Partial<CloudUserSyncPayload>);
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, `${FIRESTORE_COLLECTION}/${uid}`);
        } catch {
          // Fallback to RTDB real-time listener when Firestore rules deny access
        }
        startRtdbListener();
      }
    );
  } catch {
    startRtdbListener();
  }

  return () => {
    firestoreUnsub?.();
    rtdbUnsub?.();
  };
}

export function formatFirebaseAuthError(err: any): string {
  const code = typeof err?.code === 'string' ? err.code : '';
  if (code === 'auth/email-already-in-use') {
    return "Ce nom d'utilisateur est déjà pris. Choisissez-en un autre ou cliquez sur « Se connecter ».";
  }
  if (code === 'auth/invalid-email') {
    return "Nom d'utilisateur invalide. Utilisez uniquement des lettres, chiffres, points ou tirets (min. 2 caractères).";
  }
  if (code === 'auth/weak-password') {
    return 'Mot de passe trop court (minimum 6 caractères).';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return "Nom d'utilisateur ou mot de passe incorrect.";
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Activez « E-mail / Mot de passe » dans Firebase Console → Authentication → Méthode de connexion.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Erreur réseau. Vérifiez votre connexion Internet.';
  }
  if (typeof err?.message === 'string' && err.message.includes("Nom d'utilisateur")) {
    return err.message;
  }
  if (typeof err?.message === 'string' && err.message.includes('PERMISSION_DENIED')) {
    return 'Compte connecté, mais les règles Firebase refusent la synchronisation. Ajoutez la règle hmdMusicUsers dans Firestore.';
  }
  return 'Impossible de finaliser la connexion. Vérifiez vos identifiants et votre connexion.';
}
