import React, { useRef, useState } from 'react';
import { Play, Pause, Heart, MoreVertical, Plus, ListPlus, Flame, X, Trash2 } from 'lucide-react';
import { Track } from '../../types/music';
import { usePlayer } from '../../context/PlayerContext';
import { VisualizerWave } from './VisualizerWave';

interface TrackCardProps {
  track: Track;
  queueContext?: Track[];
  rankBadge?: number;
  onRemove?: () => void;
  removeLabel?: string;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  queueContext,
  rankBadge,
  onRemove,
  removeLabel = "Supprimer de l'historique",
}) => {
  const {
    currentTrack,
    isPlaying,
    settings,
    playTrack,
    togglePlayPause,
    isFavorite,
    toggleFavorite,
    addToQueue,
    openAddToPlaylistModal,
  } = usePlayer();

  const isCurrent = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isCurrent && isPlaying;
  const favored = isFavorite(track.id);
  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;

  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shine, setShine] = useState({ x: 50, y: 50, opacity: 0 });
  const [menuOpen, setMenuOpen] = useState(false);

  // 3D tilt disabled in Ultra & Spotify Modes for zero mousemove CPU overhead
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isUltra || isSpotify || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    setTilt({ x: rotateX, y: rotateY });
    setShine({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    if (!isUltra && !isSpotify) {
      setTilt({ x: 0, y: 0 });
      setShine((prev) => ({ ...prev, opacity: 0 }));
    }
    setMenuOpen(false);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrent) {
      togglePlayPause();
    } else {
      playTrack(track, queueContext);
    }
  };

  // CLASSIC SPOTIFY FLAT CARD (#181818 -> #282828 hover, #1DB954 Play circle)
  if (isSpotify) {
    return (
      <div
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (!isCurrent) playTrack(track, queueContext);
          else togglePlayPause();
        }}
        className={`group relative rounded-lg p-3.5 transition-colors duration-150 cursor-pointer select-none ${
          isCurrent ? 'bg-[#282828]' : 'bg-[#181818] hover:bg-[#282828]'
        }`}
      >
        <div className="relative aspect-square w-full rounded-md overflow-hidden bg-[#282828] shadow-md">
          <img
            src={track.thumbnail}
            alt={track.title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
            }}
          />

          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label={removeLabel}
              title={removeLabel}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/75 hover:bg-rose-500 text-white flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Classic Floating Spotify Green Play Button */}
          <button
            onClick={handlePlayClick}
            aria-label={isCurrentlyPlaying ? 'Pause' : 'Lire la musique'}
            className={`absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[#1DB954] hover:bg-[#1ed760] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-xl transition-all duration-150 cursor-pointer ${
              isCurrentlyPlaying
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0'
            }`}
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
        </div>

        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4
              className={`font-semibold text-sm truncate ${
                isCurrent ? 'text-[#1DB954]' : 'text-white'
              }`}
              title={track.title}
            >
              {track.title}
            </h4>
            <p className="text-xs text-[#B3B3B3] truncate mt-1 flex items-center gap-1.5">
              <span className="truncate">{track.artist}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums flex-shrink-0">{track.durationFormatted}</span>
            </p>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(track);
              }}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                favored
                  ? 'text-[#1DB954]'
                  : 'text-[#B3B3B3] hover:text-white sm:opacity-0 sm:group-hover:opacity-100'
              }`}
              title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={`w-3.5 h-3.5 ${favored ? 'fill-current' : ''}`} />
            </button>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                className="p-1.5 rounded-full text-[#B3B3B3] hover:text-white sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {menuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-full mb-1 w-44 rounded-md bg-[#282828] p-1 shadow-2xl z-30 border border-white/10 text-xs space-y-0.5"
                >
                  <button
                    onClick={() => {
                      addToQueue(track);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-white/10 text-white transition-colors cursor-pointer text-left"
                  >
                    <ListPlus className="w-3.5 h-3.5 text-[#B3B3B3]" />
                    <span>Ajouter à la file</span>
                  </button>
                  <button
                    onClick={() => {
                      openAddToPlaylistModal(track);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-white/10 text-white transition-colors cursor-pointer text-left"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#B3B3B3]" />
                    <span>Ajouter à une playlist</span>
                  </button>
                  {onRemove && (
                    <button
                      onClick={() => {
                        onRemove();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-rose-500/20 text-rose-300 transition-colors cursor-pointer text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>{removeLabel}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ULTRA MODE CLEAN EDITORIAL CARD (zero pill clutter, zero AI slop)
  if (isUltra) {
    return (
      <div
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (!isCurrent) playTrack(track, queueContext);
          else togglePlayPause();
        }}
        className={`group relative rounded-2xl p-3 transition-colors duration-200 cursor-pointer select-none border ${
          isCurrent
            ? 'bg-white/[0.08] border-white/[0.16]'
            : 'bg-white/[0.025] hover:bg-white/[0.06] border-white/[0.06] hover:border-white/[0.12]'
        }`}
      >
        {/* Crisp Square Cover */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900">
          <img
            src={track.thumbnail}
            alt={track.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label={removeLabel}
              title={removeLabel}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/65 hover:bg-rose-500/90 text-white/85 hover:text-white border border-white/15 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Clean Hover / Active Play Button */}
          <button
            onClick={handlePlayClick}
            aria-label={isCurrentlyPlaying ? 'Pause' : 'Lire la musique'}
            className={`absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg cursor-pointer ${
              isCurrentlyPlaying
                ? 'bg-white text-zinc-950 opacity-100 scale-100'
                : 'bg-white text-zinc-950 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 active:scale-95'
            }`}
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* Clean Unboxed Metadata */}
        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4
              className={`font-display font-semibold text-sm truncate tracking-tight ${
                isCurrent ? 'text-white' : 'text-zinc-100'
              }`}
              title={track.title}
            >
              {track.title}
            </h4>
            <p className="text-xs text-zinc-400 truncate mt-0.5 flex items-center gap-1.5">
              <span className="truncate">{track.artist}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums flex-shrink-0">{track.durationFormatted}</span>
            </p>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(track);
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                favored
                  ? 'text-rose-400'
                  : 'text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100'
              }`}
              title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={`w-3.5 h-3.5 ${favored ? 'fill-current' : ''}`} />
            </button>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {menuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-full mb-1 w-44 rounded-xl bg-zinc-900/95 backdrop-blur-xl p-1.5 shadow-2xl z-30 border border-white/15 text-xs space-y-0.5"
                >
                  <button
                    onClick={() => {
                      addToQueue(track);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-zinc-200 hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <ListPlus className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Ajouter à la file</span>
                  </button>
                  <button
                    onClick={() => {
                      openAddToPlaylistModal(track);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-zinc-200 hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <Plus className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Ajouter à une playlist</span>
                  </button>
                  {onRemove && (
                    <button
                      onClick={() => {
                        onRemove();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors cursor-pointer text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>{removeLabel}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STANDARD LIQUID GLASS CARD
  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        if (!isCurrent) playTrack(track, queueContext);
        else togglePlayPause();
      }}
      style={{
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${
          tilt.x !== 0 ? -4 : 0
        }px)`,
      }}
      className={`group relative rounded-3xl p-3.5 liquid-glass-card cursor-pointer transition-all duration-300 select-none will-change-transform ${
        isCurrent
          ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_15px_35px_rgba(99,102,241,0.2)]'
          : 'hover:border-white/20'
      }`}
    >
      {/* Specular Liquid Light reflection following mouse */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl transition-opacity duration-300"
        style={{
          opacity: shine.opacity * 0.45,
          background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, rgba(255,255,255,0.22) 0%, rgba(99,102,241,0.08) 45%, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* Thumbnail with overlay play trigger */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-900 shadow-md">
        <img
          src={track.thumbnail}
          alt={track.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              track.sourceType === 'tiktok'
                ? '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png'
                : `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
          }}
        />

        {/* Liquid gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={removeLabel}
            title={removeLabel}
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/65 hover:bg-rose-500/90 text-white/85 hover:text-white border border-white/15 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer z-10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Visualizer if currently playing, or Rank badge */}
        {isCurrentlyPlaying ? (
          <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-lg">
            <VisualizerWave isPlaying={true} size="sm" barsCount={4} />
            <span className="text-[10px] font-bold tracking-wider text-cyan-300 uppercase">En lecture</span>
          </div>
        ) : rankBadge !== undefined ? (
          <div
            className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-xl font-mono text-xs font-black shadow-lg backdrop-blur-md border ${
              rankBadge === 1
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-amber-500/30'
                : rankBadge === 2
                ? 'bg-slate-200 text-slate-950 border-white shadow-white/20'
                : rankBadge === 3
                ? 'bg-amber-600 text-amber-50 border-amber-500 shadow-amber-700/30'
                : 'bg-black/70 text-cyan-300 border-white/20'
            }`}
          >
            #{rankBadge}
          </div>
        ) : null}

        {/* Views count badge */}
        {track.views && (
          <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-medium text-amber-300 border border-white/10 flex items-center gap-1">
            <Flame className="w-2.5 h-2.5 text-amber-400" />
            <span>{track.views}</span>
          </div>
        )}

        {/* Duration badge */}
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono text-slate-200 border border-white/10">
          {track.durationFormatted}
        </div>

        {/* Hover / Active Play Button */}
        <button
          onClick={handlePlayClick}
          aria-label={isCurrentlyPlaying ? 'Pause' : 'Lire la musique'}
          className={`absolute inset-0 m-auto w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer ${
            isCurrentlyPlaying
              ? 'bg-cyan-400 text-slate-950 scale-100 opacity-100 ring-4 ring-cyan-400/30'
              : 'bg-white text-slate-900 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 hover:scale-110 active:scale-95'
          }`}
        >
          {isCurrentlyPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>
      </div>

      {/* Info & Metadata */}
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4
            className={`font-semibold text-sm truncate tracking-tight transition-colors ${
              isCurrent ? 'text-cyan-300' : 'text-slate-100 group-hover:text-white'
            }`}
            title={track.title}
          >
            {track.title}
          </h4>
          <p className="text-xs text-slate-400 truncate mt-0.5" title={track.artist}>
            {track.artist}
          </p>
        </div>

        {/* Quick Favorite toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(track);
            }}
            className={`p-1.5 rounded-full transition-all duration-200 cursor-pointer ${
              favored
                ? 'text-rose-500 hover:scale-110'
                : 'text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100'
            }`}
            title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
          </button>

          {/* Menu dropdown trigger */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              title="Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-full mb-1 w-44 rounded-2xl liquid-glass p-1.5 shadow-2xl z-30 border border-white/20 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
              >
                <button
                  onClick={() => {
                    addToQueue(track);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <ListPlus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Ajouter à la file</span>
                </button>
                <button
                  onClick={() => {
                    openAddToPlaylistModal(track);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ajouter à une playlist</span>
                </button>
                {onRemove && (
                  <button
                    onClick={() => {
                      onRemove();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors cursor-pointer text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>{removeLabel}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
