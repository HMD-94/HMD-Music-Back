import React, { useState } from 'react';
import {
  Heart,
  Disc3,
  Clock,
  Play,
  Plus,
  Trash2,
  Shuffle,
  Download,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { StorageService } from '../services/storage';
import { MULTI_GENRE_TRACKS } from '../services/youtube';
import { Track, Playlist } from '../types/music';
import { TrackRow } from '../components/music/TrackRow';

export const LibraryPage: React.FC = () => {
  const {
    favorites,
    playlists,
    history,
    openPlaylist,
    createPlaylist,
    deletePlaylist,
    playTrack,
    removeFromHistory,
    clearHistory,
    setIsSpotifyModalOpen,
    settings,
  } = usePlayer();

  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;
  const [activeTab, setActiveTab] = useState<'favorites' | 'playlists' | 'history'>('playlists');
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');

  const handleCreatePlaylist = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newPlaylistTitle.trim();
    if (!trimmed) {
      setIsCreatingInline(true);
      return;
    }
    const pl = createPlaylist(trimmed);
    setNewPlaylistTitle('');
    setIsCreatingInline(false);
    openPlaylist(pl.id);
  };

  const playAllFavorites = (shuffleMode = false) => {
    if (!favorites.length) return;
    const tracksToPlay = shuffleMode
      ? [...favorites].sort(() => Math.random() - 0.5)
      : favorites;
    playTrack(tracksToPlay[0], tracksToPlay);
  };

  const playAllHistory = () => {
    if (!history.length) return;
    playTrack(history[0], history);
  };

  const getPlaylistCover = (pl: Playlist): string | undefined => {
    if (pl.coverImage) return pl.coverImage;
    if (pl.trackIds.length === 0) return undefined;
    const resolved = StorageService.resolveTracksByIds(
      [pl.trackIds[0]],
      [...MULTI_GENRE_TRACKS, ...history, ...favorites]
    );
    return resolved[0]?.thumbnail;
  };

  return (
    <div className="space-y-6 pb-36 md:pb-32 animate-in fade-in duration-300">
      {/* Library Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
            {isSpotify || isUltra ? (
              'Bibliothèque'
            ) : (
              <>
                Votre <span className="text-cyan-400">Bibliothèque</span>
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-[#B3B3B3] mt-1">
            Favoris, playlists Spotify importées et historique sauvegardés localement.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsSpotifyModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
              isSpotify
                ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                : isUltra
                ? 'rounded-xl bg-white text-zinc-950 hover:bg-white/90'
                : 'rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Importer Spotify</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('playlists');
              setIsCreatingInline(true);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
              isSpotify
                ? 'rounded-full bg-[#232323] hover:bg-[#2a2a2a] text-white'
                : isUltra
                ? 'rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white border border-white/[0.1]'
                : 'rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-lg shadow-indigo-500/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle playlist</span>
          </button>
        </div>
      </div>

      {/* Inline Playlist Creator */}
      {isCreatingInline && (
        <form
          onSubmit={handleCreatePlaylist}
          className={`p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-in fade-in duration-200 ${
            isSpotify
              ? 'rounded-lg bg-[#181818] border border-white/10'
              : isUltra
              ? 'rounded-2xl bg-white/[0.04] border border-white/[0.12]'
              : 'rounded-2xl liquid-glass border border-white/20'
          }`}
        >
          <input
            type="text"
            value={newPlaylistTitle}
            onChange={(e) => setNewPlaylistTitle(e.target.value)}
            placeholder="Nom de la nouvelle playlist..."
            autoFocus
            className="flex-1 px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.12] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!newPlaylistTitle.trim()}
              className={`px-4 py-2 text-xs font-bold disabled:opacity-40 cursor-pointer ${
                isSpotify
                  ? 'rounded-full bg-[#1DB954] text-black'
                  : isUltra
                  ? 'rounded-xl bg-white text-zinc-950'
                  : 'rounded-xl bg-cyan-400 text-slate-950'
              }`}
            >
              Créer
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingInline(false);
                setNewPlaylistTitle('');
              }}
              className="px-3.5 py-2 rounded-xl bg-white/10 text-zinc-300 text-xs hover:text-white cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Navigation Sub-Tabs */}
      <div
        className={`flex items-center gap-1.5 max-w-md ${
          isSpotify
            ? 'p-0'
            : isUltra
            ? 'p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]'
            : 'p-1.5 rounded-3xl liquid-glass border border-white/10'
        }`}
      >
        <button
          onClick={() => setActiveTab('playlists')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold transition-all cursor-pointer ${
            isSpotify
              ? activeTab === 'playlists'
                ? 'rounded-full bg-white text-black font-bold'
                : 'rounded-full bg-[#232323] hover:bg-[#2a2a2a] text-white'
              : activeTab === 'playlists'
              ? isUltra
                ? 'rounded-xl bg-white text-zinc-950'
                : 'rounded-xl bg-indigo-600/40 text-cyan-300 shadow-lg border border-indigo-500/40'
              : 'rounded-xl text-zinc-400 hover:text-white'
          }`}
        >
          <Disc3 className="w-3.5 h-3.5" />
          <span className="tabular-nums">Playlists ({playlists.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold transition-all cursor-pointer ${
            isSpotify
              ? activeTab === 'favorites'
                ? 'rounded-full bg-white text-black font-bold'
                : 'rounded-full bg-[#232323] hover:bg-[#2a2a2a] text-white'
              : activeTab === 'favorites'
              ? isUltra
                ? 'rounded-xl bg-white text-zinc-950'
                : 'rounded-xl bg-indigo-600/40 text-cyan-300 shadow-lg border border-indigo-500/40'
              : 'rounded-xl text-zinc-400 hover:text-white'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span className="tabular-nums">Favoris ({favorites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold transition-all cursor-pointer ${
            isSpotify
              ? activeTab === 'history'
                ? 'rounded-full bg-white text-black font-bold'
                : 'rounded-full bg-[#232323] hover:bg-[#2a2a2a] text-white'
              : activeTab === 'history'
              ? isUltra
                ? 'rounded-xl bg-white text-zinc-950'
                : 'rounded-xl bg-indigo-600/40 text-cyan-300 shadow-lg border border-indigo-500/40'
              : 'rounded-xl text-zinc-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="tabular-nums">Récents ({history.length})</span>
        </button>
      </div>

      {/* Tab 1: Playlists */}
      {activeTab === 'playlists' && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Import Spotify Card */}
            <div
              onClick={() => setIsSpotifyModalOpen(true)}
              className={`p-5 flex flex-col items-center justify-center text-center gap-3 cursor-pointer group transition-all duration-200 h-44 ${
                isSpotify
                  ? 'rounded-lg bg-[#181818] hover:bg-[#282828] border border-dashed border-white/15'
                  : isUltra
                  ? 'rounded-2xl bg-white/[0.025] hover:bg-white/[0.06] border border-dashed border-white/[0.18]'
                  : 'rounded-3xl liquid-glass border border-dashed border-white/25 hover:border-cyan-400/50 hover:bg-white/5'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${
                  isSpotify
                    ? 'bg-[#1DB954] text-black'
                    : isUltra
                    ? 'rounded-xl bg-white/10 text-white'
                    : 'rounded-xl bg-cyan-400/10 text-cyan-300'
                }`}
              >
                <Download className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-white">Importer depuis Spotify</p>
                <p className="text-xs text-[#B3B3B3] mt-0.5">Lien public ou liste de titres</p>
              </div>
            </div>

            {/* Existing Playlists */}
            {playlists.map((pl: Playlist) => {
              const cover = getPlaylistCover(pl);
              return (
                <div
                  key={pl.id}
                  onClick={() => openPlaylist(pl.id)}
                  className={`group p-5 cursor-pointer flex flex-col justify-between h-44 transition-colors duration-150 relative ${
                    isSpotify
                      ? 'rounded-lg bg-[#181818] hover:bg-[#282828]'
                      : isUltra
                      ? 'rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.15]'
                      : 'rounded-3xl liquid-glass-card'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`w-12 h-12 overflow-hidden flex items-center justify-center flex-shrink-0 ${
                        isSpotify
                          ? 'rounded-md bg-[#282828] text-[#B3B3B3]'
                          : isUltra
                          ? 'rounded-xl bg-zinc-900 border border-white/[0.1] text-zinc-300'
                          : 'rounded-xl bg-gradient-to-br from-indigo-500/30 to-cyan-500/20 border border-white/10 text-cyan-300 shadow'
                      }`}
                    >
                      {cover ? (
                        <img
                          src={cover}
                          alt={pl.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Disc3 className="w-6 h-6" />
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePlaylist(pl.id);
                      }}
                      className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Supprimer la playlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <h3 className="font-display font-bold text-base text-white truncate transition-colors">
                      {pl.title}
                    </h3>
                    <p className="text-xs text-[#B3B3B3] truncate mt-0.5">
                      {pl.description || 'Playlist personnalisée'}
                    </p>
                    <p
                      className={`text-[11px] font-mono tabular-nums mt-2 ${
                        isSpotify ? 'text-[#B3B3B3]' : isUltra ? 'text-zinc-400' : 'text-cyan-400'
                      }`}
                    >
                      {pl.trackIds.length} morceau{pl.trackIds.length > 1 ? 'x' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tab 2: Favorites */}
      {activeTab === 'favorites' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#B3B3B3] font-mono tabular-nums">
              {favorites.length} morceau{favorites.length > 1 ? 'x' : ''} enregistré
              {favorites.length > 1 ? 's' : ''}
            </span>

            {favorites.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => playAllFavorites(false)}
                  className={`flex items-center gap-2 px-4 py-2 font-bold text-xs transition-all cursor-pointer ${
                    isSpotify
                      ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                      : isUltra
                      ? 'rounded-xl bg-white text-zinc-950 hover:bg-white/90'
                      : 'rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Tout écouter</span>
                </button>
                <button
                  onClick={() => playAllFavorites(true)}
                  className={`p-2 transition-all cursor-pointer ${
                    isSpotify
                      ? 'rounded-full bg-[#232323] hover:bg-[#2a2a2a] text-[#B3B3B3] hover:text-white'
                      : isUltra
                      ? 'rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08]'
                      : 'rounded-xl liquid-glass text-slate-300 hover:text-white'
                  }`}
                  title="Lecture aléatoire"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {favorites.length === 0 ? (
            <div
              className={`text-center py-20 p-8 ${
                isSpotify
                  ? 'rounded-lg bg-[#181818]'
                  : isUltra
                  ? 'rounded-2xl bg-white/[0.03] border border-white/[0.08]'
                  : 'rounded-3xl liquid-glass border border-white/10'
              }`}
            >
              <Heart className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
              <h3 className="font-bold text-base text-zinc-200">Aucun coup de cœur pour l'instant</h3>
              <p className="text-xs text-[#B3B3B3] max-w-sm mx-auto mt-1">
                Cliquez sur le cœur à côté de n'importe quel morceau pour l'ajouter à vos favoris.
              </p>
            </div>
          ) : (
            <div
              className={`p-3 divide-y divide-white/[0.05] ${
                isSpotify
                  ? 'rounded-lg bg-[#181818]'
                  : isUltra
                  ? 'rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-xl'
                  : 'rounded-3xl liquid-glass border border-white/15 shadow-xl'
              }`}
            >
              {favorites.map((track: Track, idx: number) => (
                <TrackRow
                  key={`fav-${track.id}`}
                  track={track}
                  index={idx}
                  queueContext={favorites}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab 3: History (Récemment écoutés) */}
      {activeTab === 'history' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#B3B3B3] font-mono tabular-nums">
              {history.length} titre{history.length > 1 ? 's' : ''} écouté
              {history.length > 1 ? 's' : ''}
            </span>

            {history.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={playAllHistory}
                  className={`flex items-center gap-2 px-4 py-2 font-bold text-xs transition-all cursor-pointer ${
                    isSpotify
                      ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                      : isUltra
                      ? 'rounded-xl bg-white text-zinc-950 hover:bg-white/90'
                      : 'rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Tout relire</span>
                </button>
                <button
                  onClick={clearHistory}
                  className={`flex items-center gap-1.5 px-3 py-2 text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 text-xs transition-all cursor-pointer ${
                    isSpotify
                      ? 'rounded-full bg-[#232323]'
                      : isUltra
                      ? 'rounded-xl bg-white/[0.05] border border-white/[0.08]'
                      : 'rounded-xl liquid-glass'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Effacer</span>
                </button>
              </div>
            )}
          </div>

          {history.length === 0 ? (
            <div
              className={`text-center py-20 p-8 ${
                isSpotify
                  ? 'rounded-lg bg-[#181818]'
                  : isUltra
                  ? 'rounded-2xl bg-white/[0.03] border border-white/[0.08]'
                  : 'rounded-3xl liquid-glass border border-white/10'
              }`}
            >
              <Clock className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
              <h3 className="font-bold text-base text-zinc-200">Aucun historique d'écoute</h3>
              <p className="text-xs text-[#B3B3B3] max-w-sm mx-auto mt-1">
                Vos musiques écoutées apparaîtront ici automatiquement et resteront sauvegardées localement.
              </p>
            </div>
          ) : (
            <div
              className={`p-3 divide-y divide-white/[0.05] ${
                isSpotify
                  ? 'rounded-lg bg-[#181818]'
                  : isUltra
                  ? 'rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-xl'
                  : 'rounded-3xl liquid-glass border border-white/15 shadow-xl'
              }`}
            >
              {history.map((track: Track, idx: number) => (
                <TrackRow
                  key={`hist-${track.id}-${idx}`}
                  track={track}
                  index={idx}
                  queueContext={history}
                  onRemove={() => removeFromHistory(track.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
