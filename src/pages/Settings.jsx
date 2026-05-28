import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProgressStore } from '../store/useProgressStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/useAuthStore';
import { dbService } from '../services/db';
import { 
  Settings as SettingsIcon, Sun, Moon, Target, Database, 
  Download, Upload, Trash2, CheckCircle, AlertCircle, RefreshCw, Lock
} from 'lucide-react';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { dailyGoalMinutes, setDailyGoal, logs } = useProgressStore();
  const { books, fetchBooks } = useLibraryStore();
  const { user, updatePassword, signOut } = useAuthStore();
  const location = useLocation();

  const [goal, setGoal] = useState(dailyGoalMinutes);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    setGoal(dailyGoalMinutes);
  }, [dailyGoalMinutes]);

  React.useEffect(() => {
    if (location.hash === '#goals') {
      const goalsElement = document.getElementById('goals');
      if (goalsElement) {
        const timer = setTimeout(() => {
          goalsElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [location]);

  // Password reset state fields
  const [newPassword, setNewPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const dbDetails = dbService.getConnectionDetails();

  const handleSaveGoal = () => {
    if (Number(goal) <= 0) {
      setErrorMsg('Daily target must be greater than zero.');
      return;
    }
    setDailyGoal(Number(goal));
    showSuccess('Daily reading target updated successfully.');
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    const hasNumberOrSpecial = /[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword);
    if (!hasNumberOrSpecial) {
      setErrorMsg('Password must contain at least 1 number or special character.');
      return;
    }

    setPwdLoading(true);
    try {
      await updatePassword(newPassword);
      showSuccess('Your account password key has been updated successfully.');
      setNewPassword('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update password key.');
    } finally {
      setPwdLoading(false);
    }
  };

  // ==========================================
  // DATA PORTABILITY: EXPORT & IMPORT
  // ==========================================
  const handleExportData = () => {
    try {
      const dataToExport = {
        books: books || [],
        logs: logs || [],
        export_date: new Date().toISOString(),
        version: '2.0'
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `cozy_reads_library_backup.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      showSuccess('Library records exported successfully.');
    } catch (err) {
      setErrorMsg('Failed to export library records.');
    }
  };

  const handleImportData = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.books || !parsed.logs) {
          setErrorMsg('Invalid backup file structure. Import aborted.');
          return;
        }

        showSuccess('Starting import of books and reading logs...');

        const idMap = {};
        
        // 1. Import all books sequentially
        for (const book of parsed.books) {
          try {
            const added = await useLibraryStore.getState().addBook({
              title: book.title,
              author: book.author || 'Unknown Author',
              cover_url: book.cover_url || '',
              cover_color: book.cover_color || 'from-indigo-600 to-indigo-950',
              pages: Number(book.pages) || 250,
              status: book.status || 'to_read',
              progress: Number(book.progress) || 0,
              rating: Number(book.rating) || 0,
              genre: book.genre || 'Other',
              review: book.review || '',
              favorite: book.favorite || false,
              last_read: book.last_read || null,
              tracking_mode: book.tracking_mode || 'pages',
              total_chapters: Number(book.total_chapters) || 20,
              current_chapter: Number(book.current_chapter) || 0
            });
            if (added && added.id) {
              idMap[book.id] = added.id;
            }
          } catch (bookErr) {
            console.error('Failed to import book:', book.title, bookErr);
          }
        }

        // 2. Import all logs sequentially, mapping book_id properly
        for (const log of parsed.logs) {
          try {
            const targetBookId = idMap[log.book_id] || log.book_id;
            await useProgressStore.getState().addLog({
              book_id: targetBookId,
              duration_minutes: Number(log.duration_minutes) || 15,
              pages_read: Number(log.pages_read) || 5,
              notes: log.notes || '',
              created_at: log.created_at || new Date().toISOString()
            });
          } catch (logErr) {
            console.error('Failed to import reading log:', log, logErr);
          }
        }

        // 3. Re-load stores
        await fetchBooks();
        await useProgressStore.getState().fetchLogs();
        
        showSuccess('Library records and histories imported successfully.');
      } catch (err) {
        setErrorMsg('Failed to read file. Please ensure it is a valid JSON backup.');
      }
    };
    fileReader.readAsText(file);
  };

  const handleResetApp = async () => {
    if (window.confirm('WARNING: This will wipe out all custom books, reviews, star ratings, and reading histories. This action is irreversible. Proceed?')) {
      try {
        showSuccess('Wiping library database and logging out...');

        // 1. Sequentially delete all user library books via store delete calls
        const booksToDelete = [...books];
        for (const book of booksToDelete) {
          try {
            await useLibraryStore.getState().deleteBook(book.id);
          } catch (delErr) {
            console.error('Failed to delete book:', book.id, delErr);
          }
        }

        // 2. Clear local storage caches
        localStorage.removeItem('cozy_reads_books');
        localStorage.removeItem('cozy_reads_logs');
        localStorage.removeItem('cozy_reads_daily_goal');
        localStorage.removeItem('cozy_reads_notes_draft');

        // 3. Execute auth logout
        if (signOut) {
          await signOut();
        }

        showSuccess('Library database wiped and session logged out.');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        setErrorMsg('Failed to reset library database: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-20 max-w-4xl">
      {/* Page Title */}
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-2">Shelf Settings</h1>
        <p className="text-sm text-cozy-night-100/60 dark:text-cozy-cream-200/50">
          Tailor your daily goals, manage database parameters, and export your archives.
        </p>
      </div>

      {/* Alert toast updates */}
      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 text-xs flex items-center gap-2.5 shadow-sm"
        >
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2.5 shadow-sm"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </motion.div>
      )}

      {/* SETTINGS CARD COLUMN */}
      <div className="space-y-6">
        
        {/* Module 1: Goal tracker edit */}
        <div id="goals" className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 text-cozy-amber">
            <Target className="w-5 h-5" />
            <h3 className="font-serif text-lg font-bold text-cozy-night-300 dark:text-white">Daily reading target</h3>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
            <p className="text-xs text-cozy-night-100/65 dark:text-cozy-cream-200/50 max-w-md leading-relaxed">
              Configure your daily reading session target. This progress maps dynamically inside your home radial metric chart.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-24 px-3 py-2.5 glass-input rounded-xl text-center text-sm font-bold"
              />
              <button
                onClick={handleSaveGoal}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cozy-amber to-cozy-amber-dark text-white font-semibold text-xs hover:brightness-110 transition-all active:scale-95"
              >
                Apply Target
              </button>
            </div>
          </div>
        </div>

        {/* Module 2: Dark mode toggle */}
        <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 text-cozy-lavender">
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            <h3 className="font-serif text-lg font-bold text-cozy-night-300 dark:text-white">Aesthetic selection</h3>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
            <p className="text-xs text-cozy-night-100/65 dark:text-cozy-cream-200/50 max-w-md leading-relaxed">
              Select between a cozy Light wood book atmosphere and a premium velvet obsidian Dark mode.
            </p>
            <button
              onClick={toggleTheme}
              className="py-2.5 px-4 rounded-xl bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 active:scale-95 transition-all text-xs font-bold"
            >
              Toggle to {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </div>

        {/* Module 3: Database diagnostics */}
        <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 text-cozy-amber">
            <Database className="w-5 h-5" />
            <h3 className="font-serif text-lg font-bold text-cozy-night-300 dark:text-white">Database connection diagnostic</h3>
          </div>

          <div className="space-y-4 pt-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-xs text-cozy-night-100/65 dark:text-cozy-cream-200/50 max-w-md leading-relaxed">
                Booklyn operates in high-fidelity offline mode automatically if environment keys are missing. Connect to your Supabase instance by defining `.env` secrets.
              </p>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
                <span className={`w-2.5 h-2.5 rounded-full ${dbDetails.mode === 'supabase' ? 'bg-green-500' : 'bg-cozy-amber animate-pulse'}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{dbDetails.mode}</span>
              </div>
            </div>

            <div className="text-xs font-semibold p-4 rounded-2xl bg-white/10 dark:bg-black/10 border border-white/10 font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-cozy-night-100/40 dark:text-cozy-cream-200/40">Status:</span>
                <span>{dbDetails.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cozy-night-100/40 dark:text-cozy-cream-200/40">Provider:</span>
                <span>{dbDetails.url}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Change account password (only for authenticated, non-guest users) */}
        {user && !user.email?.includes('guest') && (
          <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-cozy-lavender">
              <Lock className="w-5 h-5 text-cozy-lavender" />
              <h3 className="font-serif text-lg font-bold text-cozy-night-300 dark:text-white">Change account password</h3>
            </div>
            
            <form onSubmit={handleChangePassword} className="space-y-4 pt-1">
              <p className="text-xs text-cozy-night-100/65 dark:text-cozy-cream-200/50 leading-relaxed">
                Establish a new password key for your library account. Make sure it is at least 6 characters and contains a number or special symbol.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cozy-night-100/40 dark:text-cozy-cream-200/30" />
                  <input
                    type="password"
                    required
                    placeholder="New password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full !pl-10 !pr-4 !py-2.5 glass-input text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-cozy-amber to-cozy-amber-dark text-white font-bold text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  {pwdLoading ? 'Updating Key...' : 'Update Password Key'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Module 4: Backup export import Reset */}
        <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 text-red-500">
            <Trash2 className="w-5 h-5" />
            <h3 className="font-serif text-lg font-bold text-cozy-night-300 dark:text-white">Data portability & maintenance</h3>
          </div>

          <div className="space-y-4 pt-1">
            <p className="text-xs text-cozy-night-100/65 dark:text-cozy-cream-200/50 leading-relaxed">
              Maintain full ownership of your records. Download backup schedules, import old backups, or trigger hard resets.
            </p>

            <div className="flex flex-wrap gap-3">
              {/* Export backup button */}
              <button
                onClick={handleExportData}
                className="py-2.5 px-4 rounded-xl bg-white/20 dark:bg-white/5 border border-white/25 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 text-xs font-semibold flex items-center gap-2 shadow-sm active:scale-95 transition-transform"
              >
                <Download className="w-4 h-4 text-cozy-amber" />
                <span>Export library backup</span>
              </button>

              {/* Import backup button picker */}
              <label className="py-2.5 px-4 rounded-xl bg-white/20 dark:bg-white/5 border border-white/25 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 text-xs font-semibold flex items-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer">
                <Upload className="w-4 h-4 text-cozy-lavender" />
                <span>Import library backup</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </label>

              {/* Reset database button */}
              <button
                onClick={handleResetApp}
                className="py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/25 text-xs font-semibold flex items-center gap-2 active:scale-95 transition-transform ml-auto"
              >
                <Trash2 className="w-4 h-4" />
                <span>Wipe database reset</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
