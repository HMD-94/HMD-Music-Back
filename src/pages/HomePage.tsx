import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Clock,
  Heart,
  Music,
  Disc3,
  ArrowRight,
  Search,
  X,
  Loader2,
  ArrowUpRight,
  Monitor,
  Download,
  Trash2,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { MULTI_GENRE_TRACKS, YouTubeService } from '../services/youtube';
import { StorageService } from '../services/storage';
import { Track } from '../types/music';
import { TrackCard } from '../components/music/TrackCard';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';

const HOME_SUGGESTIONS = [
  'PNL Au DD',
  'The Weeknd Blinding Lights',
  'Bande Organisée',
  'Daft Punk Get Lucky',
  'Ninho Mamacita',
  'Travis Scott',
  'Orelsan Basique',
  'Stromae Santé',
];

export const HomePage: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    history,
    favorites,
    playlists,
    openPlaylist,
    setActiveTab,
    settings,
    setIsDesktopModalOpen,
    setIsSpotifyModalOpen,
    setIsFullscreenPlayerOpen,
    playTrack,
    removeFromHistory,
    clearHistory,
  } = usePlayer();

  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;
  const greeting = new Date().getHours() >= 18 || new Date().getHours() < 5 ? 'Bonne soirée' : 'Bonjour';

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search directly from Home Page
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { tracks } = await YouTubeService.search(
          trimmed,
          settings.youtubeApiKey
        );
        if (cancelled) return;
        setSearchResults(tracks);
        setHasSearched(true);
      } catch (err) {
        if (!cancelled) console.error('Home search error:', err);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, settings.youtubeApiKey]);

  const chillTracks = MULTI_GENRE_TRACKS.filter(
    (t: Track) => t.category === 'Lo-Fi' || t.category === 'Electronic' || t.category === 'Acoustique'
  );

  const handleClearSearch = () => {
    setQuery('');
    setSearchResults([]);
    setHasSearched(false);
  };

  return (
    <div className="space-y-8 sm:space-y-10 pb-36 md:pb-32 animate-in fade-in duration-300">
      {/* Top Search & Now Playing Header */}
      {isSpotify ? (
        <section className="space-y-5 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
              {greeting}
            </h1>

            {/* Spotify Search Bar */}
            <div className="relative flex-1 max-w-md flex items-center rounded-full bg-[#242424] hover:bg-[#2a2a2a] focus-within:ring-2 focus-within:ring-white/80 px-4 py-2.5 transition-colors">
              <Search className="w-4 h-4 text-[#B3B3B3] flex-shrink-0 mr-2.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Que souhaitez-vous écouter ?"
                className="w-full bg-transparent text-sm text-white placeholder-[#B3B3B3] focus:outline-none"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 text-[#1DB954] animate-spin flex-shrink-0 ml-2" />
              )}
              {query && (
                <button
                  onClick={handleClearSearch}
                  className="p-1 rounded-full hover:bg-white/10 text-[#B3B3B3] hover:text-white ml-1 cursor-pointer"
                  title="Effacer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
            {HOME_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="px-3 py-1.5 rounded-full bg-[#232323] hover:bg-[#2f2f2f] text-white text-xs font-medium whitespace-nowrap transition-colors cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Classic Spotify 2-Column / 3-Column Quick Access Tiles */}
          {(playlists.length > 0 || history.length > 0) && !hasSearched && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {playlists.slice(0, 3).map((pl) => {
                const firstResolved = StorageService.resolveTracksByIds(
                  pl.trackIds.slice(0, 1),
                  [...MULTI_GENRE_TRACKS, ...history, ...favorites]
                )[0];
                const cover = pl.coverImage || firstResolved?.thumbnail;
                return (
                  <button
                    key={`quick-pl-${pl.id}`}
                    type="button"
                    onClick={() => openPlaylist(pl.id)}
                    className="group flex items-center gap-3 rounded-md bg-white/[0.07] hover:bg-white/[0.14] overflow-hidden pr-3 transition-colors cursor-pointer text-left h-14 sm:h-16"
                  >
                    <div className="w-14 sm:w-16 h-full bg-[#282828] flex items-center justify-center flex-shrink-0">
                      {cover ? (
                        <img
                          src={cover}
                          alt={pl.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-5 h-5 text-[#B3B3B3]" />
                      )}
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-white line-clamp-2 flex-1">
                      {pl.title}
                    </span>
                  </button>
                );
              })}
              {history.slice(0, Math.max(0, 6 - Math.min(playlists.length, 3))).map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                const isThisPlaying = isCurrent && isPlaying;
                return (
                  <div
                    key={`quick-tr-${track.id}`}
                    onClick={() => (isCurrent ? togglePlayPause() : playTrack(track, history))}
                    className="group flex items-center gap-3 rounded-md bg-white/[0.07] hover:bg-white/[0.14] overflow-hidden pr-2.5 transition-colors cursor-pointer h-14 sm:h-16"
                  >
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-14 sm:w-16 h-full object-cover flex-shrink-0 bg-[#282828]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
                      }}
                    />
                    <span
                      className={`font-bold text-xs sm:text-sm line-clamp-2 flex-1 ${
                        isCurrent ? 'text-[#1DB954]' : 'text-white'
                      }`}
                    >
                      {track.title}
                    </span>
                    <span
                      className={`hidden sm:flex w-9 h-9 rounded-full bg-[#1DB954] text-black items-center justify-center shadow-lg flex-shrink-0 transition-opacity ${
                        isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isThisPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : isUltra ? (
        <section className="space-y-6 pt-1">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-xl w-full">
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight text-balance">
                Écouter sans distraction
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Recherchez un morceau, collez un lien YouTube ou importez vos playlists Spotify.
              </p>
            </div>

            {/* Compact Now Playing Card in Ultra Mode with subtle album-art wash */}
            {currentTrack && (
              <div className="relative w-full lg:w-[400px] rounded-2xl bg-white/[0.05] border border-white/[0.11] p-3.5 flex items-center gap-3.5 flex-shrink-0 overflow-hidden shadow-xl">
                <img
                  src={currentTrack.thumbnail}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-20 scale-125 pointer-events-none"
                />
                <button
                  type="button"
                  onClick={() => setIsFullscreenPlayerOpen(true)}
                  className="relative z-10 w-13 h-13 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 cursor-pointer border border-white/10 shadow-md"
                  title="Ouvrir le lecteur"
                >
                  <img
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`;
                    }}
                  />
                </button>

                <div
                  onClick={() => setIsFullscreenPlayerOpen(true)}
                  className="relative z-10 min-w-0 flex-1 cursor-pointer"
                >
                  <p className="text-[11px] text-zinc-400">
                    {isPlaying ? 'En lecture' : 'En pause'}
                  </p>
                  <h4 className="font-display font-semibold text-sm text-white truncate">
                    {currentTrack.title}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
                </div>

                <div className="relative z-10 flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    className="w-9 h-9 rounded-full bg-white text-zinc-950 hover:bg-white/90 flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow"
                    title={isPlaying ? 'Pause' : 'Lecture'}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clean Search Bar */}
          <div className="space-y-2.5">
            <div className="relative flex items-center rounded-xl bg-white/[0.04] border border-white/[0.1] focus-within:border-white/30 px-4 py-3 transition-colors">
              <Search className="w-4 h-4 text-zinc-400 flex-shrink-0 mr-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un titre, un artiste ou un lien YouTube..."
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin flex-shrink-0 ml-2" />
              )}
              {query && (
                <button
                  onClick={handleClearSearch}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors ml-1.5 cursor-pointer"
                  title="Effacer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
              <span className="text-zinc-500 whitespace-nowrap">Suggestions :</span>
              {HOME_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-zinc-300 hover:text-white text-xs whitespace-nowrap border border-white/[0.06] transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="relative rounded-3xl liquid-glass p-6 sm:p-8 overflow-hidden shadow-2xl border border-white/20">
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-gradient-to-br from-indigo-500/20 via-cyan-500/20 to-transparent blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl w-full">
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight leading-tight">
                Bienvenue sur <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-white bg-clip-text text-transparent">HMD Music</span>
              </h1>

              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Explorez et écoutez des millions de titres YouTube en haute fidélité dans une interface moderne et fluide.
              </p>

              {/* Direct Search Bar */}
              <div className="pt-2 w-full">
                <div className="relative group w-full">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/20 via-cyan-500/20 to-purple-500/20 blur-md opacity-40 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                  <div className="relative flex items-center rounded-2xl liquid-glass px-4 py-3 border border-white/20 shadow-xl transition-all group-focus-within:border-cyan-400/60 bg-black/30">
                    <Search className="w-5 h-5 text-slate-400 group-focus-within:text-cyan-400 flex-shrink-0 transition-colors mr-3" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher un titre, artiste, album ou lien YouTube..."
                      className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
                    />

                    {isSearching && (
                      <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0 ml-2" />
                    )}

                    {query && (
                      <button
                        onClick={handleClearSearch}
                        className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0 ml-1.5 cursor-pointer"
                        title="Effacer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Suggestion Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-1 no-scrollbar text-xs">
                  <span className="text-slate-400 text-[11px] font-medium whitespace-nowrap mr-0.5">Exemples :</span>
                  {HOME_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setQuery(s)}
                      className="px-2.5 py-0.5 rounded-full liquid-glass hover:bg-white/15 text-slate-300 hover:text-cyan-300 text-[11px] whitespace-nowrap border border-white/10 transition-all cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <PWAInstallButton />
                <button
                  onClick={() => setIsDesktopModalOpen(true)}
                  className="flex items-center gap-2 rounded-2xl liquid-glass hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 border border-cyan-400/30 shadow-md transition-all duration-300 active:scale-95 cursor-pointer"
                  title="Installer sur le Bureau Windows (.exe) ou configurer l'arrière-plan"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Bureau & Arrière-plan (.exe)</span>
                </button>
              </div>
            </div>

            {/* Quick Resume Card */}
            {currentTrack && (
              <div
                onClick={() => setIsFullscreenPlayerOpen(true)}
                className="w-full md:w-80 rounded-2xl bg-white/5 hover:bg-white/10 p-4 border border-white/15 backdrop-blur-xl flex items-center gap-3.5 cursor-pointer group transition-all duration-300 hover:border-cyan-500/40 shadow-xl"
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayPause();
                  }}
                  className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 shadow-md"
                >
                  <img
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`;
                    }}
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    {isPlaying ? (
                      <Pause className="w-5 h-5 text-cyan-300 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 text-cyan-300 fill-current ml-0.5" />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5 text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                    <span>{isPlaying ? 'En lecture' : 'Reprendre'}</span>
                  </div>
                  <h4 className="font-semibold text-xs sm:text-sm text-white truncate mt-0.5">
                    {currentTrack.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate">{currentTrack.artist}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* LIVE SEARCH RESULTS SECTION ON HOME (when query active) */}
      {hasSearched && query.trim() && (
        <section className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className={`w-5 h-5 ${isUltra ? 'text-zinc-300' : 'text-cyan-400'}`} />
              <h2 className="font-display font-bold text-lg sm:text-xl text-white">
                Résultats pour « {query} »
              </h2>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                ({searchResults.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('search')}
                className={`text-xs flex items-center gap-1 transition-colors font-medium cursor-pointer ${
                  isUltra ? 'text-zinc-300 hover:text-white' : 'text-cyan-400 hover:text-cyan-300'
                }`}
              >
                <span>Filtres avancés</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleClearSearch}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 transition-colors cursor-pointer"
              >
                Effacer
              </button>
            </div>
          </div>

          {searchResults.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-white/[0.03] p-6 border border-white/10">
              <Music className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <h3 className="font-bold text-sm text-slate-200">Aucun résultat trouvé</h3>
              <p className="text-xs text-slate-400 mt-1">
                Vérifiez l'orthographe ou collez directement un lien YouTube.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
              {searchResults.slice(0, 8).map((track: Track) => (
                <TrackCard key={`home-search-${track.id}`} track={track} queueContext={searchResults} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Récemment Écoutés (History) */}
      {history.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${isSpotify ? 'text-[#1DB954]' : isUltra ? 'text-zinc-400' : 'text-indigo-400'}`} />
              <h2 className="font-display font-bold text-lg sm:text-xl text-white">
                Récemment écoutés
              </h2>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={clearHistory}
                className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-rose-500/15 text-zinc-400 hover:text-rose-300 border border-white/[0.08] transition-colors cursor-pointer"
                title="Supprimer tout l'historique"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Tout supprimer</span>
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`text-xs flex items-center gap-1 transition-colors font-medium cursor-pointer ${
                  isSpotify
                    ? 'text-[#B3B3B3] hover:text-white'
                    : isUltra
                    ? 'text-zinc-300 hover:text-white'
                    : 'text-cyan-400 hover:text-cyan-300'
                }`}
              >
                <span>Voir tout</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {history.slice(0, 6).map((track: Track) => (
              <TrackCard
                key={`hist-${track.id}`}
                track={track}
                queueContext={history}
                onRemove={() => removeFromHistory(track.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Vos Playlists Rapides */}
      {playlists.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Disc3 className={`w-5 h-5 ${isSpotify ? 'text-[#1DB954]' : isUltra ? 'text-zinc-400' : 'text-cyan-400'}`} />
              <h2 className="font-display font-bold text-lg sm:text-xl text-white">
                Vos Playlists
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSpotifyModalOpen(true)}
                className={`text-xs flex items-center gap-1.5 px-3 py-1.5 font-semibold transition-colors cursor-pointer ${
                  isSpotify
                    ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                    : 'rounded-lg bg-white/[0.06] hover:bg-white/[0.11] text-zinc-200 border border-white/[0.08]'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Importer Spotify</span>
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`text-xs flex items-center gap-1 font-medium cursor-pointer ${
                  isSpotify
                    ? 'text-[#B3B3B3] hover:text-white'
                    : isUltra
                    ? 'text-zinc-300 hover:text-white'
                    : 'text-cyan-400 hover:text-cyan-300'
                }`}
              >
                <span>Gérer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((pl) => {
              const firstResolved = StorageService.resolveTracksByIds(
                pl.trackIds.slice(0, 1),
                [...MULTI_GENRE_TRACKS, ...history, ...favorites]
              )[0];
              const plCover = pl.coverImage || (pl.trackIds.length > 0 ? firstResolved?.thumbnail : undefined);
              return (
                <div
                  key={pl.id}
                  onClick={() => openPlaylist(pl.id)}
                  className={`group p-4 cursor-pointer flex items-center gap-4 transition-colors duration-200 ${
                    isSpotify
                      ? 'rounded-lg bg-[#181818] hover:bg-[#282828]'
                      : isUltra
                      ? 'rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.15]'
                      : 'rounded-3xl liquid-glass-card'
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 ${
                      isUltra
                        ? 'bg-zinc-900 text-zinc-200 border border-white/[0.08]'
                        : 'bg-gradient-to-br from-indigo-500/30 to-cyan-500/20 border border-white/15 text-cyan-300 shadow-lg'
                    }`}
                  >
                    {plCover ? (
                      <img
                        src={plCover}
                        alt={pl.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-6 h-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-white truncate transition-colors">
                      {pl.title}
                    </h4>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {pl.description || 'Playlist personnalisée'}
                    </p>
                    <p className="mt-1.5 text-[11px] font-mono tabular-nums text-zinc-400">
                      {pl.trackIds.length} titre{pl.trackIds.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Chill & Lo-Fi Lounge Section */}
      {chillTracks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg sm:text-xl text-white">
              Ambiance Chill & Lo-Fi
            </h2>
            <span className="text-xs text-slate-400">Pour se détendre ou travailler</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {chillTracks.map((track: Track) => (
              <TrackCard key={`chill-${track.id}`} track={track} queueContext={chillTracks} />
            ))}
          </div>
        </section>
      )}

      {/* Favoris Row if user has some */}
      {favorites.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className={`w-5 h-5 fill-current ${isSpotify ? 'text-[#1DB954]' : 'text-rose-500'}`} />
              <h2 className="font-display font-bold text-lg sm:text-xl text-white">
                Vos Coups de Cœur
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('library')}
              className={`text-xs flex items-center gap-1 font-medium cursor-pointer ${
                isSpotify
                  ? 'text-[#B3B3B3] hover:text-white'
                  : isUltra
                  ? 'text-zinc-300 hover:text-white'
                  : 'text-cyan-400 hover:text-cyan-300'
              }`}
            >
              <span>Voir tous ({favorites.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {favorites.slice(0, 6).map((track: Track) => (
              <TrackCard key={`fav-${track.id}`} track={track} queueContext={favorites} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
