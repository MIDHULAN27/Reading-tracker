import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressStore } from '../store/useProgressStore';
import { useLibraryStore } from '../store/useLibraryStore';
import {
  BarChart2, Calendar, PieChart, TrendingUp, BookOpen,
  Clock, FileText, CheckCircle, Flame, Star, Target,
  Award, ArrowUpRight, ArrowDownRight, BookMarked, Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart as RPieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend
} from 'recharts';

// ==========================================
// CUSTOM RECHARTS TOOLTIP
// ==========================================
const GlassTooltip = ({ active, payload, label, unit = '' }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white/80 dark:bg-cozy-night-200/90 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-2xl px-4 py-3 shadow-xl text-xs">
      <p className="font-bold text-cozy-night-300 dark:text-white mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-cozy-night-100/70 dark:text-cozy-cream-200/60">
          <span style={{ color: entry.color }} className="font-semibold">{entry.name}:</span>{' '}
          {entry.value}{unit}
        </p>
      ))}
    </div>
  );
};

// ==========================================
// STAT CARD COMPONENT
// ==========================================
const StatCard = ({ label, value, icon: Icon, desc, trend, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass-panel rounded-3xl p-5 border border-white/10 shadow-lg flex flex-col justify-between h-36 group hover:shadow-xl hover:border-cozy-amber/15 transition-all duration-500"
    >
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-cozy-night-100/40 dark:text-cozy-cream-200/40">{label}</span>
        <div className="p-1.5 rounded-xl bg-cozy-amber/10 dark:bg-cozy-amber/5 group-hover:bg-cozy-amber/20 transition-colors">
          <Icon className="w-4 h-4 text-cozy-amber" />
        </div>
      </div>
      <div>
        <div className="flex items-end gap-2">
          <h3 className="font-sans font-bold text-3xl tracking-tight text-cozy-night-300 dark:text-white leading-tight">
            {value}
          </h3>
          {trend !== undefined && trend !== null && (
            <span className={`flex items-center gap-0.5 text-[10px] font-bold mb-1 ${trend >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="text-[10px] text-cozy-night-100/45 dark:text-cozy-cream-200/40 mt-1 truncate">
          {desc}
        </p>
      </div>
    </motion.div>
  );
};

// ==========================================
// CHART SECTION CARD WRAPPER
// ==========================================
const ChartCard = ({ children, icon: Icon, title, subtitle, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 25 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay }}
    className={`glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl space-y-5 ${className}`}
  >
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-gradient-to-br from-cozy-amber/15 to-cozy-lavender/10 dark:from-cozy-amber/10 dark:to-cozy-lavender/5">
          <Icon className="w-5 h-5 text-cozy-amber" />
        </div>
        <div>
          <h3 className="font-serif text-base font-bold text-cozy-night-300 dark:text-white leading-snug">{title}</h3>
          {subtitle && (
            <p className="text-[10px] text-cozy-night-100/40 dark:text-cozy-cream-200/35 font-semibold uppercase tracking-wider mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
    {children}
  </motion.div>
);

// ==========================================
// MAIN ANALYTICS COMPONENT
// ==========================================
export default function Analytics() {
  const { logs, fetchLogs, dailyGoalMinutes, getStreak, getTodayReadingMinutes } = useProgressStore();
  const { books, fetchBooks } = useLibraryStore();
  const [timeRange, setTimeRange] = useState('weekly'); // 'weekly' | 'monthly' | 'yearly'

  useEffect(() => {
    fetchBooks();
    fetchLogs();
  }, [fetchBooks, fetchLogs]);

  // ==========================================
  // COMPUTED METRICS
  // ==========================================

  const metrics = useMemo(() => {
    const totalMins = logs.reduce((t, l) => t + l.duration_minutes, 0);
    const totalPages = logs.reduce((t, l) => t + l.pages_read, 0);
    const completedBooks = books.filter(b => b.status === 'completed');
    const readingBooks = books.filter(b => b.status === 'reading');
    const avgPagesPerSession = logs.length > 0 ? Math.round(totalPages / logs.length) : 0;
    const avgMinutesPerSession = logs.length > 0 ? Math.round(totalMins / logs.length) : 0;
    const completionRate = books.length > 0 ? Math.round((completedBooks.length / books.length) * 100) : 0;

    // This week vs last week (for trend calculations)
    const today = new Date();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekLogs = logs.filter(l => new Date(l.created_at) >= thisWeekStart);
    const lastWeekLogs = logs.filter(l => {
      const d = new Date(l.created_at);
      return d >= lastWeekStart && d < thisWeekStart;
    });

    const thisWeekPages = thisWeekLogs.reduce((s, l) => s + l.pages_read, 0);
    const lastWeekPages = lastWeekLogs.reduce((s, l) => s + l.pages_read, 0);
    const pagesTrend = lastWeekPages > 0 ? Math.round(((thisWeekPages - lastWeekPages) / lastWeekPages) * 100) : (thisWeekPages > 0 ? 100 : 0);

    const thisWeekMins = thisWeekLogs.reduce((s, l) => s + l.duration_minutes, 0);
    const lastWeekMins = lastWeekLogs.reduce((s, l) => s + l.duration_minutes, 0);
    const timeTrend = lastWeekMins > 0 ? Math.round(((thisWeekMins - lastWeekMins) / lastWeekMins) * 100) : (thisWeekMins > 0 ? 100 : 0);

    return {
      totalMins,
      totalHours: (totalMins / 60).toFixed(1),
      totalPages,
      completedBooks: completedBooks.length,
      readingBooks: readingBooks.length,
      avgPagesPerSession,
      avgMinutesPerSession,
      completionRate,
      pagesTrend,
      timeTrend,
      totalBooks: books.length
    };
  }, [logs, books]);

  const streak = getStreak();
  const todayMinutes = getTodayReadingMinutes();
  const goalProgress = Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100));

  // ==========================================
  // CHART DATA GENERATORS
  // ==========================================

  // Weekly Activity (Area Chart) — last 7 days
  const weeklyChartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const minutesRead = logs.filter(l => l.created_at.split('T')[0] === dateStr).reduce((s, l) => s + l.duration_minutes, 0);
      const pagesRead = logs.filter(l => l.created_at.split('T')[0] === dateStr).reduce((s, l) => s + l.pages_read, 0);
      data.push({ day: days[date.getDay()], minutes: minutesRead, pages: pagesRead });
    }
    return data;
  }, [logs]);

  // Monthly Activity (Bar Chart) — last 30 days grouped by week
  const monthlyChartData = useMemo(() => {
    const data = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (w * 7 + 6));
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - (w * 7));

      const weekLogs = logs.filter(l => {
        const d = new Date(l.created_at);
        return d >= weekStart && d <= weekEnd;
      });

      const totalMins = weekLogs.reduce((s, l) => s + l.duration_minutes, 0);
      const totalPages = weekLogs.reduce((s, l) => s + l.pages_read, 0);
      const label = `Week ${4 - w}`;
      data.push({ week: label, minutes: totalMins, pages: totalPages });
    }
    return data;
  }, [logs]);

  // Yearly Activity (Line Chart) — last 12 months
  const yearlyChartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = months[targetMonth.getMonth()];
      const year = targetMonth.getFullYear();
      const monthLogs = logs.filter(l => {
        const d = new Date(l.created_at);
        return d.getMonth() === targetMonth.getMonth() && d.getFullYear() === year;
      });
      const totalMins = monthLogs.reduce((s, l) => s + l.duration_minutes, 0);
      const totalPages = monthLogs.reduce((s, l) => s + l.pages_read, 0);
      data.push({ month: monthStr, minutes: totalMins, pages: totalPages });
    }
    return data;
  }, [logs]);

  // Genre Distribution Data (Pie Chart)
  const genreData = useMemo(() => {
    const genreCounts = {};
    books.forEach(b => {
      const genre = b.genre || 'Other';
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });
    return Object.entries(genreCounts)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value);
  }, [books]);

  // Reading Status Distribution (Donut)
  const statusData = useMemo(() => {
    const reading = books.filter(b => b.status === 'reading').length;
    const completed = books.filter(b => b.status === 'completed').length;
    const toRead = books.filter(b => b.status === 'to_read').length;
    return [
      { name: 'Reading', value: reading },
      { name: 'Completed', value: completed },
      { name: 'To Read', value: toRead },
    ].filter(d => d.value > 0);
  }, [books]);

  // Heatmap data (last 12 weeks / 84 days)
  const heatmapData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 83; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const pagesRead = logs.filter(l => l.created_at.split('T')[0] === dateStr).reduce((s, l) => s + l.pages_read, 0);
      data.push({ dateStr, count: pagesRead, dayOfWeek: date.getDay() });
    }
    return data;
  }, [logs]);

  // ==========================================
  // COLORS
  // ==========================================
  const GENRE_COLORS = ['#D97706', '#818CF8', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#F59E0B', '#6366F1', '#14B8A6', '#F43F5E'];
  const STATUS_COLORS = ['#3B82F6', '#10B981', '#D97706'];
  const CHART_AMBER = '#D97706';
  const CHART_LAVENDER = '#818CF8';

  // Heat color helper
  const getHeatColor = (count) => {
    if (count === 0) return 'bg-cozy-cream-200/50 dark:bg-cozy-night-100/40';
    if (count <= 10) return 'bg-cozy-amber/20 dark:bg-cozy-amber-light/10';
    if (count <= 25) return 'bg-cozy-amber/45 dark:bg-cozy-amber-light/25';
    if (count <= 50) return 'bg-cozy-amber/70 dark:bg-cozy-amber-light/50';
    return 'bg-cozy-amber dark:bg-cozy-amber-light shadow-glow-amber';
  };

  // Get active chart data based on timeRange
  const activeChartData = timeRange === 'weekly' ? weeklyChartData : timeRange === 'monthly' ? monthlyChartData : yearlyChartData;
  const activeXKey = timeRange === 'weekly' ? 'day' : timeRange === 'monthly' ? 'week' : 'month';

  // Favorite genres (top 3)
  const topGenres = genreData.slice(0, 3);

  return (
    <div className="space-y-6 md:space-y-8 pb-24">
      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-2">Reading Analytics</h1>
        <p className="text-sm text-cozy-night-100/60 dark:text-cozy-cream-200/50">
          Visualize your reading persistence, streaking patterns, and library insights.
        </p>
      </motion.div>

      {/* CORE STATS GRID - 6 Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Reading Streak" value={`${streak} 🔥`} icon={Flame} desc={streak > 0 ? 'Keep the fire burning!' : 'Start reading today!'} delay={0} />
        <StatCard label="Pages Read" value={metrics.totalPages.toLocaleString()} icon={FileText} desc={`Avg ${metrics.avgPagesPerSession} per session`} trend={metrics.pagesTrend} delay={0.05} />
        <StatCard label="Time Devoted" value={`${metrics.totalHours}h`} icon={Clock} desc={`${metrics.totalMins} total minutes`} trend={metrics.timeTrend} delay={0.1} />
        <StatCard label="Books Done" value={metrics.completedBooks} icon={CheckCircle} desc={`${metrics.readingBooks} in progress`} delay={0.15} />
        <StatCard label="Completion Rate" value={`${metrics.completionRate}%`} icon={Award} desc={`${metrics.totalBooks} books shelved`} delay={0.2} />
        <StatCard label="Daily Goal" value={`${goalProgress}%`} icon={Target} desc={`${todayMinutes}/${dailyGoalMinutes} min today`} delay={0.25} />
      </div>

      {/* DAILY GOAL PROGRESS BAR */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="glass-panel rounded-3xl p-5 border border-white/10 shadow-lg"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cozy-amber" />
            <span className="text-xs font-bold text-cozy-night-300 dark:text-white">Today's Reading Goal</span>
          </div>
          <span className="text-xs font-bold text-cozy-amber">{todayMinutes} / {dailyGoalMinutes} min</span>
        </div>
        <div className="h-3 bg-cozy-cream-300/40 dark:bg-cozy-night-100/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${goalProgress}%` }}
            transition={{ duration: 1, delay: 0.4 }}
            className={`h-full rounded-full transition-all ${goalProgress >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-r from-cozy-amber to-cozy-amber-dark shadow-glow-amber'}`}
          />
        </div>
        {goalProgress >= 100 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] font-bold text-emerald-500 mt-2 flex items-center gap-1"
          >
            <CheckCircle className="w-3 h-3" /> Goal achieved! 🎉
          </motion.p>
        )}
      </motion.div>

      {/* MAIN CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart A: Reading Activity (Area/Line/Bar) — 2 cols */}
        <ChartCard
          icon={BarChart2}
          title="Reading Activity"
          subtitle="Tracks your reading time & pages over time"
          className="lg:col-span-2"
          delay={0.35}
        >
          {/* Time Range Toggle Capsules */}
          <div className="flex gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-xl w-fit">
            {[
              { id: 'weekly', label: 'Week' },
              { id: 'monthly', label: 'Month' },
              { id: 'yearly', label: 'Year' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTimeRange(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  timeRange === tab.id
                    ? 'bg-gradient-to-r from-cozy-amber to-cozy-amber-dark text-white shadow-md'
                    : 'text-cozy-night-100/50 dark:text-cozy-cream-200/40 hover:text-cozy-night-300 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {timeRange === 'weekly' ? (
                <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientMinutes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_AMBER} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_AMBER} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradientPages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_LAVENDER} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_LAVENDER} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-cozy-cream-300/30 dark:text-cozy-night-100/15" />
                  <XAxis dataKey={activeXKey} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-cozy-night-100/50 dark:text-cozy-cream-200/40" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-cozy-night-100/50 dark:text-cozy-cream-200/40" axisLine={false} tickLine={false} />
                  <Tooltip content={<GlassTooltip />} />
                  <Area type="monotone" dataKey="minutes" name="Minutes" stroke={CHART_AMBER} fill="url(#gradientMinutes)" strokeWidth={2.5} dot={{ r: 4, fill: CHART_AMBER, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="pages" name="Pages" stroke={CHART_LAVENDER} fill="url(#gradientPages)" strokeWidth={2} dot={{ r: 3, fill: CHART_LAVENDER, strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              ) : timeRange === 'monthly' ? (
                <BarChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-cozy-cream-300/30 dark:text-cozy-night-100/15" />
                  <XAxis dataKey={activeXKey} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-cozy-night-100/50 dark:text-cozy-cream-200/40" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-cozy-night-100/50 dark:text-cozy-cream-200/40" axisLine={false} tickLine={false} />
                  <Tooltip content={<GlassTooltip />} />
                  <Bar dataKey="minutes" name="Minutes" fill={CHART_AMBER} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pages" name="Pages" fill={CHART_LAVENDER} radius={[8, 8, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-cozy-cream-300/30 dark:text-cozy-night-100/15" />
                  <XAxis dataKey={activeXKey} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-cozy-night-100/50 dark:text-cozy-cream-200/40" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-cozy-night-100/50 dark:text-cozy-cream-200/40" axisLine={false} tickLine={false} />
                  <Tooltip content={<GlassTooltip />} />
                  <Line type="monotone" dataKey="minutes" name="Minutes" stroke={CHART_AMBER} strokeWidth={2.5} dot={{ r: 4, fill: CHART_AMBER, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="pages" name="Pages" stroke={CHART_LAVENDER} strokeWidth={2} dot={{ r: 3, fill: CHART_LAVENDER, strokeWidth: 2, stroke: '#fff' }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Legend pills */}
          <div className="flex items-center gap-4 text-[10px] font-bold text-cozy-night-100/50 dark:text-cozy-cream-200/40">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_AMBER }} /> Minutes Read</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_LAVENDER }} /> Pages Read</div>
          </div>
        </ChartCard>

        {/* Chart B: Genre Distribution (Pie Chart) */}
        <ChartCard icon={PieChart} title="Genre Breakdown" subtitle="Your library composition" delay={0.4}>
          {genreData.length === 0 ? (
            <div className="text-center py-16 space-y-2 text-xs text-cozy-night-100/50 dark:text-cozy-cream-200/40">
              <BookOpen className="w-8 h-8 mx-auto opacity-30" />
              <p>Add books with genres to see distribution.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie
                      data={genreData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {genreData.map((_, i) => (
                        <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white/80 dark:bg-cozy-night-200/90 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-2xl px-4 py-3 shadow-xl text-xs">
                          <p className="font-bold text-cozy-night-300 dark:text-white">{d.name}</p>
                          <p className="text-cozy-night-100/70 dark:text-cozy-cream-200/60">{d.value} {d.value === 1 ? 'book' : 'books'}</p>
                        </div>
                      );
                    }} />
                  </RPieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="space-y-1.5 overflow-y-auto max-h-32 custom-scrollbar pr-1 text-[11px]">
                {genreData.map((genre, idx) => (
                  <div key={genre.name} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: GENRE_COLORS[idx % GENRE_COLORS.length] }} />
                      <span className="font-medium text-cozy-night-100/80 dark:text-cozy-cream-200/70 truncate max-w-[110px]">{genre.name}</span>
                    </div>
                    <span className="font-semibold text-cozy-night-100/50 dark:text-cozy-cream-200/40">
                      {genre.value} ({Math.round((genre.value / metrics.totalBooks) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* SECOND ROW: Heatmap + Status + Top Genres */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Heatmap — 2 cols */}
        <ChartCard icon={Calendar} title="Reading Consistency" subtitle="Daily pages over the past 12 weeks" className="lg:col-span-2" delay={0.45}>
          <div className="flex flex-col overflow-x-auto custom-scrollbar pb-2">
            <div className="flex gap-1.5 min-w-[520px]">
              {Array.from({ length: 12 }).map((_, weekIdx) => {
                const weekBlocks = heatmapData.slice(weekIdx * 7, (weekIdx + 1) * 7);
                return (
                  <div key={weekIdx} className="flex flex-col gap-1.5 flex-1">
                    {weekBlocks.map((block) => {
                      const blockDate = new Date(block.dateStr);
                      const formattedDate = blockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      return (
                        <motion.div
                          key={block.dateStr}
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: weekIdx * 0.02 }}
                          title={`${block.count} pages — ${formattedDate}`}
                          className={`aspect-square w-full rounded-md cursor-pointer transition-all duration-200 hover:scale-[1.2] hover:z-10 border border-transparent hover:border-cozy-amber/30 ${getHeatColor(block.count)}`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold uppercase tracking-wider text-cozy-night-100/40 dark:text-cozy-cream-200/40 mt-4 pr-2">
              <span>Sparse</span>
              <div className="w-3.5 h-3.5 rounded bg-cozy-cream-200/50 dark:bg-cozy-night-100/40" />
              <div className="w-3.5 h-3.5 rounded bg-cozy-amber/20 dark:bg-cozy-amber-light/10" />
              <div className="w-3.5 h-3.5 rounded bg-cozy-amber/45 dark:bg-cozy-amber-light/25" />
              <div className="w-3.5 h-3.5 rounded bg-cozy-amber/70 dark:bg-cozy-amber-light/50" />
              <div className="w-3.5 h-3.5 rounded bg-cozy-amber dark:bg-cozy-amber-light" />
              <span>Heavy</span>
            </div>
          </div>
        </ChartCard>

        {/* Status Distribution Donut + Top Genres */}
        <div className="space-y-6">
          {/* Status Donut */}
          <ChartCard icon={BookMarked} title="Library Status" subtitle="Distribution by reading state" delay={0.5}>
            {statusData.length === 0 ? (
              <div className="text-center py-10 text-xs text-cozy-night-100/50 dark:text-cozy-cream-200/40">
                <BookOpen className="w-6 h-6 mx-auto opacity-30 mb-2" />
                <p>No books in library yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RPieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {statusData.map((_, i) => (
                          <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white/80 dark:bg-cozy-night-200/90 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-2xl px-3 py-2 shadow-xl text-xs">
                            <p className="font-bold text-cozy-night-300 dark:text-white">{d.name}: {d.value}</p>
                          </div>
                        );
                      }} />
                    </RPieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  {statusData.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[i] }} />
                        <span className="font-medium text-cozy-night-100/80 dark:text-cozy-cream-200/70">{s.name}</span>
                      </div>
                      <span className="font-semibold text-cozy-night-100/50 dark:text-cozy-cream-200/40">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>

          {/* Favorite Genres Quick Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="glass-panel rounded-3xl p-5 border border-white/10 shadow-lg space-y-3"
          >
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-cozy-amber fill-cozy-amber" />
              <span className="text-xs font-bold text-cozy-night-300 dark:text-white">Favorite Genres</span>
            </div>

            {topGenres.length === 0 ? (
              <p className="text-[11px] text-cozy-night-100/40 dark:text-cozy-cream-200/35">Add books to track genre preferences.</p>
            ) : (
              <div className="space-y-2.5">
                {topGenres.map((g, i) => {
                  const pct = metrics.totalBooks > 0 ? Math.round((g.value / metrics.totalBooks) * 100) : 0;
                  return (
                    <div key={g.name} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-cozy-night-100/70 dark:text-cozy-cream-200/60 flex items-center gap-1.5">
                          {i === 0 && '🥇'}
                          {i === 1 && '🥈'}
                          {i === 2 && '🥉'}
                          {g.name}
                        </span>
                        <span className="font-bold text-cozy-night-100/50 dark:text-cozy-cream-200/40">{pct}%</span>
                      </div>
                      <div className="h-2 bg-cozy-cream-300/40 dark:bg-cozy-night-100/30 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: 0.6 + i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: GENRE_COLORS[i] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* THIRD ROW: Session Analytics Bar */}
      <ChartCard icon={TrendingUp} title="Session Insights" subtitle="Average reading depth per session" delay={0.6}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Avg Session Duration', value: `${metrics.avgMinutesPerSession} min`, icon: Clock, color: 'text-cozy-amber' },
            { label: 'Avg Pages per Session', value: `${metrics.avgPagesPerSession} pages`, icon: FileText, color: 'text-cozy-lavender' },
            { label: 'Total Sessions Logged', value: logs.length, icon: BookOpen, color: 'text-emerald-500' },
          ].map((item, i) => {
            const ItemIcon = item.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.65 + i * 0.08 }}
                className="flex items-center gap-3 bg-white/10 dark:bg-white/5 border border-white/10 p-4 rounded-2xl"
              >
                <div className={`p-2 rounded-xl bg-white/10 dark:bg-white/5 ${item.color}`}>
                  <ItemIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-cozy-night-100/40 dark:text-cozy-cream-200/35">{item.label}</p>
                  <p className="font-sans font-bold text-lg text-cozy-night-300 dark:text-white leading-tight">{item.value}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}
