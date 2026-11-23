import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  KeyRound,
  LayoutGrid,
  List,
  Loader2,
  Youtube,
  Music,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { MULTI_GENRE_TRACKS, YouTubeService } from '../services/youtube';
import { Track } from '../types/music';
import { TrackCard } from '../components/music/TrackCard';
import { TrackRow } from '../components/music/TrackRow';

const CATEGORIES = [
  'Tous',
  'Rap FR',
  'Hip-Hop',
  'Pop',
  'Electro',
  'Lo-Fi',
  'French Pop',
  'Acoustique',
];

const SUGGESTIONS = [
  'PNL Au DD',
  'The Weeknd',
  'Bande Organisée',
  'Daft Punk',
  'Ninho',
  'Travis Scott',
  'Jul',
  'Orelsan',
  'Stromae',
  'Dua Lipa',
];

export const SearchPage: React.FC = () => {
  const { settings, setActiveTab } = usePlayer();
  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [results, setResults] = useState<Track[]>(MULTI_GENRE_TRACKS);
  const [isSearching, setIsSearching] = useState(false);
  const [isApiSearch, setIsApiSearch] = useState(false);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      let filtered = MULTI_GENRE_TRACKS;
      if (selectedCategory !== 'Tous') {
        filtered = MULTI_GENRE_TRACKS.filter((t: Track) =>
          t.category
            ? t.category.toLowerCase().includes(selectedCategory.toLowerCase())
            : true
        );
      }
      setResults(filtered);
      setIsApiSearch(false);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { tracks, isFromOfficialApi } = await YouTubeService.search(
          trimmed,
          settings.youtubeApiKey
        );
        if (cancelled) return;
        setResults(tracks);
        setIsApiSearch(isFromOfficialApi);
      } catch (err) {
        if (!cancelled) console.error('Search error:', err);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selectedCategory, settings.youtubeApiKey]);

  return (
    <div className="space-y-6 pb-36 md:pb-32 animate-in fade-in duration-300">
      {/* Search Header Bar */}
      <div className="space-y-4">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
          Rechercher{' '}
          {isSpotify ? (
            ''
          ) : isUltra ? (
            'un titre'
          ) : (
            <>
              sur <span className="text-cyan-400">YouTube Music</span>
            </>
          )}
        </h1>

        {/* Search Input */}
        <div className="relative group">
          {!isUltra && !isSpotify && (
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-cyan-500/20 to-purple-500/20 blur-xl opacity-50 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
          )}
          <div
            className={`relative flex items-center px-5 transition-all ${
              isSpotify
                ? 'py-3.5 rounded-full bg-[#242424] hover:bg-[#2a2a2a] focus-within:ring-2 focus-within:ring-white/80'
                : isUltra
                ? 'py-4 rounded-2xl bg-white/[0.04] border border-white/[0.1] focus-within:border-white/30'
                : 'py-4 rounded-3xl liquid-glass border border-white/20 shadow-2xl group-focus-within:border-cyan-400/50'
            }`}
          >
            <Search
              className={`w-5 h-5 flex-shrink-0 transition-colors mr-3.5 ${
                isSpotify
                  ? 'text-[#B3B3B3] group-focus-within:text-white'
                  : isUltra
                  ? 'text-zinc-400 group-focus-within:text-white'
                  : 'text-slate-400 group-focus-within:text-cyan-400'
              }`}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Que souhaitez-vous écouter ?"
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder-[#B3B3B3] focus:outline-none"
              autoFocus
            />

            {isSearching && (
              <Loader2
                className={`w-5 h-5 animate-spin flex-shrink-0 ml-2 ${
                  isSpotify ? 'text-[#1DB954]' : isUltra ? 'text-white' : 'text-cyan-400'
                }`}
              />
            )}

            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0 ml-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* API Banner Info (hidden in Ultra & Spotify modes for clean UI) */}
        {!isUltra && !isSpotify && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl liquid-glass text-xs text-slate-300 border border-white/10">
            <div className="flex items-center gap-2">
              <Youtube className="w-4 h-4 text-red-500 flex-shrink-0" />
              {settings.youtubeApiKey ? (
                <span>
                  <strong className="text-white">API YouTube Active :</strong> Recherche en direct sur l'ensemble du catalogue YouTube.
                </span>
              ) : (
                <span>
                  Recherche intégrée & catalogue étendu. Vous pouvez aussi coller directement n'importe quel lien YouTube !
                </span>
              )}
            </div>
            {!settings.youtubeApiKey && (
              <button
                onClick={() => setActiveTab('settings')}
                className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Configurer clé API</span>
              </button>
            )}
          </div>
        )}

        {/* Suggestion Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-[#B3B3B3] font-medium whitespace-nowrap mr-1">Suggestions :</span>
          {SUGGESTIONS.map((item) => (
            <button
              key={item}
              onClick={() => setQuery(item)}
              className={`px-3 py-1.5 whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                isSpotify
                  ? 'rounded-full bg-[#232323] hover:bg-[#2f2f2f] text-white font-medium'
                  : isUltra
                  ? 'rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-zinc-300 hover:text-white border border-white/[0.08]'
                  : 'rounded-full liquid-glass hover:bg-white/15 text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Genre Category Filters & Grid/List view toggle */}
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isSpotify
                    ? selectedCategory === cat
                      ? 'rounded-full bg-white text-black font-bold'
                      : 'rounded-full bg-[#232323] hover:bg-[#2a2a2a] text-white'
                    : isUltra
                    ? selectedCategory === cat
                      ? 'rounded-lg bg-white text-zinc-950'
                      : 'rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-zinc-400 hover:text-white border border-white/[0.07]'
                    : selectedCategory === cat
                    ? 'rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md shadow-indigo-500/20'
                    : 'rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div
            className={`hidden sm:flex items-center gap-1 p-1 rounded-xl border ${
              isSpotify
                ? 'bg-[#232323] border-white/[0.06]'
                : isUltra
                ? 'bg-white/[0.04] border-white/[0.09]'
                : 'liquid-glass border-white/10'
            }`}
          >
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? isSpotify
                    ? 'bg-white text-black'
                    : isUltra
                    ? 'bg-white text-zinc-950'
                    : 'bg-indigo-600/40 text-cyan-300'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vue en grille"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? isSpotify
                    ? 'bg-white text-black'
                    : isUltra
                    ? 'bg-white text-zinc-950'
                    : 'bg-indigo-600/40 text-cyan-300'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vue en liste"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[#B3B3B3]">
          <span className="font-mono tabular-nums">
            {results.length} résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
            {query ? ` pour « ${query} »` : ''}
          </span>
          {isApiSearch && (
            <span
              className={
                isSpotify
                  ? 'text-[#1DB954] font-medium'
                  : isUltra
                  ? 'text-zinc-300 font-medium'
                  : 'text-emerald-400 font-medium'
              }
            >
              Flux YouTube Officiel
            </span>
          )}
        </div>

        {results.length === 0 ? (
          <div
            className={`text-center py-20 p-8 ${
              isSpotify
                ? 'rounded-lg bg-[#181818]'
                : isUltra
                ? 'rounded-2xl bg-white/[0.03] border border-white/[0.08]'
                : 'rounded-3xl liquid-glass border border-white/10'
            }`}
          >
            <Music className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="font-bold text-base text-slate-200">Aucun résultat trouvé</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Essayez un autre mot-clé, le nom d'un artiste, ou collez l'URL directe d'une vidéo YouTube.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {results.map((track: Track) => (
              <TrackCard key={track.id} track={track} queueContext={results} />
            ))}
          </div>
        ) : (
          <div
            className={`p-3 divide-y divide-white/[0.05] ${
              isSpotify
                ? 'rounded-lg bg-[#181818]'
                : isUltra
                ? 'rounded-2xl bg-white/[0.03] border border-white/[0.08]'
                : 'rounded-3xl liquid-glass border border-white/15'
            }`}
          >
            {results.map((track: Track, idx: number) => (
              <TrackRow key={track.id} track={track} index={idx} queueContext={results} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
