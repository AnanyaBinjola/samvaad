import React from 'react';

export type VoxState =
  | 'idle'
  | 'permission'
  | 'recording'
  | 'processing'
  | 'complete'
  | 'playing'
  | 'error';

export type VoxSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface VoxMascotProps {
  state?: VoxState;
  size?: VoxSize;
  showBadge?: boolean;
  className?: string;
  onClick?: () => void;
}

const STATE_DESCRIPTIONS: Record<VoxState, string> = {
  idle: 'VOX brand companion in calm listening posture',
  permission: 'VOX awaiting microphone authorization in browser',
  recording: 'VOX capturing live speech input',
  processing: 'VOX neural synthesis active',
  complete: 'VOX translation synthesized',
  playing: 'VOX acoustic stream playing',
  error: 'VOX system notification',
};

const STATE_BADGES: Record<VoxState, string> = {
  idle: 'Companion Active',
  permission: 'Requesting Mic Access',
  recording: 'Recording Voice',
  processing: 'Synthesizing',
  complete: 'Translation Ready',
  playing: 'Acoustic Stream',
  error: 'System Notice',
};

export const VoxMascot: React.FC<VoxMascotProps> = ({
  state = 'idle',
  size = 'md',
  showBadge = false,
  className = '',
  onClick,
}) => {
  const sizeMap: Record<VoxSize, { width: number; height: number }> = {
    xs: { width: 28, height: 28 },
    sm: { width: 36, height: 36 },
    md: { width: 64, height: 64 },
    lg: { width: 84, height: 84 },
    xl: { width: 104, height: 104 },
  };

  const { width, height } = sizeMap[size];

  return (
    <div
      className={`vox-mascot-container vox-state-${state} vox-size-${size} ${className}`}
      aria-label={`VOX companion: ${STATE_DESCRIPTIONS[state]}`}
      role="img"
      onClick={onClick}
    >
      <div className="vox-shadow-pod" aria-hidden="true"></div>

      <svg
        width={width}
        height={height}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="vox-svg-frame"
        aria-hidden="true"
      >
        <defs>
          {/* Ceramic Ivory Shell 3D Volumetric Gradient */}
          <linearGradient id="voxCeramicShell" x1="16" y1="12" x2="84" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="28%" stopColor="#FAF7F0" />
            <stop offset="68%" stopColor="#E6DECE" />
            <stop offset="100%" stopColor="#C8BC9F" />
          </linearGradient>

          {/* Inset Charcoal Matte Faceplate */}
          <linearGradient id="voxCharcoalFace" x1="26" y1="30" x2="74" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#30312B" />
            <stop offset="45%" stopColor="#22231E" />
            <stop offset="100%" stopColor="#141511" />
          </linearGradient>

          {/* Restrained Sage Signal Gradient */}
          <linearGradient id="voxSageSignal" x1="30" y1="30" x2="70" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E2EED9" />
            <stop offset="55%" stopColor="#9BB88D" />
            <stop offset="100%" stopColor="#3F6E55" />
          </linearGradient>

          {/* Vermilion Accent Gradient */}
          <linearGradient id="voxVermilionAccent" x1="40" y1="0" x2="60" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF7661" />
            <stop offset="65%" stopColor="#E45B45" />
            <stop offset="100%" stopColor="#B33A27" />
          </linearGradient>

          {/* Drop Shadow Filter */}
          <filter id="voxElevation" x="-20%" y="-15%" width="140%" height="135%">
            <feDropShadow dx="0" dy="3.5" stdDeviation="3.5" floodColor="#24251F" floodOpacity="0.12" />
          </filter>
        </defs>

        <g filter="url(#voxElevation)">
          {/* 1. Top Audio Antenna Mast with Tiny Vermilion Accent */}
          <path
            d="M 50 16 Q 50 8 50 4"
            stroke="#969082"
            strokeWidth="3.2"
            strokeLinecap="round"
            className="vox-antenna-mast"
          />

          {/* Tiny Vermilion Signal Beacon Pip */}
          <circle
            cx="50"
            cy="4"
            r={state === 'recording' ? '4.5' : '3.2'}
            fill="url(#voxVermilionAccent)"
            className={`vox-beacon-orb vox-beacon-${state}`}
          />

          {/* 2. Rounded Ivory Ceramic Shell Body */}
          <rect
            x="14"
            y="15"
            width="72"
            height="72"
            rx="28"
            fill="url(#voxCeramicShell)"
            stroke="#D5CCA9"
            strokeWidth="1.8"
            className="vox-ceramic-chassis"
          />

          {/* Specular Rim Highlight */}
          <path
            d="M 26 27 Q 50 20 74 27"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.85"
            className="vox-specular-light"
          />

          {/* Subtle Lateral Waveform Rib Details on Shell */}
          <g className="vox-shell-waveform-ribs" stroke="#C8BC9F" strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
            <line x1="17" y1="46" x2="20" y2="46" />
            <line x1="16" y1="51" x2="21" y2="51" />
            <line x1="17" y1="56" x2="20" y2="56" />

            <line x1="80" y1="46" x2="83" y2="46" />
            <line x1="79" y1="51" x2="84" y2="51" />
            <line x1="80" y1="56" x2="83" y2="56" />
          </g>

          {/* 3. Inset Charcoal Faceplate */}
          <rect
            x="24"
            y="31"
            width="52"
            height="36"
            rx="14"
            fill="url(#voxCharcoalFace)"
            stroke="#41423B"
            strokeWidth="1.4"
            className="vox-charcoal-faceplate"
          />

          {/* Integrated Waveform Micro-Track in Faceplate */}
          <path
            d="M 29 49 L 71 49"
            stroke="rgba(255, 255, 255, 0.07)"
            strokeWidth="1"
            className="vox-faceplate-axis"
          />

          {/* 4. State-Driven Signal Graphics */}

          {/* IDLE STATE */}
          {state === 'idle' && (
            <g className="vox-display-idle">
              <circle cx="38" cy="49" r="4.2" fill="url(#voxSageSignal)" />
              <circle cx="62" cy="49" r="4.2" fill="url(#voxSageSignal)" />
              <circle cx="39.2" cy="48" r="1.4" fill="#FFFFFF" opacity="0.9" />
              <circle cx="63.2" cy="48" r="1.4" fill="#FFFFFF" opacity="0.9" />
              <path
                d="M 45 56 Q 50 58 55 56"
                stroke="#C7D7BE"
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity="0.75"
              />
            </g>
          )}

          {/* PERMISSION-PENDING STATE: Waiting pulse */}
          {state === 'permission' && (
            <g className="vox-display-permission">
              <circle cx="38" cy="49" r="4" fill="#E8A856" className="vox-perm-node-1" />
              <circle cx="62" cy="49" r="4" fill="#E8A856" className="vox-perm-node-2" />
              <circle cx="50" cy="49" r="2.5" fill="#E2EED9" className="vox-perm-center" />
            </g>
          )}

          {/* RECORDING STATE: Active Waveform Signals */}
          {state === 'recording' && (
            <g className="vox-display-recording">
              <rect x="30" y="44" width="3.8" height="10" rx="1.9" fill="#FF7661" className="vox-wave-bar-1" />
              <rect x="38" y="39" width="3.8" height="20" rx="1.9" fill="#E45B45" className="vox-wave-bar-2" />
              <rect x="48" y="42" width="3.8" height="14" rx="1.9" fill="#FF7661" className="vox-wave-bar-3" />
              <rect x="58" y="39" width="3.8" height="20" rx="1.9" fill="#E45B45" className="vox-wave-bar-2" />
              <rect x="66" y="44" width="3.8" height="10" rx="1.9" fill="#FF7661" className="vox-wave-bar-1" />
            </g>
          )}

          {/* PROCESSING STATE: Restrained Signal Orbit across Nodes */}
          {state === 'processing' && (
            <g className="vox-display-processing">
              <circle cx="36" cy="49" r="3.8" fill="#A4C297" className="vox-orbit-node-1" />
              <circle cx="50" cy="49" r="4.8" fill="#E2EED9" className="vox-orbit-node-2" />
              <circle cx="64" cy="49" r="3.8" fill="#A4C297" className="vox-orbit-node-3" />
              <path d="M 33 49 L 67 49" stroke="rgba(199, 215, 190, 0.4)" strokeWidth="1.2" strokeDasharray="3 3" />
            </g>
          )}

          {/* COMPLETE STATE: Sage Confirmation Check */}
          {state === 'complete' && (
            <g className="vox-display-complete">
              <circle cx="50" cy="49" r="11" fill="rgba(63, 110, 85, 0.25)" />
              <path
                d="M 42 49 L 47 54 L 58 43"
                stroke="#C7D7BE"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="vox-complete-check"
              />
            </g>
          )}

          {/* PLAYBACK STATE: Synchronized Sage Harmonic Bars */}
          {state === 'playing' && (
            <g className="vox-display-playing">
              <rect x="30" y="45" width="3.8" height="8" rx="1.9" fill="#7FA570" className="vox-play-bar-1" />
              <rect x="38" y="41" width="3.8" height="16" rx="1.9" fill="#C7D7BE" className="vox-play-bar-2" />
              <rect x="48" y="38" width="3.8" height="22" rx="1.9" fill="#E2EED9" className="vox-play-bar-3" />
              <rect x="58" y="41" width="3.8" height="16" rx="1.9" fill="#C7D7BE" className="vox-play-bar-2" />
              <rect x="66" y="45" width="3.8" height="8" rx="1.9" fill="#7FA570" className="vox-play-bar-1" />
            </g>
          )}

          {/* ERROR STATE: Non-alarming calm horizontal aperture */}
          {state === 'error' && (
            <g className="vox-display-error">
              <rect x="34" y="47.5" width="13" height="3" rx="1.5" fill="#E89B6A" className="vox-error-slit-1" />
              <rect x="53" y="47.5" width="13" height="3" rx="1.5" fill="#E89B6A" className="vox-error-slit-2" />
              <circle cx="50" cy="55" r="1.5" fill="#C77042" opacity="0.7" />
            </g>
          )}

          {/* Sculpted Neck Collar Base */}
          <path
            d="M 37 87 L 63 87"
            stroke="#BCB094"
            strokeWidth="3.8"
            strokeLinecap="round"
            className="vox-neck-pedestal"
          />
        </g>
      </svg>

      {showBadge && (
        <span className={`vox-status-badge badge-${state}`}>
          {STATE_BADGES[state]}
        </span>
      )}
    </div>
  );
};
