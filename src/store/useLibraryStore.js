import { create } from 'zustand';
import { dbService } from '../services/db';
import { syncManager } from '../services/syncManager';
import { pdfStore } from '../services/pdfStore';
import { getTableMissingMessage } from '../services/tableValidator';
import { useAuthStore } from './useAuthStore';
import { useGuestGuardStore } from './useGuestGuardStore';

const DB_TIMEOUT_MS = 10000; // 10 seconds

const deduplicateBooks = (booksList) => {
  const seen = new Map();
  for (const book of booksList) {
    if (!book || !book.title) continue;
    const key = `${book.title.toLowerCase().trim()}|||${(book.author || '').toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.set(key, book);
    } else {
      const existing = seen.get(key);
      let keepNew = false;
      if (book.status === 'reading' && existing.status !== 'reading') {
        keepNew = true;
      } else if (existing.status === 'reading' && book.status !== 'reading') {
        keepNew = false;
      } else {
        const existingProgress = existing.progress / (existing.pages || 1);
        const bookProgress = book.progress / (book.pages || 1);
        if (bookProgress > existingProgress) {
          keepNew = true;
        } else if (bookProgress < existingProgress) {
          keepNew = false;
        } else {
          const existingTime = new Date(existing.last_read || existing.added_at || 0).getTime();
          const bookTime = new Date(book.last_read || book.added_at || 0).getTime();
          if (bookTime > existingTime) {
            keepNew = true;
          }
        }
      }
      if (keepNew) {
        seen.set(key, book);
      }
    }
  }
  return Array.from(seen.values());
};

const withTimeout = (promise, ms = DB_TIMEOUT_MS, label = 'Database operation') => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s. Please check your connection and try again.`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export const useLibraryStore = create((set, get) => ({
  books: [],
  loading: false,
  error: null,
  retryCount: 0,

  fetchBooks: async (isRetry = false) => {
    set(state => ({ 
      loading: true, 
      error: null,
      retryCount: isRetry ? state.retryCount + 1 : 0 
    }));
    try {
      console.info('[Booklyn Library Store] Fetching library books...');
      const books = await withTimeout(
        dbService.books.getBooks(),
        DB_TIMEOUT_MS,
        'Fetch library books'
      );
      
      // Filter out non-free books (only keep books with no googlebooks_id OR has openlibrary_id OR has_pdf is true)
      const freeBooks = books.filter(b => !(b.googlebooks_id && !b.openlibrary_id && !b.has_pdf));
      const nonFreeBooks = books.filter(b => b.googlebooks_id && !b.openlibrary_id && !b.has_pdf);
      
      if (nonFreeBooks.length > 0) {
        console.warn(`[Booklyn Library Store] Found ${nonFreeBooks.length} non-free books in library. Automatically cleaning them up...`);
        for (const b of nonFreeBooks) {
          dbService.books.deleteBook(b.id).catch(err => {
            console.error('[Booklyn Library Store] Failed to auto-delete non-free book:', b.title, err);
          });
        }
      }

      const uniqueBooks = deduplicateBooks(freeBooks);
      set({ books: uniqueBooks, error: null, retryCount: 0 });
      console.info('[Booklyn Library Store] Successfully fetched books:', uniqueBooks.length);
    } catch (error) {
      console.error('[Booklyn Library Store] Failed to fetch books:', error.message);
      
      const missingTableMsg = getTableMissingMessage(error.message);
      const friendlyMsg = missingTableMsg || `Failed to sync library books. ${error.message}`;

      // Auto-retry once for non-table-missing errors
      const currentRetryCount = get().retryCount;
      if (!missingTableMsg && currentRetryCount < 1) {
        console.warn(`[Booklyn Library Store] Fetch failed. Auto-retrying fetchBooks in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return get().fetchBooks(true);
      }

      set({ error: friendlyMsg, books: [] });
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Optimistic Add Book: Appends a temporary card immediately.
   * If db action fails, rolls back to original state.
   */
  addBook: async (bookData) => {
    const user = useAuthStore.getState().user;
    if (!user || user.is_anonymous || user.email?.includes('guest')) {
      useGuestGuardStore.getState().openGuard('Add to Library');
      throw new Error('Guest users cannot add books to library. Please sign in.');
    }

    const previousBooks = get().books;
    
    // Construct temporary optimistic book object
    const tempId = bookData.id || 'temp-' + Math.random().toString(36).substr(2, 9);
    const tempBook = {
      id: tempId,
      title: bookData.title,
      author: bookData.author || 'Unknown Author',
      cover_url: bookData.cover_url || '',
      cover_color: bookData.cover_color || 'from-indigo-600 to-indigo-950',
      pages: Number(bookData.pages) || 250,
      status: bookData.status || 'to_read',
      progress: Number(bookData.progress) || 0,
      rating: Number(bookData.rating) || 0,
      genre: bookData.genre || 'Other',
      review: bookData.review || '',
      added_at: new Date().toISOString(),
      favorite: bookData.favorite || false,
      last_read: bookData.last_read || null,
      tracking_mode: bookData.tracking_mode || 'pages',
      total_chapters: Number(bookData.total_chapters) || 20,
      current_chapter: Number(bookData.current_chapter) || 0,
      isOptimistic: true
    };

    // Optimistically update UI
    set(state => {
      // Prevent duplicates
      const exists = state.books.some(b => b.title.toLowerCase() === tempBook.title.toLowerCase() && b.author.toLowerCase() === tempBook.author.toLowerCase());
      if (exists) return {};
      return { books: [tempBook, ...state.books], error: null };
    });

    try {
      if (syncManager.isOnline()) {
        const addedBook = await withTimeout(
          dbService.books.addBook(bookData),
          DB_TIMEOUT_MS,
          'Add book'
        );
        
        // Swap out the optimistic tempBook with the real saved book from DB
        set(state => ({
          books: state.books.map(b => b.id === tempId ? addedBook : b)
        }));
        return addedBook;
      } else {
        // Offline queue add mutation
        syncManager.queueMutation('books', 'add', { ...bookData, id: tempId });
        return tempBook;
      }
    } catch (error) {
      const friendlyMsg = getTableMissingMessage(error.message) || error.message;
      // Rollback to original state on error
      set({ books: previousBooks, error: friendlyMsg });
      throw new Error(friendlyMsg);
    }
  },

  /**
   * Add local PDF book metadata and store its raw binary in IndexedDB
   */
  addPdfBook: async (bookData, pdfBlob) => {
    const previousBooks = get().books;
    
    // Generate a unique ID for this PDF book
    const bookId = 'pdf-' + Math.random().toString(36).substr(2, 9);
    
    const newBookData = {
      id: bookId,
      title: bookData.title,
      author: bookData.author || 'Unknown Author',
      cover_url: '',
      cover_color: bookData.cover_color || 'from-indigo-600 to-indigo-950',
      pages: Number(bookData.pages) || 100,
      status: bookData.status || 'to_read',
      progress: 0,
      rating: 0,
      genre: bookData.genre || 'Other',
      review: '',
      added_at: new Date().toISOString(),
      favorite: false,
      last_read: null,
      tracking_mode: 'pages',
      total_chapters: 20,
      current_chapter: 0,
      has_pdf: true
    };

    // Optimistically update UI
    set(state => {
      // Prevent duplicates
      const exists = state.books.some(b => b.title.toLowerCase() === newBookData.title.toLowerCase() && b.author.toLowerCase() === newBookData.author.toLowerCase());
      if (exists) return {};
      return { books: [newBookData, ...state.books], error: null };
    });

    try {
      // Save PDF raw binary blob to IndexedDB
      await pdfStore.savePDF(bookId, pdfBlob);

      if (syncManager.isOnline()) {
        const addedBook = await withTimeout(
          dbService.books.addBook(newBookData),
          DB_TIMEOUT_MS,
          'Add PDF book metadata'
        );
        
        // Swap out the optimistic record with the real saved book from DB
        set(state => ({
          books: state.books.map(b => b.id === bookId ? addedBook : b)
        }));
        return addedBook;
      } else {
        // Offline queue add mutation
        syncManager.queueMutation('books', 'add', newBookData);
        return newBookData;
      }
    } catch (error) {
      const friendlyMsg = getTableMissingMessage(error.message) || error.message;
      // Rollback on error and delete the PDF from IndexedDB
      await pdfStore.deletePDF(bookId).catch(() => {});
      set({ books: previousBooks, error: friendlyMsg });
      throw new Error(friendlyMsg);
    }
  },

  /**
   * Optimistic Update Book: Modifies values instantly on the shelf.
   * Rollback triggers if server rejects the change.
   */
  updateBook: async (bookId, updates) => {
    const previousBooks = get().books;
    
    // Apply instant optimistic update in store state
    set(state => ({
      books: state.books.map(b => b.id === bookId ? { ...b, ...updates } : b),
      error: null
    }));

    try {
      if (syncManager.isOnline()) {
        const updatedBook = await withTimeout(
          dbService.books.updateBook(bookId, updates),
          DB_TIMEOUT_MS,
          'Update book'
        );
        
        // Sync with final DB payload
        set(state => ({
          books: state.books.map(b => b.id === bookId ? updatedBook : b)
        }));
        return updatedBook;
      } else {
        // Offline queue update mutation
        syncManager.queueMutation('books', 'update', { id: bookId, updates });
        return get().books.find(b => b.id === bookId);
      }
    } catch (error) {
      const friendlyMsg = getTableMissingMessage(error.message) || error.message;
      // Rollback on database failure
      set({ books: previousBooks, error: friendlyMsg });
      throw new Error(friendlyMsg);
    }
  },

  /**
   * Optimistic Delete Book: Removes book card instantly.
   * Restores original array on database error.
   */
  deleteBook: async (bookId) => {
    const previousBooks = get().books;
    const deletedBook = previousBooks.find(b => b.id === bookId);
    if (!deletedBook) return;

    // Optimistically filter book and its duplicates from state
    set(state => ({
      books: state.books.filter(b => 
        !(b.title.toLowerCase().trim() === deletedBook.title.toLowerCase().trim() &&
          (b.author || '').toLowerCase().trim() === (deletedBook.author || '').toLowerCase().trim())
      ),
      error: null
    }));

    try {
      // Find all duplicate entries matching the title and author in Supabase
      let duplicates = [];
      try {
        const allBooks = await dbService.books.getBooks();
        duplicates = allBooks.filter(b => 
          b.title.toLowerCase().trim() === deletedBook.title.toLowerCase().trim() &&
          (b.author || '').toLowerCase().trim() === (deletedBook.author || '').toLowerCase().trim()
        );
      } catch (err) {
        console.warn('[Booklyn Library Store] Failed to fetch duplicates for cascading delete:', err);
        // Fallback to just the current bookId
        duplicates = [{ id: bookId }];
      }

      for (const dup of duplicates) {
        // Cascade delete PDF from IndexedDB if it exists
        await pdfStore.deletePDF(dup.id).catch(() => {});

        if (syncManager.isOnline()) {
          await withTimeout(
            dbService.books.deleteBook(dup.id),
            DB_TIMEOUT_MS,
            'Delete book'
          );
        } else {
          // Offline queue delete mutation
          syncManager.queueMutation('books', 'delete', { id: dup.id });
        }
      }
      return true;
    } catch (error) {
      const friendlyMsg = getTableMissingMessage(error.message) || error.message;
      // Rollback on server failure
      set({ books: previousBooks, error: friendlyMsg });
      throw new Error(friendlyMsg);
    }
  }
}));
