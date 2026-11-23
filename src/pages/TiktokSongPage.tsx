import React, { useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  Plus,
  ListPlus,
  Loader2,
  ClipboardPaste,
  X,
  Trash2,
  AlertCircle,
  Link2,
  Music2,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { TikTokService, isTikTokTrack, isTikTokUrl } from '../services/tiktok';
import { Track } from '../types/music';

const FALLBACK_COVER = '/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png';

const TikTokNoteIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

export const TiktokSongPage: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isLoading: isPlayerLoading,
    errorMessage: playerError,
    clearErrorMessage,
    history,
    settings,
    playTrack,
    togglePlayPause,
    addToQueue,
    toggleFavorite,
    isFavorite,
    openAddToPlaylistModal,
  } = usePlayer();

  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;

  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSongs, setRecentSongs] = useState<Track[]>(() => TikTokService.getRecentSongs());
  const [lastResolved, setLastResolved] = useState<{
    track: Track;
    videoTitle: string;
    authorHandle: string;
  } | null>(null);
  const [queuedToastId, setQueuedToastId] = useState<string | null>(null);

  React.useEffect(() => {
    const handleSyncUpdate = () => {
      setRecentSongs(TikTokService.getRecentSongs());
    };
    window.addEventListener('hmd-tiktok-songs-updated', handleSyncUpdate);
    return () => {
      window.removeEventListener('hmd-tiktok-songs-updated', handleSyncUpdate);
    };
  }, []);

  React.useEffect(() => {
    const fromHistory = history.filter((t) => isTikTokTrack(t));
    if (fromHistory.length === 0) return;
    setRecentSongs((prev) => {
      const seen = new Set(prev.map((t) => t.id));
      const missing = fromHistory.filter((t) => !seen.has(t.id));
      if (missing.length === 0) return prev;
      return [...prev, ...missing].slice(0, 25);
    });
  }, [history]);

  const resolveAndPlay = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setError('Collez un lien de vidéo TikTok ci-dessus.');
      return;
    }

    setIsLoading(true);
    setError(null);
    clearErrorMessage();

    try {
      const resolved = await TikTokService.resolveLink(trimmed);
      setLastResolved(resolved);
      const updatedRecent = TikTokService.saveRecentSong(resolved.track);
      setRecentSongs(updatedRecent);
      playTrack(resolved.track, updatedRecent);
    } catch (err: any) {
      setError(err?.message || 'Impossible de lire le son de cette vidéo TikTok.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resolveAndPlay(urlInput);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
        setError(null);
        if (isTikTokUrl(text)) {
          resolveAndPlay(text.trim());
        }
      }
    } catch {
      setError('Collez le lien directement dans le champ ci-dessus (Ctrl+V ou appui long).');
    }
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
    setQueuedToastId(track.id);
    window.setTimeout(() => {
      setQueuedToastId((curr) => (curr === track.id ? null : curr));
    }, 1800);
  };

  const handleRemoveRecent = (trackId: string) => {
    const updated = TikTokService.removeRecentSong(trackId);
    setRecentSongs(updated);
  };

  const activeTrackToHighlight =
    lastResolved?.track ||
    (currentTrack?.sourceType === 'tiktok' ? currentTrack : null);

  return (
    <div className="space-y-8 pb-36 md:pb-32 animate-in fade-in duration-300">
      {/* Header */}
      <header className="space-y-2 pt-1">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isSpotify
                ? 'bg-[#1DB954] text-black'
                : isUltra
                ? 'bg-white text-zinc-950'
                : 'bg-gradient-to-tr from-pink-500 via-rose-500 to-cyan-400 text-white shadow-lg shadow-pink-500/20'
            }`}
          >
            <TikTokNoteIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
              Tiktok Song
            </h1>
            <p className={`text-xs sm:text-sm ${isSpotify ? 'text-[#B3B3B3]' : 'text-slate-400'}`}>
              Collez le lien d&apos;une vidéo TikTok pour écouter son son directement dans HMD Music.
            </p>
          </div>
        </div>
      </header>

      {/* Link Input Card */}
      <section
        className={`p-4 sm:p-6 ${
          isSpotify
            ? 'rounded-xl bg-[#181818] border border-white/[0.06]'
            : isUltra
            ? 'rounded-2xl bg-white/[0.04] border border-white/[0.09]'
            : 'rounded-3xl liquid-glass border border-white/15 shadow-xl'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div
            className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5`}
          >
            <div
              className={`flex-1 flex items-center gap-2.5 px-3.5 py-3 transition-colors ${
                isSpotify
                  ? 'rounded-full bg-[#242424] focus-within:ring-2 focus-within:ring-white/80'
                  : isUltra
                  ? 'rounded-xl bg-black/40 border border-white/10 focus-within:border-white/35'
                  : 'rounded-2xl bg-black/35 border border-white/15 focus-within:border-cyan-400/60'
              }`}
            >
              <Link2
                className={`w-4 h-4 flex-shrink-0 ${
                  isSpotify ? 'text-[#B3B3B3]' : 'text-slate-400'
                }`}
              />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="https://www.tiktok.com/@.../video/... ou https://vm.tiktok.com/..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
                disabled={isLoading}
              />
              {urlInput && !isLoading && (
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput('');
                    setError(null);
                  }}
                  className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                  title="Effacer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePaste}
                disabled={isLoading}
                className={`px-3.5 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                  isSpotify
                    ? 'rounded-full bg-[#282828] hover:bg-[#333333] text-white'
                    : isUltra
                    ? 'rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white border border-white/10'
                    : 'rounded-2xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15'
                }`}
                title="Coller depuis le presse-papiers"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span>Coller</span>
              </button>

              <button
                type="submit"
                disabled={isLoading || !urlInput.trim()}
                className={`flex-1 sm:flex-initial px-5 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-45 ${
                  isSpotify
                    ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                    : isUltra
                    ? 'rounded-xl bg-white hover:bg-white/90 text-zinc-950'
                    : 'rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-400 hover:from-indigo-400 hover:to-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Chargement…</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Écouter</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {(error || (playerError && isTikTokTrack(currentTrack))) && (
            <div className="flex items-start justify-between gap-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 px-3.5 py-2.5 text-xs text-rose-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                <span>{error || playerError}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  clearErrorMessage();
                }}
                className="p-0.5 rounded hover:bg-white/10 text-rose-300 cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Active / Last Resolved TikTok Song Spotlight */}
      {activeTrackToHighlight && (
        <section
          className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
            isSpotify
              ? 'rounded-xl bg-[#181818] border border-white/[0.06]'
              : isUltra
              ? 'rounded-2xl bg-white/[0.06] border border-white/[0.12]'
              : 'rounded-3xl liquid-glass border border-cyan-500/25 shadow-xl'
          }`}
        >
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-black/40 flex-shrink-0 shadow-lg">
            <img
              src={activeTrackToHighlight.thumbnail}
              alt={activeTrackToHighlight.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_COVER;
              }}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isSpotify
                    ? 'bg-[#1DB954]/20 text-[#1DB954]'
                    : isUltra
                    ? 'bg-white/10 text-white/80'
                    : 'bg-cyan-500/20 text-cyan-300'
                }`}
              >
                Tiktok Song
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {activeTrackToHighlight.durationFormatted}
              </span>
            </div>

            <h2 className="font-display font-bold text-base sm:text-lg text-white truncate">
              {activeTrackToHighlight.title}
            </h2>
            <p className={`text-xs sm:text-sm truncate ${isSpotify ? 'text-[#B3B3B3]' : 'text-slate-400'}`}>
              {activeTrackToHighlight.artist}
              {lastResolved?.track.id === activeTrackToHighlight.id &&
              lastResolved.authorHandle &&
              lastResolved.authorHandle !== activeTrackToHighlight.artist
                ? ` · ${lastResolved.authorHandle}`
                : ''}
            </p>
            {lastResolved?.track.id === activeTrackToHighlight.id && lastResolved.videoTitle && (
              <p className="text-[11px] text-slate-500 line-clamp-1">{lastResolved.videoTitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() =>
                currentTrack?.id === activeTrackToHighlight.id
                  ? togglePlayPause()
                  : playTrack(activeTrackToHighlight, recentSongs)
              }
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-lg ${
                isSpotify
                  ? 'bg-[#1DB954] hover:bg-[#1ed760] text-black'
                  : isUltra
                  ? 'bg-white hover:bg-white/90 text-zinc-950'
                  : 'bg-gradient-to-tr from-indigo-500 to-cyan-400 text-slate-950'
              }`}
              title={
                currentTrack?.id === activeTrackToHighlight.id && isPlaying ? 'Pause' : 'Lecture'
              }
            >
              {currentTrack?.id === activeTrackToHighlight.id && isPlayerLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : currentTrack?.id === activeTrackToHighlight.id && isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleAddToQueue(activeTrackToHighlight)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white/85 hover:text-white transition-colors cursor-pointer"
              title="Ajouter à la file d'attente"
            >
              <ListPlus className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => toggleFavorite(activeTrackToHighlight)}
              className={`p-2.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors cursor-pointer ${
                isFavorite(activeTrackToHighlight.id)
                  ? isSpotify
                    ? 'text-[#1DB954]'
                    : 'text-rose-400'
                  : 'text-white/80 hover:text-white'
              }`}
              title="Favoris"
            >
              <Heart
                className={`w-4 h-4 ${isFavorite(activeTrackToHighlight.id) ? 'fill-current' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={() => openAddToPlaylistModal(activeTrackToHighlight)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Ajouter à une playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* Recent TikTok Songs History */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <Music2 className={`w-4 h-4 ${isSpotify ? 'text-[#1DB954]' : 'text-cyan-400'}`} />
            <span>Sons TikTok récents</span>
            <span className="text-xs font-mono text-slate-400">({recentSongs.length})</span>
          </h2>
        </div>

        {recentSongs.length === 0 ? (
          <div
            className={`p-8 text-center space-y-2 ${
              isSpotify
                ? 'rounded-xl bg-[#181818] text-[#B3B3B3]'
                : isUltra
                ? 'rounded-2xl bg-white/[0.03] border border-white/[0.07] text-zinc-400'
                : 'rounded-3xl liquid-glass border border-white/10 text-slate-400'
            }`}
          >
            <TikTokNoteIcon className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-sm font-medium text-white/80">Aucun son TikTok écouté pour l&apos;instant</p>
            <p className="text-xs opacity-75">
              Collez le lien d&apos;une vidéo TikTok ci-dessus pour l&apos;écouter et l&apos;ajouter à vos playlists.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentSongs.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              const isThisPlaying = isCurrent && isPlaying;
              const favored = isFavorite(track.id);

              return (
                <div
                  key={track.id}
                  onClick={() => (isCurrent ? togglePlayPause() : playTrack(track, recentSongs))}
                  className={`group flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer ${
                    isCurrent
                      ? isSpotify
                        ? 'bg-[#282828]'
                        : isUltra
                        ? 'bg-white/[0.11]'
                        : 'bg-indigo-500/15 border border-indigo-400/30'
                      : isSpotify
                      ? 'hover:bg-[#1F1F1F]'
                      : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-black/40 flex-shrink-0">
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_COVER;
                      }}
                    />
                    <div
                      className={`absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity ${
                        isThisPlaying || (isCurrent && isPlayerLoading)
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isCurrent && isPlayerLoading ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : isThisPlaying ? (
                        <Pause className="w-4 h-4 text-white fill-current" />
                      ) : (
                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-semibold text-sm truncate ${
                        isCurrent
                          ? isSpotify
                            ? 'text-[#1DB954]'
                            : 'text-cyan-300'
                          : 'text-white'
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className={`text-xs truncate ${isSpotify ? 'text-[#B3B3B3]' : 'text-slate-400'}`}>
                      {track.artist}
                    </p>
                  </div>

                  <span className="hidden sm:inline text-xs font-mono tabular-nums text-slate-400 px-2">
                    {track.durationFormatted}
                  </span>

                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {queuedToastId === track.id && (
                      <span className="text-[10px] font-semibold text-emerald-400 px-1.5">
                        Ajouté !
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddToQueue(track)}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Ajouter à la file"
                    >
                      <ListPlus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(track)}
                      className={`p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                        favored
                          ? isSpotify
                            ? 'text-[#1DB954]'
                            : 'text-rose-400'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Favoris"
                    >
                      <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openAddToPlaylistModal(track)}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Ajouter à une playlist"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecent(track.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
                      title="Retirer de la liste"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
