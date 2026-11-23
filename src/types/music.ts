export interface Track {
  id: string; // YouTube Video ID or TikTok track ID
  title: string;
  artist: string;
  duration: number; // in seconds
  durationFormatted: string;
  thumbnail: string;
  album?: string;
  category?: string;
  views?: string;
  sourceType?: 'youtube' | 'tiktok';
  audioUrl?: string;
  sourceUrl?: string;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';
export type ThemeMode = 'dark' | 'light' | 'auto';
export type GlassBlurIntensity = 'low' | 'medium' | 'high';

export interface UserSettings {
  youtubeApiKey: string;
  theme: ThemeMode;
  volume: number;
  glassBlurIntensity: GlassBlurIntensity;
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

export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsResult {
  trackId: string;
  matchedTitle: string;
  matchedArtist: string;
  matchedAlbum?: string;
  synced: boolean;
  lines: LyricLine[];
  plainLines: string[];
  instrumental: boolean;
  source?: 'lrclib' | 'groq';
  verified?: boolean;
  uncertain?: boolean;
  incomplete?: boolean;
  fileHash?: string;
}

export type LyricsErrorType =
  | 'not_found'
  | 'instrumental'
  | 'network'
  | 'rate_limit'
  | 'invalid_response'
  | 'groq_error'
  | 'audio_inaccessible'
  | 'transcription_incomplete';

export interface LyricsFetchOutcome {
  status: 'found' | 'instrumental' | 'not_found' | 'error';
  lyrics: LyricsResult | null;
  errorType?: LyricsErrorType;
  errorMessage?: string;
  fromCache?: boolean;
}

export interface TasteProfile {
  hasEnoughData: boolean;
  totalListens: number;
  progressCount: number;
  requiredCount: number;
  topGenres: string[];
  topArtists: string[];
  summaryLabel: string;
}

export interface SpotifyTrackPreview {
  title: string;
  artist: string;
  durationSec: number;
}

export interface SpotifyPlaylistPreview {
  id: string;
  kind: 'playlist' | 'album';
  title: string;
  coverImage?: string;
  tracks: SpotifyTrackPreview[];
  totalCount: number;
}

export interface PlayerState {
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
  isFullscreenPlayerOpen: boolean;
  isQueueOpen: boolean;
}

export type ActiveTab = 'home' | 'search' | 'tiktok' | 'library' | 'playlist' | 'settings';
