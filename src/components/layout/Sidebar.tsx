import React from 'react';
import {
  Home,
  Search,
  Library,
  Settings,
  Plus,
  Music2,
  KeyRound,
  Monitor,
  Download,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { ActiveTab } from '../../types/music';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

const TikTokNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    playlists,
    openPlaylist,
    selectedPlaylistId,
    settings,
    isPlaying,
    setIsDesktopModalOpen,
    setIsSpotifyModalOpen,
  } = usePlayer();

  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Accueil', icon: <Home className="w-5 h-5" /> },
    { id: 'search', label: 'Rechercher', icon: <Search className="w-5 h-5" /> },
    { id: 'tiktok', label: 'Tiktok Song', icon: <TikTokNavIcon className="w-5 h-5" /> },
    { id: 'library', label: 'Bibliothèque', icon: <Library className="w-5 h-5" /> },
    { id: 'settings', label: 'Paramètres', icon: <Settings className="w-5 h-5" /> },
  ];

  const handleCreateNewPlaylist = () => {
    setActiveTab('library');
  };

  if (isSpotify) {
    return (
      <aside
        id="main-sidebar"
        className="hidden md:flex flex-col w-64 lg:w-72 h-[calc(100vh-5.75rem)] my-2 mx-2 gap-2 z-20 select-none flex-shrink-0 bg-black"
      >
        {/* Top Navigation Card (#121212) */}
        <div className="rounded-lg bg-[#121212] p-3 space-y-1">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 px-3 py-2 mb-1 cursor-pointer text-left"
          >
            <img
              src="/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png"
              alt="HMD Music"
              className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
            />
            <span className="font-display font-bold text-base tracking-tight text-white">
              HMD Music
            </span>
          </button>

          {navItems
            .filter((item) => item.id !== 'library')
            .map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`sidebar-nav-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer ${
                    isActive
                      ? 'text-white font-bold'
                      : 'text-[#B3B3B3] hover:text-white font-semibold'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-[#B3B3B3]'}>{item.icon}</span>
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
        </div>

        {/* Bottom Library Card (#121212) */}
        <div className="flex-1 min-h-0 rounded-lg bg-[#121212] p-3 flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5">
            <button
              type="button"
              id="sidebar-nav-library"
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-3 text-sm font-bold transition-colors cursor-pointer ${
                activeTab === 'library' ? 'text-white' : 'text-[#B3B3B3] hover:text-white'
              }`}
            >
              <Library className="w-5 h-5" />
              <span>Bibliothèque</span>
            </button>
            <button
              type="button"
              onClick={handleCreateNewPlaylist}
              className="p-1.5 rounded-full hover:bg-[#282828] text-[#B3B3B3] hover:text-white transition-colors cursor-pointer"
              title="Créer une playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2 flex-1 overflow-y-auto space-y-1 pr-0.5">
            {playlists.length === 0 ? (
              <div className="rounded-lg bg-[#1F1F1F] p-3.5 space-y-2.5 mt-1">
                <p className="text-xs font-bold text-white">Créez votre première playlist</p>
                <p className="text-[11px] text-[#B3B3B3]">
                  Importez depuis Spotify ou créez une playlist locale.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSpotifyModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F0F0F0] text-black text-xs font-bold transition-transform active:scale-95 cursor-pointer"
                >
                  Importer Spotify
                </button>
              </div>
            ) : (
              playlists.map((pl) => {
                const isSelected = activeTab === 'playlist' && selectedPlaylistId === pl.id;
                return (
                  <button
                    key={pl.id}
                    id={`sidebar-pl-${pl.id}`}
                    onClick={() => openPlaylist(pl.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#282828]' : 'hover:bg-[#1F1F1F]'
                    }`}
                  >
                    <div className="w-10 h-10 rounded bg-[#282828] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {pl.coverImage ? (
                        <img
                          src={pl.coverImage}
                          alt={pl.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music2 className="w-4 h-4 text-[#B3B3B3]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium truncate ${
                          isSelected ? 'text-[#1DB954]' : 'text-white'
                        }`}
                      >
                        {pl.title}
                      </p>
                      <p className="text-xs text-[#B3B3B3] truncate tabular-nums">
                        Playlist · {pl.trackIds.length} titre{pl.trackIds.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-3 mt-2 border-t border-white/[0.07] space-y-1.5">
            <button
              type="button"
              onClick={() => setIsSpotifyModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Importer Spotify</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDesktopModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[#1F1F1F] text-[#B3B3B3] hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Monitor className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Arrière-plan & APK</span>
            </button>
            <PWAInstallButton variant="sidebar" />
          </div>
        </div>
      </aside>
    );
  }

  if (isUltra) {
    return (
      <aside
        id="main-sidebar"
        className="hidden md:flex flex-col w-60 lg:w-64 h-[calc(100vh-6.25rem)] my-3 ml-3 rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-white/[0.08] p-4 z-20 select-none flex-shrink-0"
      >
        {/* Clean Single-Line Brand Wordmark */}
        <div className="px-2 pb-5 border-b border-white/[0.07]">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 cursor-pointer text-left"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
              <img
                src="/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png"
                alt="HMD Music"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-display font-bold text-base tracking-tight text-white whitespace-nowrap">
              HMD Music
            </span>
          </button>
        </div>

        {/* Clean Navigation */}
        <nav className="mt-5 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white/[0.1] text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] font-medium'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-zinc-500'}>{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Playlists Section */}
        <div className="mt-7 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 pb-2 text-xs font-medium text-zinc-500">
            <span>Playlists · {playlists.length}</span>
            <button
              onClick={handleCreateNewPlaylist}
              className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Créer une playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 mt-1">
            {playlists.map((pl) => {
              const isSelected = activeTab === 'playlist' && selectedPlaylistId === pl.id;
              return (
                <button
                  key={pl.id}
                  id={`sidebar-pl-${pl.id}`}
                  onClick={() => openPlaylist(pl.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-white/[0.1] text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <Music2 className="w-3.5 h-3.5 flex-shrink-0 text-zinc-500" />
                  <span className="truncate flex-1">{pl.title}</span>
                  <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
                    {pl.trackIds.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Minimal Footer Actions */}
        <div className="pt-3 mt-auto border-t border-white/[0.07] space-y-2">
          <button
            onClick={() => setIsSpotifyModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white text-zinc-950 hover:bg-white/90 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Importer Spotify</span>
          </button>
          <button
            onClick={() => setIsDesktopModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
            <span className="truncate">Arrière-plan & APK</span>
          </button>
          <PWAInstallButton variant="sidebar" />
        </div>
      </aside>
    );
  }

  return (
    <aside
      id="main-sidebar"
      className="hidden md:flex flex-col w-64 lg:w-72 h-[calc(100vh-6.5rem)] my-3 ml-3 rounded-3xl liquid-glass p-5 z-20 select-none shadow-2xl transition-all duration-300 flex-shrink-0"
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-2 pb-6 border-b border-white/10 dark:border-white/5">
        <div
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-300 border border-white/15 flex-shrink-0">
            <img
              src="/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png"
              alt="HMD Music"
              className="w-full h-full object-cover"
            />
            {isPlaying && (
              <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                HMD
              </span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-widest text-[9px]">
                Music
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-wide font-medium">Lecteur de musique</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="mt-6 space-y-1.5">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-medium text-sm transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600/20 text-white shadow-lg shadow-indigo-600/10 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
              }`}
            >
              <div
                className={`transition-colors ${
                  isActive ? 'text-indigo-400 dark:text-cyan-400' : 'text-slate-400'
                }`}
              >
                {item.icon}
              </div>
              <span className="tracking-wide">{item.label}</span>
              {item.id === 'search' && (
                <span className="ml-auto text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                  YouTube
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Playlists Section */}
      <div className="mt-8 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>Playlists ({playlists.length})</span>
          <button
            onClick={handleCreateNewPlaylist}
            className="p-1 rounded-xl hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Créer une playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 mt-1 text-sm">
          {playlists.map((pl) => {
            const isSelected = activeTab === 'playlist' && selectedPlaylistId === pl.id;
            return (
              <button
                key={pl.id}
                id={`sidebar-pl-${pl.id}`}
                onClick={() => openPlaylist(pl.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all text-left truncate cursor-pointer ${
                  isSelected
                    ? 'bg-white/10 text-cyan-300 border border-cyan-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Music2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                <span className="truncate">{pl.title}</span>
                <span className="ml-auto text-[10px] text-slate-400 font-mono">
                  {pl.trackIds.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info & PWA / API status */}
      <div className="pt-4 mt-auto border-t border-white/10 space-y-3">
        <div
          onClick={() => setActiveTab('settings')}
          className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] transition-all cursor-pointer border border-white/5 text-[11px]"
        >
          <div className="flex items-center gap-2 text-slate-400">
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            <span>YouTube Data API</span>
          </div>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
              settings.youtubeApiKey
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {settings.youtubeApiKey ? 'Active' : 'Catalogue'}
          </span>
        </div>

        <button
          onClick={() => setIsSpotifyModalOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-semibold tracking-wide transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="truncate">Importer playlist Spotify</span>
        </button>

        <button
          onClick={() => setIsDesktopModalOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-indigo-500/15 hover:bg-indigo-500/25 text-cyan-300 border border-indigo-500/30 text-xs font-semibold tracking-wide transition-all duration-300 group cursor-pointer shadow-lg shadow-indigo-500/10"
          title="Installer sur le Bureau Windows (.exe) ou configurer l'arrière-plan"
        >
          <div className="w-6 h-6 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform flex-shrink-0">
            <Monitor className="w-3.5 h-3.5" />
          </div>
          <span className="truncate">Arrière-plan & APK / .exe</span>
        </button>

        <PWAInstallButton variant="sidebar" />
      </div>
    </aside>
  );
};
