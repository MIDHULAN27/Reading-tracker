import React, { useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import BookDetailSlideOver from './BookDetailSlideOver';
import { Sparkles, Bookmark, Star, Plus, Check } from 'lucide-react';
import { motion } from 'framer-motion';

// Master list of premium recommended books by genre
const RECOMMENDED_POOL = {
  'Self-Help': [
    { id: 'rec-sh-1', title: 'Deep Work', author: 'Cal Newport', pages: 304, genre: 'Self-Help', cover_color: 'from-blue-600 to-indigo-900', publisher: 'Grand Central Publishing' },
    { id: 'rec-sh-2', title: 'Show Your Work!', author: 'Austin Kleon', pages: 224, genre: 'Self-Help', cover_color: 'from-orange-500 to-amber-700', publisher: 'Workman Publishing' },
    { id: 'rec-sh-3', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', pages: 499, genre: 'Self-Help', cover_color: 'from-teal-600 to-emerald-800', publisher: 'Farrar, Straus and Giroux' },
  ],
  'Fiction': [
    { id: 'rec-f-1', title: 'The Alchemist', author: 'Paulo Coelho', pages: 208, genre: 'Fiction', cover_color: 'from-amber-600 to-red-800', publisher: 'HarperOne' },
    { id: 'rec-f-2', title: 'Normal People', author: 'Sally Rooney', pages: 273, genre: 'Fiction', cover_color: 'from-pink-600 to-purple-800', publisher: 'Hogarth' },
    { id: 'rec-f-3', title: 'Where the Crawdads Sing', author: 'Delia Owens', pages: 384, genre: 'Fiction', cover_color: 'from-green-600 to-teal-800', publisher: 'G.P. Putnam\'s Sons' },
  ],
  'Sci-Fi': [
    { id: 'rec-sf-1', title: 'Project Hail Mary', author: 'Andy Weir', pages: 476, genre: 'Sci-Fi', cover_color: 'from-purple-600 to-blue-800', publisher: 'Ballantine Books' },
    { id: 'rec-sf-2', title: 'Neuromancer', author: 'William Gibson', pages: 271, genre: 'Sci-Fi', cover_color: 'from-slate-700 to-zinc-950', publisher: 'Ace Books' },
  ],
  'Fantasy': [
    { id: 'rec-ft-1', title: 'The Name of the Wind', author: 'Patrick Rothfuss', pages: 662, genre: 'Fantasy', cover_color: 'from-rose-600 to-amber-950', publisher: 'DAW Books' },
    { id: 'rec-ft-2', title: 'The Hobbit', author: 'J.R.R. Tolkien', pages: 310, genre: 'Fantasy', cover_color: 'from-emerald-700 to-yellow-950', publisher: 'George Allen & Unwin' },
  ]
};

const DEFAULT_RECOMMENDATIONS = [
  { id: 'rec-def-1', title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', pages: 96, genre: 'Classic', cover_color: 'from-blue-500 to-cyan-800', publisher: 'Reynal & Hitchcock' },
  { id: 'rec-def-2', title: 'Atomic Habits', author: 'James Clear', pages: 320, genre: 'Self-Help', cover_color: 'from-amber-500 to-orange-700', publisher: 'Avery' },
  { id: 'rec-def-3', title: 'The Midnight Library', author: 'Matt Haig', pages: 288, genre: 'Fiction', cover_color: 'from-indigo-600 to-indigo-950', publisher: 'Viking' },
];

export default function RecommendationsFeed() {
  const { books, addBook } = useLibraryStore();
  const [selectedBook, setSelectedBook] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [addedIds, setAddedIds] = useState([]);

  // Generate recommendations based on library contents
  const getCuratedRecommendations = () => {
    if (books.length === 0) return DEFAULT_RECOMMENDATIONS;

    // Aggregate library genres to find favorite
    const genreTallies = {};
    books.forEach(b => {
      if (b.genre) {
        genreTallies[b.genre] = (genreTallies[b.genre] || 0) + 1;
      }
    });

    // Find favorite genre
    let favGenre = 'Self-Help';
    let maxTally = 0;
    Object.entries(genreTallies).forEach(([genre, count]) => {
      if (count > maxTally) {
        maxTally = count;
        favGenre = genre;
      }
    });

    // Retrieve pool matching favGenre, fallback to Sci-Fi/Fiction pools
    const matchedPool = RECOMMENDED_POOL[favGenre] || RECOMMENDED_POOL['Fiction'];
    
    // Filters out recommendations that are already on library shelves!
    const filteredPool = matchedPool.filter(rec => 
      !books.some(b => b.title.toLowerCase() === rec.title.toLowerCase())
    );

    if (filteredPool.length === 0) {
      // If all are already added, return general defaults that aren't added
      return DEFAULT_RECOMMENDATIONS.filter(rec => 
        !books.some(b => b.title.toLowerCase() === rec.title.toLowerCase())
      ).slice(0, 3);
    }

    return filteredPool.slice(0, 3);
  };

  const curatedList = getCuratedRecommendations();

  const handleQuickAdd = async (book, e) => {
    e.stopPropagation();
    try {
      await addBook({
        ...book,
        status: 'to_read',
        progress: 0
      });
      setAddedIds(prev => [...prev, book.id]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCardClick = (book) => {
    setSelectedBook(book);
    setIsSlideOverOpen(true);
  };

  if (curatedList.length === 0) return null;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-cozy-amber animate-pulse-subtle" />
        <h3 className="font-serif text-xl font-bold tracking-tight text-cozy-night-300 dark:text-white">Curated for You</h3>
      </div>

      {/* Horizontal deck layout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {curatedList.map((book) => {
          const isAdded = addedIds.includes(book.id) || books.some(b => b.title.toLowerCase() === book.title.toLowerCase());
          return (
            <motion.div
              key={book.id}
              onClick={() => handleCardClick(book)}
              whileHover={{ y: -4 }}
              className="glass-panel rounded-2xl p-4 border border-white/10 hover:border-cozy-amber/25 cursor-pointer flex flex-col justify-between h-44 relative overflow-hidden group select-none shadow-sm"
            >
              {/* Subtle background glow */}
              <div className={`absolute top-[-40px] right-[-40px] w-24 h-24 rounded-full bg-gradient-to-br ${book.cover_color} opacity-[0.04] blur-xl`} />

              <div className="flex gap-3">
                {/* Visual cover thumb */}
                <div className={`w-14 h-20 rounded-xl bg-gradient-to-br ${book.cover_color} p-2 flex flex-col justify-between text-white flex-shrink-0 shadow`}>
                  <Bookmark className="w-3.5 h-3.5 self-end opacity-35" />
                  <p className="font-serif text-[8px] font-bold line-clamp-3 leading-snug">{book.title}</p>
                </div>

                <div className="min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-cozy-amber dark:text-cozy-amber-light">
                    {book.genre}
                  </span>
                  <h4 className="font-serif font-bold text-sm leading-snug tracking-tight truncate group-hover:text-cozy-amber transition-colors mt-0.5">
                    {book.title}
                  </h4>
                  <p className="text-xs text-cozy-night-100/50 dark:text-cozy-cream-200/40 truncate mt-0.5">
                    by {book.author}
                  </p>
                </div>
              </div>

              {/* Bottom quick shelve row */}
              <div className="flex justify-between items-center pt-3 border-t border-cozy-cream-300/20 dark:border-cozy-night-100/10 mt-3">
                <span className="text-[10px] text-cozy-night-100/40 dark:text-cozy-cream-200/45 font-semibold uppercase">{book.pages} pages</span>
                
                {/* Shelve button */}
                <button
                  onClick={(e) => handleQuickAdd(book, e)}
                  disabled={isAdded}
                  className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1 ${
                    isAdded
                      ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                      : 'bg-white/25 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 text-cozy-night-200 dark:text-white'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>On Shelf</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>Add Shelf</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detail Slideover wrapper */}
      <BookDetailSlideOver
        book={selectedBook}
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
      />
    </div>
  );
}
