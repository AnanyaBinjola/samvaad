export type LanguageCode = string;

export type ConnectionState = 'disconnected' | 'ready' | 'connecting' | 'error';

export interface ServerConfig {
  endpoint: string;
  apiKey?: string;
}

export type InputMode = 'record' | 'upload';

export type RecordingState = 'idle' | 'recording' | 'recorded';

export interface AudioMetadata {
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  sizeBytes: number;
  peakAmplitude?: number;
  rmsEnergy?: number;
  isSilent?: boolean;
}

export interface WavValidationResult {
  isValid: boolean;
  error?: string;
  metadata?: AudioMetadata;
}

export interface UnifiedAudioInput {
  sourceType: 'record' | 'upload';
  blob: Blob;
  file?: File;
  name: string;
  metadata: AudioMetadata;
}

export type PlaybackSource = 'recorder' | 'uploader' | 'output' | null;

export interface TranslationSession {
  id: string;
  timestamp: Date;
  sourceLang: string;
  targetLang: string;
  inputBlob: Blob;
  inputMetadata: AudioMetadata;
  outputAudioUrl?: string;
  outputBlob?: Blob;
  outputDuration?: number;
  processingSeconds?: number;
  totalRoundtripSeconds?: number;
  sourceText?: string;
  translatedText?: string;
  status: 'idle' | 'translating' | 'completed' | 'error';
  errorMessage?: string;
  isCorsError?: boolean;
  isTimeout?: boolean;
}

