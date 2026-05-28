import { useState, useCallback, useRef, useEffect } from 'react';
import { booksApi } from '../api/booksApi';

export default function useBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [searchSource, setSearchSource] = useState('');

  // Trending & Recommended states
  const [trendingBooks, setTrendingBooks] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [recommendedBooks, setRecommendedBooks] = useState([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  // Keep track of the active search query to prevent race conditions
  const activeQueryRef = useRef('');
  const debounceTimeoutRef = useRef(null);

  // Fetch trending books list
  const fetchTrending = useCallback(async () => {
    setLoadingTrending(true);
    try {
      const data = await booksApi.getTrendingBooks();
      setTrendingBooks(data || []);
    } catch (err) {
      console.error('Failed to fetch trending books:', err);
    } finally {
      setLoadingTrending(false);
    }
  }, []);

  // Fetch recommended masterpieces
  const fetchRecommendedClassics = useCallback(async () => {
    setLoadingRecommended(true);
    try {
      const response = await booksApi.searchBooks('subject:classic+highly+rated', 1, 10);
      setRecommendedBooks(response.books || []);
    } catch (err) {
      console.error('Failed to fetch classics masterpieces:', err);
    } finally {
      setLoadingRecommended(false);
    }
  }, []);

  // Reset search results
  const resetSearch = useCallback(() => {
    setBooks([]);
    setPage(1);
    setHasMore(false);
    setSearchSource('');
    setError('');
    activeQueryRef.current = '';
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  // Execute direct search
  const searchBooks = useCallback(async (query, pageNum = 1, limit = 15) => {
    if (!query || query.trim() === '') {
      resetSearch();
      return;
    }

    const isFirstPage = pageNum === 1;
    if (isFirstPage) {
      setLoading(true);
      setError('');
    } else {
      setLoadingMore(true);
    }

    activeQueryRef.current = query;

    try {
      const response = await booksApi.searchBooks(query, pageNum, limit);
      
      // Prevent updating state if another search was triggered in the meantime
      if (activeQueryRef.current !== query) return;

      if (isFirstPage) {
        setBooks(response.books || []);
        setPage(1);
      } else {
        setBooks((prev) => [...prev, ...response.books]);
        setPage(pageNum);
      }

      setSearchSource(response.source || '');
      setHasMore(response.books && response.books.length >= limit);
    } catch (err) {
      if (activeQueryRef.current === query) {
        setError(err.message || 'Book index directory encountered an unexpected error. Please retry.');
      }
    } finally {
      if (activeQueryRef.current === query) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [resetSearch]);

  // Load next page for infinite scroll
  const loadNextPage = useCallback(async (limit = 15) => {
    if (loading || loadingMore || !hasMore || !activeQueryRef.current) return;
    await searchBooks(activeQueryRef.current, page + 1, limit);
  }, [loading, loadingMore, hasMore, page, searchBooks]);

  // Debounced search trigger
  const searchBooksDebounced = useCallback((query, delay = 500) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!query || query.trim() === '') {
      resetSearch();
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      searchBooks(query, 1, 15);
    }, delay);
  }, [searchBooks, resetSearch]);

  // Clean up debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    books,
    loading,
    loadingMore,
    error,
    hasMore,
    page,
    searchSource,
    trendingBooks,
    loadingTrending,
    recommendedBooks,
    loadingRecommended,
    fetchTrending,
    fetchRecommendedClassics,
    searchBooks,
    searchBooksDebounced,
    loadNextPage,
    resetSearch
  };
}
