import {
  registerEntity,
  resetEntityRegistry,
} from "../intelligence/graph/entityRegistry.js";

import {
  registerRelationship,
  resetRelationshipRegistry,
} from "../intelligence/graph/relationshipRegistry.js";

import {
  runInference,
} from "../intelligence/reasoning/inferenceEngine.js";

/**
 * @param {object} [options]
 * @returns {object}
 */
export function runInferenceBenchmark(
  options = {},
) {
  const chainLength =
    Number(options.chainLength) || 200;

  resetEntityRegistry();
  resetRelationshipRegistry();

  const ids = [];

  for (let i = 0; i < chainLength; i += 1) {
    const result = registerEntity({
      canonicalSubject: `Concept ${i}`,
    });
    ids.push(result.entityId);
  }

  for (let i = 0; i < chainLength - 1; i += 1) {
    registerRelationship({
      subjectEntityId: ids[i],
      predicate: "IS_A",
      canonicalPredicate: "IS_A",
      objectEntityId: ids[i + 1],
      object: `Concept ${i + 1}`,
    });
  }

  const started = process.hrtime.bigint();
  const inferred = runInference();
  const elapsedMs =
    Number(
      process.hrtime.bigint() - started,
    ) / 1e6;

  return {
    chainLength,
    inferredCount: inferred.length,
    inferenceMs: Number(
      elapsedMs.toFixed(2),
    ),
  };
}

export default runInferenceBenchmark;
