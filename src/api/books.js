import axiosInstance from './axiosInstance';

const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';

// Helper to clean author names from Google Books or Gutendex
export const cleanAuthorName = (name) => {
  if (!name) return 'Unknown Author';
  if (Array.isArray(name)) return name.join(', ');
  const parts = name.split(',');
  if (parts.length > 1) {
    return `${parts[1].trim()} ${parts[0].trim()}`;
  }
  return name;
};

// Formatter to map Google Books API results into Booklyn unified Book model
export const formatGoogleBook = (volume) => {
  const info = volume.volumeInfo || {};
  const id = volume.id;
  
  let coverUrl = '';
  if (info.imageLinks) {
    coverUrl = info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || '';
    if (coverUrl.startsWith('http://')) {
      coverUrl = coverUrl.replace('http://', 'https://');
    }
  }

  // Deterministic cover gradient fallback for books without images
  const gradients = [
    'from-amber-600 to-amber-950',
    'from-indigo-600 to-indigo-950',
    'from-teal-600 to-teal-950',
    'from-rose-600 to-rose-950',
    'from-emerald-600 to-emerald-950',
    'from-purple-600 to-purple-950',
  ];
  const hash = (info.title || '').length % gradients.length;
  const coverGradient = gradients[hash];

  const author = info.authors && info.authors.length > 0
    ? cleanAuthorName(info.authors)
    : 'Unknown Author';

  return {
    id: `gb-${id}`,
    title: info.title || 'Untitled Book',
    author: author,
    cover_url: coverUrl,
    cover_color: coverGradient,
    pages: info.pageCount || 250,
    genre: info.categories && info.categories.length > 0 ? info.categories[0] : 'Fiction',
    publish_year: info.publishedDate ? info.publishedDate.split('-')[0] : 'Classic',
    publisher: info.publisher || 'Unknown Publisher',
    language: (info.language || 'EN').toUpperCase(),
    ratings_average: info.averageRating || 4.2,
    download_count: 0,
    subjects: info.categories || [],
    epub_url: '',  // Resolved dynamically from Gutendex on read launch
    pdf_url: '',   // Resolved dynamically from Gutendex on read launch
    text_url: '',  // Resolved dynamically from Gutendex on read launch
    source: 'Google Books'
  };
};

// Helper to format Gutendex results into Booklyn unified Book model (used for fallbacks/resolution)
export const formatGutenbergBook = (doc) => {
  const formats = doc.formats || {};
  const coverUrl = formats['image/jpeg'] || '';
  
  const gradients = [
    'from-amber-600 to-amber-950',
    'from-indigo-600 to-indigo-950',
    'from-teal-600 to-teal-950',
    'from-rose-600 to-rose-950',
    'from-emerald-600 to-emerald-950',
    'from-purple-600 to-purple-950',
  ];
  const hash = (doc.title || '').length % gradients.length;
  const coverGradient = gradients[hash];

  const author = doc.authors && doc.authors.length > 0 
    ? cleanAuthorName(doc.authors[0].name) 
    : 'Unknown Author';

  const pagesEstimate = doc.download_count 
    ? Math.max(120, Math.min(850, Math.round((doc.download_count % 350) + 180))) 
    : 250;

  const rating = doc.download_count 
    ? Number(Math.max(3.8, Math.min(5.0, 4.0 + (doc.download_count / 150000))).toFixed(1)) 
    : 4.2;

  // Prioritize EPUB, PDF, and Plain Text download formats
  const epubUrl = formats['application/epub+zip'] || '';
  const pdfUrl = formats['application/pdf'] || '';
  const textUrl = formats['text/plain; charset=utf-8'] || formats['text/plain'] || '';

  return {
    id: String(doc.id),
    title: doc.title || 'Untitled Book',
    author: author,
    cover_url: coverUrl,
    cover_color: coverGradient,
    pages: pagesEstimate,
    genre: doc.subjects && doc.subjects.length > 0 ? doc.subjects[0] : 'Fiction',
    publish_year: doc.authors && doc.authors.length > 0 && doc.authors[0].birth_year 
      ? String(doc.authors[0].birth_year) 
      : 'Classic',
    publisher: 'Project Gutenberg',
    language: doc.languages && doc.languages.length > 0 
      ? doc.languages[0].toUpperCase() 
      : 'EN',
    ratings_average: rating,
    download_count: doc.download_count || 0,
    subjects: doc.subjects || [],
    epub_url: epubUrl,
    pdf_url: pdfUrl,
    text_url: textUrl,
    source: 'Project Gutenberg'
  };
};

