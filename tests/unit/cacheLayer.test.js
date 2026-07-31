import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  buildSemanticCacheKey,
  getSemanticCache,
  setSemanticCache,
  clearSemanticCache,
} from "../../intelligence/cache/semanticCache.js";

import {
  buildGraphCacheKey,
  getGraphCache,
  setGraphCache,
  clearGraphCache,
} from "../../intelligence/cache/graphCache.js";

import {
  buildReasoningCacheKey,
  getReasoningCache,
  setReasoningCache,
  clearReasoningCache,
  getReasoningCacheStats,
} from "../../intelligence/cache/reasoningCache.js";

describe("Cache Layer", () => {
  it("stores and retrieves semantic cache entries", () => {
    clearSemanticCache();

    const key = buildSemanticCacheKey(
      "What is Green Hydrogen?",
      { limit: 8 },
    );

    setSemanticCache(key, { hits: [1, 2] });
    assert.deepEqual(
      getSemanticCache(key),
      { hits: [1, 2] },
    );
  });

  it("stores and retrieves graph cache entries", () => {
    clearGraphCache();

    const key = buildGraphCacheKey(
      "entity_1",
      { maxDepth: 2 },
    );

    setGraphCache(key, { neighbors: 3 });
    assert.equal(
      getGraphCache(key).neighbors,
      3,
    );
  });

  it("tracks reasoning cache hits", () => {
    clearReasoningCache();

    const key = buildReasoningCacheKey({
      question: "What is Green Hydrogen?",
      retrievedChunks: [],
      graphEvidence: [],
    });

    setReasoningCache(key, {
      confidence: { overallConfidence: 0.9 },
    });

    const first = getReasoningCache(key);
    const second = getReasoningCache(key);
    const stats = getReasoningCacheStats();

    assert.equal(
      first.confidence.overallConfidence,
      0.9,
    );
    assert.ok(second);
    assert.ok(stats.hits >= 2);
  });
});
