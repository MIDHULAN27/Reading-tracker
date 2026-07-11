export const BOOK_STATUS = {
  TO_READ: 'to_read',
  READING: 'reading',
  COMPLETED: 'completed'
};

export const SHELF_LABELS = {
  [BOOK_STATUS.TO_READ]: 'To Read',
  [BOOK_STATUS.READING]: 'Currently Reading',
  [BOOK_STATUS.COMPLETED]: 'Completed'
};

export const BOOK_GENRES = [
  'Fiction',
  'Non-Fiction',
  'Fantasy',
  'Sci-Fi',
  'Mystery',
  'Biography',
  'History',
  'Philosophy',
  'Self-Help',
  'Poetry',
  'Classic',
  'Other'
];

export const FALLBACK_BOOKS = [
  {
    id: 'mock-1',
    title: 'The Midnight Library',
    author: 'Matt Haig',
    cover_url: '',
    cover_color: 'from-blue-600 to-indigo-900',
    pages: 288,
    status: BOOK_STATUS.READING,
    progress: 142,
    rating: 4.5,
    genre: 'Fiction',
    review: 'A beautiful exploration of regrets and the lives we could have lived. Highly recommended for booklyn evenings.',
    added_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    last_read: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
    favorite: true
  },
  {
    id: 'mock-2',
    title: 'Atomic Habits',
    author: 'James Clear',
    cover_url: '',
    cover_color: 'from-amber-500 to-orange-700',
    pages: 320,
    status: BOOK_STATUS.READING,
    progress: 95,
    rating: 5,
    genre: 'Self-Help',
    review: 'Incredibly practical guide on building tiny habits that lead to remarkable results.',
    added_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    last_read: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    favorite: true
  },
  {
    id: 'mock-3',
    title: 'Dune',
    author: 'Frank Herbert',
    cover_url: '',
    cover_color: 'from-amber-700 to-red-800',
    pages: 604,
    status: BOOK_STATUS.TO_READ,
    progress: 0,
    rating: 0,
    genre: 'Sci-Fi',
    review: '',
    added_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    favorite: false
  },
  {
    id: 'mock-4',
    title: 'Stolen Focus',
    author: 'Johann Hari',
    cover_url: '',
    cover_color: 'from-teal-600 to-emerald-800',
    pages: 368,
    status: BOOK_STATUS.COMPLETED,
    progress: 368,
    rating: 4,
    genre: 'Non-Fiction',
    review: 'A timely and terrifying look at how our attention span was stolen—and how to reclaim it.',
    added_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    last_read: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
    favorite: false
  }
];

export const APP_THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};
