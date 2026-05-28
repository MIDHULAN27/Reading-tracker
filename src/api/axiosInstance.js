import axios from 'axios';
import { syncManager } from '../services/syncManager';

// Create central Axios instance
const axiosInstance = axios.create({
  timeout: 10000, // 10 seconds default timeout
});

// Cache map to store GET responses
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Request Interceptor: handles offline checks and caching
axiosInstance.interceptors.request.use(
  (config) => {
    // 1. If we are offline (real or simulated), fail the request immediately
    if (!syncManager.isOnline()) {
      return Promise.reject(new Error('Offline mode'));
    }

    // 2. Only cache GET requests
    if (config.method?.toLowerCase() === 'get') {
      const cacheKey = `${config.url}_${JSON.stringify(config.params || {})}`;
      const cachedItem = responseCache.get(cacheKey);

      if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_TTL) {
        // Cache hit! Return the cached data using a custom adapter
        config.adapter = () => {
          return Promise.resolve({
            data: cachedItem.data,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          });
        };
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: handles saving to cache and retry logic on failures
axiosInstance.interceptors.response.use(
  (response) => {
    const { config } = response;
    
    // Save successful GET results to cache (if not served from the cache adapter itself)
    if (config.method?.toLowerCase() === 'get' && !config.adapter) {
      const cacheKey = `${config.url}_${JSON.stringify(config.params || {})}`;
      responseCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });
    }

    return response;
  },
  async (error) => {
    const { config, response } = error;
    
    // If config doesn't exist, we can't retry
    if (!config) {
      return Promise.reject(error);
    }

    // Set maximum retries (default to 3)
    config.retryAttempts = config.retryAttempts !== undefined ? config.retryAttempts : 3;

    // Detect transient errors: rate limits (429), server errors (503), timeouts, and network failure
    const isTimeout = error.code === 'ECONNABORTED';
    const isNetworkError = !response && error.message && error.message.toLowerCase().includes('network');
    const isRateLimit = response && (response.status === 429 || response.status === 503);

    if ((isTimeout || isNetworkError || isRateLimit) && config.retryAttempts > 0) {
      config.retryAttempts -= 1;

      // Exponential backoff: delay = base * (2 ^ attempt)
      const attempt = 3 - config.retryAttempts;
      const baseDelay = 1000;
      let delay = baseDelay * Math.pow(2, attempt);
      
      // Jitter: add random noise between 0 and 1000ms to reduce spikes
      delay += Math.random() * 1000;

      console.warn(
        `Cozy Reads API: Transient failure (${error.message || 'Error'}). ` +
        `Retrying in ${Math.round(delay)}ms... (${config.retryAttempts} attempts remaining).`
      );

      // Sleep
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Re-run the request
      return axiosInstance(config);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
