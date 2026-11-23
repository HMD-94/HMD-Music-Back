import React from 'react';

interface VisualizerWaveProps {
  isPlaying: boolean;
  barsCount?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const VisualizerWave: React.FC<VisualizerWaveProps> = ({
  isPlaying,
  barsCount = 5,
  size = 'md',
}) => {
  const heightClass = size === 'sm' ? 'h-4' : size === 'lg' ? 'h-8' : 'h-5';
  const widthClass = size === 'sm' ? 'w-0.5' : size === 'lg' ? 'w-1.5' : 'w-1';
  const gapClass = size === 'sm' ? 'gap-0.5' : 'gap-1';

  const heights = [0.4, 0.9, 0.6, 1.0, 0.5, 0.8, 0.3, 0.7];

  return (
    <div className={`flex items-end justify-center ${heightClass} ${gapClass}`}>
      {Array.from({ length: barsCount }).map((_, i) => {
        const baseH = heights[i % heights.length];
        const animDelay = `${(i * 0.15).toFixed(2)}s`;
        const animDuration = `${(0.8 + (i % 3) * 0.3).toFixed(2)}s`;

        return (
          <div
            key={i}
            className={`${widthClass} rounded-full bg-gradient-to-t from-indigo-500 via-cyan-400 to-white transition-all duration-300 ${
              isPlaying ? 'animate-liquid-bar' : 'h-1 opacity-40'
            }`}
            style={{
              animationDelay: animDelay,
              animationDuration: animDuration,
              height: isPlaying ? undefined : `${baseH * 100}%`,
            }}
          />
        );
      })}
    </div>
  );
};