// Curated offline fallback classics index
const OFFLINE_GUTENBERG_CLASSICS = [
  {
    id: '1342', title: 'Pride and Prejudice', author: 'Jane Austen',
    cover_url: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
    cover_color: 'from-rose-700 to-rose-950', pages: 350, genre: 'Romance',
    publish_year: '1813', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.9, download_count: 105100,
    subjects: ['Romance', 'English literature'],
    epub_url: 'https://www.gutenberg.org/cache/epub/1342/pg1342.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/1342/pg1342.txt', source: 'Offline Fallback'
  },
  {
    id: '84', title: 'Frankenstein; Or, The Modern Prometheus', author: 'Mary Wollstonecraft Shelley',
    cover_url: 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg',
    cover_color: 'from-emerald-700 to-emerald-950', pages: 280, genre: 'Horror',
    publish_year: '1818', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.8, download_count: 85200,
    subjects: ['Horror', 'Gothic fiction', 'Science fiction'],
    epub_url: 'https://www.gutenberg.org/cache/epub/84/pg84.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/84/pg84.txt', source: 'Offline Fallback'
  },
  {
    id: '2701', title: 'Moby Dick; Or, The Whale', author: 'Herman Melville',
    cover_url: 'https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg',
    cover_color: 'from-indigo-700 to-indigo-950', pages: 620, genre: 'Adventure',
    publish_year: '1851', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.6, download_count: 48500,
    subjects: ['Adventure', 'Sea stories', 'Whaling'],
    epub_url: 'https://www.gutenberg.org/cache/epub/2701/pg2701.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/2701/pg2701.txt', source: 'Offline Fallback'
  },
  {
    id: '1661', title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle',
    cover_url: 'https://www.gutenberg.org/cache/epub/1661/pg1661.cover.medium.jpg',
    cover_color: 'from-teal-700 to-teal-950', pages: 320, genre: 'Mystery',
    publish_year: '1892', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.7, download_count: 67300,
    subjects: ['Detective stories', 'Mystery'],
    epub_url: 'https://www.gutenberg.org/cache/epub/1661/pg1661.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/1661/pg1661.txt', source: 'Offline Fallback'
  },
  {
    id: '11', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll',
    cover_url: 'https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg',
    cover_color: 'from-purple-700 to-purple-950', pages: 190, genre: 'Fantasy',
    publish_year: '1865', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.5, download_count: 51200,
    subjects: ["Fantasy", "Children's literature"],
    epub_url: 'https://www.gutenberg.org/cache/epub/11/pg11.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/11/pg11.txt', source: 'Offline Fallback'
  },
  {
    id: '345', title: 'Dracula', author: 'Bram Stoker',
    cover_url: 'https://www.gutenberg.org/cache/epub/345/pg345.cover.medium.jpg',
    cover_color: 'from-red-900 to-slate-950', pages: 418, genre: 'Horror',
    publish_year: '1897', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.7, download_count: 75000,
    subjects: ['Vampires', 'Horror', 'Gothic fiction'],
    epub_url: 'https://www.gutenberg.org/cache/epub/345/pg345.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/345/pg345.txt', source: 'Offline Fallback'
  },
  {
    id: '174', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde',
    cover_url: 'https://www.gutenberg.org/cache/epub/174/pg174.cover.medium.jpg',
    cover_color: 'from-violet-700 to-violet-950', pages: 254, genre: 'Gothic',
    publish_year: '1890', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.8, download_count: 60100,
    subjects: ['Gothic fiction', 'Philosophical novel'],
    epub_url: 'https://www.gutenberg.org/cache/epub/174/pg174.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/174/pg174.txt', source: 'Offline Fallback'
  },
  {
    id: '1260', title: 'Jane Eyre', author: 'Charlotte Brontë',
    cover_url: 'https://www.gutenberg.org/cache/epub/1260/pg1260.cover.medium.jpg',
    cover_color: 'from-pink-700 to-pink-950', pages: 532, genre: 'Romance',
    publish_year: '1847', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.8, download_count: 78000,
    subjects: ['Romance', 'Gothic', 'Bildungsroman'],
    epub_url: 'https://www.gutenberg.org/cache/epub/1260/pg1260.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/1260/pg1260.txt', source: 'Offline Fallback'
  },
  {
    id: '98', title: 'A Tale of Two Cities', author: 'Charles Dickens',
    cover_url: 'https://www.gutenberg.org/cache/epub/98/pg98.cover.medium.jpg',
    cover_color: 'from-orange-700 to-orange-950', pages: 413, genre: 'Historical Fiction',
    publish_year: '1859', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.7, download_count: 57000,
    subjects: ['Historical fiction', 'French Revolution'],
    epub_url: 'https://www.gutenberg.org/cache/epub/98/pg98.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/98/pg98.txt', source: 'Offline Fallback'
  },
  {
    id: '1400', title: 'Great Expectations', author: 'Charles Dickens',
    cover_url: 'https://www.gutenberg.org/cache/epub/1400/pg1400.cover.medium.jpg',
    cover_color: 'from-amber-700 to-amber-950', pages: 504, genre: 'Fiction',
    publish_year: '1861', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.6, download_count: 42000,
    subjects: ['Coming-of-age', 'Victorian fiction'],
    epub_url: 'https://www.gutenberg.org/cache/epub/1400/pg1400.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/1400/pg1400.txt', source: 'Offline Fallback'
  },
  {
    id: '76', title: 'Adventures of Huckleberry Finn', author: 'Mark Twain',
    cover_url: 'https://www.gutenberg.org/cache/epub/76/pg76.cover.medium.jpg',
    cover_color: 'from-sky-700 to-sky-950', pages: 366, genre: 'Adventure',
    publish_year: '1884', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.5, download_count: 55000,
    subjects: ['Adventure', 'American literature', 'Coming-of-age'],
    epub_url: 'https://www.gutenberg.org/cache/epub/76/pg76.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/76/pg76.txt', source: 'Offline Fallback'
  },
  {
    id: '158', title: 'Emma', author: 'Jane Austen',
    cover_url: 'https://www.gutenberg.org/cache/epub/158/pg158.cover.medium.jpg',
    cover_color: 'from-fuchsia-700 to-fuchsia-950', pages: 474, genre: 'Romance',
    publish_year: '1815', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.6, download_count: 43000,
    subjects: ['Romance', 'Comedy of manners'],
    epub_url: 'https://www.gutenberg.org/cache/epub/158/pg158.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/158/pg158.txt', source: 'Offline Fallback'
  },
  {
    id: '5200', title: 'Metamorphosis', author: 'Franz Kafka',
    cover_url: 'https://www.gutenberg.org/cache/epub/5200/pg5200.cover.medium.jpg',
    cover_color: 'from-zinc-700 to-zinc-950', pages: 72, genre: 'Fiction',
    publish_year: '1915', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.6, download_count: 61000,
    subjects: ['Existentialism', 'Surreal fiction'],
    epub_url: 'https://www.gutenberg.org/cache/epub/5200/pg5200.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/5200/pg5200.txt', source: 'Offline Fallback'
  },
  {
    id: '514', title: 'Little Women', author: 'Louisa May Alcott',
    cover_url: 'https://www.gutenberg.org/cache/epub/514/pg514.cover.medium.jpg',
    cover_color: 'from-green-700 to-green-950', pages: 449, genre: 'Fiction',
    publish_year: '1868', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.7, download_count: 53000,
    subjects: ['Family', 'Coming-of-age', 'American literature'],
    epub_url: 'https://www.gutenberg.org/cache/epub/514/pg514.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/514/pg514.txt', source: 'Offline Fallback'
  },
  {
    id: '219', title: 'Heart of Darkness', author: 'Joseph Conrad',
    cover_url: 'https://www.gutenberg.org/cache/epub/219/pg219.cover.medium.jpg',
    cover_color: 'from-neutral-700 to-neutral-950', pages: 105, genre: 'Fiction',
    publish_year: '1899', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.4, download_count: 38000,
    subjects: ['Imperialism', 'Psychological fiction'],
    epub_url: 'https://www.gutenberg.org/cache/epub/219/pg219.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/219/pg219.txt', source: 'Offline Fallback'
  },
  {
    id: '161', title: 'Sense and Sensibility', author: 'Jane Austen',
    cover_url: 'https://www.gutenberg.org/cache/epub/161/pg161.cover.medium.jpg',
    cover_color: 'from-rose-600 to-pink-950', pages: 374, genre: 'Romance',
    publish_year: '1811', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.7, download_count: 49000,
    subjects: ['Romance', 'Regency fiction'],
    epub_url: 'https://www.gutenberg.org/cache/epub/161/pg161.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/161/pg161.txt', source: 'Offline Fallback'
  },
  {
    id: '2542', title: "A Doll's House", author: 'Henrik Ibsen',
    cover_url: 'https://www.gutenberg.org/cache/epub/2542/pg2542.cover.medium.jpg',
    cover_color: 'from-cyan-700 to-cyan-950', pages: 92, genre: 'Drama',
    publish_year: '1879', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.4, download_count: 27000,
    subjects: ['Drama', 'Feminist literature'],
    epub_url: 'https://www.gutenberg.org/cache/epub/2542/pg2542.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/2542/pg2542.txt', source: 'Offline Fallback'
  },
  {
    id: '1952', title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman',
    cover_url: 'https://www.gutenberg.org/cache/epub/1952/pg1952.cover.medium.jpg',
    cover_color: 'from-yellow-700 to-yellow-950', pages: 36, genre: 'Fiction',
    publish_year: '1892', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.5, download_count: 29000,
    subjects: ['Psychological fiction', "Women's studies"],
    epub_url: 'https://www.gutenberg.org/cache/epub/1952/pg1952.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/1952/pg1952.txt', source: 'Offline Fallback'
  },
  {
    id: '1952b', title: 'The Strange Case of Dr Jekyll and Mr Hyde', author: 'Robert Louis Stevenson',
    cover_url: 'https://www.gutenberg.org/cache/epub/43/pg43.cover.medium.jpg',
    cover_color: 'from-slate-700 to-slate-950', pages: 141, genre: 'Horror',
    publish_year: '1886', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.6, download_count: 44000,
    subjects: ['Gothic fiction', 'Horror', 'Psychological thriller'],
    epub_url: 'https://www.gutenberg.org/cache/epub/43/pg43.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/43/pg43.txt', source: 'Offline Fallback'
  },
  {
    id: '16328', title: 'Beowulf', author: 'Unknown',
    cover_url: 'https://www.gutenberg.org/cache/epub/16328/pg16328.cover.medium.jpg',
    cover_color: 'from-stone-700 to-stone-950', pages: 99, genre: 'Epic Poetry',
    publish_year: '1000', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.3, download_count: 22000,
    subjects: ['Epic poetry', 'Old English literature'],
    epub_url: 'https://www.gutenberg.org/cache/epub/16328/pg16328.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/16328/pg16328.txt', source: 'Offline Fallback'
  },
  {
    id: '1696', title: 'A Vindication of the Rights of Woman', author: 'Mary Wollstonecraft',
    cover_url: 'https://www.gutenberg.org/cache/epub/1696/pg1696.cover.medium.jpg',
    cover_color: 'from-purple-700 to-purple-950', pages: 280, genre: 'Philosophy',
    publish_year: '1792', publisher: 'Project Gutenberg', language: 'EN',
    ratings_average: 4.4, download_count: 18500,
    subjects: ['Philosophy', 'Feminism', 'Women\'s rights'],
    epub_url: 'https://www.gutenberg.org/cache/epub/1696/pg1696.epub',
    pdf_url: '', text_url: 'https://www.gutenberg.org/cache/epub/1696/pg1696.txt', source: 'Offline Fallback'
  }
];

