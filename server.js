import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const GUTENDEX_URL = 'https://gutendex.com/books/';

// In-Memory Cache implementation
const memoryCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache TTL

const cleanAuthorName = (name) => {
  if (!name) return 'Unknown Author';
  if (Array.isArray(name)) return name.join(', ');
  const parts = name.split(',');
  if (parts.length > 1) {
    return `${parts[1].trim()} ${parts[0].trim()}`;
  }
  return name;
};

// Map Gutendex format to Cozy Reads Unified Book Model
const formatGutenbergBook = (doc, genreOverride = null) => {
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

  const subjectsList = doc.subjects || [];
  const primaryGenre = genreOverride || (subjectsList.length > 0 ? subjectsList[0].split('--')[0].trim() : 'Fiction');

  return {
    id: String(doc.id),
    title: doc.title || 'Untitled Book',
    author: author,
    cover_url: coverUrl,
    cover_color: coverGradient,
    pages: pagesEstimate,
    genre: primaryGenre,
    publish_year: doc.authors && doc.authors.length > 0 && doc.authors[0].birth_year 
      ? String(doc.authors[0].birth_year) 
      : 'Classic',
    publisher: 'Project Gutenberg',
    language: doc.languages && doc.languages.length > 0 
      ? doc.languages[0].toUpperCase() 
      : 'EN',
    ratings_average: rating,
    download_count: doc.download_count || 0,
    subjects: subjectsList,
    epub_url: epubUrl,
    pdf_url: pdfUrl,
    text_url: textUrl,
    source: 'Project Gutenberg'
  };
};

// Highly-Curated legal public-domain self-help / productivity books
const CURATED_SELF_HELP = [
  {
    id: '2680', title: 'Meditations', author: 'Marcus Aurelius',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/2680/pg2680.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/2680/pg2680.epub' },
    authors: [{ name: 'Aurelius, Marcus', birth_year: 121 }], download_count: 85000, subjects: ['Philosophy', 'Stoicism', 'Ethics']
  },
  {
    id: '15654', title: 'As a Man Thinketh', author: 'James Allen',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/15654/pg15654.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/15654/pg15654.epub' },
    authors: [{ name: 'Allen, James', birth_year: 1864 }], download_count: 72000, subjects: ['Self-Help', 'Mindset', 'Inspiration']
  },
  {
    id: '13446', title: 'The Art of Money Getting', author: 'P. T. Barnum',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/13446/pg13446.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/13446/pg13446.epub' },
    authors: [{ name: 'Barnum, P. T.', birth_year: 1810 }], download_count: 31000, subjects: ['Personal Finance', 'Success', 'Productivity']
  },
  {
    id: '2274', title: 'How to Live on 24 Hours a Day', author: 'Arnold Bennett',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/2274/pg2274.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/2274/pg2274.epub' },
    authors: [{ name: 'Bennett, Arnold', birth_year: 1867 }], download_count: 28000, subjects: ['Productivity', 'Time Management', 'Self-Improvement']
  },
  {
    id: '16847', title: 'The Power of Concentration', author: 'Theron Q. Dumont',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/16847/pg16847.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/16847/pg16847.epub' },
    authors: [{ name: 'Dumont, Theron Q.', birth_year: 1862 }], download_count: 24000, subjects: ['Psychology', 'Mental discipline', 'Self-Help']
  },
  {
    id: '13700', title: 'Self Help; with Illustrations of Character and Conduct', author: 'Samuel Smiles',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/13700/pg13700.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/13700/pg13700.epub' },
    authors: [{ name: 'Smiles, Samuel', birth_year: 1812 }], download_count: 14000, subjects: ['Self-Improvement', 'Perseverance', 'Biography']
  },
  {
    id: '18451', title: 'An Iron Will', author: 'Orison Swett Marden',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/18451/pg18451.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/18451/pg18451.epub' },
    authors: [{ name: 'Marden, Orison Swett', birth_year: 1848 }], download_count: 12000, subjects: ['Will power', 'Determination', 'Success']
  },
  {
    id: '2362', title: 'Mental Efficiency, and Other Hints to Men and Women', author: 'Arnold Bennett',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/2362/pg2362.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/2362/pg2362.epub' },
    authors: [{ name: 'Bennett, Arnold', birth_year: 1867 }], download_count: 9500, subjects: ['Intellectual efficiency', 'Practical living']
  },
  {
    id: '24508', title: 'The Mastery of Destiny', author: 'James Allen',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/24508/pg24508.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/24508/pg24508.epub' },
    authors: [{ name: 'Allen, James', birth_year: 1864 }], download_count: 8200, subjects: ['Mind and body', 'Self-improvement', 'Destiny']
  },
  {
    id: '13415', title: 'Character', author: 'Samuel Smiles',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/13415/pg13415.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/13415/pg13415.epub' },
    authors: [{ name: 'Smiles, Samuel', birth_year: 1812 }], download_count: 7500, subjects: ['Ethics', 'Character development', 'Conduct of life']
  }
];

