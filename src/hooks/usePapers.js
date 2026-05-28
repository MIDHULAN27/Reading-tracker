import { useState, useCallback, useRef, useEffect } from 'react';
import { papersApi } from '../api/papersApi';

export default function usePapers() {
  const [selectedRegistry, setSelectedRegistry] = useState('semantic_scholar');
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [searchSource, setSearchSource] = useState('');

  // Popular & Recommended states
  const [popularPapers, setPopularPapers] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [recommendedPapers, setRecommendedPapers] = useState([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  // Keep track of active search query to prevent race conditions
  const activeQueryRef = useRef('');
  const debounceTimeoutRef = useRef(null);

  // Fetch popular/trending papers
  const fetchPopular = useCallback(async (limit = 6) => {
    setLoadingPopular(true);
    try {
      const data = await papersApi.getPopularPapers(limit);
      setPopularPapers(data || []);
    } catch (err) {
      console.error('Failed to fetch popular papers:', err);
    } finally {
      setLoadingPopular(false);
    }
  }, []);

  // Fetch recommended papers based on paperId
  const fetchRecommended = useCallback(async (paperId, limit = 4) => {
    if (!paperId) return;
    setLoadingRecommended(true);
    try {
      const data = await papersApi.getRecommendations(paperId, limit);
      setRecommendedPapers(data || []);
    } catch (err) {
      console.error(`Failed to fetch paper recommendations for ${paperId}:`, err);
    } finally {
      setLoadingRecommended(false);
    }
  }, []);

  // Reset search results
  const resetSearch = useCallback(() => {
    setPapers([]);
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
  const searchPapers = useCallback(async (query, pageNum = 1, limit = 10, reg = selectedRegistry) => {
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
      const response = await papersApi.searchPapers(query, pageNum, limit, reg);
      
      // Prevent updating state if another search was triggered in the meantime
      if (activeQueryRef.current !== query) return;

      if (isFirstPage) {
        setPapers(response.papers || []);
        setPage(1);
      } else {
        setPapers((prev) => [...prev, ...response.papers]);
        setPage(pageNum);
      }

      setSearchSource(response.source || '');
      // If we got less than the requested limit, there are no more
      setHasMore(response.papers && response.papers.length >= limit);
    } catch (err) {
      if (activeQueryRef.current === query) {
        setError(err.message || 'Paper index directory encountered an unexpected error. Please retry.');
      }
    } finally {
      if (activeQueryRef.current === query) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [resetSearch, selectedRegistry]);

  // Load next page for infinite scroll
  const loadNextPage = useCallback(async (limit = 10) => {
    if (loading || loadingMore || !hasMore || !activeQueryRef.current) return;
    await searchPapers(activeQueryRef.current, page + 1, limit, selectedRegistry);
  }, [loading, loadingMore, hasMore, page, searchPapers, selectedRegistry]);

  // Debounced search trigger
  const searchPapersDebounced = useCallback((query, delay = 500) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!query || query.trim() === '') {
      resetSearch();
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      searchPapers(query, 1, 10, selectedRegistry);
    }, delay);
  }, [searchPapers, resetSearch, selectedRegistry]);

  // Watch for selectedRegistry changes to re-trigger search
  useEffect(() => {
    if (activeQueryRef.current && activeQueryRef.current.trim() !== '') {
      searchPapers(activeQueryRef.current, 1, 10, selectedRegistry);
    }
  }, [selectedRegistry, searchPapers]);

  // Clean up debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    selectedRegistry,
    setSelectedRegistry,
    papers,
    loading,
    loadingMore,
    error,
    hasMore,
    page,
    searchSource,
    popularPapers,
    loadingPopular,
    recommendedPapers,
    loadingRecommended,
    fetchPopular,
    fetchRecommended,
    searchPapers,
    searchPapersDebounced,
    loadNextPage,
    resetSearch
  };
}
