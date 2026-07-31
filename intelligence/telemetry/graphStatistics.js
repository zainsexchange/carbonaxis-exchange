/**
 * Graph registry / traversal statistics.
 */

import {
  getRegistrySize as getEntityCount,
  listEntities,
} from "../graph/entityRegistry.js";

import {
  getRelationshipRegistrySize,
  listRelationships,
} from "../graph/relationshipRegistry.js";

/**
 * @returns {object}
 */
export function collectGraphStatistics() {
  const relationships =
    listRelationships();

  const predicateCounts = {};

  for (const relationship of relationships) {
    const predicate =
      relationship.canonicalPredicate ||
      relationship.predicate ||
      "UNKNOWN";

    predicateCounts[predicate] =
      (predicateCounts[predicate] || 0) +
      1;
  }

  return {
    entityCount: getEntityCount(),
    relationshipCount:
      getRelationshipRegistrySize(),
    predicateCounts,
    sampleEntities: listEntities()
      .slice(0, 5)
      .map(
        (entity) => entity.canonicalName,
      ),
  };
}
