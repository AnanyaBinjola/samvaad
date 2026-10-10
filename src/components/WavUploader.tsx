import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  validateWavFile,
  formatTime,
  formatFileSize,
  MAX_UPLOAD_SIZE_BYTES,
} from '../utils/wavValidator';
import type { AudioMetadata, PlaybackSource } from '../types';

interface WavUploaderProps {
  onFileLoaded: (file: File, metadata: AudioMetadata) => void;
  onFileCleared: () => void;
  currentFile: File | null;
  currentMetadata: AudioMetadata | null;
  disabled?: boolean;
  activePlaybackSource?: PlaybackSource;
  onPlaybackStarted?: (source: 'uploader') => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

export const WavUploader: React.FC<WavUploaderProps> = ({
  onFileLoaded,
  onFileCleared,
  currentFile,
  currentMetadata,
  disabled = false,
  activePlaybackSource,
  onPlaybackStarted,
  onPlaybackStateChange,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState<number>(0);
  const [previewDuration, setPreviewDuration] = useState<number>(0);
  const [srAnnouncement, setSrAnnouncement] = useState<string>('WAV file uploader ready.');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Derive preview URL directly from currentFile
  const previewAudioUrl = useMemo(() => {
    if (!currentFile) return null;
    return URL.createObjectURL(currentFile);
  }, [currentFile]);

  // Clean up object URL when changed or unmounted
  useEffect(() => {
    return () => {
      if (previewAudioUrl) {
        URL.revokeObjectURL(previewAudioUrl);
      }
    };
  }, [previewAudioUrl]);

  // Pause preview if another player becomes active
  useEffect(() => {
    if (activePlaybackSource && activePlaybackSource !== 'uploader') {
      previewAudioRef.current?.pause();
    }
  }, [activePlaybackSource]);


  // Audio preview playback handlers
  const handlePreviewTimeUpdate = useCallback(() => {
    const audio = previewAudioRef.current;
    if (audio) {
      setPreviewCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setPreviewDuration(audio.duration);
      }
    }
  }, []);

  const handlePreviewLoadedMetadata = useCallback(() => {
    const audio = previewAudioRef.current;
    if (audio && audio.duration && !isNaN(audio.duration)) {
      setPreviewDuration(audio.duration);
    }
    setPreviewCurrentTime(0);
    setIsPlayingPreview(false);
    onPlaybackStateChange?.(false);
  }, [onPlaybackStateChange]);

  const togglePreviewPlayback = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (isPlayingPreview) {
      audio.pause();
      setIsPlayingPreview(false);
      onPlaybackStateChange?.(false);
    } else {
      onPlaybackStarted?.('uploader');
      audio
        .play()
        .then(() => {
          setIsPlayingPreview(true);
          onPlaybackStateChange?.(true);
        })
        .catch((err) => {
          console.warn('[WavUploader] Preview playback failed:', err);
          setIsPlayingPreview(false);
          onPlaybackStateChange?.(false);
        });
    }
  };


