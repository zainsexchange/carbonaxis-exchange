/**
 * Cache for full reasoning pipeline results.
 * Repeated identical questions skip re-execution.
 */

import {
  buildCacheKey,
  createMemoryCache,
} from "./memoryCache.js";

const cache = createMemoryCache({
  ttlMs: 5 * 60 * 1000,
  maxEntries: 64,
});

function summarizeEvidenceStream(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return "0";
  }

  const ids = items
    .slice(0, 12)
    .map((item) =>
      [
        item.evidenceId || item.id || "",
        item.subjectEntityId || "",
        item.predicate || "",
        item.objectEntityId || "",
        item.confidence ?? "",
      ].join("|"),
    )
    .join(",");

  return `${items.length}:${ids}`;
}

/**
 * @param {object} context
 * @returns {string}
 */
export function buildReasoningCacheKey(
  context = {},
) {
  return buildCacheKey(
    "reasoning",
    context.question || "",
    context.strategy ||
      context.executionPlan?.strategy ||
      "",
    summarizeEvidenceStream(
      context.retrievedChunks,
    ),
    summarizeEvidenceStream(
      context.documentEvidence,
    ),
    summarizeEvidenceStream(
      context.graphEvidence,
    ),
    summarizeEvidenceStream(
      context.inferredEvidence?.length
        ? context.inferredEvidence
        : context.inferredRelationships,
    ),
    summarizeEvidenceStream(
      context.ontologyEvidence,
    ),
  );
}

export function getReasoningCache(key) {
  return cache.get(key);
}

export function setReasoningCache(key, value) {
  return cache.set(key, value);
}

export function clearReasoningCache() {
  cache.clear();
}

export function getReasoningCacheStats() {
  return cache.stats();
}
