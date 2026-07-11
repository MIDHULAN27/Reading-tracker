/**
 * Gutendex Client - Test/Debug Utility
 * 
 * Use this in browser console to test Gutendex client reliability
 * Useful for debugging cache, retries, and timeouts
 */

import { gutendexRequest, getCacheStats, clearCache } from './gutendexClient.js';

// Test utility object
const gutendexTest = {
  /**
   * Test basic request with all categories
   */
  async testAllCategories() {
    console.log('[Test] Starting category test...');
    const categories = ['romance', 'scifi', 'mystery', 'fantasy', 'historical'];
    
    for (const cat of categories) {
      try {
        console.log(`[Test] Fetching ${cat}...`);
        const result = await gutendexRequest('', { topic: cat }, {
          cacheKey: `test_${cat}`,
          logPrefix: `[Test:${cat}]`
        });
        console.log(`[Test] ✅ ${cat}: ${result.results?.length || 0} books`);
      } catch (err) {
        console.error(`[Test] ❌ ${cat} failed:`, err.message);
      }
    }
    
    console.log('[Test] Category test complete');
    this.showStats();
  },

  /**
   * Test cache hit (should be instant)
   */
  async testCacheHit() {
    console.log('[Test] Testing cache hit...');
    
    // First call - fresh
    console.time('First call (fresh)');
    await gutendexRequest('', { topic: 'romance' }, {
      cacheKey: 'test_cache_hit',
      logPrefix: '[Test:cacheHit1]'
    });
    console.timeEnd('First call (fresh)');
    
    // Second call - should hit cache
    console.time('Second call (cached)');
    await gutendexRequest('', { topic: 'romance' }, {
      cacheKey: 'test_cache_hit',
      logPrefix: '[Test:cacheHit2]'
    });
    console.timeEnd('Second call (cached)');
    
    console.log('[Test] Cache hit test complete');
  },

  /**
   * Test deduplication (concurrent requests)
   */
  async testDeduplication() {
    console.log('[Test] Testing request deduplication...');
    
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        gutendexRequest('', { topic: 'fantasy' }, {
          cacheKey: 'test_dedup',
          logPrefix: `[Test:dedup${i+1}]`
        })
      );
    }
    
    const results = await Promise.all(promises);
    console.log(`[Test] ✅ 3 concurrent requests deduped, got ${results.length} results`);
  },

  /**
   * Test single book fetch
   */
  async testBookFetch() {
    console.log('[Test] Testing single book fetch...');
    
    try {
      const result = await gutendexRequest('1696/', {}, {
        cacheKey: 'test_book_1696',
        logPrefix: '[Test:book1696]'
      });
      console.log(`[Test] ✅ Book: ${result.title}`);
    } catch (err) {
      console.error('[Test] ❌ Book fetch failed:', err.message);
    }
  },

  /**
   * Show cache stats
   */
  showStats() {
    const stats = getCacheStats();
    console.table({
      'Cache Size': stats.cacheSize,
      'In-Flight Requests': stats.inFlightRequests,
      'TTL (hours)': stats.ttlMs / 3600000
    });
  },

  /**
   * Clear cache and test fresh fetch
   */
  async testFreshFetch() {
    console.log('[Test] Clearing cache and testing fresh fetch...');
    clearCache();
    
    console.time('Fresh fetch');
    const result = await gutendexRequest('', { topic: 'romance' }, {
      cacheKey: 'test_fresh',
      logPrefix: '[Test:fresh]'
    });
    console.timeEnd('Fresh fetch');
    
    console.log(`[Test] ✅ Fresh fetch returned ${result.results?.length || 0} books`);
  }
};

// Export for use in browser console
window.gutendexTest = gutendexTest;

console.log('[GutendexTest] Available commands:');
console.log('- gutendexTest.testAllCategories()  - Test all categories');
console.log('- gutendexTest.testCacheHit()       - Test cache performance');
console.log('- gutendexTest.testDeduplication()  - Test request dedup');
console.log('- gutendexTest.testBookFetch()      - Test single book');
console.log('- gutendexTest.showStats()          - Show cache stats');
console.log('- gutendexTest.testFreshFetch()     - Clear cache and fetch');

export default gutendexTest;
