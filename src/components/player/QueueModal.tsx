import React from 'react';
import { X, Trash2, Music, Play, ListOrdered, Shuffle } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { VisualizerWave } from '../music/VisualizerWave';

export const QueueModal: React.FC = () => {
  const {
    isQueueOpen,
    setIsQueueOpen,
    queue,
    currentTrack,
    isPlaying,
    playTrack,
    removeFromQueue,
    clearQueue,
    shuffle,
    toggleShuffle,
    settings,
  } = usePlayer();

  if (!isQueueOpen) return null;
  const isSpotify = Boolean(settings.spotifyMode);
  const isUltra = Boolean(settings.ultraMode) && !isSpotify;

  return (
    <div
      onClick={() => setIsQueueOpen(false)}
      className={`fixed inset-0 z-50 flex items-center justify-end animate-in fade-in duration-200 ${
        isSpotify ? 'bg-black/75' : 'bg-black/60 backdrop-blur-sm'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md h-full md:h-[calc(100vh-2rem)] md:my-4 md:mr-4 p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 ${
          isSpotify
            ? 'rounded-none md:rounded-xl bg-[#121212] border-l md:border border-white/[0.08] text-white'
            : isUltra
            ? 'rounded-none md:rounded-2xl bg-[#101014]/95 backdrop-blur-xl border-l md:border border-white/[0.1] text-zinc-100'
            : 'rounded-none md:rounded-3xl liquid-glass border-l md:border border-white/20 text-slate-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <ListOrdered
              className={`w-5 h-5 ${
                isSpotify ? 'text-[#1DB954]' : isUltra ? 'text-white' : 'text-cyan-400'
              }`}
            />
            <h3 className="font-bold text-base tracking-tight">File d'attente ({queue.length})</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleShuffle}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                shuffle
                  ? isSpotify
                    ? 'bg-[#1DB954] text-black'
                    : isUltra
                    ? 'bg-white text-zinc-950'
                    : 'bg-indigo-500/20 text-cyan-300'
                  : 'text-[#B3B3B3] hover:text-white'
              }`}
              title="Lecture aléatoire"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              onClick={clearQueue}
              className="p-2 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
              title="Vider la file"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsQueueOpen(false)}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Currently Playing Track */}
        {currentTrack && (
          <div
            className={`mt-4 p-3 border ${
              isSpotify
                ? 'rounded-lg bg-[#181818] border-white/[0.08]'
                : isUltra
                ? 'rounded-2xl shadow-lg bg-white/[0.06] border-white/[0.12]'
                : 'rounded-2xl shadow-lg bg-indigo-500/20 border-indigo-500/40'
            }`}
          >
            <div
              className={`flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-2 ${
                isSpotify ? 'text-[#1DB954]' : isUltra ? 'text-zinc-300' : 'text-cyan-300'
              }`}
            >
              <span>En cours de lecture</span>
              <VisualizerWave isPlaying={isPlaying} size="sm" barsCount={4} />
            </div>
            <div className="flex items-center gap-3">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className={`w-12 h-12 object-cover shadow ${isSpotify ? 'rounded' : 'rounded-xl'}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`;
                }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`font-semibold text-sm truncate ${
                    isSpotify ? 'text-[#1DB954]' : 'text-white'
                  }`}
                >
                  {currentTrack.title}
                </p>
                <p className="text-xs text-[#B3B3B3] truncate">{currentTrack.artist}</p>
              </div>
              <span
                className={`text-xs font-mono tabular-nums ${
                  isSpotify ? 'text-[#B3B3B3]' : isUltra ? 'text-zinc-300' : 'text-cyan-300'
                }`}
              >
                {currentTrack.durationFormatted}
              </span>
            </div>
          </div>
        )}

        {/* Up Next List */}
        <div className="mt-4 flex-1 flex flex-col min-h-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            À suivre
          </p>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {queue.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                La file d'attente est vide.
              </div>
            ) : (
              queue.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <div
                    key={`${track.id}-${idx}`}
                    onClick={() => playTrack(track)}
                    className={`group flex items-center gap-3 p-2.5 transition-colors border cursor-pointer ${
                      isSpotify
                        ? isCurrent
                          ? 'rounded-md bg-[#282828] border-transparent text-[#1DB954]'
                          : 'rounded-md bg-transparent hover:bg-white/[0.07] border-transparent text-[#B3B3B3]'
                        : isCurrent
                        ? isUltra
                          ? 'rounded-xl bg-white/[0.1] border-white/20 text-white'
                          : 'rounded-xl bg-white/10 border-cyan-500/40 text-cyan-300'
                        : 'rounded-xl bg-white/[0.02] hover:bg-white/[0.07] border-white/5 text-slate-300'
                    }`}
                  >
                    <span
                      className={`text-xs font-mono tabular-nums w-5 text-center ${
                        isSpotify && isCurrent ? 'text-[#1DB954] font-bold' : 'text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className={`w-9 h-9 object-cover flex-shrink-0 ${
                        isSpotify ? 'rounded' : 'rounded-lg'
                      }`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium truncate ${
                          isSpotify && isCurrent ? 'text-[#1DB954]' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-[11px] text-[#B3B3B3] truncate">{track.artist}</p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-400">
                      {track.durationFormatted}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(idx);
                      }}
                      className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Retirer de la file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
