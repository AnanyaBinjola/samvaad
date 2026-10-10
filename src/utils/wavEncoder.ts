/**
 * In-browser PCM WAV Encoder & Resampler
 * Converts raw Float32 audio samples from Web Audio API into standard 16-bit PCM WAV Blobs.
 */

/**
 * Resamples a Float32Array audio buffer using anti-aliasing box-filter averaging.
 * Ideal for downsampling high sample-rate microphone input (e.g., 44.1 kHz or 48 kHz)
 * to 16 kHz for speech recognition and translation pipelines.
 */
export function downsampleBuffer(
  buffer: Float32Array,
  inputRate: number,
  outputRate: number = 16000
): Float32Array {
  if (outputRate === inputRate || buffer.length === 0) {
    return buffer;
  }
  if (outputRate > inputRate) {
    // If output rate is higher, return existing buffer (no interpolation artifacts)
    return buffer;
  }

  const sampleRateRatio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    // Average all samples in this window to avoid high-frequency aliasing
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : buffer[offsetBuffer] || 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Converts a Float32Array of audio samples to an uncompressed 16-bit PCM WAV Blob.
 * If targetSampleRate is provided and differs from sampleRate, it downsamples first.
 */
export function encodePcmToWav(
  samples: Float32Array,
  sampleRate: number = 16000,
  numChannels: number = 1,
  targetSampleRate?: number
): Blob {
  // If target sample rate is specified and differs, downsample
  let processedSamples = samples;
  let finalSampleRate = sampleRate;

  if (targetSampleRate && targetSampleRate < sampleRate) {
    processedSamples = downsampleBuffer(samples, sampleRate, targetSampleRate);
    finalSampleRate = targetSampleRate;
  }

  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = finalSampleRate * blockAlign;
  const dataSize = processedSamples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // 1. RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // ChunkSize
  writeString(8, 'WAVE');

  // 2. "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = uncompressed PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, finalSampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16-bit signed integer)

  // 3. "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size

  // 4. Write the 16-bit signed PCM samples (-32768 to 32767)
  let offset = 44;
  for (let i = 0; i < processedSamples.length; i++) {
    // Clamp sample between -1.0 and 1.0
    const s = Math.max(-1, Math.min(1, processedSamples[i]));
    // Scale to 16-bit integer range
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, Math.floor(val), true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}
