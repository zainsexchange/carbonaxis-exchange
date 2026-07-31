import {
  registerEntity,
  resetEntityRegistry,
} from "../intelligence/graph/entityRegistry.js";

import {
  registerRelationship,
  resetRelationshipRegistry,
} from "../intelligence/graph/relationshipRegistry.js";

import {
  initializeGraphIndexes,
  findConnectedEntities,
  findShortestPath,
} from "../intelligence/graph/graphTraversalEngine.js";

function hrtimeMs(start) {
  const diff = process.hrtime.bigint() - start;
  return Number(diff) / 1e6;
}

/**
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function runGraphBenchmark(
  options = {},
) {
  const entityCount =
    Number(options.entityCount) || 1000;
  const relationshipCount =
    Number(options.relationshipCount) ||
    5000;

  resetEntityRegistry();
  resetRelationshipRegistry();

  const started = process.hrtime.bigint();
  const ids = [];

  for (let i = 0; i < entityCount; i += 1) {
    const result = registerEntity({
      canonicalSubject: `Entity ${i}`,
      entityType: "BENCH",
    });
    ids.push(result.entityId);
  }

  for (
    let i = 0;
    i < relationshipCount;
    i += 1
  ) {
    const subjectId =
      ids[i % ids.length];
    const objectId =
      ids[(i * 7 + 3) % ids.length];

    if (subjectId === objectId) {
      continue;
    }

    registerRelationship({
      subjectEntityId: subjectId,
      predicate: i % 5 === 0 ? "IS_A" : "RELATED_TO",
      canonicalPredicate:
        i % 5 === 0 ? "IS_A" : "RELATED_TO",
      objectEntityId: objectId,
      object: `Entity ${(i * 7 + 3) % ids.length}`,
    });
  }

  const loadMs = hrtimeMs(started);

  initializeGraphIndexes();

  const traversalStart =
    process.hrtime.bigint();
  const connected = findConnectedEntities(
    ids[0],
    2,
  );
  const traversalMs = hrtimeMs(
    traversalStart,
  );

  const pathStart = process.hrtime.bigint();
  const path = findShortestPath(
    ids[0],
    ids[Math.min(50, ids.length - 1)],
  );
  const pathMs = hrtimeMs(pathStart);

  return {
    entityCount,
    relationshipCount,
    loadMs: Number(loadMs.toFixed(2)),
    traversalMs: Number(
      traversalMs.toFixed(2),
    ),
    pathMs: Number(pathMs.toFixed(2)),
    connectedCount: connected.length,
    pathLength: Array.isArray(path)
      ? path.length
      : 0,
    memoryMb: Number(
      (
        process.memoryUsage().heapUsed /
        1024 /
        1024
      ).toFixed(2),
    ),
  };
}

export default runGraphBenchmark;