const CURATED_PRODUCTIVITY = [
  {
    id: '2274', title: 'How to Live on 24 Hours a Day', author: 'Arnold Bennett',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/2274/pg2274.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/2274/pg2274.epub' },
    authors: [{ name: 'Bennett, Arnold', birth_year: 1867 }], download_count: 28000, subjects: ['Productivity', 'Time Management', 'Self-Improvement']
  },
  {
    id: '13446', title: 'The Art of Money Getting', author: 'P. T. Barnum',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/13446/pg13446.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/13446/pg13446.epub' },
    authors: [{ name: 'Barnum, P. T.', birth_year: 1810 }], download_count: 31000, subjects: ['Personal Finance', 'Success', 'Productivity']
  },
  {
    id: '27958', title: 'Self-Culture: Intellectual, Physical, and Moral', author: 'John Stuart Blackie',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/27958/pg27958.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/27958/pg27958.epub' },
    authors: [{ name: 'Blackie, John Stuart', birth_year: 1809 }], download_count: 6500, subjects: ['Self-Culture', 'Education', 'Mental Growth']
  },
  {
    id: '13415', title: 'Character', author: 'Samuel Smiles',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/13415/pg13415.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/13415/pg13415.epub' },
    authors: [{ name: 'Smiles, Samuel', birth_year: 1812 }], download_count: 7500, subjects: ['Ethics', 'Character development', 'Conduct of life']
  },
  {
    id: '35055', title: 'The Empire of Business', author: 'Andrew Carnegie',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/35055/pg35055.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/35055/pg35055.epub' },
    authors: [{ name: 'Carnegie, Andrew', birth_year: 1835 }], download_count: 11000, subjects: ['Business', 'Wealth', 'Industry', 'Success']
  },
  {
    id: '14418', title: 'Thrift', author: 'Samuel Smiles',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/14418/pg14418.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/14418/pg14418.epub' },
    authors: [{ name: 'Smiles, Samuel', birth_year: 1812 }], download_count: 9800, subjects: ['Thrift', 'Industry', 'Economy']
  },
  {
    id: '15654', title: 'As a Man Thinketh', author: 'James Allen',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/15654/pg15654.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/15654/pg15654.epub' },
    authors: [{ name: 'Allen, James', birth_year: 1864 }], download_count: 72000, subjects: ['Self-Help', 'Mindset', 'Inspiration']
  },
  {
    id: '16847', title: 'The Power of Concentration', author: 'Theron Q. Dumont',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/16847/pg16847.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/16847/pg16847.epub' },
    authors: [{ name: 'Dumont, Theron Q.', birth_year: 1862 }], download_count: 24000, subjects: ['Psychology', 'Mental discipline', 'Self-Help']
  },
  {
    id: '2680', title: 'Meditations', author: 'Marcus Aurelius',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/2680/pg2680.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/2680/pg2680.epub' },
    authors: [{ name: 'Aurelius, Marcus', birth_year: 121 }], download_count: 85000, subjects: ['Philosophy', 'Stoicism', 'Ethics']
  },
  {
    id: '2362', title: 'Mental Efficiency, and Other Hints to Men and Women', author: 'Arnold Bennett',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/2362/pg2362.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/2362/pg2362.epub' },
    authors: [{ name: 'Bennett, Arnold', birth_year: 1867 }], download_count: 9500, subjects: ['Intellectual efficiency', 'Practical living']
  }
];

// Helper to fetch Gutenberg books with local memory caching
async function fetchGutenbergBooks(urlParams, cacheKey, categoryName = null) {
  const cached = memoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  try {
    const response = await axios.get(GUTENDEX_URL, { params: urlParams });
    if (response.data && response.data.results) {
      // Clean and normalize books
      const normalized = response.data.results
        .filter(item => item.formats && item.formats['application/epub+zip']) // Ensure reflowable EPUB is available
        .map(item => formatGutenbergBook(item, categoryName))
        .slice(0, 10); // Limit to exactly 10 books

      memoryCache.set(cacheKey, {
        data: normalized,
        timestamp: Date.now()
      });
      return normalized;
    }
  } catch (err) {
    console.error(`Gutendex fetch failed for key "${cacheKey}":`, err.message);
  }

  // If memory cache exists but is expired, return expired cache on failure
  if (cached) {
    console.warn(`Returning expired cache data for key "${cacheKey}" as fallback.`);
    return cached.data;
  }

  return [];
}

