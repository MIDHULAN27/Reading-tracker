import { useState, useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { booksApi } from '../api/booksApi';

// Internal debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  // We use standard React patterns instead of useEffect to avoid
  // extra renders, but useEffect is the standard for debounce
  import('react').then(({ useEffect }) => {
    useEffect(() => {
      const timer = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(timer);
    }, [value, delay]);
  });
  
  return debouncedValue;
}

export default function useBooks() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Debounce the search query by 500ms
  const debouncedQuery = useDebounce(searchQuery, 500);

  // 1. Trending Books Query
  const {
    data: trendingBooks = [],
    isLoading: loadingTrending,
    refetch: fetchTrending,
  } = useQuery({
    queryKey: ['trendingBooks'],
    queryFn: () => booksApi.getTrendingBooks(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // 2. Recommended Classics Query
  const {
    data: recommendedData,
    isLoading: loadingRecommended,
    refetch: fetchRecommendedClassics,
  } = useQuery({
    queryKey: ['recommendedClassics'],
    queryFn: () => booksApi.searchBooks('subject:classic+highly+rated', 1, 10),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
  
  const recommendedBooks = recommendedData?.books || [];

  // 3. Search Infinite Query
  const {
    data: searchData,
    isLoading: searchLoading,
    isFetchingNextPage: loadingMore,
    error: searchError,
    hasNextPage: hasMore,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['searchBooks', debouncedQuery],
    queryFn: async ({ pageParam = 1 }) => {
      if (!debouncedQuery || debouncedQuery.trim() === '') {
        return { books: [], source: '' };
      }
      return booksApi.searchBooks(debouncedQuery, pageParam, 15);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.books || lastPage.books.length < 15) return undefined;
      return allPages.length + 1;
    },
    enabled: !!debouncedQuery && debouncedQuery.trim() !== '',
    staleTime: 1000 * 60 * 5, // 5 mins
  });

  // Flatten the infinite pages into a single books array
  const books = useMemo(() => {
    return searchData ? searchData.pages.flatMap((page) => page.books) : [];
  }, [searchData]);

  const searchSource = searchData?.pages[0]?.source || '';
  const error = searchError ? searchError.message : '';
  const loading = searchLoading && !!debouncedQuery;

  // Compatibility functions for existing UI
  const searchBooksDebounced = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const resetSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const loadNextPage = useCallback(() => {
    if (hasMore && !loadingMore) {
      fetchNextPage();
    }
  }, [hasMore, loadingMore, fetchNextPage]);

  // Direct search pass-through for legacy non-debounced usage if needed
  const searchBooks = useCallback(async (query) => {
    setSearchQuery(query);
  }, []);

  return {
    books,
    loading,
    loadingMore,
    error,
    hasMore,
    page: searchData?.pages.length || 1,
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
