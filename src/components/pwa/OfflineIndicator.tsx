import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl liquid-glass bg-amber-500/15 border-amber-500/30 px-3.5 py-2 text-xs font-medium text-amber-200 shadow-xl backdrop-blur-xl">
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      <span>Mode hors-ligne — Lecture locale active</span>
    </div>
  );
};