// REUSABLE SERVICES
export async function fetchTrendingBooks() {
  // Sorted by download count (popularity) automatically in Gutenberg
  return fetchGutenbergBooks({}, 'trending', 'Trending');
}

export async function fetchFreeBooks() {
  // Simply fetches a popular page, representing rich free items
  return fetchGutenbergBooks({ page: 2 }, 'free_reads', 'Free Reads');
}

export async function fetchClassicBooks() {
  return fetchGutenbergBooks({ topic: 'fiction' }, 'classics', 'Classics');
}

export async function fetchFantasyBooks() {
  return fetchGutenbergBooks({ topic: 'fantasy' }, 'fantasy', 'Fantasy');
}

export async function fetchSciFiBooks() {
  return fetchGutenbergBooks({ topic: 'science fiction' }, 'scifi', 'Sci-Fi');
}

// DYNAMIC CATEGORY RESOLUTION mapping
async function fetchCategoryBooks(genre) {
  const genreLower = genre.toLowerCase();
  const cacheKey = `category_${genreLower}`;
  
  if (genreLower === 'trending') return fetchTrendingBooks();
  if (genreLower === 'free' || genreLower === 'free reads') return fetchFreeBooks();
  if (genreLower === 'classics') return fetchClassicBooks();
  if (genreLower === 'fantasy') return fetchFantasyBooks();
  if (genreLower === 'sci-fi' || genreLower === 'scifi') return fetchSciFiBooks();

  // Curated Fallbacks for Modern categories with sparse Gutenberg collections
  if (genreLower === 'self-help' || genreLower === 'selfhelp') {
    const formatted = CURATED_SELF_HELP.map(b => formatGutenbergBook(b, 'Self-Help'));
    return formatted.slice(0, 10);
  }
  if (genreLower === 'productivity') {
    const formatted = CURATED_PRODUCTIVITY.map(b => formatGutenbergBook(b, 'Productivity'));
    return formatted.slice(0, 10);
  }

  // Gutendex dynamic topic mappings
  let topic = genre;
  if (genreLower === 'romance') topic = 'romance';
  else if (genreLower === 'mystery') topic = 'mystery';
  else if (genreLower === 'philosophy') topic = 'philosophy';
  else if (genreLower === 'adventure') topic = 'adventure';

  return fetchGutenbergBooks({ topic }, cacheKey, genre);
}

// REST ENDPOINTS

// GET /api/books/trending
app.get('/api/books/trending', async (req, res) => {
  try {
    const books = await fetchTrendingBooks();
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending books' });
  }
});

// GET /api/books/free
app.get('/api/books/free', async (req, res) => {
  try {
    const books = await fetchFreeBooks();
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch free books' });
  }
});

// GET /api/books/classics
app.get('/api/books/classics', async (req, res) => {
  try {
    const books = await fetchClassicBooks();
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch classic books' });
  }
});

// GET /api/books/category/:genre
app.get('/api/books/category/:genre', async (req, res) => {
  const { genre } = req.params;
  try {
    const books = await fetchCategoryBooks(genre);
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch category ${genre}` });
  }
});

// GET /api/books/detail/:id
app.get('/api/books/detail/:id', async (req, res) => {
  const { id } = req.params;
  const selfHelp = CURATED_SELF_HELP.find(b => String(b.id) === String(id));
  if (selfHelp) return res.json(formatGutenbergBook(selfHelp, 'Self-Help'));
  const prod = CURATED_PRODUCTIVITY.find(b => String(b.id) === String(id));
  if (prod) return res.json(formatGutenbergBook(prod, 'Productivity'));
  
  for (const [_, cacheEntry] of memoryCache.entries()) {
    const found = cacheEntry.data.find(b => String(b.id) === String(id));
    if (found) return res.json(found);
  }
  try {
    const response = await axios.get(`${GUTENDEX_URL}${id}/`);
    if (response.data) return res.json(formatGutenbergBook(response.data));
  } catch (err) {
    console.error(`Gutenberg fetch detail failed for ID ${id}:`, err.message);
  }
  res.status(404).json({ error: 'Book details not found on Project Gutenberg catalog' });
});

app.listen(PORT, () => {
  console.log(`[Booklyn Backend] Server is running on port ${PORT}`);
});
