import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Book, Clock, Edit2, AlertCircle, FileText, CheckCircle, ChevronDown, Percent, Bookmark } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useProgressStore } from '../store/useProgressStore';
import { triggerConfetti } from '../utils/confetti';

export default function LogSessionModal({ isOpen, onClose, initialBookId = null, prefilledMinutes = 0 }) {
  const { books, updateBook } = useLibraryStore();
  const { addLog } = useProgressStore();

  const activeBooks = books.filter(b => b.status === 'reading');

  const [bookId, setBookId] = useState(initialBookId || '');
  const [trackMode, setTrackMode] = useState('pages'); // 'pages' | 'percentage' | 'chapters'
  const [progressInput, setProgressInput] = useState('');
  const [minutes, setMinutes] = useState(prefilledMinutes > 0 ? prefilledMinutes : '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedBookFlag, setCompletedBookFlag] = useState(false);

  const selectedBook = books.find(b => b.id === bookId);

  // Sync state if initial book id or minutes change
  useEffect(() => {
    if (isOpen) {
      const activeId = initialBookId || (activeBooks.length > 0 ? activeBooks[0].id : '');
      setBookId(activeId);
      setMinutes(prefilledMinutes > 0 ? prefilledMinutes : '');
      setProgressInput('');
      
      // Restore notes draft from local storage if available
      const draft = localStorage.getItem('cozy_reads_notes_draft');
      setNotes(draft || '');
      
      setError('');
      setCompletedBookFlag(false);
    }
  }, [isOpen, initialBookId, prefilledMinutes]);

  // Update trackMode to book's default when selectedBook changes
  useEffect(() => {
    if (selectedBook) {
      setTrackMode(selectedBook.tracking_mode || 'pages');
    }
  }, [selectedBook]);

  // Draft auto-saving
  const handleNotesChange = (e) => {
    const value = e.target.value;
    setNotes(value);
    localStorage.setItem('cozy_reads_notes_draft', value);
  };

  const currentPct = selectedBook ? Math.round((selectedBook.progress / selectedBook.pages) * 100) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!bookId) {
      setError('Please select a book to log progress.');
      return;
    }
    if (!progressInput || Number(progressInput) < 0) {
      setError('Please enter a valid reading target.');
      return;
    }
    if (!minutes || Number(minutes) <= 0) {
      setError('Please enter reading time in minutes.');
      return;
    }

    let calculatedPagesRead = 0;
    let absoluteNewPage = 0;
    const inputVal = Number(progressInput);

    if (selectedBook) {
      if (trackMode === 'pages') {
        if (inputVal <= selectedBook.progress) {
          setError(`New page must be greater than current page (${selectedBook.progress}).`);
          return;
        }
        if (inputVal > selectedBook.pages) {
          setError(`Book only has ${selectedBook.pages} pages. Enter at most ${selectedBook.pages}.`);
          return;
        }
        calculatedPagesRead = inputVal - selectedBook.progress;
        absoluteNewPage = inputVal;
      } 
      
      else if (trackMode === 'percentage') {
        if (inputVal <= currentPct) {
          setError(`New percentage must be greater than current percentage (${currentPct}%).`);
          return;
        }
        if (inputVal > 100) {
          setError('Percentage cannot exceed 100%.');
          return;
        }
        absoluteNewPage = Math.min(selectedBook.pages, Math.round((inputVal / 100) * selectedBook.pages));
        calculatedPagesRead = absoluteNewPage - selectedBook.progress;
        if (calculatedPagesRead <= 0) {
          setError('This percentage does not advance page counts. Enter a larger percentage.');
          return;
        }
      } 
      
      else if (trackMode === 'chapters') {
        const totalCh = selectedBook.total_chapters || 20;
        const currentCh = selectedBook.current_chapter || 0;
        if (inputVal <= currentCh) {
          setError(`New chapter must be greater than current chapter (${currentCh}).`);
          return;
        }
        if (inputVal > totalCh) {
          setError(`Book only has ${totalCh} chapters. Enter at most ${totalCh}.`);
          return;
        }
        absoluteNewPage = Math.min(selectedBook.pages, Math.round((inputVal / totalCh) * selectedBook.pages));
        calculatedPagesRead = absoluteNewPage - selectedBook.progress;
        if (calculatedPagesRead <= 0) {
          setError('This chapter does not advance page counts. Enter a larger chapter.');
          return;
        }
      }
    }

    setLoading(true);
    try {
      // Add reading session log
      await addLog({
        book_id: bookId,
        duration_minutes: Number(minutes),
        pages_read: calculatedPagesRead,
        notes: notes
      });

      // Update book tracking fields (such as updated chapter configuration or tracking mode)
      const updates = {
        tracking_mode: trackMode
      };
      if (trackMode === 'chapters') {
        updates.current_chapter = inputVal;
      }
      await updateBook(bookId, updates);

      // Clean notes draft draft
      localStorage.removeItem('cozy_reads_notes_draft');

      // Check if this action completed the book!
      if (selectedBook && absoluteNewPage >= selectedBook.pages) {
        setCompletedBookFlag(true);
        triggerConfetti(); // Gorgeous hardware-accelerated confetti explosion!
        
        setTimeout(() => {
          setLoading(false);
          onClose();
        }, 2200); // Hold open to show beautiful celebration overlay
      } else {
        setLoading(false);
        onClose();
      }
    } catch (err) {
      setError('Failed to log reading session. Please try again.');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-[6px] z-[200] pointer-events-auto"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 m-auto w-full max-w-md h-fit glass-overlay border border-white/15 dark:border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] p-6 z-[200] overflow-hidden pointer-events-auto"
          >
            {/* Completion Celebration Overlay */}
            {completedBookFlag && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-gradient-to-tr from-cozy-amber to-cozy-lavender text-white z-50 flex flex-col items-center justify-center text-center p-6 space-y-4"
              >
                <motion.div
                  initial={{ scale: 0.5, rotate: -20 }}
                  animate={{ scale: 1.1, rotate: 0 }}
                  transition={{ type: 'spring', duration: 0.8 }}
                  className="p-4 rounded-full bg-white/25 border-2 border-white"
                >
                  <CheckCircle className="w-12 h-12" />
                </motion.div>
                <div className="space-y-1">
                  <h3 className="font-serif text-2xl font-bold tracking-tight">Congratulations!</h3>
                  <p className="text-sm font-serif italic">"{selectedBook?.title}" is completed!</p>
                </div>
                <p className="text-xs opacity-80 max-w-[240px]">
                  Amazing reading! The book has been moved to your Completed Shelf. Keep up the habit!
                </p>
              </motion.div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-cozy-cream-300/40 dark:border-cozy-night-100/10 mb-4">
              <div className="flex items-center gap-2 text-cozy-amber dark:text-cozy-amber-light">
                <Bookmark className="w-5 h-5" />
                <h3 className="font-serif text-xl font-bold">Log Reading Session</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/30 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Select active books validator */}
            {activeBooks.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <AlertCircle className="w-10 h-10 text-cozy-amber mx-auto opacity-50" />
                <p className="text-xs text-cozy-night-100/60 dark:text-cozy-cream-200/50 max-w-xs mx-auto leading-relaxed">
                  You don't have any books marked as "Currently Reading". Add or move a book to your reading shelf before logging progress!
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-cozy-amber text-white text-xs font-semibold rounded-xl"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Book select dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-cozy-night-100/50 dark:text-cozy-cream-200/40 pl-1">
                    Select Reading Book
                  </label>
                  <div className="relative">
                    <Book className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cozy-night-100/40 dark:text-cozy-cream-200/40" />
                    <select
                      value={bookId}
                      onChange={(e) => setBookId(e.target.value)}
                      className="w-full !pl-9 !pr-8 !py-2.5 glass-input appearance-none cursor-pointer text-xs font-semibold"
                    >
                      {activeBooks.map((b) => (
                        <option key={b.id} value={b.id} className="bg-cozy-cream-50 dark:bg-cozy-night-200 text-cozy-night-300 dark:text-white">
                          {b.title} ({b.progress}/{b.pages} p.)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none text-cozy-night-100/40 dark:text-cozy-cream-200/40" />
                  </div>
                </div>

                {/* Progress Type Segment Controller */}
                {selectedBook && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-cozy-night-100/50 dark:text-cozy-cream-200/40 pl-1">
                      Tracking Unit
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-black/10 dark:bg-white/5 p-1 rounded-xl">
                      {[
                        { id: 'pages', label: 'Pages', icon: FileText },
                        { id: 'percentage', label: 'Percent', icon: Percent },
                        { id: 'chapters', label: 'Chapters', icon: Bookmark },
                      ].map(tab => {
                        const Icon = tab.icon;
                        const active = trackMode === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setTrackMode(tab.id);
                              setProgressInput('');
                            }}
                            className={`py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase flex items-center justify-center gap-1 transition-all ${
                              active
                                ? 'bg-gradient-to-r from-cozy-amber to-cozy-amber-dark text-white shadow-sm'
                                : 'text-cozy-night-100/50 dark:text-cozy-cream-200/40 hover:text-cozy-night-300 dark:hover:text-white'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grid pages/percentage/chapters / minutes */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Dynamic Progress Input */}
                  {selectedBook && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-cozy-night-100/50 dark:text-cozy-cream-200/40 pl-1">
                        {trackMode === 'pages' 
                          ? `New Page (Current: ${selectedBook.progress})` 
                          : trackMode === 'percentage'
                            ? `New % (Current: ${currentPct}%)`
                            : `New Ch. (Current: ${selectedBook.current_chapter || 0}/${selectedBook.total_chapters || 20})`}
                      </label>
                      <div className="relative">
                        {trackMode === 'pages' ? (
                          <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cozy-night-100/40 dark:text-cozy-cream-200/40" />
                        ) : trackMode === 'percentage' ? (
                          <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cozy-night-100/40 dark:text-cozy-cream-200/40" />
                        ) : (
                          <Bookmark className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cozy-night-100/40 dark:text-cozy-cream-200/40" />
                        )}
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder={
                            trackMode === 'pages'
                              ? `Max ${selectedBook.pages}`
                              : trackMode === 'percentage'
                                ? 'e.g. 75'
                                : `Max ${selectedBook.total_chapters || 20}`
                          }
                          value={progressInput}
                          onChange={(e) => setProgressInput(e.target.value)}
                          className="w-full !pl-9 !pr-4 !py-2.5 glass-input text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Duration input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-cozy-night-100/50 dark:text-cozy-cream-200/40 pl-1">
                      Time Spent (Min)
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cozy-night-100/40 dark:text-cozy-cream-200/40" />
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="e.g. 25"
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                        className="w-full !pl-9 !pr-4 !py-2.5 glass-input text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Session Notes input */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center pl-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-cozy-night-100/50 dark:text-cozy-cream-200/40">
                      Reading Notes & Musings
                    </label>
                    {notes && (
                      <span className="text-[9px] font-semibold text-emerald-500 animate-pulse">
                        ● Auto-saved draft
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Edit2 className="absolute left-3 top-3 w-4 h-4 text-cozy-night-100/40 dark:text-cozy-cream-200/40" />
                    <textarea
                      rows="3"
                      placeholder="Share some quick thoughts on this session..."
                      value={notes}
                      onChange={handleNotesChange}
                      className="w-full !pl-9 !pr-3 !py-2.5 glass-input text-xs resize-none"
                    />
                  </div>
                </div>

                {/* Error messages */}
                {error && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Buttons row */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cozy-amber to-cozy-amber-dark text-white font-semibold text-xs hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Save Progress'
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
