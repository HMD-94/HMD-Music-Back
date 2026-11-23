import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  FileAudio,
  Loader2,
  Mic,
  MonitorSpeaker,
  Music2,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  WifiOff,
} from 'lucide-react';
import { LyricLine, LyricsFetchOutcome, LyricsResult, Track } from '../../types/music';
import { LyricsService } from '../../services/lyrics';
import { computeAudioRms, downsampleFloat32To16k, encodeMonoWav } from '../../services/audioChunker';
import { usePlaybackTime, usePlayer } from '../../context/PlayerContext';

interface LyricsPanelProps {
  track: Track;
  ultraMode?: boolean;
}

const AUTH_STORAGE_KEY = 'hmd_groq_auth_confirmed_v1';
const FIRST_SLICE_SEC = 5;
const NEXT_SLICE_SEC = 7;

export const LyricsPanel: React.FC<LyricsPanelProps> = ({ track, ultraMode = false }) => {
  const { seekTo, isPlaying, togglePlayPause } = usePlayer();
  const { currentTime } = usePlaybackTime();

  const [outcome, setOutcome] = useState<LyricsFetchOutcome | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [syncOffset, setSyncOffset] = useState(0);
  const [userScrolling, setUserScrolling] = useState(false);

  // Step 2: Authorized Groq AI Transcription state (progressive live capture OR optional file)
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showFileOption, setShowFileOption] = useState(false);

  const [isCapturing, setIsCapturing] = useState(false);
  const [captureSource, setCaptureSource] = useState<'tab' | 'mic' | null>(null);
  const [captureSeconds, setCaptureSeconds] = useState(0);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<string>('');
  const [transcribeError, setTranscribeError] = useState<{
    type: string;
    message: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLButtonElement | null>(null);
  const userScrollTimerRef = useRef<number | null>(null);
  const bypassCacheRef = useRef(false);
  const transcribeAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Progressive live audio capture refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const sliceTimerRef = useRef<number | null>(null);
  const pcmBufferRef = useRef<Float32Array[]>([]);
  const pcmSampleCountRef = useRef<number>(0);
  const sliceStartTimeRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(currentTime);
  const isCapturingRef = useRef<boolean>(false);
  const liveLinesRef = useRef<LyricLine[]>([]);
  const livePlainRef = useRef<string[]>([]);
  const liveUncertainRef = useRef<boolean>(false);
  const liveIncompleteRef = useRef<boolean>(false);
  const sliceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const firstSliceSentRef = useRef<boolean>(false);

  currentTimeRef.current = currentTime;

  const handleToggleAuthorized = (checked: boolean) => {
    setIsAuthorized(checked);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, checked ? 'true' : 'false');
    } catch {
      // Ignore storage error
    }
  };

  const stopLiveCapture = useCallback((saveAccumulated = true) => {
    isCapturingRef.current = false;

    if (captureTimerRef.current) {
      window.clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    if (sliceTimerRef.current) {
      window.clearTimeout(sliceTimerRef.current);
      sliceTimerRef.current = null;
    }
    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
        processorNodeRef.current.onaudioprocess = null;
      } catch {}
      processorNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (
      saveAccumulated &&
      (liveLinesRef.current.length > 0 || livePlainRef.current.length > 0)
    ) {
      const finalResult = LyricsService.buildLiveLyricsResult(
        track,
        [...liveLinesRef.current],
        [...livePlainRef.current],
        liveUncertainRef.current || true,
        liveIncompleteRef.current
      );
      LyricsService.cacheLiveLyricsResult(track, finalResult);
    }

    pcmBufferRef.current = [];
    pcmSampleCountRef.current = 0;
    setIsCapturing(false);
    setCaptureSource(null);
    setCaptureSeconds(0);
  }, [track]);

  useEffect(() => {
    const controller = new AbortController();
    const shouldBypass = bypassCacheRef.current;
    bypassCacheRef.current = false;

    if (transcribeAbortRef.current) {
      transcribeAbortRef.current.abort();
      transcribeAbortRef.current = null;
    }
    stopLiveCapture(false);
    liveLinesRef.current = [];
    livePlainRef.current = [];
    liveUncertainRef.current = false;
    liveIncompleteRef.current = false;
    firstSliceSentRef.current = false;

    setIsLoading(true);
    setOutcome(null);
    setSyncOffset(0);
    setUserScrolling(false);
    setSelectedFile(null);
    setIsTranscribing(false);
    setTranscribeProgress('');
    setTranscribeError(null);

    LyricsService.fetchLyricsDetailed(track, {
      bypassCache: shouldBypass,
      signal: controller.signal,
    })
      .then((res) => {
        if (!controller.signal.aborted) {
          setOutcome(res);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        setOutcome({
          status: 'error',
          lyrics: null,
          errorType: 'network',
          errorMessage: 'Erreur réseau lors de la récupération des paroles.',
        });
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [track.id, track.title, track.artist, track.album, track.duration, retryCount, stopLiveCapture]);

  // Clean up capture resources on unmount
  useEffect(() => {
    return () => {
      if (transcribeAbortRef.current) {
        transcribeAbortRef.current.abort();
      }
      stopLiveCapture(true);
    };
  }, [stopLiveCapture]);

  const handleRetryLrclib = useCallback(() => {
    bypassCacheRef.current = true;
    setRetryCount((c) => c + 1);
  }, []);

  const enqueueWavSliceForTranscription = useCallback(
    (wavBlob: Blob, sliceOffsetSec: number, signal: AbortSignal) => {
      sliceQueueRef.current = sliceQueueRef.current.then(async () => {
        if (signal.aborted) return;

        setIsTranscribing(true);
        setTranscribeProgress(
          liveLinesRef.current.length === 0
            ? 'Groq génère les premières paroles…'
            : 'Groq met à jour les paroles…'
        );

        const sliceRes = await LyricsService.transcribeLiveSlice(wavBlob, {
          authorized: true,
          timeOffsetSec: sliceOffsetSec,
          signal,
        });

        if (signal.aborted) return;

        if (!sliceRes.ok) {
          setTranscribeError({
            type: sliceRes.errorType || 'groq_error',
            message: sliceRes.errorMessage || 'Erreur Groq lors de la transcription.',
          });
          setIsTranscribing(false);
          setTranscribeProgress('');
          // Stop continuous capture on hard auth/quota/network failures
          if (
            sliceRes.errorType === 'rate_limit' ||
            sliceRes.errorType === 'groq_error' ||
            sliceRes.errorType === 'audio_inaccessible'
          ) {
            stopLiveCapture(true);
          }
          return;
        }

        if (sliceRes.lines.length > 0 || sliceRes.plainLines.length > 0) {
          // Append new lines avoiding exact consecutive duplicates
          for (const line of sliceRes.lines) {
            const last = liveLinesRef.current[liveLinesRef.current.length - 1];
            if (last && last.text.toLowerCase() === line.text.toLowerCase() && Math.abs(last.time - line.time) < 2) {
              continue;
            }
            liveLinesRef.current.push(line);
          }
          for (const p of sliceRes.plainLines) {
            const lastP = livePlainRef.current[livePlainRef.current.length - 1];
            if (lastP && lastP.toLowerCase() === p.toLowerCase()) continue;
            livePlainRef.current.push(p);
          }

          if (sliceRes.uncertain) liveUncertainRef.current = true;
          if (sliceRes.incomplete) liveIncompleteRef.current = true;

          const liveResult = LyricsService.buildLiveLyricsResult(
            track,
            [...liveLinesRef.current],
            [...livePlainRef.current],
            liveUncertainRef.current || true,
            liveIncompleteRef.current
          );
          LyricsService.cacheLiveLyricsResult(track, liveResult);
          setOutcome({ status: 'found', lyrics: liveResult });
          setTranscribeError(null);
        }

        setIsTranscribing(false);
        setTranscribeProgress('');
      });
    },
    [track, stopLiveCapture]
  );

  const flushCurrentPcmSlice = useCallback(
    (sampleRate: number, signal: AbortSignal) => {
      if (pcmSampleCountRef.current === 0) return;

      const total = pcmSampleCountRef.current;
      const merged = new Float32Array(total);
      let pos = 0;
      for (const chunk of pcmBufferRef.current) {
        merged.set(chunk, pos);
        pos += chunk.length;
      }
      pcmBufferRef.current = [];
      pcmSampleCountRef.current = 0;

      const sliceOffset = sliceStartTimeRef.current;
      sliceStartTimeRef.current = currentTimeRef.current;

      const downsampled = downsampleFloat32To16k(merged, sampleRate);
      if (downsampled.length < 16000 * 1.2) return; // < 1.2s

      // Skip near-silent slices so Groq doesn't hallucinate or waste quota
      if (computeAudioRms(downsampled) < 0.0012) {
        return;
      }

      const wavBlob = encodeMonoWav(downsampled, 16000);
      enqueueWavSliceForTranscription(wavBlob, sliceOffset, signal);
    },
    [enqueueWavSliceForTranscription]
  );

  const startLiveCapture = useCallback(
    async (mode: 'tab' | 'mic') => {
      if (!isAuthorized) {
        setTranscribeError({
          type: 'audio_inaccessible',
          message:
            "Confirmez d'abord que l'utilisation et la transcription de ce son sont autorisées.",
        });
        return;
      }

      if (!navigator.mediaDevices) {
        setTranscribeError({
          type: 'audio_inaccessible',
          message:
            "Votre navigateur ne permet pas l'écoute directe. Utilisez l'option fichier audio ci-dessous.",
        });
        return;
      }

      setTranscribeError(null);
      if (transcribeAbortRef.current) {
        transcribeAbortRef.current.abort();
      }
      const abortController = new AbortController();
      transcribeAbortRef.current = abortController;

      try {
        let stream: MediaStream;
        if (mode === 'tab') {
          if (typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
            setTranscribeError({
              type: 'audio_inaccessible',
              message:
                "La capture d'onglet n'est pas disponible sur cet appareil. Essayez « Écouter (Micro) ».",
            });
            return;
          }
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          displayStream.getVideoTracks().forEach((vt) => vt.stop());
          const audioTracks = displayStream.getAudioTracks();
          if (audioTracks.length === 0) {
            displayStream.getTracks().forEach((t) => t.stop());
            setTranscribeError({
              type: 'audio_inaccessible',
              message:
                "Aucune piste audio partagée. Cochez « Partager également l'audio de l'onglet » lors de la sélection.",
            });
            return;
          }
          stream = new MediaStream(audioTracks);
          audioTracks[0].addEventListener('ended', () => {
            stopLiveCapture(true);
          });
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: true,
            },
          });
        }

        // Start playback automatically if paused
        if (!isPlaying) {
          togglePlayPause();
        }

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) {
          // Graceful fallback if AudioContext unavailable: single 8s MediaRecorder capture
          if (typeof MediaRecorder === 'undefined') {
            stream.getTracks().forEach((t) => t.stop());
            setTranscribeError({
              type: 'audio_inaccessible',
              message: "Capture audio non supportée sur ce navigateur.",
            });
            return;
          }
          const recorder = new MediaRecorder(stream);
          const chunks: BlobPart[] = [];
          const offsetAtStart = currentTimeRef.current;
          recorder.ondataavailable = (ev) => {
            if (ev.data?.size > 0) chunks.push(ev.data);
          };
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            stopLiveCapture(false);
            enqueueWavSliceForTranscription(blob, offsetAtStart, abortController.signal);
          };
          mediaStreamRef.current = stream;
          mediaRecorderRef.current = recorder;
          isCapturingRef.current = true;
          setIsCapturing(true);
          setCaptureSource(mode);
          setCaptureSeconds(0);
          recorder.start();

          let sec = 0;
          captureTimerRef.current = window.setInterval(() => {
            sec += 1;
            setCaptureSeconds(sec);
            if (sec >= 8 && recorder.state !== 'inactive') {
              recorder.stop();
            }
          }, 1000);
          return;
        }

        // Progressive 16kHz PCM WAV streaming: first lyrics in ~5s, then updates every 7s continuously
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;

        pcmBufferRef.current = [];
        pcmSampleCountRef.current = 0;
        firstSliceSentRef.current = false;
        sliceStartTimeRef.current = currentTimeRef.current;

        processor.onaudioprocess = (ev) => {
          if (!isCapturingRef.current) return;
          const channel = ev.inputBuffer.getChannelData(0);
          const copy = new Float32Array(channel.length);
          copy.set(channel);
          pcmBufferRef.current.push(copy);
          pcmSampleCountRef.current += copy.length;
        };

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(ctx.destination);

        mediaStreamRef.current = stream;
        audioCtxRef.current = ctx;
        processorNodeRef.current = processor;
        isCapturingRef.current = true;
        setIsCapturing(true);
        setCaptureSource(mode);
        setCaptureSeconds(0);

        let totalSec = 0;
        captureTimerRef.current = window.setInterval(() => {
          totalSec += 1;
          setCaptureSeconds(totalSec);
        }, 1000);

        const scheduleNextSlice = (delaySec: number) => {
          sliceTimerRef.current = window.setTimeout(() => {
            if (!isCapturingRef.current || abortController.signal.aborted) return;
            firstSliceSentRef.current = true;
            flushCurrentPcmSlice(ctx.sampleRate, abortController.signal);
            scheduleNextSlice(NEXT_SLICE_SEC);
          }, delaySec * 1000);
        };

        scheduleNextSlice(FIRST_SLICE_SEC);
      } catch (err: any) {
        stopLiveCapture(false);
        const name = err?.name || '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setTranscribeError({
            type: 'audio_inaccessible',
            message:
              mode === 'tab'
                ? "Capture d'onglet refusée ou bloquée dans cette fenêtre. Essayez « Écouter (Micro) » ou importez un fichier audio."
                : "Permission microphone refusée ou bloquée dans cette fenêtre. Ouvrez l'app dans un onglet dédié ou importez un fichier audio.",
          });
        } else {
          setTranscribeError({
            type: 'audio_inaccessible',
            message: 'Impossible de démarrer la capture audio directe sur cet appareil.',
          });
        }
      }
    },
    [
      isAuthorized,
      isPlaying,
      togglePlayPause,
      stopLiveCapture,
      enqueueWavSliceForTranscription,
      flushCurrentPcmSlice,
    ]
  );

  const transcribeNowAndContinue = useCallback(() => {
    if (!audioCtxRef.current || !transcribeAbortRef.current) return;
    flushCurrentPcmSlice(audioCtxRef.current.sampleRate, transcribeAbortRef.current.signal);
  }, [flushCurrentPcmSlice]);

  const runFileTranscription = useCallback(
    async (file: File, bypassCache = false) => {
      if (!isAuthorized) {
        setTranscribeError({
          type: 'audio_inaccessible',
          message:
            "Confirmez d'abord que l'utilisation et la transcription de ce fichier audio sont autorisées.",
        });
        return;
      }

      if (transcribeAbortRef.current) {
        transcribeAbortRef.current.abort();
      }
      const controller = new AbortController();
      transcribeAbortRef.current = controller;

      setIsTranscribing(true);
      setTranscribeError(null);
      setTranscribeProgress('Analyse du fichier audio…');

      try {
        const res = await LyricsService.transcribeAuthorizedAudio(track, file, {
          authorized: true,
          bypassCache,
          signal: controller.signal,
          onProgress: (msg) => setTranscribeProgress(msg),
        });

        if (controller.signal.aborted) return;

        if (res.status === 'found' && res.lyrics) {
          setOutcome(res);
          setTranscribeError(null);
        } else {
          setTranscribeError({
            type: res.errorType || 'groq_error',
            message: res.errorMessage || 'Échec de la transcription audio avec Groq.',
          });
        }
      } catch (err: any) {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        setTranscribeError({
          type: 'network',
          message: 'Erreur réseau pendant la transcription audio.',
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsTranscribing(false);
          setTranscribeProgress('');
        }
      }
    },
    [isAuthorized, track]
  );

  const lyrics: LyricsResult | null = outcome?.lyrics ?? null;
  const effectiveTime = currentTime + syncOffset;

  const activeIndex = useMemo(() => {
    if (!lyrics || !lyrics.synced || lyrics.lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].time <= effectiveTime + 0.25) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [lyrics, effectiveTime]);

  useEffect(() => {
    if (userScrolling || activeIndex < 0 || !activeLineRef.current) return;
    activeLineRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeIndex, userScrolling]);

  const handleManualScroll = () => {
    setUserScrolling(true);
    if (userScrollTimerRef.current) {
      window.clearTimeout(userScrollTimerRef.current);
    }
    userScrollTimerRef.current = window.setTimeout(() => {
      setUserScrolling(false);
    }, 3500);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-white/60 py-12">
        <Loader2 className="w-6 h-6 animate-spin text-white/75" />
        <p className="text-sm font-medium tracking-tight">MULTI-LYRICS AI · Recherche rapide…</p>
        <p className="text-xs text-white/40 truncate max-w-xs">
          {track.artist} · {track.title}
        </p>
      </div>
    );
  }

  if (outcome?.status === 'error') {
    const isNetwork = outcome.errorType === 'network';
    const isRateLimit = outcome.errorType === 'rate_limit';
    const title = isNetwork
      ? 'Erreur réseau'
      : isRateLimit
      ? 'Limite API atteinte (429)'
      : 'Réponse API invalide';

    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10 text-white/65">
        {isNetwork ? (
          <WifiOff className="w-8 h-8 mb-3 text-rose-400/80" />
        ) : (
          <AlertCircle className="w-8 h-8 mb-3 text-amber-400/80" />
        )}
        <p className="text-base font-semibold text-white/90">{title}</p>
        <p className="text-xs text-white/55 mt-1 max-w-xs leading-relaxed">
          {outcome.errorMessage || 'Impossible de contacter LRCLIB pour le moment.'}
        </p>
        <button
          type="button"
          onClick={handleRetryLrclib}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Réessayer</span>
        </button>
      </div>
    );
  }

  if (outcome?.status === 'instrumental' || lyrics?.instrumental) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10 text-white/55">
        <Music2 className="w-8 h-8 mb-3 text-white/35" />
        <p className="text-base font-semibold text-white/85">Morceau instrumental</p>
        <p className="text-xs text-white/45 mt-1 max-w-xs">
          Cette musique est instrumentale et ne contient pas de paroles.
        </p>
      </div>
    );
  }

  // Step 2 fallback when LRCLIB finds no lyrics: Fast progressive live Groq listening
  if (!lyrics || (lyrics.lines.length === 0 && lyrics.plainLines.length === 0)) {
    const canDisplayAudio =
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getDisplayMedia === 'function';

    return (
      <div className="h-full overflow-y-auto no-scrollbar flex flex-col justify-center px-3 sm:px-4 py-4">
        <div className="max-w-md mx-auto w-full space-y-3.5 text-center">
          <div className="space-y-1">
            <Music2 className="w-6 h-6 mx-auto text-white/35 mb-1" />
            <p className="text-sm sm:text-base font-semibold text-white/90">
              Paroles indisponibles sur LRCLIB
            </p>
            <p className="text-xs text-white/50 truncate">
              Aucune correspondance vérifiée pour « {track.title} ».
            </p>
            <button
              type="button"
              onClick={handleRetryLrclib}
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/85 text-[11px] font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Réessayer LRCLIB</span>
            </button>
          </div>

          <div className="rounded-2xl bg-white/[0.05] border border-white/[0.1] p-4 text-left space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-300 flex-shrink-0" />
                <span className="text-xs font-bold text-white tracking-tight">
                  MULTI-LYRICS AI · Groq Temps Réel
                </span>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-400/15 text-cyan-200 border border-cyan-400/25">
                ~5s
              </span>
            </div>

            <p className="text-[11px] text-white/60 leading-relaxed">
              Le lecteur YouTube étant protégé côté serveur, autorisez en 1 clic l&apos;écoute directe de l&apos;onglet (ou du micro) : les premières paroles apparaissent en ~5s et continuent en direct.
            </p>

            <label className="flex items-start gap-2 text-[11px] text-white/80 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAuthorized}
                onChange={(e) => handleToggleAuthorized(e.target.checked)}
                disabled={isCapturing || isTranscribing}
                className="mt-0.5 accent-emerald-400 cursor-pointer"
              />
              <span>
                J&apos;autorise la transcription audio de ce morceau (mémorisé).
              </span>
            </label>

            {isCapturing ? (
              <div className="rounded-xl bg-cyan-500/12 border border-cyan-400/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-cyan-200 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                    <span>
                      {captureSource === 'tab'
                        ? 'Groq écoute l’onglet en direct…'
                        : 'Groq écoute via micro…'}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums text-white/80">
                    {captureSeconds}s
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, ((captureSeconds % FIRST_SLICE_SEC) / FIRST_SLICE_SEC) * 100 || 100)}%`,
                    }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  {audioCtxRef.current && (
                    <button
                      type="button"
                      disabled={captureSeconds < 2}
                      onClick={transcribeNowAndContinue}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white text-zinc-950 hover:bg-white/90 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Afficher maintenant</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => stopLiveCapture(true)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-medium cursor-pointer"
                  >
                    Arrêter
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {canDisplayAudio && (
                  <button
                    type="button"
                    disabled={isTranscribing || !isAuthorized}
                    onClick={() => startLiveCapture('tab')}
                    className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-white/90 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <MonitorSpeaker className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Écouter l&apos;onglet</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isTranscribing || !isAuthorized}
                  onClick={() => startLiveCapture('mic')}
                  className={`flex-1 min-w-[130px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                    canDisplayAudio
                      ? 'bg-white/15 hover:bg-white/20 text-white'
                      : 'bg-white text-zinc-950 hover:bg-white/90'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Écouter (Micro)</span>
                </button>
              </div>
            )}

            {/* Optional secondary file upload */}
            <div className="pt-1 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowFileOption((v) => !v)}
                className="text-[11px] text-white/50 hover:text-white/80 transition-colors cursor-pointer"
              >
                {showFileOption ? 'Masquer l’import de fichier' : 'Ou transcrire un fichier audio local…'}
              </button>

              {showFileOption && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                      setTranscribeError(null);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isTranscribing || isCapturing}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <FileAudio className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate max-w-[170px]">
                      {selectedFile ? selectedFile.name : 'Choisir un fichier'}
                    </span>
                  </button>

                  {selectedFile && (
                    <button
                      type="button"
                      disabled={isTranscribing || isCapturing || !isAuthorized}
                      onClick={() => runFileTranscription(selectedFile, false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-white/90 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <span>Transcrire</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {isTranscribing && transcribeProgress && (
              <div className="flex items-center gap-2 text-[11px] text-cyan-200/90">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <span>{transcribeProgress}</span>
              </div>
            )}

            {transcribeError && (
              <div className="rounded-xl bg-rose-500/15 border border-rose-400/30 p-3 space-y-2 text-xs">
                <p className="text-rose-200 leading-relaxed">{transcribeError.message}</p>
                {selectedFile && showFileOption && (
                  <button
                    type="button"
                    onClick={() => runFileTranscription(selectedFile, true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Réessayer</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isGroq = lyrics.source === 'groq';
  const isVerified = lyrics.source === 'lrclib' && Boolean(lyrics.verified);

  return (
    <div className="relative h-full flex flex-col min-h-0">
      {/* Header metadata + MULTI-LYRICS AI trust badge + live stream indicator + sync controls */}
      <div className="group/sync flex items-center justify-between gap-2 px-1 pb-2 text-[11px] text-white/50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {isGroq ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-400/15 text-cyan-200 border border-cyan-400/30 text-[10px] font-semibold flex-shrink-0">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Transcription IA</span>
            </span>
          ) : isVerified ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 text-[10px] font-semibold flex-shrink-0">
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>Paroles vérifiées</span>
            </span>
          ) : null}

          {isCapturing && (
            <button
              type="button"
              onClick={() => stopLiveCapture(true)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-400/30 text-[10px] font-semibold hover:bg-rose-500/30 transition-colors cursor-pointer flex-shrink-0"
              title="Arrêter l'écoute en direct"
            >
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              <span>En direct · {captureSeconds}s</span>
              <Square className="w-2 h-2 fill-current ml-0.5" />
            </button>
          )}

          <span className="truncate">
            {lyrics.matchedArtist} · {lyrics.matchedTitle}
            {!lyrics.synced && ' · Classique'}
          </span>
        </div>

        {lyrics.synced && (
          <div className="flex items-center gap-1 opacity-55 hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              type="button"
              onClick={() => setSyncOffset((v) => Number((v - 0.5).toFixed(1)))}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-white/70 cursor-pointer tabular-nums"
              title="Reculer la synchro de 0.5s"
            >
              -0.5s
            </button>
            {syncOffset !== 0 && (
              <button
                type="button"
                onClick={() => setSyncOffset(0)}
                className="px-1.5 py-0.5 rounded hover:bg-white/10 text-white/90 flex items-center gap-1 cursor-pointer tabular-nums"
                title="Réinitialiser la synchro"
              >
                <span>{syncOffset > 0 ? `+${syncOffset}s` : `${syncOffset}s`}</span>
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSyncOffset((v) => Number((v + 0.5).toFixed(1)))}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-white/70 cursor-pointer tabular-nums"
              title="Avancer la synchro de 0.5s"
            >
              +0.5s
            </button>
          </div>
        )}
      </div>

      {/* Honest uncertainty / incomplete notice for Groq AI transcription */}
      {isGroq && (lyrics.uncertain || lyrics.incomplete) && (
        <div className="mb-2 px-3 py-2 rounded-xl bg-amber-500/12 border border-amber-400/25 flex items-center justify-between gap-2 text-[11px] text-amber-200/90 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
            <span className="truncate">
              {lyrics.incomplete
                ? 'Transcription IA incomplète — certains passages peuvent manquer.'
                : 'Transcription IA approximative — certains mots peuvent différer.'}
            </span>
          </div>
          {selectedFile && (
            <button
              type="button"
              onClick={() => runFileTranscription(selectedFile, true)}
              className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold flex-shrink-0 cursor-pointer"
            >
              Réessayer
            </button>
          )}
        </div>
      )}

      {/* Scrollable synced or classic lyrics feed */}
      <div
        ref={containerRef}
        onWheel={handleManualScroll}
        onTouchMove={handleManualScroll}
        className="flex-1 overflow-y-auto no-scrollbar py-10 px-1 space-y-4 scroll-smooth"
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      >
        {lyrics.synced ? (
          lyrics.lines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = activeIndex >= 0 && idx < activeIndex;
            return (
              <button
                key={`${line.time}-${idx}`}
                ref={isActive ? activeLineRef : undefined}
                type="button"
                onClick={() => seekTo(Math.max(0, line.time - syncOffset))}
                className={`block w-full text-left font-display font-bold tracking-tight leading-[1.32] transition-all duration-300 cursor-pointer select-text origin-left ${
                  ultraMode ? 'text-xl sm:text-2xl' : 'text-lg sm:text-2xl'
                } ${
                  isActive
                    ? 'text-white opacity-100 scale-[1.02]'
                    : isPast
                    ? 'text-white/25 hover:text-white/60 scale-100'
                    : 'text-white/40 hover:text-white/80 scale-100'
                }`}
              >
                {line.text}
              </button>
            );
          })
        ) : (
          <div className="space-y-3.5">
            {lyrics.plainLines.map((line, idx) => (
              <p
                key={idx}
                className="font-display font-semibold text-lg sm:text-xl leading-relaxed text-white/80 select-text"
              >
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
