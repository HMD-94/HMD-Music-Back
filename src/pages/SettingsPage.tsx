import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Monitor,
  Keyboard,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  Activity,
  Download,
  Cloud,
  RefreshCw,
  LogIn,
  LogOut,
  UserPlus,
  Lock,
  User,
  AlertCircle,
  Loader2,
  Heart,
  ListMusic,
  History,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { GlassBlurIntensity } from '../types/music';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import { StorageService } from '../services/storage';

function formatKeyLabel(code: string, key?: string): string {
  if (!code && !key) return 'Espace';
  if (code === 'Space' || key === ' ' || key === 'Spacebar') return 'Espace';
  if (code.startsWith('Key')) return code.replace('Key', '').toUpperCase();
  if (code.startsWith('Digit')) return `Chiffre ${code.replace('Digit', '')}`;
  if (code.startsWith('Numpad')) return `Pavé Num ${code.replace('Numpad', '')}`;
  if (/^F\d+$/i.test(code)) return code.toUpperCase();
  if (code === 'MediaPlayPause') return 'Touche Multimédia ⏯';
  if (code === 'Pause') return 'Touche Pause / Break';
  if (code === 'Enter') return 'Entrée';
  if (code === 'Backspace') return 'Retour arrière';
  if (code === 'ArrowUp') return 'Flèche Haut';
  if (code === 'ArrowDown') return 'Flèche Bas';
  if (code === 'ArrowLeft') return 'Flèche Gauche';
  if (code === 'ArrowRight') return 'Flèche Droite';
  return key ? key.toUpperCase() : code;
}

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    setIsDesktopModalOpen,
    setIsSpotifyModalOpen,
    isPlaying,
    togglePlayPause,
    currentTrack,
    favorites,
    playlists,
    history,
    authUser,
    isAuthReady,
    syncStatus,
    lastSyncedAt,
    syncError,
    signUpWithUsername,
    signInWithUsername,
    signOutAccount,
    syncNow,
    clearSyncError,
  } = usePlayer();

  const [apiKeyInput, setApiKeyInput] = useState(settings.youtubeApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Optional Account & Sync UI state (username + password, no email required)
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authFormError, setAuthFormError] = useState<string | null>(null);
  const [authSuccessToast, setAuthSuccessToast] = useState<string | null>(null);

  // Custom Pause Key configuration state
  const [isListeningForKey, setIsListeningForKey] = useState(false);
  const [keySavedToast, setKeySavedToast] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Capture pressed key when listening
  useEffect(() => {
    if (!isListeningForKey) return;

    const handleCaptureKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Pressing Escape cancels listening
      if (e.key === 'Escape') {
        setIsListeningForKey(false);
        return;
      }

      const code = e.code || e.key;
      const label = formatKeyLabel(code, e.key);

      updateSettings({
        customPauseKey: code,
        customPauseKeyLabel: label,
      });

      setIsListeningForKey(false);
      setKeySavedToast(`Touche « ${label} » configurée avec succès !`);
      setTimeout(() => setKeySavedToast(null), 3000);
    };

    window.addEventListener('keydown', handleCaptureKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleCaptureKey, { capture: true });
    };
  }, [isListeningForKey, updateSettings]);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ youtubeApiKey: apiKeyInput.trim() });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleResetData = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 5000);
      return;
    }
    StorageService.clearAllData();
    window.location.reload();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFormError(null);
    clearSyncError();

    const trimmedUsername = authUsername.trim();
    if (trimmedUsername.length < 2) {
      setAuthFormError("Choisissez un nom d'utilisateur d'au moins 2 caractères.");
      return;
    }
    if (authPassword.length < 6) {
      setAuthFormError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      if (authMode === 'signup') {
        await signUpWithUsername(trimmedUsername, authPassword);
        setAuthSuccessToast(
          'Compte créé ! Vos écoutes précédentes ont été enregistrées et synchronisées.'
        );
      } else {
        await signInWithUsername(trimmedUsername, authPassword);
        setAuthSuccessToast('Connecté ! Vos écoutes et playlists sont synchronisées.');
      }
      setAuthPassword('');
      window.setTimeout(() => setAuthSuccessToast(null), 5000);
    } catch (err: any) {
      setAuthFormError(err?.message || 'Impossible de finaliser la connexion.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleManualSync = async () => {
    setAuthFormError(null);
    clearSyncError();
    try {
      await syncNow();
      setAuthSuccessToast('Synchronisation réussie !');
      window.setTimeout(() => setAuthSuccessToast(null), 3000);
    } catch (err: any) {
      setAuthFormError(err?.message || 'Erreur lors de la synchronisation.');
    }
  };

  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = !isSpotify;

  const sectionCardClass = isSpotify
    ? 'rounded-xl bg-[#181818] border border-white/[0.06] transition-colors duration-300'
    : 'rounded-2xl bg-white/[0.03] border border-white/[0.08] transition-colors duration-300';

  const selectThemeMode = (mode: 'ultra' | 'spotify') => {
    if (mode === 'spotify' && !isSpotify) {
      updateSettings({ spotifyMode: true, ultraMode: false });
    } else if (mode === 'ultra' && isSpotify) {
      updateSettings({ ultraMode: true, spotifyMode: false });
    }
  };

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-3xl pb-32 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
          Paramètres{' '}
          {isSpotify ? (
            <span className="text-[#1DB954]">· Mode Spotify</span>
          ) : (
            <span className="text-zinc-200">· Mode Ultra</span>
          )}
        </h1>
        <p className="text-xs sm:text-sm text-[#B3B3B3] mt-1">
          Choisissez votre thème, synchronisez vos écoutes entre vos appareils et configurez votre lecteur.
        </p>
      </div>

      {/* 1. Theme Switcher (Mode Ultra <-> Mode Spotify only, with smooth spring animation) */}
      <section className={`p-5 sm:p-6 space-y-5 ${sectionCardClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-base text-white">
              Thème de l&apos;interface
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Basculez instantanément entre <strong>Mode Ultra</strong> et <strong>Mode Spotify</strong> sans couper la musique.
            </p>
          </div>

          {/* Animated Segmented Switcher */}
          <div
            role="radiogroup"
            aria-label="Choix du thème"
            className="relative inline-grid grid-cols-2 p-1 rounded-full bg-black/60 border border-white/10 self-start sm:self-auto"
          >
            <button
              id="switch-theme-ultra-btn"
              type="button"
              role="radio"
              aria-checked={isUltra}
              onClick={() => selectThemeMode('ultra')}
              className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer ${
                isUltra ? 'text-zinc-950' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isUltra && (
                <motion.span
                  layoutId="hmd-theme-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-white shadow-sm -z-10"
                />
              )}
              Mode Ultra
            </button>

            <button
              id="switch-theme-spotify-btn"
              type="button"
              role="radio"
              aria-checked={isSpotify}
              onClick={() => selectThemeMode('spotify')}
              className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                isSpotify ? 'text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isSpotify && (
                <motion.span
                  layoutId="hmd-theme-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-[#1DB954] shadow-sm -z-10"
                />
              )}
              <span>Mode Spotify</span>
            </button>
          </div>
        </div>

        {/* Two Visual Theme Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card: Mode Ultra */}
          <button
            type="button"
            onClick={() => selectThemeMode('ultra')}
            className={`group text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
              isUltra
                ? 'bg-white/[0.08] border-white/60 shadow-lg shadow-black/30'
                : 'bg-black/25 border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-white inline-block" />
                <span className="font-display font-bold text-sm text-white">Mode Ultra</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  isUltra ? 'bg-white text-zinc-950' : 'bg-white/10 text-zinc-400'
                }`}
              >
                {isUltra ? 'Actif' : 'Choisir'}
              </span>
            </div>

            {/* Mini preview */}
            <div className="h-12 rounded-xl bg-[#09090b] border border-white/10 p-2 flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-white/15" />
                <div className="space-y-1">
                  <div className="w-16 h-1.5 rounded bg-white/80" />
                  <div className="w-10 h-1 rounded bg-white/30" />
                </div>
              </div>
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                <div className="w-2 h-2 bg-zinc-950 rounded-[1px]" />
              </div>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Design studio minimaliste noir &amp; blanc, lecteur flottant fluide et lecture optimisée en arrière-plan.
            </p>
          </button>

          {/* Card: Mode Spotify */}
          <button
            type="button"
            onClick={() => selectThemeMode('spotify')}
            className={`group text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
              isSpotify
                ? 'bg-[#1DB954]/10 border-[#1DB954] shadow-lg shadow-[#1DB954]/10'
                : 'bg-black/25 border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#1DB954] inline-block" />
                <span className="font-display font-bold text-sm text-white">Mode Spotify</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  isSpotify ? 'bg-[#1DB954] text-black' : 'bg-white/10 text-zinc-400'
                }`}
              >
                {isSpotify ? 'Actif' : 'Choisir'}
              </span>
            </div>

            {/* Mini preview */}
            <div className="h-12 rounded-xl bg-black border border-white/10 p-2 flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#282828]" />
                <div className="space-y-1">
                  <div className="w-16 h-1.5 rounded bg-white" />
                  <div className="w-10 h-1 rounded bg-[#B3B3B3]" />
                </div>
              </div>
              <div className="w-6 h-6 rounded-full bg-[#1DB954] flex items-center justify-center">
                <div className="w-2 h-2 bg-black rounded-[1px]" />
              </div>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Interface Spotify classique (noir pur, cartes #181818, boutons verts #1DB954) avec fluidité maximale.
            </p>
          </button>
        </div>
      </section>

      {/* 2. Optional Account & Cross-Device Cloud Sync */}
      <section className={`p-5 sm:p-6 space-y-4 ${sectionCardClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Cloud className={`w-5 h-5 ${isSpotify ? 'text-[#1DB954]' : 'text-white'}`} />
              <h3 className="font-display font-bold text-base text-white">
                Compte &amp; Synchronisation
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-zinc-300">
                Facultatif
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Pas obligatoire pour écouter. Si vous créez un compte, toutes vos musiques déjà écoutées, favoris, playlists et sons TikTok sont enregistrés et synchronisés dès que vous vous connectez sur un autre téléphone.
            </p>
          </div>

          {authUser && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                syncStatus === 'syncing'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                  : syncStatus === 'error'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-400/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
              }`}
            >
              {syncStatus === 'syncing' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Synchronisation…</span>
                </>
              ) : syncStatus === 'error' ? (
                <>
                  <AlertCircle className="w-3 h-3" />
                  <span>Erreur de synchro</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  <span>
                    Synchronisé{formattedSyncTime ? ` · ${formattedSyncTime}` : ''}
                  </span>
                </>
              )}
            </span>
          )}
        </div>

        {authSuccessToast && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-medium">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{authSuccessToast}</span>
          </div>
        )}

        {(authFormError || syncError) && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{authFormError || syncError}</span>
          </div>
        )}

        {!isAuthReady ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Vérification du compte…</span>
          </div>
        ) : authUser ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-display font-bold text-base flex-shrink-0 ${
                    isSpotify ? 'bg-[#1DB954] text-black' : 'bg-white text-zinc-950'
                  }`}
                >
                  {(authUser.username || authUser.displayName || 'H').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-white truncate">
                    {authUser.username || authUser.displayName || 'Compte HMD Music'}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    Synchronisation cloud active · Sans e-mail
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncStatus === 'syncing'}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    isSpotify
                      ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                      : 'rounded-xl bg-white hover:bg-white/90 text-zinc-950'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>Synchroniser</span>
                </button>
                <button
                  type="button"
                  onClick={signOutAccount}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    isSpotify
                      ? 'rounded-full bg-[#282828] hover:bg-[#333333] text-white'
                      : 'rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 border border-white/10'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Heart className={`w-4 h-4 mx-auto mb-1 ${isSpotify ? 'text-[#1DB954]' : 'text-white'}`} />
                <p className="font-display font-bold text-base text-white">{favorites.length}</p>
                <p className="text-[11px] text-zinc-400">Favoris</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <ListMusic className={`w-4 h-4 mx-auto mb-1 ${isSpotify ? 'text-[#1DB954]' : 'text-white'}`} />
                <p className="font-display font-bold text-base text-white">{playlists.length}</p>
                <p className="text-[11px] text-zinc-400">Playlists</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <History className={`w-4 h-4 mx-auto mb-1 ${isSpotify ? 'text-[#1DB954]' : 'text-white'}`} />
                <p className="font-display font-bold text-base text-white">{history.length}</p>
                <p className="text-[11px] text-zinc-400">Écoutes récentes</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode Tabs: Sign Up / Sign In */}
            <div className="inline-flex p-1 rounded-full bg-black/50 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthFormError(null);
                  clearSyncError();
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  authMode === 'signup'
                    ? isSpotify
                      ? 'bg-[#1DB954] text-black'
                      : 'bg-white text-zinc-950'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Créer un compte</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthFormError(null);
                  clearSyncError();
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  authMode === 'signin'
                    ? isSpotify
                      ? 'bg-[#1DB954] text-black'
                      : 'bg-white text-zinc-950'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Se connecter</span>
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    minLength={2}
                    autoComplete="username"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    placeholder="Nom d'utilisateur (sans e-mail)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/35 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
                    disabled={isAuthSubmitting}
                  />
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showAuthPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Mot de passe (6+ caractères)"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-black/35 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
                    disabled={isAuthSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword(!showAuthPassword)}
                    className="p-1.5 text-zinc-400 hover:text-white absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                    title={showAuthPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-zinc-400">
                  {authMode === 'signup'
                    ? `${history.length} écoute(s), ${favorites.length} favori(s) et ${playlists.length} playlist(s) déjà sur cet appareil seront sauvegardés.`
                    : 'Vos écoutes locales actuelles seront fusionnées sans perte avec votre compte.'}
                </p>
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0 ${
                    isSpotify
                      ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                      : 'rounded-xl bg-white hover:bg-white/90 text-zinc-950'
                  }`}
                >
                  {isAuthSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connexion…</span>
                    </>
                  ) : authMode === 'signup' ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Créer le compte</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Se connecter</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* 2. YouTube Data API Configuration */}
      <section className={`p-6 space-y-4 ${sectionCardClass}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-base text-white">Clé API YouTube Data v3</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Pour débloquer la recherche mondiale illimitée sur tout YouTube, ajoutez votre propre clé API officielle Google Cloud YouTube Data v3.
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
              settings.youtubeApiKey
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {settings.youtubeApiKey ? 'Configurée' : 'Catalogue Local'}
          </span>
        </div>

        <form onSubmit={handleSaveApiKey} className="space-y-3">
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Ex: AIzaSyD..."
              className="w-full px-4 py-3 pr-24 rounded-2xl bg-black/20 border border-white/15 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                title={showApiKey ? 'Masquer' : 'Afficher'}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                type="submit"
                className={`px-3 py-1.5 font-bold text-xs transition-colors cursor-pointer ${
                  isSpotify
                    ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                    : 'rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                }`}
              >
                {isSaved ? <Check className="w-4 h-4" /> : 'Enregistrer'}
              </button>
            </div>
          </div>

          {isSaved && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium animate-in fade-in">
              <Check className="w-4 h-4" />
              <span>Clé API enregistrée avec succès dans votre stockage local !</span>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Conformité & Confidentialité YouTube</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Votre clé reste strictement sur votre navigateur et n'est jamais transmise à des tiers. Les flux sont lus via l'IFrame Player officiel de YouTube, respectant scrupuleusement les conditions d'utilisation de YouTube.
            </p>
            <a
              href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-medium text-xs pt-1"
            >
              <span>Obtenir une clé YouTube Data API gratuite sur Google Cloud</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </form>
      </section>

      {/* 3. Playback Options */}
      <section className={`p-6 space-y-4 ${sectionCardClass}`}>
        <div>
          <h3 className="font-bold text-base text-white">Options de lecture</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Comportement du lecteur audio.
          </p>
        </div>

        <div className="space-y-3">
          {/* Autoplay toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
            <div>
              <p className="font-semibold text-sm text-white">Enchaînement automatique</p>
              <p className="text-xs text-slate-400">
                Passer automatiquement au morceau suivant à la fin d'une musique.
              </p>
            </div>
            <button
              onClick={() => updateSettings({ autoPlayNext: !settings.autoPlayNext })}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                settings.autoPlayNext
                  ? isSpotify
                    ? 'bg-[#1DB954]'
                    : 'bg-cyan-400'
                  : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                  settings.autoPlayNext ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Quality & Interface Options */}
      <section className={`p-6 space-y-4 ${sectionCardClass}`}>
        <div>
          <h3 className="font-bold text-base text-white">Interface & Effets visuels</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ajustez la fluidité selon les performances de votre appareil.
          </p>
        </div>

        <div className="space-y-3">
          {/* Blur Intensity */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
            <div>
              <p className="font-semibold text-sm text-white">Intensité du flou d'arrière-plan</p>
              <p className="text-xs text-slate-400">
                Ajuste le flou (backdrop-filter) pour une vitesse optimale.
              </p>
            </div>
            <div
              className={`flex items-center gap-1.5 p-1 rounded-xl border border-white/10 ${
                isSpotify ? 'bg-[#121212]' : 'liquid-glass'
              }`}
            >
              {(['low', 'medium', 'high'] as GlassBlurIntensity[]).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => updateSettings({ glassBlurIntensity: lvl })}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    settings.glassBlurIntensity === lvl
                      ? isSpotify
                        ? 'bg-[#1DB954] text-black'
                        : 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl === 'low' ? 'Bas' : lvl === 'medium' ? 'Moyen' : 'Élevé'}
                </button>
              ))}
            </div>
          </div>

          {/* Mouse Glow */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
            <div>
              <p className="font-semibold text-sm text-white">Lueur interactive de la souris</p>
              <p className="text-xs text-slate-400">
                Halo lumineux subtil qui suit le curseur sur ordinateur.
              </p>
            </div>
            <button
              onClick={() => updateSettings({ mouseGlowEffect: !settings.mouseGlowEffect })}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                settings.mouseGlowEffect
                  ? isSpotify
                    ? 'bg-[#1DB954]'
                    : 'bg-cyan-400'
                  : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                  settings.mouseGlowEffect ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Fullscreen Edge Rhythm Visualizer */}
          <div
            className={`flex items-center justify-between p-3.5 rounded-2xl border ${
              isSpotify
                ? 'bg-white/[0.04] border-white/[0.08]'
                : 'bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-transparent border-cyan-400/30'
            }`}
          >
            <div className="pr-4">
              <div className="flex items-center gap-2">
                <Activity className={`w-4 h-4 ${isSpotify ? 'text-[#1DB954]' : 'text-cyan-400'}`} />
                <p className="font-semibold text-sm text-white">
                  Effets de rythme sur les bords de l'écran (Activé par défaut)
                </p>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    isSpotify
                      ? 'bg-[#1DB954]/15 text-[#1DB954] border-[#1DB954]/30'
                      : 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30'
                  }`}
                >
                  Grand écran
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Affiche des égaliseurs et ondes lumineuses réactives à droite et à gauche de l'écran qui pulsent en rythme avec la musique lorsque le morceau est affiché en plein écran.
              </p>
            </div>
            <button
              onClick={() =>
                updateSettings({
                  fullscreenEdgeVisualizer: settings.fullscreenEdgeVisualizer === false ? true : false,
                })
              }
              className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 ${
                settings.fullscreenEdgeVisualizer !== false
                  ? isSpotify
                    ? 'bg-[#1DB954]'
                    : 'bg-gradient-to-r from-cyan-400 to-indigo-500'
                  : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                  settings.fullscreenEdgeVisualizer !== false ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 5. Custom Keyboard Shortcut for Play/Pause in Background */}
      <section className={`p-6 space-y-5 relative overflow-hidden ${sectionCardClass}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-300">
                <Keyboard className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-base text-white">Touche Clavier Personnalisée (Pause & Arrière-plan)</h3>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Configurez une touche de votre clavier pour <strong>mettre en pause</strong> ou <strong>relancer la musique instantanément</strong>, même lorsque l'application est réduite ou en arrière-plan.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline-block text-[11px] text-slate-400">Touche active :</span>
            <div className="px-3 py-1.5 rounded-xl bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border border-cyan-400/50 text-cyan-300 font-mono font-bold text-xs shadow-lg shadow-cyan-500/15">
              {settings.customPauseKeyLabel || 'Espace'}
            </div>
          </div>
        </div>

        {/* Key Recorder Control */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-white">
                Enregistrer une touche personnalisée
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Cliquez puis appuyez sur n'importe quelle touche (F8, Espace, P, Pavé numérique...)
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isListeningForKey ? (
                <button
                  type="button"
                  onClick={() => setIsListeningForKey(false)}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs transition-all cursor-pointer"
                >
                  Annuler (Échap)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsListeningForKey(true)}
                  className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs transition-all cursor-pointer ${
                    isSpotify
                      ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                      : 'rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-slate-950 shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95'
                  }`}
                >
                  <Keyboard className="w-4 h-4" />
                  <span>Changer la touche</span>
                </button>
              )}

              {settings.customPauseKey !== 'Space' && (
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ customPauseKey: 'Space', customPauseKeyLabel: 'Espace' });
                    setKeySavedToast('Raccourci réinitialisé sur [ Espace ]');
                    setTimeout(() => setKeySavedToast(null), 2500);
                  }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Réinitialiser par défaut (Espace)"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Listening Mode Banner */}
          {isListeningForKey && (
            <div className="p-4 rounded-xl bg-cyan-500/20 border-2 border-dashed border-cyan-400 animate-pulse flex items-center justify-center text-center">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-bold text-cyan-200 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-300 animate-spin" />
                  <span>En écoute... Appuyez sur une touche de votre clavier maintenant !</span>
                </p>
                <p className="text-[11px] text-cyan-300/80">
                  Exemples recommandés : F8, P, Espace, Pause, Touche Média ⏯...
                </p>
              </div>
            </div>
          )}

          {/* Success Toast */}
          {keySavedToast && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium animate-in fade-in">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{keySavedToast}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div className="pt-1">
            <p className="text-[11px] font-medium text-slate-400 mb-2">Raccourcis populaires en 1 clic :</p>
            <div className="flex flex-wrap gap-2">
              {[
                { code: 'Space', label: 'Espace' },
                { code: 'F8', label: 'F8 (Idéal en jeu)' },
                { code: 'KeyP', label: 'Touche P (Pause)' },
                { code: 'Pause', label: 'Touche Pause / Break' },
                { code: 'MediaPlayPause', label: 'Média ⏯ (Clavier)' },
              ].map((preset) => {
                const isCurrent = settings.customPauseKey === preset.code;
                return (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => {
                      updateSettings({
                        customPauseKey: preset.code,
                        customPauseKeyLabel: preset.label.split(' ')[0],
                      });
                      setKeySavedToast(`Touche « ${preset.label} » activée !`);
                      setTimeout(() => setKeySavedToast(null), 2500);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      isSpotify ? 'rounded-full' : 'rounded-xl'
                    } ${
                      isCurrent
                        ? isSpotify
                          ? 'bg-[#1DB954] text-black font-bold'
                          : 'bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-400/25'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Test & Feedback Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 ${
                isPlaying ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-2">
                <span>Statut : {isPlaying ? 'Musique en lecture' : 'Musique en pause'}</span>
                {currentTrack && (
                  <span className="text-[11px] text-slate-400 font-normal truncate max-w-[200px]">
                    ({currentTrack.title})
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-400">
                Appuyez sur <kbd className="px-1.5 py-0.5 rounded bg-black/40 text-cyan-300 font-mono text-[10px] border border-white/20">{settings.customPauseKeyLabel || 'Espace'}</kbd> sur votre clavier pour tester.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={togglePlayPause}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer flex-shrink-0"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Mettre en pause' : 'Relancer la lecture'}</span>
          </button>
        </div>

        {/* Background explanation notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
          <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-400/20 space-y-1.5">
            <p className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <Monitor className="w-4 h-4 text-cyan-400" />
              <span>Application Bureau (.exe) : Toutes les touches partout</span>
            </p>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Pour que <strong>n'importe quelle touche personnalisée</strong> (ex: F8, P, Espace, Pavé numérique) mette en pause la musique quand vous êtes sur un autre jeu (Fortnite, GTA...), sur Discord ou sur le bureau, lancez l'application de bureau (.exe). Elle intercepte les raccourcis au niveau de Windows.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
            <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-indigo-400" />
              <span>Dans le Navigateur Web : Touche Multimédia ⏯</span>
            </p>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Pour des raisons de sécurité, les navigateurs (Chrome, Edge) bloquent les touches alphabétiques quand l'onglet n'a pas le focus. La touche <strong>Multimédia ⏯</strong> de votre clavier, vos écouteurs Bluetooth et le volet de volume Windows fonctionnent par contre en arrière-plan sans interruption grâce à la synchronisation audio permanente.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Desktop App, APK Background Audio, Spotify & Local Storage Data */}
      <section className={`p-6 space-y-4 ${sectionCardClass}`}>
        <div>
          <h3 className="font-bold text-base text-white">Arrière-plan (APK / Bureau), Spotify & Données locales</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Lecture écran éteint, import Spotify et sauvegarde locale (sons récents, goûts musicaux et playlists).
          </p>
        </div>

        {/* Spotify Import Card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.1]">
          <div>
            <div className="flex items-center gap-2">
              <Download className={`w-4 h-4 ${isSpotify ? 'text-[#1DB954]' : 'text-white'}`} />
              <p className="font-semibold text-sm text-white">Importer une playlist Spotify</p>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Collez un lien Spotify public ou une liste de titres pour la sauvegarder localement.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsSpotifyModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer flex-shrink-0 ${
              isSpotify
                ? 'bg-[#1DB954] hover:bg-[#1ed760] text-black'
                : isUltra
                ? 'bg-white text-zinc-950 hover:bg-white/90 rounded-xl'
                : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 rounded-xl'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Importer Spotify</span>
          </button>
        </div>

        {/* Desktop / APK Card */}
        <div
          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border ${
            isSpotify
              ? 'bg-white/[0.04] border-white/[0.08]'
              : isUltra
              ? 'bg-white/[0.04] border-white/[0.1]'
              : 'bg-gradient-to-r from-indigo-500/15 via-cyan-500/10 to-transparent border-cyan-400/30'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <Monitor className={`w-4 h-4 ${isSpotify ? 'text-[#1DB954]' : isUltra ? 'text-white' : 'text-cyan-400'}`} />
              <p className="font-semibold text-sm text-white">Lecture écran éteint (APK Android) & Bureau</p>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Guide pour maintenir la musique active écran verrouillé sur téléphone APK ou sur PC.
            </p>
          </div>
          <button
            onClick={() => setIsDesktopModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer flex-shrink-0 ${
              isSpotify
                ? 'rounded-full bg-white/[0.1] hover:bg-white/[0.16] text-white'
                : isUltra
                ? 'bg-white/[0.1] hover:bg-white/[0.16] text-white border border-white/[0.12]'
                : 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-lg shadow-cyan-500/20'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Configurer</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div>
            <p className="font-semibold text-sm text-white">Installation PWA</p>
            <p className="text-xs text-slate-400">
              Installez HMD Music directement sur votre écran d'accueil PC, Mac ou Smartphone.
            </p>
          </div>
          <PWAInstallButton variant="button" />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
          <div>
            <p className="font-semibold text-sm text-rose-300">Réinitialiser les données</p>
            <p className="text-xs text-rose-400/80">
              Efface les playlists personnalisées, l'historique et les favoris.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {confirmReset && (
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button
              onClick={handleResetData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{confirmReset ? 'Confirmer la réinitialisation' : 'Réinitialiser'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
