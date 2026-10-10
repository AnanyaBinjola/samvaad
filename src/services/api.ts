import type { ServerConfig, AudioMetadata } from '../types';
import { validateWavBuffer } from '../utils/wavValidator';

export interface TranslateRequestParams {
  audioBlob: Blob;
  sourceLang: string;
  targetLang: string;
  serverConfig: ServerConfig;
  signal?: AbortSignal;
  inputMetadata?: AudioMetadata;
  timeoutMs?: number;
}

export interface TranslateResponseSuccess {
  outputAudioBlob: Blob;
  outputAudioUrl: string;
  processingSeconds?: number;
  totalRoundtripSeconds: number;
  metadata?: AudioMetadata;
  sourceText?: string;
  translatedText?: string;
}

/**
 * Resolves the full URL for the translation endpoint.
 * Handles same-origin proxy paths (e.g. /api/translate), direct backend URLs (e.g. http://127.0.0.1:8000),
 * and avoids duplicate /translate path appending.
 */
export function resolveTranslateEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '/api/translate';
  }
  if (trimmed === '/api/translate' || trimmed === '/translate') {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return trimmed.endsWith('/translate') ? trimmed : `${trimmed}/translate`;
  }
  if (trimmed.endsWith('/translate')) {
    return trimmed;
  }
  return `${trimmed}/translate`;
}

/**
 * Development-only diagnostic logger.
 * Reports payload metrics, signal activity, and HTTP status without exposing sensitive data.
 */
function logDevDiagnostics(event: {
  phase: 'dispatch' | 'success' | 'error';
  targetUrl: string;
  sourceLang: string;
  targetLang: string;
  audioBlob?: Blob;
  inputMetadata?: AudioMetadata;
  httpStatus?: number;
  processingSeconds?: number;
  totalRoundtripSeconds?: number;
  serverMessage?: string;
}) {
  if (!import.meta.env.DEV) return;

  if (event.phase === 'dispatch') {
    console.groupCollapsed(
      `%c[Samvaad Dev Diagnostics]%c Dispatching Translation: ${event.sourceLang} → ${event.targetLang}`,
      'color: #E45B45; font-weight: bold;',
      'color: #24251F;'
    );
    console.log('Target Endpoint:', event.targetUrl);
    console.log('Audio Payload Size:', event.audioBlob ? `${event.audioBlob.size} bytes (${(event.audioBlob.size / 1024).toFixed(1)} KB)` : 'Unknown');
    console.log('MIME Type:', event.audioBlob?.type || 'audio/wav');
    if (event.inputMetadata) {
      console.log('WAV Duration:', `${event.inputMetadata.durationSeconds.toFixed(2)}s`);
      console.log('Stream Parameters:', `${event.inputMetadata.sampleRate} Hz, ${event.inputMetadata.channels === 1 ? 'Mono' : 'Stereo'}, ${event.inputMetadata.bitDepth}-bit PCM`);
      console.log(
        'Audio Signal Presence:',
        event.inputMetadata.isSilent
          ? '⚠️ Flat Silence (Peak amplitude < 0.2%)'
          : `Non-silent (Peak: ${((event.inputMetadata.peakAmplitude ?? 0) * 100).toFixed(1)}%, RMS: ${((event.inputMetadata.rmsEnergy ?? 0) * 100).toFixed(1)}%)`
      );
    }
    console.log('Language Routing:', `Source: "${event.sourceLang}" | Target: "${event.targetLang}"`);
    console.groupEnd();
  } else if (event.phase === 'success') {
    console.groupCollapsed(
      `%c[Samvaad Dev Diagnostics]%c Translation Completed (${event.httpStatus || 200} OK)`,
      'color: #3F6E55; font-weight: bold;',
      'color: #24251F;'
    );
    console.log('HTTP Status:', event.httpStatus || 200);
    console.log('Server Synthesis Time (X-Processing-Seconds):', event.processingSeconds !== undefined ? `${event.processingSeconds.toFixed(3)}s` : 'N/A');
    console.log('Total Network Roundtrip:', event.totalRoundtripSeconds !== undefined ? `${event.totalRoundtripSeconds.toFixed(3)}s` : 'N/A');
    console.groupEnd();
  } else if (event.phase === 'error') {
    console.group(
      `%c[Samvaad Dev Diagnostics]%c Translation Request Failed (${event.httpStatus ? `HTTP ${event.httpStatus}` : 'Network Failure'})`,
      'color: #9C2B18; font-weight: bold;',
      'color: #24251F;'
    );
    console.log('Target Endpoint:', event.targetUrl);
    console.log('HTTP Status:', event.httpStatus || 'N/A');
    console.log('Server Detail:', event.serverMessage || 'None');
    if (event.httpStatus === 500 && event.serverMessage?.toLowerCase().includes('no speech')) {
      console.warn(
        '[Diagnostics Advice] The backend ASR (Speech Recognition) model did not detect speech in the audio buffer. Ensure the microphone input is audible, unmuted, and contains spoken words.'
      );
    }
    console.groupEnd();
  }
}

