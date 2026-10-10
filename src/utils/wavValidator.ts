import type { WavValidationResult, AudioMetadata } from '../types';

/**
 * Configurable maximum upload size limit (25 MB).
 * Easily adjustable in one central location.
 */
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Validates a WAV audio file or Blob by reading its binary RIFF/WAVE header structure,
 * scanning variable chunk boundaries, and confirming decodability.
 */
export async function validateWavBuffer(
  buffer: ArrayBuffer,
  totalSizeBytes: number,
  fileName?: string
): Promise<WavValidationResult> {
  // 1. Check filename extension if provided (.wav or .wave)
  if (fileName) {
    const lowerName = fileName.toLowerCase();
    if (!lowerName.endsWith('.wav') && !lowerName.endsWith('.wave')) {
      return {
        isValid: false,
        error: `Please choose a WAV audio file (.wav or .wave). Selected file: "${fileName}"`,
      };
    }
  }

  // 2. Check file size limits and emptiness
  if (totalSizeBytes === 0 || buffer.byteLength === 0) {
    return {
      isValid: false,
      error: 'This file appears to be empty or invalid (0 bytes).',
    };
  }

  if (totalSizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    return {
      isValid: false,
      error: `This file exceeds the current upload limit of ${formatFileSize(MAX_UPLOAD_SIZE_BYTES)}. File size is ${formatFileSize(totalSizeBytes)}.`,
    };
  }

  if (totalSizeBytes < 44 || buffer.byteLength < 44) {
    return {
      isValid: false,
      error: 'File size is too small to contain a valid WAV header (< 44 bytes).',
    };
  }

  try {
    const view = new DataView(buffer);

    // 3. Check "RIFF" magic identifier (bytes 0..3)
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    if (riff !== 'RIFF') {
      return {
        isValid: false,
        error: `Invalid container structure: Expected "RIFF" magic identifier, got "${riff}". Please ensure the file is not a WebM, MP3, or MP4 file renamed to .wav.`,
      };
    }

    // 4. Check "WAVE" format identifier (bytes 8..11)
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11)
    );
    if (wave !== 'WAVE') {
      return {
        isValid: false,
        error: `Invalid audio format: Expected "WAVE" format descriptor, got "${wave}".`,
      };
    }

    let offset = 12;
    let foundFmt = false;
    let foundData = false;
    let dataOffset = 44;
    let audioFormat = 1; // 1 = PCM, 3 = IEEE Float, 65534 = Extensible
    let channels = 1;
    let sampleRate = 16000;
    let bitsPerSample = 16;
    let byteRate = 0;
    let dataSize = 0;

    while (offset + 8 <= buffer.byteLength) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === 'fmt ') {
        foundFmt = true;
        audioFormat = view.getUint16(offset + 8, true);
        channels = view.getUint16(offset + 10, true);
        sampleRate = view.getUint32(offset + 12, true);
        byteRate = view.getUint32(offset + 16, true);
        bitsPerSample = view.getUint16(offset + 22, true);

        // Handle WAVE_FORMAT_EXTENSIBLE (0xFFFE = 65534)
        if (audioFormat === 0xfffe && offset + 26 <= buffer.byteLength) {
          const subFormat = view.getUint16(offset + 24, true);
          if (subFormat === 1) {
            audioFormat = 1; // PCM sub-format
          }
        }
      } else if (chunkId === 'data') {
        foundData = true;
        dataSize = chunkSize;
        dataOffset = offset + 8;
      }

      // Word-align chunk offset (WAV chunks are padded to 2-byte boundaries)
      const paddedSize = chunkSize + (chunkSize % 2);
      offset += 8 + paddedSize;
    }

    if (!foundFmt) {
      return {
        isValid: false,
        error: 'Corrupt WAV header: Missing required "fmt " subchunk.',
      };
    }

    // 6. Audio Format Verification (Standard PCM 1, IEEE Float 3, or Extensible PCM)
    if (audioFormat !== 1 && audioFormat !== 3) {
      const formatDescription =
        audioFormat === 6
          ? 'A-law compression'
          : audioFormat === 7
          ? 'μ-law compression'
          : audioFormat === 85
          ? 'MPEG audio'
          : `format code 0x${audioFormat.toString(16)}`;

      return {
        isValid: false,
        error: `Unsupported compression format (${formatDescription}). The translation backend expects standard PCM WAV audio.`,
      };
    }

    if (channels <= 0 || sampleRate <= 0 || bitsPerSample <= 0) {
      return {
        isValid: false,
        error: `Invalid audio stream parameters: ${channels} channel(s), ${sampleRate} Hz, ${bitsPerSample}-bit.`,
      };
    }

    // 7. Calculate audio payload duration and analyze signal presence
    const bytesPerSec = byteRate > 0 ? byteRate : sampleRate * channels * (bitsPerSample / 8);
    const audioPayloadBytes = foundData && dataSize > 0 ? dataSize : totalSizeBytes - 44;

    if (audioPayloadBytes <= 0) {
      return {
        isValid: false,
        error: 'This WAV file contains an empty audio data chunk.',
      };
    }

    const durationSeconds = bytesPerSec > 0 ? Math.max(0, audioPayloadBytes / bytesPerSec) : 0;

    // Analyze sample amplitude to detect complete silence
    const signalInfo = analyzeAudioSignal(buffer, dataOffset, dataSize, bitsPerSample);

    const metadata: AudioMetadata = {
      durationSeconds,
      sampleRate,
      channels,
      bitDepth: bitsPerSample,
      sizeBytes: totalSizeBytes,
      peakAmplitude: signalInfo.peakAmplitude,
      rmsEnergy: signalInfo.rmsEnergy,
      isSilent: signalInfo.isSilent,
    };

    return {
      isValid: true,
      metadata,
    };
  } catch (err) {
    return {
      isValid: false,
      error: `Could not parse WAV header: ${err instanceof Error ? err.message : 'Corrupted header bytes'}`,
    };
  }
}