  const handlePreviewSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setPreviewCurrentTime(targetTime);
    if (previewAudioRef.current) {
      previewAudioRef.current.currentTime = targetTime;
    }
  };

  const processFile = async (file: File) => {
    setValidationError(null);
    setIsValidating(true);
    setSrAnnouncement(`Validating audio file "${file.name}"...`);

    try {
      const result = await validateWavFile(file);
      if (!result.isValid || !result.metadata) {
        const errorMsg = result.error || 'Invalid audio file format.';
        setValidationError(errorMsg);
        setSrAnnouncement(`Upload validation failed: ${errorMsg}`);
        onFileCleared();
      } else {
        onFileLoaded(file, result.metadata);
        setSrAnnouncement(
          `WAV file "${file.name}" successfully validated. Duration: ${formatTime(result.metadata.durationSeconds)}. Ready to translate.`
        );
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error inspecting file.';
      setValidationError(errorMsg);
      setSrAnnouncement(`Upload error: ${errorMsg}`);
      onFileCleared();
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemove = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setIsPlayingPreview(false);
    onPlaybackStateChange?.(false);
    onFileCleared();
    setValidationError(null);
    setPreviewCurrentTime(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSrAnnouncement('Uploaded file removed. Drop zone ready.');
  };

  return (
    <div className="uploader-panel-card" aria-label="WAV Audio File Uploader">
      {/* Hidden ARIA Live region for screen-reader announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {srAnnouncement}
      </div>

      <div className="uploader-header">
        <div className="uploader-title-group">
          <span className="section-eyebrow">File Input</span>
          <h3 className="section-heading">Upload audio file</h3>
        </div>
        <div className="uploader-specs-group">
          <span className="spec-badge">WAV Audio</span>
          <span className="limit-badge">Max {formatFileSize(MAX_UPLOAD_SIZE_BYTES)}</span>
        </div>
      </div>

      {!currentFile ? (
        <div
          className={`dropzone-box ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''} ${isValidating ? 'validating' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && !isValidating && fileInputRef.current?.click()}
          role="button"
          tabIndex={disabled || isValidating ? -1 : 0}
          onKeyDown={(e) => {
            if (!disabled && !isValidating && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload WAV audio file by clicking or dragging and dropping (.wav or .wave)"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.wave,audio/wav,audio/x-wav,audio/wave"
            onChange={handleFileChange}
            disabled={disabled || isValidating}
            className="sr-only"
            id="wav-file-input"
          />

          <div className="dropzone-content">
            <div className="dropzone-icon-circle" aria-hidden="true">
              {isValidating ? (
                <span className="dropzone-spinner"></span>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              )}
            </div>
            <p className="dropzone-primary-text">
              {isValidating
                ? 'Inspecting audio file format...'
                : 'Drag and drop your .wav audio file here, or browse'}
            </p>
            <p className="dropzone-secondary-text">
              Supports uncompressed .wav files up to {formatFileSize(MAX_UPLOAD_SIZE_BYTES)}
            </p>
          </div>
        </div>
      ) : (
        <div className="file-preview-card" role="region" aria-label="Uploaded audio file">
          {/* Native HTML5 Audio for Upload Preview */}
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

          <div className="file-info-group">
            <div className="file-icon-box" aria-hidden="true">
              <span className="file-ext">WAV</span>
            </div>
            <div className="file-details">
              <div className="file-title-row">
                <h4 className="file-name" title={currentFile.name}>
                  {currentFile.name}
                </h4>
                <span className="wav-verified-badge">✓ Ready</span>
                {currentMetadata?.isSilent && (
                  <span className="silence-warning-badge" title="This audio file appears silent. Translation models require spoken speech.">
                    ⚠️ Low volume
                  </span>
                )}
              </div>

              {currentMetadata && (
                <div className="file-meta-row">
                  <span className="meta-chip">{formatFileSize(currentMetadata.sizeBytes)}</span>
                  <span className="meta-chip">{formatTime(currentMetadata.durationSeconds)}</span>
                  <span className="meta-chip">{currentMetadata.sampleRate} Hz</span>
                </div>
              )}
            </div>
          </div>

          <div className="file-actions-group">
            {/* Playback Preview Controls */}
            <div className="upload-playback-controls">
              <button
                type="button"
                onClick={togglePreviewPlayback}
                className="preview-btn"
                aria-label={isPlayingPreview ? 'Pause playback' : 'Listen to uploaded file'}
              >
                {isPlayingPreview ? '❚❚ Pause' : '▶ Listen'}
              </button>

              <div className="upload-scrubber-wrap">
                <span className="take-time-label">{formatTime(previewCurrentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={previewDuration || currentMetadata?.durationSeconds || 1}
                  step={0.1}
                  value={previewCurrentTime}
                  onChange={handlePreviewSeek}
                  className="upload-timeline-slider"
                  aria-label="Seek uploaded audio playback"
                />
                <span className="take-time-label">{formatTime(currentMetadata?.durationSeconds || previewDuration || 0)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="remove-file-btn"
              aria-label="Remove uploaded file and choose another"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Choose another file</span>
            </button>
          </div>
        </div>
      )}

      {/* Validation Error Banner */}
      {validationError && (
        <div className="alert-box alert-error" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="alert-text-content">
            <strong>Validation Notice:</strong> {validationError}
          </div>
        </div>
      )}
    </div>
  );
};
