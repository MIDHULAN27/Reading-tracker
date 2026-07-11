import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLibraryStore } from '../store/useLibraryStore';
import { useProgressStore } from '../store/useProgressStore';
import { 
  Grid, List, Search, Heart, Star, BookOpen, Clock, 
  Trash2, Bookmark, ArrowUpDown, ChevronDown, Check, Play,
  KanbanSquare, AlertTriangle, X, RefreshCw, Book,
  ChevronRight, ChevronLeft, MoreVertical
} from 'lucide-react';
import BookDetailSlideOver from '../components/BookDetailSlideOver';
import ImportPdfModal from '../components/ImportPdfModal';

const SHELVES = [
  { key: 'to_read', label: 'Want to Read', color: 'bg-indigo-500/85', dot: 'bg-indigo-500' },
  { key: 'reading', label: 'Currently Reading', color: 'bg-amber-500/85', dot: 'bg-amber-500' },
  { key: 'completed', label: 'Completed', color: 'bg-emerald-500/85', dot: 'bg-emerald-500' },
  { key: 'dropped', label: 'Dropped', color: 'bg-rose-500/85', dot: 'bg-rose-500' }
];

export default function Library() {
  const location = useLocation();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    return (tab && ['reading', 'to_read', 'dropped', 'completed'].includes(tab)) ? tab : 'reading';
  });

  // Mode layouts: 'board' (Kanban columns), 'grid' (standard tab grid), 'list' (tabular table)
  const [viewMode, setViewMode] = useState('board');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'rating', 'progress', 'title'
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Drag and drop states
  const [draggedBookId, setDraggedBookId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);

  // Custom Modal dialogs
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bookToDelete, setBookToDelete] = useState(null);
  const [toastError, setToastError] = useState('');

  // Selected book for details slide-over
  const [selectedBook, setSelectedBook] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // Zustand Store Hooks
  const { books, loading, error, fetchBooks, updateBook, deleteBook } = useLibraryStore();
  const { startTimer } = useProgressStore();

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Sync tab search queries
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && ['reading', 'to_read', 'dropped', 'completed'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Clear toast error message automatically
  useEffect(() => {
    if (toastError) {
      const timer = setTimeout(() => setToastError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastError]);

  const handleToggleFavorite = async (book, e) => {
    e.stopPropagation();
    try {
      await updateBook(book.id, { favorite: !book.favorite });
    } catch (err) {
      setToastError('Failed to update favorite status. Rolled back.');
    }
  };

  const openDeleteConfirmation = (book, e) => {
    e.stopPropagation();
    setBookToDelete(book);
    setShowDeleteModal(true);
  };

  const confirmDeleteBook = async () => {
    if (!bookToDelete) return;
    const bookId = bookToDelete.id;
    setShowDeleteModal(false);
    setBookToDelete(null);
    
    try {
      await deleteBook(bookId);
    } catch (err) {
      setToastError('Failed to remove book. State restored.');
    }
  };

  const handleStartReadingSession = (book, e) => {
    e.stopPropagation();
    startTimer(book.id);
  };

  const handleBookClick = (book) => {
    setSelectedBook(book);
    setIsSlideOverOpen(true);
  };

  // ----------------------------------------------------
  // HTML5 DRAG AND DROP HANDLERS (DESKTOP)
  // ----------------------------------------------------
  const handleDragStart = (e, bookId) => {
    e.dataTransfer.setData('text/plain', bookId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedBookId(bookId);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    const bookId = e.dataTransfer.getData('text/plain') || draggedBookId;
    if (!bookId) return;

    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook || targetBook.status === targetStatus) return;

    try {
      await updateBook(bookId, { 
        status: targetStatus,
        progress: targetStatus === 'completed' ? targetBook.pages : targetBook.progress
      });
    } catch (err) {
      setToastError('Failed to move book. Connection rolled back state.');
    } finally {
      setDraggedBookId(null);
    }
  };

  // Direct move handler for cards / accessibility triggers
  const handleMoveBook = async (bookId, targetStatus) => {
    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook || targetBook.status === targetStatus) return;

    try {
      await updateBook(bookId, { 
        status: targetStatus,
        progress: targetStatus === 'completed' ? targetBook.pages : targetBook.progress
      });
    } catch (err) {
      setToastError('Failed to move book. Connection rolled back state.');
    }
  };

  // ----------------------------------------------------
  // FILTERING AND SORTING SCHEMAS
  // ----------------------------------------------------
  const processBooksList = (shelfKey = null) => {
    let list = [...books];

    // Status / Shelf filter
    if (shelfKey) {
      list = list.filter(b => b.status === shelfKey);
    }

    // Favorite Filter
    if (showFavoritesOnly) {
      list = list.filter(b => b.favorite);
    }

    // Search query match
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => 
        (b.title || '').toLowerCase().includes(q) || 
        (b.author || '').toLowerCase().includes(q)
      );
    }

    // Genre Pill Filter
    if (selectedGenre !== 'All') {
      list = list.filter(b => b.genre === selectedGenre);
    }

    // Sorting operations
    return list.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.added_at) - new Date(a.added_at);
      }
      if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === 'progress') {
        const pctA = a.pages > 0 ? (a.progress / a.pages) : 0;
        const pctB = b.pages > 0 ? (b.progress / b.pages) : 0;
        return pctB - pctA;
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });
  };

  // Extract unique genres in current user's library for filters
  const genresList = ['All', ...Array.from(new Set(books.map(b => b.genre || 'Other'))).filter(Boolean)];

  // Shelf-view derived lists
  const currentlyReading = [...books].filter(b => b.status === 'reading')
    .sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
  const recentlyAdded = [...books].sort((a, b) => new Date(b.added_at) - new Date(a.added_at)).slice(0, 10);
  const allShelfBooks = [...books].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
    return new Date(b.added_at) - new Date(a.added_at);
  });
  const shelfScrollRef = useRef(null);
  const scrollShelf = (dir) => {
    if (shelfScrollRef.current) shelfScrollRef.current.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-20 relative px-1">
      {/* Toast errors */}
      <AnimatePresence>
        {toastError && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] px-4.5 py-3 glass-panel border border-red-500/30 bg-red-500/10 text-red-500 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold tracking-wide"
          >
            <AlertTriangle className="w-4.5 h-4.5 text-red-500 animate-bounce-subtle" />
            <span>{toastError}</span>
            <button onClick={() => setToastError('')} className="p-1 rounded-lg hover:bg-white/10 ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ SHELF HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">My Library Shelf</h1>
          <p className="text-sm text-booklyn-night-100/55 dark:text-booklyn-cream-200/45 mt-1">Books you've added to your library</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="pl-3 pr-8 py-2 glass-input rounded-xl text-xs font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-booklyn-amber/50">
              <option value="recent" className="bg-white dark:bg-booklyn-night-200">Recently Added</option>
              <option value="rating" className="bg-white dark:bg-booklyn-night-200">Highest Rated</option>
              <option value="title" className="bg-white dark:bg-booklyn-night-200">Title A–Z</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-booklyn-night-100/40 dark:text-booklyn-cream-200/40" />
          </div>
          <div className="flex border border-white/20 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => setViewMode('grid')} title="Grid"
              className={`p-2 transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-gradient-to-tr from-booklyn-amber/20 to-booklyn-lavender/20 text-booklyn-amber' : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:bg-white/10'}`}>
              <Grid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} title="List"
              className={`p-2 transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-gradient-to-tr from-booklyn-amber/20 to-booklyn-lavender/20 text-booklyn-amber' : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:bg-white/10'}`}>
              <List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('board')} title="Board"
              className={`p-2 transition-colors cursor-pointer ${viewMode === 'board' ? 'bg-gradient-to-tr from-booklyn-amber/20 to-booklyn-lavender/20 text-booklyn-amber' : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:bg-white/10'}`}>
              <KanbanSquare className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark hover:brightness-110 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5">
            <Book className="w-3.5 h-3.5" /><span className="hidden sm:inline">Import PDF</span>
          </button>
        </div>
      </div>

      {/* ═══ HORIZONTAL BOOK CAROUSEL ═══ */}
      {books.length > 0 && (
        <div className="relative group/shelf">
          <button onClick={() => scrollShelf(-1)}
            className="absolute left-0 top-[90px] z-20 -translate-x-3 w-8 h-8 rounded-full bg-white/90 dark:bg-booklyn-night-200/90 shadow-lg border border-white/40 dark:border-white/10 flex items-center justify-center opacity-0 group-hover/shelf:opacity-100 transition-all hover:bg-booklyn-amber hover:text-white cursor-pointer">
            <ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => scrollShelf(1)}
            className="absolute right-0 top-[90px] z-20 translate-x-3 w-8 h-8 rounded-full bg-white/90 dark:bg-booklyn-night-200/90 shadow-lg border border-white/40 dark:border-white/10 flex items-center justify-center opacity-0 group-hover/shelf:opacity-100 transition-all hover:bg-booklyn-amber hover:text-white cursor-pointer">
            <ChevronRight className="w-4 h-4" /></button>
          <div ref={shelfScrollRef} className="flex gap-4 overflow-x-auto pb-2 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
            {allShelfBooks.map((book) => {
              const pct = book.pages > 0 ? Math.round((book.progress / book.pages) * 100) : 0;
              return (
                <motion.div key={book.id} whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="flex-shrink-0 w-[140px] cursor-pointer group/card select-none" onClick={() => handleBookClick(book)}>
                  <div className="relative w-full h-[200px] rounded-2xl overflow-hidden shadow-md bg-booklyn-cream-200 dark:bg-booklyn-night-400">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} loading="lazy" className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${book.cover_color || 'from-booklyn-amber to-amber-800'} p-3 flex flex-col justify-between text-white`}>
                        <Bookmark className="w-4 h-4 self-end opacity-40" />
                        <p className="font-serif text-xs font-bold line-clamp-3 leading-snug">{book.title}</p>
                      </div>
                    )}
                    {book.status === 'reading' && pct > 0 && (
                      <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                        <span className="text-[8px] font-black text-booklyn-amber">{pct}%</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2.5 space-y-1 px-0.5">
                    <p className="font-serif font-bold text-xs leading-snug line-clamp-2 group-hover/card:text-booklyn-amber transition-colors">{book.title}</p>
                    <p className="text-[10px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate">{book.author}</p>
                    {book.status !== 'to_read' && (
                      <div className="pt-0.5">
                        <div className="flex justify-between text-[9px] font-bold mb-0.5">
                          <span className="text-booklyn-night-100/35 dark:text-booklyn-cream-200/35">{book.status === 'completed' ? 'Done' : 'Reading'}</span>
                          <span className="text-booklyn-amber">{pct}%</span>
                        </div>
                        <div className="w-full h-1 bg-booklyn-cream-300 dark:bg-booklyn-night-400 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-booklyn-amber to-booklyn-lavender rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ CONTINUE READING ═══ */}
      {currentlyReading.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold tracking-tight">Continue Reading</h2>
            <button onClick={() => { setViewMode('grid'); setActiveTab('reading'); }}
              className="text-xs font-bold text-booklyn-amber hover:text-booklyn-amber-dark flex items-center gap-0.5 transition-colors cursor-pointer">
              View all <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="space-y-3">
            {currentlyReading.slice(0, 3).map((book) => {
              const pct = book.pages > 0 ? Math.round((book.progress / book.pages) * 100) : 0;
              return (
                <motion.div key={book.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="glass-panel rounded-2xl p-4 border border-white/20 dark:border-white/10 hover:border-booklyn-amber/30 shadow-sm transition-all flex items-center gap-4">
                  <div className="w-14 h-20 rounded-xl overflow-hidden shadow-md bg-booklyn-cream-200 dark:bg-booklyn-night-400 flex-shrink-0">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${book.cover_color || 'from-booklyn-amber to-amber-800'} flex items-center justify-center text-white text-[8px] p-1 font-serif font-bold text-center`}>{book.title.slice(0,12)}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <h3 className="font-serif font-bold text-sm leading-tight truncate">{book.title}</h3>
                      <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate">{book.author}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-booklyn-cream-300 dark:bg-booklyn-night-400 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                          className="h-full bg-gradient-to-r from-booklyn-amber to-booklyn-lavender rounded-full" />
                      </div>
                      <span className="text-[10px] font-bold text-booklyn-amber flex-shrink-0">{pct}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link to={`/book/${book.id}`}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark hover:brightness-110 text-white font-bold text-xs shadow-md shadow-booklyn-amber/20 active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap">
                      <Play className="w-3 h-3 fill-white" /> Continue Reading
                    </Link>
                    <button onClick={(e) => { e.stopPropagation(); handleBookClick(book); }}
                      className="p-2 rounded-xl text-booklyn-night-100/40 dark:text-booklyn-cream-200/30 hover:bg-white/10 transition-colors">
                      <MoreVertical className="w-4 h-4" /></button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ RECENTLY ADDED ═══ */}
      {recentlyAdded.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold tracking-tight">Recently Added</h2>
            <button onClick={() => { setViewMode('grid'); setActiveTab('to_read'); }}
              className="text-xs font-bold text-booklyn-amber hover:text-booklyn-amber-dark flex items-center gap-0.5 transition-colors cursor-pointer">
              View all <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {recentlyAdded.map((book) => {
              const pct = book.pages > 0 ? Math.round((book.progress / book.pages) * 100) : 0;
              return (
                <motion.div key={book.id} whileHover={{ y: -4 }}
                  className="flex-shrink-0 w-[130px] cursor-pointer group/rec select-none" onClick={() => handleBookClick(book)}>
                  <div className="relative w-full h-[185px] rounded-2xl overflow-hidden shadow-md bg-booklyn-cream-200 dark:bg-booklyn-night-400">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} loading="lazy" className="w-full h-full object-cover group-hover/rec:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${book.cover_color || 'from-booklyn-amber to-amber-800'} p-3 flex flex-col justify-between text-white`}>
                        <Bookmark className="w-4 h-4 self-end opacity-40" />
                        <p className="font-serif text-xs font-bold line-clamp-3 leading-snug">{book.title}</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 px-0.5 space-y-0.5">
                    <p className="font-serif font-bold text-xs leading-snug line-clamp-2 group-hover/rec:text-booklyn-amber transition-colors">{book.title}</p>
                    <p className="text-[10px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate">{book.author}</p>
                    {book.status !== 'to_read' && (
                      <div className="w-full h-1 bg-booklyn-cream-300 dark:bg-booklyn-night-400 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && books.length === 0 && (
        <div className="py-20 text-center space-y-5 glass-panel rounded-3xl border border-white/10 max-w-md mx-auto">
          <BookOpen className="w-14 h-14 text-booklyn-amber/40 mx-auto" />
          <div>
            <h3 className="font-serif text-xl font-bold mb-2">Your shelf is empty</h3>
            <p className="text-xs text-booklyn-night-100/55 dark:text-booklyn-cream-200/45 max-w-xs mx-auto leading-relaxed">Discover books and add them to start building your reading library.</p>
          </div>
          <Link to="/discover" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white rounded-2xl font-bold text-xs shadow-md hover:brightness-110 transition-all">
            <BookOpen className="w-4 h-4" /> Discover Books
          </Link>
        </div>
      )}

      {/* ═══ LIBRARY MANAGEMENT — SEARCH, FILTERS & VIEWS ═══ */}
      {books.length > 0 && (
      <div className="space-y-6 border-t border-booklyn-cream-300/30 dark:border-booklyn-night-100/10 pt-8">
        <div>
          <h2 className="font-serif text-xl font-bold tracking-tight mb-1">Manage Your Library</h2>
          <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Drag books between shelves, filter by genre, and track your reading journey.</p>
        </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="glass-panel rounded-3xl p-4.5 border border-white/20 dark:border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          {/* Search text input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4.5 h-4.5 text-booklyn-night-100/40 dark:text-booklyn-cream-200/35" />
            <input
              type="text"
              placeholder="Search library by title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.75rem' }}
              className="w-full !pl-11 pr-4 py-3 glass-input rounded-xl text-xs md:text-sm font-medium"
            />
          </div>

          {/* Filtering controllers */}
          <div className="flex flex-wrap items-center gap-3.5">
            {/* Favorites filter toggle */}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-3 py-2.5 rounded-xl border text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-all cursor-pointer ${
                showFavoritesOnly
                  ? 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark border-booklyn-amber text-white shadow-md shadow-booklyn-amber/20 font-bold'
                  : 'bg-white/20 dark:bg-white/5 border-white/15 dark:border-white/5 text-booklyn-night-100/70 dark:text-booklyn-cream-100 hover:bg-white/35 dark:hover:bg-white/10'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-white text-white' : 'text-booklyn-amber'}`} />
              <span>Favorites Only</span>
            </button>

            {/* Genre drop menu */}
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-booklyn-night-100/40 dark:text-booklyn-cream-200/40">Genre:</span>
              <div className="relative">
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="pl-3 pr-8 py-2.5 glass-input rounded-xl text-xs font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-booklyn-amber/50"
                >
                  {genresList.map(genre => (
                    <option key={genre} value={genre} className="bg-white dark:bg-booklyn-night-200 text-booklyn-night-200 dark:text-booklyn-cream-100">{genre}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none text-booklyn-night-100/40 dark:text-booklyn-cream-200/40" />
              </div>
            </div>

            {/* Sort order select */}
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-booklyn-night-100/40 dark:text-booklyn-cream-200/40">Sort:</span>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="pl-3 pr-8 py-2.5 glass-input rounded-xl text-xs font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-booklyn-amber/50"
                >
                  <option value="recent" className="bg-white dark:bg-booklyn-night-200 text-booklyn-night-200 dark:text-booklyn-cream-100">Recently Added</option>
                  <option value="rating" className="bg-white dark:bg-booklyn-night-200 text-booklyn-night-200 dark:text-booklyn-cream-100">Highest Rated</option>
                  <option value="progress" className="bg-white dark:bg-booklyn-night-200 text-booklyn-night-200 dark:text-booklyn-cream-100">Reading Progress</option>
                  <option value="title" className="bg-white dark:bg-booklyn-night-200 text-booklyn-night-200 dark:text-booklyn-cream-100">Title A-Z</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none text-booklyn-night-100/40 dark:text-booklyn-cream-200/40" />
              </div>
            </div>

            {/* Layout Mode Toggles */}
            <div className="flex border border-white/20 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setViewMode('board')}
                title="Board (Drag-and-Drop Column view)"
                className={`p-2.5 transition-colors cursor-pointer ${viewMode === 'board' ? 'bg-gradient-to-tr from-booklyn-amber/20 to-booklyn-lavender/20 text-booklyn-amber dark:text-booklyn-amber-light font-bold' : 'bg-transparent text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:bg-white/10 dark:hover:bg-white/5'}`}
              >
                <KanbanSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setViewMode('grid'); if (!['reading', 'to_read', 'completed', 'dropped'].includes(activeTab)) setActiveTab('reading'); }}
                title="Shelf (Grid view)"
                className={`p-2.5 transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-gradient-to-tr from-booklyn-amber/20 to-booklyn-lavender/20 text-booklyn-amber dark:text-booklyn-amber-light font-bold' : 'bg-transparent text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:bg-white/10 dark:hover:bg-white/5'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setViewMode('list'); if (!['reading', 'to_read', 'completed', 'dropped'].includes(activeTab)) setActiveTab('reading'); }}
                title="Table (List view)"
                className={`p-2.5 transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-gradient-to-tr from-booklyn-amber/20 to-booklyn-lavender/20 text-booklyn-amber dark:text-booklyn-amber-light font-bold' : 'bg-transparent text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:bg-white/10 dark:hover:bg-white/5'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW WRAPPERS */}
      <div>
        {loading && books.length === 0 ? (
          /* Shimmering Skeletons loader */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="glass-panel rounded-3xl p-4 border border-white/10 space-y-4 animate-pulse">
                <div className="aspect-[3/4] bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded-2xl w-full" />
                <div className="space-y-2">
                  <div className="h-4 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-5/6" />
                  <div className="h-3 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'board' ? (
          /* BOARD MODE (KANBAN COLUMNS WITH HTML5 DRAG & DROP) */
          <div 
            className="flex gap-4 md:gap-5 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory flex-nowrap md:grid md:grid-cols-4 md:overflow-x-visible"
            style={{ scrollbarWidth: 'thin' }}
          >
            {SHELVES.map((shelf) => {
              const shelfBooks = processBooksList(shelf.key);
              const isOver = dragOverStatus === shelf.key;

              return (
                <div
                  key={shelf.key}
                  onDragOver={(e) => handleDragOver(e, shelf.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, shelf.key)}
                  className={`snap-center flex-shrink-0 w-[280px] sm:w-[320px] md:w-full min-h-[550px] rounded-3xl glass-panel p-4 border transition-all duration-300 flex flex-col gap-4 relative select-none ${
                    isOver 
                      ? 'border-booklyn-amber/55 shadow-glow-amber bg-booklyn-amber/5 dark:bg-booklyn-amber/5' 
                      : 'border-white/20 dark:border-white/5'
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-booklyn-cream-300/35 dark:border-booklyn-night-100/10">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${shelf.dot}`} />
                      <h3 className="font-serif font-bold text-sm md:text-base tracking-tight">{shelf.label}</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-booklyn-cream-300 dark:bg-booklyn-night-400 text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">
                      {shelfBooks.length}
                    </span>
                  </div>

                  {/* Drag-over active indicator layer */}
                  {isOver && (
                    <div className="absolute inset-x-4 top-16 bottom-4 border-2 border-dashed border-booklyn-amber/30 rounded-2xl flex items-center justify-center pointer-events-none text-booklyn-amber font-semibold text-xs animate-pulse">
                      Drop here to shelve
                    </div>
                  )}

                  {/* Empty Column view */}
                  {shelfBooks.length === 0 && !isOver && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-60">
                      <BookOpen className="w-8 h-8 text-booklyn-night-100/30 dark:text-booklyn-cream-200/30" />
                      <p className="text-[10px] font-semibold text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 uppercase tracking-wider max-w-[150px]">
                        Empty shelf
                      </p>
                    </div>
                  )}

                  {/* Draggable Cards list loop */}
                  <div className="flex-1 overflow-y-auto space-y-3 max-h-[600px] pr-1.5 custom-scrollbar">
                    <AnimatePresence>
                      {shelfBooks.map((book) => (
                        <DraggableBookCard
                          key={book.id}
                          book={book}
                          onClick={() => handleBookClick(book)}
                          onDragStart={(e) => handleDragStart(e, book.id)}
                          onToggleFavorite={(e) => handleToggleFavorite(book, e)}
                          onDelete={(e) => openDeleteConfirmation(book, e)}
                          onStartTimer={(e) => handleStartReadingSession(book, e)}
                          onMove={handleMoveBook}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* GRID & LIST MULTI-VIEW */
          <div className="space-y-6">
            {/* Shelf tabs row for grid/list focus */}
            <div className="flex flex-wrap gap-1.5 border-b border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 pb-4">
              {SHELVES.map((tab) => {
                const count = books.filter(b => b.status === tab.key).length;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                      activeTab === tab.key
                        ? 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white shadow-md shadow-booklyn-amber/20 font-bold'
                        : 'bg-white/20 dark:bg-white/5 border border-white/10 text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 hover:text-booklyn-night-100 dark:hover:text-booklyn-cream-100'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.key ? 'bg-white/25 text-white' : 'bg-booklyn-cream-300 dark:bg-booklyn-night-400 text-booklyn-night-100/50 dark:text-booklyn-cream-200/40'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {processBooksList(activeTab).length === 0 ? (
              <div className="text-center py-16 space-y-4 glass-panel rounded-3xl border border-white/10 max-w-lg mx-auto shadow-md">
                <BookOpen className="w-12 h-12 text-booklyn-amber mx-auto opacity-35" />
                <h3 className="font-serif text-xl font-bold">This shelf is empty</h3>
                <p className="text-xs text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 max-w-xs mx-auto leading-relaxed">
                  {showFavoritesOnly 
                    ? 'Try toggling "Favorites Only" off or add favorites in the book details panels.' 
                    : `You don't have any books shelved under this shelf yet. Navigate to Discover and search books to add!`}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEWPORT */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {processBooksList(activeTab).map((book) => {
                  const progressPct = book.pages > 0 ? Math.round((book.progress / book.pages) * 100) : 0;
                  return (
                    <motion.div
                      key={book.id}
                      onClick={() => handleBookClick(book)}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      whileHover={{ y: -6 }}
                      className="glass-panel rounded-3xl p-4 border border-white/20 dark:border-white/10 hover:border-booklyn-amber/30 hover:shadow-glow-amber cursor-pointer flex flex-col justify-between h-full group select-none relative overflow-visible"
                    >
                      {book.isOptimistic && (
                        <div className="absolute top-2 left-2 z-35 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-booklyn-amber text-[8px] font-black text-white uppercase tracking-wider animate-pulse">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Saving...
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        {/* Cover preview box */}
                        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-md bg-booklyn-cream-200 dark:bg-booklyn-night-400">
                          {book.cover_url ? (
                            <img
                              src={book.cover_url}
                              alt={book.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                            />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${book.cover_color} p-4 flex flex-col justify-between text-white`}>
                              <Bookmark className="w-5 h-5 self-end opacity-40" />
                              <div className="space-y-0.5">
                                <p className="font-serif text-sm font-bold line-clamp-3 leading-snug">{book.title}</p>
                                <p className="text-[10px] opacity-75 truncate">{book.author}</p>
                              </div>
                            </div>
                          )}

                          {/* Heart icon favorite badge */}
                          <button
                            onClick={(e) => handleToggleFavorite(book, e)}
                            className={`absolute top-2.5 right-2.5 p-2 rounded-xl border backdrop-blur-md transition-all active:scale-90 z-20 ${
                              book.favorite
                                ? 'bg-gradient-to-tr from-booklyn-amber to-booklyn-amber-dark border-booklyn-amber text-white'
                                : 'bg-black/35 border-white/10 text-white/70 hover:text-white'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${book.favorite ? 'fill-white' : ''}`} />
                          </button>

                          {/* Quick timer play overlay (reading only) */}
                          {book.status === 'reading' && (
                            <button
                              onClick={(e) => handleStartReadingSession(book, e)}
                              title="Start live timer session"
                              className="absolute bottom-2.5 right-2.5 p-2.5 rounded-xl border backdrop-blur-md bg-gradient-to-tr from-booklyn-amber to-booklyn-amber-dark border-booklyn-amber text-white opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 active:scale-90 transition-all duration-300 z-20 shadow-lg"
                            >
                              <Play className="w-3 h-3 fill-white" />
                            </button>
                          )}
                        </div>

                        {/* Title metadata details */}
                        <div className="space-y-1">
                          <h4 className="font-serif font-bold text-base tracking-tight line-clamp-2 leading-tight group-hover:text-booklyn-amber transition-colors">
                            {book.title}
                          </h4>
                          <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate">
                            by {book.author}
                          </p>
                        </div>
                      </div>

                      {/* Read progress indicators & controls */}
                      <div className="space-y-3 mt-4 pt-3 border-t border-booklyn-cream-300/20 dark:border-booklyn-night-100/10">
                        {book.status !== 'to_read' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-booklyn-night-100/40 dark:text-booklyn-cream-200/40">Progress</span>
                              <span className="text-booklyn-amber dark:text-booklyn-amber-light">{progressPct}% ({book.progress}/{book.pages} p.)</span>
                            </div>
                            <div className="w-full h-1.5 bg-booklyn-cream-300 dark:bg-booklyn-night-400 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-booklyn-amber to-booklyn-lavender rounded-full"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xs relative">
                          {book.status === 'completed' && book.rating > 0 ? (
                            <div className="flex items-center gap-0.5 font-bold text-booklyn-amber">
                              <Star className="w-3.5 h-3.5 fill-booklyn-amber text-booklyn-amber" />
                              <span>{book.rating}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-booklyn-night-100/45 dark:text-booklyn-cream-200/40 truncate max-w-[80px]">
                              {book.genre || 'General'}
                            </span>
                          )}

                          {/* Quick move dropdown for grid card */}
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <select
                              value={book.status}
                              onChange={(e) => handleMoveBook(book.id, e.target.value)}
                              className="px-2 py-1 text-[9px] font-bold uppercase tracking-wide glass-input border border-white/20 dark:border-white/10 rounded-lg focus:outline-none"
                            >
                              {SHELVES.map(s => (
                                <option key={s.key} value={s.key} className="text-booklyn-night-200 dark:text-booklyn-night-400 bg-white dark:bg-booklyn-night-300">{s.label}</option>
                              ))}
                            </select>
                            
                            <button
                              onClick={(e) => openDeleteConfirmation(book, e)}
                              className="p-1.5 rounded-lg text-booklyn-night-100/40 hover:text-red-500 hover:bg-red-500/10 dark:text-booklyn-cream-200/30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEWPORT TABLE */
              <div className="glass-panel rounded-3xl overflow-hidden border border-white/20 dark:border-white/10 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 bg-white/10 dark:bg-white/5 text-[11px] font-bold uppercase tracking-wider text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">
                        <th className="py-4 px-6">Book Details</th>
                        <th className="py-4 px-4">Genre</th>
                        {activeTab !== 'to_read' && <th className="py-4 px-4">Progress</th>}
                        <th className="py-4 px-4">Rating</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-booklyn-cream-300/20 dark:divide-booklyn-night-100/15 text-sm">
                      {processBooksList(activeTab).map((book) => {
                        const progressPct = book.pages > 0 ? Math.round((book.progress / book.pages) * 100) : 0;
                        return (
                          <tr 
                            key={book.id} 
                            onClick={() => handleBookClick(book)}
                            className="hover:bg-white/20 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                          >
                            <td className="py-3.5 px-6 flex items-center gap-4">
                              <div className="w-10 h-14 rounded-lg overflow-hidden shadow bg-booklyn-cream-200 dark:bg-booklyn-night-400 flex-shrink-0">
                                {book.cover_url ? (
                                  <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className={`w-full h-full bg-gradient-to-br ${book.cover_color} flex items-center justify-center text-white text-[8px] font-serif font-bold p-1 text-center`}>
                                    {book.title.substring(0, 8)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-serif font-bold tracking-tight text-sm truncate max-w-[200px] sm:max-w-[300px]">
                                  {book.title}
                                </p>
                                <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate">
                                  {book.author}
                                </p>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-xs font-semibold text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
                              {book.genre || 'Other'}
                            </td>

                            {activeTab !== 'to_read' && (
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-booklyn-amber dark:text-booklyn-amber-light">{progressPct}%</span>
                                  <span className="text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/40">({book.progress}/{book.pages})</span>
                                </div>
                              </td>
                            )}

                            <td className="py-3.5 px-4">
                              {book.rating > 0 ? (
                                <div className="flex items-center gap-0.5 text-booklyn-amber font-bold text-xs">
                                  <Star className="w-3.5 h-3.5 fill-booklyn-amber text-booklyn-amber" />
                                  <span>{book.rating}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-booklyn-night-100/30 dark:text-booklyn-cream-200/30">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <select
                                  value={book.status}
                                  onChange={(e) => handleMoveBook(book.id, e.target.value)}
                                  className="px-2 py-1 text-[9px] font-bold uppercase tracking-wide glass-input border border-white/20 dark:border-white/10 rounded-lg focus:outline-none"
                                >
                                  {SHELVES.map(s => (
                                    <option key={s.key} value={s.key} className="text-booklyn-night-200 dark:text-booklyn-night-400 bg-white dark:bg-booklyn-night-300">{s.label}</option>
                                  ))}
                                </select>

                                <button
                                  onClick={(e) => handleToggleFavorite(book, e)}
                                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                                    book.favorite
                                      ? 'bg-gradient-to-tr from-booklyn-amber to-booklyn-amber-dark border-booklyn-amber text-white'
                                      : 'bg-white/20 dark:bg-white/5 border-white/10 text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:text-booklyn-amber'
                                  }`}
                                >
                                  <Heart className={`w-3.5 h-3.5 ${book.favorite ? 'fill-white' : ''}`} />
                                </button>

                                {book.status === 'reading' && (
                                  <button
                                    onClick={(e) => handleStartReadingSession(book, e)}
                                    title="Start live timer session"
                                    className="p-2 rounded-xl border border-booklyn-amber bg-booklyn-amber/10 text-booklyn-amber hover:bg-booklyn-amber hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                  </button>
                                )}

                                <button
                                  onClick={(e) => openDeleteConfirmation(book, e)}
                                  className="p-2 rounded-xl border border-transparent hover:border-red-500/20 text-booklyn-night-100/45 dark:text-booklyn-cream-200/30 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      </div>
      )} {/* ─── end management section ─── */}

      {/* Book details slide-out drawer overlay */}
      <BookDetailSlideOver
        book={selectedBook}
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
      />

      {/* CUSTOM GLASS CONFIRMATION MODAL */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowDeleteModal(false); setBookToDelete(null); }}
              className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[99] cursor-pointer"
            />
            
            {/* Modal popup */}
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="glass-panel max-w-md w-full p-6 border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl space-y-4 pointer-events-auto select-none"
              >
                <div className="flex items-center gap-3 text-red-500 dark:text-red-400">
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-5.5 h-5.5 animate-pulse" />
                  </div>
                  <h3 className="font-serif text-xl font-bold tracking-tight">Remove from library?</h3>
                </div>

                <p className="text-xs text-booklyn-night-100/70 dark:text-booklyn-cream-200/50 leading-relaxed">
                  Are you sure you want to permanently erase <span className="font-bold text-booklyn-night-200 dark:text-white">"{bookToDelete?.title}"</span> by {bookToDelete?.author}? This will wipe this title, all shelved progress sessions, and logged reading metrics from your dashboard.
                </p>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => { setShowDeleteModal(false); setBookToDelete(null); }}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/25 dark:bg-white/5 border border-white/10 text-booklyn-night-100/70 dark:text-booklyn-cream-100 hover:bg-white/35 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteBook}
                    className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg active:scale-95 transition-all cursor-pointer"
                  >
                    Yes, Remove
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Local PDF Book Import Modal */}
      <ImportPdfModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
      />
    </div>
  );
}

// ----------------------------------------------------
// BOARD COLUMN DRAGGABLE BOOK CARD SUB-COMPONENT
// ----------------------------------------------------
function DraggableBookCard({ book, onClick, onDragStart, onToggleFavorite, onDelete, onStartTimer, onMove }) {
  const progressPct = book.pages > 0 ? Math.round((book.progress / book.pages) * 100) : 0;
  const [showShelveOptions, setShowShelveOptions] = useState(false);

  return (
    <motion.div
      layoutId={`book-card-${book.id}`}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`glass-panel p-3 border border-white/15 dark:border-white/5 rounded-2xl hover:border-booklyn-amber/35 hover:shadow-glow-amber transition-all cursor-grab active:cursor-grabbing flex flex-col gap-3 relative select-none group overflow-visible ${
        book.isOptimistic ? 'opacity-80 border-dashed border-booklyn-amber' : ''
      }`}
    >
      {/* Optimistic saving loader overlay */}
      {book.isOptimistic && (
        <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-[1px] rounded-2xl flex items-center justify-center pointer-events-none z-10">
          <RefreshCw className="w-5 h-5 animate-spin text-booklyn-amber" />
        </div>
      )}

      {/* Book details block */}
      <div className="flex gap-3">
        {/* Cover thumbnail */}
        <div className="w-12 h-16 rounded-xl overflow-hidden bg-booklyn-cream-200 dark:bg-booklyn-night-400 shadow flex-shrink-0">
          {book.cover_url ? (
            <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${book.cover_color} flex items-center justify-center text-white text-[7px] p-1 text-center font-bold font-serif leading-none`}>
              {book.title.substring(0, 10)}
            </div>
          )}
        </div>

        {/* Title metadata info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <h4 className="font-serif font-bold text-xs md:text-sm tracking-tight line-clamp-2 leading-snug group-hover:text-booklyn-amber transition-colors">
            {book.title}
          </h4>
          <p className="text-[10px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate">
            {book.author}
          </p>
        </div>
      </div>

      {/* Read percentage bar charts (if active reading) */}
      {book.status !== 'to_read' && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[9px] font-bold">
            <span className="text-booklyn-night-100/35 dark:text-booklyn-cream-200/35">Read</span>
            <span className="text-booklyn-amber dark:text-booklyn-amber-light">{progressPct}%</span>
          </div>
          <div className="w-full h-1 bg-booklyn-cream-300 dark:bg-booklyn-night-400 rounded-full overflow-hidden">
            <div 
              style={{ width: `${progressPct}%` }}
              className="h-full bg-gradient-to-r from-booklyn-amber to-booklyn-lavender rounded-full" 
            />
          </div>
        </div>
      )}

      {/* Actions footer tools row */}
      <div 
        className="flex items-center justify-between pt-2 border-t border-booklyn-cream-300/20 dark:border-booklyn-night-100/10" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {/* Favorite Toggle heart icon */}
          <button
            onClick={onToggleFavorite}
            className={`p-1.5 rounded-lg border transition-all active:scale-90 ${
              book.favorite
                ? 'bg-booklyn-amber/15 border-booklyn-amber/20 text-booklyn-amber'
                : 'bg-white/10 dark:bg-white/5 border-white/10 text-booklyn-night-100/40 dark:text-booklyn-cream-200/30 hover:text-booklyn-amber'
            }`}
          >
            <Heart className={`w-3 h-3 ${book.favorite ? 'fill-booklyn-amber' : ''}`} />
          </button>

          {/* Quick Play reading session trigger */}
          {book.status === 'reading' && (
            <button
              onClick={onStartTimer}
              title="Start active session timer"
              className="p-1.5 rounded-lg border border-booklyn-amber/20 bg-booklyn-amber/10 text-booklyn-amber hover:bg-booklyn-amber hover:text-white transition-all cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
          )}

          {/* Direct shelve dropdown selector */}
          <div className="relative">
            <button
              onClick={() => setShowShelveOptions(!showShelveOptions)}
              title="Move shelf"
              className={`px-1.5 py-0.5 rounded-lg border text-[9px] font-bold tracking-wide uppercase transition-all cursor-pointer ${
                showShelveOptions 
                  ? 'bg-booklyn-amber border-booklyn-amber text-white' 
                  : 'bg-white/10 dark:bg-white/5 border-white/10 text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 hover:bg-white/20'
              }`}
            >
              Move
            </button>

            <AnimatePresence>
              {showShelveOptions && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowShelveOptions(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                    className="absolute left-0 bottom-6 mb-1 w-[130px] glass-overlay border border-white/15 dark:border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] z-[100] overflow-hidden flex flex-col p-1.5 gap-0.5 pointer-events-auto"
                  >
                    {SHELVES.map(s => {
                      const isActive = book.status === s.key;
                      return (
                        <button
                          key={s.key}
                          onClick={() => {
                            setShowShelveOptions(false);
                            onMove(book.id, s.key);
                          }}
                          className={`w-full px-2 py-1.5 text-left rounded-lg text-[9px] font-bold tracking-wide flex items-center justify-between border border-transparent transition-all cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white font-bold'
                              : 'hover:bg-white/30 dark:hover:bg-white/5 text-booklyn-night-200 dark:text-booklyn-cream-100'
                          }`}
                        >
                          <span>{s.label}</span>
                          {isActive && <Check className="w-2.5 h-2.5 text-white" />}
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-booklyn-night-100/35 hover:text-red-500 hover:bg-red-500/10 dark:text-booklyn-cream-200/30 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}