/**
 * Analyzes audio samples to measure peak amplitude and RMS energy.
 * Detects completely silent or muted recordings without altering the audio data.
 */
export function analyzeAudioSignal(
  buffer: ArrayBuffer,
  dataOffset: number = 44,
  dataSize?: number,
  bitsPerSample: number = 16
): { peakAmplitude: number; rmsEnergy: number; isSilent: boolean } {
  const view = new DataView(buffer);
  const totalAvailableBytes = buffer.byteLength - dataOffset;
  const totalBytes = dataSize !== undefined ? Math.min(totalAvailableBytes, dataSize) : totalAvailableBytes;

  if (totalBytes <= 0) {
    return { peakAmplitude: 0, rmsEnergy: 0, isSilent: true };
  }

  let maxAbs = 0;
  let sumSquares = 0;
  let sampleCount = 0;

  // Sample up to 8,000 points across the buffer for instantaneous analysis
  const step = bitsPerSample === 16 ? Math.max(2, Math.floor(totalBytes / 8000) * 2) : Math.max(4, Math.floor(totalBytes / 8000) * 4);

  if (bitsPerSample === 16) {
    for (let i = dataOffset; i + 2 <= dataOffset + totalBytes; i += step) {
      const sample = view.getInt16(i, true) / 32768.0;
      const abs = Math.abs(sample);
      if (abs > maxAbs) maxAbs = abs;
      sumSquares += sample * sample;
      sampleCount++;
    }
  } else if (bitsPerSample === 32) {
    for (let i = dataOffset; i + 4 <= dataOffset + totalBytes; i += step) {
      const sample = view.getFloat32(i, true);
      const abs = Math.abs(sample);
      if (abs > maxAbs) maxAbs = abs;
      sumSquares += sample * sample;
      sampleCount++;
    }
  } else if (bitsPerSample === 24) {
    for (let i = dataOffset; i + 3 <= dataOffset + totalBytes; i += step) {
      const b0 = view.getUint8(i);
      const b1 = view.getUint8(i + 1);
      const b2 = view.getInt8(i + 2);
      const intVal = (b2 << 16) | (b1 << 8) | b0;
      const sample = intVal / 8388608.0;
      const abs = Math.abs(sample);
      if (abs > maxAbs) maxAbs = abs;
      sumSquares += sample * sample;
      sampleCount++;
    }
  }

  const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
  // Conservative threshold: only considered silent if virtually flatline (peak < 0.2% and RMS < 0.05%)
  const isSilent = sampleCount > 0 && maxAbs < 0.002 && rms < 0.0005;

  return {
    peakAmplitude: maxAbs,
    rmsEnergy: rms,
    isSilent,
  };
}

