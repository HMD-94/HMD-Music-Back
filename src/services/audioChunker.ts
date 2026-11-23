// Utilities for SHA-256 deduplication and splitting large audio files (>24 MB)
// into 16kHz mono WAV chunks compatible with Groq Whisper's 25 MB limit.

export const MAX_DIRECT_AUDIO_BYTES = 24 * 1024 * 1024;
const TARGET_SAMPLE_RATE = 16000;
const CHUNK_DURATION_SEC = 180; // ~5.7 MB per 16kHz mono 16-bit WAV chunk
const MAX_CHUNKS = 20;

export interface AudioUploadChunk {
  blob: Blob;
  fileName: string;
  mimeType: string;
  timeOffsetSec: number;
  chunkIndex: number;
  totalChunks: number;
}

export class AudioPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioPreparationError';
  }
}

export async function computeFileSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback fingerprint if SubtleCrypto is unavailable in an insecure HTTP context
  return `size-${blob.size}`;
}

export function encodeMonoWav(samples: Float32Array, sampleRate: number = TARGET_SAMPLE_RATE): Blob {
  const byteLength = 44 + samples.length * 2;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function downsampleFloat32To16k(input: Float32Array, inputRate: number): Float32Array {
  if (!inputRate || inputRate === TARGET_SAMPLE_RATE) {
    return input;
  }
  const ratio = inputRate / TARGET_SAMPLE_RATE;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const nextIdx = Math.min(input.length - 1, idx + 1);
    const frac = pos - idx;
    out[i] = input[idx] * (1 - frac) + input[nextIdx] * frac;
  }
  return out;
}

export function computeAudioRms(samples: Float32Array): number {
  if (!samples || samples.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  return Math.sqrt(sumSq / samples.length);
}

function downsampleToMono16k(audioBuffer: AudioBuffer): Float32Array {
  const numChannels = audioBuffer.numberOfChannels;
  const srcRate = audioBuffer.sampleRate;
  const srcLen = audioBuffer.length;

  // Mix channels to mono
  const mono = new Float32Array(srcLen);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < srcLen; i++) {
      mono[i] += channelData[i] / numChannels;
    }
  }

  return downsampleFloat32To16k(mono, srcRate);
}

export async function prepareAudioUploadChunks(file: File): Promise<AudioUploadChunk[]> {
  if (!file || file.size === 0) {
    throw new AudioPreparationError('Le fichier audio est vide ou inaccessible.');
  }

  const validExt = /\.(mp3|wav|m4a|ogg|oga|flac|webm|mp4|mpeg|mpga|aac|opus)$/i.test(file.name);
  const validMime = file.type.startsWith('audio/') || file.type === 'video/mp4' || file.type === 'video/webm';
  if (!validExt && !validMime) {
    throw new AudioPreparationError('Format de fichier non supporté. Utilisez un fichier audio (MP3, WAV, M4A, OGG, FLAC, WebM).');
  }

  // Standard files <= 24 MB are sent directly in a single request
  if (file.size <= MAX_DIRECT_AUDIO_BYTES) {
    return [
      {
        blob: file,
        fileName: file.name || 'audio.mp3',
        mimeType: file.type || 'audio/mpeg',
        timeOffsetSec: 0,
        chunkIndex: 0,
        totalChunks: 1,
      },
    ];
  }

  // Large files (> 24 MB): decode & split into 16kHz mono WAV segments so Groq accepts them cleanly
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new AudioPreparationError(
      'Ce fichier dépasse 24 Mo et votre navigateur ne permet pas son découpage audio automatique.'
    );
  }

  let rawBuffer: ArrayBuffer;
  try {
    rawBuffer = await file.arrayBuffer();
  } catch {
    throw new AudioPreparationError('Impossible de lire ce fichier audio depuis votre appareil.');
  }

  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(rawBuffer.slice(0));
    const mono16k = downsampleToMono16k(decoded);
    const samplesPerChunk = TARGET_SAMPLE_RATE * CHUNK_DURATION_SEC;
    const rawCount = Math.ceil(mono16k.length / samplesPerChunk);

    if (rawCount > MAX_CHUNKS) {
      throw new AudioPreparationError(
        'Fichier audio trop long pour être transcrit en une session (maximum ~60 minutes).'
      );
    }

    const chunks: AudioUploadChunk[] = [];
    for (let i = 0; i < rawCount; i++) {
      const startSample = i * samplesPerChunk;
      const endSample = Math.min(mono16k.length, startSample + samplesPerChunk);
      const slice = mono16k.subarray(startSample, endSample);
      const wavBlob = encodeMonoWav(slice, TARGET_SAMPLE_RATE);

      chunks.push({
        blob: wavBlob,
        fileName: `segment_${i + 1}.wav`,
        mimeType: 'audio/wav',
        timeOffsetSec: i * CHUNK_DURATION_SEC,
        chunkIndex: i,
        totalChunks: rawCount,
      });
    }
    return chunks;
  } catch (err) {
    if (err instanceof AudioPreparationError) throw err;
    throw new AudioPreparationError(
      'Fichier audio volumineux (>24 Mo) impossible à décoder. Essayez un fichier MP3/WAV plus compact.'
    );
  } finally {
    ctx.close().catch(() => {});
  }
}
