import {
  evaluateTruth,
} from "../intelligence/truth/truthEngine.js";

import {
  clearReasoningCache,
  getReasoningCacheStats,
} from "../intelligence/cache/reasoningCache.js";

import {
  registerEntity,
  resetEntityRegistry,
} from "../intelligence/graph/entityRegistry.js";

import {
  resetEvidenceSequence,
} from "../intelligence/truth/evidenceModel.js";

/**
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function runTruthBenchmark(
  options = {},
) {
  const iterations =
    Number(options.iterations) || 50;

  resetEntityRegistry();
  resetEvidenceSequence();
  clearReasoningCache();

  const uae = registerEntity({
    canonicalSubject:
      "United Arab Emirates",
  });
  const gh = registerEntity({
    canonicalSubject: "Green Hydrogen",
  });

  const payload = {
    question:
      "Does UAE support Green Hydrogen?",
    retrievedChunks: [
      {
        subjectEntityId: uae.entityId,
        predicate: "SUPPORTS",
        objectEntityId: gh.entityId,
        confidence: 0.92,
        text: "UAE supports Green Hydrogen.",
      },
    ],
    graphEvidence: [
      {
        subjectEntityId: uae.entityId,
        predicate: "SUPPORTS",
        objectEntityId: gh.entityId,
        confidence: 1,
      },
    ],
  };

  const started = process.hrtime.bigint();

  for (let i = 0; i < iterations; i += 1) {
    await evaluateTruth(payload);
  }

  const elapsedMs =
    Number(
      process.hrtime.bigint() - started,
    ) / 1e6;

  const stats = getReasoningCacheStats();

  return {
    iterations,
    totalMs: Number(elapsedMs.toFixed(2)),
    avgMs: Number(
      (elapsedMs / iterations).toFixed(4),
    ),
    cache: stats,
  };
}

export default runTruthBenchmark;
