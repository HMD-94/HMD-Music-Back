import React, { useState } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Plus,
  Volume2,
  VolumeX,
  ListOrdered,
  Activity,
  LayoutTemplate,
} from 'lucide-react';
import { usePlaybackTime, usePlayer } from '../../context/PlayerContext';
import { formatTime } from '../../services/youtube';
import { VisualizerWave } from '../music/VisualizerWave';
import { FullscreenEdgeVisualizer } from './FullscreenEdgeVisualizer';

// Clean monochrome waveform matching the horizontal player card aesthetic
const CompactWaveform: React.FC<{ isPlaying: boolean; progressPercent: number }> = ({
  isPlaying,
  progressPercent,
}) => {
  const heights = [
    22, 42, 68, 35, 85, 55, 92, 40, 74, 60, 30, 88, 52, 95, 45, 70, 38, 82, 50, 64, 90, 44, 72, 34,
    60, 80, 48, 66, 36, 54, 76, 42,
  ];

  return (
    <div className="flex items-end justify-between gap-[2px] h-5 w-full select-none" aria-hidden="true">
      {heights.map((h, i) => {
        const barPercent = (i / (heights.length - 1)) * 100;
        const isPassed = barPercent <= progressPercent;
        const delay = `${((i % 7) * 0.11).toFixed(2)}s`;
        const duration = `${(0.75 + (i % 4) * 0.18).toFixed(2)}s`;

        return (
          <span
            key={i}
            className={`flex-1 rounded-full transition-colors duration-200 ${
              isPassed ? 'bg-white/90' : 'bg-white/25'
            } ${isPlaying ? 'animate-liquid-bar' : ''}`}
            style={{
              height: `${h}%`,
              animationDelay: isPlaying ? delay : undefined,
              animationDuration: isPlaying ? duration : undefined,
              transformOrigin: 'bottom',
            }}
          />
        );
      })}
    </div>
  );
};

