/**
 * Cache for semantic retrieval results.
 */

import {
  buildCacheKey,
  createMemoryCache,
} from "./memoryCache.js";

const cache = createMemoryCache({
  ttlMs: 10 * 60 * 1000,
  maxEntries: 128,
});

/**
 * @param {string} question
 * @param {object} [options]
 * @returns {string}
 */
export function buildSemanticCacheKey(
  question = "",
  options = {},
) {
  return buildCacheKey(
    "semantic",
    question,
    options.userId || options.user || null,
    options.limit ?? null,
    options.minimumScore ?? null,
  );
}

export function getSemanticCache(key) {
  return cache.get(key);
}

export function setSemanticCache(key, value) {
  return cache.set(key, value);
}

export function clearSemanticCache() {
  cache.clear();
}

export function getSemanticCacheStats() {
  return cache.stats();
}
