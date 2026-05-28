/**
 * Exponential Backoff Retry Utility with Jitter
 * Helps standard APIs absorb network failures, 429 thundering herd hits, and timeouts.
 * 
 * @param {Function} fn - Async operation to execute
 * @param {number} retries - Total retry attempts (default 3)
 * @param {number} delay - Base delay in milliseconds (default 1000)
 * @param {number} factor - Exponential scaling factor (default 2)
 * @param {boolean} jitter - Whether to apply randomized jitter (default true)
 */
export async function fetchWithRetry(fn, retries = 3, delay = 1000, factor = 2, jitter = true) {
  try {
    return await fn();
  } catch (error) {
    // If we've run out of retries, propagate the final error
    if (retries <= 0) {
      throw error;
    }

    // Calculate delay: base * (factor ^ attempt)
    // Attempt pointer runs from 0 upwards
    const attempt = 3 - retries;
    let nextDelay = delay * Math.pow(factor, attempt);

    // Apply randomized jitter (+0 to 1000ms) to spread request spikes
    if (jitter) {
      nextDelay += Math.random() * 1000;
    }

    console.warn(
      `Cozy Reads API: Transient failure encountered. ` +
      `Retrying in ${Math.round(nextDelay)}ms... (${retries} attempts remaining). ` +
      `Reason: "${error.message}"`
    );

    // Sleep for computed delay
    await new Promise((resolve) => setTimeout(resolve, nextDelay));

    // Recurse with decremented retry counter
    return fetchWithRetry(fn, retries - 1, delay, factor, jitter);
  }
}
