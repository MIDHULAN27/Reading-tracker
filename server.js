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
    id: '15654', title: 'As a Man Thinketh',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/15654/pg15654.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/15654/pg15654.epub' },
    authors: [{ name: 'Allen, James', birth_year: 1864 }], download_count: 72000, subjects: ['Self-Help', 'Mindset', 'Inspiration']
  },
  {
    id: '13446', title: 'The Art of Money Getting',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/13446/pg13446.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/13446/pg13446.epub' },
    authors: [{ name: 'Barnum, P. T.', birth_year: 1810 }], download_count: 31000, subjects: ['Personal Finance', 'Success', 'Productivity']
  },
  {
    id: '2274', title: 'How to Live on 24 Hours a Day',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/2274/pg2274.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/2274/pg2274.epub' },
    authors: [{ name: 'Bennett, Arnold', birth_year: 1867 }], download_count: 28000, subjects: ['Productivity', 'Time Management', 'Self-Improvement']
  },
  {
    id: '16847', title: 'The Power of Concentration',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/16847/pg16847.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/16847/pg16847.epub' },
    authors: [{ name: 'Dumont, Theron Q.', birth_year: 1862 }], download_count: 24000, subjects: ['Psychology', 'Mental discipline', 'Self-Help']
  },
  {
    id: '13700', title: 'Self Help; with Illustrations of Character and Conduct',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/13700/pg13700.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/13700/pg13700.epub' },
    authors: [{ name: 'Smiles, Samuel', birth_year: 1812 }], download_count: 14000, subjects: ['Self-Improvement', 'Perseverance', 'Biography']
  },
  {
    id: '18451', title: 'An Iron Will',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/18451/pg18451.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/18451/pg18451.epub' },
    authors: [{ name: 'Marden, Orison Swett', birth_year: 1848 }], download_count: 12000, subjects: ['Will power', 'Determination', 'Success']
  },
  {
    id: '2362', title: 'Mental Efficiency, and Other Hints to Men and Women',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/2362/pg2362.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/2362/pg2362.epub' },
    authors: [{ name: 'Bennett, Arnold', birth_year: 1867 }], download_count: 9500, subjects: ['Intellectual efficiency', 'Practical living']
  },
  {
    id: '24508', title: 'The Mastery of Destiny',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/24508/pg24508.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/24508/pg24508.epub' },
    authors: [{ name: 'Allen, James', birth_year: 1864 }], download_count: 8200, subjects: ['Mind and body', 'Self-improvement', 'Destiny']
  },
  {
    id: '13415', title: 'Character',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/13415/pg13415.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/13415/pg13415.epub' },
    authors: [{ name: 'Smiles, Samuel', birth_year: 1812 }], download_count: 7500, subjects: ['Ethics', 'Character development', 'Conduct of life']
  },
  {
    id: '14418', title: 'Thrift',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/14418/pg14418.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/14418/pg14418.epub' },
    authors: [{ name: 'Smiles, Samuel', birth_year: 1812 }], download_count: 9800, subjects: ['Thrift', 'Industry', 'Economy']
  },
  {
    id: '368', title: 'Acres of Diamonds',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/368/pg368.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/368/pg368.epub' },
    authors: [{ name: 'Conwell, Russell H.', birth_year: 1843 }], download_count: 15000, subjects: ['Success', 'Motivation', 'Inspiration']
  },
  {
    id: '1219', title: 'Thought Vibration',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/1219/pg1219.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/1219/pg1219.epub' },
    authors: [{ name: 'Atkinson, William Walker', birth_year: 1862 }], download_count: 22000, subjects: ['Law of Attraction', 'Self-Help', 'Mindset']
  },
  {
    id: '18605', title: 'Memory: How to Develop, Train and Use It',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/18605/pg18605.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/18605/pg18605.epub' },
    authors: [{ name: 'Atkinson, William Walker', birth_year: 1862 }], download_count: 18000, subjects: ['Memory training', 'Productivity', 'Self-Help']
  },
  {
    id: '30046', title: 'The Art of Logical Thinking',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/30046/pg30046.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/30046/pg30046.epub' },
    authors: [{ name: 'Atkinson, William Walker', birth_year: 1862 }], download_count: 11000, subjects: ['Logic', 'Mind training', 'Self-Improvement']
  },
  {
    id: '2841', title: 'The Human Machine',
    formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/2841/pg2841.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/cache/epub/2841/pg2841.epub' },
    authors: [{ name: 'Bennett, Arnold', birth_year: 1867 }], download_count: 8500, subjects: ['Self-Improvement', 'Philosophy of life']
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
        .slice(0, 28); // Fetch up to 28 unique books per endpoint to ensure client has plenty to deduplicate

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
  return fetchGutenbergBooks({}, 'trending', 'Trending Reads');
}

