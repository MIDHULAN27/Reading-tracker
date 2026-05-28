import React, { useEffect, useState } from 'react';
import { useProgressStore } from '../store/useProgressStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { Play, Pause, Square, Clock, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LogSessionModal from './LogSessionModal';

export default function TimerWidget() {
  const { 
    timerActive, timerSeconds, timerBookId, 
    startTimer, pauseTimer, resetTimer, updateTimerSeconds 
  } = useProgressStore();

  const { books } = useLibraryStore();
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const timedBook = books.find(b => b.id === timerBookId);

  // Background active timer tracker interval
  useEffect(() => {
    let interval = null;
    if (timerActive) {
      interval = setInterval(() => {
        updateTimerSeconds();
      }, 500);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, updateTimerSeconds]);

  const handleStopTimer = () => {
    pauseTimer();
    setIsLogModalOpen(true);
  };

  const handleLogModalClose = () => {
    setIsLogModalOpen(false);
    resetTimer(); // Reset timer only when log session is finished/cancelled
  };

  const formatTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    const pad = (num) => String(num).padStart(2, '0');
    return `${hrs > 0 ? hrs + ':' : ''}${pad(mins)}:${pad(secs)}`;
  };

  if (!timerBookId || !timedBook) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="glass-panel border-cozy-amber/30 dark:border-cozy-amber-light/20 glow-border-amber rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          {/* Subtle cozy golden lights */}
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-cozy-amber/5 blur-xl pointer-events-none" />

          {/* Timing details */}
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="relative p-3 rounded-2xl bg-gradient-to-tr from-cozy-amber to-cozy-amber-dark text-white shadow-glow-amber animate-pulse-subtle flex-shrink-0">
              <Clock className="w-6 h-6" />
              {timerActive && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-cozy-night-200" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-cozy-amber dark:text-cozy-amber-light flex items-center justify-center sm:justify-start gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Timer Running</span>
              </span>
              <h4 className="font-serif font-bold text-base truncate max-w-[200px] leading-snug">
                {timedBook.title}
              </h4>
              <p className="text-[11px] text-cozy-night-100/50 dark:text-cozy-cream-200/40 truncate">
                by {timedBook.author}
              </p>
            </div>
          </div>

          {/* Time digits & Controllers */}
          <div className="flex items-center gap-4">
            <div className="font-sans font-bold text-3xl tracking-tight text-cozy-night-300 dark:text-white tabular-nums">
              {formatTime(timerSeconds)}
            </div>

            <div className="flex gap-2">
              {/* Play/Pause toggle */}
              {timerActive ? (
                <button
                  onClick={pauseTimer}
                  className="p-3 rounded-2xl bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 text-cozy-night-300 dark:text-white active:scale-90 transition-transform"
                >
                  <Pause className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => startTimer(timerBookId)}
                  className="p-3 rounded-2xl bg-gradient-to-tr from-cozy-amber to-cozy-amber-dark border-cozy-amber text-white shadow shadow-cozy-amber/10 active:scale-90 transition-transform"
                >
                  <Play className="w-4 h-4 fill-white" />
                </button>
              )}

              {/* Stop & Log button */}
              <button
                onClick={handleStopTimer}
                className="p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/25 active:scale-90 transition-transform"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Embedded session log modal */}
      <LogSessionModal
        isOpen={isLogModalOpen}
        onClose={handleLogModalClose}
        initialBookId={timerBookId}
        prefilledMinutes={Math.max(1, Math.round(timerSeconds / 60))}
      />
    </>
  );
}
