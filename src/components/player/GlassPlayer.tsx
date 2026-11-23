import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  Heart,
  ListOrdered,
  Maximize2,
  Plus,
  Loader2,
} from 'lucide-react';
import { usePlaybackTime, usePlayer } from '../../context/PlayerContext';
import { formatTime } from '../../services/youtube';
import { VisualizerWave } from '../music/VisualizerWave';

export const GlassPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    volume,
    isMuted,
    repeat,
    shuffle,
    queue,
    settings,
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
    setIsFullscreenPlayerOpen,
    setIsQueueOpen,
    isQueueOpen,
  } = usePlayer();

  const { currentTime, duration } = usePlaybackTime();
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  if (!currentTrack) return null;

  const favored = isFavorite(currentTrack.id);
  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seekTo(val);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
  };

  if (isSpotify) {
    return (
      <>
        {/* Mobile Spotify Mini Player (docked cleanly above flat BottomNav) */}
        <div
          id="mobile-mini-player"
          onClick={() => setIsFullscreenPlayerOpen(true)}
          className="md:hidden fixed bottom-[68px] left-2 right-2 z-30 h-14 px-2.5 flex items-center gap-2.5 rounded-lg bg-[#282828] border border-white/[0.06] shadow-xl select-none cursor-pointer active:scale-[0.99] transition-transform"
        >
          {/* Thumbnail */}
          <div className="relative w-10 h-10 rounded overflow-hidden bg-[#181818] flex-shrink-0">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  currentTrack.sourceType === 'tiktok'
                    ? '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png'
                    : `https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`;
              }}
            />
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-[#1DB954]" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-xs text-white truncate">{currentTrack.title}</p>
            <p className="text-[11px] text-[#B3B3B3] truncate">{currentTrack.artist}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => toggleFavorite(currentTrack)}
              className={`p-2 cursor-pointer ${
                favored ? 'text-[#1DB954]' : 'text-[#B3B3B3] hover:text-white'
              }`}
              title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={togglePlayPause}
              className="p-2 text-white active:scale-90 transition-transform cursor-pointer"
              title={isPlaying ? 'Pause' : 'Lecture'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </button>
          </div>

          {/* Slim bottom Spotify progress line */}
          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-white/15 overflow-hidden rounded-full">
            <div
              className="h-full bg-white transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Desktop Classic Spotify Pitch-Black Bottom Bar */}
        <footer
          id="desktop-glass-player"
          className="hidden md:flex fixed bottom-0 left-0 right-0 h-[84px] px-4 items-center justify-between z-30 select-none bg-black border-t border-white/[0.06]"
        >
          {/* Left: Square Cover + Title/Artist + Green Heart */}
          <div className="flex items-center gap-3.5 w-[30%] min-w-[210px]">
            <div
              onClick={() => setIsFullscreenPlayerOpen(true)}
              className="relative w-14 h-14 rounded overflow-hidden bg-[#282828] flex-shrink-0 cursor-pointer group"
              title="Agrandir le lecteur"
            >
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    currentTrack.sourceType === 'tiktok' || currentTrack.id.startsWith('tiktok-')
                      ? '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png'
                      : `https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`;
                }}
              />
              {isLoading && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1DB954]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4
                onClick={() => setIsFullscreenPlayerOpen(true)}
                className="font-semibold text-sm text-white hover:underline truncate cursor-pointer"
                title={currentTrack.title}
              >
                {currentTrack.title}
              </h4>
              <p className="text-xs text-[#B3B3B3] truncate mt-0.5" title={currentTrack.artist}>
                {currentTrack.artist}
              </p>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => toggleFavorite(currentTrack)}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  favored ? 'text-[#1DB954]' : 'text-[#B3B3B3] hover:text-white'
                }`}
                title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={() => openAddToPlaylistModal(currentTrack)}
                className="p-2 rounded-full text-[#B3B3B3] hover:text-white transition-colors cursor-pointer"
                title="Ajouter à une playlist"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center: Classic Controls + Thin White/Green Scrubber */}
          <div className="flex flex-col items-center justify-center flex-1 max-w-xl px-4">
            <div className="flex items-center gap-5 mb-1.5">
              <button
                onClick={toggleShuffle}
                className={`relative p-1.5 transition-colors cursor-pointer ${
                  shuffle ? 'text-[#1DB954]' : 'text-[#B3B3B3] hover:text-white'
                }`}
                title={shuffle ? 'Désactiver la lecture aléatoire' : 'Activer la lecture aléatoire'}
              >
                <Shuffle className="w-4 h-4" />
                {shuffle && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1DB954]" />
                )}
              </button>

              <button
                onClick={prevTrack}
                className="p-1.5 text-[#B3B3B3] hover:text-white active:scale-95 transition-all cursor-pointer"
                title="Précédent"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                id="player-play-pause-btn"
                onClick={togglePlayPause}
                className="w-9 h-9 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center transition-transform cursor-pointer"
                title={isPlaying ? 'Pause' : 'Lecture'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={nextTrack}
                className="p-1.5 text-[#B3B3B3] hover:text-white active:scale-95 transition-all cursor-pointer"
                title="Suivant"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={toggleRepeat}
                className={`relative p-1.5 transition-colors cursor-pointer ${
                  repeat !== 'off' ? 'text-[#1DB954]' : 'text-[#B3B3B3] hover:text-white'
                }`}
                title={`Mode répétition: ${repeat}`}
              >
                {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                {repeat !== 'off' && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1DB954]" />
                )}
              </button>
            </div>

            <div className="w-full flex items-center gap-2.5 text-[11px] font-mono tabular-nums text-[#B3B3B3]">
              <span className="w-9 text-right">{formatTime(currentTime)}</span>
              <div className="relative flex-1 flex items-center py-1">
                <input
                  type="range"
                  min={0}
                  max={duration || 200}
                  step={0.5}
                  value={currentTime}
                  onChange={handleSeekChange}
                  className="spotify-range w-full h-1 rounded-full"
                  style={{
                    background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, #535353 ${progressPercent}%, #535353 100%)`,
                  }}
                />
              </div>
              <span className="w-9">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Queue, Volume, Fullscreen */}
          <div className="flex items-center justify-end gap-2 w-[30%] min-w-[220px]">
            <button
              onClick={() => setIsQueueOpen(!isQueueOpen)}
              className={`relative p-2 transition-colors cursor-pointer ${
                isQueueOpen ? 'text-[#1DB954]' : 'text-[#B3B3B3] hover:text-white'
              }`}
              title="File d'attente"
            >
              <ListOrdered className="w-4 h-4" />
              {queue.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 px-1 rounded-full bg-[#1DB954] text-black font-bold text-[9px] tabular-nums">
                  {queue.length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                className="p-1.5 text-[#B3B3B3] hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Rétablir le son' : 'Couper le son'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[#B3B3B3]" />
                ) : volume < 50 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="spotify-range w-20 lg:w-24 h-1 rounded-full"
                style={{
                  background: `linear-gradient(to right, #ffffff 0%, #ffffff ${
                    isMuted ? 0 : volume
                  }%, #535353 ${isMuted ? 0 : volume}%, #535353 100%)`,
                }}
              />
            </div>

            <button
              onClick={() => setIsFullscreenPlayerOpen(true)}
              className="p-2 text-[#B3B3B3] hover:text-white transition-colors cursor-pointer"
              title="Agrandir le lecteur"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </footer>
      </>
    );
  }

  return (
    <>
      {/* Mobile Mini Player (docked above bottom nav bar on small screens) */}
      <div
        id="mobile-mini-player"
        onClick={() => setIsFullscreenPlayerOpen(true)}
        className={`md:hidden fixed bottom-20 left-3 right-3 z-30 h-16 px-3 flex items-center gap-3 shadow-2xl select-none cursor-pointer active:scale-[0.99] transition-transform ${
          isUltra
            ? 'rounded-2xl bg-zinc-900/90 backdrop-blur-xl border border-white/10'
            : 'rounded-2xl liquid-glass border border-white/20'
        }`}
      >
        {/* Slim top progress line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 overflow-hidden rounded-t-2xl">
          <div
            className={`h-full transition-all duration-200 ${
              isUltra ? 'bg-white' : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Thumbnail */}
        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 shadow">
          <img
            src={currentTrack.thumbnail}
            alt={currentTrack.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                currentTrack.sourceType === 'tiktok' || currentTrack.id.startsWith('tiktok-')
                  ? '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png'
                  : `https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`;
            }}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className={`w-4 h-4 animate-spin ${isUltra ? 'text-white' : 'text-cyan-400'}`} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs text-white truncate">{currentTrack.title}</p>
          <p className="text-[11px] text-slate-400 truncate">{currentTrack.artist}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleFavorite(currentTrack)}
            className={`p-2 rounded-full cursor-pointer ${
              favored ? 'text-rose-500' : 'text-slate-400'
            }`}
          >
            <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={togglePlayPause}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer ${
              isUltra ? 'bg-white text-zinc-950' : 'bg-cyan-400 text-slate-950'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
          <button
            onClick={nextTrack}
            className="p-2 rounded-full text-slate-400 hover:text-white cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop / Laptop Fixed Player Bar */}
      <footer
        id="desktop-glass-player"
        className={`hidden md:flex fixed bottom-3 left-3 right-3 h-20 px-6 items-center justify-between z-30 select-none transition-all duration-300 ${
          isUltra
            ? 'rounded-2xl bg-zinc-950/88 backdrop-blur-xl border border-white/[0.09] shadow-[0_20px_50px_rgba(0,0,0,0.65)]'
            : 'rounded-3xl liquid-glass shadow-2xl border border-white/20'
        }`}
      >
        {/* Left Section: Track Info & Quick Actions */}
        <div className="flex items-center gap-3.5 w-1/4 min-w-[220px]">
          <div
            onClick={() => setIsFullscreenPlayerOpen(true)}
            className="relative w-13 h-13 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 cursor-pointer group shadow-lg"
            title="Agrandir le lecteur"
          >
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  currentTrack.sourceType === 'tiktok'
                    ? '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png'
                    : `https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`;
              }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className={`w-5 h-5 animate-spin ${isUltra ? 'text-white' : 'text-cyan-400'}`} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4
              onClick={() => setIsFullscreenPlayerOpen(true)}
              className={`font-semibold text-sm truncate cursor-pointer transition-colors ${
                isUltra ? 'text-white hover:text-white/80' : 'text-slate-100 hover:text-cyan-300'
              }`}
              title={currentTrack.title}
            >
              {currentTrack.title}
            </h4>
            <p className="text-xs text-slate-400 truncate mt-0.5" title={currentTrack.artist}>
              {currentTrack.artist}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleFavorite(currentTrack)}
              className={`p-2 rounded-full transition-all cursor-pointer ${
                favored
                  ? 'text-rose-500 hover:scale-110'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => openAddToPlaylistModal(currentTrack)}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              title="Ajouter à une playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Section: Playback Controls & Scrubber */}
        <div className="flex flex-col items-center justify-center flex-1 max-w-xl px-4">
          <div className="flex items-center gap-4 mb-1.5">
            <button
              onClick={toggleShuffle}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                shuffle
                  ? isUltra
                    ? 'text-white bg-white/10'
                    : 'text-cyan-400 bg-cyan-400/10 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={shuffle ? 'Désactiver la lecture aléatoire' : 'Activer la lecture aléatoire'}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={prevTrack}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title="Précédent"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Play / Pause Main Button (never disabled so buffering never locks user out) */}
            <button
              id="player-play-pause-btn"
              onClick={togglePlayPause}
              className={`relative w-11 h-11 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer ${
                isUltra
                  ? 'bg-white text-zinc-950 shadow-lg hover:bg-white/90'
                  : 'bg-gradient-to-tr from-indigo-500 via-indigo-400 to-cyan-400 hover:from-indigo-400 hover:to-cyan-300 text-slate-950 shadow-lg shadow-indigo-500/25'
              }`}
              title={isPlaying ? 'Pause' : 'Lecture'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title="Suivant"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-2 rounded-xl transition-all cursor-pointer relative ${
                repeat !== 'off'
                  ? isUltra
                    ? 'text-white bg-white/10'
                    : 'text-cyan-400 bg-cyan-400/10 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`Mode répétition: ${repeat}`}
            >
              {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              {repeat === 'one' && (
                <span
                  className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                    isUltra ? 'bg-white' : 'bg-cyan-400'
                  }`}
                />
              )}
            </button>
          </div>

          {/* Time & Scrubber Slider */}
          <div className="w-full flex items-center gap-3 text-xs font-mono tabular-nums text-slate-400">
            <span className="w-10 text-right text-[11px]">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center group py-1">
              <input
                type="range"
                min={0}
                max={duration || 200}
                step={0.5}
                value={currentTime}
                onChange={handleSeekChange}
                className={`w-full rounded-full bg-white/10 transition-all ${
                  isUltra ? 'ultra-range h-1' : 'h-1.5 group-hover:h-2'
                }`}
                style={{
                  background: isUltra
                    ? `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, rgba(255,255,255,0.14) ${progressPercent}%, rgba(255,255,255,0.14) 100%)`
                    : `linear-gradient(to right, #6366f1 0%, #38bdf8 ${progressPercent}%, rgba(255,255,255,0.12) ${progressPercent}%, rgba(255,255,255,0.12) 100%)`,
                }}
              />
            </div>
            <span className="w-10 text-[11px]">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Section: Queue, Volume, Fullscreen */}
        <div className="flex items-center justify-end gap-2.5 w-1/4 min-w-[240px]">
          {!isUltra && (
            <div className="hidden lg:block px-1">
              <VisualizerWave isPlaying={isPlaying} barsCount={5} size="sm" />
            </div>
          )}

          {/* Queue button */}
          <button
            onClick={() => setIsQueueOpen(!isQueueOpen)}
            className={`relative p-2.5 rounded-xl transition-all cursor-pointer ${
              isQueueOpen
                ? isUltra
                  ? 'bg-white/15 text-white'
                  : 'bg-indigo-500/20 text-cyan-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="File d'attente"
          >
            <ListOrdered className="w-4 h-4" />
            {queue.length > 0 && (
              <span
                className={`absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full font-bold text-[9px] tabular-nums ${
                  isUltra ? 'bg-white text-zinc-950' : 'bg-cyan-400 text-slate-950'
                }`}
              >
                {queue.length}
              </span>
            )}
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              title={isMuted ? 'Rétablir le son' : 'Couper le son'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : volume < 50 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className={`w-20 lg:w-24 rounded-full ${isUltra ? 'ultra-range h-1' : 'h-1.5'}`}
              style={{
                background: isUltra
                  ? `linear-gradient(to right, #ffffff 0%, #ffffff ${
                      isMuted ? 0 : volume
                    }%, rgba(255,255,255,0.14) ${isMuted ? 0 : volume}%, rgba(255,255,255,0.14) 100%)`
                  : `linear-gradient(to right, #6366f1 0%, #38bdf8 ${
                      isMuted ? 0 : volume
                    }%, rgba(255,255,255,0.12) ${isMuted ? 0 : volume}%, rgba(255,255,255,0.12) 100%)`,
              }}
            />
          </div>

          {/* Fullscreen Player modal trigger */}
          <button
            onClick={() => setIsFullscreenPlayerOpen(true)}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            title="Agrandir le lecteur"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </>
  );
};
