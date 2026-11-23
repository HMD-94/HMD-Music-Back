import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { ActiveTab, Playlist, RepeatMode, Track, UserSettings } from '../types/music';
import { StorageService } from '../services/storage';
import { CURATED_TRACKS } from '../services/youtube';
import { buildTikTokStreamUrl, isTikTokTrack } from '../services/tiktok';
import { auth } from '../services/firebase';
import {
  applySyncDataToLocal,
  CloudUserSyncPayload,
  collectLocalSyncData,
  formatFirebaseAuthError,
  getDisplayUsername,
  mergeUserSyncData,
  readCloudUserData,
  subscribeCloudUserData,
  usernameToAuthEmail,
  writeCloudUserData,
} from '../services/cloudSync';

export interface AuthUserSummary {
  uid: string;
  username: string;
  displayName: string | null;
}

interface PlaybackTimeContextType {
  currentTime: number;
  duration: number;
}

const PlaybackTimeContext = createContext<PlaybackTimeContextType>({
  currentTime: 0,
  duration: 200,
});

export const usePlaybackTime = (): PlaybackTimeContextType => useContext(PlaybackTimeContext);

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  queue: Track[];
  history: Track[];
  favorites: Track[];
  playlists: Playlist[];
  playCounts: Record<string, number>;
  activeTab: ActiveTab;
  selectedPlaylistId: string | null;
  settings: UserSettings;
  isFullscreenPlayerOpen: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  isPlaylistModalOpen: boolean;
  isDesktopModalOpen: boolean;
  isSpotifyModalOpen: boolean;
  playlistTrackToAdd: Track | null;
  errorMessage: string | null;

  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  toggleFavorite: (track: Track) => void;
  isFavorite: (trackId: string) => boolean;
  createPlaylist: (title: string, description?: string) => Playlist;
  importPlaylistWithTracks: (
    title: string,
    description: string,
    tracks: Track[],
    coverImage?: string
  ) => Playlist;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylistTracks: (playlistId: string, startIndex: number, endIndex: number) => void;
  setActiveTab: (tab: ActiveTab) => void;
  openPlaylist: (playlistId: string) => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  setIsFullscreenPlayerOpen: (open: boolean) => void;
  setIsLyricsOpen: (open: boolean) => void;
  openFullscreenWithLyrics: () => void;
  setIsQueueOpen: (open: boolean) => void;
  setIsDesktopModalOpen: (open: boolean) => void;
  setIsSpotifyModalOpen: (open: boolean) => void;
  openAddToPlaylistModal: (track: Track) => void;
  closeAddToPlaylistModal: () => void;
  removeFromHistory: (trackId: string) => void;
  clearHistory: () => void;
  clearErrorMessage: () => void;

  // Theme transition + Optional Account & Cross-Device Sync
  isThemeTransitioning: boolean;
  authUser: AuthUserSummary | null;
  isAuthReady: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedAt: number | null;
  syncError: string | null;
  signUpWithUsername: (username: string, password: string) => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  signOutAccount: () => Promise<void>;
  syncNow: () => Promise<void>;
  clearSyncError: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() => StorageService.getSettings());
  const [favorites, setFavorites] = useState<Track[]>(() => StorageService.getFavorites());
  const [playlists, setPlaylists] = useState<Playlist[]>(() => StorageService.getPlaylists());
  const [history, setHistory] = useState<Track[]>(() => StorageService.getHistory());
  const [playCounts, setPlayCounts] = useState<Record<string, number>>(() => StorageService.getPlayCounts());
  const [queue, setQueue] = useState<Track[]>(() => {
    const saved = StorageService.getSavedQueue();
    return saved.length > 0 ? saved : CURATED_TRACKS.slice(0, 10);
  });
  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => {
    const last = StorageService.getLastTrack();
    return last || CURATED_TRACKS[0];
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => StorageService.getLastTime());
  const [duration, setDuration] = useState(() => currentTrack?.duration || 200);
  const [volume, setVolumeState] = useState(settings.volume);
  const [isMuted, setIsMuted] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('all');
  const [shuffle, setShuffle] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isFullscreenPlayerOpen, setIsFullscreenPlayerOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);
  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false);
  const [playlistTrackToAdd, setPlaylistTrackToAdd] = useState<Track | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUserSummary | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const ytPlayerRef = useRef<any>(null);
  const isYtReadyRef = useRef<boolean>(false);
  const progressTimerRef = useRef<any>(null);
  const watchdogTimerRef = useRef<any>(null);
  const bufferingSinceRef = useRef<number | null>(null);
  const lastMediaSessionSyncRef = useRef<number>(0);
  const lastTimeSaveRef = useRef<number>(0);
  const bgResumeTimersRef = useRef<number[]>([]);
  const themeTransitionTimerRef = useRef<number | null>(null);

  const currentTrackRef = useRef<Track | null>(currentTrack);
  const queueRef = useRef<Track[]>(queue);
  const repeatRef = useRef<RepeatMode>(repeat);
  const shuffleRef = useRef<boolean>(shuffle);
  const settingsRef = useRef<UserSettings>(settings);
  const currentTimeRef = useRef<number>(currentTime);
  const durationRef = useRef<number>(duration);

  const isPlayingRef = useRef<boolean>(isPlaying);
  const isMutedRef = useRef<boolean>(isMuted);
  const shouldBePlayingRef = useRef<boolean>(false);
  const userPausedRef = useRef<boolean>(false);
  const carrierAudioRef = useRef<HTMLAudioElement | null>(null);
  const directAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Prevent repeated native foreground-service start requests while playback remains active.
  const nativeBackgroundServiceStartAttemptedRef = useRef<boolean>(false);
  const tiktokLoadTimerRef = useRef<number | null>(null);
  const tiktokRetryAttemptRef = useRef<number>(0);
  const pendingSeekAfterLoadRef = useRef<number>(0);
  const startTikTokAudioRef = useRef<
    (track: Track, options?: { startTime?: number; forceRefresh?: boolean }) => void
  >(() => {});

  const authUserRef = useRef<AuthUserSummary | null>(authUser);
  const isApplyingRemoteSyncRef = useRef<boolean>(false);
  const lastSyncedUpdatedAtRef = useRef<number>(0);
  const cloudPushTimerRef = useRef<number | null>(null);
  const manualAuthActionRef = useRef<boolean>(false);

  authUserRef.current = authUser;
  isPlayingRef.current = isPlaying;
  isMutedRef.current = isMuted;
  currentTrackRef.current = currentTrack;
  queueRef.current = queue;
  repeatRef.current = repeat;
  shuffleRef.current = shuffle;
  settingsRef.current = settings;
  currentTimeRef.current = currentTime;
  durationRef.current = duration;

  // Hydrate state from IndexedDB if Android WebView cleared localStorage between sessions
  useEffect(() => {
    let active = true;
    StorageService.hydrateFromIndexedDB().then((restored) => {
      if (!active || !restored) return;
      setFavorites(StorageService.getFavorites());
      setPlaylists(StorageService.getPlaylists());
      setHistory(StorageService.getHistory());
      setPlayCounts(StorageService.getPlayCounts());
      setSettings(StorageService.getSettings());
      const restoredTrack = StorageService.getLastTrack();
      if (restoredTrack) setCurrentTrack(restoredTrack);
      const restoredQueue = StorageService.getSavedQueue();
      if (restoredQueue.length > 0) setQueue(restoredQueue);
      const restoredTime = StorageService.getLastTime();
      if (restoredTime > 0) setCurrentTime(restoredTime);
    });
    return () => {
      active = false;
    };
  }, []);

  // Dual Background Audio Keep-Alive (Silent WAV + Web Audio low-gain node)
  // Keeps audio focus active in Android WebView APK & mobile browsers when screen turns off or app minimizes
  useEffect(() => {
    const SILENT_WAV =
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    const audio = new Audio(SILENT_WAV);
    audio.loop = true;
    audio.volume = 0.002;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    carrierAudioRef.current = audio;

    return () => {
      bgResumeTimersRef.current.forEach((t) => clearTimeout(t));
      audio.pause();
      audio.src = '';
    };
  }, []);

  const ensureBackgroundAudioAlive = useCallback((active: boolean) => {
    // FreeWebToApk / AppMint native bridge:
    // Keep the WebView alive with Android's foreground service while music is playing.
    // The service type is selected in the APK generator (mediaPlayback).
    const nativeBridge = (window as any).WebToApk;
    if (nativeBridge) {
      if (
        active &&
        typeof nativeBridge.startBackgroundService === 'function' &&
        !nativeBackgroundServiceStartAttemptedRef.current
      ) {
        nativeBackgroundServiceStartAttemptedRef.current = true;
        try {
          const rawResult = nativeBridge.startBackgroundService(
            JSON.stringify({
              title: 'HMD Music',
              text: currentTrackRef.current?.title || 'Lecture musicale en cours',
            })
          );
          const result = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
          if (!result?.ok) {
            console.warn(
              '[HMD Music] Android background service not started:',
              result?.reason || rawResult || 'unknown_error'
            );
          }
        } catch (error) {
          console.warn('[HMD Music] Could not start Android background service:', error);
        }
      } else if (!active) {
        if (
          nativeBackgroundServiceStartAttemptedRef.current &&
          typeof nativeBridge.stopBackgroundService === 'function'
        ) {
          try {
            nativeBridge.stopBackgroundService();
          } catch (error) {
            console.warn('[HMD Music] Could not stop Android background service:', error);
          }
        }
        nativeBackgroundServiceStartAttemptedRef.current = false;
      }
    }

    if (carrierAudioRef.current) {
      if (active) {
        carrierAudioRef.current.play().catch(() => {});
      } else {
        carrierAudioRef.current.pause();
      }
    }

    try {
      if (active) {
        if (!audioCtxRef.current && typeof AudioContext !== 'undefined') {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.00001;
          osc.frequency.value = 20;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          audioCtxRef.current = ctx;
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } else if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend().catch(() => {});
      }
    } catch {
      // Ignore audio context restrictions
    }
  }, []);

  useEffect(() => {
    ensureBackgroundAudioAlive(isPlaying);
  }, [isPlaying, ensureBackgroundAudioAlive]);

  // Apply Mode Ultra / Mode Spotify classes to <html> (only these two themes exist)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    root.classList.remove('light');

    const useSpotify = Boolean(settings.spotifyMode);
    if (useSpotify) {
      root.classList.remove('ultra-mode');
      root.classList.add('spotify-mode');
    } else {
      root.classList.remove('spotify-mode');
      root.classList.add('ultra-mode');
    }

    if (isThemeTransitioning) {
      root.classList.add('theme-transitioning');
    } else {
      root.classList.remove('theme-transitioning');
    }
  }, [settings.ultraMode, settings.spotifyMode, isThemeTransitioning]);

  useEffect(() => {
    return () => {
      if (themeTransitionTimerRef.current) {
        clearTimeout(themeTransitionTimerRef.current);
      }
      if (cloudPushTimerRef.current) {
        clearTimeout(cloudPushTimerRef.current);
      }
    };
  }, []);

  // Sync state to local storage
  useEffect(() => {
    StorageService.saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    StorageService.savePlaylists(playlists);
  }, [playlists]);

  useEffect(() => {
    StorageService.saveHistory(history);
  }, [history]);

  useEffect(() => {
    StorageService.saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    StorageService.saveLastTrack(currentTrack);
  }, [currentTrack]);

  useEffect(() => {
    StorageService.saveQueue(queue);
  }, [queue]);

  // Isolated Progress Polling (updates ONLY PlaybackTimeContext subscribers!)
  const startProgressPolling = useCallback(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      if (ytPlayerRef.current && isYtReadyRef.current && ytPlayerRef.current.getCurrentTime) {
        try {
          const curr = ytPlayerRef.current.getCurrentTime() || 0;
          const dur = ytPlayerRef.current.getDuration() || currentTrackRef.current?.duration || 0;
          setCurrentTime(curr);
          if (dur > 0 && Math.abs(dur - durationRef.current) > 0.5) {
            setDuration(dur);
          }

          // Periodically save playback position every 4s for instant resume after APK/tab close
          const now = Date.now();
          if (now - lastTimeSaveRef.current > 4000 && curr > 0) {
            lastTimeSaveRef.current = now;
            StorageService.saveLastTime(curr);
          }

          // Throttled MediaSession position update (~1s)
          if (
            now - lastMediaSessionSyncRef.current > 1000 &&
            dur > 0 &&
            'mediaSession' in navigator &&
            'setPositionState' in navigator.mediaSession
          ) {
            lastMediaSessionSyncRef.current = now;
            try {
              navigator.mediaSession.setPositionState({
                duration: Math.max(dur, 1),
                playbackRate: 1,
                position: Math.min(Math.max(curr, 0), dur),
              });
            } catch {}
          }
        } catch {}
      }
    }, 250);
  }, []);

  const stopProgressPolling = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const clearBgResumeTimers = useCallback(() => {
    bgResumeTimersRef.current.forEach((id) => clearTimeout(id));
    bgResumeTimersRef.current = [];
  }, []);

  const clearTikTokLoadTimer = useCallback(() => {
    if (tiktokLoadTimerRef.current !== null) {
      clearTimeout(tiktokLoadTimerRef.current);
      tiktokLoadTimerRef.current = null;
    }
  }, []);

  const startTikTokAudio = useCallback(
    (track: Track, options?: { startTime?: number; forceRefresh?: boolean }) => {
      clearTikTokLoadTimer();
      const audio = directAudioRef.current;
      const streamUrl = buildTikTokStreamUrl(track, {
        refresh: Boolean(options?.forceRefresh),
        cacheBust: true,
      });

      if (!audio || !streamUrl) {
        shouldBePlayingRef.current = false;
        setIsPlaying(false);
        setIsLoading(false);
        setErrorMessage('Impossible de lire le son de cette vidéo TikTok.');
        return;
      }

      pendingSeekAfterLoadRef.current =
        options?.startTime && options.startTime > 1 ? options.startTime : 0;
      setIsLoading(true);
      setErrorMessage(null);

      try {
        audio.pause();
      } catch {}
      audio.preload = 'auto';
      audio.src = streamUrl;
      audio.muted = isMutedRef.current;
      audio.volume = isMutedRef.current
        ? 0
        : Math.min(1, Math.max(0, (settingsRef.current.volume ?? 80) / 100));
      audio.load();

      tiktokLoadTimerRef.current = window.setTimeout(() => {
        tiktokLoadTimerRef.current = null;
        if (
          !shouldBePlayingRef.current ||
          userPausedRef.current ||
          !isTikTokTrack(currentTrackRef.current)
        ) {
          return;
        }
        const currAudio = directAudioRef.current;
        if (!currAudio || (!currAudio.paused && currAudio.readyState >= 2)) {
          return;
        }
        if (tiktokRetryAttemptRef.current === 0 && currentTrackRef.current) {
          tiktokRetryAttemptRef.current = 1;
          startTikTokAudioRef.current(currentTrackRef.current, {
            startTime: pendingSeekAfterLoadRef.current || currentTimeRef.current,
            forceRefresh: true,
          });
          return;
        }
        shouldBePlayingRef.current = false;
        setIsPlaying(false);
        setIsLoading(false);
        setErrorMessage('Le son TikTok met trop de temps à charger. Réessayez.');
      }, 12000);

      audio.play().catch((err: any) => {
        if (err?.name === 'AbortError') {
          return;
        }
        if (err?.name === 'NotAllowedError') {
          clearTikTokLoadTimer();
          shouldBePlayingRef.current = false;
          setIsPlaying(false);
          setIsLoading(false);
          return;
        }
        if (
          shouldBePlayingRef.current &&
          !userPausedRef.current &&
          tiktokRetryAttemptRef.current === 0
        ) {
          tiktokRetryAttemptRef.current = 1;
          startTikTokAudioRef.current(track, {
            startTime: pendingSeekAfterLoadRef.current || currentTimeRef.current,
            forceRefresh: true,
          });
          return;
        }
        clearTikTokLoadTimer();
        shouldBePlayingRef.current = false;
        setIsPlaying(false);
        setIsLoading(false);
        setErrorMessage('Impossible de lire le son de cette vidéo TikTok.');
      });
    },
    [clearTikTokLoadTimer]
  );

  startTikTokAudioRef.current = startTikTokAudio;

  const triggerBackgroundResumeRetries = useCallback(() => {
    clearBgResumeTimers();
    const delays = [120, 420, 1000];
    delays.forEach((delay) => {
      const tid = window.setTimeout(() => {
        if (!shouldBePlayingRef.current || userPausedRef.current) return;
        ensureBackgroundAudioAlive(true);
        if (isTikTokTrack(currentTrackRef.current)) {
          const audio = directAudioRef.current;
          if (audio && audio.paused && !audio.error && audio.readyState >= 2) {
            audio.play().catch(() => {});
          }
          return;
        }
        if (ytPlayerRef.current && isYtReadyRef.current) {
          try {
            const st = ytPlayerRef.current.getPlayerState?.();
            if (st !== 1) {
              ytPlayerRef.current.playVideo?.();
            }
          } catch {}
        }
      }, delay);
      bgResumeTimersRef.current.push(tid);
    });
  }, [clearBgResumeTimers, ensureBackgroundAudioAlive]);

  // Watchdog + visibility/pagehide handler for screen-off & app-background audio continuity
  useEffect(() => {
    if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);

    watchdogTimerRef.current = setInterval(() => {
      if (!shouldBePlayingRef.current || userPausedRef.current) {
        bufferingSinceRef.current = null;
        return;
      }

      if (isTikTokTrack(currentTrackRef.current)) {
        bufferingSinceRef.current = null;
        const audio = directAudioRef.current;
        if (audio && audio.paused && !audio.error && audio.readyState >= 2) {
          ensureBackgroundAudioAlive(true);
          audio.play().catch(() => {});
        }
        return;
      }

      if (!ytPlayerRef.current || !isYtReadyRef.current) {
        bufferingSinceRef.current = null;
        return;
      }

      try {
        const state = ytPlayerRef.current.getPlayerState?.();
        if (state === 3) {
          if (bufferingSinceRef.current === null) {
            bufferingSinceRef.current = Date.now();
          } else if (Date.now() - bufferingSinceRef.current > 7000) {
            const pos = ytPlayerRef.current.getCurrentTime?.() || currentTimeRef.current;
            ytPlayerRef.current.seekTo?.(pos, true);
            ytPlayerRef.current.playVideo?.();
            bufferingSinceRef.current = Date.now();
          }
        } else {
          bufferingSinceRef.current = null;
          // Recover from unexpected background pause or unstarted state
          if ((state === -1 || state === 2 || state === 5) && shouldBePlayingRef.current && !userPausedRef.current) {
            ensureBackgroundAudioAlive(true);
            ytPlayerRef.current.playVideo?.();
          }
        }
      } catch {}
    }, 1500);

    const persistPositionNow = () => {
      try {
        const pos = isTikTokTrack(currentTrackRef.current)
          ? directAudioRef.current?.currentTime || currentTimeRef.current
          : ytPlayerRef.current?.getCurrentTime?.() || currentTimeRef.current;
        if (pos > 0) StorageService.saveLastTime(pos);
      } catch {}
      StorageService.saveLastTrack(currentTrackRef.current);
      StorageService.saveQueue(queueRef.current);
    };

    const handleVisibility = () => {
      persistPositionNow();
      if (shouldBePlayingRef.current && !userPausedRef.current) {
        ensureBackgroundAudioAlive(true);
        if (document.visibilityState === 'hidden') {
          // Mobile Chromium / Android WebView often auto-pauses media when screen turns off; fight it immediately
          triggerBackgroundResumeRetries();
        } else if (isTikTokTrack(currentTrackRef.current)) {
          const audio = directAudioRef.current;
          if (audio && audio.paused && !audio.error && audio.readyState >= 2) {
            audio.play().catch(() => {});
          }
        } else if (ytPlayerRef.current && isYtReadyRef.current) {
          try {
            const curr = ytPlayerRef.current.getCurrentTime?.() || 0;
            setCurrentTime(curr);
            const state = ytPlayerRef.current.getPlayerState?.();
            if (state !== 1) {
              ytPlayerRef.current.playVideo?.();
            }
          } catch {}
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', persistPositionNow);
    window.addEventListener('beforeunload', persistPositionNow);
    return () => {
      if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', persistPositionNow);
      window.removeEventListener('beforeunload', persistPositionNow);
    };
  }, [ensureBackgroundAudioAlive, triggerBackgroundResumeRetries]);

  const playTrackRef = useRef<(track: Track, newQueue?: Track[]) => void>(() => {});
  const nextTrackRef = useRef<() => void>(() => {});

  // Initialize Direct HTML5 Audio element (for TikTok Song audio streams)
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.volume = Math.min(1, Math.max(0, (settingsRef.current.volume ?? 80) / 100));
    directAudioRef.current = audio;

    const onLoadedMetadata = () => {
      if (!isTikTokTrack(currentTrackRef.current)) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        if (pendingSeekAfterLoadRef.current > 1) {
          const target = Math.min(pendingSeekAfterLoadRef.current, Math.max(0, audio.duration - 0.5));
          pendingSeekAfterLoadRef.current = 0;
          try {
            audio.currentTime = target;
            setCurrentTime(target);
          } catch {}
        }
      }
    };

    const onCanPlay = () => {
      if (!isTikTokTrack(currentTrackRef.current)) return;
      clearTikTokLoadTimer();
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      if (!isTikTokTrack(currentTrackRef.current)) return;
      const curr = audio.currentTime || 0;
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : currentTrackRef.current?.duration || 30;
      setCurrentTime(curr);
      if (dur > 0 && Math.abs(dur - durationRef.current) > 0.5) {
        setDuration(dur);
      }

      const now = Date.now();
      if (now - lastTimeSaveRef.current > 4000 && curr > 0) {
        lastTimeSaveRef.current = now;
        StorageService.saveLastTime(curr);
      }
      if (
        now - lastMediaSessionSyncRef.current > 1000 &&
        dur > 0 &&
        'mediaSession' in navigator &&
        'setPositionState' in navigator.mediaSession
      ) {
        lastMediaSessionSyncRef.current = now;
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(dur, 1),
            playbackRate: 1,
            position: Math.min(Math.max(curr, 0), dur),
          });
        } catch {}
      }
    };

    const onPlay = () => {
      if (!isTikTokTrack(currentTrackRef.current)) return;
      clearTikTokLoadTimer();
      clearBgResumeTimers();
      tiktokRetryAttemptRef.current = 0;
      setIsPlaying(true);
      setIsLoading(false);
    };

    const onPause = () => {
      if (!isTikTokTrack(currentTrackRef.current)) return;
      if (shouldBePlayingRef.current && !userPausedRef.current && !audio.ended) {
        ensureBackgroundAudioAlive(true);
        if (!audio.error && audio.readyState >= 2) {
          triggerBackgroundResumeRetries();
        }
        return;
      }
      clearTikTokLoadTimer();
      setIsPlaying(false);
      setIsLoading(false);
    };

    const onWaiting = () => {
      if (!isTikTokTrack(currentTrackRef.current)) return;
      if (shouldBePlayingRef.current && !userPausedRef.current) {
        setIsLoading(true);
      }
    };

    const onEnded = () => {
      if (!isTikTokTrack(currentTrackRef.current)) return;
      clearTikTokLoadTimer();
      setIsPlaying(false);
      setIsLoading(false);
      StorageService.saveLastTime(0);
      if (repeatRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        setIsPlaying(true);
      } else if (settingsRef.current.autoPlayNext !== false) {
        nextTrackRef.current();
      } else {
        shouldBePlayingRef.current = false;
      }
    };

    const onError = () => {
      if (!isTikTokTrack(currentTrackRef.current)) return;
      if (!audio.getAttribute('src')) return;
      clearTikTokLoadTimer();

      if (
        shouldBePlayingRef.current &&
        !userPausedRef.current &&
        tiktokRetryAttemptRef.current === 0 &&
        currentTrackRef.current
      ) {
        tiktokRetryAttemptRef.current = 1;
        startTikTokAudioRef.current(currentTrackRef.current, {
          startTime: pendingSeekAfterLoadRef.current || currentTimeRef.current,
          forceRefresh: true,
        });
        return;
      }

      setIsLoading(false);
      setIsPlaying(false);
      shouldBePlayingRef.current = false;
      setErrorMessage('Impossible de lire le son de cette vidéo TikTok.');
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onLoadedMetadata);
    audio.addEventListener('loadeddata', onCanPlay);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('canplaythrough', onCanPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('playing', onPlay);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      clearTikTokLoadTimer();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onLoadedMetadata);
      audio.removeEventListener('loadeddata', onCanPlay);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('canplaythrough', onCanPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('playing', onPlay);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.removeAttribute('src');
    };
  }, [clearBgResumeTimers, clearTikTokLoadTimer, ensureBackgroundAudioAlive, triggerBackgroundResumeRetries]);

  // Initialize YouTube Iframe Player
  useEffect(() => {
    const initPlayer = () => {
      if (!window.YT || !window.YT.Player || ytPlayerRef.current) return;

      const playerContainer = document.getElementById('youtube-player-hidden');
      if (!playerContainer) return;

      const savedPos = StorageService.getLastTime();
      const initialIsTikTok = isTikTokTrack(currentTrackRef.current);

      try {
        ytPlayerRef.current = new window.YT.Player('youtube-player-hidden', {
          height: '200',
          width: '200',
          videoId:
            currentTrackRef.current && !initialIsTikTok
              ? currentTrackRef.current.id
              : 'smY18_bE9d8',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            start: !initialIsTikTok && savedPos > 3 ? Math.floor(savedPos) : undefined,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              isYtReadyRef.current = true;
              event.target.setVolume(settingsRef.current.volume);
              if (!initialIsTikTok && savedPos > 3 && currentTrackRef.current) {
                try {
                  event.target.seekTo(savedPos, true);
                  event.target.pauseVideo();
                } catch {}
              }
            },
            onStateChange: (event: any) => {
              // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
              if (event.data === 1) {
                bufferingSinceRef.current = null;
                userPausedRef.current = false;
                clearBgResumeTimers();
                setIsPlaying(true);
                setIsLoading(false);
                startProgressPolling();
              } else if (event.data === 2) {
                if (shouldBePlayingRef.current && !userPausedRef.current) {
                  // Auto-paused by Android/WebView when screen turned off or app minimized -> recover immediately
                  ensureBackgroundAudioAlive(true);
                  triggerBackgroundResumeRetries();
                  return;
                }
                setIsPlaying(false);
                setIsLoading(false);
                stopProgressPolling();
              } else if (event.data === 3) {
                setIsLoading(true);
              } else if (event.data === 0) {
                setIsPlaying(false);
                stopProgressPolling();
                StorageService.saveLastTime(0);
                if (repeatRef.current === 'one') {
                  try {
                    ytPlayerRef.current?.seekTo(0, true);
                    ytPlayerRef.current?.playVideo();
                    setIsPlaying(true);
                  } catch {}
                } else if (settingsRef.current.autoPlayNext !== false) {
                  nextTrackRef.current();
                } else {
                  shouldBePlayingRef.current = false;
                }
              }
            },
            onError: (event: any) => {
              console.warn('YouTube Player Error:', event.data);
              setIsLoading(false);
              if (event.data === 101 || event.data === 150) {
                setErrorMessage('Cette vidéo a restreint la lecture intégrée. Passage automatique au morceau suivant.');
              } else {
                setErrorMessage('Lecture YouTube indisponible pour ce titre. Passage au suivant.');
              }
              setTimeout(() => {
                if (shouldBePlayingRef.current) {
                  nextTrackRef.current();
                }
              }, 1600);
            },
          },
        });
      } catch (err) {
        console.error('Failed to create YouTube player:', err);
      }
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }

    return () => {
      stopProgressPolling();
    };
  }, [startProgressPolling, stopProgressPolling]);

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    shouldBePlayingRef.current = true;
    userPausedRef.current = false;
    bufferingSinceRef.current = null;
    tiktokRetryAttemptRef.current = 0;
    clearTikTokLoadTimer();
    ensureBackgroundAudioAlive(true);
    setCurrentTrack(track);
    setCurrentTime(0);
    StorageService.saveLastTime(0);
    StorageService.saveTracksToCache([track]);
    setDuration(track.duration || 200);
    setIsLoading(true);
    setErrorMessage(null);

    // Update listening stats & history
    const updatedCounts = StorageService.incrementPlayCount(track.id);
    setPlayCounts(updatedCounts);

    setHistory((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      return [track, ...filtered];
    });

    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
    } else {
      setQueue((prev) => {
        if (!prev.some((t) => t.id === track.id)) {
          return [track, ...prev];
        }
        return prev;
      });
    }

    if (isTikTokTrack(track)) {
      stopProgressPolling();
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {}
      }

      startTikTokAudio(track, { startTime: 0, forceRefresh: false });
      return;
    }

    // Standard YouTube track: stop TikTok direct audio if active
    if (directAudioRef.current) {
      directAudioRef.current.pause();
      directAudioRef.current.removeAttribute('src');
      directAudioRef.current.load();
    }

    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.loadVideoById({
          videoId: track.id,
          startSeconds: 0,
        });
      } catch (e) {
        console.warn('Error loading video in YT player:', e);
      }
    }
  }, [clearTikTokLoadTimer, ensureBackgroundAudioAlive, startTikTokAudio, stopProgressPolling]);

  playTrackRef.current = playTrack;

  const togglePlayPause = useCallback(() => {
    const track = currentTrackRef.current;
    if (!track) {
      if (queueRef.current.length > 0) {
        playTrack(queueRef.current[0]);
      }
      return;
    }

    if (isTikTokTrack(track) && directAudioRef.current) {
      const audio = directAudioRef.current;
      const isDirectPlaying = !audio.paused && !audio.ended;
      if (isDirectPlaying) {
        shouldBePlayingRef.current = false;
        userPausedRef.current = true;
        clearBgResumeTimers();
        clearTikTokLoadTimer();
        if (audio.currentTime > 0) StorageService.saveLastTime(audio.currentTime);
        audio.pause();
        setIsPlaying(false);
        setIsLoading(false);
        isPlayingRef.current = false;
      } else {
        shouldBePlayingRef.current = true;
        userPausedRef.current = false;
        tiktokRetryAttemptRef.current = 0;
        ensureBackgroundAudioAlive(true);
        const needsFreshLoad =
          !audio.getAttribute('src') ||
          Boolean(audio.error) ||
          audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE ||
          audio.readyState === 0;

        if (needsFreshLoad) {
          startTikTokAudio(track, { startTime: currentTimeRef.current });
        } else {
          setErrorMessage(null);
          audio.play().catch((err: any) => {
            if (err?.name === 'NotAllowedError') {
              shouldBePlayingRef.current = false;
              setIsPlaying(false);
              setIsLoading(false);
              return;
            }
            startTikTokAudio(track, {
              startTime: currentTimeRef.current,
              forceRefresh: true,
            });
          });
        }
      }
      return;
    }

    let currentlyPlaying = isPlayingRef.current;
    if (ytPlayerRef.current && isYtReadyRef.current && typeof ytPlayerRef.current.getPlayerState === 'function') {
      try {
        const state = ytPlayerRef.current.getPlayerState();
        if (state === 1) currentlyPlaying = true;
        else if (state === 2 || state === 5) currentlyPlaying = false;
      } catch {}
    }

    if (currentlyPlaying) {
      shouldBePlayingRef.current = false;
      userPausedRef.current = true;
      clearBgResumeTimers();
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          const curr = ytPlayerRef.current.getCurrentTime?.() || currentTimeRef.current;
          if (curr > 0) StorageService.saveLastTime(curr);
          ytPlayerRef.current.pauseVideo();
        } catch {}
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
      stopProgressPolling();
    } else {
      shouldBePlayingRef.current = true;
      userPausedRef.current = false;
      ensureBackgroundAudioAlive(true);
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          const state = ytPlayerRef.current.getPlayerState?.();
          if (state === -1) {
            ytPlayerRef.current.loadVideoById({ videoId: track.id, startSeconds: currentTimeRef.current || 0 });
          } else {
            ytPlayerRef.current.playVideo();
          }
        } catch {}
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
      startProgressPolling();
    }
  }, [clearBgResumeTimers, ensureBackgroundAudioAlive, playTrack, startProgressPolling, stopProgressPolling]);

  const nextTrack = useCallback(() => {
    const curQueue = queueRef.current;
    if (!curQueue.length) return;

    if (shuffleRef.current && curQueue.length > 1) {
      const remaining = curQueue.filter((t) => t.id !== currentTrackRef.current?.id);
      const randomTrack = remaining[Math.floor(Math.random() * remaining.length)] || curQueue[0];
      playTrack(randomTrack);
      return;
    }

    const currentIndex = curQueue.findIndex((t) => t.id === currentTrackRef.current?.id);
    if (currentIndex === -1 || currentIndex === curQueue.length - 1) {
      if (repeatRef.current === 'all') {
        playTrack(curQueue[0]);
      } else {
        shouldBePlayingRef.current = false;
        setIsPlaying(false);
      }
    } else {
      playTrack(curQueue[currentIndex + 1]);
    }
  }, [playTrack]);

  nextTrackRef.current = nextTrack;

  const seekTo = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    if (isTikTokTrack(currentTrackRef.current) && directAudioRef.current) {
      try {
        if (directAudioRef.current.readyState >= 1) {
          directAudioRef.current.currentTime = Math.max(0, seconds);
        } else {
          pendingSeekAfterLoadRef.current = Math.max(0, seconds);
        }
      } catch {}
      return;
    }
    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.seekTo(seconds, true);
      } catch {}
    }
  }, []);

  const prevTrack = useCallback(() => {
    if (currentTimeRef.current > 3) {
      seekTo(0);
      return;
    }

    const curQueue = queueRef.current;
    if (!curQueue.length) return;

    const currentIndex = curQueue.findIndex((t) => t.id === currentTrackRef.current?.id);
    if (currentIndex > 0) {
      playTrack(curQueue[currentIndex - 1]);
    } else {
      if (repeatRef.current === 'all') {
        playTrack(curQueue[curQueue.length - 1]);
      } else {
        seekTo(0);
      }
    }
  }, [playTrack, seekTo]);

  // Media Session API for background playback & hardware media keys
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: 'HMD Music',
        artwork: [
          { src: currentTrack.thumbnail, sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.thumbnail, sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' },
        ],
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {
      console.warn('MediaSession metadata error:', e);
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        shouldBePlayingRef.current = true;
        userPausedRef.current = false;
        ensureBackgroundAudioAlive(true);
        if (isTikTokTrack(currentTrackRef.current) && directAudioRef.current && currentTrackRef.current) {
          const audio = directAudioRef.current;
          if (
            !audio.getAttribute('src') ||
            audio.error ||
            audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE ||
            audio.readyState === 0
          ) {
            tiktokRetryAttemptRef.current = 0;
            startTikTokAudio(currentTrackRef.current, { startTime: currentTimeRef.current });
          } else {
            audio.play().catch(() => {});
          }
          return;
        }
        if (ytPlayerRef.current && isYtReadyRef.current) {
          try {
            ytPlayerRef.current.playVideo();
          } catch {}
        }
        setIsPlaying(true);
        isPlayingRef.current = true;
        startProgressPolling();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        shouldBePlayingRef.current = false;
        userPausedRef.current = true;
        clearBgResumeTimers();
        clearTikTokLoadTimer();
        if (isTikTokTrack(currentTrackRef.current) && directAudioRef.current) {
          directAudioRef.current.pause();
          setIsPlaying(false);
          setIsLoading(false);
          isPlayingRef.current = false;
          return;
        }
        if (ytPlayerRef.current && isYtReadyRef.current) {
          try {
            ytPlayerRef.current.pauseVideo();
          } catch {}
        }
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopProgressPolling();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        shouldBePlayingRef.current = false;
        userPausedRef.current = true;
        clearBgResumeTimers();
        clearTikTokLoadTimer();
        if (isTikTokTrack(currentTrackRef.current) && directAudioRef.current) {
          directAudioRef.current.pause();
          setIsPlaying(false);
          setIsLoading(false);
          isPlayingRef.current = false;
          return;
        }
        if (ytPlayerRef.current && isYtReadyRef.current) {
          try {
            ytPlayerRef.current.pauseVideo();
          } catch {}
        }
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopProgressPolling();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        seekTo(Math.max(0, currentTimeRef.current - offset));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        seekTo(Math.min(durationRef.current || 300, currentTimeRef.current + offset));
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) seekTo(details.seekTime);
      });
    } catch (e) {
      console.warn('MediaSession handler error:', e);
    }
  }, [clearBgResumeTimers, clearTikTokLoadTimer, ensureBackgroundAudioAlive, prevTrack, nextTrack, seekTo, startProgressPolling, startTikTokAudio, stopProgressPolling]);

  // Custom Keyboard Shortcut for Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const configuredKey = settings.customPauseKey || 'Space';
      const matchByCode = Boolean(e.code && e.code.toLowerCase() === configuredKey.toLowerCase());
      const matchByKey = Boolean(e.key && e.key.toLowerCase() === configuredKey.toLowerCase());
      const matchSpace =
        configuredKey === 'Space' && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');

      if (matchByCode || matchByKey || matchSpace) {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
        }
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.customPauseKey, togglePlayPause]);

  // Synchronize custom pause shortcut with Electron
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.setCustomPauseShortcut) {
      try {
        (window as any).electronAPI.setCustomPauseShortcut(settings.customPauseKey);
      } catch {}
    }
  }, [settings.customPauseKey]);

  // Listen for Electron background media events
  useEffect(() => {
    const handleToggle = () => togglePlayPause();
    const handleNext = () => nextTrack();
    const handlePrev = () => prevTrack();

    window.addEventListener('hmd-toggle-play', handleToggle);
    window.addEventListener('hmd-next-track', handleNext);
    window.addEventListener('hmd-prev-track', handlePrev);

    let unsubPlay: (() => void) | undefined;
    let unsubNext: (() => void) | undefined;
    let unsubPrev: (() => void) | undefined;

    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      unsubPlay = (window as any).electronAPI.onMediaPlayPause?.(handleToggle);
      unsubNext = (window as any).electronAPI.onMediaNext?.(handleNext);
      unsubPrev = (window as any).electronAPI.onMediaPrev?.(handlePrev);
    }

    return () => {
      window.removeEventListener('hmd-toggle-play', handleToggle);
      window.removeEventListener('hmd-next-track', handleNext);
      window.removeEventListener('hmd-prev-track', handlePrev);
      unsubPlay?.();
      unsubNext?.();
      unsubPrev?.();
    };
  }, [togglePlayPause, nextTrack, prevTrack]);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    setIsMuted(vol === 0);
    if (directAudioRef.current) {
      directAudioRef.current.volume = Math.min(1, Math.max(0, vol / 100));
      directAudioRef.current.muted = vol === 0;
    }
    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.setVolume(vol);
        if (vol === 0) ytPlayerRef.current.mute();
        else ytPlayerRef.current.unMute();
      } catch {}
    }
    setSettings((prev) => ({ ...prev, volume: vol }));
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      const targetVol = volume === 0 ? 50 : volume;
      if (directAudioRef.current) {
        directAudioRef.current.muted = false;
        directAudioRef.current.volume = Math.min(1, Math.max(0, targetVol / 100));
      }
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(targetVol);
        } catch {}
      }
    } else {
      setIsMuted(true);
      if (directAudioRef.current) {
        directAudioRef.current.muted = true;
      }
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          ytPlayerRef.current.mute();
        } catch {}
      }
    }
  }, [isMuted, volume]);

  const toggleRepeat = useCallback(() => {
    setRepeat((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => !prev);
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => {
      if (prev.some((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearQueue = useCallback(() => {
    if (currentTrackRef.current) {
      setQueue([currentTrackRef.current]);
    } else {
      setQueue([]);
    }
  }, []);

  const toggleFavorite = useCallback((track: Track) => {
    setFavorites((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      return exists ? prev.filter((t) => t.id !== track.id) : [track, ...prev];
    });
  }, []);

  const isFavorite = useCallback(
    (trackId: string) => favorites.some((t) => t.id === trackId),
    [favorites]
  );

  const createPlaylist = useCallback((title: string, description?: string) => {
    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      title: title.trim() || 'Ma Playlist',
      description: description?.trim() || '',
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setPlaylists((prev) => [newPl, ...prev]);
    return newPl;
  }, []);

  const importPlaylistWithTracks = useCallback(
    (title: string, description: string, tracks: Track[], coverImage?: string) => {
      if (tracks.length > 0) {
        StorageService.saveTracksToCache(tracks);
      }
      const uniqueIds = Array.from(new Set(tracks.map((t) => t.id)));
      const newPl: Playlist = {
        id: `pl-spotify-${Date.now()}`,
        title: title.trim() || 'Playlist Spotify',
        description: description.trim() || 'Importée depuis Spotify',
        coverImage,
        trackIds: uniqueIds,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setPlaylists((prev) => [newPl, ...prev]);
      return newPl;
    },
    []
  );

  const deletePlaylist = useCallback((playlistId: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    setSelectedPlaylistId((curr) => (curr === playlistId ? null : curr));
  }, []);

  const addTrackToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId || pl.trackIds.includes(trackId)) return pl;
        return {
          ...pl,
          trackIds: [...pl.trackIds, trackId],
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        return {
          ...pl,
          trackIds: pl.trackIds.filter((id) => id !== trackId),
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const reorderPlaylistTracks = useCallback((playlistId: string, startIndex: number, endIndex: number) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const copy = [...pl.trackIds];
        const [removed] = copy.splice(startIndex, 1);
        copy.splice(endIndex, 0, removed);
        return { ...pl, trackIds: copy, updatedAt: Date.now() };
      })
    );
  }, []);

  const openPlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setActiveTab('playlist');
  }, []);

  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettings((prev) => {
      const merged: UserSettings = { ...prev, ...newSettings };
      let useSpotify = Boolean(merged.spotifyMode);

      if ('spotifyMode' in newSettings && !('ultraMode' in newSettings)) {
        useSpotify = Boolean(newSettings.spotifyMode);
      } else if ('ultraMode' in newSettings && !('spotifyMode' in newSettings)) {
        useSpotify = !Boolean(newSettings.ultraMode);
      } else if ('spotifyMode' in newSettings && 'ultraMode' in newSettings) {
        useSpotify = Boolean(newSettings.spotifyMode) && !Boolean(newSettings.ultraMode);
      }

      const prevIsSpotify = Boolean(prev.spotifyMode);
      if (prevIsSpotify !== useSpotify) {
        setIsThemeTransitioning(true);
        if (themeTransitionTimerRef.current) {
          clearTimeout(themeTransitionTimerRef.current);
        }
        themeTransitionTimerRef.current = window.setTimeout(() => {
          setIsThemeTransitioning(false);
          themeTransitionTimerRef.current = null;
        }, 320);
      }

      return {
        ...merged,
        theme: 'dark',
        spotifyMode: useSpotify,
        ultraMode: !useSpotify,
      };
    });
  }, []);

  const applyMergedPayloadToState = useCallback((merged: CloudUserSyncPayload) => {
    isApplyingRemoteSyncRef.current = true;
    lastSyncedUpdatedAtRef.current = merged.updatedAt;
    const nextSettings = applySyncDataToLocal(merged);
    setFavorites(merged.favorites);
    setPlaylists(merged.playlists);
    setHistory(merged.history);
    setPlayCounts(merged.playCounts);
    setSettings(nextSettings);

    if (merged.lastTrack && !isPlayingRef.current) {
      setCurrentTrack(merged.lastTrack);
      if (merged.lastTime > 0) {
        setCurrentTime(merged.lastTime);
      }
    }

    window.setTimeout(() => {
      isApplyingRemoteSyncRef.current = false;
    }, 180);
  }, []);

  const performSyncWithCloud = useCallback(
    async (
      uid: string,
      username: string | null,
      displayName: string | null,
      preferCloudOnFreshDevice = false
    ) => {
      setSyncStatus('syncing');
      setSyncError(null);
      try {
        const localPayload = collectLocalSyncData(uid, username, displayName);
        const cloudData = await readCloudUserData(uid);
        const merged = mergeUserSyncData(localPayload, cloudData, {
          preferCloudOnFreshDevice,
        });
        applyMergedPayloadToState(merged);
        await writeCloudUserData(uid, merged);
        setLastSyncedAt(Date.now());
        setSyncStatus('synced');
      } catch (err: any) {
        const message = formatFirebaseAuthError(err);
        setSyncError(message);
        setSyncStatus('error');
        throw err;
      }
    },
    [applyMergedPayloadToState]
  );

  const scheduleCloudPush = useCallback(() => {
    const activeUser = authUserRef.current;
    if (!activeUser || isApplyingRemoteSyncRef.current) return;

    if (cloudPushTimerRef.current) {
      clearTimeout(cloudPushTimerRef.current);
    }

    cloudPushTimerRef.current = window.setTimeout(async () => {
      cloudPushTimerRef.current = null;
      const currUser = authUserRef.current;
      if (!currUser || isApplyingRemoteSyncRef.current) return;
      try {
        setSyncStatus('syncing');
        const payload = collectLocalSyncData(
          currUser.uid,
          currUser.username,
          currUser.displayName
        );
        lastSyncedUpdatedAtRef.current = payload.updatedAt;
        await writeCloudUserData(currUser.uid, payload);
        setLastSyncedAt(Date.now());
        setSyncStatus('synced');
        setSyncError(null);
      } catch (err: any) {
        setSyncError(formatFirebaseAuthError(err));
        setSyncStatus('error');
      }
    }, 1400);
  }, []);

  // Listen to Firebase Auth state (100% optional: never blocks or prompts on startup)
  useEffect(() => {
    let remoteUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (remoteUnsub) {
        remoteUnsub();
        remoteUnsub = null;
      }

      if (!firebaseUser) {
        setAuthUser(null);
        setIsAuthReady(true);
        setSyncStatus('idle');
        return;
      }

      const resolvedUsername = getDisplayUsername(firebaseUser);
      const summary: AuthUserSummary = {
        uid: firebaseUser.uid,
        username: resolvedUsername,
        displayName: firebaseUser.displayName || resolvedUsername,
      };
      setAuthUser(summary);
      setIsAuthReady(true);

      if (!manualAuthActionRef.current) {
        void performSyncWithCloud(
          summary.uid,
          summary.username,
          summary.displayName,
          true
        ).catch(() => {});
      }

      remoteUnsub = subscribeCloudUserData(summary.uid, (remoteData) => {
        const remoteUpdatedAt = Number(remoteData.updatedAt) || 0;
        if (remoteUpdatedAt <= lastSyncedUpdatedAtRef.current) return;
        const localPayload = collectLocalSyncData(
          summary.uid,
          summary.username,
          summary.displayName
        );
        const merged = mergeUserSyncData(localPayload, remoteData, {
          preferCloudOnFreshDevice: true,
        });
        applyMergedPayloadToState(merged);
        setLastSyncedAt(Date.now());
        setSyncStatus('synced');
      });
    });

    return () => {
      authUnsub();
      remoteUnsub?.();
    };
  }, [performSyncWithCloud, applyMergedPayloadToState]);

  // Auto-push local listening activity to Firebase when signed in
  useEffect(() => {
    if (!authUser) return;
    scheduleCloudPush();
  }, [authUser, favorites, playlists, history, playCounts, settings, currentTrack, scheduleCloudPush]);

  // Also sync immediately when a TikTok Song is added or removed
  useEffect(() => {
    if (!authUser) return;
    const handleTikTokUpdated = () => {
      if (!isApplyingRemoteSyncRef.current) {
        scheduleCloudPush();
      }
    };
    window.addEventListener('hmd-tiktok-songs-updated', handleTikTokUpdated);
    return () => {
      window.removeEventListener('hmd-tiktok-songs-updated', handleTikTokUpdated);
    };
  }, [authUser, scheduleCloudPush]);

  const signUpWithUsername = useCallback(
    async (username: string, password: string) => {
      manualAuthActionRef.current = true;
      setSyncError(null);
      setSyncStatus('syncing');
      try {
        const trimmedUsername = username.trim();
        const syntheticEmail = usernameToAuthEmail(trimmedUsername);
        const cred = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
        if (trimmedUsername) {
          await updateProfile(cred.user, { displayName: trimmedUsername }).catch(() => {});
        }
        const resolvedUsername = trimmedUsername || getDisplayUsername(cred.user);
        const summary: AuthUserSummary = {
          uid: cred.user.uid,
          username: resolvedUsername,
          displayName: resolvedUsername,
        };
        setAuthUser(summary);
        // Preserve & upload all local listens already recorded before account creation
        await performSyncWithCloud(summary.uid, summary.username, summary.displayName, false);
      } catch (err: any) {
        const msg = formatFirebaseAuthError(err);
        setSyncError(msg);
        setSyncStatus('error');
        throw new Error(msg);
      } finally {
        window.setTimeout(() => {
          manualAuthActionRef.current = false;
        }, 450);
      }
    },
    [performSyncWithCloud]
  );

  const signInWithUsername = useCallback(
    async (username: string, password: string) => {
      manualAuthActionRef.current = true;
      setSyncError(null);
      setSyncStatus('syncing');
      try {
        const trimmedUsername = username.trim();
        const syntheticEmail = usernameToAuthEmail(trimmedUsername);
        const cred = await signInWithEmailAndPassword(auth, syntheticEmail, password);
        const resolvedUsername = cred.user.displayName || trimmedUsername || getDisplayUsername(cred.user);
        const summary: AuthUserSummary = {
          uid: cred.user.uid,
          username: resolvedUsername,
          displayName: resolvedUsername,
        };
        setAuthUser(summary);
        // Merge existing local listens with cloud account data
        await performSyncWithCloud(summary.uid, summary.username, summary.displayName, true);
      } catch (err: any) {
        const msg = formatFirebaseAuthError(err);
        setSyncError(msg);
        setSyncStatus('error');
        throw new Error(msg);
      } finally {
        window.setTimeout(() => {
          manualAuthActionRef.current = false;
        }, 450);
      }
    },
    [performSyncWithCloud]
  );

  const signOutAccount = useCallback(async () => {
    if (cloudPushTimerRef.current) {
      clearTimeout(cloudPushTimerRef.current);
      cloudPushTimerRef.current = null;
    }
    await signOut(auth);
    setAuthUser(null);
    setSyncStatus('idle');
    setSyncError(null);
  }, []);

  const syncNow = useCallback(async () => {
    const currUser = authUserRef.current;
    if (!currUser) return;
    await performSyncWithCloud(currUser.uid, currUser.username, currUser.displayName, false);
  }, [performSyncWithCloud]);

  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  const openAddToPlaylistModal = useCallback((track: Track) => {
    setPlaylistTrackToAdd(track);
    setIsPlaylistModalOpen(true);
  }, []);

  const closeAddToPlaylistModal = useCallback(() => {
    setIsPlaylistModalOpen(false);
    setPlaylistTrackToAdd(null);
  }, []);

  const openFullscreenWithLyrics = useCallback(() => {
    setIsLyricsOpen(true);
    setIsFullscreenPlayerOpen(true);
  }, []);

  const removeFromHistory = useCallback((trackId: string) => {
    setHistory((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setPlayCounts({});
    StorageService.saveHistory([]);
  }, []);

  const clearErrorMessage = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const timeContextValue = useMemo(
    () => ({ currentTime, duration }),
    [currentTime, duration]
  );

  const playerContextValue = useMemo<PlayerContextType>(
    () => ({
      currentTrack,
      isPlaying,
      isLoading,
      currentTime: currentTimeRef.current,
      duration: durationRef.current,
      volume,
      isMuted,
      repeat,
      shuffle,
      queue,
      history,
      favorites,
      playlists,
      playCounts,
      activeTab,
      selectedPlaylistId,
      settings,
      isFullscreenPlayerOpen,
      isLyricsOpen,
      isQueueOpen,
      isPlaylistModalOpen,
      isDesktopModalOpen,
      isSpotifyModalOpen,
      playlistTrackToAdd,
      errorMessage,
      isThemeTransitioning,
      authUser,
      isAuthReady,
      syncStatus,
      lastSyncedAt,
      syncError,
      playTrack,
      togglePlayPause,
      nextTrack,
      prevTrack,
      seekTo,
      setVolume,
      toggleMute,
      toggleRepeat,
      toggleShuffle,
      addToQueue,
      removeFromQueue,
      clearQueue,
      toggleFavorite,
      isFavorite,
      createPlaylist,
      importPlaylistWithTracks,
      deletePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      reorderPlaylistTracks,
      setActiveTab,
      openPlaylist,
      updateSettings,
      setIsFullscreenPlayerOpen,
      setIsLyricsOpen,
      openFullscreenWithLyrics,
      setIsQueueOpen,
      setIsDesktopModalOpen,
      setIsSpotifyModalOpen,
      openAddToPlaylistModal,
      closeAddToPlaylistModal,
      removeFromHistory,
      clearHistory,
      clearErrorMessage,
      signUpWithUsername,
      signInWithUsername,
      signOutAccount,
      syncNow,
      clearSyncError,
    }),
    [
      currentTrack,
      isPlaying,
      isLoading,
      volume,
      isMuted,
      repeat,
      shuffle,
      queue,
      history,
      favorites,
      playlists,
      playCounts,
      activeTab,
      selectedPlaylistId,
      settings,
      isFullscreenPlayerOpen,
      isLyricsOpen,
      isQueueOpen,
      isPlaylistModalOpen,
      isDesktopModalOpen,
      isSpotifyModalOpen,
      playlistTrackToAdd,
      errorMessage,
      isThemeTransitioning,
      authUser,
      isAuthReady,
      syncStatus,
      lastSyncedAt,
      syncError,
      playTrack,
      togglePlayPause,
      nextTrack,
      prevTrack,
      seekTo,
      setVolume,
      toggleMute,
      toggleRepeat,
      toggleShuffle,
      addToQueue,
      removeFromQueue,
      clearQueue,
      toggleFavorite,
      isFavorite,
      createPlaylist,
      importPlaylistWithTracks,
      deletePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      reorderPlaylistTracks,
      openPlaylist,
      updateSettings,
      openFullscreenWithLyrics,
      openAddToPlaylistModal,
      closeAddToPlaylistModal,
      removeFromHistory,
      clearHistory,
      clearErrorMessage,
      signUpWithUsername,
      signInWithUsername,
      signOutAccount,
      syncNow,
      clearSyncError,
    ]
  );

  return (
    <PlayerContext.Provider value={playerContextValue}>
      <PlaybackTimeContext.Provider value={timeContextValue}>
        {children}
        {/* Background-safe official YouTube Player iframe container (not z-[-1] or near-0 opacity so Chromium won't occlude-throttle it) */}
        <div
          id="youtube-player-container"
          className="fixed bottom-0 right-0 w-[200px] h-[200px] pointer-events-none opacity-[0.01] z-0 overflow-hidden select-none"
          aria-hidden="true"
        >
          <div id="youtube-player-hidden"></div>
        </div>
      </PlaybackTimeContext.Provider>
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
