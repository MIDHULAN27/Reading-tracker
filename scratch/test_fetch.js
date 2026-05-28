import axios from 'axios';

const GUTENDEX_URL = 'https://gutendex.com/books/';

async function testFetch() {
  const tests = [
    { key: 'trending', params: {} },
    { key: 'free', params: { page: 2 } },
    { key: 'classics', params: { topic: 'fiction' } },
    { key: 'fantasy', params: { topic: 'fantasy' } },
    { key: 'scifi', params: { topic: 'science fiction' } }
  ];

  for (const t of tests) {
    try {
      console.log(`Fetching ${t.key} with params:`, t.params);
      const res = await axios.get(GUTENDEX_URL, { params: t.params });
      const results = res.data?.results || [];
      const withEpub = results.filter(item => item.formats && item.formats['application/epub+zip']);
      console.log(`- Total results: ${results.length}, with EPUB: ${withEpub.length}`);
    } catch (err) {
      console.error(`- Fetch failed for ${t.key}:`, err.message);
    }
  }
}

testFetch();
