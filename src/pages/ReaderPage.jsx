import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Reader from '../components/Reader';
import { useLibraryStore } from '../store/useLibraryStore';
import { booksApi } from '../api/booksApi';
import LoadingScreen from '../components/LoadingScreen';

export default function ReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { books, fetchBooks, addBook } = useLibraryStore();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadBookForReading() {
      setLoading(true);
      setError('');
      try {
        // 1. Sync books from the store
        await fetchBooks();
        
        // 2. Check if book exists in local library
        const currentBooks = useLibraryStore.getState().books;
        const match = currentBooks.find(b => 
          b.id === id || 
          (b.openlibrary_id && String(b.openlibrary_id) === String(id)) || 
          (b.googlebooks_id && `gb-${b.googlebooks_id}` === id)
        );

        if (match) {
          if (active) setBook(match);
        } else {
          // If not in library, fetch from dynamic API details
          console.log('[ReaderPage] Book not in library, fetching metadata for ID:', id);
          const fetched = await booksApi.getBook(id);
          if (fetched) {
            // Automatically insert it into the library under 'reading' status
            const added = await addBook({
              ...fetched,
              status: 'reading',
              progress: 0,
              rating: 0,
              review: '',
              tracking_mode: 'pages',
              total_chapters: 20,
              current_chapter: 0
            });
            if (active) setBook(added);
          } else {
            if (active) setError('Could not fetch book details for reading.');
          }
        }
      } catch (err) {
        console.error('[ReaderPage] Error loading book for reader:', err);
        if (active) setError('Failed to load book in reading sanctuary.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBookForReading();

    return () => {
      active = false;
    };
  }, [id, fetchBooks]);

  const handleClose = () => {
    // Navigate back to the book detail page
    navigate(`/book/${id}`);
  };

  if (loading) {
    return <LoadingScreen message="Entering the Reading Sanctuary..." />;
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-cozy-cream-100 dark:bg-cozy-night-300 flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-panel border-red-500/25 p-8 rounded-3xl max-w-md space-y-4 shadow-xl">
          <h2 className="text-xl font-serif font-bold text-red-500">Sanctuary Error</h2>
          <p className="text-sm text-cozy-night-100/60 dark:text-cozy-cream-200/50 font-sans">
            {error || 'The requested book could not be prepared for reading.'}
          </p>
          <button
            onClick={() => navigate('/discover')}
            className="px-5 py-2.5 rounded-xl bg-cozy-amber text-white font-bold text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer font-sans"
          >
            Return to Discover
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden select-none">
      <Reader 
        book={book} 
        onClose={handleClose} 
        onProgressUpdate={(progressVal, exactPos) => {
          console.log('[ReaderPage] Progress update:', progressVal, exactPos);
        }}
      />
    </div>
  );
}
