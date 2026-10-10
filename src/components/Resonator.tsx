import React, { useEffect, useRef, useState } from 'react';

export type ResonatorState =
  | 'idle'
  | 'permission'
  | 'recording'
  | 'processing'
  | 'success'
  | 'playback'
  | 'error';

export type ResonatorSize = 'sm' | 'md' | 'lg';

interface ResonatorProps {
  state?: ResonatorState;
  analyserNode?: AnalyserNode | null;
  size?: ResonatorSize;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export const Resonator: React.FC<ResonatorProps> = ({
  state = 'idle',
  analyserNode = null,
  size = 'md',
  className = '',
  onClick,
  interactive = false,
}) => {
  const [amplitude, setAmplitude] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Monitor real microphone amplitude when recording
  useEffect(() => {
    if (state !== 'recording' || !analyserNode) {
      return;
    }

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      // Focus on vocal frequency range
      const vocalRange = Math.min(bufferLength, 32);
      for (let i = 0; i < vocalRange; i++) {
        sum += dataArray[i];
      }
      const avg = sum / vocalRange;
      const normalized = Math.min(1, Math.max(0, avg / 128));
      setAmplitude(normalized);

      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setAmplitude(0);
    };
  }, [state, analyserNode]);

  const effectiveAmplitude = state === 'recording' ? amplitude : 0;

  const sizeMap = {
    sm: { width: 44, height: 56, scale: 0.7 },
    md: { width: 72, height: 92, scale: 1.0 },
    lg: { width: 104, height: 132, scale: 1.4 },
  };

  const { width, height } = sizeMap[size];

  // Calculate dynamic ring expansions based on real acoustic amplitude
  const ring1Scale = 1 + effectiveAmplitude * 0.45;
  const ring2Scale = 1 + effectiveAmplitude * 0.85;
  const ringOpacity = 0.2 + effectiveAmplitude * 0.6;

  const stateAriaLabels: Record<ResonatorState, string> = {
    idle: 'Samvaad Resonator acoustic instrument in calibrated idle state',
    permission: 'Samvaad Resonator awaiting microphone authorization',
    recording: 'Samvaad Resonator active: capturing live acoustic stream',
    processing: 'Samvaad Resonator synthesizing translation',
    success: 'Samvaad Resonator acoustic take verified',
    playback: 'Samvaad Resonator playing acoustic stream',
    error: 'Samvaad Resonator system notice',
  };

  return (
    <div
      className={`resonator-container resonator-${state} resonator-${size} ${interactive ? 'interactive' : ''} ${className}`}
      onClick={onClick}
      role={interactive ? 'button' : 'img'}
      tabIndex={interactive ? 0 : undefined}
      aria-label={stateAriaLabels[state]}
    >
      {/* Real-time acoustic resonance rings (Only active during recording) */}
      {state === 'recording' && (
        <div className="resonator-sound-rings-layer" aria-hidden="true">
          <div
            className="sound-ring ring-1"
            style={{
              transform: `scale(${ring1Scale})`,
              opacity: ringOpacity,
            }}
          />
          <div
            className="sound-ring ring-2"
            style={{
              transform: `scale(${ring2Scale})`,
              opacity: ringOpacity * 0.6,
            }}
          />
        </div>
      )}

      {/* Permission requesting subtle halo */}
      {state === 'permission' && (
        <div className="resonator-permission-halo" aria-hidden="true">
          <div className="permission-calibrating-ring"></div>
        </div>
      )}

      {/* Processing vermilion travelling orbital halo */}
      {state === 'processing' && (
        <div className="resonator-processing-halo" aria-hidden="true">
          <div className="vermilion-orbit-glow"></div>
        </div>
      )}

      {/* Success sage confirmation ring */}
      {state === 'success' && (
        <div className="resonator-success-halo" aria-hidden="true"></div>
      )}

      {/* Precision Geometric SVG Device Chassis */}
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="resonator-svg-chassis"
        aria-hidden="true"
      >
        <defs>
          {/* Ceramic Ivory Body Gradient */}
          <linearGradient id="ceramicIvoryGrad" x1="15" y1="10" x2="85" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#F9F6EE" />
            <stop offset="75%" stopColor="#E8E1D2" />
            <stop offset="100%" stopColor="#CFC5B2" />
          </linearGradient>

          {/* Recessed Charcoal Acoustic Grille */}
          <linearGradient id="charcoalGrilleGrad" x1="25" y1="25" x2="75" y2="75" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#32332D" />
            <stop offset="50%" stopColor="#22231E" />
            <stop offset="100%" stopColor="#151612" />
          </linearGradient>

          {/* Sage Indicator Ring Gradient */}
          <linearGradient id="sageIndicatorGrad" x1="30" y1="30" x2="70" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E2EED9" />
            <stop offset="60%" stopColor="#7FA570" />
            <stop offset="100%" stopColor="#3F6E55" />
          </linearGradient>

          {/* Vermilion Sensor Node Gradient */}
          <linearGradient id="vermilionSensorGrad" x1="40" y1="90" x2="60" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF7A66" />
            <stop offset="70%" stopColor="#E45B45" />
            <stop offset="100%" stopColor="#B33A27" />
          </linearGradient>

          {/* Device Elevation Shadow */}
          <filter id="resonatorShadow" x="-20%" y="-15%" width="140%" height="135%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#24251F" floodOpacity="0.12" />
          </filter>
        </defs>

        <g filter="url(#resonatorShadow)">
          {/* 1. Outer Ceramic Capsule Body */}
          <rect
            x="14"
            y="12"
            width="72"
            height="104"
            rx="36"
            fill="url(#ceramicIvoryGrad)"
            stroke="#D5CCA9"
            strokeWidth="1.8"
            className="resonator-body-capsule"
          />

          {/* Specular Rim Light on Capsule Dome */}
          <path
            d="M 28 24 Q 50 18 72 24"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* 2. Inset Charcoal Acoustic Chamber */}
          <rect
            x="24"
            y="26"
            width="52"
            height="52"
            rx="26"
            fill="url(#charcoalGrilleGrad)"
            stroke="#41423B"
            strokeWidth="1.5"
            className="resonator-grille-cavity"
          />

