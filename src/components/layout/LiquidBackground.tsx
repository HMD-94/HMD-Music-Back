import React from 'react';
import { usePlayer } from '../../context/PlayerContext';

export const LiquidBackground: React.FC = () => {
  const { isPlaying, settings, currentTrack } = usePlayer();
  const intensity = settings.glassBlurIntensity;

  // Classic Spotify Mode: pure solid black shell with zero GPU blur or animation lag
  if (settings.spotifyMode) {
    return (
      <div
        className="fixed inset-0 pointer-events-none z-0 select-none bg-[#121212] md:bg-black"
        aria-hidden="true"
      />
    );
  }

  // Ultra Mode uses a calm, GPU-light studio obsidian backdrop with subtle album-art ambient wash
  if (settings.ultraMode) {
    return (
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none bg-[#08080a]"
        aria-hidden="true"
      >
        {currentTrack && (
          <img
            src={currentTrack.thumbnail}
            alt=""
            className="hidden sm:block absolute -top-20 left-1/2 -translate-x-1/2 w-[640px] max-w-none h-[380px] object-cover blur-3xl opacity-[0.15] transition-opacity duration-500"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 85% 55% at 50% 0%, rgba(255,255,255,0.045), transparent 70%)',
          }}
        />
      </div>
    );
  }

  const blurClass =
    intensity === 'low' ? 'blur-xl opacity-30' : intensity === 'medium' ? 'blur-2xl opacity-40' : 'blur-2xl opacity-50';

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none transition-opacity duration-1000"
      aria-hidden="true"
    >
      {/* Liquid Orb 1 - Cyan / Indigo */}
      <div
        className={`hidden sm:block absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-gradient-to-tr from-indigo-600/30 via-cyan-500/25 to-blue-500/20 ${blurClass} transition-transform duration-[6000ms] ease-out ${
          isPlaying ? 'scale-105' : 'scale-100'
        }`}
        style={{
          animation: 'liquidFloat1 18s ease-in-out infinite alternate',
        }}
      />

      {/* Liquid Orb 2 - Violet / Magenta */}
      <div
        className={`hidden sm:block absolute top-1/4 -right-40 w-[520px] h-[520px] rounded-full bg-gradient-to-bl from-purple-600/25 via-fuchsia-500/20 to-indigo-700/25 ${blurClass} transition-transform duration-[7000ms] ease-out ${
          isPlaying ? 'scale-105' : 'scale-100'
        }`}
        style={{
          animation: 'liquidFloat2 22s ease-in-out infinite alternate',
        }}
      />

      {/* Lightweight static gradient fallback for mobile screens (zero GPU lag) */}
      <div
        className="sm:hidden absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 15% 15%, rgba(99,102,241,0.18), transparent 45%), radial-gradient(circle at 85% 40%, rgba(56,189,248,0.14), transparent 45%)',
        }}
      />

      {/* Glass Mesh Grid Overlay for subtle tactile texture */}
      <div className="hidden sm:block absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:24px_24px] dark:opacity-40 opacity-20" />

      <style>{`
        @keyframes liquidFloat1 {
          0% { transform: translate(0px, 0px) rotate(0deg); }
          50% { transform: translate(60px, 40px) rotate(45deg); }
          100% { transform: translate(-30px, 80px) rotate(90deg); }
        }
        @keyframes liquidFloat2 {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-50px, 60px) scale(1.08); }
          100% { transform: translate(30px, -40px) scale(0.96); }
        }
        @keyframes liquidFloat3 {
          0% { transform: translate(0px, 0px); }
          50% { transform: translate(40px, -50px); }
          100% { transform: translate(-60px, 20px); }
        }
      `}</style>
    </div>
  );
};
