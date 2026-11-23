import React, { useEffect, useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';

export const MouseGlow: React.FC = () => {
  const { settings } = usePlayer();
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -500, y: -500 });
  const [isPointerDevice, setIsPointerDevice] = useState(false);

  useEffect(() => {
    if (settings.ultraMode || settings.spotifyMode || !settings.mouseGlowEffect) return;

    // Only enable for pointer (mouse) fine devices, not touch
    const match = window.matchMedia('(pointer: fine)');
    setIsPointerDevice(match.matches);

    const onMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };

    if (match.matches) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [settings.mouseGlowEffect, settings.ultraMode, settings.spotifyMode]);

  if (settings.ultraMode || settings.spotifyMode || !isPointerDevice || !settings.mouseGlowEffect) return null;

  return (
    <div
      className="fixed pointer-events-none z-10 transition-transform duration-75 ease-out will-change-transform"
      style={{
        transform: `translate3d(${pos.x - 250}px, ${pos.y - 250}px, 0)`,
        width: 500,
        height: 500,
      }}
      aria-hidden="true"
    >
      <div className="w-full h-full rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.12)_0%,rgba(56,189,248,0.06)_40%,transparent_70%)] blur-2xl dark:opacity-80 opacity-60" />
    </div>
  );
};
