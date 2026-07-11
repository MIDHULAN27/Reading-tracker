import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, X, Sliders } from 'lucide-react';
import { syncManager } from '../services/syncManager';

export default function SyncStatusBanner() {
  const [syncState, setSyncState] = useState({
    online: true,
    isSimulated: false,
    queueLength: 0,
    statusText: 'Connected & Synced'
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Subscribe to sync status changes
    const unsubscribe = syncManager.subscribe((status) => {
      setSyncState(status);
      if (status.queueLength > 0 || !status.online) {
        setDismissed(false); // Force show if there is something interesting to show
      }
    });

    return unsubscribe;
  }, []);

  const toggleSimulateOffline = () => {
    const nextStatus = !syncState.isSimulated;
    syncManager.setSimulatedOffline(nextStatus);
  };

  const { online, queueLength, statusText } = syncState;

  // Render nothing if connected, synced, and dismissed
  if (online && queueLength === 0 && dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 20 }}
        className="fixed bottom-6 right-6 z-40 max-w-sm glass-panel border border-white/20 dark:border-white/10 rounded-2xl shadow-xl p-4 flex flex-col gap-3 font-sans select-none"
      >
        <div className="flex items-center justify-between gap-4">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {!online ? (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              ) : queueLength > 0 ? (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              ) : null}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                !online 
                  ? 'bg-amber-500' 
                  : queueLength > 0 
                    ? 'bg-sky-500' 
                    : 'bg-emerald-500'
              }`} />
            </span>

            <div className="space-y-0.5">
              <p className="text-[11px] font-bold tracking-wide uppercase text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 leading-none">
                System Sync
              </p>
              <p className="text-xs font-semibold text-booklyn-night-300 dark:text-white leading-tight">
                {statusText}
              </p>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-booklyn-night-100/50 dark:text-booklyn-cream-200/40"
              title="Sync diagnostics"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-booklyn-night-100/50 dark:text-booklyn-cream-200/40"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dynamic details inside the banner */}
        {queueLength > 0 && (
          <p className="text-[10px] text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 leading-relaxed font-semibold bg-sky-500/10 border border-sky-500/20 rounded-lg py-1 px-2.5 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin text-sky-500" />
            <span>{queueLength} offline change{queueLength > 1 ? 's' : ''} in queue waiting to sync...</span>
          </p>
        )}

        {/* Diagnostics & Simulator Expansion Panel */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-booklyn-cream-300/30 dark:border-booklyn-night-100/10 pt-3 space-y-2 text-[11px] overflow-hidden"
          >
            <div className="flex justify-between items-center text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 font-medium">
              <span>Network State:</span>
              <span className="font-semibold flex items-center gap-1">
                {online ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-amber-500" />}
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 font-medium">
              <span>Sync Queue Size:</span>
              <span className="font-semibold">{queueLength} updates pending</span>
            </div>

            {/* Offline Simulation toggle */}
            <div className="flex justify-between items-center pt-1.5">
              <span>Simulate Offline Mode:</span>
              <button
                onClick={toggleSimulateOffline}
                className={`py-1 px-2.5 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all duration-300 border ${
                  syncState.isSimulated
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white/10 border-white/20 text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:bg-white/20'
                }`}
              >
                {syncState.isSimulated ? 'Offline Active' : 'Go Offline'}
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
