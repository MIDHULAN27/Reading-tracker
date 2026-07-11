import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { booksApi } from '../api/booksApi';
import { papersApi } from '../api/papersApi';
import useBooks from '../hooks/useBooks';
import usePapers from '../hooks/usePapers';
import { useLibraryStore } from '../store/useLibraryStore';
import { usePaperStore } from '../store/usePaperStore';
import { useAuthStore } from '../store/useAuthStore';
import { useGuestGuard } from '../hooks/useGuestGuard';
import BookDetailSlideOver from '../components/BookDetailSlideOver';
import BookCard from '../components/BookCard';
import { 
  Search, Compass, Star, Bookmark, BookOpen, Plus, Check, Trash2, 
  Clock, ArrowRight, ChevronLeft, ChevronRight, SlidersHorizontal, 
  X, Filter, Loader2, Sparkles, FileText, Quote, Award, Unlock, ExternalLink, Download
} from 'lucide-react';

const HOT_SEARCHES = ['The Hobbit', 'Atomic Habits', 'Project Hail Mary', 'Pride and Prejudice', 'Dune'];
const POPULAR_GENRES = ['Fiction', 'Fantasy', 'Sci-Fi', 'Mystery', 'Biography', 'Self-Help', 'Classic'];

const PAPERS_HOT_SEARCHES = ['Attention is all you need', 'Deep learning', 'Quantum computing', 'BERT transformers', 'Generative adversarial'];

