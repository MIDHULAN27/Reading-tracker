import { create } from 'zustand';
import { dbService } from '../services/db';
import { syncManager } from '../services/syncManager';
import { pdfStore } from '../services/pdfStore';

export const useLibraryStore = create((set, get) => ({
  books: [],
  loading: false,
  error: null,

  fetchBooks: async () => {
    set({ loading: true, error: null });
    try {
      const books = await dbService.books.getBooks();
      set({ books, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  /**
   * Optimistic Add Book: Appends a temporary card immediately.
   * If db action fails, rolls back to original state.
   */
  addBook: async (bookData) => {
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
        const addedBook = await dbService.books.addBook(bookData);
        
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
      // Rollback to original state on error
      set({ books: previousBooks, error: error.message });
      throw error;
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
        const addedBook = await dbService.books.addBook(newBookData);
        
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
      // Rollback on error and delete the PDF from IndexedDB
      await pdfStore.deletePDF(bookId).catch(() => {});
      set({ books: previousBooks, error: error.message });
      throw error;
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
        const updatedBook = await dbService.books.updateBook(bookId, updates);
        
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
      // Rollback on database failure
      set({ books: previousBooks, error: error.message });
      throw error;
    }
  },

  /**
   * Optimistic Delete Book: Removes book card instantly.
   * Restores original array on database error.
   */
  deleteBook: async (bookId) => {
    const previousBooks = get().books;

    // Optimistically filter book from state
    set(state => ({
      books: state.books.filter(b => b.id !== bookId),
      error: null
    }));

    try {
      // Cascade delete PDF from IndexedDB if it exists
      await pdfStore.deletePDF(bookId).catch(() => {});

      if (syncManager.isOnline()) {
        await dbService.books.deleteBook(bookId);
        return true;
      } else {
        // Offline queue delete mutation
        syncManager.queueMutation('books', 'delete', { id: bookId });
        return true;
      }
    } catch (error) {
      // Rollback on server failure
      set({ books: previousBooks, error: error.message });
      throw error;
    }
  }
}));