/**
 * Dispatches a speech translation request to the configured backend.
 *
 * Backend Contract:
 * - Method: POST [serverUrl]/translate
 * - Content-Type: multipart/form-data (boundary set automatically by browser)
 * - Required Form Fields: audio (.wav binary), source (string code), target (string code)
 * - Optional Request Header: X-API-Key (sent only when configured)
 * - Response Body: Raw uncompressed WAV audio bytes (or JSON with audio_base64)
 * - Optional Response Header: X-Processing-Seconds (server synthesis time)
 */
export async function translateSpeechAudio({
  audioBlob,
  sourceLang,
  targetLang,
  serverConfig,
  signal,
  inputMetadata,
  timeoutMs = 60000,
}: TranslateRequestParams): Promise<TranslateResponseSuccess> {
  // 1. Validate input parameters
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Audio payload is empty. Please record or upload a valid audio take before translating.');
  }

  if (!sourceLang || !targetLang) {
    throw new Error('Please select both a source and target language.');
  }

  if (sourceLang === targetLang) {
    throw new Error(`Source and target languages must be different (both set to "${sourceLang}").`);
  }

  const targetUrl = resolveTranslateEndpoint(serverConfig.endpoint);

  // 2. Build multipart/form-data payload with exact field names: audio, source, target
  const formData = new FormData();
  const wavFile = new File(
    [audioBlob],
    `samvaad_${sourceLang}_to_${targetLang}_${Date.now()}.wav`,
    { type: 'audio/wav' }
  );

  formData.append('audio', wavFile);
  formData.append('source', sourceLang);
  formData.append('target', targetLang);

  // 3. Configure headers (Do NOT manually set Content-Type so browser generates boundary)
  const headers: Record<string, string> = {};
  if (serverConfig.apiKey && serverConfig.apiKey.trim().length > 0) {
    headers['X-API-Key'] = serverConfig.apiKey.trim();
  }

  logDevDiagnostics({
    phase: 'dispatch',
    targetUrl,
    sourceLang,
    targetLang,
    audioBlob,
    inputMetadata,
  });

  const startTime = performance.now();
  let response: Response;

  // 4. Setup internal AbortController with timeout support
  const internalController = new AbortController();
  let didTimeout = false;

  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    internalController.abort();
  }, timeoutMs);

  // Forward external abort signal
  const onExternalAbort = () => {
    internalController.abort();
  };

  if (signal) {
    if (signal.aborted) {
      window.clearTimeout(timeoutId);
      throw new Error('Translation request was cancelled.');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  // 5. Dispatch HTTP request with AbortSignal support
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: formData,
      signal: internalController.signal,
    });
  } catch (err: unknown) {
    window.clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (didTimeout) {
      logDevDiagnostics({
        phase: 'error',
        targetUrl,
        sourceLang,
        targetLang,
        serverMessage: `Request timed out after ${timeoutMs / 1000}s`,
      });
      throw new Error(
        `Translation Request Timed Out (${timeoutMs / 1000}s): The translation server did not respond in time. The backend might be busy synthesizing high-resolution audio or is temporarily unreachable. Please try again.`
      );
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Translation request was cancelled.');
    }

    const isDirectRemote = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
    const isSameOriginProxy = targetUrl.startsWith('/') || targetUrl.includes(window.location.host);
    const isTypeError = err instanceof TypeError;

    logDevDiagnostics({
      phase: 'error',
      targetUrl,
      sourceLang,
      targetLang,
      serverMessage: err instanceof Error ? err.message : 'Network failure',
    });

    if (isTypeError) {
      if (isSameOriginProxy) {
        throw new Error(
          `Unable to reach the translation service at "${targetUrl}". Please verify that the Vite development proxy or local backend server is running and accessible.`
        );
      }

      let corsAdvice = '';
      if (isDirectRemote) {
        corsAdvice =
          ' Note: In web browsers, "Failed to fetch" on direct remote URLs often indicates that the backend server is unreachable or lacks Cross-Origin Resource Sharing (CORS) headers. Switch to the Vite Dev Proxy (/api/translate) in Server Settings to bypass browser CORS during local development.';
      }

      throw new Error(
        `Unable to reach translation server at "${targetUrl}".${corsAdvice}`
      );
    }

    const msg = err instanceof Error ? err.message : 'Network communication failed';
    throw new Error(`Network error while communicating with "${targetUrl}": ${msg}`);
  } finally {
    window.clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }

  const totalRoundtripSeconds = Math.max(0.01, (performance.now() - startTime) / 1000);

  // 6. Handle HTTP status errors
  if (!response.ok) {
    let serverMessage = '';
    try {
      const text = await response.text();
      if (text && text.length < 300) {
        // Try parsing JSON error detail
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed.detail === 'string') {
            serverMessage = parsed.detail;
          } else if (parsed && typeof parsed.detail === 'object') {
            serverMessage = JSON.stringify(parsed.detail);
          } else {
            serverMessage = text.replace(/<[^>]*>/g, '').trim();
          }
        } catch {
          serverMessage = text.replace(/<[^>]*>/g, '').trim();
        }
      }
    } catch {
      // Ignore text read error
    }

    logDevDiagnostics({
      phase: 'error',
      targetUrl,
      sourceLang,
      targetLang,
      httpStatus: response.status,
      serverMessage,
      totalRoundtripSeconds,
    });

    const detailSuffix = serverMessage ? `: "${serverMessage}"` : '';

    if (response.status === 400) {
      throw new Error(
        `Invalid Request (HTTP 400): The translation server rejected the request parameters (${sourceLang} → ${targetLang})${detailSuffix}.`
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Authentication Required (HTTP ${response.status}): The translation server requires a valid authorization key. Please configure the API Key in Server Settings${detailSuffix}.`
      );
    }

    if (response.status === 404) {
      throw new Error(
        `Endpoint Not Found (HTTP 404): The translation endpoint was not found at "${targetUrl}". Please verify the server endpoint URL in Server Settings.`
      );
    }

    if (response.status === 413) {
      throw new Error(
        `Payload Too Large (HTTP 413): The audio sample exceeds the maximum upload size accepted by the translation server. Please record or upload a shorter audio take.`
      );
    }

    if (response.status === 422) {
      throw new Error(
        `Unprocessable Entity (HTTP 422): The translation server could not process the submitted parameters (${sourceLang} → ${targetLang})${detailSuffix}.`
      );
    }

    if (response.status === 429) {
      throw new Error(
        `Rate Limit Exceeded (HTTP 429): The translation server received too many requests. Please wait a moment before trying again.`
      );
    }

    if (response.status === 502) {
      throw new Error(
        `Bad Gateway (HTTP 502): The translation gateway could not reach the upstream neural translation model. Please check the backend service status.`
      );
    }

    if (response.status === 503) {
      throw new Error(
        `Service Unavailable (HTTP 503): The translation backend is currently overloaded or undergoing maintenance. Please try again in a moment.`
      );
    }

    if (response.status === 504) {
      throw new Error(
        `Gateway Timeout (HTTP 504): The translation gateway timed out while waiting for speech synthesis from the backend.`
      );
    }

    if (response.status >= 500) {
      // Specific handling for ASR "No speech was recognized"
      if (
        serverMessage.toLowerCase().includes('no speech was recognized') ||
        serverMessage.toLowerCase().includes('no speech')
      ) {
        throw new Error(
          'No Speech Detected: The backend speech recognition system could not identify spoken words in this audio take. Please record again speaking clearly into your microphone, or upload a clear voice recording.'
        );
      }

      throw new Error(
        `Translation Server Error (HTTP ${response.status}): The backend encountered an internal error while synthesizing speech${detailSuffix}.`
      );
    }

    throw new Error(`Server returned HTTP ${response.status} (${response.statusText})${detailSuffix}`);
  }


  // 6. Parse optional X-Processing-Seconds header
  const procHeader = response.headers.get('X-Processing-Seconds');
  let processingSeconds: number | undefined;
  if (procHeader) {
    const parsed = parseFloat(procHeader);
    if (!isNaN(parsed) && parsed > 0) {
      processingSeconds = parsed;
    }
  }

  // 7. Read audio bytes (supporting both application/json audio_base64 and raw binary WAV)
  const contentType = response.headers.get('content-type') || '';
  let finalAudioBuffer: ArrayBuffer;
  let sourceText: string | undefined;
  let translatedText: string | undefined;

  if (contentType.includes('application/json')) {
    const json = await response.json();
    if (json.detail) {
      throw new Error(
        typeof json.detail === 'string'
          ? json.detail
          : JSON.stringify(json.detail)
      );
    }
    if (!json.audio_base64) {
      throw new Error('Server response did not contain translated audio data.');
    }

    if (json.processing_seconds && typeof json.processing_seconds === 'number') {
      processingSeconds = json.processing_seconds;
    }
    if (json.source_text) {
      sourceText = String(json.source_text);
    }
    if (json.translated_text) {
      translatedText = String(json.translated_text);
    }

    // Decode base64 to binary ArrayBuffer
    const binaryString = atob(json.audio_base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    finalAudioBuffer = bytes.buffer;
  } else {
    // Direct raw binary WAV bytes
    finalAudioBuffer = await response.arrayBuffer();
  }

  if (finalAudioBuffer.byteLength === 0) {
    throw new Error('The translation server returned an empty audio response (0 bytes).');
  }

  // 8. Validate returned binary WAV header
  const validation = await validateWavBuffer(
    finalAudioBuffer,
    finalAudioBuffer.byteLength,
    'translated_output.wav'
  );

  if (!validation.isValid || !validation.metadata) {
    throw new Error(
      `Received invalid audio data from translation server: ${validation.error || 'Missing WAV header structure'}`
    );
  }

  const outputAudioBlob = new Blob([finalAudioBuffer], { type: 'audio/wav' });
  const outputAudioUrl = URL.createObjectURL(outputAudioBlob);

  return {
    outputAudioBlob,
    outputAudioUrl,
    processingSeconds,
    totalRoundtripSeconds,
    metadata: validation.metadata,
    sourceText,
    translatedText,
  };
}
