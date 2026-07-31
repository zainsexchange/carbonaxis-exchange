/**
 * Lightweight in-memory cache primitives.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 256;

function now() {
  return Date.now();
}

/**
 * @param {object} [options]
 * @returns {object}
 */
export function createMemoryCache(
  options = {},
) {
  const ttlMs = Number.isFinite(
    options.ttlMs,
  )
    ? options.ttlMs
    : DEFAULT_TTL_MS;

  const maxEntries = Number.isFinite(
    options.maxEntries,
  )
    ? options.maxEntries
    : DEFAULT_MAX_ENTRIES;

  const store = new Map();
  const stats = {
    hits: 0,
    misses: 0,
    sets: 0,
  };

  function pruneExpired() {
    const timestamp = now();

    for (const [key, entry] of store) {
      if (entry.expiresAt <= timestamp) {
        store.delete(key);
      }
    }
  }

  function evictIfNeeded() {
    while (store.size > maxEntries) {
      const oldestKey =
        store.keys().next().value;

      if (oldestKey === undefined) {
        break;
      }

      store.delete(oldestKey);
    }
  }

  return {
    get(key) {
      pruneExpired();

      const entry = store.get(String(key));

      if (!entry) {
        stats.misses += 1;
        return null;
      }

      if (entry.expiresAt <= now()) {
        store.delete(String(key));
        stats.misses += 1;
        return null;
      }

      /*
       * Refresh insertion order for simple LRU.
       */
      store.delete(String(key));
      store.set(String(key), entry);

      stats.hits += 1;
      return entry.value;
    },

    set(key, value, entryTtlMs = ttlMs) {
      pruneExpired();

      store.set(String(key), {
        value,
        expiresAt:
          now() +
          (Number.isFinite(entryTtlMs)
            ? entryTtlMs
            : ttlMs),
      });

      stats.sets += 1;
      evictIfNeeded();
      return value;
    },

    has(key) {
      return this.get(key) !== null;
    },

    delete(key) {
      return store.delete(String(key));
    },

    clear() {
      store.clear();
    },

    size() {
      pruneExpired();
      return store.size;
    },

    stats() {
      return { ...stats, size: store.size };
    },
  };
}

/**
 * Stable cache key from mixed parts.
 *
 * @param {...unknown} parts
 * @returns {string}
 */
export function buildCacheKey(...parts) {
  return parts
    .map((part) => {
      if (part == null) {
        return "";
      }

      if (typeof part === "string") {
        return part.trim().toLowerCase();
      }

      try {
        return JSON.stringify(part);
      } catch {
        return String(part);
      }
    })
    .join("::");
}