export async function fetchFreeBooks() {
  // Simply fetches a popular page, representing rich free items (using page 2 to avoid duplicate trending items)
  return fetchGutenbergBooks({ page: 2 }, 'free_reads', 'Free Classics');
}

export async function fetchClassicBooks() {
  // Fetch popular page 3 to offset and avoid overlapping with trending/free
  return fetchGutenbergBooks({ page: 3 }, 'classics', 'Timeless Masterpieces');
}

export async function fetchFantasyBooks() {
  return fetchGutenbergBooks({ topic: 'fantasy' }, 'fantasy', 'Fantasy & Magic');
}

export async function fetchSciFiBooks() {
  return fetchGutenbergBooks({ topic: 'science fiction' }, 'scifi', 'Science Fiction');
}

export async function fetchMysteryBooks() {
  return fetchGutenbergBooks({ topic: 'mystery' }, 'mystery', 'Mystery & Detective');
}

export async function fetchRomanceBooks() {
  return fetchGutenbergBooks({ topic: 'romance' }, 'romance', 'Romance Classics');
}

export async function fetchPhilosophyBooks() {
  return fetchGutenbergBooks({ topic: 'philosophy' }, 'philosophy', 'Philosophy');
}

export async function fetchHorrorBooks() {
  return fetchGutenbergBooks({ topic: 'horror' }, 'horror', 'Horror');
}

export async function fetchAdventureBooks() {
  return fetchGutenbergBooks({ topic: 'adventure' }, 'adventure', 'Adventure');
}

export async function fetchHistoricalFictionBooks() {
  return fetchGutenbergBooks({ topic: 'historical fiction' }, 'historical', 'Historical Fiction');
}

// DYNAMIC CATEGORY RESOLUTION mapping
async function fetchCategoryBooks(genre) {
  const genreLower = genre.toLowerCase();
  const cacheKey = `category_${genreLower}`;
  
  if (genreLower === 'trending') return fetchTrendingBooks();
  if (genreLower === 'free' || genreLower === 'free reads' || genreLower === 'free-classics') return fetchFreeBooks();
  if (genreLower === 'classics' || genreLower === 'timeless-masterpieces') return fetchClassicBooks();
  if (genreLower === 'fantasy' || genreLower === 'fantasy-magic') return fetchFantasyBooks();
  if (genreLower === 'sci-fi' || genreLower === 'scifi' || genreLower === 'science-fiction') return fetchSciFiBooks();
  if (genreLower === 'mystery' || genreLower === 'mystery-detective') return fetchMysteryBooks();
  if (genreLower === 'romance' || genreLower === 'romance-classics') return fetchRomanceBooks();
  if (genreLower === 'philosophy') return fetchPhilosophyBooks();
  if (genreLower === 'horror') return fetchHorrorBooks();
  if (genreLower === 'adventure') return fetchAdventureBooks();
  if (genreLower === 'historical-fiction' || genreLower === 'historicalfiction' || genreLower === 'historical') return fetchHistoricalFictionBooks();

  // Curated fallback for Self Help / Productivity with sparse Gutenberg collections
  if (genreLower === 'self-help' || genreLower === 'selfhelp' || genreLower === 'self help') {
    const formatted = CURATED_SELF_HELP.map(b => formatGutenbergBook(b, 'Self Help'));
    return formatted;
  }

  // Gutendex dynamic topic mappings
  return fetchGutenbergBooks({ topic: genre }, cacheKey, genre);
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
  if (selfHelp) return res.json(formatGutenbergBook(selfHelp, 'Self Help'));
  
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
