/**
 * Cache for graph traversal / neighborhood lookups.
 */

import {
  buildCacheKey,
  createMemoryCache,
} from "./memoryCache.js";

const cache = createMemoryCache({
  ttlMs: 15 * 60 * 1000,
  maxEntries: 256,
});

/**
 * @param {string} entityId
 * @param {object} [options]
 * @returns {string}
 */
export function buildGraphCacheKey(
  entityId = "",
  options = {},
) {
  return buildCacheKey(
    "graph",
    entityId,
    options.maxDepth ?? null,
    options.predicate ?? null,
    options.direction ?? null,
  );
}

export function getGraphCache(key) {
  return cache.get(key);
}

export function setGraphCache(key, value) {
  return cache.set(key, value);
}

export function clearGraphCache() {
  cache.clear();
}

export function getGraphCacheStats() {
  return cache.stats();
}
