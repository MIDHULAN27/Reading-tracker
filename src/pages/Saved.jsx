import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Trash2, Search, ArrowUpRight, Compass, RefreshCw, Heart 
} from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';

export default function Saved() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { books, loading: loadingBooks, fetchBooks, deleteBook, updateBook } = useLibraryStore();

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Filters matching search query
  const filteredBooks = books.filter(book => {
    const titleMatch = book.title.toLowerCase().includes(searchQuery.toLowerCase());
    const authorMatch = book.author.toLowerCase().includes(searchQuery.toLowerCase());
    const genreMatch = (book.genre || '').toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || authorMatch || genreMatch;
  });

  const handleToggleFavorite = async (book, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateBook(book.id, { favorite: !book.favorite });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBook = async (bookId, title, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Remove "${title}" and all its logs from your library shelf?`)) {
      try {
        await deleteBook(bookId);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
  };

  return (
    <div className="relative min-h-screen pb-16">
      {/* Background glowing effects */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full ambient-glow-1 pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-[450px] h-[450px] rounded-full ambient-glow-2 pointer-events-none" />

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 sm:space-y-8 relative z-10">
        
        {/* Header Title */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-booklyn-amber dark:text-booklyn-amber-light">
            My Sanctuary Folders
          </span>
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-booklyn-night-300 dark:text-white leading-tight">
            Saved Bookmarks
          </h1>
          <p className="text-xs sm:text-sm text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
            A beautiful, organized home for all your saved books.
          </p>
        </div>

        {/* Search controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 bg-white/20 dark:bg-booklyn-night-200/35 p-3 rounded-3xl border border-white/20 dark:border-white/5 backdrop-blur-md shadow-glass-light dark:shadow-glass-dark">
          {/* Search query input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-booklyn-night-100/40 dark:text-booklyn-cream-200/40" />
            <input
              type="text"
              placeholder="Search books by title, author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs glass-input"
            />
          </div>
        </div>

        {/* Loading Spinner */}
        {loadingBooks ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-booklyn-amber animate-spin mx-auto" />
            <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Synchronizing folders catalog...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="books-grid"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-6"
            >
              {filteredBooks.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-16 text-center glass-panel border border-white/10 rounded-3xl p-8 space-y-5 max-w-lg mx-auto"
                >
                  <div className="p-4 rounded-full bg-booklyn-amber/10 text-booklyn-amber w-16 h-16 flex items-center justify-center mx-auto">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-serif font-bold text-xl">Book Shelf Empty</h3>
                    <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 max-w-sm mx-auto leading-relaxed">
                      {searchQuery 
                        ? `No saved books matched your search phrase "${searchQuery}". Try editing filters.`
                        : "You don't have any books saved on your virtual shelves. Explore Open Library daily trending books!"}
                    </p>
                  </div>
                  {!searchQuery && (
                    <Link 
                      to="/discover" 
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark hover:brightness-110 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-booklyn-amber/10"
                    >
                      <Compass className="w-4 h-4" /> Discover Trending Books
                    </Link>
                  )}
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredBooks.map((book) => {
                    const pct = Math.round((book.progress / book.pages) * 100);
                    return (
                      <motion.div
                        key={book.id}
                        variants={cardVariants}
                        whileHover={{ y: -5 }}
                        className="glass-panel border-white/20 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full group relative"
                      >
                        {/* Heart Icon for favorite */}
                        {book.favorite && (
                          <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 z-10">
                            <Heart className="w-3.5 h-3.5 fill-current" />
                          </div>
                        )}

                        {/* Cover Image Frame */}
                        <Link to={`/book/${book.id}`} className="block relative aspect-w-4 aspect-h-5 bg-booklyn-night-400/50 flex-shrink-0">
                          {book.cover_url ? (
                            <img 
                              src={book.cover_url} 
                              alt={book.title} 
                              className="w-full h-56 object-cover object-center group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className={`w-full h-56 bg-gradient-to-tr ${book.cover_color} text-white flex flex-col items-center justify-between p-4 text-center`}>
                              <BookOpen className="w-6 h-6 opacity-60 mt-4" />
                              <h4 className="font-serif font-bold text-xs leading-snug px-1 line-clamp-3">{book.title}</h4>
                              <div className="mb-2" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="px-3.5 py-1.5 rounded-lg bg-white text-booklyn-night-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                              View Profile <ArrowUpRight className="w-3 h-3" />
                            </span>
                          </div>
                        </Link>

                        {/* Details Metadata */}
                        <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-booklyn-amber/15 text-booklyn-amber text-[8px] font-bold uppercase tracking-wider">
                                {book.status.replace('_', ' ')}
                              </span>
                            </div>
                            <h3 className="font-serif font-bold text-sm text-booklyn-night-300 dark:text-white line-clamp-1 group-hover:text-booklyn-amber transition-colors">
                              <Link to={`/book/${book.id}`}>{book.title}</Link>
                            </h3>
                            <p className="text-[11px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate">
                              by {book.author}
                            </p>
                          </div>

                          {/* Book Progress Metrics */}
                          <div className="space-y-2 pt-2 border-t border-white/5">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-booklyn-night-100/40 dark:text-booklyn-cream-200/35">PROGRESS</span>
                              <span className="text-booklyn-night-300 dark:text-white">{pct}% ({book.progress}/{book.pages} p.)</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8 }}
                              />
                            </div>

                            {/* Action bottom buttons */}
                            <div className="flex items-center justify-between pt-2">
                              <button 
                                onClick={(e) => handleToggleFavorite(book, e)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  book.favorite 
                                    ? 'bg-red-500/10 border-red-500/20 text-red-500'
                                    : 'bg-transparent border-white/10 hover:text-red-500'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${book.favorite ? 'fill-current' : ''}`} />
                              </button>
                              
                              <button 
                                onClick={(e) => handleDeleteBook(book.id, book.title, e)}
                                className="p-1.5 rounded-lg border border-white/10 text-booklyn-night-100/40 hover:text-red-500 hover:border-red-500/30 transition-colors"
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
              )}
            </motion.div>
          </AnimatePresence>
        )}

      </div>
    </div>
  );
}
