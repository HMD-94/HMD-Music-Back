import React, { useEffect, useRef } from 'react';

interface FullscreenEdgeVisualizerProps {
  isPlaying: boolean;
}

interface BarState {
  current: number;
  target: number;
  peak: number;
  peakHold: number;
}

export const FullscreenEdgeVisualizer: React.FC<FullscreenEdgeVisualizerProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;

    const NUM_BARS = 36;
    const leftBars: BarState[] = Array.from({ length: NUM_BARS }, () => ({
      current: 8,
      target: 8,
      peak: 8,
      peakHold: 0,
    }));
    const rightBars: BarState[] = Array.from({ length: NUM_BARS }, () => ({
      current: 8,
      target: 8,
      peak: 8,
      peakHold: 0,
    }));

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap dpr to 2 for optimal 60fps performance
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      const playing = isPlayingRef.current;
      const t = time * 0.001;

      // Max width of equalizer bars based on screen width
      const maxBarWidth = Math.min(width * 0.22, 190);
      const minBarWidth = 6;

      // Rhythm generation - Multi-harmonic beat generator (124 BPM base)
      const bpm = 124;
      const beatRate = (bpm / 60) * Math.PI;
      const mainBeat = Math.pow(Math.max(0, Math.sin(t * beatRate)), 5);
      const snareBeat = Math.pow(Math.max(0, Math.sin(t * beatRate + Math.PI * 0.5)), 7) * 0.7;
      const subBass = Math.sin(t * beatRate * 0.5) * 0.25 + 0.25;

      const barSpacing = height / (NUM_BARS + 2);
      const barThickness = Math.max(2, Math.min(5, barSpacing * 0.48));

      // 1. Draw Ambient Dynamic Edge Glow
      const glowIntensity = playing ? 0.35 + mainBeat * 0.35 : 0.08;

      // Left ambient glow
      const leftGlow = ctx.createRadialGradient(
        0,
        height * 0.5,
        10,
        0,
        height * 0.5,
        Math.min(width * 0.45, 380)
      );
      leftGlow.addColorStop(0, `rgba(6, 182, 212, ${glowIntensity})`);
      leftGlow.addColorStop(0.5, `rgba(99, 102, 241, ${glowIntensity * 0.45})`);
      leftGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = leftGlow;
      ctx.fillRect(0, 0, Math.min(width * 0.45, 380), height);

      // Right ambient glow
      const rightGlow = ctx.createRadialGradient(
        width,
        height * 0.5,
        10,
        width,
        height * 0.5,
        Math.min(width * 0.45, 380)
      );
      rightGlow.addColorStop(0, `rgba(217, 70, 239, ${glowIntensity})`);
      rightGlow.addColorStop(0.5, `rgba(99, 102, 241, ${glowIntensity * 0.45})`);
      rightGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = rightGlow;
      ctx.fillRect(width - Math.min(width * 0.45, 380), 0, Math.min(width * 0.45, 380), height);

      // 2. Update and draw Left Edge Bars & Wave
      const leftPoints: { x: number; y: number }[] = [];

      for (let i = 0; i < NUM_BARS; i++) {
        const bar = leftBars[i];
        const norm = i / (NUM_BARS - 1);
        const y = barSpacing * (i + 1.5);

        // Acoustic frequency distribution: Sub-bass bottom/top, rich mids in the center
        const freqShape = Math.sin(norm * Math.PI) * 0.65 + (1 - norm) * 0.35;
        const waveOsc = Math.sin(t * 6 + i * 0.32) * Math.cos(t * 4 - i * 0.2);

        if (playing) {
          const energy =
            freqShape * (0.15 + mainBeat * 0.55 + subBass * 0.2) +
            snareBeat * (i % 2 === 0 ? 0.25 : 0.1) +
            waveOsc * 0.12;
          bar.target = Math.max(minBarWidth, energy * maxBarWidth);
        } else {
          bar.target = minBarWidth;
        }

        // Precision fluid interpolation (snappy attack, smooth release)
        const lerpSpeed = bar.target > bar.current ? 0.35 : 0.12;
        bar.current += (bar.target - bar.current) * lerpSpeed;

        // Peak cap mechanics with gravity
        if (bar.current >= bar.peak) {
          bar.peak = bar.current;
          bar.peakHold = 0.08;
        } else if (bar.peakHold > 0) {
          bar.peakHold -= dt;
        } else {
          bar.peak = Math.max(minBarWidth, bar.peak - dt * 110);
        }

        leftPoints.push({ x: bar.current, y });

        // Draw frequency bar
        const barGrad = ctx.createLinearGradient(0, y, bar.current, y);
        barGrad.addColorStop(0, 'rgba(34, 211, 238, 0.15)');
        barGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.7)');
        barGrad.addColorStop(0.9, 'rgba(34, 211, 238, 0.95)');
        barGrad.addColorStop(1, '#ffffff');

        ctx.beginPath();
        ctx.fillStyle = barGrad;
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(0, y - barThickness * 0.5, bar.current, barThickness, [0, barThickness * 0.5, barThickness * 0.5, 0]);
        } else {
          ctx.rect(0, y - barThickness * 0.5, bar.current, barThickness);
        }
        ctx.fill();

        // Draw studio precision peak cap
        if (playing && bar.peak > minBarWidth + 4) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(bar.peak + 2, y, barThickness * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Smooth Bezier Fluid Spline along left edge
      if (leftPoints.length > 2) {
        ctx.beginPath();
        ctx.moveTo(0, leftPoints[0].y);
        ctx.lineTo(leftPoints[0].x, leftPoints[0].y);

        for (let i = 0; i < leftPoints.length - 1; i++) {
          const xc = (leftPoints[i].x + leftPoints[i + 1].x) * 0.5;
          const yc = (leftPoints[i].y + leftPoints[i + 1].y) * 0.5;
          ctx.quadraticCurveTo(leftPoints[i].x, leftPoints[i].y, xc, yc);
        }

        const last = leftPoints[leftPoints.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.lineTo(0, last.y);
        ctx.closePath();

        const splineGrad = ctx.createLinearGradient(0, 0, maxBarWidth, 0);
        splineGrad.addColorStop(0, 'rgba(6, 182, 212, 0.12)');
        splineGrad.addColorStop(0.7, 'rgba(99, 102, 241, 0.08)');
        splineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = splineGrad;
        ctx.fill();

        // Outline contour of the wave
        ctx.beginPath();
        ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
        for (let i = 0; i < leftPoints.length - 1; i++) {
          const xc = (leftPoints[i].x + leftPoints[i + 1].x) * 0.5;
          const yc = (leftPoints[i].y + leftPoints[i + 1].y) * 0.5;
          ctx.quadraticCurveTo(leftPoints[i].x, leftPoints[i].y, xc, yc);
        }
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // 3. Update and draw Right Edge Bars & Wave (Mirrored)
      const rightPoints: { x: number; y: number }[] = [];

      for (let i = 0; i < NUM_BARS; i++) {
        const bar = rightBars[i];
        const norm = (NUM_BARS - 1 - i) / (NUM_BARS - 1);
        const y = barSpacing * (i + 1.5);

        const freqShape = Math.sin(norm * Math.PI) * 0.65 + norm * 0.35;
        const waveOsc = Math.cos(t * 6.5 - i * 0.28) * Math.sin(t * 4.2 + i * 0.22);

        if (playing) {
          const energy =
            freqShape * (0.15 + mainBeat * 0.55 + subBass * 0.2) +
            snareBeat * (i % 2 !== 0 ? 0.25 : 0.1) +
            waveOsc * 0.12;
          bar.target = Math.max(minBarWidth, energy * maxBarWidth);
        } else {
          bar.target = minBarWidth;
        }

        const lerpSpeed = bar.target > bar.current ? 0.35 : 0.12;
        bar.current += (bar.target - bar.current) * lerpSpeed;

        if (bar.current >= bar.peak) {
          bar.peak = bar.current;
          bar.peakHold = 0.08;
        } else if (bar.peakHold > 0) {
          bar.peakHold -= dt;
        } else {
          bar.peak = Math.max(minBarWidth, bar.peak - dt * 110);
        }

        const xPos = width - bar.current;
        rightPoints.push({ x: xPos, y });

        // Draw frequency bar
        const barGrad = ctx.createLinearGradient(width, y, xPos, y);
        barGrad.addColorStop(0, 'rgba(217, 70, 239, 0.15)');
        barGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.7)');
        barGrad.addColorStop(0.9, 'rgba(232, 121, 249, 0.95)');
        barGrad.addColorStop(1, '#ffffff');

        ctx.beginPath();
        ctx.fillStyle = barGrad;
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(xPos, y - barThickness * 0.5, bar.current, barThickness, [barThickness * 0.5, 0, 0, barThickness * 0.5]);
        } else {
          ctx.rect(xPos, y - barThickness * 0.5, bar.current, barThickness);
        }
        ctx.fill();

        // Draw studio precision peak cap
        if (playing && bar.peak > minBarWidth + 4) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#e879f9';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(width - bar.peak - 2, y, barThickness * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Smooth Bezier Fluid Spline along right edge
      if (rightPoints.length > 2) {
        ctx.beginPath();
        ctx.moveTo(width, rightPoints[0].y);
        ctx.lineTo(rightPoints[0].x, rightPoints[0].y);

        for (let i = 0; i < rightPoints.length - 1; i++) {
          const xc = (rightPoints[i].x + rightPoints[i + 1].x) * 0.5;
          const yc = (rightPoints[i].y + rightPoints[i + 1].y) * 0.5;
          ctx.quadraticCurveTo(rightPoints[i].x, rightPoints[i].y, xc, yc);
        }

        const last = rightPoints[rightPoints.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.lineTo(width, last.y);
        ctx.closePath();

        const splineGrad = ctx.createLinearGradient(width, 0, width - maxBarWidth, 0);
        splineGrad.addColorStop(0, 'rgba(217, 70, 239, 0.12)');
        splineGrad.addColorStop(0.7, 'rgba(99, 102, 241, 0.08)');
        splineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = splineGrad;
        ctx.fill();

        // Outline contour of the wave
        ctx.beginPath();
        ctx.moveTo(rightPoints[0].x, rightPoints[0].y);
        for (let i = 0; i < rightPoints.length - 1; i++) {
          const xc = (rightPoints[i].x + rightPoints[i + 1].x) * 0.5;
          const yc = (rightPoints[i].y + rightPoints[i + 1].y) * 0.5;
          ctx.quadraticCurveTo(rightPoints[i].x, rightPoints[i].y, xc, yc);
        }
        ctx.strokeStyle = 'rgba(232, 121, 249, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // 4. Subtle Border Guide Line
      ctx.fillStyle = playing ? 'rgba(34, 211, 238, 0.8)' : 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, 0, 1.5, height);

      ctx.fillStyle = playing ? 'rgba(232, 121, 249, 0.8)' : 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(width - 1.5, 0, 1.5, height);

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 w-full h-full select-none"
    />
  );
};