export const FullscreenPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    repeat,
    shuffle,
    queue,
    settings,
    updateSettings,
    isFullscreenPlayerOpen,
    setIsFullscreenPlayerOpen,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    isFavorite,
    toggleFavorite,
    openAddToPlaylistModal,
    playTrack,
  } = usePlayer();

  const { currentTime, duration } = usePlaybackTime();
  const [activeView, setActiveView] = useState<'cover' | 'queue'>('cover');

  if (!isFullscreenPlayerOpen || !currentTrack) return null;

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const favored = isFavorite(currentTrack.id);
  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;
  const useUltraCard = isUltra && !settings.ultraClassicFullscreen;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(parseFloat(e.target.value));
  };

  // CLASSIC SPOTIFY FULLSCREEN PLAYER (Zero GPU blur, crisp #121212, #1DB954 accents)
  if (isSpotify) {
    return (
      <div
        id="fullscreen-player-modal"
        className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#23262d] via-[#141414] to-[#0a0a0a] text-white select-none overflow-y-auto"
      >
        {/* Minimal Spotify Top Bar */}
        <header className="w-full max-w-5xl mx-auto px-5 sm:px-8 pt-5 pb-2 flex items-center justify-between">
          <button
            onClick={() => setIsFullscreenPlayerOpen(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 text-[#B3B3B3] hover:text-white transition-colors cursor-pointer"
            title="Réduire le lecteur"
          >
            <ChevronDown className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.08] text-xs font-bold">
            <button
              onClick={() => setActiveView('cover')}
              className={`px-4 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                activeView === 'cover' ? 'bg-white text-black' : 'text-[#B3B3B3] hover:text-white'
              }`}
            >
              Lecture
            </button>
            <button
              onClick={() => setActiveView('queue')}
              className={`px-4 py-1.5 rounded-full transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeView === 'queue' ? 'bg-white text-black' : 'text-[#B3B3B3] hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span className="tabular-nums">File ({queue.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openAddToPlaylistModal(currentTrack)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 text-[#B3B3B3] hover:text-white transition-colors cursor-pointer"
              title="Ajouter à une playlist"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 py-4 flex flex-col items-center justify-center">
          {activeView === 'cover' ? (
            <div className="w-full max-w-md mx-auto flex flex-col items-center">
              <div className="w-full max-w-md mx-auto flex flex-col">
                {/* Large Crisp Square Album Art */}
                <div className="w-64 h-64 sm:w-80 sm:h-80 mx-auto rounded-lg overflow-hidden bg-[#181818] shadow-2xl">
                  <img
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`;
                    }}
                  />
                </div>

                {/* Title, Artist & Favorite Heart */}
                <div className="w-full mt-7 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display font-bold text-xl sm:text-2xl text-white truncate">
                      {currentTrack.title}
                    </h2>
                    <p className="text-sm text-[#B3B3B3] truncate mt-0.5">{currentTrack.artist}</p>
                  </div>

                  <button
                    onClick={() => toggleFavorite(currentTrack)}
                    className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                      favored ? 'text-[#1DB954]' : 'text-[#B3B3B3] hover:text-white'
                    }`}
                    title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <Heart className={`w-6 h-6 ${favored ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Classic Spotify Scrubber */}
                <div className="w-full mt-5 space-y-1.5">
                  <input
                    type="range"
                    min={0}
                    max={duration || 200}
                    step={0.5}
                    value={currentTime}
                    onChange={handleSeekChange}
                    className="spotify-range w-full h-1.5 rounded-full"
                    style={{
                      background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, #535353 ${progressPercent}%, #535353 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs font-mono tabular-nums text-[#B3B3B3]">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Classic Controls Row */}
                <div className="w-full mt-5 flex items-center justify-between">
                  <button
                    onClick={toggleShuffle}
                    className={`relative p-2.5 transition-colors cursor-pointer ${
                      shuffle ? 'text-[#1DB954]' : 'text-[#B3B3B3] hover:text-white'
                    }`}
                    title="Lecture aléatoire"
                  >
                    <Shuffle className="w-5 h-5" />
                    {shuffle && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1DB954]" />
                    )}
                  </button>

                  <button
                    onClick={prevTrack}
                    className="p-2.5 text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    title="Précédent"
                  >
                    <SkipBack className="w-7 h-7 fill-current" />
                  </button>

                  <button
                    onClick={togglePlayPause}
                    className="w-16 h-16 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-xl transition-transform cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Lecture'}
                  >
                    {isPlaying ? (
                      <Pause className="w-7 h-7 fill-current" />
                    ) : (
                      <Play className="w-7 h-7 fill-current ml-1" />
                    )}
                  </button>

                  <button
                    onClick={nextTrack}
                    className="p-2.5 text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    title="Suivant"
                  >
                    <SkipForward className="w-7 h-7 fill-current" />
                  </button>

                  <button
                    onClick={toggleRepeat}
                    className={`relative p-2.5 transition-colors cursor-pointer ${
                      repeat !== 'off' ? 'text-[#1DB954]' : 'text-[#B3B3B3] hover:text-white'
                    }`}
                    title={`Répétition: ${repeat}`}
                  >
                    {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                    {repeat !== 'off' && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1DB954]" />
                    )}
                  </button>
                </div>

                {/* Clean Volume Row */}
                <div className="w-full mt-7 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#181818] border border-white/[0.06]">
                  <button onClick={toggleMute} className="text-[#B3B3B3] hover:text-white cursor-pointer">
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                    className="spotify-range flex-1 h-1 rounded-full"
                    style={{
                      background: `linear-gradient(to right, #1DB954 0%, #1DB954 ${
                        isMuted ? 0 : volume
                      }%, #535353 ${isMuted ? 0 : volume}%, #535353 100%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-xl h-[480px] flex flex-col rounded-xl bg-[#181818] p-5 border border-white/[0.07]">
              <h3 className="font-display font-bold text-sm mb-4 flex items-center gap-2 text-white">
                <ListOrdered className="w-4 h-4 text-[#1DB954]" />
                <span>File d'attente · {queue.length} titres</span>
              </h3>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {queue.map((track, i) => {
                  const isCurrent = currentTrack.id === track.id;
                  return (
                    <div
                      key={`${track.id}-${i}`}
                      onClick={() => playTrack(track)}
                      className={`flex items-center gap-3 p-2.5 rounded-md transition-colors cursor-pointer ${
                        isCurrent ? 'bg-[#282828]' : 'hover:bg-white/[0.07]'
                      }`}
                    >
                      <span
                        className={`text-xs font-mono tabular-nums w-5 text-center ${
                          isCurrent ? 'text-[#1DB954] font-bold' : 'text-[#B3B3B3]'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-10 h-10 rounded object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-medium text-sm truncate ${
                            isCurrent ? 'text-[#1DB954]' : 'text-white'
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-xs text-[#B3B3B3] truncate">{track.artist}</p>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-[#B3B3B3]">
                        {track.durationFormatted}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ULTRA MODE NOW-PLAYING VIEW (Image 2 floating horizontal card + Image 1 right-side synced lyrics)
  if (useUltraCard) {
    return (
      <div
        id="fullscreen-player-modal"
        className="fixed inset-0 z-50 flex flex-col bg-[#060608] text-white select-none overflow-y-auto animate-in fade-in duration-200"
      >
        {/* Subtle atmospheric album-art backdrop (pure photography blur, zero neon slop) */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <img
            src={currentTrack.thumbnail}
            alt=""
            className="w-full h-full object-cover scale-110 blur-2xl opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/65 to-black/90" />
        </div>

        {/* Minimal Top Header */}
        <header className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-5 pb-2 flex items-center justify-between">
          <button
            onClick={() => setIsFullscreenPlayerOpen(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Réduire le lecteur"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            {/* Compact view switcher: Player / Queue */}
            <div className="flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs font-medium">
              <button
                onClick={() => setActiveView('cover')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeView === 'cover'
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Lecteur
              </button>
              <button
                onClick={() => setActiveView('queue')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeView === 'queue'
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span className="tabular-nums">File ({queue.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => updateSettings({ ultraClassicFullscreen: true })}
              className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white/80 hover:text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              title="Passer au style grand écran classique"
            >
              <LayoutTemplate className="w-4 h-4" />
              <span className="hidden sm:inline">Style classique</span>
            </button>

            <button
              onClick={() => openAddToPlaylistModal(currentTrack)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Ajouter à une playlist"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Centered Stage */}
        <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col items-center justify-center">
          {activeView === 'cover' ? (
            <div className="w-full max-w-[580px] mx-auto flex flex-col items-center transition-all duration-300 ease-out">
              {/* Floating Translucent Horizontal Glass Player Card */}
              <div className="w-full flex flex-col gap-4">
                <div className="w-full rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.14] shadow-[0_28px_70px_rgba(0,0,0,0.65)] p-4 sm:p-5">
                  <div className="flex items-center gap-4 sm:gap-5">
                    {/* Left: Square Album Art */}
                    <div className="relative w-28 h-28 sm:w-40 sm:h-40 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 shadow-2xl border border-white/10">
                      <img
                        src={currentTrack.thumbnail}
                        alt={currentTrack.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            currentTrack.sourceType === 'tiktok'
                              ? '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png'
                              : `https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`;
                        }}
                      />
                    </div>

                    {/* Right: Metadata + Waveform/Progress + Controls */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between h-28 sm:h-40 py-0.5">
                      {/* Top Row: Title/Artist */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <h2
                            className="font-display font-semibold text-sm sm:text-base text-white truncate tracking-tight"
                            title={currentTrack.title}
                          >
                            {currentTrack.title}
                          </h2>
                          <p
                            className="text-xs text-white/60 truncate mt-0.5"
                            title={currentTrack.artist}
                          >
                            {currentTrack.artist}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Compact Audio Waveform + Progress Scrubber + Timestamps */}
                      <div className="space-y-1.5 my-auto pt-1">
                        <CompactWaveform isPlaying={isPlaying} progressPercent={progressPercent} />

                        <div className="relative flex items-center">
                          <input
                            type="range"
                            min={0}
                            max={duration || 200}
                            step={0.5}
                            value={currentTime}
                            onChange={handleSeekChange}
                            aria-label="Position de lecture"
                            className="ultra-range w-full h-1 rounded-full cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%, rgba(255,255,255,0.2) 100%)`,
                            }}
                          />
                        </div>

                        <div className="flex justify-between text-[10px] font-mono tabular-nums text-white/55">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>

                      {/* Bottom Row: Minimal Controls (Heart, Prev, Play/Pause, Next, Repeat) */}
                      <div className="flex items-center justify-between pt-0.5">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(currentTrack)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            favored ? 'text-rose-400' : 'text-white/60 hover:text-white'
                          }`}
                          title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        >
                          <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={prevTrack}
                          className="p-1.5 rounded-lg text-white/80 hover:text-white active:scale-95 transition-all cursor-pointer"
                          title="Précédent"
                        >
                          <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                        </button>

                        <button
                          type="button"
                          onClick={togglePlayPause}
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-white/90 active:scale-95 text-zinc-950 flex items-center justify-center shadow-lg transition-all cursor-pointer"
                          title={isPlaying ? 'Pause' : 'Lecture'}
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current ml-0.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={nextTrack}
                          className="p-1.5 rounded-lg text-white/80 hover:text-white active:scale-95 transition-all cursor-pointer"
                          title="Suivant"
                        >
                          <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                        </button>

                        <button
                          type="button"
                          onClick={toggleRepeat}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            repeat !== 'off' ? 'text-white' : 'text-white/50 hover:text-white'
                          }`}
                          title={`Répétition: ${repeat}`}
                        >
                          {repeat === 'one' ? (
                            <Repeat1 className="w-4 h-4" />
                          ) : (
                            <Repeat className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subtle Volume Bar below card (non-intrusive) */}
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-white/55 hover:text-white transition-colors cursor-pointer"
                    title={isMuted ? 'Rétablir le son' : 'Couper le son'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                    aria-label="Volume"
                    className="ultra-range flex-1 h-1 rounded-full cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.85) ${
                        isMuted ? 0 : volume
                      }%, rgba(255,255,255,0.15) ${isMuted ? 0 : volume}%, rgba(255,255,255,0.15) 100%)`,
                    }}
                  />
                  <button
                    type="button"
                    onClick={toggleShuffle}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      shuffle ? 'text-white' : 'text-white/40 hover:text-white/80'
                    }`}
                    title="Lecture aléatoire"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Clean Queue View in Ultra Mode */
            <div className="w-full max-w-xl h-[480px] flex flex-col rounded-2xl bg-white/[0.06] backdrop-blur-2xl p-5 border border-white/[0.12]">
              <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2 text-white">
                <ListOrdered className="w-4 h-4 text-white/70" />
                <span>File d'attente · {queue.length} titres</span>
              </h3>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {queue.map((track, i) => {
                  const isCurrent = currentTrack.id === track.id;
                  return (
                    <div
                      key={`${track.id}-${i}`}
                      onClick={() => playTrack(track)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-white/[0.12] text-white'
                          : 'hover:bg-white/[0.06] text-white/75'
                      }`}
                    >
                      <span className="text-xs font-mono tabular-nums text-white/40 w-5 text-center">
                        {i + 1}
                      </span>
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-10 h-10 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate text-white">{track.title}</p>
                        <p className="text-xs text-white/50 truncate">{track.artist}</p>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-white/45">
                        {track.durationFormatted}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // STANDARD MODE FULLSCREEN PLAYER (also supports the new Lyrics button!)
  return (
    <div
      id="fullscreen-player-modal"
      className="fixed inset-0 z-50 flex flex-col bg-[#090d16]/95 backdrop-blur-xl text-slate-100 p-6 md:p-10 select-none overflow-y-auto animate-in slide-in-from-bottom duration-300"
    >
      {/* Dynamic Ambient Fluid Light Orb behind the player */}
      <div
        className="hidden sm:block absolute -top-20 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-gradient-to-b from-indigo-600/30 via-cyan-500/20 to-transparent blur-2xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Side Edge Rhythm Audio Visualizer (Standard mode only — disabled in Mode Ultra to prevent lag) */}
      {!isUltra && settings.fullscreenEdgeVisualizer !== false && (
        <FullscreenEdgeVisualizer isPlaying={isPlaying} />
      )}

      {/* Top Bar: Minimize / Tabs / Actions */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between">
        <button
          onClick={() => setIsFullscreenPlayerOpen(false)}
          className="p-3 rounded-2xl liquid-glass text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="Réduire le lecteur"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* View switcher: Morceau / File d'attente */}
        <div className="flex items-center p-1 rounded-2xl liquid-glass border border-white/10 text-xs font-semibold">
          <button
            onClick={() => setActiveView('cover')}
            className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeView === 'cover'
                ? 'bg-indigo-600/40 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Morceau
          </button>
          <button
            onClick={() => setActiveView('queue')}
            className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'queue'
                ? 'bg-indigo-600/40 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>File ({queue.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isUltra ? (
            <button
              type="button"
              onClick={() => updateSettings({ ultraClassicFullscreen: false })}
              className="px-3 py-2.5 rounded-2xl liquid-glass text-slate-200 hover:text-white transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap"
              title="Revenir au lecteur carte Ultra"
            >
              <LayoutTemplate className="w-4 h-4" />
              <span className="hidden sm:inline">Style carte</span>
            </button>
          ) : (
            <button
              onClick={() =>
                updateSettings({
                  fullscreenEdgeVisualizer: !settings.fullscreenEdgeVisualizer,
                })
              }
              className={`p-3 rounded-2xl liquid-glass transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 ${
                settings.fullscreenEdgeVisualizer !== false
                  ? 'text-cyan-300 border border-cyan-400/40 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={
                settings.fullscreenEdgeVisualizer !== false
                  ? 'Désactiver les effets de rythme sur les bords'
                  : 'Activer les effets de rythme sur les bords'
              }
            >
              <Activity className="w-5 h-5" />
              <span className="hidden sm:inline text-xs font-semibold">
                Effets bords {settings.fullscreenEdgeVisualizer !== false ? 'ON' : 'OFF'}
              </span>
            </button>
          )}

          <button
            onClick={() => openAddToPlaylistModal(currentTrack)}
            className="p-3 rounded-2xl liquid-glass text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Ajouter à une playlist"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 w-full max-w-5xl mx-auto flex flex-col items-center justify-center my-6 md:my-10">
        {activeView === 'cover' ? (
          <div className="w-full max-w-md mx-auto flex flex-col items-center transition-all duration-300">
            <div className="w-full max-w-md mx-auto flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
              {/* Large Album Art */}
              <div className="relative group w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-2xl border border-white/20">
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className={`w-full h-full object-cover transition-transform duration-700 ${
                    isPlaying ? 'scale-105' : 'scale-100'
                  }`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`;
                  }}
                />
                <div className="absolute inset-0 rounded-3xl border border-white/20 pointer-events-none" />
                {isPlaying && (
                  <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 flex items-center gap-2">
                    <VisualizerWave isPlaying={isPlaying} barsCount={6} size="sm" />
                    <span className="text-[11px] font-semibold text-cyan-300">En direct</span>
                  </div>
                )}
              </div>

              {/* Track Info & Like */}
              <div className="w-full mt-8 flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-4">
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-white truncate">
                    {currentTrack.title}
                  </h2>
                  <p className="text-sm sm:text-base text-slate-400 truncate mt-1">
                    {currentTrack.artist}
                  </p>
                  {currentTrack.album && (
                    <p className="text-xs text-indigo-400 font-medium truncate mt-0.5">
                      {currentTrack.album}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => toggleFavorite(currentTrack)}
                  className={`p-3.5 rounded-2xl liquid-glass transition-all cursor-pointer ${
                    favored
                      ? 'text-rose-500 shadow-lg shadow-rose-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Heart className={`w-6 h-6 ${favored ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Progress Scrubber */}
              <div className="w-full mt-6 space-y-2">
                <input
                  type="range"
                  min={0}
                  max={duration || 200}
                  step={0.5}
                  value={currentTime}
                  onChange={handleSeekChange}
                  className="w-full h-2 rounded-full"
                  style={{
                    background: `linear-gradient(to right, #6366f1 0%, #38bdf8 ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%, rgba(255,255,255,0.15) 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs font-mono tabular-nums text-slate-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls Bar */}
              <div className="w-full mt-6 flex items-center justify-between">
                <button
                  onClick={toggleShuffle}
                  className={`p-3 rounded-2xl liquid-glass transition-all cursor-pointer ${
                    shuffle
                      ? 'text-cyan-400 bg-cyan-400/10 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Lecture aléatoire"
                >
                  <Shuffle className="w-5 h-5" />
                </button>

                <button
                  onClick={prevTrack}
                  className="p-3 rounded-2xl text-slate-200 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title="Précédent"
                >
                  <SkipBack className="w-7 h-7 fill-current" />
                </button>

                <button
                  onClick={togglePlayPause}
                  className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 via-indigo-400 to-cyan-400 hover:scale-105 active:scale-95 text-slate-950 flex items-center justify-center shadow-xl shadow-indigo-500/30 transition-all cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Lecture'}
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 fill-current" />
                  ) : (
                    <Play className="w-8 h-8 fill-current ml-1" />
                  )}
                </button>

                <button
                  onClick={nextTrack}
                  className="p-3 rounded-2xl text-slate-200 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title="Suivant"
                >
                  <SkipForward className="w-7 h-7 fill-current" />
                </button>

                <button
                  onClick={toggleRepeat}
                  className={`p-3 rounded-2xl liquid-glass transition-all cursor-pointer relative ${
                    repeat !== 'off'
                      ? 'text-cyan-400 bg-cyan-400/10 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Répétition: ${repeat}`}
                >
                  {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </button>
              </div>

              {/* Volume row */}
              <div className="w-full mt-8 flex items-center gap-3 px-4 py-2.5 rounded-2xl liquid-glass">
                <button onClick={toggleMute} className="text-slate-400 hover:text-white">
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                  className="flex-1 h-1.5"
                  style={{
                    background: `linear-gradient(to right, #6366f1 0%, #38bdf8 ${
                      isMuted ? 0 : volume
                    }%, rgba(255,255,255,0.15) ${isMuted ? 0 : volume}%, rgba(255,255,255,0.15) 100%)`,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Queue View */
          <div className="w-full max-w-xl h-[480px] flex flex-col rounded-3xl liquid-glass p-6 border border-white/20 animate-in fade-in duration-200">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2 text-cyan-300">
              <ListOrdered className="w-5 h-5" />
              <span>Titres dans la file ({queue.length})</span>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {queue.map((track, i) => {
                const isCurrent = currentTrack.id === track.id;
                return (
                  <div
                    key={`${track.id}-${i}`}
                    onClick={() => playTrack(track)}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-500/25 border border-cyan-400/40 text-cyan-300'
                        : 'bg-white/5 hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-mono text-slate-400 w-6 text-center">
                      {i + 1}
                    </span>
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-10 h-10 rounded-xl object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{track.title}</p>
                      <p className="text-xs text-slate-400 truncate">{track.artist}</p>
                    </div>
                    {isCurrent && <VisualizerWave isPlaying={isPlaying} size="sm" barsCount={3} />}
                    <span className="text-xs font-mono text-slate-400">
                      {track.durationFormatted}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
