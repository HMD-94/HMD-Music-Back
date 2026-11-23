import React, { useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  MoreVertical,
  ListPlus,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Track } from '../../types/music';
import { usePlayer } from '../../context/PlayerContext';
import { VisualizerWave } from './VisualizerWave';

interface TrackRowProps {
  track: Track;
  index: number;
  queueContext?: Track[];
  isPlaylistContext?: boolean;
  onRemoveFromPlaylist?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  queueContext,
  isPlaylistContext = false,
  onRemoveFromPlaylist,
  onRemove,
  removeLabel = "Supprimer de l'historique",
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    isFavorite,
    toggleFavorite,
    addToQueue,
    openAddToPlaylistModal,
    settings,
  } = usePlayer();

  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;
  const isCurrent = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isCurrent && isPlaying;
  const favored = isFavorite(track.id);

  const [menuOpen, setMenuOpen] = useState(false);

  const handleRowClick = () => {
    if (isCurrent) {
      togglePlayPause();
    } else {
      playTrack(track, queueContext);
    }
  };

  return (
    <div
      onClick={handleRowClick}
      onMouseLeave={() => setMenuOpen(false)}
      className={`group relative flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 cursor-pointer select-none border border-transparent ${
        isSpotify
          ? isCurrent
            ? 'rounded-md bg-white/[0.1] text-white'
            : 'rounded-md hover:bg-white/[0.07] text-white'
          : isUltra
          ? isCurrent
            ? 'rounded-xl bg-white/[0.09] border-white/[0.12] text-white'
            : 'rounded-xl hover:bg-white/[0.05] text-zinc-200'
          : isCurrent
          ? 'rounded-2xl bg-indigo-500/15 border-indigo-500/30 text-white shadow-md'
          : 'rounded-2xl hover:bg-white/5 hover:border-white/10 text-slate-200'
      }`}
    >
      {/* Index or Play icon */}
      <div className="w-8 flex items-center justify-center flex-shrink-0 text-xs font-mono text-[#B3B3B3]">
        {isCurrentlyPlaying ? (
          <VisualizerWave isPlaying={true} size="sm" barsCount={3} />
        ) : (
          <>
            <span className={`group-hover:hidden tabular-nums ${isSpotify && isCurrent ? 'text-[#1DB954]' : ''}`}>
              {index + 1}
            </span>
            <Play
              className={`w-3.5 h-3.5 fill-current hidden group-hover:block ${
                isSpotify ? 'text-[#1DB954]' : isUltra ? 'text-white' : 'text-cyan-400'
              }`}
            />
          </>
        )}
      </div>

      {/* Thumbnail */}
      <div
        className={`relative w-11 h-11 overflow-hidden bg-[#282828] flex-shrink-0 ${
          isSpotify ? 'rounded' : 'rounded-xl shadow-inner'
        }`}
      >
        <img
          src={track.thumbnail}
          alt={track.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              track.sourceType === 'tiktok'
                ? '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png'
                : `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
          }}
        />
        {isCurrent && !isSpotify && (
          <div
            className={`absolute inset-0 backdrop-blur-[1px] flex items-center justify-center ${
              isUltra ? 'bg-black/45' : 'bg-indigo-600/30'
            }`}
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-4 h-4 text-white fill-current" />
            ) : (
              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
            )}
          </div>
        )}
      </div>

      {/* Title & Artist */}
      <div className="min-w-0 flex-1">
        <h4
          className={`text-sm font-semibold truncate transition-colors ${
            isCurrent
              ? isSpotify
                ? 'text-[#1DB954]'
                : isUltra
                ? 'text-white'
                : 'text-cyan-300'
              : 'text-white'
          }`}
        >
          {track.title}
        </h4>
        <p className="text-xs text-[#B3B3B3] truncate mt-0.5">
          {track.artist}
        </p>
      </div>

      {/* Album / Category tag on wider screens */}
      {track.album && (
        <div className="hidden lg:block w-40 text-xs text-[#B3B3B3] truncate">
          {track.album}
        </div>
      )}

      {/* Reorder controls in Playlist View */}
      {isPlaylistContext && (
        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canMoveUp && onMoveUp && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              title="Monter le morceau"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}
          {canMoveDown && onMoveDown && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              title="Descendre le morceau"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Duration */}
      <div className="text-xs font-mono tabular-nums text-[#B3B3B3] flex-shrink-0">
        {track.durationFormatted}
      </div>

      {/* Quick Remove (e.g. from recently played) */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1.5 rounded-full text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer flex-shrink-0"
          title={removeLabel}
          aria-label={removeLabel}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Quick Favorite */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(track);
        }}
        className={`p-1.5 rounded-full transition-all cursor-pointer flex-shrink-0 ${
          favored
            ? isSpotify
              ? 'text-[#1DB954]'
              : 'text-rose-500'
            : 'text-[#B3B3B3] hover:text-white sm:opacity-0 sm:group-hover:opacity-100'
        }`}
        title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      >
        <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
      </button>

      {/* Options Menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          className="p-1.5 rounded-full text-[#B3B3B3] hover:text-white sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
          title="Options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute right-0 top-full mt-1 w-44 p-1.5 shadow-2xl z-30 text-xs space-y-0.5 ${
              isSpotify
                ? 'rounded-md bg-[#282828] border border-white/10'
                : isUltra
                ? 'rounded-xl bg-zinc-900/95 backdrop-blur-xl border border-white/15'
                : 'rounded-2xl liquid-glass border border-white/20'
            }`}
          >
            <button
              onClick={() => {
                addToQueue(track);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
            >
              <ListPlus className={`w-3.5 h-3.5 ${isSpotify ? 'text-[#B3B3B3]' : isUltra ? 'text-zinc-300' : 'text-indigo-400'}`} />
              <span>Ajouter à la file</span>
            </button>
            <button
              onClick={() => {
                openAddToPlaylistModal(track);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
            >
              <Plus className={`w-3.5 h-3.5 ${isSpotify ? 'text-[#B3B3B3]' : isUltra ? 'text-zinc-300' : 'text-cyan-400'}`} />
              <span>Ajouter à une playlist</span>
            </button>

            {isPlaylistContext && onRemoveFromPlaylist && (
              <button
                onClick={() => {
                  onRemoveFromPlaylist();
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Retirer de la playlist</span>
              </button>
            )}

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
  );
};
