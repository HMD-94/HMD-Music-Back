import React, { useState } from 'react';
import { Download, Share2, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'button' | 'banner' | 'sidebar' }> = ({
  variant = 'button',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed as PWA, do not show prompt
  if (isInstalled) {
    return null;
  }

  if (variant === 'sidebar') {
    if (!isInstallable && !isIOS) return null;
    return (
      <>
        <button
          onClick={isInstallable ? install : () => setShowIOSGuide(true)}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 dark:text-indigo-300 border border-indigo-500/20 text-xs font-semibold tracking-wide transition-all duration-300 group cursor-pointer"
          title="Installer l'application HMD Music sur votre appareil"
        >
          <div className="w-6 h-6 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
            <Download className="w-3.5 h-3.5" />
          </div>
          <span className="truncate">Installer HMD Music</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl liquid-glass p-6 text-slate-100 shadow-2xl border border-white/20">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-semibold text-base">Installer sur iOS Safari</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-300 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                    1
                  </span>
                  <p>
                    Appuyez sur le bouton <Share2 className="w-4 h-4 inline text-indigo-400" /> <strong>Partager</strong> en bas de Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                    2
                  </span>
                  <p>
                    Faites défiler vers le bas et sélectionnez <strong>« Sur l'écran d'accueil »</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-white transition-all duration-200 shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                Compris
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Standard Button or Banner
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 active:scale-95 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installer l'app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-2xl liquid-glass px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
          <span>Installer iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl liquid-glass p-6 text-slate-100 shadow-2xl border border-white/20">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-semibold text-base">Installer sur iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-300 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                    1
                  </span>
                  <p>
                    Appuyez sur le bouton <Share2 className="w-4 h-4 inline text-indigo-400" /> <strong>Partager</strong> dans Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                    2
                  </span>
                  <p>
                    Sélectionnez <strong>« Sur l'écran d'accueil »</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
