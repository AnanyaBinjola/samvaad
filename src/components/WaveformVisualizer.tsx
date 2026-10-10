import React, { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  isPlaying?: boolean;
  playbackProgress?: number; // 0.0 to 1.0
  theme?: 'vermilion' | 'sage' | 'charcoal';
  height?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  analyserNode,
  isRecording,
  isPlaying = false,
  playbackProgress = 0,
  theme = 'vermilion',
  height = 72,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      const width = canvas.width;
      const canvasHeight = canvas.height;
      ctx.clearRect(0, 0, width, canvasHeight);

      // Color scheme based on state and theme
      const strokeColor =
        theme === 'vermilion'
          ? isRecording
            ? '#E45B45'
            : '#8C8D82'
          : theme === 'sage'
          ? '#43765E'
          : '#24251F';

      const barCount = 36;
      const barSpacing = width / barCount;
      const barWidth = Math.max(3, barSpacing * 0.45);
      const centerY = canvasHeight / 2;

      // Draw baseline rule
      ctx.strokeStyle =
        theme === 'vermilion' && isRecording
          ? 'rgba(228, 91, 69, 0.25)'
          : theme === 'sage'
          ? 'rgba(67, 118, 94, 0.2)'
          : 'rgba(36, 37, 31, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      if (isRecording && analyserNode) {
        // Real-time frequency bin sampling from live microphone input
        analyserNode.getByteFrequencyData(dataArray);

        for (let i = 0; i < barCount; i++) {
          // Sample across lower to mid vocal range
          const binIndex = Math.floor((i / barCount) * Math.min(bufferLength, 32));
          const freqValue = dataArray[binIndex] || 0;
          const amplitude = Math.max(0.08, freqValue / 255);

          const barHeight = Math.max(4, amplitude * (canvasHeight - 12));
          const x = i * barSpacing + (barSpacing - barWidth) / 2;
          const y = centerY - barHeight / 2;

          ctx.fillStyle = strokeColor;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
          ctx.fill();
        }

        // Continue real-time animation loop only when recording
        animationFrameRef.current = requestAnimationFrame(render);
      } else if (isPlaying) {
        // Playback representation: bars highlight up to playback progress
        const currentBarIndex = Math.floor(playbackProgress * barCount);

        for (let i = 0; i < barCount; i++) {
          const isPassed = i <= currentBarIndex;
          // Deterministic harmonic contour based on bar index
          const baseHeightRatio = 0.15 + 0.35 * Math.sin((i / barCount) * Math.PI);
          const barHeight = Math.max(4, baseHeightRatio * (canvasHeight - 14));
          const x = i * barSpacing + (barSpacing - barWidth) / 2;
          const y = centerY - barHeight / 2;

          ctx.fillStyle = isPassed ? strokeColor : 'rgba(140, 141, 130, 0.25)';
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
          ctx.fill();
        }

        // Request animation loop during playback to update progress smoothly
        animationFrameRef.current = requestAnimationFrame(render);
      } else {
        // IDLE / STOPPED: Neutral, static resting baseline (NO fake animated sine waves)
        for (let i = 0; i < barCount; i++) {
          const barHeight = 4; // Minimal resting node height
          const x = i * barSpacing + (barSpacing - barWidth) / 2;
          const y = centerY - barHeight / 2;

          ctx.fillStyle = 'rgba(140, 141, 130, 0.3)';
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();
        }
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [analyserNode, isRecording, isPlaying, playbackProgress, theme]);

  return (
    <div className="waveform-container" style={{ height: `${height}px` }}>
      <canvas
        ref={canvasRef}
        width={480}
        height={height}
        className="waveform-canvas"
        aria-hidden="true"
      />
    </div>
  );
};
