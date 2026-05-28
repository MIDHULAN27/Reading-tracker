import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useProgressStore } from '../store/useProgressStore';
import TimerWidget from '../components/TimerWidget';
import LogSessionModal from '../components/LogSessionModal';
import BookDetailSlideOver from '../components/BookDetailSlideOver';
import RecommendationsFeed from '../components/RecommendationsFeed';
import { 
  Flame, Plus, Bookmark, Clock, ArrowRight, BookOpen, 
  Trash2, Smile, AlertCircle, Heart, Star
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { books, fetchBooks } = useLibraryStore();
  const { 
    logs, fetchLogs, getStreak, getTodayReadingMinutes, 
    dailyGoalMinutes, deleteLog 
  } = useProgressStore();

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  useEffect(() => {
    fetchBooks();
    fetchLogs();
  }, [fetchBooks, fetchLogs]);

  const handleBookClick = (book) => {
    setSelectedBook(book);
    setIsSlideOverOpen(true);
  };

  const handleTrashLog = async (logId, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this reading entry? This will revert the book pages read as well.')) {
      try {
        await deleteLog(logId);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Calculations
  const streak = getStreak();
  const todayMins = getTodayReadingMinutes();
  const goalProgressPct = Math.min(100, Math.round((todayMins / dailyGoalMinutes) * 100));

  const currentlyReading = books.filter(b => b.status === 'reading');
  const recentLogs = logs.slice(0, 3); // top 3 recent logs

  // Past 7 days calculation matching store's date mapping
  const getPast7Days = () => {
    const days = [];
    const readDates = new Set(logs.map(log => log.created_at.split('T')[0]));
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hasRead = readDates.has(dateStr);
      
      // Get the single weekday character
      const weekday = d.toLocaleDateString(undefined, { weekday: 'narrow' });
      const dayNum = d.getDate();
      
      days.push({
        name: weekday,
        dayNum,
        dateStr,
        hasRead,
        isToday: dateStr === new Date().toISOString().split('T')[0]
      });
    }
    return days;
  };

  // Greeting helper
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const userName = user?.user_metadata?.full_name || 'Cozy Reader';

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      {/* Welcome Greeting header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
            <span>{getGreeting()}, {userName}!</span>
            <Smile className="w-6 h-6 text-cozy-amber animate-bounce" />
          </h1>
          <p className="text-sm text-cozy-night-100/60 dark:text-cozy-cream-200/50">
            Welcome back to your warm, quiet reading corner.
          </p>
        </div>

        {/* Quick Log button */}
        <button
          onClick={() => setIsLogModalOpen(true)}
          className="self-start md:self-center py-2.5 px-4 rounded-xl bg-gradient-to-r from-cozy-amber to-cozy-amber-dark text-white font-semibold text-xs hover:brightness-110 active:scale-95 transition-all shadow-md shadow-cozy-amber/15 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Quick Log progress</span>
        </button>
      </div>

      {/* Live Timer Widget - absolute high priority */}
      <TimerWidget />

      {/* THREE-COLUMN HERO GRID (Streaks, Daily Target, Horizontal shelf) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Streak Flame widget */}
        <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl flex flex-col justify-between min-h-48 h-auto relative overflow-hidden">
          <div className="absolute top-[-30px] left-[-30px] w-24 h-24 rounded-full bg-cozy-amber/5 blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cozy-night-100/40 dark:text-cozy-cream-200/40">Reading Streak</span>
            <Flame className={`w-5 h-5 ${streak > 0 ? 'text-cozy-amber animate-pulse' : 'text-cozy-night-100/30'}`} />
          </div>
          <div className="my-2">
            <h3 className="font-sans font-bold text-5xl tracking-tight text-cozy-night-300 dark:text-white flex items-baseline gap-1.5">
              <span>{streak}</span>
              <span className="text-sm font-semibold text-cozy-night-100/50 dark:text-cozy-cream-200/40">days</span>
            </h3>
            <p className="text-[11px] text-cozy-night-100/60 dark:text-cozy-cream-200/50 mt-1 leading-snug">
              {streak > 0 
                ? '🔥 Active streak! Keep up the amazing habit.' 
                : 'Log a session today to start your reading streak!'}
            </p>
          </div>
          
          {/* 7-day streak calendar visualizer grid */}
          <div className="mt-3 border-t border-white/10 pt-2.5">
            <div className="flex items-center justify-between gap-1">
              {getPast7Days().map((day) => (
                <div key={day.dateStr} className="flex flex-col items-center gap-0.5 flex-1">
                  <span className="text-[8px] font-bold text-cozy-night-100/40 dark:text-cozy-cream-200/40 uppercase">
                    {day.name}
                  </span>
                  <div
                    title={day.hasRead ? `Read on ${day.dateStr}` : `No reading on ${day.dateStr}`}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all relative ${
                      day.hasRead
                        ? 'bg-gradient-to-tr from-cozy-amber to-cozy-amber-dark text-white shadow shadow-cozy-amber/20'
                        : day.isToday
                          ? 'border border-dashed border-cozy-amber/60 text-cozy-amber'
                          : 'bg-white/10 dark:bg-white/5 text-cozy-night-100/30 dark:text-cozy-cream-200/20'
                    }`}
                  >
                    {day.hasRead ? (
                      <Flame className="w-3 h-3 fill-white text-white" />
                    ) : (
                      <span>{day.isToday ? '•' : day.dayNum}</span>
                    )}
                    {day.isToday && !day.hasRead && (
                      <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-cozy-amber" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Goal Progress Circle (SVG custom ring) */}
        <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl flex items-center justify-between h-48 relative overflow-hidden">
          <div className="absolute top-[-30px] right-[-30px] w-24 h-24 rounded-full bg-cozy-lavender/5 blur-xl pointer-events-none" />
          <div className="flex flex-col justify-between h-full">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cozy-night-100/40 dark:text-cozy-cream-200/40">Daily Reading Goal</span>
            <div>
              <h3 className="font-sans font-bold text-3xl tracking-tight text-cozy-night-300 dark:text-white flex items-baseline gap-1">
                <span>{todayMins}</span>
                <span className="text-xs font-semibold text-cozy-night-100/40 dark:text-cozy-cream-200/40">/ {dailyGoalMinutes} min</span>
              </h3>
              <p className="text-[11px] text-cozy-night-100/60 dark:text-cozy-cream-200/50 mt-1">
                {goalProgressPct >= 100 
                  ? '🎉 Daily goal achieved!' 
                  : `Keep going! ${dailyGoalMinutes - todayMins} mins left.`}
              </p>
            </div>
          </div>

          {/* SVG Progress Ring */}
          <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="48"
                cy="48"
                r="36"
                className="stroke-cozy-cream-300/40 dark:stroke-cozy-night-100/20 fill-transparent"
                strokeWidth="7"
              />
              {/* Foreground progress */}
              <motion.circle
                cx="48"
                cy="48"
                r="36"
                className="stroke-cozy-amber dark:stroke-cozy-amber-light fill-transparent"
                strokeWidth="7"
                strokeDasharray={226}
                initial={{ strokeDashoffset: 226 }}
                animate={{ strokeDashoffset: 226 - (226 * goalProgressPct) / 100 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute font-sans font-bold text-sm text-cozy-amber dark:text-cozy-amber-light">
              {goalProgressPct}%
            </div>
          </div>
        </div>

        {/* Card 3: Library Status counter */}
        <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl flex flex-col justify-between h-48 relative overflow-hidden">
          <div className="absolute bottom-[-30px] right-[-30px] w-24 h-24 rounded-full bg-cozy-amber/5 blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cozy-night-100/40 dark:text-cozy-cream-200/40">Total Library Books</span>
            <BookOpen className="w-5 h-5 text-cozy-lavender" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-5xl tracking-tight text-cozy-night-300 dark:text-white flex items-baseline gap-1.5">
              <span>{books.length}</span>
              <span className="text-sm font-semibold text-cozy-night-100/50 dark:text-cozy-cream-200/40">volumes</span>
            </h3>
            <p className="text-xs text-cozy-night-100/60 dark:text-cozy-cream-200/50 mt-2 leading-snug">
              With {books.filter(b => b.status === 'completed').length} completed and {books.filter(b => b.status === 'reading').length} on active shelf.
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Active reading deck & Recent logs list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Currently Reading horizontal carousel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl font-bold tracking-tight text-cozy-night-300 dark:text-white">Currently Reading Shelf</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-cozy-night-100/40 dark:text-cozy-cream-200/40">
              {currentlyReading.length} books
            </span>
          </div>

          {currentlyReading.length === 0 ? (
            /* Warning empty box */
            <div className="glass-panel rounded-3xl p-8 border border-white/10 text-center space-y-3">
              <Bookmark className="w-8 h-8 text-cozy-amber/50 mx-auto animate-pulse" />
              <p className="text-xs text-cozy-night-100/60 dark:text-cozy-cream-200/50 max-w-xs mx-auto leading-relaxed">
                You don't have any books active on your reading shelf. Go search titles to start reading!
              </p>
            </div>
          ) : (
            /* Deck carousel grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentlyReading.map((book) => {
                const progressPct = book.pages > 0 ? Math.round((book.progress / book.pages) * 100) : 0;
                return (
                  <motion.div
                    key={book.id}
                    onClick={() => handleBookClick(book)}
                    className="glass-panel rounded-2xl p-4 border border-white/10 shadow hover:border-cozy-amber/35 hover:shadow-glow-amber cursor-pointer flex gap-4 transition-all duration-300 select-none group"
                  >
                    {/* Cover element */}
                    <div className="w-20 h-28 rounded-xl overflow-hidden shadow-md bg-cozy-cream-200 dark:bg-cozy-night-400 flex-shrink-0 relative">
                      {book.cover_url ? (
                        <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${book.cover_color} flex flex-col justify-between text-white p-2 text-left`}>
                          <Bookmark className="w-3.5 h-3.5 self-end opacity-40" />
                          <p className="font-serif text-[10px] font-bold line-clamp-3 leading-snug">{book.title}</p>
                        </div>
                      )}
                    </div>

                    {/* Metadata details */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div className="space-y-1">
                        <h4 className="font-serif font-bold text-sm leading-snug tracking-tight truncate group-hover:text-cozy-amber transition-colors">
                          {book.title}
                        </h4>
                        <p className="text-xs text-cozy-night-100/50 dark:text-cozy-cream-200/40 truncate">
                          {book.author}
                        </p>
                      </div>

                      {/* Mini progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-bold">
                          <span className="text-cozy-night-100/40 dark:text-cozy-cream-200/40">Read progress</span>
                          <span className="text-cozy-amber">{progressPct}%</span>
                        </div>
                        <div className="w-full h-1 bg-cozy-cream-300 dark:bg-cozy-night-400 rounded-full overflow-hidden">
                          <div className="h-full bg-cozy-amber rounded-full" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Recent logs feed */}
        <div className="space-y-4">
          <h3 className="font-serif text-xl font-bold tracking-tight text-cozy-night-300 dark:text-white">Recent Activity</h3>
          
          {recentLogs.length === 0 ? (
            <div className="glass-panel rounded-3xl p-6 border border-white/10 text-center py-10 space-y-2">
              <Clock className="w-6 h-6 text-cozy-night-100/40 dark:text-cozy-cream-200/35 mx-auto" />
              <p className="text-xs text-cozy-night-100/50 dark:text-cozy-cream-200/40 pl-1 leading-snug">
                No sessions logged yet. Pick a volume and start timing!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="glass-panel rounded-2xl p-4 border border-white/10 shadow-sm flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-1.5">
                    {/* Log Header details */}
                    <div>
                      <p className="font-semibold truncate max-w-[180px]">
                        {log.books?.title || 'Unknown Title'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-cozy-night-100/40 dark:text-cozy-cream-200/40 font-semibold uppercase tracking-wider mt-0.5">
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {log.duration_minutes} min</span>
                        <span>•</span>
                        <span>{log.pages_read} pages</span>
                      </div>
                    </div>

                    {/* Musings text details */}
                    {log.notes && (
                      <p className="text-[11px] text-cozy-night-100/60 dark:text-cozy-cream-200/50 bg-white/15 dark:bg-black/10 rounded-lg p-2 italic leading-relaxed border border-white/10">
                        "{log.notes}"
                      </p>
                    )}

                    {/* Date timestamp */}
                    <p className="text-[9px] text-cozy-night-100/30 dark:text-cozy-cream-200/30 font-medium">
                      {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Log Trash button */}
                  <button
                    onClick={(e) => handleTrashLog(log.id, e)}
                    className="p-1.5 rounded-lg text-cozy-night-100/35 hover:text-red-500 hover:bg-red-500/10 dark:text-cozy-cream-200/30 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual Logger overlay dialog */}
      <LogSessionModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />

      {/* Details deck sheet overlay */}
      <BookDetailSlideOver
        book={selectedBook}
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
      />
      
      {/* Curated Recommendations Feed */}
      <RecommendationsFeed />
    </div>
  );
}
