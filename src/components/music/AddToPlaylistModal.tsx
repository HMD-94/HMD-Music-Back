import React, { useState } from 'react';
import { X, Plus, Music, Check } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { StorageService } from '../../services/storage';

export const AddToPlaylistModal: React.FC = () => {
  const {
    isPlaylistModalOpen,
    closeAddToPlaylistModal,
    playlistTrackToAdd,
    playlists,
    addTrackToPlaylist,
    createPlaylist,
    settings,
  } = usePlayer();

  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;
  const [newTitle, setNewTitle] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  if (!isPlaylistModalOpen || !playlistTrackToAdd) return null;

  const handleSelectPlaylist = (playlistId: string) => {
    StorageService.saveTracksToCache([playlistTrackToAdd]);
    addTrackToPlaylist(playlistId, playlistTrackToAdd.id);
    setAddedId(playlistId);
    setTimeout(() => {
      closeAddToPlaylistModal();
      setAddedId(null);
    }, 600);
  };

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    StorageService.saveTracksToCache([playlistTrackToAdd]);
    const pl = createPlaylist(newTitle.trim());
    addTrackToPlaylist(pl.id, playlistTrackToAdd.id);
    setAddedId(pl.id);
    setTimeout(() => {
      closeAddToPlaylistModal();
      setAddedId(null);
      setNewTitle('');
      setIsCreatingNew(false);
    }, 600);
  };

  return (
    <div
      onClick={closeAddToPlaylistModal}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 ${
        isSpotify ? 'bg-black/75' : 'bg-black/70 backdrop-blur-md'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md p-6 shadow-2xl ${
          isSpotify
            ? 'rounded-xl bg-[#181818] border border-white/10 text-white'
            : isUltra
            ? 'rounded-2xl bg-[#101014] border border-white/[0.12] text-zinc-100'
            : 'rounded-3xl liquid-glass border border-white/20 text-slate-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold tracking-tight">Ajouter à une playlist</h3>
            <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5">
              « {playlistTrackToAdd.title} »
            </p>
          </div>
          <button
            onClick={closeAddToPlaylistModal}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Playlists list */}
        <div className="mt-4 max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {playlists.map((pl) => {
            const alreadyIn = pl.trackIds.includes(playlistTrackToAdd.id);
            const isJustAdded = addedId === pl.id;

            return (
              <button
                key={pl.id}
                onClick={() => handleSelectPlaylist(pl.id)}
                disabled={alreadyIn && !isJustAdded}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors border cursor-pointer ${
                  isJustAdded
                    ? 'bg-[#1DB954]/20 border-[#1DB954]/50 text-[#1DB954]'
                    : alreadyIn
                    ? 'bg-white/[0.02] border-white/5 text-slate-400 opacity-60 cursor-not-allowed'
                    : isSpotify
                    ? 'bg-[#282828]/70 hover:bg-[#282828] border-transparent text-white'
                    : isUltra
                    ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-200'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:border-cyan-500/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSpotify
                        ? 'bg-white/10 text-[#1DB954]'
                        : isUltra
                        ? 'bg-white/10 text-white'
                        : 'bg-indigo-500/20 text-indigo-400'
                    }`}
                  >
                    <Music className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{pl.title}</p>
                    <p className="text-[11px] text-[#B3B3B3] font-mono tabular-nums">
                      {pl.trackIds.length} morceau{pl.trackIds.length > 1 ? 'x' : ''}
                    </p>
                  </div>
                </div>

                {isJustAdded ? (
                  <Check className="w-4 h-4 text-[#1DB954]" />
                ) : alreadyIn ? (
                  <span className="text-[11px] font-medium text-[#B3B3B3]">Déjà ajouté</span>
                ) : (
                  <Plus
                    className={`w-4 h-4 ${
                      isSpotify ? 'text-[#1DB954]' : isUltra ? 'text-white' : 'text-cyan-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Create new playlist toggle & form */}
        <div className="mt-5 pt-4 border-t border-white/10">
          {!isCreatingNew ? (
            <button
              onClick={() => setIsCreatingNew(true)}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                isSpotify
                  ? 'rounded-full bg-[#282828] hover:bg-[#333333] text-white'
                  : isUltra
                  ? 'rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white border border-white/[0.12]'
                  : 'rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-cyan-300 border border-indigo-500/30'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Créer une nouvelle playlist</span>
            </button>
          ) : (
            <form onSubmit={handleCreateAndAdd} className="space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Nom de la nouvelle playlist..."
                autoFocus
                className={`w-full px-4 py-2.5 rounded-xl border text-sm text-white placeholder-[#B3B3B3] focus:outline-none ${
                  isSpotify
                    ? 'bg-[#282828] border-white/10 focus:border-white/30'
                    : 'bg-white/5 border-white/20 focus:border-white/40'
                }`}
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className={`flex-1 py-2.5 text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer ${
                    isSpotify
                      ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                      : isUltra
                      ? 'rounded-xl bg-white text-zinc-950 hover:bg-white/90'
                      : 'rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white'
                  }`}
                >
                  Créer et ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className={`px-4 py-2.5 bg-white/10 text-slate-300 text-xs hover:bg-white/15 transition-colors cursor-pointer ${
                    isSpotify ? 'rounded-full' : 'rounded-xl'
                  }`}
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
