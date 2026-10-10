import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { TranslationSession, PlaybackSource } from '../types';
import { LANGUAGES } from '../languages';
import { formatTime, formatFileSize } from '../utils/wavValidator';
import { VoxMascot } from './VoxMascot';

interface TranslationOutputProps {
  session: TranslationSession | null;
  isTranslating: boolean;
  onTranslateAction: () => void;
  onCancelTranslateAction?: () => void;
  hasInputAudio: boolean;
  sourceLang: string;
  targetLang: string;
  serverUrl: string;
  activePlaybackSource?: PlaybackSource;
  onPlaybackStarted?: (source: 'output') => void;
  onOpenSettings?: () => void;
  onPlaybackChange?: (isPlaying: boolean) => void;
}

export const TranslationOutput: React.FC<TranslationOutputProps> = ({
  session,
  isTranslating,
  onTranslateAction,
  onCancelTranslateAction,
  hasInputAudio,
  sourceLang,
  targetLang,
  serverUrl: _serverUrl,
  activePlaybackSource,
  onPlaybackStarted,
  onOpenSettings,
  onPlaybackChange,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeSourceLang = session?.sourceLang || sourceLang;
  const activeTargetLang = session?.targetLang || targetLang;

  const targetLangName = LANGUAGES[activeTargetLang] || activeTargetLang;
  const sourceLangName = LANGUAGES[activeSourceLang] || activeSourceLang;

  // Clean up object URLs when session changes or component unmounts
  useEffect(() => {
    const audioUrl = session?.outputAudioUrl;
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [session?.outputAudioUrl]);

  // Pause translated audio if another player starts playing
  useEffect(() => {
    if (activePlaybackSource && activePlaybackSource !== 'output') {
      audioRef.current?.pause();
    }
  }, [activePlaybackSource]);


  // Audio event handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setIsBuffering(false);
    setPlaybackError(null);
    onPlaybackChange?.(true);
  }, [onPlaybackChange]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    setIsBuffering(false);
    onPlaybackChange?.(false);
  }, [onPlaybackChange]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentTime(0);
    onPlaybackChange?.(false);
  }, [onPlaybackChange]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.duration && !isNaN(audio.duration)) {
      setDuration(audio.duration);
    }
    setCurrentTime(0);
    setIsPlaying(false);
    setIsBuffering(false);
    setPlaybackError(null);
    onPlaybackChange?.(false);
  }, [onPlaybackChange]);

  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
  }, []);

  const handlePlaying = useCallback(() => {
    setIsBuffering(false);
    setIsPlaying(true);
    setPlaybackError(null);
    onPlaybackChange?.(true);
  }, [onPlaybackChange]);

  const handleAudioError = useCallback(() => {
    setIsPlaying(false);
    setIsBuffering(false);
    setPlaybackError('The browser could not play this audio format. You can download the .WAV file directly.');
    onPlaybackChange?.(false);
  }, [onPlaybackChange]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      onPlaybackStarted?.('output');
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          setPlaybackError(null);
          onPlaybackChange?.(true);
        })
        .catch((err: unknown) => {
          console.warn('[TranslationOutput] Playback failed:', err);
          setIsPlaying(false);
          onPlaybackChange?.(false);
        });
    }
  };



  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div className="output-panel-card" aria-label="Translation output">
      <div className="output-header">
        <div className="output-title-group">
          <span className="section-eyebrow">Translation</span>
          <h3 className="section-heading">Translation result</h3>
        </div>

        {session?.status === 'completed' ? (
          <span className="target-pill-badge" role="status">
            ✓ Translated into {targetLangName}
          </span>
        ) : (
          <span className="target-pair-indicator">
            {sourceLangName} → {targetLangName}
          </span>
        )}
      </div>

      {/* Main Translation Trigger CTA Bar */}
      <div className="translate-cta-container">
        <div className="cta-button-row">
          <button
            type="button"
            onClick={onTranslateAction}
            disabled={!hasInputAudio || isTranslating}
            className={`translate-primary-btn ${isTranslating ? 'loading' : ''}`}
            aria-label={
              isTranslating
                ? 'Translating message'
                : `Translate audio from ${sourceLangName} to ${targetLangName}`
            }
          >
            {isTranslating ? (
              <span className="btn-inner-loading">
                <span className="spinner-orbit" aria-hidden="true"></span>
                Translating message...
              </span>
            ) : (
              <span className="btn-inner-ready">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Translate message ({sourceLangName} → {targetLangName})</span>
              </span>
            )}
          </button>

          {isTranslating && onCancelTranslateAction && (
            <button
              type="button"
              onClick={onCancelTranslateAction}
              className="cancel-translation-btn"
              aria-label="Cancel translation"
            >
              Cancel
            </button>
          )}
        </div>

        {!hasInputAudio && (
          <div className="cta-requirement-caption">
            <span>Record your message or upload an audio file to start translating.</span>
          </div>
        )}
      </div>

      {/* 1. Loading Progress State */}
      {isTranslating && (
        <div className="loading-state-card" role="status" aria-live="polite">
          <VoxMascot state="processing" size="md" />
          <div className="loading-state-details">
            <h4 className="loading-title">Translating your speech...</h4>
            <p className="loading-description">
              Converting {sourceLangName} audio and synthesizing spoken {targetLangName}...
            </p>
            <div className="loading-bar-track" aria-hidden="true">
              <div className="loading-bar-fill"></div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Error State */}
      {!isTranslating && session?.status === 'error' && session.errorMessage && (
        <div className="alert-box alert-error" role="alert">
          <VoxMascot state="error" size="sm" />
          <div className="alert-text-body">
            <div className="alert-title-row">
              <strong>Unable to complete translation</strong>
            </div>
            <p className="alert-message-text">{session.errorMessage}</p>

            {onOpenSettings && (
              <div className="alert-actions-row">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="alert-action-btn"
                  aria-label="Open server settings"
                >
                  Configure server settings →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Completed Translation Results: Aligned Cards & Audio Controls */}
      {!isTranslating && session?.status === 'completed' && (
        <div className="translation-results-container" role="region" aria-label="Translation results">
          {/* Synchronized HTML5 Audio Element */}
          {session.outputAudioUrl && (
            <audio
              key={session.id}
              ref={audioRef}
              src={session.outputAudioUrl}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onWaiting={handleWaiting}
              onPlaying={handlePlaying}
              onError={handleAudioError}
              className="sr-only"
              aria-hidden="true"
            />
          )}

          {playbackError && (
            <div className="alert-box alert-warning" role="alert" style={{ marginBottom: 16 }}>
              <div className="alert-text-body">
                <p className="alert-message-text">{playbackError}</p>
              </div>
            </div>
          )}

          {/* Two-Column Aligned Comparison Grid (Stacked on Mobile) */}
          <div className="translation-cards-grid">
            {/* Left Card: Original Transcription */}
            <div className="transcript-card source-transcript-card">
              <div className="transcript-card-header">
                <span className="transcript-speaker-label">
                  <span className="lang-tag-dot coral-dot" aria-hidden="true"></span>
                  You said ({sourceLangName})
                </span>
              </div>
              <div className="transcript-text-wrapper">
                <p className="transcript-quote source-quote">
                  {session.sourceText ? `“${session.sourceText}”` : 'Voice input captured'}
                </p>
              </div>
            </div>

            {/* Right Card: Translated Text (VISUAL FOCAL POINT) */}
            <div className="transcript-card target-transcript-card focal-card">
              <div className="transcript-card-header">
                <span className="transcript-speaker-label target-label">
                  <span className="lang-tag-dot green-dot" aria-hidden="true"></span>
                  Translation ({targetLangName})
                </span>
                {session.outputBlob && (
                  <a
                    href={session.outputAudioUrl}
                    download={`samvaad_${session.sourceLang}_to_${session.targetLang}_${session.id}.wav`}
                    className="download-action-btn"
                    title="Download translated WAV audio file"
                    aria-label={`Download translated audio (${formatFileSize(session.outputBlob.size)})`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Download audio</span>
                  </a>
                )}
              </div>

              {/* The Focal Translated Text */}
              <div className="transcript-text-wrapper focal-text-wrapper">
                <p className="transcript-quote target-quote">
                  {session.translatedText ? `“${session.translatedText}”` : 'Translated audio ready'}
                </p>
              </div>

              {/* Audio Playback Controls in the Result Card */}
              {session.outputAudioUrl && (
                <div className="result-audio-controls">
                  <div className="result-audio-main-row">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="result-play-btn"
                      aria-label={isPlaying ? 'Pause translation' : 'Listen to translation'}
                    >
                      {isBuffering ? (
                        <span className="player-buffering-spin" aria-hidden="true">◌</span>
                      ) : isPlaying ? (
                        <span className="play-icon-text" aria-hidden="true">❚❚ Pause</span>
                      ) : (
                        <span className="play-icon-text" aria-hidden="true">▶ Listen</span>
                      )}
                    </button>

                    <div className="result-timeline-group">
                      <span className="timeline-time-label">{formatTime(currentTime)}</span>
                      <div className="timeline-slider-wrapper">
                        <div
                          className="timeline-slider-fill"
                          style={{ width: `${progressRatio * 100}%` }}
                          aria-hidden="true"
                        />
                        <input
                          type="range"
                          min={0}
                          max={duration || session.outputDuration || 1}
                          step={0.05}
                          value={currentTime}
                          onChange={handleSeek}
                          className="timeline-slider"
                          aria-label="Seek translated audio playback"
                          aria-valuemin={0}
                          aria-valuemax={Math.round(duration || session.outputDuration || 1)}
                          aria-valuenow={Math.round(currentTime)}
                          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
                        />
                      </div>
                      <span className="timeline-time-label">{formatTime(duration || session.outputDuration || 0)}</span>
                    </div>

                    {/* Speed Controls */}
                    <div className="speed-toggle-group" role="group" aria-label="Playback Speed">
                      {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handleSpeedChange(rate)}
                          className={`speed-pill ${playbackRate === rate ? 'active' : ''}`}
                          aria-pressed={playbackRate === rate}
                          aria-label={`Playback speed ${rate}x`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clean metadata badge */}
          {session.processingSeconds !== undefined && (
            <div className="results-meta-row">
              <span className="results-meta-item">
                Translated in <strong>{session.processingSeconds.toFixed(1)}s</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* 4. Default Idle Placeholder State */}
      {!isTranslating && session?.status !== 'completed' && session?.status !== 'error' && (
        <div className="output-placeholder-card">
          <div className="placeholder-icon-wrap">
            <VoxMascot state="idle" size="sm" />
          </div>
          <h4 className="placeholder-title">Ready for your message</h4>
          <p className="placeholder-text">
            Record your voice or upload an audio file above, then click <strong>“Translate message”</strong> to listen to the interpretation.
          </p>
        </div>
      )}
    </div>
  );
};
