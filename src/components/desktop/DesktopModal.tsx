import React, { useState } from 'react';
import {
  Monitor,
  X,
  Check,
  Copy,
  Terminal,
  Volume2,
  Keyboard,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Laptop,
  Smartphone,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { usePWAInstall } from '../pwa/usePWAInstall';

export const DesktopModal: React.FC = () => {
  const { isDesktopModalOpen, setIsDesktopModalOpen, settings, setActiveTab: setPlayerTab } = usePlayer();
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'pwa' | 'background' | 'apk' | 'exe'>('background');
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  if (!isDesktopModalOpen) return null;
  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;

  const buildExeCommands = `# 1. Dans le dossier de l'application exportée :
npm install
# 2. Générer l'exécutable Windows HMD-Music-Setup.exe :
npm run build:exe`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(buildExeCommands);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  return (
    <div
      onClick={() => setIsDesktopModalOpen(false)}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 ${
        isSpotify ? 'bg-black/80' : 'bg-black/75 backdrop-blur-md'
      }`}
    >
      <div
        className={`w-full max-w-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto relative shadow-2xl ${
          isSpotify
            ? 'rounded-xl bg-[#181818] border border-white/10 text-white'
            : isUltra
            ? 'rounded-2xl bg-[#101014] border border-white/[0.12] text-zinc-100'
            : 'rounded-3xl liquid-glass border border-white/20 text-slate-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                isSpotify
                  ? 'bg-[#1DB954] text-black'
                  : isUltra
                  ? 'bg-white text-zinc-950'
                  : 'bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-indigo-500/20'
              }`}
            >
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white">
                Arrière-plan, APK Android & Bureau
              </h2>
              <p className="text-xs text-[#B3B3B3] mt-0.5">
                Lecture écran éteint sur téléphone (APK), contrôle multimédia et version Bureau.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDesktopModalOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl border ${
            isSpotify
              ? 'bg-[#121212] border-white/[0.08]'
              : isUltra
              ? 'bg-white/[0.04] border-white/[0.08]'
              : 'liquid-glass border-white/10'
          }`}
        >
          {[
            { id: 'background', label: 'Arrière-plan' },
            { id: 'apk', label: 'APK Android' },
            { id: 'pwa', label: 'Installer (PWA)' },
            { id: 'exe', label: 'Fichier .exe' },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? isSpotify
                      ? 'bg-[#1DB954] text-black font-bold'
                      : isUltra
                      ? 'bg-white text-zinc-950'
                      : 'bg-indigo-600/40 text-cyan-300 shadow border border-indigo-500/40'
                    : 'text-[#B3B3B3] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Instant PWA Desktop */}
        {activeTab === 'pwa' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-300">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-cyan-500/10 to-transparent border border-cyan-400/20 space-y-3">
              <div className="flex items-center gap-2 font-bold text-white text-sm sm:text-base">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Installation directe sur le Bureau Windows</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sur Windows (via Google Chrome, Microsoft Edge ou Brave), vous pouvez installer HMD Music en une seconde sans rien télécharger.
                Un <strong>raccourci officiel</strong> se place directement sur votre <strong>Bureau</strong> et dans votre <strong>menu Démarrer</strong>.
              </p>

              <div className="pt-1">
                {isInstalled ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium text-xs">
                    <Check className="w-4 h-4" />
                    <span>HMD Music est déjà installé sur votre Bureau !</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={async () => {
                        if (isInstallable) {
                          await install();
                        } else {
                          setShowInstallHelp(true);
                        }
                      }}
                      className={`flex items-center gap-2.5 px-6 py-3 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        isSpotify
                          ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                          : 'rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-xl shadow-cyan-500/20 hover:scale-105 active:scale-95'
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      <span>Ajouter HMD Music à mon Bureau Windows</span>
                    </button>
                    {showInstallHelp && (
                      <div className="p-3 rounded-xl bg-black/30 border border-white/15 text-xs text-slate-300 leading-relaxed">
                        Cliquez sur l'icône d'installation dans la barre d'adresse de votre navigateur (Chrome/Edge) ou ouvrez le menu (…) → <strong>Installer HMD Music</strong>.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-indigo-400" />
                  <span>Fenêtre indépendante</span>
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  S'exécute comme un vrai logiciel de bureau sans barre de navigation web, avec son icône dans la barre des tâches.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span>Arrière-plan permanent</span>
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Continue de jouer votre musique même quand vous réduisez la fenêtre pour jouer à un jeu ou travailler.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Background Playback Guide */}
        {activeTab === 'background' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-300">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-cyan-400" />
                <span>Comment fonctionne la lecture en arrière-plan ?</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                HMD Music intègre l'API <strong>Media Session</strong> standard de Windows, macOS et Android. Vous pouvez contrôler la musique sans jamais devoir réouvrir la fenêtre :
              </p>

              <div className="space-y-2 pt-1 text-xs">
                {/* Configured Custom Key Highlight */}
                <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/30">
                  <div className="flex items-start gap-2.5">
                    <Keyboard className="w-4 h-4 text-cyan-300 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-white">Votre touche personnalisée configurée :</span>
                      <p className="text-slate-300 mt-0.5">
                        Appuyez sur <kbd className="px-1.5 py-0.5 rounded bg-black/50 text-cyan-300 font-mono text-[11px] border border-cyan-400/40">{settings.customPauseKeyLabel || 'Espace'}</kbd> pour mettre en pause ou reprendre la musique.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsDesktopModalOpen(false);
                      setPlayerTab('settings');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-300 text-[11px] font-semibold transition-colors flex-shrink-0 cursor-pointer"
                  >
                    Modifier
                  </button>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/20 border border-white/5">
                  <Keyboard className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Touches Multimédias du clavier :</span>
                    <p className="text-slate-400 mt-0.5">
                      Les touches ⏯ (Lecture/Pause), ⏭ (Suivant) et ⏮ (Précédent) de votre clavier pilotent directement HMD Music en arrière-plan.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/20 border border-white/5">
                  <Monitor className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Bandeau de volume Windows 10 & 11 :</span>
                    <p className="text-slate-400 mt-0.5">
                      Quand vous montez ou baissez le son sous Windows, le titre, l'artiste, la pochette et les commandes de saut s'affichent automatiquement à l'écran.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/20 border border-white/5">
                  <Laptop className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Écran de verrouillage :</span>
                    <p className="text-slate-400 mt-0.5">
                      La musique continue sans coupure même lorsque votre session ou votre écran est verrouillé.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Android APK Screen-Off & Close-App Resilience */}
        {activeTab === 'apk' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-300">
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.1] space-y-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-white" />
                <span>Lecture écran éteint & APK Android</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                HMD Music intègre un maintien audio actif (<strong>Media Session + flux audio de maintien + reprise automatique</strong>) pour empêcher la pause automatique lorsque l'écran s'éteint ou que vous quittez l'application.
              </p>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-1">
                  <p className="font-semibold text-white">1. Dans Paramètres Android de votre téléphone :</p>
                  <p className="text-slate-400 leading-relaxed">
                    Allez dans <strong>Paramètres → Applications → HMD Music → Batterie</strong> et sélectionnez <strong>« Non restreinte »</strong> (ou « Sans optimisation »). Cela empêche Android de couper le son quand l'écran est verrouillé.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-1">
                  <p className="font-semibold text-white">2. Dans votre générateur de site en APK :</p>
                  <p className="text-slate-400 leading-relaxed">
                    Si votre site web-vers-APK propose une option <strong>« Lecture audio en arrière-plan / Background Media / Keep Service Running »</strong>, activez-la : Android continuera de faire tourner l'app même si vous la fermez depuis les applications récentes.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-1">
                  <p className="font-semibold text-white">3. Sauvegarde automatique de la position :</p>
                  <p className="text-slate-400 leading-relaxed">
                    Votre morceau en cours, votre position exacte (en secondes), vos playlists et votre historique sont sauvegardés localement à tout moment pour reprendre sans rien perdre.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'exe' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-300">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <Terminal className="w-5 h-5 text-indigo-400" />
                <span>Compiler en véritable fichier « HMD-Music-Setup.exe »</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Les fichiers sources de configuration **Electron** (<code className="text-cyan-300 font-mono">electron/main.cjs</code>) ont été ajoutés directement au projet avec gestion de la barre des tâches Windows (Systray près de l'horloge) et raccourcis globaux.
              </p>

              <div className="space-y-2">
                <p className="font-semibold text-white text-xs">Commandes pour générer l'installateur Windows (.exe) :</p>
                <div className="relative rounded-2xl bg-black/40 border border-white/15 p-3.5 font-mono text-xs text-slate-200">
                  <pre className="overflow-x-auto whitespace-pre-wrap">{buildExeCommands}</pre>
                  <button
                    onClick={copyToClipboard}
                    className="absolute right-2 top-2 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center gap-1.5 text-[11px] cursor-pointer"
                  >
                    {copiedCommand ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCommand ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-white">Comment télécharger le code source sur votre PC ?</p>
                <p className="text-slate-400">
                  Dans le menu en haut à droite d'AI Studio, cliquez sur <strong>Export</strong> ou téléchargez le ZIP du projet, puis exécutez la commande ci-dessus dans votre terminal pour obtenir votre exécutable autonome.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => setIsDesktopModalOpen(false)}
            className={`px-5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
              isSpotify
                ? 'rounded-full bg-white text-black hover:bg-white/90'
                : 'rounded-2xl bg-white/10 hover:bg-white/15 text-white'
            }`}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
