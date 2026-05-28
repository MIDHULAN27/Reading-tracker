import React from 'react';
import { motion } from 'framer-motion';
import { Download, Languages, BookOpen, Heart, Plus, Check } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';

export default function BookCard({ book, onSelect, onShelveChange }) {
  const { books, addBook, deleteBook } = useLibraryStore();
  
  // Find if book already exists in local shelf
  const existingBook = books.find(b => b.id === book.id || (b.title === book.title && b.author === book.author));
  const isShelved = !!existingBook;

  // Format download count into a readable number e.g. 10.5k
  const formatDownloads = (num) => {
    if (!num) return '0';
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return String(num);
  };

  const handleQuickAdd = async (e) => {
    e.stopPropagation();
    if (isShelved) {
      // Toggle off / remove from library
      if (confirm(`Remove "${book.title}" from your reading shelves?`)) {
        await deleteBook(existingBook.id);
      }
    } else {
      // Quick add to "Want to Read"
      await addBook({
        ...book,
        status: 'to_read',
        progress: 0,
        rating: 0
      });
    }
    if (onShelveChange) onShelveChange();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      onClick={() => onSelect && onSelect(book)}
      className="group relative cursor-pointer flex flex-col bg-white/5 dark:bg-cozy-night-300/40 hover:bg-white/10 border border-white/5 hover:border-cozy-amber/20 rounded-2xl p-4 overflow-hidden transition-all duration-300 shadow-lg hover:shadow-glow-amber/5"
    >
      {/* Book Cover Container */}
      <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-300">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              // Fallback to gradient if image fails to load
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        
        {/* Fallback Ambient Gradient Cover */}
        <div 
          className={`absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-br ${book.cover_color || 'from-indigo-600 to-indigo-950'} ${book.cover_url ? 'hidden' : 'flex'}`}
        >
          <div className="space-y-1">
            <span className="px-2 py-0.5 text-[8px] uppercase tracking-wider font-bold rounded bg-black/30 text-cozy-cream-200 backdrop-blur-sm self-start inline-block">
              Gutenberg Classic
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-sm tracking-tight text-white leading-tight line-clamp-3">
              {book.title}
            </h3>
            <p className="text-[10px] text-cozy-cream-200/65 font-medium line-clamp-1">
              {book.author}
            </p>
          </div>
        </div>

        {/* Cover Hover Action Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 backdrop-blur-xs">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect && onSelect(book);
            }}
            className="p-3 rounded-full bg-white text-black hover:bg-cozy-amber hover:text-white transition-all transform scale-75 group-hover:scale-100 duration-300"
            title="View Details"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleQuickAdd}
            className={`p-3 rounded-full transition-all transform scale-75 group-hover:scale-100 duration-300 ${isShelved ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-cozy-amber text-white hover:bg-cozy-amber-dark'}`}
            title={isShelved ? 'Remove from Shelf' : 'Add to Shelf'}
          >
            {isShelved ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>

        {/* Language Badge */}
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
          <Languages className="w-2.5 h-2.5" />
          {book.language || 'EN'}
        </div>
      </div>

      {/* Book Metadata details */}
      <div className="mt-4 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <h4 className="font-serif font-bold text-sm leading-tight text-cozy-night-100 dark:text-cozy-cream-100 line-clamp-1 group-hover:text-cozy-amber transition-colors">
            {book.title}
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
            {book.author}
          </p>
        </div>

        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5 font-medium" title="Downloads Count">
            <Download className="w-3.5 h-3.5 text-cozy-amber" />
            <span>{formatDownloads(book.download_count)}</span>
          </div>

          <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/5 text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 max-w-[100px] truncate">
            {book.genre || 'Classic'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
