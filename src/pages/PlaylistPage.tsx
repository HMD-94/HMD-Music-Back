import React, { useMemo } from 'react';
import {
  Play,
  Shuffle,
  Music,
  Trash2,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { MULTI_GENRE_TRACKS, formatTime } from '../services/youtube';
import { StorageService } from '../services/storage';
import { Track, Playlist } from '../types/music';
import { TrackRow } from '../components/music/TrackRow';

export const PlaylistPage: React.FC = () => {
  const {
    playlists,
    selectedPlaylistId,
    setActiveTab,
    playTrack,
    deletePlaylist,
    removeTrackFromPlaylist,
    reorderPlaylistTracks,
    history,
    favorites,
    queue,
    settings,
  } = usePlayer();

  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;
  const currentPlaylist = playlists.find((p: Playlist) => p.id === selectedPlaylistId);

  // Resolve track IDs across local cache, multi-genre catalog, history, favorites, and queue
  const tracks: Track[] = useMemo(() => {
    if (!currentPlaylist) return [];
    const known = [...MULTI_GENRE_TRACKS, ...history, ...favorites, ...queue];
    return StorageService.resolveTracksByIds(currentPlaylist.trackIds, known);
  }, [currentPlaylist, history, favorites, queue]);

  if (!currentPlaylist) {
    return (
      <div
        className={`text-center py-20 p-8 text-slate-300 ${
          isSpotify
            ? 'rounded-lg bg-[#181818]'
            : isUltra
            ? 'rounded-2xl bg-white/[0.03] border border-white/[0.08]'
            : 'rounded-3xl liquid-glass border border-white/10'
        }`}
      >
        <p className="text-base font-semibold">Aucune playlist sélectionnée.</p>
        <button
          onClick={() => setActiveTab('library')}
          className={`mt-4 px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
            isSpotify
              ? 'rounded-full bg-[#1DB954] text-black'
              : isUltra
              ? 'rounded-xl bg-white text-zinc-950 hover:bg-white/90'
              : 'rounded-xl bg-indigo-600 text-white hover:bg-indigo-500'
          }`}
        >
          Retour à la bibliothèque
        </button>
      </div>
    );
  }

  const totalDurationSeconds = tracks.reduce((acc, t) => acc + t.duration, 0);
  const coverSrc = currentPlaylist.coverImage || tracks[0]?.thumbnail;

  const handlePlayAll = (shuffleMode = false) => {
    if (!tracks.length) return;
    const list = shuffleMode ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
    playTrack(list[0], list);
  };

  return (
    <div className="space-y-6 pb-36 md:pb-32 animate-in fade-in duration-300">
      {/* Back Button */}
      <button
        onClick={() => setActiveTab('library')}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
          isSpotify
            ? 'rounded-full bg-black/50 hover:bg-black/80 text-white'
            : isUltra
            ? 'rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-300 hover:text-white'
            : 'rounded-2xl liquid-glass text-slate-300 hover:text-white'
        }`}
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour à la bibliothèque</span>
      </button>

      {/* Playlist Hero Header */}
      <div
        className={`flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 sm:p-8 relative overflow-hidden ${
          isSpotify
            ? 'rounded-lg bg-gradient-to-b from-[#2f3744] to-[#121212]'
            : isUltra
            ? 'rounded-2xl bg-white/[0.04] border border-white/[0.1] shadow-2xl'
            : 'rounded-3xl liquid-glass border border-white/20 shadow-2xl'
        }`}
      >
        {!isUltra && !isSpotify && (
          <div className="absolute -left-10 -bottom-10 w-72 h-72 rounded-full bg-gradient-to-tr from-indigo-500/20 to-cyan-500/10 blur-2xl pointer-events-none" />
        )}
        {isUltra && coverSrc && (
          <img
            src={coverSrc}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-[0.14] pointer-events-none scale-110"
          />
        )}

        {/* Cover Art */}
        <div
          className={`relative z-10 w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center shadow-2xl flex-shrink-0 overflow-hidden ${
            isSpotify
              ? 'rounded-md bg-[#282828] text-[#B3B3B3]'
              : isUltra
              ? 'rounded-2xl bg-zinc-900 border border-white/[0.12] text-zinc-400'
              : 'rounded-3xl bg-gradient-to-tr from-indigo-600/40 via-purple-500/30 to-cyan-400/30 border border-white/20 text-cyan-300'
          }`}
        >
          {coverSrc ? (
            <img
              src={coverSrc}
              alt={currentPlaylist.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                if (tracks[0]) {
                  (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${tracks[0].id}/hqdefault.jpg`;
                }
              }}
            />
          ) : (
            <Music className="w-16 h-16" />
          )}
          {!isSpotify && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          )}
        </div>

        {/* Info */}
        <div className="relative z-10 flex-1 text-center sm:text-left min-w-0">
          <p className="text-[11px] uppercase font-bold tracking-widest text-[#B3B3B3]">
            Playlist
          </p>
          <h1 className="font-display font-extrabold text-2xl sm:text-4xl lg:text-5xl text-white tracking-tight mt-1.5 truncate">
            {currentPlaylist.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#B3B3B3] mt-1.5 line-clamp-2">
            {currentPlaylist.description || 'Playlist personnalisée sur HMD Music'}
          </p>

          <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-3 text-xs text-[#B3B3B3] font-mono tabular-nums">
            <span className="text-white font-semibold font-sans">HMD Music</span>
            <span aria-hidden="true">·</span>
            <span>
              {tracks.length} morceau{tracks.length > 1 ? 'x' : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(totalDurationSeconds)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center sm:justify-start gap-3 mt-5">
            {isSpotify ? (
              <button
                onClick={() => handlePlayAll(false)}
                disabled={!tracks.length}
                aria-label="Tout écouter"
                title="Tout écouter"
                className="w-13 h-13 rounded-full bg-[#1DB954] hover:bg-[#1ed760] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-xl disabled:opacity-50 transition-transform cursor-pointer"
              >
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </button>
            ) : (
              <button
                onClick={() => handlePlayAll(false)}
                disabled={!tracks.length}
                className={`flex items-center gap-2 px-6 py-2.5 font-semibold text-xs shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer ${
                  isUltra
                    ? 'rounded-full bg-white hover:bg-white/90 text-zinc-950'
                    : 'rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-cyan-400/25 font-bold'
                }`}
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>Tout écouter</span>
              </button>
            )}
            <button
              onClick={() => handlePlayAll(true)}
              disabled={!tracks.length}
              className={`p-2.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer ${
                isSpotify
                  ? 'rounded-full text-[#B3B3B3] hover:text-white'
                  : isUltra
                  ? 'rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-white'
                  : 'rounded-2xl liquid-glass text-slate-300 hover:text-white'
              }`}
              title="Lecture aléatoire"
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button
              onClick={() => deletePlaylist(currentPlaylist.id)}
              className={`p-2.5 text-rose-400 hover:bg-rose-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                isSpotify
                  ? 'rounded-full'
                  : isUltra
                  ? 'rounded-full bg-white/[0.06] border border-white/[0.08]'
                  : 'rounded-2xl liquid-glass'
              }`}
              title="Supprimer la playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wider text-[#B3B3B3]">
          <span># · Titre</span>
          <span>Durée</span>
        </div>

        {tracks.length === 0 ? (
          <div
            className={`text-center py-16 p-8 text-[#B3B3B3] ${
              isSpotify
                ? 'rounded-lg bg-[#181818]'
                : isUltra
                ? 'rounded-2xl bg-white/[0.03] border border-white/[0.08]'
                : 'rounded-3xl liquid-glass border border-white/10'
            }`}
          >
            <Music className="w-10 h-10 text-zinc-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-white">Cette playlist est encore vide.</p>
            <p className="text-xs mt-1">
              Recherchez des morceaux et cliquez sur « Ajouter à une playlist » pour garnir votre collection.
            </p>
            <button
              onClick={() => setActiveTab('search')}
              className={`mt-4 px-5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                isSpotify
                  ? 'rounded-full bg-white text-black hover:bg-[#f0f0f0]'
                  : isUltra
                  ? 'rounded-xl bg-white text-zinc-950 hover:bg-white/90'
                  : 'rounded-xl bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              Rechercher des morceaux
            </button>
          </div>
        ) : (
          <div
            className={`p-2 divide-y divide-white/[0.05] ${
              isSpotify
                ? 'rounded-lg bg-transparent'
                : isUltra
                ? 'rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-xl'
                : 'rounded-3xl liquid-glass border border-white/15 shadow-xl'
            }`}
          >
            {tracks.map((track, idx) => (
              <TrackRow
                key={`pl-${track.id}-${idx}`}
                track={track}
                index={idx}
                queueContext={tracks}
                isPlaylistContext={true}
                onRemoveFromPlaylist={() => removeTrackFromPlaylist(currentPlaylist.id, track.id)}
                canMoveUp={idx > 0}
                canMoveDown={idx < tracks.length - 1}
                onMoveUp={() => reorderPlaylistTracks(currentPlaylist.id, idx, idx - 1)}
                onMoveDown={() => reorderPlaylistTracks(currentPlaylist.id, idx, idx + 1)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
