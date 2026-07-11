/**
 * Gutendex Cache Manager with Supabase Support
 * 
 * Provides:
 * 1. In-memory cache (fast, temporary)
 * 2. Supabase persistent cache (survives restart)
 * 3. Fallback chain for maximum reliability
 * 
 * Usage:
 *   import { cacheManager } from '../services/gutendexCacheManager';
 *   
 *   // Store result
 *   await cacheManager.set('romance_1', booksData);
 *   
 *   // Retrieve with fallback
 *   const books = await cacheManager.get('romance_1');
 */

// For now, this is an interface definition
// When Supabase is available, implement the actual methods

const inMemoryCache = new Map();

export const cacheManager = {
  /**
   * Get from cache (in-memory first, then Supabase)
   */
  async get(key) {
    // Try in-memory first (fastest)
    if (inMemoryCache.has(key)) {
      const entry = inMemoryCache.get(key);
      if (Date.now() - entry.timestamp < 3600000) { // 1 hour
        console.log(`[CacheManager] ✅ Hit (memory): ${key}`);
        return entry.data;
      }
      inMemoryCache.delete(key);
    }

    // Try Supabase (when available)
    // const data = await supabase
    //   .from('gutendex_cache')
    //   .select('data')
    //   .eq('key', key)
    //   .gt('expires_at', new Date().toISOString())
    //   .single();
    // if (data) {
    //   console.log(`[CacheManager] ✅ Hit (Supabase): ${key}`);
    //   return JSON.parse(data.data);
    // }

    console.log(`[CacheManager] ❌ Miss: ${key}`);
    return null;
  },

  /**
   * Set cache (both in-memory and Supabase)
   */
  async set(key, data, ttlHours = 24) {
    // Store in-memory
    inMemoryCache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`[CacheManager] 💾 Cached (memory): ${key}`);

    // Store in Supabase (when available)
    // await supabase.from('gutendex_cache').insert({
    //   key,
    //   data: JSON.stringify(data),
    //   expires_at: new Date(Date.now() + ttlHours * 3600000).toISOString(),
    //   created_at: new Date().toISOString()
    // });
  },

  /**
   * Clear all caches
   */
  async clear() {
    inMemoryCache.clear();
    console.log('[CacheManager] ✅ All caches cleared');

    // Clear Supabase when available
    // await supabase.from('gutendex_cache').delete().neq('key', '');
  },

  /**
   * Get stats
   */
  getStats() {
    return {
      inMemorySize: inMemoryCache.size,
      // supabaseSize: (when available)
    };
  }
};

export default cacheManager;
