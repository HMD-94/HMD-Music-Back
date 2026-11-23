/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { LiquidBackground } from './components/layout/LiquidBackground';
import { MouseGlow } from './components/layout/MouseGlow';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { GlassPlayer } from './components/player/GlassPlayer';
import { FullscreenPlayer } from './components/player/FullscreenPlayer';
import { QueueModal } from './components/player/QueueModal';
import { AddToPlaylistModal } from './components/music/AddToPlaylistModal';
import { SpotifyImportModal } from './components/music/SpotifyImportModal';
import { DesktopModal } from './components/desktop/DesktopModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';

import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { TiktokSongPage } from './pages/TiktokSongPage';
import { LibraryPage } from './pages/LibraryPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { SettingsPage } from './pages/SettingsPage';

const AppContent: React.FC = () => {
  const { activeTab, settings, isThemeTransitioning } = usePlayer();

  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;

  return (
    <div
      className={`relative min-h-screen w-full flex overflow-hidden font-sans transition-colors duration-300 ${
        isSpotify
          ? 'bg-[#121212] md:bg-black text-white selection:bg-[#1DB954]/30 selection:text-white'
          : isUltra
          ? 'bg-[#08080a] text-zinc-100 selection:bg-white/20 selection:text-white'
          : 'bg-[#080b13] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200'
      }`}
    >
      {/* Subtle GPU veil during Mode Ultra <-> Mode Spotify switch (zero lag, zero audio interruption) */}
      {isThemeTransitioning && (
        <div
          key={isSpotify ? 'to-spotify' : 'to-ultra'}
          aria-hidden="true"
          className={`fixed inset-0 pointer-events-none z-[90] animate-theme-flash ${
            isSpotify ? 'bg-[#1DB954]' : 'bg-white'
          }`}
        />
      )}

      {/* Dynamic Animated Liquid Glass Background */}
      <LiquidBackground />

      {/* Mouse follow light effect (desktop) */}
      <MouseGlow />

      {/* Network offline status alert */}
      <OfflineIndicator />

      {/* Application Container */}
      <div className="relative z-10 flex w-full h-screen overflow-hidden">
        {/* Desktop / Tablet Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main
          id="main-content-scroll"
          className={`flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 relative scroll-smooth no-scrollbar ${
            isSpotify
              ? 'h-full md:h-[calc(100vh-5.75rem)] md:my-2 md:mr-2 md:rounded-lg bg-[#121212]'
              : 'h-full'
          }`}
        >
          <div className="max-w-7xl mx-auto">
            {activeTab === 'home' && <HomePage />}
            {activeTab === 'search' && <SearchPage />}
            {activeTab === 'tiktok' && <TiktokSongPage />}
            {activeTab === 'library' && <LibraryPage />}
            {activeTab === 'playlist' && <PlaylistPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav />

      {/* Fixed Bottom Liquid Glass Player */}
      <GlassPlayer />

      {/* Fullscreen Player Modal */}
      <FullscreenPlayer />

      {/* Queue Drawer */}
      <QueueModal />

      {/* Add To Playlist Modal Dialog */}
      <AddToPlaylistModal />

      {/* Spotify Playlist Import Modal */}
      <SpotifyImportModal />

      {/* Desktop App & .exe Background Modal */}
      <DesktopModal />
    </div>
  );
};

export default function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}