          {/* 3. Precision Acoustic Grille Slits */}
          <g className="resonator-grille-lines" stroke="#3A3B34" strokeWidth="1.5" strokeLinecap="round">
            <line x1="38" y1="38" x2="62" y2="38" />
            <line x1="34" y1="45" x2="66" y2="45" />
            <line x1="34" y1="52" x2="66" y2="52" />
            <line x1="34" y1="59" x2="66" y2="59" />
            <line x1="38" y1="66" x2="62" y2="66" />
          </g>

          {/* 4. Center Indicator Lens */}
          <circle
            cx="50"
            cy="52"
            r={state === 'recording' ? 7 + effectiveAmplitude * 3 : 7}
            fill={
              state === 'recording'
                ? '#E45B45'
                : state === 'processing'
                ? '#E45B45'
                : state === 'permission'
                ? '#E8A856'
                : state === 'error'
                ? '#D97A38'
                : 'url(#sageIndicatorGrad)'
            }
            className={`resonator-center-lens lens-${state}`}
          />

          {/* Concentric Indicator Ring */}
          <circle
            cx="50"
            cy="52"
            r="16"
            stroke={
              state === 'recording'
                ? 'rgba(228, 91, 69, 0.6)'
                : state === 'processing'
                ? 'rgba(228, 91, 69, 0.5)'
                : state === 'permission'
                ? 'rgba(232, 168, 86, 0.6)'
                : state === 'success' || state === 'playback'
                ? 'rgba(63, 110, 85, 0.8)'
                : 'rgba(127, 165, 112, 0.35)'
            }
            strokeWidth="1.5"
            strokeDasharray={state === 'processing' || state === 'permission' ? '4 3' : undefined}
            className="resonator-indicator-ring"
          />

          {/* 5. Lower Sensor Port & Calibration Pip */}
          <rect
            x="36"
            y="88"
            width="28"
            height="10"
            rx="5"
            fill="#22231E"
            stroke="#3F4039"
            strokeWidth="1"
          />

          {/* Vermilion Micro-Sensor Pip */}
          <circle
            cx="50"
            cy="93"
            r="2.8"
            fill={state === 'error' ? '#D97A38' : 'url(#vermilionSensorGrad)'}
            className="resonator-sensor-pip"
          />

          {/* Fine Mechanical Side Grooves */}
          <line x1="18" y1="52" x2="21" y2="52" stroke="#B8AE9C" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="18" y1="58" x2="21" y2="58" stroke="#B8AE9C" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="79" y1="52" x2="82" y2="52" stroke="#B8AE9C" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="79" y1="58" x2="82" y2="58" stroke="#B8AE9C" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};
