import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  LANGUAGES,
  getAllowedTargets,
} from './languages';
import type {
  ServerConfig,
  InputMode,
  AudioMetadata,
  UnifiedAudioInput,
  TranslationSession,
  PlaybackSource,
} from './types';
import { Header } from './components/Header';
import { VoxMascot, type VoxState } from './components/VoxMascot';
import { LanguageSelector } from './components/LanguageSelector';
import { AudioRecorder } from './components/AudioRecorder';
import { WavUploader } from './components/WavUploader';
import { TranslationOutput } from './components/TranslationOutput';
import { translateSpeechAudio } from './services/api';
import './App.css';

export const App: React.FC = () => {
  // Server configuration state with environment variable fallbacks (defaults to same-origin Vite Dev Proxy)
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    endpoint:
      (import.meta.env.VITE_SAMVAAD_API_URL as string | undefined)?.trim() ||
      (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
      '/api/translate',
    apiKey:
      (import.meta.env.VITE_SAMVAAD_API_KEY as string | undefined)?.trim() ||
      '',
  });

  // Settings modal visibility state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Language selection state (default: English -> Hindi)
  const [sourceLang, setSourceLang] = useState<string>('en');
  const [targetLang, setTargetLang] = useState<string>('hi');

  // Audio input mode tab ('record' | 'upload')
  const [inputMode, setInputMode] = useState<InputMode>('record');

  // Unified audio input state
  const [activeInput, setActiveInput] = useState<UnifiedAudioInput | null>(null);

  // Separate references for input tabs
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMetadata, setRecordedMetadata] = useState<AudioMetadata | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedMetadata, setUploadedMetadata] = useState<AudioMetadata | null>(null);

  // Translation active session, loading, and streaming states
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isRequestingMicPermission, setIsRequestingMicPermission] = useState<boolean>(false);
  const [isLiveRecording, setIsLiveRecording] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [activePlaybackSource, setActivePlaybackSource] = useState<PlaybackSource>(null);
  const [currentSession, setCurrentSession] = useState<TranslationSession | null>(null);

  // AbortController ref and request ID counter to support request cancellation and eliminate race conditions
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdCounterRef = useRef<number>(0);

  // Cleanup in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Coordinated playback handlers
  const handlePlaybackStarted = useCallback((source: 'recorder' | 'uploader' | 'output') => {
    setActivePlaybackSource(source);
    setIsPlayingAudio(true);
  }, []);

  const handlePlaybackChange = useCallback((isPlaying: boolean) => {
    setIsPlayingAudio(isPlaying);
    if (!isPlaying) {
      setActivePlaybackSource(null);
    }
  }, []);

  // Derive explicit application VOX companion state
  const voxState: VoxState = isTranslating
    ? 'processing'
    : isRequestingMicPermission
    ? 'permission'
    : isLiveRecording
    ? 'recording'
    : isPlayingAudio
    ? 'playing'
    : currentSession?.status === 'error'
    ? 'error'
    : currentSession?.status === 'completed'
    ? 'complete'
    : 'idle';

  // Handlers for Audio Recording
  const handleAudioCaptured = (blob: Blob, metadata: AudioMetadata) => {
    setRecordedBlob(blob);
    setRecordedMetadata(metadata);
    // Set as active unified input
    setActiveInput({
      sourceType: 'record',
      blob,
      name: 'Resonator Acoustic Take',
      metadata,
    });
    // Clear previous translation output upon new take
    setCurrentSession(null);
  };

  const handleAudioCleared = () => {
    setRecordedBlob(null);
    setRecordedMetadata(null);
    if (activeInput?.sourceType === 'record') {
      setActiveInput(null);
    }
    setCurrentSession(null);
  };

  // Handlers for File Upload
  const handleFileLoaded = (file: File, metadata: AudioMetadata) => {
    setUploadedFile(file);
    setUploadedMetadata(metadata);
    // Set as active unified input
    setActiveInput({
      sourceType: 'upload',
      blob: file,
      file,
      name: file.name,
      metadata,
    });
    setCurrentSession(null);
  };

  const handleFileCleared = () => {
    setUploadedFile(null);
    setUploadedMetadata(null);
    if (activeInput?.sourceType === 'upload') {
      setActiveInput(null);
    }
    setCurrentSession(null);
  };

  // Language change handlers with target constraint enforcement
  const handleSourceChange = (newSource: string) => {
    if (isTranslating) return;
    setSourceLang(newSource);
    const validTargets = getAllowedTargets(newSource);
    if (!validTargets.includes(targetLang)) {
      setTargetLang(validTargets[0] || (newSource === 'en' ? 'hi' : 'en'));
    }
    // Changing language does NOT silently discard the validated audio input
  };

  const handleTargetChange = (newTarget: string) => {
    if (isTranslating) return;
    const validTargets = getAllowedTargets(sourceLang);
    if (validTargets.includes(newTarget)) {
      setTargetLang(newTarget);
    }
  };

  // Tab switching handler
  const handleInputModeChange = (mode: InputMode) => {
    if (isTranslating) return;
    setInputMode(mode);
    // Update active input based on selected tab's verified data
    if (mode === 'record') {
      if (recordedBlob && recordedMetadata) {
        setActiveInput({
          sourceType: 'record',
          blob: recordedBlob,
          name: 'Resonator Acoustic Take',
          metadata: recordedMetadata,
        });
      } else {
        setActiveInput(null);
      }
    } else {
      if (uploadedFile && uploadedMetadata) {
        setActiveInput({
          sourceType: 'upload',
          blob: uploadedFile,
          file: uploadedFile,
          name: uploadedFile.name,
          metadata: uploadedMetadata,
        });
      } else {
        setActiveInput(null);
      }
    }
  };

  // Dispatch Speech-to-Speech translation to real backend
  const handleTranslate = async () => {
    if (!activeInput || isTranslating) return;

    // Stop any active audio playback before translating
    setActivePlaybackSource(null);
    setIsPlayingAudio(false);

    // Validate language pairing
    if (sourceLang === targetLang) {
      setCurrentSession({
        id: `err_${Date.now()}`,
        timestamp: new Date(),
        sourceLang,
        targetLang,
        inputBlob: activeInput.blob,
        inputMetadata: activeInput.metadata,
        status: 'error',
        errorMessage: 'Source and target languages must be different.',
      });
      return;
    }

    const allowedTargets = getAllowedTargets(sourceLang);
    if (!allowedTargets.includes(targetLang)) {
      setCurrentSession({
        id: `err_${Date.now()}`,
        timestamp: new Date(),
        sourceLang,
        targetLang,
        inputBlob: activeInput.blob,
        inputMetadata: activeInput.metadata,
        status: 'error',
        errorMessage: `Translation from ${LANGUAGES[sourceLang] || sourceLang} directly to ${LANGUAGES[targetLang] || targetLang} is not permitted. Please route through English (en) or Hindi (hi).`,
      });
      return;
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++requestIdCounterRef.current;

    setIsTranslating(true);
    setCurrentSession({
      id: `tx_${Date.now()}`,
      timestamp: new Date(),
      sourceLang,
      targetLang,
      inputBlob: activeInput.blob,
      inputMetadata: activeInput.metadata,
      status: 'translating',
    });

    try {
      const response = await translateSpeechAudio({
        audioBlob: activeInput.blob,
        sourceLang,
        targetLang,
        serverConfig,
        signal: controller.signal,
        inputMetadata: activeInput.metadata,
      });

      // Guard against race conditions: only update if this request is still latest
      if (currentRequestId !== requestIdCounterRef.current) {
        return;
      }

      setCurrentSession((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              outputAudioUrl: response.outputAudioUrl,
              outputBlob: response.outputAudioBlob,
              outputDuration: response.metadata?.durationSeconds,
              processingSeconds: response.processingSeconds,
              totalRoundtripSeconds: response.totalRoundtripSeconds,
              sourceText: response.sourceText,
              translatedText: response.translatedText,
            }
          : null
      );
    } catch (err: unknown) {
      if (currentRequestId !== requestIdCounterRef.current) {
        return;
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        // Request was intentionally cancelled
        return;
      }

      const errorMessage =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while communicating with the translation server.';

      // Preserve activeInput on failure so user can retry immediately without re-recording/re-uploading
      setCurrentSession((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              errorMessage,
            }
          : {
              id: `tx_${Date.now()}`,
              timestamp: new Date(),
              sourceLang,
              targetLang,
              inputBlob: activeInput.blob,
              inputMetadata: activeInput.metadata,
              status: 'error',
              errorMessage,
            }
      );
    } finally {
      if (currentRequestId === requestIdCounterRef.current) {
        setIsTranslating(false);
        abortControllerRef.current = null;
      }
    }
  };


  // Cancel in-flight translation request
  const handleCancelTranslate = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTranslating(false);
    setCurrentSession((prev) =>
      prev && prev.status === 'translating'
        ? {
            ...prev,
            status: 'error',
            errorMessage: 'Translation request was cancelled by the user.',
          }
        : prev
    );
  }, []);

  const sourceName = LANGUAGES[sourceLang] || sourceLang;
  const targetName = LANGUAGES[targetLang] || targetLang;

  return (
    <div className="app-container">
      {/* Top Editorial Masthead with persistent small VOX mark & Server Settings */}
      <Header
        serverConfig={serverConfig}
        onUpdateServerConfig={setServerConfig}
        voxState={voxState}
        forceOpenSettings={isSettingsModalOpen}
        onCloseSettings={() => setIsSettingsModalOpen(false)}
      />

      <main className="main-content">
        {/* Simplified, Compact Hero Section */}
        <section className="hero-section" aria-label="Introduction">
          <div className="hero-content-wrapper">
            <div className="hero-text-block">
              <h2 className="hero-headline">
                Understand each other. <em>In any language.</em>
              </h2>
              <p className="hero-tagline">
                Your voice. Beyond borders.
              </p>
            </div>

            {/* Integrated VOX Mascot Companion */}
            <div className="hero-companion-badge" aria-label="VOX voice assistant">
              <VoxMascot state={voxState} size="md" />
              <div className="companion-status-text">
                <span className="companion-name">VOX</span>
                <span className="companion-state-msg">
                  {voxState === 'permission'
                    ? 'Requesting mic access'
                    : voxState === 'recording'
                    ? `Listening to ${sourceName}...`
                    : voxState === 'processing'
                    ? `Translating into ${targetName}...`
                    : voxState === 'complete'
                    ? 'Translation ready'
                    : voxState === 'playing'
                    ? 'Playing speech'
                    : voxState === 'error'
                    ? 'Need attention'
                    : 'Ready to translate'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Language Selection Console */}
        <section aria-label="Language Selection">
          <LanguageSelector
            sourceLang={sourceLang}
            targetLang={targetLang}
            onSourceChange={handleSourceChange}
            onTargetChange={handleTargetChange}
            disabled={isTranslating}
          />
        </section>

        {/* Input Mode Navigation Tabs */}
        <div className="input-mode-tabs-container">
          <div className="input-mode-tabs" role="tablist" aria-label="Audio input mode">
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'record'}
              onClick={() => handleInputModeChange('record')}
              className={`mode-tab-btn ${inputMode === 'record' ? 'active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="7" y="2" width="10" height="14" rx="5" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>Record voice</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'upload'}
              onClick={() => handleInputModeChange('upload')}
              className={`mode-tab-btn ${inputMode === 'upload' ? 'active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Upload audio</span>
            </button>
          </div>
        </div>

        {/* Audio Input Panels */}
        <section aria-label="Audio Input Source">
          {inputMode === 'record' ? (
            <AudioRecorder
              sourceLanguageName={sourceName}
              sourceLanguageCode={sourceLang}
              onAudioCaptured={handleAudioCaptured}
              onAudioCleared={handleAudioCleared}
              capturedBlob={recordedBlob}
              capturedMetadata={recordedMetadata}
              disabled={isTranslating}
              activePlaybackSource={activePlaybackSource}
              onPlaybackStarted={handlePlaybackStarted}
              onRequestingPermissionChange={setIsRequestingMicPermission}
              onRecordingStateChange={setIsLiveRecording}
              onPlaybackStateChange={handlePlaybackChange}
            />
          ) : (
            <WavUploader
              onFileLoaded={handleFileLoaded}
              onFileCleared={handleFileCleared}
              currentFile={uploadedFile}
              currentMetadata={uploadedMetadata}
              disabled={isTranslating}
              activePlaybackSource={activePlaybackSource}
              onPlaybackStarted={handlePlaybackStarted}
              onPlaybackStateChange={handlePlaybackChange}
            />
          )}
        </section>

        {/* Translation Output & Synthesis Panel */}
        <section aria-label="Translation Synthesis Output">
          <TranslationOutput
            session={currentSession}
            isTranslating={isTranslating}
            onTranslateAction={handleTranslate}
            onCancelTranslateAction={handleCancelTranslate}
            hasInputAudio={Boolean(activeInput)}
            sourceLang={sourceLang}
            targetLang={targetLang}
            serverUrl={serverConfig.endpoint}
            activePlaybackSource={activePlaybackSource}
            onPlaybackStarted={handlePlaybackStarted}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onPlaybackChange={handlePlaybackChange}
          />
        </section>
      </main>

      {/* Editorial Footer */}
      <footer className="editorial-footer">
        <div className="footer-inner">
          <div className="footer-brand-note">
            <strong>Samvaad</strong> — Multilingual Speech Translation powered by Gemma.
          </div>
          <div className="footer-specs">
            <span>English & Hindi Pivot Architecture</span>
            <span>16 Conference Languages</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
