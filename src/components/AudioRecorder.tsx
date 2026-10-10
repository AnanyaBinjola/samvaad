import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { WaveformVisualizer } from './WaveformVisualizer';
import { Resonator, type ResonatorState } from './Resonator';
import { encodePcmToWav } from '../utils/wavEncoder';
import { validateWavBlob, formatTime } from '../utils/wavValidator';
import type { AudioMetadata, PlaybackSource } from '../types';

interface AudioRecorderProps {
  sourceLanguageName: string;
  sourceLanguageCode: string;
  onAudioCaptured: (blob: Blob, metadata: AudioMetadata) => void;
  onAudioCleared: () => void;
  capturedBlob: Blob | null;
  capturedMetadata: AudioMetadata | null;
  disabled?: boolean;
  activePlaybackSource?: PlaybackSource;
  onPlaybackStarted?: (source: 'recorder') => void;
  onRequestingPermissionChange?: (isRequesting: boolean) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  sourceLanguageName,
  sourceLanguageCode: _sourceLanguageCode,
  onAudioCaptured,
  onAudioCleared,
  capturedBlob,
  capturedMetadata,
  disabled = false,
  activePlaybackSource,
  onPlaybackStarted,
  onRequestingPermissionChange,
  onRecordingStateChange,
  onPlaybackStateChange,
}) => {
  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState<number>(0);
  const [previewDuration, setPreviewDuration] = useState<number>(0);
  const [srAnnouncement, setSrAnnouncement] = useState<string>('Resonator studio ready.');

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Derive preview URL directly from capturedBlob
  const previewAudioUrl = useMemo(() => {
    if (!capturedBlob) return null;
    return URL.createObjectURL(capturedBlob);
  }, [capturedBlob]);

  // Pause preview if another player becomes active
  useEffect(() => {
    if (activePlaybackSource && activePlaybackSource !== 'recorder') {
      previewAudioRef.current?.pause();
    }
  }, [activePlaybackSource]);



  // Clean up object URL when changed or unmounted
  useEffect(() => {
    return () => {
      if (previewAudioUrl) {
        URL.revokeObjectURL(previewAudioUrl);
      }
    };
  }, [previewAudioUrl]);

  // Clean up all Web Audio nodes and hardware media tracks
  const cleanupAudioContext = useCallback(() => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch {
        // Ignore disconnect errors during teardown
      }
      processorNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setAnalyserNode(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioContext();
    };
  }, [cleanupAudioContext]);

  // Start Recording workflow
  const startRecording = async () => {
    if (isRecording || isRequestingPermission || disabled) return;

    setMicPermissionError(null);
    pcmChunksRef.current = [];
    setRecordingSeconds(0);
    setIsRequestingPermission(true);
    onRequestingPermissionChange?.(true);
    setSrAnnouncement('Requesting microphone permission...');

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicPermissionError('Microphone recording is not supported in this browser environment. Please use WAV file upload.');
      setIsRequestingPermission(false);
      onRequestingPermissionChange?.(false);
      setSrAnnouncement('Microphone recording not supported.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      // Create live analyzer
      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      setAnalyserNode(analyser);

      // Buffer raw PCM samples using ScriptProcessorNode for universal uncompressed PCM WAV conversion
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Create an immutable copy of the channel data slice
        pcmChunksRef.current.push(new Float32Array(inputData));
      };

      sourceNode.connect(analyser);
      sourceNode.connect(processor);
      processor.connect(audioCtx.destination);

      setIsRequestingPermission(false);
      onRequestingPermissionChange?.(false);
      setIsRecording(true);
      onRecordingStateChange?.(true);
      setSrAnnouncement(`Recording started in ${sourceLanguageName}. Speak into the microphone.`);

      // Start live elapsed timer
      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingSeconds(elapsed);
      }, 250);
    } catch (err: unknown) {
      setIsRequestingPermission(false);
      onRequestingPermissionChange?.(false);
      cleanupAudioContext();
      setIsRecording(false);
      onRecordingStateChange?.(false);

      let errorMsg = 'Unable to access microphone on this device.';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMsg = 'Microphone permission was denied. Please allow microphone access in your browser address bar to record speech.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMsg = 'No microphone device was detected on your system. Please connect an audio input device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMsg = 'The microphone is currently in use by another application or operating system process.';
        } else if (err.name === 'OverconstrainedError') {
          errorMsg = 'Requested audio settings are not supported by your microphone.';
        } else if (err.name === 'SecurityError') {
          errorMsg = 'Microphone access is restricted by your browser security configuration.';
        }
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      setMicPermissionError(errorMsg);
      setSrAnnouncement(`Recording error: ${errorMsg}`);
    }
  };

  // Stop Recording workflow
  const stopRecording = async () => {
    if (!isRecording) return;

    setIsRecording(false);
    onRecordingStateChange?.(false);

    const actualSampleRate = audioContextRef.current ? audioContextRef.current.sampleRate : 16000;
    cleanupAudioContext();

    // Flatten all collected Float32 chunks
    const chunks = pcmChunksRef.current;
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);

    if (totalLength === 0) {
      setMicPermissionError('No audio data was captured. Please check your microphone and speak clearly.');
      setSrAnnouncement('No audio data captured.');
      return;
    }

    const mergedSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert and resample to standard 16 kHz uncompressed 16-bit PCM WAV
    const targetRate = 16000;
    const wavBlob = encodePcmToWav(mergedSamples, actualSampleRate, 1, targetRate);

    // Validate WAV integrity using binary header validator
    const validation = await validateWavBlob(wavBlob);

    if (!validation.isValid || !validation.metadata) {
      setMicPermissionError(validation.error || 'Generated WAV audio validation failed.');
      setSrAnnouncement('WAV validation failed.');
      return;
    }

    onAudioCaptured(wavBlob, validation.metadata);
    setSrAnnouncement(
      `Acoustic take ready. Duration: ${formatTime(validation.metadata.durationSeconds)}. You can review or click Translate.`
    );
  };

  // Discard Take workflow
  const handleDiscard = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setIsPlayingPreview(false);
    setPreviewCurrentTime(0);
    onPlaybackStateChange?.(false);
    onAudioCleared();
    setRecordingSeconds(0);
    setMicPermissionError(null);
    setSrAnnouncement('Recording discarded. Resonator ready.');
  };

  // Preview Playback toggle
  const togglePreviewPlayback = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (isPlayingPreview) {
      audio.pause();
      setIsPlayingPreview(false);
      onPlaybackStateChange?.(false);
    } else {
      onPlaybackStarted?.('recorder');
      audio
        .play()
        .then(() => {
          setIsPlayingPreview(true);
          onPlaybackStateChange?.(true);
        })
        .catch((err) => {
          console.warn('[AudioRecorder] Preview playback failed:', err);
          setIsPlayingPreview(false);
          onPlaybackStateChange?.(false);
        });
    }
  };


  // Audio preview time update handler
  const handlePreviewTimeUpdate = () => {
    const audio = previewAudioRef.current;
    if (audio) {
      setPreviewCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setPreviewDuration(audio.duration);
      }
    }
  };

  const handlePreviewLoadedMetadata = () => {
    const audio = previewAudioRef.current;
    if (audio && audio.duration && !isNaN(audio.duration)) {
      setPreviewDuration(audio.duration);
    }
    setPreviewCurrentTime(0);
    setIsPlayingPreview(false);
    onPlaybackStateChange?.(false);
  };

  const handlePreviewSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setPreviewCurrentTime(targetTime);
    if (previewAudioRef.current) {
      previewAudioRef.current.currentTime = targetTime;
    }
  };

  // Derive Resonator instrument state
  const resonatorState: ResonatorState = isRequestingPermission
    ? 'permission'
    : isRecording
    ? 'recording'
    : isPlayingPreview
    ? 'playback'
    : micPermissionError
    ? 'error'
    : capturedBlob
    ? 'success'
    : 'idle';

  const playbackProgressRatio =
    previewDuration > 0 ? Math.min(1, previewCurrentTime / previewDuration) : 0;

  return (
    <div className="recorder-panel-card" aria-label="Audio voice recording">
      {/* Hidden Live Region for Screen Readers */}
      <div className="sr-only" role="status" aria-live="polite">
        {srAnnouncement}
      </div>

      <div className="recorder-header">
        <div className="recorder-title-group">
          <span className="section-eyebrow">Voice Input</span>
          <h3 className="section-heading">Record your message</h3>
        </div>

        <div className="status-pill-group">
          {isRequestingPermission ? (
            <span className="live-pulse-pill permission-pill" role="status">
              <span className="waiting-spinner-pip"></span>
              Requesting mic access...
            </span>
          ) : isRecording ? (
            <span className="live-pulse-pill coral-pill" role="status">
              <span className="pulsing-dot"></span>
              Recording ({formatTime(recordingSeconds)})
            </span>
          ) : capturedBlob ? (
            <span className="live-pulse-pill green-pill" role="status">
              ✓ Message ready
            </span>
          ) : (
            <span className="live-pulse-pill neutral-pill" role="status">
              Ready in {sourceLanguageName}
            </span>
          )}
        </div>
      </div>

      {/* Hero Recording Stage */}
      <div className="resonator-stage-box">
        <div className="resonator-centerpiece-column">
          <Resonator
            state={resonatorState}
            analyserNode={analyserNode}
            size="md"
            className="centerpiece-resonator-device"
          />
        </div>

        {/* Real-time Waveform Visualizer */}
        <div className="recorder-visualizer-box">
          <WaveformVisualizer
            analyserNode={analyserNode}
            isRecording={isRecording}
            isPlaying={isPlayingPreview}
            playbackProgress={playbackProgressRatio}
            theme={isRecording ? 'vermilion' : capturedBlob ? 'sage' : 'charcoal'}
            height={72}
          />
          <div className="visualizer-legend">
            <span>
              {isRecording
                ? `Recording voice in ${sourceLanguageName}...`
                : isPlayingPreview
                ? 'Playing your recorded message'
                : 'Microphone level'}
            </span>
            <span>
              {isRequestingPermission
                ? 'Please allow microphone access in your browser'
                : isRecording
                ? `Elapsed: ${formatTime(recordingSeconds)}`
                : capturedBlob
                ? `Duration: ${formatTime(capturedMetadata?.durationSeconds || 0)}`
                : 'Tap "Start recording" when ready'}
            </span>
          </div>
        </div>
      </div>

      {/* Error Notice Banner */}
      {micPermissionError && (
        <div className="alert-box alert-error" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="alert-text-content">
            <strong>Microphone Notice:</strong> {micPermissionError}
          </div>
        </div>
      )}

      {/* Primary Recording & Playback Action Controls */}
      <div className="recorder-actions">
        {/* 1. Idle State -> Start Recording */}
        {!isRecording && !capturedBlob && (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled || isRequestingPermission}
            className={`record-primary-btn ${isRequestingPermission ? 'btn-loading' : ''}`}
            aria-label={`Start recording speech in ${sourceLanguageName}`}
          >
            <span className="mic-icon-circle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="7" y="2" width="10" height="14" rx="5" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </span>
            <span className="btn-label-group">
              <strong>{isRequestingPermission ? 'Requesting Access...' : 'Start recording'}</strong>
              <small>{isRequestingPermission ? 'Check your browser permission prompt' : `Speak in ${sourceLanguageName}`}</small>
            </span>
          </button>
        )}

        {/* 2. Recording State -> Stop Recording */}
        {isRecording && (
          <button
            type="button"
            onClick={stopRecording}
            className="record-stop-btn"
            aria-label="Stop recording"
          >
            <span className="stop-square-box" aria-hidden="true">■</span>
            <span className="btn-label-group">
              <strong>Stop recording</strong>
              <small>{formatTime(recordingSeconds)} • Tap to finish message</small>
            </span>
          </button>
        )}

        {/* 3. Take Captured State -> Listen & Record Again */}
        {capturedBlob && capturedMetadata && (
          <div className="captured-audio-row">
            {/* Native HTML5 Audio element for take review */}
            {previewAudioUrl && (
              <audio
                ref={previewAudioRef}
                src={previewAudioUrl}
                onPlay={() => {
                  setIsPlayingPreview(true);
                  onPlaybackStateChange?.(true);
                }}
                onPause={() => {
                  setIsPlayingPreview(false);
                  onPlaybackStateChange?.(false);
                }}
                onTimeUpdate={handlePreviewTimeUpdate}
                onLoadedMetadata={handlePreviewLoadedMetadata}
                onEnded={() => {
                  setIsPlayingPreview(false);
                  onPlaybackStateChange?.(false);
                }}
                className="sr-only"
                aria-hidden="true"
              />
            )}

            <div className="captured-details">
              <div className="captured-text">
                <div className="captured-title-row">
                  <strong>Recorded Message ({sourceLanguageName})</strong>
                  <span className="wav-verified-badge">✓ {formatTime(capturedMetadata.durationSeconds)}</span>
                  {capturedMetadata.isSilent && (
                    <span className="silence-warning-badge" title="Very low amplitude detected. Ensure your microphone is unmuted.">
                      ⚠️ Low volume
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Playback Controls & Scrubber */}
            <div className="captured-actions">
              <div className="take-playback-controls">
                <button
                  type="button"
                  onClick={togglePreviewPlayback}
                  className="preview-btn"
                  aria-label={isPlayingPreview ? 'Pause playback' : 'Listen to recording'}
                >
                  {isPlayingPreview ? '❚❚ Pause' : '▶ Listen'}
                </button>

                <div className="take-scrubber-wrap">
                  <span className="take-time-label">{formatTime(previewCurrentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={previewDuration || capturedMetadata.durationSeconds || 1}
                    step={0.1}
                    value={previewCurrentTime}
                    onChange={handlePreviewSeek}
                    className="take-timeline-slider"
                    aria-label="Seek recording playback"
                  />
                  <span className="take-time-label">{formatTime(capturedMetadata.durationSeconds)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDiscard}
                className="discard-btn"
                aria-label="Record again"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                <span>Record again</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