/**
 * Verifies whether the browser's Web Audio API can decode the provided audio file/blob.
 */
export async function verifyBrowserAudioDecodability(
  fileOrBlob: Blob
): Promise<{ decodable: boolean; durationSeconds?: number; error?: string }> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtx) {
      return { decodable: true }; // Skip if Web Audio is unsupported in test/server environments
    }

    const audioCtx = new AudioCtx();
    try {
      // Decode a copy of the arrayBuffer to prevent memory detachment issues
      const arrayBuffer = await fileOrBlob.arrayBuffer();
      const decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        let isSettled = false;
        try {
          const promise = audioCtx.decodeAudioData(
            arrayBuffer.slice(0),
            (buf) => {
              if (!isSettled) {
                isSettled = true;
                resolve(buf);
              }
            },
            (err) => {
              if (!isSettled) {
                isSettled = true;
                reject(err);
              }
            }
          );
          if (promise && typeof promise.then === 'function') {
            promise
              .then((buf) => {
                if (!isSettled) {
                  isSettled = true;
                  resolve(buf);
                }
              })
              .catch((err) => {
                if (!isSettled) {
                  isSettled = true;
                  reject(err);
                }
              });
          }
        } catch (e) {
          if (!isSettled) {
            isSettled = true;
            reject(e);
          }
        }
      });

      return {
        decodable: true,
        durationSeconds: decodedBuffer.duration,
      };
    } catch {
      return {
        decodable: false,
        error: 'The audio could not be decoded by your browser.',
      };
    } finally {
      if (audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    }
  } catch {
    return { decodable: true };
  }
}

/**
 * Validates an uploaded File object as a valid WAV audio file.
 */
export async function validateWavFile(file: File): Promise<WavValidationResult> {
  // 1. Read header slice (up to 128 KB) to inspect binary RIFF/WAVE structures & chunks
  const headerSlice = await file.slice(0, Math.min(file.size, 128 * 1024)).arrayBuffer();
  const result = await validateWavBuffer(headerSlice, file.size, file.name);

  if (!result.isValid) {
    return result;
  }

  // 2. Verify browser decodability
  const decodability = await verifyBrowserAudioDecodability(file);
  if (!decodability.decodable) {
    return {
      isValid: false,
      error: decodability.error || 'The audio could not be decoded by your browser.',
    };
  }

  // Refine duration if AudioContext provides a more precise duration
  if (decodability.durationSeconds && decodability.durationSeconds > 0 && result.metadata) {
    result.metadata.durationSeconds = decodability.durationSeconds;
  }

  return result;
}

/**
 * Validates an in-memory Blob as a valid WAV audio file.
 */
export async function validateWavBlob(blob: Blob): Promise<WavValidationResult> {
  const headerSlice = await blob.slice(0, Math.min(blob.size, 128 * 1024)).arrayBuffer();
  const result = await validateWavBuffer(headerSlice, blob.size);

  if (!result.isValid) {
    return result;
  }

  const decodability = await verifyBrowserAudioDecodability(blob);
  if (!decodability.decodable) {
    return {
      isValid: false,
      error: decodability.error || 'The audio could not be decoded by your browser.',
    };
  }

  if (decodability.durationSeconds && decodability.durationSeconds > 0 && result.metadata) {
    result.metadata.durationSeconds = decodability.durationSeconds;
  }

  return result;
}

/**
 * Formats seconds into MM:SS string
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats file size in human-readable units (Bytes, KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