export const booksApi = {
  /**
   * Search books from Google Books API
   */
  searchBooks: async (query, page = 1, limit = 15) => {
    if (!query || query.trim() === '') {
      return { books: [], source: 'Empty' };
    }

    try {
      const response = await axiosInstance.get(GOOGLE_BOOKS_URL, {
        params: {
          q: query,
          startIndex: (page - 1) * limit,
          maxResults: limit,
          printType: 'books'
        }
      });

      if (response.data && response.data.items) {
        const books = response.data.items.map(formatGoogleBook);
        return {
          books: books,
          source: 'Google Books API'
        };
      }
      return { books: [], source: 'Google Books API (No results)' };
    } catch (err) {
      console.warn('Google Books Search failed, checking offline fallback index:', err.message);
      
      const lower = query.toLowerCase();
      const matches = OFFLINE_GUTENBERG_CLASSICS.filter(
        b => b.title.toLowerCase().includes(lower) || b.author.toLowerCase().includes(lower)
      );
      
      return {
        books: matches.length > 0 ? matches : OFFLINE_GUTENBERG_CLASSICS,
        source: 'Offline Sandbox Index (Google Fallback)'
      };
    }
  },

  /**
   * Fetch daily trending books using Google Books (querying top bestsellers/fiction)
   */
  getTrendingBooks: async (page = 1) => {
    try {
      const response = await axiosInstance.get(GOOGLE_BOOKS_URL, {
        params: {
          q: 'subject:fiction',
          orderBy: 'relevance',
          startIndex: (page - 1) * 15,
          maxResults: 15,
          printType: 'books'
        }
      });

      if (response.data && response.data.items) {
        return response.data.items.map(formatGoogleBook);
      }
    } catch (err) {
      console.error('Failed to fetch popular books from Google Books:', err.message);
    }
    return OFFLINE_GUTENBERG_CLASSICS;
  },

  /**
   * Fetch detailed synopsis/description for a specific Book ID
   */
  getBookDescription: async (id) => {
    if (!id) return 'No description is available for this edition.';

    if (String(id).startsWith('pdf-')) {
      return 'Personal imported local PDF book available for offline reading in your Booklyn sanctuary.';
    }

    // Google Books volume detail fetch
    if (String(id).startsWith('gb-')) {
      const cleanId = id.replace('gb-', '');
      try {
        const response = await axiosInstance.get(`${GOOGLE_BOOKS_URL}/${cleanId}`);
        if (response.data && response.data.volumeInfo) {
          return response.data.volumeInfo.description || 'No description is available for this Google Books volume.';
        }
      } catch (err) {
        console.warn(`Could not resolve Google Books details for ID ${cleanId}:`, err.message);
      }
    } else {
      // Gutenberg detail fetch via backend proxy to bypass CORS
      try {
        const response = await axiosInstance.get(`/api/books/detail/${id}`);
        if (response.data) {
          const doc = response.data;
          if (doc.description) {
            return doc.description;
          }
          return `"${doc.title}" is a renowned literature milestone by ${doc.author}. This digital edition is officially catalogued under Project Gutenberg.`;
        }
      } catch (err) {
        console.warn(`Could not resolve Gutendex details for ID ${id} via proxy:`, err.message);
      }
    }

    // Match offline fallbacks
    const fallback = OFFLINE_GUTENBERG_CLASSICS.find(b => b.id === String(id));
    if (fallback) {
      return `"${fallback.title}" is a renowned literature milestone by ${fallback.author}. Direct reflowable EPUB is available in your Booklyn.`;
    }

    return 'A classic masterpiece available for in-app reading inside Booklyn.';
  },

  // Alias for detail resolver
  getBookDetails: async (id) => {
    return booksApi.getBookDescription(id);
  },

  /**
   * Fetch books by genre/subject keyword from Google Books API
   */
  searchBySubject: async (subject, page = 1) => {
    try {
      const response = await axiosInstance.get(GOOGLE_BOOKS_URL, {
        params: {
          q: `subject:${subject}`,
          startIndex: (page - 1) * 12,
          maxResults: 12,
          printType: 'books'
        }
      });

      if (response.data && response.data.items) {
        return response.data.items.map(formatGoogleBook);
      }
    } catch (err) {
      console.warn(`Google Books Subject search failed for "${subject}":`, err.message);
    }
    
    return OFFLINE_GUTENBERG_CLASSICS.filter(
      b => b.genre.toLowerCase().includes(subject.toLowerCase()) || 
           b.subjects.some(s => s.toLowerCase().includes(subject.toLowerCase()))
    );
  },

  /**
   * Fetch books by subject with a simple interface
   */
  getBooksBySubject: async (subject, limit = 12) => {
    const results = await booksApi.searchBySubject(subject, 1);
    return results.slice(0, limit);
  },

  /**
   * Fetch short reads
   */
  getShortReads: async (keyword = 'fiction', limit = 10) => {
    const results = await booksApi.searchBooks(keyword, 1, limit * 2);
    return results.books.filter(b => b.pages <= 300).slice(0, limit);
  },

  /**
   * Dynamic Ebook Format Resolver using Gutendex
   * Searches Gutendex and extracts ONLY direct readable formats (EPUB, PDF, Plain Text)
   * Ignoring text/html links or external webpage redirects.
   */
  resolveGutenbergFiles: async (title, author) => {
    if (!title) return null;

    try {
      // Search Gutendex using the backend search proxy to bypass CORS
      const response = await axiosInstance.get('/api/books/gutenberg/search', {
        params: {
          q: title
        }
      });

      if (response.data && response.data.results && response.data.results.length > 0) {
        // Find best match in the results
        const queryTitleClean = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const queryAuthorClean = author ? author.toLowerCase().split(',')[0].trim() : '';

        // Prioritize match where both title and author contains elements of the query
        let match = response.data.results.find(doc => {
          const docTitle = doc.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
          const docAuthor = doc.authors && doc.authors.length > 0 ? doc.authors[0].name.toLowerCase() : '';
          
          const titleMatch = docTitle.includes(queryTitleClean) || queryTitleClean.includes(docTitle);
          const authorMatch = !queryAuthorClean || docAuthor.includes(queryAuthorClean);
          
          return titleMatch && authorMatch;
        });

        // Fallback to first result if exact match is not found
        if (!match) {
          match = response.data.results.find(doc => {
            const docTitle = doc.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
            return docTitle.includes(queryTitleClean) || queryTitleClean.includes(docTitle);
          });
        }

        if (match) {
          const formats = match.formats || {};
          
          // Priority file formats: epub -> pdf -> plain text
          const epubUrl = formats['application/epub+zip'] || '';
          const pdfUrl = formats['application/pdf'] || '';
          const textUrl = formats['text/plain; charset=utf-8'] || formats['text/plain'] || '';

          // Only return direct downloadable formats (ignore webpage links and text/html)
          return {
            id: String(match.id),
            epub_url: epubUrl,
            pdf_url: pdfUrl,
            text_url: textUrl
          };
        }
      }
    } catch (err) {
      console.warn('Failed to resolve Gutenberg files for:', title, err.message);
    }

    // Try matching our offline index
    const cleanQuery = title.toLowerCase().trim();
    const fallback = OFFLINE_GUTENBERG_CLASSICS.find(
      b => b.title.toLowerCase().includes(cleanQuery) || cleanQuery.includes(b.title.toLowerCase())
    );

    if (fallback) {
      return {
        id: fallback.id,
        epub_url: fallback.epub_url,
        pdf_url: fallback.pdf_url,
        text_url: fallback.text_url
      };
    }

    return null;
  },

  /**
   * Fetch a single book by ID, branching for Google Books and Project Gutenberg
   * WITH TIMEOUT PROTECTION AND COMPREHENSIVE FALLBACKS
   */
  getBook: async (id) => {
    if (!id) throw new Error('ID is required');
    
    console.log('[BooksAPI] getBook() START - ID:', id, 'Type:', typeof id);
    
    // Helper: Timeout wrapper
    const withTimeout = (promise, ms = 8000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Book fetch timeout after ${ms}ms`)), ms)
        )
      ]);
    };
    
    // Convert to string for consistent handling
    const idStr = String(id).trim();
    console.log('[BooksAPI] Normalized ID:', idStr);
    
    // Google Books ID (starts with 'gb-')
    if (idStr.startsWith('gb-')) {
      const cleanId = idStr.replace('gb-', '');
      try {
        console.log('[BooksAPI] Route: Google Books - cleanId:', cleanId);
        const response = await withTimeout(
          axiosInstance.get(`${GOOGLE_BOOKS_URL}/${cleanId}`),
          8000
        );
        console.log('[BooksAPI] ✅ Google Books response:', response.data.volumeInfo?.title);
        return formatGoogleBook(response.data);
      } catch (err) {
        console.warn('[BooksAPI] ❌ Google Books fetch failed:', err.message);
        // Try offline fallback
        const fallback = OFFLINE_GUTENBERG_CLASSICS.find(b => b.id === idStr);
        if (fallback) {
          console.log('[BooksAPI] Using offline fallback for gb- ID:', idStr);
          return fallback;
        }
        throw err;
      }
    } 
    // Gutenberg ID (numeric only)
    else if (/^\d+$/.test(idStr)) {
      try {
        console.log('[BooksAPI] Route: Backend Proxy - numeric ID:', idStr);
        const response = await withTimeout(
          axiosInstance.get(`/api/books/detail/${idStr}`),
          15000
        );
        if (!response.data || !response.data.id) {
          throw new Error('Invalid response from backend proxy');
        }
        console.log('[BooksAPI] ✅ Backend proxy response:', response.data.title);
        return response.data;
      } catch (err) {
        console.warn('[BooksAPI] ❌ Gutendex fetch failed for ID', idStr, ':', err.message);
        // Try offline fallback
        const fallback = OFFLINE_GUTENBERG_CLASSICS.find(b => b.id === String(idStr));
        if (fallback) {
          console.log('[BooksAPI] ✅ Using offline fallback for numeric ID:', idStr);
          return fallback;
        }
        // Create synthetic book instead of throwing
        console.warn('[BooksAPI] Creating synthetic book for unknown ID:', idStr);
        return {
          id: idStr,
          title: 'Classic Literature from Project Gutenberg',
          author: 'Unknown Author',
          cover_url: '',
          cover_color: 'from-indigo-600 to-indigo-950',
          pages: 300,
          genre: 'Literature',
          publish_year: 'Classic',
          publisher: 'Project Gutenberg',
          language: 'EN',
          ratings_average: 4.2,
          download_count: 0,
          subjects: ['Classic', 'Literature'],
          epub_url: `https://www.gutenberg.org/cache/epub/${idStr}/pg${idStr}.epub`,
          pdf_url: '',
          text_url: `https://www.gutenberg.org/cache/epub/${idStr}/pg${idStr}.txt`,
          source: 'Project Gutenberg (API Unavailable)'
        };
      }
    }
    // Fallback for unknown ID format: check offline classics first
    else {
      console.warn('[BooksAPI] Route: Unknown format - ID:', idStr);
      // Try exact match in offline classics
      let fallback = OFFLINE_GUTENBERG_CLASSICS.find(b => b.id === idStr);
      if (fallback) {
        console.log('[BooksAPI] ✅ Found in offline classics (exact match):', idStr);
        return fallback;
      }
      
      // Try partial match by title
      fallback = OFFLINE_GUTENBERG_CLASSICS.find(b => 
        b.title.toLowerCase().includes(idStr.toLowerCase()) ||
        idStr.toLowerCase().includes(b.id)
      );
      if (fallback) {
        console.log('[BooksAPI] ✅ Found in offline classics (partial match):', fallback.title);
        return fallback;
      }
      
      // Try as numeric if it looks like a number
      if (!isNaN(idStr)) {
        console.log('[BooksAPI] Retrying as numeric ID via backend proxy:', idStr);
        try {
          const response = await withTimeout(
            axiosInstance.get(`/api/books/detail/${idStr}`),
            8000
          );
          console.log('[BooksAPI] ✅ Backend proxy response (numeric retry):', response.data.title);
          return response.data;
        } catch (numErr) {
          console.warn('[BooksAPI] Numeric retry failed:', numErr.message);
        }
      }
      
      console.error('[BooksAPI] ❌ All attempts failed for ID:', idStr);
      throw new Error(`Book not found: "${idStr}". ID format not recognized and not in offline database.`);
    }
  }
};
