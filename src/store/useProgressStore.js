import { create } from 'zustand';
import { dbService } from '../services/db';
import { useLibraryStore } from './useLibraryStore';
import { syncManager } from '../services/syncManager';

export const useProgressStore = create((set, get) => ({
  logs: [],
  loading: false,
  error: null,

  // Timer states
  timerActive: false,
  timerStartTime: null,
  timerSeconds: 0,
  timerBookId: null,

  // User goals
  dailyGoalMinutes: Number(localStorage.getItem('cozy_reads_daily_goal')) || 30,

  fetchLogs: async (bookId = null) => {
    set({ loading: true, error: null });
    try {
      const logs = await dbService.logs.getLogs(bookId);
      
      let goalMinutes = 30;
      try {
        const goals = await dbService.goals.getGoals();
        if (goals && goals.daily_goal !== undefined) {
          goalMinutes = Number(goals.daily_goal);
          localStorage.setItem('cozy_reads_daily_goal', goalMinutes);
        }
      } catch (goalErr) {
        console.warn('Could not sync goals from database, using cached:', goalErr.message);
        goalMinutes = Number(localStorage.getItem('cozy_reads_daily_goal')) || 30;
      }

      set({ logs, dailyGoalMinutes: goalMinutes, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addLog: async (logData) => {
    set({ loading: true, error: null });
    try {
      if (syncManager.isOnline()) {
        const newLog = await dbService.logs.addLog(logData);
        
        // Update local logs list
        set(state => ({
          logs: [
            {
              ...newLog,
              // Include a mock 'books' object so detailed lists load immediately
              books: useLibraryStore.getState().books.find(b => b.id === logData.book_id) || { title: 'Unknown', author: '' }
            },
            ...state.logs
          ],
          loading: false
        }));

        // Re-fetch books in library store to sync progress!
        await useLibraryStore.getState().fetchBooks();
        return newLog;
      } else {
        // Offline: construct temp log and optimistically modify Zustand
        const tempLogId = 'log-' + Math.random().toString(36).substr(2, 9);
        const newLog = {
          id: tempLogId,
          book_id: logData.book_id,
          duration_minutes: Number(logData.duration_minutes),
          pages_read: Number(logData.pages_read),
          notes: logData.notes || '',
          created_at: new Date().toISOString(),
          books: useLibraryStore.getState().books.find(b => b.id === logData.book_id) || { title: 'Unknown', author: '' }
        };

        set(state => ({
          logs: [newLog, ...state.logs],
          loading: false
        }));

        // Optimistically update the target book progress
        const libraryState = useLibraryStore.getState();
        const targetBook = libraryState.books.find(b => b.id === logData.book_id);
        if (targetBook) {
          const nextProgress = Math.min(targetBook.pages, targetBook.progress + newLog.pages_read);
          const totalChapters = targetBook.total_chapters || 20;
          const currentChapter = Math.min(totalChapters, Math.round((nextProgress / targetBook.pages) * totalChapters));

          await libraryState.updateBook(logData.book_id, {
            progress: nextProgress,
            current_chapter: currentChapter,
            last_read: newLog.created_at,
            status: nextProgress >= targetBook.pages ? 'completed' : 'reading'
          });
        }

        // Queue addition mutation
        syncManager.queueMutation('logs', 'add', logData);
        return newLog;
      }
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteLog: async (logId) => {
    set({ error: null });
    try {
      const targetLog = get().logs.find(l => l.id === logId);

      // Optimistically remove from logs state
      set(state => ({
        logs: state.logs.filter(l => l.id !== logId)
      }));

      if (targetLog) {
        // Revert progress of book optimistically
        const libraryState = useLibraryStore.getState();
        const targetBook = libraryState.books.find(b => b.id === targetLog.book_id);
        if (targetBook) {
          const nextProgress = Math.max(0, targetBook.progress - targetLog.pages_read);
          const totalChapters = targetBook.total_chapters || 20;
          const currentChapter = Math.min(totalChapters, Math.round((nextProgress / targetBook.pages) * totalChapters));

          await libraryState.updateBook(targetLog.book_id, {
            progress: nextProgress,
            current_chapter: currentChapter,
            status: nextProgress === 0 ? 'to_read' : 'reading'
          });
        }
      }

      if (syncManager.isOnline()) {
        await dbService.logs.deleteLog(logId);
      } else {
        syncManager.queueMutation('logs', 'delete', { id: logId });
      }
      return true;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // ==========================
  // TIMER ACTIONS
  // ==========================
  startTimer: (bookId) => {
    set({
      timerActive: true,
      timerBookId: bookId,
      timerStartTime: Date.now() - (get().timerSeconds * 1000)
    });
  },

  pauseTimer: () => {
    if (!get().timerActive) return;
    const elapsed = Math.floor((Date.now() - get().timerStartTime) / 1000);
    set({
      timerActive: false,
      timerSeconds: elapsed
    });
  },

  resetTimer: () => {
    set({
      timerActive: false,
      timerBookId: null,
      timerStartTime: null,
      timerSeconds: 0
    });
  },

  updateTimerSeconds: () => {
    if (!get().timerActive) return;
    const elapsed = Math.floor((Date.now() - get().timerStartTime) / 1000);
    set({ timerSeconds: elapsed });
  },

  setDailyGoal: async (minutes) => {
    const val = Number(minutes);
    localStorage.setItem('cozy_reads_daily_goal', val);
    set({ dailyGoalMinutes: val });
    try {
      if (syncManager.isOnline()) {
        await dbService.goals.updateGoals({ daily_goal: val });
      } else {
        syncManager.queueMutation('goals', 'update', { daily_goal: val });
      }
    } catch (error) {
      console.error('Failed to sync daily goal to PostgreSQL:', error);
    }
  },

  // ==========================
  // METRICS COMPUTATIONS
  // ==========================
  getStreak: () => {
    const logs = get().logs;
    if (logs.length === 0) return 0;

    // Extract unique read dates (YYYY-MM-DD)
    const readDates = Array.from(
      new Set(logs.map(log => log.created_at.split('T')[0]))
    ).sort((a, b) => new Date(b) - new Date(a)); // Descending order (today first)

    if (readDates.length === 0) return 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // If the last read wasn't today or yesterday, streak is broken
    if (readDates[0] !== todayStr && readDates[0] !== yesterdayStr) {
      return 0;
    }

    let streak = 0;
    let expectedDate = new Date(readDates[0]);

    for (let i = 0; i < readDates.length; i++) {
      const currentDateStr = expectedDate.toISOString().split('T')[0];
      
      if (readDates[i] === currentDateStr) {
        streak++;
        // Move expected date back by 1 day
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        break; // Streak broken
      }
    }

    return streak;
  },

  getTodayReadingMinutes: () => {
    const logs = get().logs;
    const todayStr = new Date().toISOString().split('T')[0];
    
    return logs
      .filter(log => log.created_at.split('T')[0] === todayStr)
      .reduce((total, log) => total + log.duration_minutes, 0);
  }
}));
