import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Book, FileText, Calendar, Plus, Check, Star, Heart, Bookmark, ExternalLink, RefreshCw, AlertCircle, ThumbsUp, Trash2, Edit2, MessageSquare, CheckCircle } from 'lucide-react';
import { booksApi } from '../api/booksApi';
import { useLibraryStore } from '../store/useLibraryStore';
import RatingPicker from './RatingPicker';
import { useReviewStore } from '../store/useReviewStore';
import { useAuthStore } from '../store/useAuthStore';

export default function BookDetailSlideOver({ book, isOpen, onClose }) {
  const [description, setDescription] = useState('');
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [addedShelf, setAddedShelf] = useState(null); // 'to_read', 'reading', 'completed'

  // Reviews & Ratings state
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'

  // Book Config state
  const [trackMode, setTrackMode] = useState('pages');
  const [totalChapters, setTotalChapters] = useState(20);

  const { books, addBook, updateBook } = useLibraryStore();

  // Find if book already exists in local shelf
  const existingBook = books.find(b => b.title === book?.title && b.author === book?.author);

  // Reviews state logic
  const { 
    reviews, 
    loading: reviewsLoading, 
    error: reviewsError, 
    page, 
    hasMore, 
    totalCount, 
    sortBy, 
    fetchReviews, 
    submitReview, 
    editReview, 
    removeReview, 
    toggleReaction 
  } = useReviewStore();
  const { user } = useAuthStore();

  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState(0);

  const currentUserId = user?.id || 'guest-booklyn-reader';

  // Fetch reviews when the drawer opens or book changes
  useEffect(() => {
    if (isOpen && book) {
      fetchReviews(book.id, 'helpful', 1, false);
      // Reset submission states
      setNewReviewText('');
      setNewReviewRating(0);
      setSubmitError(null);
      setEditingReviewId(null);
    }
  }, [isOpen, book, fetchReviews]);

  const handleSortChange = (newSort) => {
    if (book) {
      fetchReviews(book.id, newSort, 1, false);
    }
  };

  const handleLoadMore = () => {
    if (book) {
      fetchReviews(book.id, sortBy, page + 1, true);
    }
  };

  const handleReviewSubmit = async () => {
    if (!book) return;
    setSubmittingReview(true);
    setSubmitError(null);
    try {
      await submitReview(book.id, newReviewRating, newReviewText, true);
      setNewReviewText('');
      setNewReviewRating(0);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleStartEdit = (rev) => {
    setEditingReviewId(rev.id);
    setEditText(rev.review_text);
    setEditRating(rev.rating);
  };

  const handleReviewEditSave = async (reviewId) => {
    try {
      await editReview(reviewId, editRating, editText);
      setEditingReviewId(null);
    } catch (err) {
      alert(err.message || 'Failed to save edits.');
    }
  };

  const handleReviewDelete = async (reviewId) => {
    if (confirm('Are you sure you want to delete your community review?')) {
      try {
        await removeReview(reviewId);
      } catch (err) {
        alert(err.message || 'Failed to delete review.');
      }
    }
  };

  const handleHelpfulToggle = async (reviewId) => {
    try {
      await toggleReaction(reviewId);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen && book) {
      setLoadingDesc(true);
      setDescription('');
      setAddedShelf(existingBook ? existingBook.status : null);

      // Fetch description from Open Library API in background
      booksApi.getBookDescription(book.id)
        .then(desc => {
          setDescription(desc);
          setLoadingDesc(false);
        })
        .catch(() => {
          setDescription('No summary is currently available for this edition.');
          setLoadingDesc(false);
        });
    }
  }, [isOpen, book, existingBook]);

  // Synchronize local review and rating state with selected book changes
  useEffect(() => {
    if (existingBook) {
      setUserRating(existingBook.rating || 0);
      setUserReview(existingBook.review || '');
      setTrackMode(existingBook.tracking_mode || 'pages');
      setTotalChapters(existingBook.total_chapters || 20);
    } else {
      setUserRating(0);
      setUserReview('');
      setTrackMode('pages');
      setTotalChapters(20);
    }
    setSaveStatus('saved');
  }, [existingBook, isOpen]);

  // Debounced Auto-Saving logic for Reviews, Ratings, and configurations
  useEffect(() => {
    if (!existingBook) return;

    const hasRatingChanged = userRating !== (existingBook.rating || 0);
    const hasReviewChanged = userReview !== (existingBook.review || '');
    const hasTrackModeChanged = trackMode !== (existingBook.tracking_mode || 'pages');
    const hasTotalChaptersChanged = Number(totalChapters) !== (existingBook.total_chapters || 20);

    if (!hasRatingChanged && !hasReviewChanged && !hasTrackModeChanged && !hasTotalChaptersChanged) {
      return;
    }

    setSaveStatus('saving');

    const timeout = setTimeout(async () => {
      try {
        await updateBook(existingBook.id, {
          rating: Number(userRating),
          review: userReview,
          tracking_mode: trackMode,
          total_chapters: Number(totalChapters)
        });
        setSaveStatus('saved');
      } catch (err) {
        console.error(err);
        setSaveStatus('error');
      }
    }, 1000); // 1-second debounce window

    return () => clearTimeout(timeout);
  }, [userRating, userReview, trackMode, totalChapters, existingBook, updateBook]);

  const handleAddToShelf = async (status) => {
    if (!book) return;
    const isFreeBook = book && !(book.googlebooks_id && !book.openlibrary_id && !book.has_pdf);
    if (!isFreeBook) {
      alert('Only free edition books (from Project Gutenberg or local uploads) can be added to your library.');
      return;
    }
    try {
      const bookData = {
        ...book,
        status,
        progress: status === 'completed' ? book.pages : 0,
        tracking_mode: trackMode,
        total_chapters: Number(totalChapters),
        current_chapter: status === 'completed' ? Number(totalChapters) : 0
      };
      await addBook(bookData);
      setAddedShelf(status);
    } catch (err) {
      console.error(err);
    }
  };

  // Stats helper
  const progressPct = existingBook
    ? Math.round((existingBook.progress / existingBook.pages) * 100)
    : 0;

  return (
    <AnimatePresence>
      {isOpen && book && (
        <>
          {/* Overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-[6px] z-[200] pointer-events-auto"
          />

          {/* Slide Over Body */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg glass-overlay border-l border-white/15 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)] z-[200] flex flex-col h-full overflow-hidden pointer-events-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-booklyn-cream-300/40 dark:border-booklyn-night-100/20">
              <h2 className="font-serif text-2xl font-bold tracking-tight">Book details</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/30 dark:hover:bg-white/10 active:scale-95 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {/* Cover Card Preview & Circular Progress Ring */}
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <div className="relative w-40 h-56 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 group">
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${book.cover_color} p-4 flex flex-col justify-between text-white select-none`}>
                      <Bookmark className="w-6 h-6 self-end opacity-40" />
                      <div className="space-y-1">
                        <p className="font-serif text-sm font-bold line-clamp-3 leading-snug">{book.title}</p>
                        <p className="text-[10px] opacity-80 truncate">{book.author}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-serif text-2xl font-bold tracking-tight leading-tight">
                      {book.title}
                    </h3>
                    <p className="text-booklyn-amber dark:text-booklyn-amber-light font-medium text-base">
                      by {book.author}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                    <Link
                      to={`/book/${book.id}`}
                      onClick={onClose}
                      className="px-4 py-1.5 rounded-xl bg-booklyn-amber/15 hover:bg-booklyn-amber/25 border border-booklyn-amber/30 hover:border-booklyn-amber text-booklyn-amber text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-lg shadow-booklyn-amber/5"
                    >
                      <Book className="w-3.5 h-3.5" />
                      <span>Open Reading Sanctuary</span>
                    </Link>
                    
                    <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider bg-booklyn-cream-200 dark:bg-booklyn-night-100 rounded-lg text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 flex items-center gap-1.5">
                      <Book className="w-3.5 h-3.5" />
                      {book.genre || 'General'}
                    </span>
                    <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider bg-booklyn-cream-200 dark:bg-booklyn-night-100 rounded-lg text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      {book.pages} pages
                    </span>
                    {book.publish_year && (
                      <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider bg-booklyn-cream-200 dark:bg-booklyn-night-100 rounded-lg text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {book.publish_year}
                      </span>
                    )}
                  </div>

                  {/* Circular Progress Ring (Shown if book is shelved) */}
                  {existingBook && (
                    <motion.div 
                      whileHover={{ scale: 1.03 }}
                      className="flex items-center gap-4 bg-white/10 dark:bg-white/5 border border-white/10 p-3 rounded-2xl max-w-xs shadow-sm cursor-help mx-auto sm:mx-0"
                    >
                      <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="24"
                            className="stroke-booklyn-cream-300/40 dark:stroke-booklyn-night-100/20 fill-transparent"
                            strokeWidth="4"
                          />
                          <motion.circle
                            cx="32"
                            cy="32"
                            r="24"
                            className="stroke-booklyn-amber dark:stroke-booklyn-amber-light fill-transparent"
                            strokeWidth="4"
                            strokeDasharray={151}
                            initial={{ strokeDashoffset: 151 }}
                            animate={{ strokeDashoffset: 151 - (151 * progressPct) / 100 }}
                            transition={{ duration: 0.8 }}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute text-[11px] font-sans font-bold text-booklyn-amber">
                          {progressPct}%
                        </span>
                      </div>
                      <div className="text-left font-sans space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 leading-none">
                          Reading Progress
                        </p>
                        <p className="text-xs font-bold text-booklyn-night-300 dark:text-white">
                          {trackMode === 'pages' && `${existingBook.progress} of ${existingBook.pages} pages`}
                          {trackMode === 'percentage' && `${progressPct}% complete`}
                          {trackMode === 'chapters' && `Chapter ${existingBook.current_chapter || 0} of ${totalChapters}`}
                        </p>
                        <p className="text-[9px] font-semibold text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">
                          {existingBook.status === 'completed' ? '🎉 Finished' : '📖 Active'}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Action Shelving Bar */}
              <div className="glass-panel rounded-2xl p-4 border border-white/20 dark:border-white/10 space-y-3 shadow-sm bg-white/5">
                <p className="text-xs font-bold uppercase tracking-widest text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 text-center sm:text-left">
                  {existingBook ? 'Shelf Alignment' : 'Add to My Shelves'}
                </p>
                
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'to_read', label: 'Want to Read' },
                    { key: 'reading', label: 'Start Reading' },
                    { key: 'completed', label: 'Completed' },
                  ].map((shelf) => {
                    const isSelected = addedShelf === shelf.key;
                    return (
                      <button
                        key={shelf.key}
                        onClick={() => handleAddToShelf(shelf.key)}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-semibold tracking-wide border transition-all duration-300 flex flex-col sm:flex-row items-center justify-center gap-1.5 active:scale-95 ${
                          isSelected
                            ? 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark border-booklyn-amber text-white shadow-md shadow-booklyn-amber/20 font-bold'
                            : 'bg-white/20 dark:bg-white/5 border-white/10 hover:bg-white/35 dark:hover:bg-white/10 text-booklyn-night-100/70 dark:text-booklyn-cream-100'
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{shelf.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tracking Mode Configuration (Configurator Settings) */}
              {existingBook && (
                <div className="glass-panel rounded-2xl p-4.5 border border-white/20 dark:border-white/10 space-y-3 bg-white/10 dark:bg-white/5 shadow-sm">
                  <div>
                    <h4 className="font-serif text-sm font-bold text-booklyn-night-300 dark:text-white leading-none">
                      Progress Configuration
                    </h4>
                    <p className="text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 font-semibold uppercase tracking-wider mt-1">
                      Choose how you prefer to track this volume
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-1 bg-black/10 dark:bg-white/5 p-1 rounded-xl">
                    {[
                      { id: 'pages', label: 'Pages' },
                      { id: 'percentage', label: 'Percent' },
                      { id: 'chapters', label: 'Chapters' },
                    ].map(tab => {
                      const active = trackMode === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setTrackMode(tab.id)}
                          className={`py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all ${
                            active
                              ? 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white'
                              : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:text-booklyn-night-300 dark:hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {trackMode === 'chapters' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-between pt-2 overflow-hidden text-xs"
                    >
                      <span className="text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 font-semibold">
                        Total Chapters in Book:
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={totalChapters}
                        onChange={(e) => setTotalChapters(Math.max(1, Number(e.target.value)))}
                        className="w-20 px-2 py-1 glass-input text-right text-xs"
                      />
                    </motion.div>
                  )}
                </div>
              )}

              {/* Synopsis/Description Segment */}
              <div className="space-y-2">
                <h4 className="font-serif text-lg font-bold text-booklyn-night-300 dark:text-white">
                  Book Synopsis
                </h4>
                {loadingDesc ? (
                  <div className="space-y-2.5 py-2 animate-pulse">
                    <div className="h-4 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-full" />
                    <div className="h-4 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-5/6" />
                    <div className="h-4 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-11/12" />
                    <div className="h-4 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-2/3" />
                  </div>
                ) : (
                  <p className="text-sm text-booklyn-night-100/70 dark:text-booklyn-cream-200/60 leading-relaxed font-sans text-justify">
                    {description || 'No summary is currently available for this edition.'}
                  </p>
                )}
              </div>

              {/* Custom Reviews & Ratings card with Auto-Saving */}
              {existingBook && (
                <div className="glass-panel rounded-2xl p-4.5 border border-white/20 dark:border-white/10 space-y-4 shadow-md bg-white/10 dark:bg-white/5 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-20 h-20 bg-booklyn-amber/5 rounded-full blur-xl pointer-events-none" />

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-serif text-sm md:text-base font-bold text-booklyn-night-300 dark:text-white leading-snug">
                        Your Review & Rating
                      </h4>
                      
                      {/* Glow Status Auto-saving indicator pill */}
                      <div className="mt-1 flex items-center gap-1.5">
                        {saveStatus === 'saving' && (
                          <span className="text-[9px] font-bold text-sky-500 flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            <span>Saving Review...</span>
                          </span>
                        )}
                        {saveStatus === 'saved' && (
                          <span className="text-[9px] font-bold text-emerald-500">
                            ● Auto-saved
                          </span>
                        )}
                        {saveStatus === 'error' && (
                          <span className="text-[9px] font-bold text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" />
                            <span>Save failed</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <RatingPicker
                      rating={userRating}
                      onChange={setUserRating}
                      size={4.5}
                    />
                  </div>

                  <div className="space-y-1">
                    <textarea
                      rows="3"
                      placeholder="Write down notes, quotes, or a full review of this book..."
                      value={userReview}
                      onChange={(e) => setUserReview(e.target.value)}
                      className="w-full p-3 glass-input text-xs resize-none rounded-xl font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Extended Details Table */}
              <div className="glass-panel rounded-2xl p-4 border border-white/20 dark:border-white/10 text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-booklyn-cream-300/20 dark:border-booklyn-night-100/10">
                  <span className="text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Publisher</span>
                  <span className="font-medium text-right max-w-[240px] truncate">{book.publisher || 'Unknown'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-booklyn-cream-300/20 dark:border-booklyn-night-100/10">
                  <span className="text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Language</span>
                  <span className="font-medium">{book.language || 'English'}</span>
                </div>
                {book.ratings_average && (
                  <div className="flex justify-between py-1 border-b border-booklyn-cream-300/20 dark:border-booklyn-night-100/10">
                    <span className="text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Average Rating</span>
                    <span className="font-medium flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-booklyn-amber text-booklyn-amber" />
                      {book.ratings_average} / 5
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Gutenberg Catalog</span>
                  {String(book.id).startsWith('pdf-') ? (
                    <span className="font-semibold text-emerald-500">Local Archive</span>
                  ) : (
                    <span className="font-semibold text-booklyn-amber dark:text-booklyn-amber-light">
                      In-App Sanctuary Only
                    </span>
                  )}
                </div>
              </div>

              {/* Divider */}
              <hr className="border-booklyn-cream-300/30 dark:border-booklyn-night-100/10 my-6" />

              {/* Community Reviews Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-lg font-bold text-booklyn-night-300 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-booklyn-amber" />
                    <span>Community Reviews</span>
                  </h4>
                  <span className="px-2.5 py-1 text-xs font-bold bg-booklyn-cream-200 dark:bg-booklyn-night-100 rounded-full text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
                    {totalCount} reviews
                  </span>
                </div>

                {/* Rating Distribution Breakdown Summary Card */}
                {totalCount > 0 ? (
                  <div className="glass-panel rounded-2xl p-4 border border-white/20 dark:border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-4 bg-white/5">
                    {/* Left: Overall stats */}
                    <div className="sm:col-span-4 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-booklyn-cream-300/20 dark:border-booklyn-night-100/10 pb-4 sm:pb-0 sm:pr-4">
                      <span className="text-4xl font-serif font-black text-booklyn-night-300 dark:text-white animate-pulse-slow">
                        {(() => {
                          const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                          return isNaN(avg) ? '0.0' : avg.toFixed(1);
                        })()}
                      </span>
                      <div className="flex items-center gap-0.5 my-1">
                        {/* 5 mini stars */}
                        {Array.from({ length: 5 }).map((_, i) => {
                          const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                          return (
                            <Star 
                              key={i} 
                              className={`w-3.5 h-3.5 ${
                                i < Math.round(avg || 0)
                                  ? 'fill-booklyn-amber text-booklyn-amber'
                                  : 'text-booklyn-night-100/20 dark:text-booklyn-cream-200/10'
                              }`} 
                            />
                          );
                        })}
                      </div>
                      <span className="text-[10px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 uppercase tracking-widest text-center mt-1">
                        Average Rating
                      </span>
                    </div>

                    {/* Right: Star breakdown progress bars */}
                    <div className="sm:col-span-8 space-y-1.5 justify-center flex flex-col">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = reviews.filter(r => r.rating === stars).length;
                        const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                        return (
                          <div key={stars} className="flex items-center gap-2 text-[10px] font-semibold text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
                            <span className="w-3 text-right">{stars}★</span>
                            <div className="flex-1 h-2 bg-booklyn-cream-300/40 dark:bg-booklyn-night-100/30 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5 }}
                                className="h-full bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark rounded-full"
                              />
                            </div>
                            <span className="w-5 text-left">{Math.round(pct)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 glass-panel rounded-2xl border border-white/20 dark:border-white/10 bg-white/5">
                    <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">
                      No community reviews yet. Be the first to share your thoughts!
                    </p>
                  </div>
                )}

                {/* Verified Reader Form/Lock Gate */}
                <div className="space-y-4">
                  {/* Verified gate check */}
                  {(() => {
                    const completed = existingBook && existingBook.status === 'completed';
                    const hasReviewed = reviews.some(r => r.user_id === currentUserId);
                    
                    if (!existingBook) {
                      return (
                        <div className="glass-panel rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5 text-xs text-amber-600 dark:text-amber-400 flex gap-2.5 items-start shadow-inner">
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          <div>
                            <p className="font-bold">Book Not in Library</p>
                            <p className="mt-1 leading-normal opacity-90">
                              Please add this book to your library and mark it as completed to write a community review.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (!completed) {
                      return (
                        <div className="glass-panel rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5 text-xs text-amber-600 dark:text-amber-400 flex gap-2.5 items-start shadow-inner">
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          <div>
                            <p className="font-bold">Verified Reader Gate Lock</p>
                            <p className="mt-1 leading-normal opacity-90">
                              ⚠️ Only verified readers who have completed this book can write a review. 
                              Current progress: <span className="font-extrabold">{progressPct}%</span>
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (hasReviewed) {
                      return (
                        <div className="glass-panel rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-600 dark:text-emerald-400 flex gap-2.5 items-center shadow-inner">
                          <CheckCircle className="w-5 h-5 flex-shrink-0" />
                          <div>
                            <p className="font-bold">Community Review Submitted</p>
                            <p className="leading-normal opacity-90">
                              You have shared your verified review for this book.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    // Display write-review form
                    return (
                      <div className="glass-panel rounded-2xl p-4.5 border border-white/20 dark:border-white/10 space-y-4 bg-white/10 dark:bg-white/5 relative">
                        <div className="flex items-center justify-between">
                          <h5 className="font-serif text-sm font-bold text-booklyn-night-300 dark:text-white">
                            Write a Community Review
                          </h5>
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" />
                            Verified Reader
                          </span>
                        </div>

                        {submitError && (
                          <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 flex gap-1.5 items-center">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{submitError}</span>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Your Rating:</span>
                            <RatingPicker rating={newReviewRating} onChange={setNewReviewRating} size={5} />
                          </div>

                          <div className="space-y-1 relative">
                            <textarea
                              rows="3"
                              placeholder="Share your detailed reading experience with the community..."
                              value={newReviewText}
                              onChange={(e) => {
                                setNewReviewText(e.target.value);
                                setSubmitError(null);
                              }}
                              className="w-full p-3 glass-input text-xs resize-none rounded-xl font-medium"
                            />
                            <div className="flex justify-between items-center text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 font-semibold px-1 mt-1">
                              <span>Min. 10 characters</span>
                              <span className={newReviewText.length >= 10 ? 'text-emerald-500' : 'text-booklyn-night-100/40'}>
                                {newReviewText.length} characters
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={newReviewRating === 0 || newReviewText.length < 10 || submittingReview}
                            onClick={handleReviewSubmit}
                            className={`w-full py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 ${
                              newReviewRating === 0 || newReviewText.length < 10
                                ? 'bg-booklyn-cream-300/40 dark:bg-booklyn-night-100/20 text-booklyn-night-100/30 dark:text-booklyn-cream-200/20 border border-white/5 cursor-not-allowed shadow-none'
                                : 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white hover:brightness-105 active:scale-[0.98]'
                            }`}
                          >
                            {submittingReview ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Submitting...</span>
                              </>
                            ) : (
                              <span>Publish Review</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Filter and Sort Tabs for Community Feed */}
                {totalCount > 0 && (
                  <div className="flex items-center justify-between border-b border-booklyn-cream-300/20 dark:border-booklyn-night-100/10 pb-2">
                    <span className="text-xs font-serif font-bold text-booklyn-night-300 dark:text-white">Reviews Feed</span>
                    <div className="flex gap-1.5">
                      {[
                        { id: 'helpful', label: 'Most Helpful' },
                        { id: 'recent', label: 'Recent' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => handleSortChange(tab.id)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                            sortBy === tab.id
                              ? 'bg-booklyn-cream-200 dark:bg-booklyn-night-100 border-booklyn-cream-300 dark:border-booklyn-night-200 text-booklyn-night-300 dark:text-white'
                              : 'border-transparent text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:text-booklyn-night-300 dark:hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews List & Skeleton Loaders */}
                <div className="space-y-4">
                  {reviewsLoading && reviews.length === 0 ? (
                    // Initial load skeleton cards
                    Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="glass-panel rounded-2xl p-4 border border-white/10 animate-pulse space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-booklyn-cream-300 dark:bg-booklyn-night-100" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-1/3" />
                            <div className="h-2 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-1/4" />
                          </div>
                        </div>
                        <div className="h-2.5 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-full" />
                        <div className="h-2.5 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-5/6" />
                      </div>
                    ))
                  ) : (
                    <AnimatePresence initial={false}>
                      {reviews.map((rev) => {
                        const isMe = rev.user_id === currentUserId;
                        const isEditing = editingReviewId === rev.id;
                        const hasLiked = rev.helpful_users?.includes(currentUserId);
                        
                        return (
                          <motion.div
                            key={rev.id}
                            layout
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className={`glass-panel rounded-2xl p-4 border border-white/20 dark:border-white/10 space-y-3 bg-white/5 relative overflow-hidden transition-all ${
                              isMe ? 'ring-1 ring-booklyn-amber/30 bg-booklyn-amber/[0.02]' : ''
                            }`}
                          >
                            {/* Card Header: Avatar & Name */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-full ${rev.user_avatar_color || 'bg-indigo-500'} flex items-center justify-center text-white text-xs font-bold shadow-inner`}>
                                  {rev.user_name?.charAt(0).toUpperCase() || 'R'}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-booklyn-night-300 dark:text-white">
                                      {rev.user_name}
                                    </span>
                                    {isMe && (
                                      <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide bg-booklyn-amber/20 text-booklyn-amber border border-booklyn-amber/30 rounded">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[9px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 font-semibold">
                                    <span>{new Date(rev.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    {rev.verified && (
                                      <>
                                        <span>•</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                          <Check className="w-2.5 h-2.5" />
                                          Verified Reader
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Star counts */}
                              {!isEditing && (
                                <div className="flex items-center gap-0.5">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star 
                                      key={i} 
                                      className={`w-3 h-3 ${
                                        i < rev.rating
                                          ? 'fill-booklyn-amber text-booklyn-amber'
                                          : 'text-booklyn-night-100/20 dark:text-booklyn-cream-200/10'
                                      }`} 
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Editing Review form inside card */}
                            {isEditing ? (
                              <div className="space-y-3 pt-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Rating:</span>
                                  <RatingPicker rating={editRating} onChange={setEditRating} size={4.5} />
                                </div>
                                <textarea
                                  rows="3"
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="w-full p-2.5 glass-input text-xs resize-none rounded-xl font-medium"
                                />
                                <div className="flex justify-end gap-2 text-[10px]">
                                  <button
                                    onClick={() => setEditingReviewId(null)}
                                    className="px-2.5 py-1.5 rounded-lg border border-white/10 text-booklyn-night-100 hover:bg-white/10 dark:text-booklyn-cream-200"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    disabled={editRating === 0 || editText.length < 10}
                                    onClick={() => handleReviewEditSave(rev.id)}
                                    className="px-3 py-1.5 rounded-lg bg-booklyn-amber text-white font-bold disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Read Only review text */
                              <p className="text-xs text-booklyn-night-100/70 dark:text-booklyn-cream-200/70 leading-relaxed font-sans text-justify pl-1">
                                {rev.review_text}
                              </p>
                            )}

                            {/* Action Row: Helpful React button + Edit/Delete */}
                            {!isEditing && (
                              <div className="flex items-center justify-between border-t border-booklyn-cream-300/10 dark:border-booklyn-night-100/10 pt-2.5 text-[10px] font-bold text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleHelpfulToggle(rev.id)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                                    hasLiked
                                      ? 'bg-booklyn-amber/15 border-booklyn-amber/35 text-booklyn-amber'
                                      : 'border-white/10 hover:bg-white/10 text-booklyn-night-100/50 dark:text-booklyn-cream-200/40'
                                  }`}
                                >
                                  <ThumbsUp className={`w-3.5 h-3.5 ${hasLiked ? 'fill-booklyn-amber' : ''}`} />
                                  <span>Helpful ({rev.helpful_users?.length || 0})</span>
                                </motion.button>

                                {isMe && (
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => handleStartEdit(rev)}
                                      className="flex items-center gap-1 hover:text-booklyn-amber transition-colors"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      onClick={() => handleReviewDelete(rev.id)}
                                      className="flex items-center gap-1 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}

                  {/* Load more indicator / pagination controls */}
                  {hasMore && (
                    <button
                      type="button"
                      disabled={reviewsLoading}
                      onClick={handleLoadMore}
                      className="w-full py-2 rounded-xl text-xs font-bold border border-white/20 dark:border-white/10 hover:bg-white/10 active:scale-95 transition-all text-booklyn-night-100 dark:text-booklyn-cream-200 flex items-center justify-center gap-1.5"
                    >
                      {reviewsLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading More...</span>
                        </>
                      ) : (
                        <span>Load More Reviews</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
