import React, { useState } from 'react';
import {
  X,
  Link2,
  ListMusic,
  Loader2,
  CheckCircle2,
  Music,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { SpotifyService } from '../../services/spotify';
import { SpotifyPlaylistPreview, SpotifyTrackPreview } from '../../types/music';

interface ImportReport {
  playlistId: string;
  playlistTitle: string;
  importedCount: number;
  unmatched: SpotifyTrackPreview[];
}

export const SpotifyImportModal: React.FC = () => {
  const {
    isSpotifyModalOpen,
    setIsSpotifyModalOpen,
    settings,
    importPlaylistWithTracks,
    openPlaylist,
  } = usePlayer();

  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [manualTitle, setManualTitle] = useState('Ma Playlist Spotify');
  const [manualText, setManualText] = useState('');

  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [preview, setPreview] = useState<SpotifyPlaylistPreview | null>(null);
  const [customTitle, setCustomTitle] = useState('');

  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; currentTitle: string }>({
    done: 0,
    total: 0,
    currentTitle: '',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  if (!isSpotifyModalOpen) return null;

  const resetModalState = () => {
    setIsFetchingPreview(false);
    setIsImporting(false);
    setErrorMsg(null);
    setImportReport(null);
    setProgress({ done: 0, total: 0, currentTitle: '' });
  };

  const handleClose = () => {
    if (isImporting) return;
    resetModalState();
    setIsSpotifyModalOpen(false);
  };

  const handleAnalyzeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setErrorMsg(null);
    setImportReport(null);
    setPreview(null);
    setIsFetchingPreview(true);
    try {
      const result = await SpotifyService.fetchPlaylistFromUrl(urlInput.trim());
      setPreview(result);
      setCustomTitle(result.title);
    } catch (err: any) {
      setErrorMsg(err?.message || "Impossible de lire cette playlist Spotify.");
    } finally {
      setIsFetchingPreview(false);
    }
  };

  const handleConfirmUrlImport = async () => {
    if (!preview || preview.tracks.length === 0) return;

    setErrorMsg(null);
    setImportReport(null);
    setIsImporting(true);
    setProgress({ done: 0, total: Math.min(preview.tracks.length, 50), currentTitle: '' });

    try {
      const { resolved, unmatched } = await SpotifyService.resolveTracksToYouTube(
        preview.tracks,
        settings.youtubeApiKey,
        (done, total, currentTitle) => {
          setProgress({ done, total, currentTitle });
        }
      );

      if (resolved.length === 0) {
        const failedNames = unmatched
          .slice(0, 6)
          .map((t) => `${t.title}${t.artist ? ` (${t.artist})` : ''}`)
          .join(', ');
        setErrorMsg(
          `Aucun morceau n'a pu être trouvé sur YouTube (${unmatched.length} introuvable${
            unmatched.length > 1 ? 's' : ''
          }${failedNames ? ` : ${failedNames}${unmatched.length > 6 ? '...' : ''}` : ''}).`
        );
        setIsImporting(false);
        return;
      }

      const finalTitle = customTitle.trim() || preview.title;
      const created = importPlaylistWithTracks(
        finalTitle,
        `Importée depuis Spotify · ${resolved.length} titre${resolved.length > 1 ? 's' : ''}`,
        resolved,
        preview.coverImage
      );

      setIsImporting(false);
      setPreview(null);
      setUrlInput('');

      if (unmatched.length > 0) {
        setImportReport({
          playlistId: created.id,
          playlistTitle: finalTitle,
          importedCount: resolved.length,
          unmatched,
        });
      } else {
        setIsSpotifyModalOpen(false);
        openPlaylist(created.id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur pendant l'importation des morceaux.");
      setIsImporting(false);
    }
  };

  const handleConfirmTextImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = SpotifyService.parseManualTrackList(manualText);
    if (items.length === 0) {
      setErrorMsg('Collez au moins une ligne au format « Artiste - Titre ».');
      return;
    }

    setErrorMsg(null);
    setImportReport(null);
    setIsImporting(true);
    setProgress({ done: 0, total: Math.min(items.length, 50), currentTitle: '' });

    try {
      const { resolved, unmatched } = await SpotifyService.resolveTracksToYouTube(
        items,
        settings.youtubeApiKey,
        (done, total, currentTitle) => {
          setProgress({ done, total, currentTitle });
        }
      );

      if (resolved.length === 0) {
        setErrorMsg(
          `Aucun morceau trouvé sur YouTube (${unmatched.length} introuvable${
            unmatched.length > 1 ? 's' : ''
          }). Vérifiez l'orthographe « Artiste - Titre ».`
        );
        setIsImporting(false);
        return;
      }

      const finalTitle = manualTitle.trim() || 'Playlist Importée';
      const created = importPlaylistWithTracks(
        finalTitle,
        `Importée (${resolved.length} titre${resolved.length > 1 ? 's' : ''})`,
        resolved
      );

      setIsImporting(false);
      setManualText('');

      if (unmatched.length > 0) {
        setImportReport({
          playlistId: created.id,
          playlistTitle: finalTitle,
          importedCount: resolved.length,
          unmatched,
        });
      } else {
        setIsSpotifyModalOpen(false);
        openPlaylist(created.id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur pendant l'importation.");
      setIsImporting(false);
    }
  };

  const progressPercent =
    progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <div
      onClick={handleClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 ${
        isSpotify ? 'bg-black/80' : 'bg-black/75 backdrop-blur-md'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl ${
          isSpotify
            ? 'rounded-xl bg-[#181818] border border-white/10 text-white'
            : isUltra
            ? 'rounded-2xl bg-[#101014] border border-white/[0.12] text-zinc-100'
            : 'rounded-3xl liquid-glass border border-white/20 text-slate-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.08]">
          <div>
            <h3 className="font-display font-bold text-lg text-white">
              Importer une playlist Spotify
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Collez le lien de votre playlist Spotify publique ou une liste de titres pour la sauvegarder localement.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post-import report when some tracks could not be matched */}
        {importReport ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-emerald-500/12 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-white text-sm">
                  Playlist « {importReport.playlistTitle} » créée
                </p>
                <p className="text-emerald-200/90">
                  {importReport.importedCount} titre{importReport.importedCount > 1 ? 's' : ''} trouvé
                  {importReport.importedCount > 1 ? 's' : ''} et ajouté
                  {importReport.importedCount > 1 ? 's' : ''}.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/12 border border-amber-500/30 space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-100">
                    {importReport.unmatched.length} titre{importReport.unmatched.length > 1 ? 's' : ''} introuvable
                    {importReport.unmatched.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-amber-200/80 mt-0.5">
                    Ces sons n&apos;ont pas pu être trouvés sur YouTube et n&apos;ont pas été remplacés :
                  </p>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 divide-y divide-white/[0.06] rounded-xl bg-black/25 px-3 py-1.5">
                {importReport.unmatched.map((t, idx) => (
                  <div key={`${t.title}-${idx}`} className="py-1.5 text-xs flex items-center justify-between gap-2">
                    <span className="text-white font-medium truncate">{t.title}</span>
                    {t.artist && (
                      <span className="text-zinc-400 text-[11px] truncate flex-shrink-0 max-w-[45%]">
                        {t.artist}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const plId = importReport.playlistId;
                  resetModalState();
                  setIsSpotifyModalOpen(false);
                  openPlaylist(plId);
                }}
                className={`flex-1 py-3 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isSpotify
                    ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                    : isUltra
                    ? 'rounded-xl bg-white text-zinc-950 hover:bg-white/90'
                    : 'rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white'
                }`}
              >
                <span>Ouvrir la playlist</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={resetModalState}
                className={`px-4 py-3 bg-white/[0.07] hover:bg-white/[0.12] text-xs font-medium text-zinc-200 cursor-pointer ${
                  isSpotify ? 'rounded-full' : 'rounded-xl'
                }`}
              >
                Importer une autre
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mode Switcher */}
            <div
              className={`flex items-center gap-1.5 p-1 rounded-xl border ${
                isSpotify
                  ? 'bg-[#121212] border-white/[0.08]'
                  : isUltra
                  ? 'bg-white/[0.04] border-white/[0.08]'
                  : 'bg-black/25 border-white/10'
              }`}
            >
              <button
                type="button"
                disabled={isImporting}
                onClick={() => {
                  setMode('url');
                  setErrorMsg(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'url'
                    ? isSpotify
                      ? 'bg-white text-black'
                      : isUltra
                      ? 'bg-white text-zinc-950'
                      : 'bg-indigo-600/50 text-cyan-200'
                    : 'text-[#B3B3B3] hover:text-white'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Lien Spotify</span>
              </button>
              <button
                type="button"
                disabled={isImporting}
                onClick={() => {
                  setMode('text');
                  setErrorMsg(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'text'
                    ? isSpotify
                      ? 'bg-white text-black'
                      : isUltra
                      ? 'bg-white text-zinc-950'
                      : 'bg-indigo-600/50 text-cyan-200'
                    : 'text-[#B3B3B3] hover:text-white'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Liste / CSV (Privée)</span>
              </button>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {/* Import Progress */}
            {isImporting && (
              <div className="p-4 rounded-xl bg-white/[0.05] border border-white/[0.1] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Conversion des titres en cours...</span>
                  </span>
                  <span className="font-mono tabular-nums text-zinc-300">
                    {progress.done} / {progress.total} ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      isSpotify
                        ? 'bg-[#1DB954]'
                        : isUltra
                        ? 'bg-white'
                        : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {progress.currentTitle && (
                  <p className="text-[11px] text-zinc-400 truncate">
                    Recherche : {progress.currentTitle}
                  </p>
                )}
              </div>
            )}

            {/* Tab 1: Spotify Public Playlist URL */}
        {mode === 'url' && (
          <div className="space-y-4">
            <form onSubmit={handleAnalyzeUrl} className="space-y-3">
              <label className="block text-xs font-medium text-zinc-300">
                Lien de la playlist ou album Spotify
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isImporting}
                  placeholder="https://open.spotify.com/playlist/..."
                  className={`flex-1 px-3.5 py-2.5 rounded-xl border text-sm text-white placeholder-zinc-500 focus:outline-none ${
                    isSpotify
                      ? 'bg-[#282828] border-white/10 focus:border-white/30'
                      : 'bg-white/[0.04] border-white/[0.12] focus:border-white/30'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!urlInput.trim() || isFetchingPreview || isImporting}
                  className={`px-5 py-2.5 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                    isSpotify
                      ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                      : isUltra
                      ? 'rounded-xl bg-white text-zinc-950 hover:bg-white/90'
                      : 'rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                  }`}
                >
                  {isFetchingPreview ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Charger</span>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Assurez-vous que la playlist Spotify soit définie sur « Publique » dans Spotify (Partager → Copier le lien).
              </p>
            </form>

            {/* Preview */}
            {preview && (
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.1] space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-900 border border-white/10 flex-shrink-0 flex items-center justify-center">
                    {preview.coverImage ? (
                      <img
                        src={preview.coverImage}
                        alt={preview.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-6 h-6 text-zinc-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      disabled={isImporting}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-2.5 py-1 text-sm font-semibold text-white focus:outline-none focus:border-white/30"
                      aria-label="Nom de la playlist"
                    />
                    <p className="text-xs text-zinc-400 font-mono tabular-nums">
                      {preview.tracks.length} titre{preview.tracks.length > 1 ? 's' : ''} détecté{preview.tracks.length > 1 ? 's' : ''}
                      {preview.tracks.length > 50 ? ' (50 premiers importés)' : ''}
                    </p>
                  </div>
                </div>

                {/* Track list preview */}
                <div className="max-h-44 overflow-y-auto space-y-1 pr-1 divide-y divide-white/[0.05]">
                  {preview.tracks.slice(0, 30).map((t, i) => (
                    <div key={`${t.title}-${i}`} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="text-zinc-100 truncate font-medium">{t.title}</p>
                        <p className="text-zinc-500 truncate text-[11px]">{t.artist}</p>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-zinc-500 flex-shrink-0">
                        {i + 1}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleConfirmUrlImport}
                  disabled={isImporting}
                  className={`w-full py-3 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 ${
                    isSpotify
                      ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                      : isUltra
                      ? 'rounded-xl bg-white text-zinc-950 hover:bg-white/90'
                      : 'rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-lg'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Importer dans ma bibliothèque</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Manual / CSV Paste */}
        {mode === 'text' && (
          <form onSubmit={handleConfirmTextImport} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Nom de la playlist
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                disabled={isImporting}
                placeholder="Ex: Ma playlist Rap FR"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-white placeholder-zinc-500 focus:outline-none ${
                  isSpotify
                    ? 'bg-[#282828] border-white/10 focus:border-white/30'
                    : 'bg-white/[0.04] border-white/[0.12] focus:border-white/30'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Titres à importer (1 par ligne : « Artiste - Titre » ou CSV Exportify)
              </label>
              <textarea
                rows={6}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                disabled={isImporting}
                placeholder={`PNL - Au DD\nNinho - Jefe\nOrelsan - Basique\nThe Weeknd - Blinding Lights`}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-white placeholder-zinc-500 focus:outline-none font-mono leading-relaxed ${
                  isSpotify
                    ? 'bg-[#282828] border-white/10 focus:border-white/30'
                    : 'bg-white/[0.04] border-white/[0.12] focus:border-white/30'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={!manualText.trim() || isImporting}
              className={`w-full py-3 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 ${
                isSpotify
                  ? 'rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black'
                  : isUltra
                  ? 'rounded-xl bg-white text-zinc-950 hover:bg-white/90'
                  : 'rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-lg'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Importer et sauvegarder localement</span>
            </button>
          </form>
        )}
          </>
        )}
      </div>
    </div>
  );
};