export default function Discover() {
  const navigate = useNavigate();
  const guard = useGuestGuard();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('books'); // 'books' or 'papers'
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentPaperSearches, setRecentPaperSearches] = useState([]);

  // Spotify/Netflix 12 book categories
  const [categoriesData, setCategoriesData] = useState({
    trending: { title: 'Trending Reads', books: [], loading: true },
    free: { title: 'Free Classics', books: [], loading: true },
    classics: { title: 'Timeless Masterpieces', books: [], loading: true },
    fantasy: { title: 'Fantasy & Magic', books: [], loading: true },
    scifi: { title: 'Science Fiction', books: [], loading: true },
    mystery: { title: 'Mystery & Detective', books: [], loading: true },
    romance: { title: 'Romance Classics', books: [], loading: true },
    philosophy: { title: 'Philosophy', books: [], loading: true },
    horror: { title: 'Horror', books: [], loading: true },
    adventure: { title: 'Adventure', books: [], loading: true },
    selfHelp: { title: 'Self Help', books: [], loading: true },
    historical: { title: 'Historical Fiction', books: [], loading: true },
  });

  const scrollRefs = useRef({});
  
  // DOI Resolver states
  const [doiQuery, setDoiQuery] = useState('');
  const [resolvingDoi, setResolvingDoi] = useState(false);
  const [doiResult, setDoiResult] = useState(null);
  const [doiError, setDoiError] = useState('');

  const handleResolveDoi = async (e, customDoi = null) => {
    if (e) e.preventDefault();
    const targetDoi = customDoi || doiQuery;
    if (!targetDoi || targetDoi.trim() === '') {
      setDoiError('Please provide a valid DOI string to resolve.');
      return;
    }
    
    setResolvingDoi(true);
    setDoiError('');
    setDoiResult(null);
    
    try {
      const result = await papersApi.resolveDoi(targetDoi);
      if (result) {
        setDoiResult(result);
      } else {
        setDoiError('Could not resolve DOI. Please verify that the DOI exists and is open access.');
      }
    } catch (err) {
      setDoiError(err.message || 'An error occurred during DOI resolution.');
    } finally {
      setResolvingDoi(false);
    }
  };
  
  // Filters (for books)
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedAuthor, setSelectedAuthor] = useState('All');
  const [uniqueAuthors, setUniqueAuthors] = useState([]);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Shell alignment details
  const [selectedBook, setSelectedBook] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [activeShelvingBookId, setActiveShelvingBookId] = useState(null);

  // Store hooks
  const { books, addBook, updateBook } = useLibraryStore();
  const { savedPapers, bookmarkPaper, unbookmarkPaper, fetchSavedPapers } = usePaperStore();

  // Custom hooks
  const {
    books: bookResults,
    loading: bookLoading,
    loadingMore: bookLoadingMore,
    error: bookError,
    hasMore: bookHasMore,
    searchSource: bookSearchSource,
    trendingBooks,
    loadingTrending,
    recommendedBooks,
    loadingRecommended,
    fetchTrending,
    fetchRecommendedClassics,
    searchBooksDebounced,
    loadNextPage: loadNextBookPage,
    resetSearch: resetBookSearch
  } = useBooks();

  const {
    selectedRegistry,
    setSelectedRegistry,
    papers: paperResults,
    loading: paperLoading,
    loadingMore: paperLoadingMore,
    error: paperError,
    hasMore: paperHasMore,
    searchSource: paperSearchSource,
    popularPapers,
    loadingPopular: loadingPopularPapers,
    fetchPopular,
    searchPapersDebounced,
    loadNextPage: loadNextPaperPage,
    resetSearch: resetPaperSearch
  } = usePapers();

  // Scroll Container Refs
  const trendingScrollRef = useRef(null);
  const recommendedScrollRef = useRef(null);
  const papersScrollRef = useRef(null);
  const observerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load initial settings, recent searches, trending books, and curated recommendations
  useEffect(() => {
    const cachedSearches = localStorage.getItem('booklyn_recent_searches');
    if (cachedSearches) {
      setRecentSearches(JSON.parse(cachedSearches));
    }

    const cachedPaperSearches = localStorage.getItem('booklyn_recent_paper_searches');
    if (cachedPaperSearches) {
      setRecentPaperSearches(JSON.parse(cachedPaperSearches));
    }

    // Fetch initial recommendations & trending rows via hooks
    fetchTrending();
    fetchRecommendedClassics();
    fetchPopular(10);

    // Concurrently load the 10 legal open-source book categories from our backend API
    async function loadCategories() {
      const fetchAndSet = async (key, endpoint, genre = null) => {
        try {
          const url = genre ? `/api/books/category/${encodeURIComponent(genre)}` : `/api/books/${endpoint}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            setCategoriesData(prev => ({
              ...prev,
              [key]: { ...prev[key], books: data, loading: false }
            }));
          } else {
            throw new Error(`Failed to load ${key}`);
          }
        } catch (err) {
          console.warn(`Failed to fetch category ${key}:`, err);
          setCategoriesData(prev => ({
            ...prev,
            [key]: { ...prev[key], books: [], loading: false }
          }));
        }
      };

      fetchAndSet('trending', 'trending');
      fetchAndSet('free', 'free');
      fetchAndSet('classics', 'classics');
      fetchAndSet('fantasy', null, 'Fantasy');
      fetchAndSet('scifi', null, 'Sci-Fi');
      fetchAndSet('mystery', null, 'Mystery');
      fetchAndSet('romance', null, 'Romance');
      fetchAndSet('philosophy', null, 'Philosophy');
      fetchAndSet('horror', null, 'Horror');
      fetchAndSet('adventure', null, 'Adventure');
      fetchAndSet('selfHelp', null, 'Self-Help');
      fetchAndSet('historical', null, 'Historical-Fiction');
    }

    loadCategories();

    // Fetch saved papers if authenticated
    if (user) {
      fetchSavedPapers();
    }
  }, [fetchTrending, fetchRecommendedClassics, fetchPopular, fetchSavedPapers, user]);

  // Reset page, results, and query when switching tabs to avoid UI flashes
  useEffect(() => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setDoiQuery('');
    setDoiResult(null);
    setDoiError('');
  }, [activeTab]);

  // Handle auto-completion suggestions in real-time as user types
  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    // Fetch lightweight suggestions from correct API
    const suggestionTimer = setTimeout(async () => {
      try {
        if (activeTab === 'books') {
          const response = await booksApi.searchBooks(query, 1, 5);
          if (response.books) {
            setSuggestions(response.books.slice(0, 5));
          }
        } else {
          const response = await papersApi.searchPapers(query, 1, 5, selectedRegistry);
          if (response.papers) {
            setSuggestions(response.papers.slice(0, 5));
          }
        }
      } catch (err) {
        console.warn('Autocomplete lookup error:', err.message);
      }
    }, 300);

    return () => clearTimeout(suggestionTimer);
  }, [query, activeTab, selectedRegistry]);

  // Watch for main query input changes and trigger debounced search via custom hooks
  useEffect(() => {
    if (query.trim() === '') {
      resetBookSearch();
      resetPaperSearch();
      return;
    }

    if (activeTab === 'books') {
      searchBooksDebounced(query, 500);
      resetPaperSearch();
    } else {
      searchPapersDebounced(query, 500);
      resetBookSearch();
    }

    // Debounced trigger to save recent searches
    const recentTimer = setTimeout(() => {
      saveRecentSearch(query);
    }, 1000);

    return () => clearTimeout(recentTimer);
  }, [query, activeTab, searchBooksDebounced, searchPapersDebounced, resetBookSearch, resetPaperSearch]);

  // Extract unique authors from the search results to feed filters (books only)
  useEffect(() => {
    if (activeTab === 'books' && bookResults.length > 0) {
      const authors = bookResults
        .map(b => b.author)
        .filter((author, index, self) => author && self.indexOf(author) === index)
        .sort();
      setUniqueAuthors(authors);
    } else {
      setUniqueAuthors([]);
    }
    setSelectedAuthor('All');
  }, [bookResults, activeTab]);

  // Load more pages on scroll (Infinite Scrolling observer logic)
  useEffect(() => {
    const hasMore = activeTab === 'books' ? bookHasMore : paperHasMore;
    const currentResults = activeTab === 'books' ? bookResults : paperResults;
    const currentLoading = activeTab === 'books' ? bookLoading : paperLoading;
    const currentLoadingMore = activeTab === 'books' ? bookLoadingMore : paperLoadingMore;

    if (currentLoading || currentLoadingMore || !hasMore || currentResults.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          if (activeTab === 'books') {
            loadNextBookPage();
          } else {
            loadNextPaperPage();
          }
        }
      },
      { threshold: 0.8 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
      }
    };
  }, [
    activeTab,
    bookHasMore,
    paperHasMore,
    bookResults,
    paperResults,
    bookLoading,
    paperLoading,
    bookLoadingMore,
    paperLoadingMore,
    loadNextBookPage,
    loadNextPaperPage
  ]);

  // Helper to save a query term inside recent searches
  const saveRecentSearch = (term) => {
    if (!term || term.trim().length < 3) return;
    const cleanTerm = term.trim();
    
    if (activeTab === 'books') {
      setRecentSearches(prev => {
        const filtered = prev.filter(t => t.toLowerCase() !== cleanTerm.toLowerCase());
        const updated = [cleanTerm, ...filtered].slice(0, 8);
        localStorage.setItem('booklyn_recent_searches', JSON.stringify(updated));
        return updated;
      });
    } else {
      setRecentPaperSearches(prev => {
        const filtered = prev.filter(t => t.toLowerCase() !== cleanTerm.toLowerCase());
        const updated = [cleanTerm, ...filtered].slice(0, 8);
        localStorage.setItem('booklyn_recent_paper_searches', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleClearRecent = () => {
    if (activeTab === 'books') {
      localStorage.removeItem('booklyn_recent_searches');
      setRecentSearches([]);
    } else {
      localStorage.removeItem('booklyn_recent_paper_searches');
      setRecentPaperSearches([]);
    }
  };

  const handleHotSearchClick = (term) => {
    setQuery(term);
    setShowSuggestions(false);
  };

  const handleBookClick = (book) => {
    navigate(`/book/${book.id}`);
  };

  // Safe Add/Move to shelf handler
  const handleShelveBook = async (book, status) => {
    if (guard('Shelve Book')) return;
    setActiveShelvingBookId(null);
    try {
      const existing = books.find(b => {
        const bTitle = (b.title || '').toLowerCase();
        const bAuthor = (b.author || '').toLowerCase();
        const bookTitle = (book.title || '').toLowerCase();
        const bookAuthor = (book.author || '').toLowerCase();
        return bTitle === bookTitle && bAuthor === bookAuthor;
      });
      
      if (existing) {
        // Move existing shelf status
        await updateBook(existing.id, { 
          status,
          progress: status === 'completed' ? existing.pages : existing.progress
        });
      } else {
        const isFreeBook = book && !(book.googlebooks_id && !book.openlibrary_id && !book.has_pdf);
        if (!isFreeBook) {
          alert('Only free edition books (from Project Gutenberg or local uploads) can be added to your library.');
          return;
        }
        // Add fresh book data
        const bookData = {
          ...book,
          status,
          progress: status === 'completed' ? book.pages : 0
        };
        await addBook(bookData);
      }
    } catch (err) {
      console.error('Error shelving book:', err);
      alert(import.meta.env.DEV ? `Error shelving book: ${err.message}` : 'Failed to add book to library.');
    }
  };

  // Bookmark / Unbookmark research papers
  const handleToggleBookmarkPaper = async (e, paper) => {
    e.stopPropagation();
    e.preventDefault();
    if (guard('Bookmark Research Paper')) return;
    try {
      const bookmarked = savedPapers.some(p => p.id === paper.id);
      if (bookmarked) {
        await unbookmarkPaper(paper.id);
      } else {
        await bookmarkPaper(paper);
      }
    } catch (err) {
      console.error('Failed toggling bookmark on paper:', err);
    }
  };

  // Netflix Scroll handlers
  const scrollCarousel = (key, direction) => {
    const element = typeof key === 'string' ? scrollRefs.current[key] : key?.current;
    if (element) {
      const { scrollLeft, clientWidth } = element;
      const scrollTo = direction === 'left' 
        ? scrollLeft - clientWidth * 0.75 
        : scrollLeft + clientWidth * 0.75;
      element.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const handleCategoryTitleClick = (title, key) => {
    const genreMappings = {
      trending: 'Popular Classics',
      free: 'Free Books',
      classics: 'Classics',
      fantasy: 'Fantasy',
      scifi: 'Science Fiction',
      mystery: 'Mystery',
      romance: 'Romance',
      philosophy: 'Philosophy',
      horror: 'Horror',
      adventure: 'Adventure',
      selfHelp: 'Self-Help',
      historical: 'History'
    };
    const searchGenre = genreMappings[key] || title;
    setQuery(searchGenre);
  };

  // Smart Client-side Duplicate Cleaner and Daily Shuffler
  // Ensures absolutely no duplicates across categories, shuffles them daily dynamically,
  // and yields a stunning personalized experience.
  const cleanCategoriesData = React.useMemo(() => {
    const seenIds = new Set();
    const seenTitles = new Set();
    const cleanData = {};

    const categoryOrder = [
      'trending', 'free', 'classics', 'fantasy', 'scifi', 
      'mystery', 'romance', 'philosophy', 'horror', 
      'adventure', 'selfHelp', 'historical'
    ];

    // Simple deterministic daily shuffler based on date
    const today = new Date();
    const dailySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

    const shuffleWithSeed = (array, seed) => {
      let m = array.length, t, i;
      let rand = () => {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };
      while (m) {
        i = Math.floor(rand() * m--);
        t = array[m];
        array[m] = array[i];
        array[i] = t;
      }
      return array;
    };

    categoryOrder.forEach(key => {
      const cat = categoriesData[key];
      if (!cat) return;

      const uniqueBooks = [];
      if (cat.books) {
        cat.books.forEach(book => {
          const titleNorm = book.title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
          const authorNorm = book.author ? book.author.toLowerCase().replace(/[^a-z0-9]/g, '').trim() : '';
          const compositeKey = `${titleNorm}-${authorNorm}`;
          
          if (!seenIds.has(book.id) && !seenTitles.has(compositeKey)) {
            seenIds.add(book.id);
            seenTitles.add(compositeKey);
            uniqueBooks.push(book);
          }
        });
      }

      // Shuffle books daily to keep the discover page fresh
      let shuffledBooks = [...uniqueBooks];
      shuffledBooks = shuffleWithSeed(shuffledBooks, dailySeed + key.charCodeAt(0));

      cleanData[key] = {
        ...cat,
        books: shuffledBooks
      };
    });

    return cleanData;
  }, [categoriesData]);

  // Client side filters application (for books only)
  const filteredResults = bookResults.filter(book => {
    const genreMatch = selectedGenre === 'All' || (book.genre && book.genre.toLowerCase().includes(selectedGenre.toLowerCase()));
    const authorMatch = selectedAuthor === 'All' || book.author === selectedAuthor;
    return genreMatch && authorMatch;
  });

  const currentRecentSearches = activeTab === 'books' ? recentSearches : recentPaperSearches;
  const currentHotSearches = activeTab === 'books' ? HOT_SEARCHES : PAPERS_HOT_SEARCHES;
  const currentError = activeTab === 'books' ? bookError : paperError;
  const currentLoading = activeTab === 'books' ? bookLoading : paperLoading;
  const currentLoadingMore = activeTab === 'books' ? bookLoadingMore : paperLoadingMore;
  const currentHasMore = activeTab === 'books' ? bookHasMore : paperHasMore;
  const currentResults = activeTab === 'books' ? filteredResults : paperResults;
  const currentSearchSource = activeTab === 'books' ? bookSearchSource : paperSearchSource;

  return (
    <div className="space-y-8 min-h-full pb-20 px-1 relative">
      {/* Visual Ambient Glows in Background */}
      <div className="absolute top-[-20%] right-[-10%] w-[350px] h-[350px] rounded-full bg-booklyn-amber/5 blur-3xl pointer-events-none" />
      <div className="absolute top-[40%] left-[-15%] w-[400px] h-[400px] rounded-full bg-booklyn-lavender/5 blur-3xl pointer-events-none" />

      {/* Intro Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight mb-2.5">
            Discover
          </h1>
          <p className="text-sm md:text-base text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 max-w-2xl leading-relaxed">
            Search millions of books and research papers from global registries. Direct synchronization maps your collection in real-time.
          </p>
        </div>
      </div>

      {/* Premium Glassmorphic Tab switcher */}
      <div className="flex justify-start">
        <div className="p-1 glass-panel rounded-2xl border border-white/20 dark:border-white/10 flex gap-1 shadow-md select-none">
          <button
            onClick={() => setActiveTab('books')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-300 ${
              activeTab === 'books'
                ? 'bg-gradient-to-tr from-booklyn-amber to-booklyn-amber-dark text-white shadow-md shadow-booklyn-amber/15 scale-103'
                : 'text-booklyn-night-100/70 dark:text-booklyn-cream-200/60 hover:text-booklyn-night-100 dark:hover:text-white hover:bg-white/15 dark:hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Books & Novels</span>
          </button>
          <button
            onClick={() => setActiveTab('papers')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-300 ${
              activeTab === 'papers'
                ? 'bg-gradient-to-tr from-booklyn-amber to-booklyn-amber-dark text-white shadow-md shadow-booklyn-amber/15 scale-103'
                : 'text-booklyn-night-100/70 dark:text-booklyn-cream-200/60 hover:text-booklyn-night-100 dark:hover:text-white hover:bg-white/15 dark:hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Research Papers</span>
          </button>
        </div>
      </div>

      {/* Elegant Search Input with Autocomplete Suggestion Dropdown */}
      <div className="relative max-w-2xl z-40 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5.5 h-5.5 text-booklyn-night-100/40 dark:text-booklyn-cream-200/35" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={
              activeTab === 'books' 
                ? "Search books by title, author, or publisher..." 
                : selectedRegistry === 'arxiv'
                ? "Search technical preprints in AI, physics, math (arXiv)..."
                : selectedRegistry === 'pmc'
                ? "Search open-access biomedical literature (PubMed Central)..."
                : selectedRegistry === 'doaj'
                ? "Search peer-reviewed open access articles (DOAJ)..."
                : "Search research papers by keyword, author, abstract..."
            }
            value={query}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full !pl-12 !pr-12 py-4.5 glass-input rounded-2xl shadow-xl border border-white/20 dark:border-white/10 font-sans focus:ring-2 focus:ring-booklyn-amber/20 font-medium text-sm md:text-base text-booklyn-night-300 dark:text-white"
          />
          {query && (
            <button 
              onClick={() => { setQuery(''); setSuggestions([]); }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 active:scale-95 transition-all"
            >
              <X className="w-4 h-4 text-booklyn-night-100/60 dark:text-booklyn-cream-200/50" />
            </button>
          )}
        </div>

        {/* Sleek Glassmorphic Pill Switcher for Paper Registries */}
        {activeTab === 'papers' && (
          <div className="flex flex-wrap gap-2 pt-1 select-none">
            {[
              { id: 'semantic_scholar', label: '🌐 Semantic Scholar' },
              { id: 'arxiv', label: '⚛️ arXiv Preprints' },
              { id: 'pmc', label: '🧬 PubMed Central' },
              { id: 'doaj', label: '📖 DOAJ Directory' }
            ].map((reg) => (
              <button
                key={reg.id}
                onClick={() => setSelectedRegistry(reg.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold tracking-wide transition-all duration-300 border ${
                  selectedRegistry === reg.id
                    ? 'bg-gradient-to-tr from-booklyn-amber to-booklyn-amber-dark text-white border-booklyn-amber shadow-md shadow-booklyn-amber/15 scale-102'
                    : 'bg-white/20 dark:bg-white/5 border-white/20 dark:border-white/10 text-booklyn-night-100/70 dark:text-booklyn-cream-200/60 hover:text-booklyn-night-100 dark:hover:text-white hover:bg-white/30 dark:hover:bg-white/10'
                }`}
              >
                {reg.label}
              </button>
            ))}
          </div>
        )}

        {/* Suggestion Dropdown Panel */}
        <AnimatePresence>
          {showSuggestions && (query.trim().length >= 3 || suggestions.length > 0) && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowSuggestions(false)} 
              />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-0 right-0 mt-2 p-3.5 glass-overlay rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] border border-white/15 dark:border-white/10 z-[100] overflow-hidden space-y-2.5 max-h-[360px] overflow-y-auto custom-scrollbar pointer-events-auto"
              >
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-booklyn-amber animate-pulse" />
                    Live suggestions
                  </span>
                  <button 
                    onClick={() => setShowSuggestions(false)}
                    className="text-[10px] font-semibold text-booklyn-amber hover:underline"
                  >
                    Dismiss
                  </button>
                </div>

                {suggestions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-booklyn-night-100/40 dark:text-booklyn-cream-200/45 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-booklyn-amber" />
                    <span>
                      {activeTab === 'books' 
                        ? 'Searching book registry indices...' 
                        : selectedRegistry === 'arxiv'
                        ? 'Connecting to arXiv preprints database...'
                        : selectedRegistry === 'pmc'
                        ? 'Accessing PubMed Central biomedical catalog...'
                        : selectedRegistry === 'doaj'
                        ? 'Querying DOAJ peer-reviewed directory...'
                        : 'Searching research paper registries...'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {suggestions.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setQuery(item.title);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left p-2 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 active:scale-[0.99] transition-all flex items-center gap-3 border border-transparent hover:border-white/20 dark:hover:border-white/5"
                      >
                        <div className="w-8 h-11 bg-booklyn-cream-200 dark:bg-booklyn-night-100 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {activeTab === 'books' ? (
                            item.cover_url ? (
                              <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${item.cover_color}`} />
                            )
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-indigo-950 flex items-center justify-center text-white text-[7px]">
                              PDF
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold font-serif truncate text-booklyn-night-300 dark:text-white">{item.title}</p>
                          <p className="text-[10px] text-booklyn-night-100/60 dark:text-booklyn-cream-200/40 truncate">
                            by {activeTab === 'books' ? item.author : item.authors?.join(', ')}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-booklyn-amber opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* MAIN VIEWPORT SWITCH */}
      <div className="relative">
        {/* Landing State: Show Carousels & Search History */}
        {query.trim() === '' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10"
          >
            {/* Recently Searched pill rows */}
            {currentRecentSearches.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-booklyn-amber" />
                    Recently searched
                  </p>
                  <button 
                    onClick={handleClearRecent}
                    className="p-1 text-xs font-semibold text-red-500/80 hover:text-red-500 hover:bg-red-500/5 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear all</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {currentRecentSearches.map((term, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleHotSearchClick(term)}
                      className="px-3.5 py-2 rounded-xl bg-white/20 dark:bg-white/5 border border-white/25 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 text-xs font-medium tracking-wide active:scale-95 transition-all flex items-center gap-1.5 shadow-sm text-booklyn-night-200 dark:text-white"
                    >
                      <span>{term}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-booklyn-amber" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Curated Hot/Trending search tags */}
            {currentRecentSearches.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-booklyn-amber" />
                  Trending Searches
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {currentHotSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleHotSearchClick(term)}
                      className="px-3.5 py-2.5 rounded-xl bg-white/20 dark:bg-white/5 border border-white/25 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 text-xs font-semibold tracking-wide active:scale-95 transition-all flex items-center gap-1.5 shadow-sm text-booklyn-night-200 dark:text-white"
                    >
                      <span>{term}</span>
                      <ArrowRight className="w-3 h-3 text-booklyn-amber" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'books' ? (
              <div className="space-y-8">
                {Object.entries(cleanCategoriesData).map(([key, category]) => {
                  const getDotColorClass = (k) => {
                    const colors = {
                      trending: 'bg-booklyn-amber animate-pulse',
                      free: 'bg-emerald-500',
                      classics: 'bg-booklyn-lavender',
                      fantasy: 'bg-rose-500',
                      scifi: 'bg-indigo-500',
                      mystery: 'bg-zinc-500',
                      romance: 'bg-pink-500',
                      philosophy: 'bg-indigo-400',
                      horror: 'bg-red-600',
                      adventure: 'bg-sky-500',
                      selfHelp: 'bg-teal-500',
                      historical: 'bg-amber-700',
                    };
                    return colors[k] || 'bg-booklyn-amber';
                  };

                  return (
                    <div key={key} className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 
                          onClick={() => handleCategoryTitleClick(category.title, key)}
                          className="font-serif text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2 cursor-pointer hover:text-booklyn-amber group transition-all duration-300 select-none"
                        >
                          <span className={`w-2.5 h-2.5 rounded-full transition-transform duration-300 group-hover:scale-125 ${getDotColorClass(key)}`} />
                          <span className="border-b border-transparent group-hover:border-booklyn-amber transition-all duration-300">
                            {category.title}
                          </span>
                        </h3>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => scrollCarousel(key, 'left')}
                            className="p-2 rounded-xl bg-white/35 dark:bg-white/5 border border-white/10 hover:bg-white/50 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4 text-booklyn-night-100/70 dark:text-white" />
                          </button>
                          <button 
                            onClick={() => scrollCarousel(key, 'right')}
                            className="p-2 rounded-xl bg-white/35 dark:bg-white/5 border border-white/10 hover:bg-white/50 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4 text-booklyn-night-100/70 dark:text-white" />
                          </button>
                        </div>
                      </div>
 
                      {category.loading ? (
                        <div className="flex gap-4 overflow-hidden py-2">
                          {Array.from({ length: 6 }).map((_, idx) => (
                            <div key={idx} className="w-[160px] md:w-[190px] flex-shrink-0 space-y-3 animate-pulse">
                              <div className="aspect-[3/4] bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded-2xl w-full animate-pulse" />
                              <div className="h-4 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-11/12 animate-pulse" />
                              <div className="h-3 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-2/3 animate-pulse" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          ref={(el) => { scrollRefs.current[key] = el; }}
                          className="flex gap-4 overflow-x-auto py-2 custom-scrollbar scroll-smooth snap-x snap-mandatory"
                          style={{ scrollbarWidth: 'none' }}
                        >
                          {category.books && category.books.map((book) => (
                            <NetflixCarouselCard
                              key={book.id}
                              book={book}
                              onClick={() => handleBookClick(book)}
                              onShelve={(status) => handleShelveBook(book, status)}
                              shelvedBooks={books}
                              activeShelvingId={activeShelvingBookId}
                              setActiveShelvingId={setActiveShelvingBookId}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {/* DOI Open Access Resolver Widget */}
                <div className="glass-panel border-white/20 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-tr from-booklyn-amber/10 to-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-booklyn-amber/10 text-booklyn-amber">
                          <Unlock className="w-5 h-5" />
                        </span>
                        <h3 className="font-serif text-xl md:text-2xl font-bold tracking-tight text-booklyn-night-300 dark:text-white">
                          DOI Open-Access Resolver
                        </h3>
                      </div>
                      <p className="text-xs text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 max-w-lg leading-relaxed">
                        Instantly resolve and view scholarly publications. We coordinate queries through Unpaywall and Semantic Scholar registries to safely locate open-access editions.
                      </p>
                    </div>
                  </div>

                  {/* Resolution Input field */}
                  <form onSubmit={handleResolveDoi} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <FileText className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4.5 h-4.5 text-booklyn-night-100/40 dark:text-booklyn-cream-200/35" />
                      <input
                        type="text"
                        placeholder="Enter publication DOI (e.g. 10.1145/3065386 or https://doi.org/10.1109/...)"
                        value={doiQuery}
                        onChange={(e) => setDoiQuery(e.target.value)}
                        className="w-full !pl-11 !pr-4 py-3.5 glass-input rounded-2xl border border-white/25 dark:border-white/10 font-sans focus:ring-2 focus:ring-booklyn-amber/20 font-medium text-xs md:text-sm text-booklyn-night-300 dark:text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={resolvingDoi}
                      className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-97 shadow-lg shadow-booklyn-amber/15 disabled:opacity-50"
                    >
                      {resolvingDoi ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Resolving...</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4" />
                          <span>Resolve & View</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* Quick example suggestions */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-booklyn-night-100/45 dark:text-booklyn-cream-200/40">Try examples:</span>
                    {[
                      { label: 'Attention Is All You Need', doi: '10.1145/3065386' },
                      { label: 'BERT Pre-training', doi: '10.48550/arxiv.1810.04805' },
                      { label: 'ResNet recognition', doi: '10.1109/cvpr.2016.90' }
                    ].map((ex, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          setDoiQuery(ex.doi);
                          handleResolveDoi(e, ex.doi);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white/25 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 text-[10px] font-medium tracking-wide active:scale-95 transition-all text-booklyn-night-200 dark:text-white"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>

                  {/* DOI Error display */}
                  {doiError && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold"
                    >
                      {doiError}
                    </motion.div>
                  )}

                  {/* DOI Results display */}
                  <AnimatePresence>
                    {doiResult && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 10 }}
                        className="p-5 sm:p-6 rounded-3xl bg-white/25 dark:bg-white/5 border border-white/20 dark:border-white/10 space-y-4 shadow-inner"
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                          <div className="space-y-1.5">
                            {/* Access tag */}
                            <div className="flex flex-wrap gap-1.5">
                              <span className={`px-2 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest ${
                                doiResult.is_oa
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20'
                                  : 'bg-red-500/15 text-red-500 border border-red-500/20'
                              }`}>
                                {doiResult.is_oa ? `🔓 Open Access (${doiResult.oa_status})` : '🔒 Restricted Access'}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-white/30 dark:bg-white/5 border border-white/15 text-[8px] font-bold uppercase tracking-wider text-booklyn-night-100/40 dark:text-booklyn-cream-200/40">
                                {doiResult.source}
                              </span>
                            </div>
                            <h4 className="font-serif font-bold text-base leading-snug tracking-tight text-booklyn-night-300 dark:text-white">
                              {doiResult.title}
                            </h4>
                            <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 font-medium">
                              by {doiResult.authors.join(', ')}
                            </p>
                          </div>
                          <span className="text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 font-bold uppercase tracking-widest font-sans">
                            {doiResult.year}
                          </span>
                        </div>

                        <p className="text-xs leading-relaxed text-booklyn-night-100/70 dark:text-booklyn-cream-200/60 pl-3 border-l-2 border-booklyn-amber/35">
                          {doiResult.abstract}
                        </p>

                        <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-booklyn-cream-300/30 dark:border-booklyn-night-100/10">
                          <div className="text-[10px] text-booklyn-night-100/45 dark:text-booklyn-cream-200/40 font-semibold uppercase tracking-wider">
                            {doiResult.journal}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleToggleBookmarkPaper(e, doiResult)}
                              className={`p-2 rounded-xl border transition-all active:scale-95 ${
                                savedPapers.some(p => p.id === doiResult.id)
                                  ? 'bg-green-500/10 border-green-500/20 text-green-500 shadow-sm'
                                  : 'bg-white/20 dark:bg-white/5 border-white/20 dark:border-white/10 text-booklyn-night-100 dark:text-white hover:bg-white/35 dark:hover:bg-white/10'
                              }`}
                              title={savedPapers.some(p => p.id === doiResult.id) ? "Saved to Library" : "Bookmark Research Paper"}
                            >
                              <Bookmark className={`w-3.5 h-3.5 ${savedPapers.some(p => p.id === doiResult.id) ? 'fill-green-500' : ''}`} />
                            </button>

                            <Link
                              to={`/paper/${doiResult.id}`}
                              className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-95 shadow-md shadow-booklyn-amber/10 transition-all"
                            >
                              <span>🔓 View Publication</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* PAPERS ROW: Curated Popular Research Papers */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-serif text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-booklyn-lavender rounded-full animate-pulse" />
                      High-Impact Publications
                    </h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => scrollCarousel(papersScrollRef, 'left')}
                        className="p-2 rounded-xl bg-white/35 dark:bg-white/5 border border-white/10 hover:bg-white/50 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4 text-booklyn-night-100/70 dark:text-white" />
                      </button>
                      <button 
                        onClick={() => scrollCarousel(papersScrollRef, 'right')}
                        className="p-2 rounded-xl bg-white/35 dark:bg-white/5 border border-white/10 hover:bg-white/50 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4 text-booklyn-night-100/70 dark:text-white" />
                      </button>
                    </div>
                  </div>

                  {loadingPopularPapers ? (
                    <div className="flex gap-4 overflow-hidden py-2">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="w-[280px] md:w-[320px] flex-shrink-0 space-y-3 animate-pulse">
                          <div className="h-36 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded-2xl w-full" />
                          <div className="h-4 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-11/12" />
                          <div className="h-3 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div 
                      ref={papersScrollRef}
                      className="flex gap-4 overflow-x-auto py-2 custom-scrollbar scroll-smooth snap-x snap-mandatory"
                      style={{ scrollbarWidth: 'none' }}
                    >
                      {popularPapers.map((paper) => (
                        <div key={paper.id} className="snap-start flex-shrink-0 w-[280px] md:w-[320px]">
                          <NetflixPaperCard 
                            paper={paper} 
                            isSaved={savedPapers.some(p => p.id === paper.id)}
                            onToggleBookmark={(e) => handleToggleBookmarkPaper(e, paper)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Searching Results Viewport */}
        {query.trim() !== '' && (
          <div className="space-y-6">
            {/* Filter Bar with Genre pills & Author Select dropdown (for books only) */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 font-sans">
                    Results {currentSearchSource && `• Index: ${currentSearchSource}`}
                  </p>
                  {activeTab === 'books' && filteredResults.length !== bookResults.length && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-booklyn-amber/15 text-booklyn-amber rounded-full">
                      Filtered ({filteredResults.length} of {bookResults.length})
                    </span>
                  )}
                </div>
                
                {activeTab === 'books' && (
                  <button
                    onClick={() => setShowFilterDrawer(!showFilterDrawer)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold tracking-wide transition-all ${
                      showFilterDrawer 
                        ? 'bg-booklyn-amber border-booklyn-amber text-white shadow-md' 
                        : 'bg-white/20 dark:bg-white/5 border-white/20 dark:border-white/10 text-booklyn-night-100/80 dark:text-booklyn-cream-100 hover:bg-white/35 dark:hover:bg-white/10'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filters</span>
                  </button>
                )}
              </div>

              {/* Genre selection slider & author selector panel */}
              {activeTab === 'books' && (
                <AnimatePresence>
                  {showFilterDrawer && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-4 p-4 glass-panel rounded-2xl border border-white/20 dark:border-white/10"
                    >
                      {/* Genre Pill filters list */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 flex items-center gap-1">
                          <Filter className="w-3 h-3 text-booklyn-amber" />
                          Genre refinement
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelectedGenre('All')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              selectedGenre === 'All'
                                ? 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white shadow-sm'
                                : 'bg-white/25 dark:bg-white/5 hover:bg-white/35 dark:hover:bg-white/10 text-booklyn-night-100/70 dark:text-booklyn-cream-100'
                            }`}
                          >
                            All Genres
                          </button>
                          {POPULAR_GENRES.map((genre) => (
                            <button
                              key={genre}
                              onClick={() => setSelectedGenre(genre)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                selectedGenre === genre
                                  ? 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white shadow-sm'
                                  : 'bg-white/25 dark:bg-white/5 hover:bg-white/35 dark:hover:bg-white/10 text-booklyn-night-100/70 dark:text-booklyn-cream-100'
                              }`}
                            >
                              {genre}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Author selection drop list */}
                      {uniqueAuthors.length > 0 && (
                        <div className="space-y-2 max-w-sm">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-booklyn-amber" />
                            Filter by author
                          </label>
                          <select
                            value={selectedAuthor}
                            onChange={(e) => setSelectedAuthor(e.target.value)}
                            className="w-full p-2.5 glass-input rounded-xl border border-white/20 dark:border-white/10 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-booklyn-amber/20 text-booklyn-night-200 dark:text-booklyn-night-400 bg-white dark:bg-booklyn-night-300"
                          >
                            <option value="All">All Authors ({uniqueAuthors.length})</option>
                            {uniqueAuthors.map((author) => (
                              <option key={author} value={author}>
                                {author}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Error notifications */}
            {currentError && (
              <div className="p-4.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm max-w-2xl text-center mx-auto shadow-md">
                {currentError}
              </div>
            )}

            {/* Initial loading skeletons */}
            {currentLoading && currentResults.length === 0 && (
              <div className="space-y-4">
                {activeTab === 'papers' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 glass-panel rounded-2xl border border-white/20 dark:border-white/10 flex items-center gap-3 shadow-md max-w-xl"
                  >
                    <Loader2 className="w-5 h-5 animate-spin text-booklyn-amber" />
                    <span className="text-xs sm:text-sm font-semibold text-booklyn-night-200 dark:text-booklyn-cream-100">
                      {selectedRegistry === 'arxiv'
                        ? 'Connecting to arXiv Open Archive repositories...'
                        : selectedRegistry === 'pmc'
                        ? 'Accessing PubMed Central open-access medical databases...'
                        : selectedRegistry === 'doaj'
                        ? 'Querying DOAJ Directory of Open Access Journals...'
                        : 'Accessing Semantic Scholar registry indices...'}
                    </span>
                  </motion.div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 pt-2">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <div key={idx} className="glass-panel rounded-2xl p-3 border border-white/10 space-y-4 animate-pulse">
                      {activeTab === 'books' ? (
                        <div className="aspect-[3/4] bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded-xl w-full" />
                      ) : (
                        <div className="h-32 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded-xl w-full" />
                      )}
                      <div className="space-y-2">
                        <div className="h-4 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-11/12" />
                        <div className="h-3 bg-booklyn-cream-300 dark:bg-booklyn-night-100 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active search grid card loop for books */}
            {!bookLoading && activeTab === 'books' && filteredResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                {filteredResults.map((book) => (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    onSelect={handleBookClick} 
                  />
                ))}
              </div>
            )}

            {/* Active search grid card loop for research papers */}
            {!paperLoading && activeTab === 'papers' && paperResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {paperResults.map((paper) => {
                  const isSaved = savedPapers.some(p => p.id === paper.id);
                  return (
                    <motion.div
                      key={paper.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -4 }}
                      className="glass-panel rounded-3xl p-5 border border-white/20 dark:border-white/10 hover:border-booklyn-amber/30 hover:shadow-glow-amber transition-all select-none flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Meta Tags row */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            {paper.fields.slice(0, 2).map((field, idx) => (
                              <span 
                                key={idx} 
                                className="px-2 py-0.5 rounded-lg bg-booklyn-cream-300/50 dark:bg-white/5 border border-white/15 text-[8px] font-bold uppercase tracking-wider text-booklyn-night-100/50 dark:text-booklyn-cream-200/40"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                          
                          <div className="flex items-center gap-1 bg-booklyn-amber/10 border border-booklyn-amber/20 text-booklyn-amber px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wide">
                            <Quote className="w-2.5 h-2.5" />
                            <span>{paper.citationCount.toLocaleString()} Citations</span>
                          </div>
                        </div>

                        {/* Title & Author */}
                        <div className="space-y-1">
                          <Link 
                            to={`/paper/${paper.id}`}
                            className="font-serif font-bold text-base leading-snug tracking-tight hover:text-booklyn-amber dark:hover:text-booklyn-amber-light block transition-colors text-booklyn-night-300 dark:text-white"
                          >
                            {paper.title}
                          </Link>
                          <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate leading-relaxed">
                            by {paper.authors.join(', ')}
                          </p>
                        </div>

                        {/* Abstract Snippet */}
                        <p className="text-xs text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 line-clamp-3 leading-relaxed">
                          {paper.abstract}
                        </p>
                      </div>

                      {/* Footer Row */}
                      <div className="flex justify-between items-center mt-5 pt-3 border-t border-booklyn-cream-300/20 dark:border-booklyn-night-100/10">
                        <div className="text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 font-semibold tracking-wider uppercase flex items-center gap-1.5">
                          <span className="truncate max-w-[150px]">{paper.journal || 'Academic Research'}</span>
                          <span>•</span>
                          <span>{paper.year}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleToggleBookmarkPaper(e, paper)}
                            className={`p-2 rounded-xl border transition-all active:scale-95 ${
                              isSaved
                                ? 'bg-green-500/10 border-green-500/20 text-green-500 shadow-sm'
                                : 'bg-white/20 dark:bg-white/5 border-white/20 dark:border-white/10 text-booklyn-night-100 dark:text-white hover:bg-white/35 dark:hover:bg-white/10'
                            }`}
                            title={isSaved ? "Saved to Library" : "Bookmark Research Paper"}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-green-500' : ''}`} />
                          </button>

                          <Link
                            to={`/paper/${paper.id}`}
                            className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white font-bold text-[10px] uppercase tracking-wider hover:brightness-105 active:scale-95 shadow-md shadow-booklyn-amber/10 transition-all"
                          >
                            <span>Open Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Empty Matches state */}
            {!currentLoading && currentResults.length === 0 && (
              <div className="text-center py-16 space-y-4 glass-panel rounded-3xl border border-white/15 max-w-lg mx-auto shadow-lg">
                <BookOpen className="w-12 h-12 text-booklyn-amber/55 mx-auto animate-bounce-subtle" />
                <h3 className="font-serif text-xl font-bold">No matches located</h3>
                <p className="text-xs text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 px-8 max-w-sm mx-auto leading-relaxed">
                  We couldn't locate matching records for your filters under "{query}". Try clearing search keywords or filters.
                </p>
                {activeTab === 'books' && (
                  <button
                    onClick={() => { setSelectedGenre('All'); setSelectedAuthor('All'); }}
                    className="px-4 py-2 text-xs font-semibold bg-white/20 dark:bg-white/5 border border-white/25 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 rounded-xl transition-all active:scale-95 shadow-sm"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {/* Paging loader indicator at bottom */}
            {currentHasMore && currentResults.length > 0 && (
              <div ref={observerRef} className="py-8 flex justify-center items-center w-full">
                {currentLoadingMore ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/40">
                    <Loader2 className="w-4 h-4 animate-spin text-booklyn-amber" />
                    <span>Loading more editions...</span>
                  </div>
                ) : (
                  <div className="h-2 w-full" />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Book details slide-out overlay */}
      <BookDetailSlideOver
        book={selectedBook}
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
      />
    </div>
  );
}

// ----------------------------------------------------
// INTERNAL SUB-COMPONENTS
// ----------------------------------------------------

/**
 * A beautiful, Netflix-style horizontal sliding book card.
 */
function NetflixCarouselCard({ book, onClick, onShelve, shelvedBooks, activeShelvingId, setActiveShelvingId }) {
  const existing = shelvedBooks.find(b => b.title.toLowerCase() === book.title.toLowerCase() && b.author.toLowerCase() === book.author.toLowerCase());

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      className="w-[160px] md:w-[190px] flex-shrink-0 snap-start animate-fade-in glass-panel rounded-2xl p-3 border border-white/20 dark:border-white/10 hover:border-booklyn-amber/30 hover:shadow-glow-amber cursor-pointer flex flex-col justify-between h-[280px] md:h-[320px] transition-all relative group select-none"
    >
      <ShelfBadge book={book} shelvedBooks={shelvedBooks} />

      <div className="space-y-3" onClick={onClick}>
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-md bg-booklyn-cream-200 dark:bg-booklyn-night-400 w-full">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${book.cover_color} p-3.5 flex flex-col justify-between text-white`}>
              <Bookmark className="w-3.5 h-3.5 self-end opacity-40" />
              <div className="space-y-0.5">
                <p className="font-serif text-[11px] font-bold line-clamp-3 leading-snug">{book.title}</p>
                <p className="text-[8px] opacity-75 truncate">{book.author}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          <h4 className="font-serif font-bold text-xs md:text-sm tracking-tight line-clamp-2 leading-snug group-hover:text-booklyn-amber dark:group-hover:text-booklyn-amber-light transition-colors text-booklyn-night-300 dark:text-white">
            {book.title}
          </h4>
          <p className="text-[10px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate">
            {book.author}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-1.5 border-t border-booklyn-cream-300/20 dark:border-booklyn-night-100/10 text-[9px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 font-semibold uppercase tracking-wider relative">
        <span className="truncate max-w-[65px]">{book.genre || 'Fiction'}</span>
        
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveShelvingId(activeShelvingId === book.id ? null : book.id);
            }}
            className="p-1 rounded-lg bg-booklyn-cream-200 dark:bg-booklyn-night-100 hover:bg-booklyn-amber/20 dark:hover:bg-booklyn-amber/20 active:scale-95 transition-all text-booklyn-night-100/80 dark:text-white"
          >
            <Plus className="w-3 h-3" />
          </button>

          <AnimatePresence>
            {activeShelvingId === book.id && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={(e) => { e.stopPropagation(); setActiveShelvingId(null); }} 
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                  className="absolute right-0 bottom-6 mb-1 w-[140px] glass-overlay border border-white/15 dark:border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] z-[100] overflow-hidden flex flex-col p-1.5 gap-0.5 pointer-events-auto"
                >
                  {[
                    { status: 'to_read', label: 'Want to Read' },
                    { status: 'reading', label: 'Start Reading' },
                    { status: 'completed', label: 'Completed' }
                  ].map((shelf) => {
                    const isActive = existing && existing.status === shelf.status;

                    return (
                      <button
                        key={shelf.status}
                        onClick={(e) => {
                          e.stopPropagation();
                          onShelve(shelf.status);
                        }}
                        className={`w-full px-2.5 py-1.5 text-left rounded-lg text-[9px] font-bold tracking-wide flex items-center justify-between border border-transparent transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white font-bold'
                            : 'hover:bg-white/30 dark:hover:bg-white/5 text-booklyn-night-200 dark:text-booklyn-cream-100'
                        }`}
                      >
                        <span>{shelf.label}</span>
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
    </motion.div>
  );
}

/**
 * A beautiful horizontal sliding Research Paper card.
 */
function NetflixPaperCard({ paper, isSaved, onToggleBookmark }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="glass-panel rounded-2xl p-4 border border-white/20 dark:border-white/10 hover:border-booklyn-amber/35 shadow-sm hover:shadow-glow-amber cursor-pointer flex flex-col justify-between h-[190px] text-xs select-none"
    >
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="px-2 py-0.5 rounded-lg bg-booklyn-cream-300 dark:bg-white/5 border border-white/10 text-[8px] font-bold uppercase tracking-wider text-booklyn-night-100/40 dark:text-booklyn-cream-200/40">
            {paper.fields[0] || 'Research'}
          </span>
          <div className="flex items-center gap-0.5 text-booklyn-amber font-extrabold text-[8px] uppercase">
            <Quote className="w-2.5 h-2.5" />
            <span>{paper.citationCount.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <Link 
            to={`/paper/${paper.id}`}
            className="font-serif font-bold text-xs md:text-sm tracking-tight line-clamp-2 leading-snug hover:text-booklyn-amber dark:hover:text-booklyn-amber-light block transition-colors text-booklyn-night-300 dark:text-white"
          >
            {paper.title}
          </Link>
          <p className="text-[10px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate">
            by {paper.authors.join(', ')}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2.5 border-t border-booklyn-cream-300/20 dark:border-booklyn-night-100/10 text-[9px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 font-semibold uppercase tracking-wider">
        <span>{paper.year}</span>
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleBookmark}
            className={`p-1.5 rounded-lg border transition-all active:scale-90 ${
              isSaved
                ? 'bg-green-500/10 border-green-500/20 text-green-500'
                : 'bg-white/20 dark:bg-white/5 border-white/15 text-booklyn-night-100 dark:text-white hover:bg-white/30 dark:hover:bg-white/10'
            }`}
          >
            <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-green-500' : ''}`} />
          </button>
          
          <Link
            to={`/paper/${paper.id}`}
            className="p-1 rounded-lg bg-booklyn-cream-200 dark:bg-booklyn-night-100 hover:bg-booklyn-amber/25 active:scale-90 transition-all text-booklyn-night-100 dark:text-white"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Visual badge rendering current shelved state of a book
 */
function ShelfBadge({ book, shelvedBooks }) {
  const existing = shelvedBooks.find(b => b.title.toLowerCase() === book.title.toLowerCase() && b.author.toLowerCase() === book.author.toLowerCase());
  if (!existing) return null;

  const labels = {
    to_read: 'To Read',
    reading: 'Reading',
    completed: 'Finished'
  };

  const colors = {
    to_read: 'bg-indigo-500/85 text-white',
    reading: 'bg-amber-500/85 text-white shadow-glow-amber',
    completed: 'bg-emerald-600/85 text-white'
  };

  return (
    <div className={`absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-wider backdrop-blur-md shadow-sm border border-white/10 ${colors[existing.status] || 'bg-white/30 text-white'}`}>
      {labels[existing.status] || 'Shelved'}
    </div>
  );
}
