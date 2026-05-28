import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Award, Flame, BookOpen, Clock, Bookmark, Network, RefreshCw, 
  Sparkles, CheckCircle, HelpCircle, LogOut, ShieldAlert, Cpu, 
  Layers, Star, Calendar, Moon, Wifi, WifiOff 
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useProgressStore } from '../store/useProgressStore';
import { usePaperStore } from '../store/usePaperStore';
import { syncManager } from '../services/syncManager';

export default function Profile() {
  const { user, logout } = useAuthStore();
  const { books, fetchBooks } = useLibraryStore();
  const { logs, fetchLogs, getStreak, getTodayReadingMinutes, dailyGoalMinutes } = useProgressStore();
  const { savedPapers, fetchSavedPapers } = usePaperStore();

  const [syncState, setSyncState] = useState({
    online: true,
    isSimulated: false,
    queueLength: 0,
    statusText: 'Connected & Synced'
  });

  const [activeBadge, setActiveBadge] = useState(null);

  useEffect(() => {
    fetchBooks();
    fetchLogs();
    fetchSavedPapers();

    // Subscribe to syncManager states
    const unsubscribe = syncManager.subscribe((status) => {
      setSyncState(status);
    });
    return unsubscribe;
  }, [fetchBooks, fetchLogs, fetchSavedPapers]);

  // Statistics computations
  const totalMinutes = logs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);
  const totalPages = logs.reduce((sum, log) => sum + (log.pages_read || 0), 0);
  const streak = getStreak();
  const todayMins = getTodayReadingMinutes();
  const completedBooks = books.filter(b => b.status === 'completed').length;
  const currentlyReading = books.filter(b => b.status === 'reading').length;
  const favoriteBooks = books.filter(b => b.favorite).length;

  // Streak/Habit badges logic
  const badgesList = [
    {
      id: 'streak_warmth',
      title: '7-Day Warmth',
      description: 'Logged reading logs on 7 consecutive days to build a cozy, strong habit.',
      icon: Flame,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      unlocked: streak >= 7,
      metric: `${streak}/7 days`
    },
    {
      id: 'pages_explorer',
      title: 'Pages Explorer',
      description: 'Advanced a total of over 500 pages in academic journals or literature volumes.',
      icon: BookOpen,
      color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
      unlocked: totalPages >= 500,
      metric: `${totalPages}/500 p.`
    },
    {
      id: 'night_owl',
      title: 'Night Owl',
      description: 'Logged a reading logs session in the cozy quiet hours between 9 PM and 4 AM.',
      icon: Moon,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      unlocked: logs.some(l => {
        const hour = new Date(l.created_at).getHours();
        return hour >= 21 || hour < 4;
      }),
      metric: logs.some(l => {
        const hour = new Date(l.created_at).getHours();
        return hour >= 21 || hour < 4;
      }) ? 'Unlocked' : '0/1 reads'
    },
    {
      id: 'academic_scholar',
      title: 'Academic Scholar',
      description: 'Saved at least 3 high-impact academic research papers in your cozy database.',
      icon: Bookmark,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      unlocked: savedPapers.length >= 3,
      metric: `${savedPapers.length}/3 papers`
    },
    {
      id: 'cozy_connoisseur',
      title: 'Cozy Connoisseur',
      description: 'Configured at least 2 classic books or modern novels as favorites in your library.',
      icon: Star,
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      unlocked: favoriteBooks >= 2,
      metric: `${favoriteBooks}/2 faves`
    }
  ];

  const handleSimulateToggle = () => {
    syncManager.setSimulatedOffline(!syncState.isSimulated);
  };

  const handleManualSyncTrigger = async () => {
    if (syncState.queueLength > 0 && syncState.online) {
      await syncManager.syncQueue();
    }
  };

  // Determine active database backend type
  const isSupabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  return (
    <div className="relative min-h-screen pb-16">
      {/* Backdrops */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full ambient-glow-1 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[450px] h-[450px] rounded-full ambient-glow-2 pointer-events-none" />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8 relative z-10 font-sans">
        
        {/* Header Profile Panel */}
        <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative overflow-hidden">
          {/* Glowing background */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-tr from-cozy-amber/5 to-cozy-lavender/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cozy-amber to-cozy-amber-dark text-white flex items-center justify-center font-serif text-2xl font-bold shadow-md shadow-cozy-amber/15">
              {(user?.email || 'CR').charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-cozy-amber dark:text-cozy-amber-light flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Persistent Sanctuary Profile
              </span>
              <h2 className="font-serif font-bold text-2xl sm:text-3xl text-cozy-night-300 dark:text-white leading-tight">
                {user?.user_metadata?.full_name || user?.email || 'Verified Cozy Reader'}
              </h2>
              <p className="text-xs text-cozy-night-100/50 dark:text-cozy-cream-200/40 font-mono">
                {user?.email || 'local.reader@sandbox.cozy'}
              </p>
            </div>
          </div>

          <button 
            onClick={logout}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-red-500/20 hover:bg-red-500/10 text-red-500 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out Profile
          </button>
        </div>

        {/* Aggregate Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          
          <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-5 space-y-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-cozy-amber/5 rounded-full blur-lg" />
            <Flame className="w-6 h-6 text-cozy-amber" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-cozy-night-100/40 dark:text-cozy-cream-200/35 uppercase tracking-widest block">Active Streak</span>
              <span className="font-sans font-bold text-2xl text-cozy-night-300 dark:text-white">{streak} days</span>
            </div>
          </div>

          <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-5 space-y-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full blur-lg" />
            <Clock className="w-6 h-6 text-indigo-500" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-cozy-night-100/40 dark:text-cozy-cream-200/35 uppercase tracking-widest block">Minutes Read</span>
              <span className="font-sans font-bold text-2xl text-cozy-night-300 dark:text-white">{totalMinutes} min</span>
            </div>
          </div>

          <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-5 space-y-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-lg" />
            <BookOpen className="w-6 h-6 text-emerald-500" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-cozy-night-100/40 dark:text-cozy-cream-200/35 uppercase tracking-widest block">Pages Completed</span>
              <span className="font-sans font-bold text-2xl text-cozy-night-300 dark:text-white">{totalPages} pages</span>
            </div>
          </div>

          <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-5 space-y-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-lg" />
            <Bookmark className="w-6 h-6 text-rose-500" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-cozy-night-100/40 dark:text-cozy-cream-200/35 uppercase tracking-widest block">Papers Saved</span>
              <span className="font-sans font-bold text-2xl text-cozy-night-300 dark:text-white">{savedPapers.length} papers</span>
            </div>
          </div>

        </div>

        {/* 2. Grid split: Streaks Milestones Awards vs Databases synchronization */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Unlocked Milestones awards grid */}
          <div className="lg:col-span-2 glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="border-b border-cozy-cream-300/40 dark:border-cozy-night-100/10 pb-4">
              <h3 className="font-serif font-bold text-xl text-cozy-night-300 dark:text-white flex items-center gap-2">
                <Award className="w-5.5 h-5.5 text-cozy-amber" />
                <span>Reading Habit Milestones</span>
              </h3>
              <p className="text-xs text-cozy-night-100/50 dark:text-cozy-cream-200/40 mt-1">
                Gamify your reading goals. Build persistent habits to unlock premium visual shields!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {badgesList.map((badge) => {
                const IconComponent = badge.icon;
                return (
                  <button
                    key={badge.id}
                    onClick={() => setActiveBadge(activeBadge?.id === badge.id ? null : badge)}
                    className={`p-4 rounded-2xl border text-left flex gap-4 transition-all duration-300 select-none relative overflow-hidden ${
                      badge.unlocked 
                        ? 'bg-black/5 dark:bg-white/5 border-cozy-amber/35 shadow-sm cursor-pointer'
                        : 'bg-black/5 dark:bg-white/5 opacity-40 border-white/5 hover:opacity-60 cursor-pointer'
                    }`}
                  >
                    {/* Badge light spot */}
                    {badge.unlocked && (
                      <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-cozy-amber/5 rounded-full blur-xl pointer-events-none" />
                    )}

                    <div className={`p-3 rounded-xl flex-shrink-0 border h-fit ${
                      badge.unlocked ? badge.color : 'text-cozy-night-100/30 dark:text-cozy-cream-200/20 border-white/10'
                    }`}>
                      <IconComponent className="w-6 h-6" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex justify-between items-center gap-2">
                        <h4 className="font-bold text-xs text-cozy-night-300 dark:text-white truncate">
                          {badge.title}
                        </h4>
                        {badge.unlocked ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-bold tracking-wider uppercase leading-none">
                            Unlocked
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-cozy-night-100/40 dark:text-cozy-cream-200/30 text-[8px] font-bold tracking-wider uppercase leading-none">
                            Locked
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-cozy-night-100/50 dark:text-cozy-cream-200/40 line-clamp-2 leading-relaxed">
                        {badge.description}
                      </p>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-cozy-amber block mt-1.5">
                        Progress: {badge.metric}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Micro details panel expansion */}
            <AnimatePresence>
              {activeBadge && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 rounded-2xl bg-cozy-amber/10 border border-cozy-amber/20 text-cozy-night-300 dark:text-white space-y-1 text-xs"
                >
                  <h4 className="font-serif font-bold text-sm flex items-center gap-1.5 text-cozy-amber">
                    <Sparkles className="w-4 h-4" />
                    <span>{activeBadge.title} Milestone details</span>
                  </h4>
                  <p className="leading-relaxed opacity-85">
                    {activeBadge.description}
                  </p>
                  <p className="text-[10px] font-semibold opacity-70 italic pt-1">
                    Requirement parameters met: {activeBadge.metric}. Keep building reading streaks to level up your virtual sanctuary achievements!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* Right Area: System Sync Diagnostics & simulated state toggling */}
          <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
            
            <div className="border-b border-cozy-cream-300/40 dark:border-cozy-night-100/10 pb-4">
              <h3 className="font-serif font-bold text-lg text-cozy-night-300 dark:text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-cozy-amber" />
                <span>Sync Engine details</span>
              </h3>
              <p className="text-[11px] text-cozy-night-100/50 dark:text-cozy-cream-200/40 mt-1">
                Deep architectural logs of local storage databases and remote Supabase failures.
              </p>
            </div>

            <div className="space-y-4">
              
              {/* Back-end status row */}
              <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs font-medium">
                  <span className="text-cozy-night-100/50 dark:text-cozy-cream-200/40">Database Mode</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-500 text-[10px] font-bold uppercase tracking-wider">
                    {isSupabaseConfigured ? 'Supabase cloud' : 'Local Sandbox'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-medium border-t border-white/5 pt-3">
                  <span className="text-cozy-night-100/50 dark:text-cozy-cream-200/40">Network connection</span>
                  <span className={`font-semibold flex items-center gap-1 text-[10px] uppercase tracking-wider ${
                    syncState.online ? 'text-emerald-500' : 'text-amber-500'
                  }`}>
                    {syncState.online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                    {syncState.online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-medium border-t border-white/5 pt-3">
                  <span className="text-cozy-night-100/50 dark:text-cozy-cream-200/40">Queue status</span>
                  <span className="font-semibold text-cozy-night-300 dark:text-white">
                    {syncState.queueLength} mutations queued
                  </span>
                </div>
              </div>

              {/* simulated toggler button */}
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase font-bold tracking-widest text-cozy-night-100/40 dark:text-cozy-cream-200/35 pl-0.5">
                  Offline simulation lab
                </h4>
                <p className="text-[11px] text-cozy-night-100/50 dark:text-cozy-cream-200/40 pl-0.5 leading-relaxed">
                  Turn on simulated offline mode to inspect the app's resilient write queues and offline caching! Booklyn guarantees zero data loss.
                </p>
                
                <button
                  onClick={handleSimulateToggle}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border ${
                    syncState.isSimulated
                      ? 'bg-amber-500 border-amber-500 text-white shadow shadow-amber-500/10'
                      : 'bg-white/20 dark:bg-white/5 border-white/10 hover:bg-white/30 text-cozy-night-300 dark:text-white'
                  }`}
                >
                  {syncState.isSimulated ? 'Disable Offline Mode' : 'Enable Simulated Offline'}
                </button>
              </div>

              {/* manual sync */}
              {syncState.queueLength > 0 && syncState.online && (
                <button
                  onClick={handleManualSyncTrigger}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cozy-amber to-cozy-amber-dark text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 animate-pulse-subtle"
                >
                  <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                  <span>Sync mutations queue ({syncState.queueLength})</span>
                </button>
              )}

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
