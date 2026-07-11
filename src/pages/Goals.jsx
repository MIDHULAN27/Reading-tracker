import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, Award, Calendar, CheckCircle2, ChevronRight, 
  Sparkles, Flame, BookOpen, Clock, AlertCircle, Bookmark, Check
} from 'lucide-react';
import { useProgressStore } from '../store/useProgressStore';
import { useLibraryStore } from '../store/useLibraryStore';

export default function Goals() {
  // Zustand store hooks
  const { 
    logs, 
    fetchLogs, 
    getStreak, 
    getTodayReadingMinutes, 
    dailyGoalMinutes, 
    setDailyGoal 
  } = useProgressStore();
  
  const { books, fetchBooks } = useLibraryStore();

  // Component state
  const [goalInput, setGoalInput] = useState(dailyGoalMinutes);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Custom interactive challenges checked states (stored in localStorage)
  const [challenges, setChallenges] = useState(() => {
    const saved = localStorage.getItem('booklyn_sanctuary_challenges');
    return saved ? JSON.parse(saved) : {
      read_scifi: false,
      read_45min: false,
      complete_thick_book: false,
      write_3_reflections: false
    };
  });

  useEffect(() => {
    fetchLogs();
    fetchBooks();
  }, [fetchLogs, fetchBooks]);

  useEffect(() => {
    setGoalInput(dailyGoalMinutes);
  }, [dailyGoalMinutes]);

  // Save challenges to local storage whenever they change
  const handleToggleChallenge = (key) => {
    const updated = { ...challenges, [key]: !challenges[key] };
    setChallenges(updated);
    localStorage.setItem('booklyn_sanctuary_challenges', JSON.stringify(updated));
  };

  const handleApplyGoal = () => {
    setErrorMessage('');
    setSuccessMessage('');
    
    const minutes = Number(goalInput);
    if (isNaN(minutes) || minutes <= 0) {
      setErrorMessage('Please enter a target greater than 0 minutes.');
      return;
    }
    if (minutes > 480) {
      setErrorMessage('Daily target cannot exceed 8 hours (480 minutes).');
      return;
    }

    setDailyGoal(minutes);
    setSuccessMessage(`Daily reading target successfully updated to ${minutes} minutes!`);
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  // ----------------------------------------------------
  // METRICS & PROGRESS CALCULATIONS
  // ----------------------------------------------------
  const todayMinutes = getTodayReadingMinutes();
  const streak = getStreak();
  const dailyGoalProgressPct = Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100));

  // Weekly target calculations (last 7 days cumulative logs)
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 6); // past 7 days including today
  startOfWeek.setHours(0, 0, 0, 0);
  
  const weeklyLogs = logs.filter(log => new Date(log.created_at) >= startOfWeek);
  const weeklyMinutes = weeklyLogs.reduce((sum, log) => sum + Number(log.duration_minutes), 0);
  const weeklyGoalTarget = dailyGoalMinutes * 7;
  const weeklyGoalProgressPct = Math.min(100, Math.round((weeklyMinutes / weeklyGoalTarget) * 100));

  // Overall logs totals
  const totalMinutesRead = logs.reduce((sum, log) => sum + Number(log.duration_minutes), 0);
  const booksCompleted = books.filter(b => b.status === 'completed').length;

  // ----------------------------------------------------
  // GAMIFIED DYNAMIC ACHIEVEMENTS
  // ----------------------------------------------------
  const achievements = [
    {
      id: 'early_bird',
      title: 'Early Bird',
      description: 'Read for at least 10 minutes today.',
      unlocked: todayMinutes >= 10,
      metric: `${todayMinutes}/10 min`
    },
    {
      id: 'daily_victor',
      title: 'Daily Victor',
      description: 'Meet your daily reading target today.',
      unlocked: todayMinutes >= dailyGoalMinutes,
      metric: `${todayMinutes}/${dailyGoalMinutes} min`
    },
    {
      id: 'habit_builder',
      title: 'Consistent Habit',
      description: 'Maintain a 3-day active reading streak.',
      unlocked: streak >= 3,
      metric: `${streak}/3 days`
    },
    {
      id: 'scholar',
      title: 'Sanctuary Scholar',
      description: 'Collect at least 5 books inside your library.',
      unlocked: books.length >= 5,
      metric: `${books.length}/5 volumes`
    },
    {
      id: 'master_reader',
      title: 'Grand Master',
      description: 'Log 150+ minutes of total reading time.',
      unlocked: totalMinutesRead >= 150,
      metric: `${totalMinutesRead}/150 min`
    },
    {
      id: 'first_volume',
      title: 'Finisher Badge',
      description: 'Move at least 1 book to your Completed Shelf.',
      unlocked: booksCompleted >= 1,
      metric: `${booksCompleted}/1 book`
    }
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  // Challenges progress
  const checkedChallengesCount = Object.values(challenges).filter(Boolean).length;
  const challengeProgressPct = Math.round((checkedChallengesCount / 4) * 100);

  return (
    <div className="relative min-h-screen pb-16">
      {/* Background glowing effects */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full ambient-glow-1 pointer-events-none z-0" />
      <div className="absolute bottom-1/3 left-1/4 w-[450px] h-[450px] rounded-full ambient-glow-2 pointer-events-none z-0" />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 sm:space-y-8 relative z-10 font-sans">
        
        {/* Header Title */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-booklyn-amber dark:text-booklyn-amber-light">
            Habit Architect
          </span>
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-booklyn-night-300 dark:text-white leading-tight">
            My Reading Goals
          </h1>
          <p className="text-xs sm:text-sm text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
            Set ambitious targets, monitor weekly reading milestones, and unlock gamified sanctuary achievements.
          </p>
        </div>

        {/* Alert Notifications */}
        <AnimatePresence mode="wait">
          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 text-xs flex items-center gap-2.5 shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </motion.div>
          )}

          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2.5 shadow-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SECTION 1: DUAL TARGET CHARTS & CONFIGURATION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Daily Goal Configurator */}
          <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-booklyn-amber">
                <Target className="w-5.5 h-5.5" />
                <h3 className="font-serif text-lg font-bold text-booklyn-night-300 dark:text-white">Daily Target Configuration</h3>
              </div>
              <p className="text-xs text-booklyn-night-100/65 dark:text-booklyn-cream-200/50 leading-relaxed">
                Adjust your daily target. Meeting this target expands your reading streak, unlocks active milestones, and displays today's metrics beautifully in your home circular progress ring.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center gap-2.5">
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="w-full px-3 py-3 glass-input rounded-2xl text-center text-base font-bold focus:ring-booklyn-amber/30"
                  placeholder="Minutes"
                />
                <button
                  onClick={handleApplyGoal}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-95 transition-all shadow-md shadow-booklyn-amber/15 whitespace-nowrap"
                >
                  Apply Target
                </button>
              </div>
              <div className="flex justify-between items-center text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 font-semibold px-1">
                <span>Active Target: {dailyGoalMinutes} min</span>
                <span>Max: 8 hours</span>
              </div>
            </div>
          </div>

          {/* Today's Reading Ring Metric */}
          <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl flex items-center justify-between gap-6 relative overflow-hidden">
            <div className="space-y-2 flex-1 min-w-0">
              <span className="text-[9px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/45 uppercase tracking-widest block">
                Today's Session
              </span>
              <h3 className="font-serif text-lg font-bold text-booklyn-night-300 dark:text-white truncate">
                Today's Target Progress
              </h3>
              <p className="text-xs text-booklyn-night-100/60 dark:text-booklyn-cream-200/40">
                You have read <span className="font-bold text-booklyn-amber">{todayMinutes} minutes</span> out of your {dailyGoalMinutes} min target.
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <Flame className={`w-4 h-4 ${streak > 0 ? 'text-booklyn-amber animate-pulse' : 'text-booklyn-night-100/30'}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{streak} Day Active Streak</span>
              </div>
            </div>

            {/* Circular Progress Ring */}
            <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  className="stroke-booklyn-cream-300/40 dark:stroke-booklyn-night-100/10 fill-transparent"
                  strokeWidth="6.5"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  className="stroke-booklyn-amber dark:stroke-booklyn-amber-light fill-transparent transition-all duration-700"
                  strokeWidth="6.5"
                  strokeDasharray={239}
                  strokeDashoffset={239 - (239 * dailyGoalProgressPct) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs font-bold text-booklyn-amber">
                {dailyGoalProgressPct}%
              </span>
            </div>
          </div>

          {/* Weekly cumulative progress card */}
          <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/45 uppercase tracking-widest block">
                7-Day Cumulative Progress
              </span>
              <h3 className="font-serif text-lg font-bold text-booklyn-night-300 dark:text-white">
                Weekly Goal Milestones
              </h3>
              <p className="text-xs text-booklyn-night-100/60 dark:text-booklyn-cream-200/40 leading-relaxed">
                Aim to read at least <span className="font-bold">{weeklyGoalTarget} minutes</span> (7 * daily target) every week.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 uppercase">LOGGED MINUTES</span>
                <span className="text-booklyn-amber">{weeklyMinutes} / {weeklyGoalTarget} min ({weeklyGoalProgressPct}%)</span>
              </div>
              <div className="w-full h-2 bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${weeklyGoalProgressPct}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full bg-gradient-to-r from-booklyn-amber to-booklyn-lavender rounded-full"
                />
              </div>
            </div>
          </div>

        </div>

        {/* SECTION 2: DYNAMIC ACHIEVEMENT BADGES */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1.5 border-b border-booklyn-cream-300/30 dark:border-booklyn-night-100/10">
            <div className="flex items-center gap-2">
              <Award className="w-5.5 h-5.5 text-booklyn-amber" />
              <h2 className="font-serif text-xl font-bold tracking-tight">Active Sanctuary Achievements</h2>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-gradient-to-tr from-booklyn-amber/20 to-booklyn-lavender/20 rounded-full text-booklyn-amber border border-booklyn-amber/25">
              {unlockedCount} / {achievements.length} Unlocked
            </span>
          </div>

          {/* Achievements Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {achievements.map((item, idx) => (
              <motion.div 
                key={item.id}
                whileHover={{ y: -3 }}
                className={`glass-panel p-5 border rounded-3xl flex items-start gap-4 transition-all duration-300 shadow-sm relative overflow-hidden ${
                  item.unlocked
                    ? 'border-booklyn-amber/35 shadow-glow-amber bg-white/10 dark:bg-booklyn-amber/5'
                    : 'border-white/20 dark:border-white/5 opacity-65'
                }`}
              >
                {/* Visual glow on unlock */}
                {item.unlocked && (
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-booklyn-amber/5 rounded-full blur-xl pointer-events-none" />
                )}

                {/* Badge Icon circle */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-all ${
                  item.unlocked
                    ? 'bg-gradient-to-tr from-booklyn-amber to-booklyn-amber-dark text-white border-booklyn-amber scale-105 shadow-md shadow-booklyn-amber/15'
                    : 'bg-black/10 dark:bg-white/5 border-white/10 text-booklyn-night-100/35 dark:text-booklyn-cream-200/25'
                }`}>
                  {item.id === 'habit_builder' ? (
                    <Flame className="w-5.5 h-5.5" />
                  ) : item.id === 'scholar' ? (
                    <BookOpen className="w-5.5 h-5.5" />
                  ) : item.id === 'first_volume' ? (
                    <Bookmark className="w-5.5 h-5.5" />
                  ) : (
                    <Award className="w-5.5 h-5.5" />
                  )}
                </div>

                <div className="space-y-1 flex-1 min-w-0 font-sans">
                  <div className="flex justify-between items-center gap-2">
                    <h4 className={`font-serif text-sm font-bold truncate ${item.unlocked ? 'text-booklyn-night-300 dark:text-white' : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/30'}`}>
                      {item.title}
                    </h4>
                    {item.unlocked && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-booklyn-amber flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 leading-relaxed font-semibold">
                    {item.description}
                  </p>
                  <div className="pt-1.5 flex justify-between items-center">
                    <span className={`text-[9px] font-black uppercase tracking-wider ${item.unlocked ? 'text-booklyn-amber' : 'text-booklyn-night-100/30 dark:text-booklyn-cream-200/20'}`}>
                      {item.unlocked ? '● Completed' : '○ Locked'}
                    </span>
                    <span className="text-[9px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/35">
                      {item.metric}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* SECTION 3: SANCTUARY CHALLENGES CHECKLIST (PERSISTENT STATE) */}
        <div className="glass-panel border-white/20 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-tr from-booklyn-amber/5 to-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-booklyn-amber">
                <Sparkles className="w-5.5 h-5.5" />
                <h3 className="font-serif text-xl font-bold tracking-tight text-booklyn-night-300 dark:text-white">
                  Active Sanctuary Challenges
                </h3>
              </div>
              <p className="text-xs text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 max-w-lg">
                Complete custom sanctuary reading challenges to earn achievement flags. Toggled achievements persist to local browser storage securely.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[10px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 uppercase tracking-widest">
                Challenge Progress
              </span>
              <span className="text-xs font-bold text-booklyn-amber">
                {checkedChallengesCount} / 4 ({challengeProgressPct}%)
              </span>
            </div>
          </div>

          <div className="w-full h-1.5 bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${challengeProgressPct}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-booklyn-amber to-booklyn-lavender rounded-full"
            />
          </div>

          {/* Checklist rows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                key: 'read_scifi',
                label: 'Interstellar Studies',
                desc: 'Add and read a Science Fiction book inside discover shelves.'
              },
              {
                key: 'read_45min',
                label: 'Immersion Marathon',
                desc: 'Read for 45+ minutes in a single reading log session.'
              },
              {
                key: 'complete_thick_book',
                label: 'Tome Conqueror',
                desc: 'Complete reading an educational book with >400 total pages.'
              },
              {
                key: 'write_3_reflections',
                label: 'Thought Log Keeper',
                desc: 'Save 3 unique reading reflection logs inside your dashboard.'
              }
            ].map((ch) => {
              const active = challenges[ch.key];
              return (
                <button
                  key={ch.key}
                  onClick={() => handleToggleChallenge(ch.key)}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all duration-300 w-full select-none cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-booklyn-amber/5 to-booklyn-lavender/5 border-booklyn-amber/35 shadow-sm shadow-booklyn-amber/5'
                      : 'bg-black/5 dark:bg-white/5 border-white/10 hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  {/* Styled Checkbox */}
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all mt-0.5 flex-shrink-0 ${
                    active
                      ? 'bg-booklyn-amber border-booklyn-amber text-white shadow-sm'
                      : 'border-booklyn-night-100/20 dark:border-white/10 bg-white/20'
                  }`}>
                    {active && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                  </div>

                  <div className="space-y-0.5 flex-1 min-w-0">
                    <span className={`text-xs font-bold font-serif ${active ? 'text-booklyn-amber line-through opacity-85' : 'text-booklyn-night-300 dark:text-white'}`}>
                      {ch.label}
                    </span>
                    <p className={`text-[10px] leading-relaxed truncate max-w-full ${active ? 'text-booklyn-night-100/35 dark:text-booklyn-cream-200/25 line-through' : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40'}`}>
                      {ch.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
