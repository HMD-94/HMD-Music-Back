import React from 'react';
import { Home, Search, Library, Settings } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { ActiveTab } from '../../types/music';

const TikTokNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, settings } = usePlayer();
  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Accueil', icon: <Home className="w-5 h-5" /> },
    { id: 'search', label: 'Recherche', icon: <Search className="w-5 h-5" /> },
    { id: 'tiktok', label: 'Tiktok Song', icon: <TikTokNavIcon className="w-5 h-5" /> },
    { id: 'library', label: 'Biblio', icon: <Library className="w-5 h-5" /> },
    { id: 'settings', label: 'Réglages', icon: <Settings className="w-5 h-5" /> },
  ];

  if (isSpotify) {
    return (
      <nav
        id="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 px-1 flex items-center justify-around select-none bg-[#121212] border-t border-white/[0.08]"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`bottom-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] min-w-[52px] flex flex-col items-center justify-center py-1 px-1.5 transition-colors cursor-pointer ${
                isActive ? 'text-white font-bold' : 'text-[#B3B3B3] hover:text-white'
              }`}
            >
              <div>{item.icon}</div>
              <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      id="mobile-bottom-nav"
      className={`md:hidden fixed bottom-3 left-3 right-3 z-40 h-16 px-2 flex items-center justify-around select-none ${
        isUltra
          ? 'rounded-2xl bg-zinc-950/92 backdrop-blur-xl border border-white/[0.09] shadow-2xl'
          : 'rounded-3xl liquid-glass shadow-2xl border border-white/20'
      }`}
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            id={`bottom-nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all duration-200 cursor-pointer ${
              isActive
                ? isUltra
                  ? 'text-white font-semibold'
                  : 'text-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isActive && (
              <span
                className={`absolute -top-1 w-6 h-0.5 rounded-full ${
                  isUltra ? 'bg-white' : 'bg-cyan-400 shadow-[0_0_8px_#38bdf8]'
                }`}
              />
            )}
            <div className="transition-transform duration-200 active:scale-90">
              {item.icon}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
