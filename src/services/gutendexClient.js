/**
 * Gutendex API Client with Retry Logic, Timeout Handling, and Detailed Logging
 * 
 * Features:
 * - Automatic retries with exponential backoff (3 attempts)
 * - 15-second timeout with AbortController
 * - Detailed request logging and metrics
 * - Request queuing to prevent concurrent spam
 * - Fallback to cache on failure
 * - Socket hang up recovery
 */

const GUTENDEX_URL = 'https://gutendex.com/books/';
const DEFAULT_TIMEOUT = 15000; // 15 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// In-memory cache with TTL
class CacheStore {
  constructor(ttlMs = 3600000) { // 1 hour default
    this.store = new Map();
    this.ttl = ttlMs;
  }

  set(key, value) {
    this.store.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.store.delete(key);
      return null;
    }
    
    return entry.data;
  }

  getExpired(key) {
    const entry = this.store.get(key);
    return entry?.data || null;
  }

  clear() {
    this.store.clear();
  }
}

const cache = new CacheStore();
const requestQueue = new Map(); // Track in-flight requests

/**
 * Resolves request using fallback proxies if the direct connection gets blocked (like Cloudflare 403 on Vercel).
 */
async function fetchWithProxyFallback(fullUrl, timeoutMs) {
  // Try 1: Direct Fetch
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      return await response.json();
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (directErr) {
    console.warn(`[GutendexClient] Direct fetch failed (${directErr.message}), trying proxy fallback 1 (allorigins)...`);
    
    // Try 2: AllOrigins proxy
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(fullUrl)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs + 5000);
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const json = await response.json();
        if (json && json.contents) {
          const parsed = JSON.parse(json.contents);
          console.log('[GutendexClient] Proxy fallback 1 (allorigins) succeeded!');
          return parsed;
        }
      }
      throw new Error(`Proxy 1 failed with status ${response.status}`);
    } catch (proxy1Err) {
      console.warn(`[GutendexClient] Proxy fallback 1 failed (${proxy1Err.message}), trying proxy fallback 2 (codetabs)...`);
      
      // Try 3: CodeTabs proxy
      try {
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(fullUrl)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs + 5000);
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
          return await response.json();
        }
        throw new Error(`Proxy 2 failed with status ${response.status}`);
      } catch (proxy2Err) {
        console.error('[GutendexClient] All proxy fallbacks failed.');
        throw new Error(`All Gutenberg resolve methods failed. Last error: ${proxy2Err.message}`);
      }
    }
  }
}

/**
 * Make a request to Gutendex with retry logic, timeout, and detailed logging
 */
export async function gutendexRequest(endpoint, params = {}, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT,
    maxRetries = MAX_RETRIES,
    cacheKey = null,
    logPrefix = '[GutendexClient]'
  } = options;

  const url = `${GUTENDEX_URL}${endpoint}`;
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  const startTime = Date.now();

  // Check if request is already in flight (prevent concurrent spam)
  if (requestQueue.has(cacheKey || fullUrl)) {
    console.log(`${logPrefix} ⏳ Request in-flight, returning pending: ${endpoint}`, params);
    return requestQueue.get(cacheKey || fullUrl);
  }

  // Check cache first
  if (cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`${logPrefix} ✅ Cache hit for "${cacheKey}" (${Date.now() - startTime}ms)`);
      return Promise.resolve(cached);
    }
  }

  // Create request promise
  const requestPromise = (async () => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `${logPrefix} 📡 Attempt ${attempt}/${maxRetries}: ${endpoint}`,
          Object.keys(params).length > 0 ? params : '(no params)'
        );

        try {
          const data = await fetchWithProxyFallback(fullUrl, timeout);
          const elapsed = Date.now() - startTime;
          console.log(
            `${logPrefix} ✅ Success (${elapsed}ms): ${endpoint} returned ${
              data.results?.length || 0
            } results`
          );

          // Cache on success
          if (cacheKey) {
            cache.set(cacheKey, data);
            console.log(`${logPrefix} 💾 Cached "${cacheKey}"`);
          }

          return data;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        lastError = err;
        const elapsed = Date.now() - startTime;
        const errorType = err.name === 'AbortError' ? 'TIMEOUT' : 'ERROR';
        const errorMsg = err.message || err.toString();

        console.warn(
          `${logPrefix} ⚠️ Attempt ${attempt} failed (${elapsed}ms, ${errorType}):`,
          endpoint,
          errorMsg
        );

        // If this is the last attempt, try returning expired cache
        if (attempt === maxRetries) {
          console.warn(`${logPrefix} ❌ All ${maxRetries} attempts failed`);
          
          if (cacheKey) {
            const expiredCache = cache.getExpired(cacheKey);
            if (expiredCache) {
              console.warn(`${logPrefix} 🔄 Returning expired cache as fallback for "${cacheKey}"`);
              return expiredCache;
            }
          }

          // If no cache, return empty results
          console.warn(`${logPrefix} 📭 No cache available, returning empty results`);
          return { results: [], count: 0 };
        }

        // Exponential backoff before retry
        if (attempt < maxRetries) {
          const delayMs = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
          console.log(`${logPrefix} ⏳ Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // Should not reach here, but just in case
    console.error(`${logPrefix} ❌ Request completely failed:`, endpoint, lastError?.message);
    return { results: [], count: 0 };
  })();

  // Track request
  const queueKey = cacheKey || fullUrl;
  requestQueue.set(queueKey, requestPromise);

  try {
    const result = await requestPromise;
    return result;
  } finally {
    requestQueue.delete(queueKey);
  }
}

/**
 * Fetch books by category/topic with intelligent caching and fallback
 */
export async function fetchBooksByTopic(topic, page = 1) {
  const params = {};
  if (topic && topic !== 'trending') {
    params.topic = topic;
  }
  if (page > 1) {
    params.page = page;
  }

  const cacheKey = topic 
    ? `gutendex_topic_${topic}_page${page}`
    : `gutendex_trending_page${page}`;

  return gutendexRequest('', params, {
    cacheKey,
    timeout: 15000,
    maxRetries: 3,
    logPrefix: `[GutendexClient:${topic || 'trending'}]`
  });
}

/**
 * Fetch a single book by ID
 */
export async function fetchBookById(bookId) {
  if (!bookId) {
    throw new Error('Book ID is required');
  }

  const cacheKey = `gutendex_book_${bookId}`;

  return gutendexRequest(`${bookId}/`, {}, {
    cacheKey,
    timeout: 10000,
    maxRetries: 2,
    logPrefix: `[GutendexClient:book-${bookId}]`
  });
}

/**
 * Clear all caches (useful for testing or forcing refresh)
 */
export function clearCache() {
  cache.clear();
  console.log('[GutendexClient] ✅ All caches cleared');
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats() {
  return {
    cacheSize: cache.store.size,
    inFlightRequests: requestQueue.size,
    ttlMs: cache.ttl
  };
}

export default {
  gutendexRequest,
  fetchBooksByTopic,
  fetchBookById,
  clearCache,
  getCacheStats,
  GUTENDEX_URL
};
