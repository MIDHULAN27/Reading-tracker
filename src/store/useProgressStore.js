import { create } from 'zustand';
import { dbService } from '../services/db';
import { useLibraryStore } from './useLibraryStore';
import { syncManager } from '../services/syncManager';
import { getTableMissingMessage } from '../services/tableValidator';

const DB_TIMEOUT_MS = 10000; // 10 seconds

const withTimeout = (promise, ms = DB_TIMEOUT_MS, label = 'Database operation') => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s. Please check your connection and try again.`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

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
  dailyGoalMinutes: Number(localStorage.getItem('booklyn_reads_daily_goal')) || 30,

  fetchLogs: async (bookId = null) => {
    set({ loading: true, error: null });
    try {
      console.info('[Booklyn Progress Store] Fetching reading sessions logs...');
      const logs = await withTimeout(
        dbService.logs.getLogs(bookId),
        DB_TIMEOUT_MS,
        'Fetch reading sessions'
      );
      
      let goalMinutes = 30;
      try {
        const goals = await withTimeout(
          dbService.goals.getGoals(),
          DB_TIMEOUT_MS,
          'Fetch reading goals'
        );
        if (goals && goals.daily_goal !== undefined) {
          goalMinutes = Number(goals.daily_goal);
          localStorage.setItem('booklyn_reads_daily_goal', goalMinutes);
        }
      } catch (goalErr) {
        console.warn('[Booklyn Progress Store] Could not sync goals from database, using cached:', goalErr.message);
        goalMinutes = Number(localStorage.getItem('booklyn_reads_daily_goal')) || 30;
      }

      set({ logs, dailyGoalMinutes: goalMinutes, error: null });
      console.info('[Booklyn Progress Store] Successfully fetched reading logs:', logs.length);
    } catch (error) {
      console.error('[Booklyn Progress Store] Failed to fetch reading logs:', error.message);
      const missingTableMsg = getTableMissingMessage(error.message);
      if (missingTableMsg) {
        // Safe fallback without setting a blocking error
        set({ logs: [], error: null });
      } else {
        set({ error: error.message });
      }
    } finally {
      set({ loading: false });
    }
  },

  addLog: async (logData) => {
    set({ loading: true, error: null });
    try {
      if (syncManager.isOnline()) {
        const newLog = await withTimeout(
          dbService.logs.addLog(logData),
          DB_TIMEOUT_MS,
          'Add reading log'
        );
        
        // Update local logs list
        set(state => ({
          logs: [
            {
              ...newLog,
              // Include a mock 'books' object so detailed lists load immediately
              books: useLibraryStore.getState().books.find(b => b.id === logData.book_id) || { title: 'Unknown', author: '' }
            },
            ...state.logs
          ]
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
          logs: [newLog, ...state.logs]
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
      console.error('[Booklyn Progress Store] addLog error:', error.message);
      const friendlyMsg = getTableMissingMessage(error.message) || error.message;
      set({ error: friendlyMsg });
      throw new Error(friendlyMsg);
    } finally {
      set({ loading: false });
    }
  },

  deleteLog: async (logId) => {
    set({ loading: true, error: null });
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
        await withTimeout(
          dbService.logs.deleteLog(logId),
          DB_TIMEOUT_MS,
          'Delete reading session'
        );
      } else {
        syncManager.queueMutation('logs', 'delete', { id: logId });
      }
      return true;
    } catch (error) {
      console.error('[Booklyn Progress Store] deleteLog error:', error.message);
      const friendlyMsg = getTableMissingMessage(error.message) || error.message;
      set({ error: friendlyMsg });
      throw new Error(friendlyMsg);
    } finally {
      set({ loading: false });
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
    localStorage.setItem('booklyn_reads_daily_goal', val);
    set({ dailyGoalMinutes: val, loading: true });
    try {
      if (syncManager.isOnline()) {
        await withTimeout(
          dbService.goals.updateGoals({ daily_goal: val }),
          DB_TIMEOUT_MS,
          'Update daily goal'
        );
      } else {
        syncManager.queueMutation('goals', 'update', { daily_goal: val });
      }
    } catch (error) {
      console.error('[Booklyn Progress Store] Failed to sync daily goal to PostgreSQL:', error.message);
    } finally {
      set({ loading: false });
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
