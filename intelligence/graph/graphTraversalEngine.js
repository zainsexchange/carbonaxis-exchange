import {
  getEntityById,
  listEntities,
} from "./entityRegistry.js";

import {
  getRelationshipById,
  listRelationships,
} from "./relationshipRegistry.js";

import {
  getAncestors,
  getChildren,
  resolveConcept,
} from "../ontology/hierarchyResolver.js";

const outgoingIndex = new Map();

const incomingIndex = new Map();

let initialized = false;

function initializeGraphIndexes() {

  outgoingIndex.clear();
  incomingIndex.clear();

  const relationships =
    listRelationships();

  for (const relationship of relationships) {

    const {

      relationshipId,

      subjectEntityId,

      objectEntityId,

    } = relationship;

    if (
      subjectEntityId &&
      objectEntityId
    ) {

      if (
        !outgoingIndex.has(
          subjectEntityId
        )
      ) {

        outgoingIndex.set(
          subjectEntityId,
          []
        );

      }

      outgoingIndex
        .get(subjectEntityId)
        .push(
          relationshipId
        );

      if (
        !incomingIndex.has(
          objectEntityId
        )
      ) {

        incomingIndex.set(
          objectEntityId,
          []
        );

      }

      incomingIndex
        .get(objectEntityId)
        .push(
          relationshipId
        );

    }

  }

  initialized = true;

}

function refreshIndexes() {

  initializeGraphIndexes();

}

function findEntity(entityId) {

  if (!initialized) {

    initializeGraphIndexes();

  }

  return getEntityById(entityId);

}

function findRelationships(entityId) {

  if (!initialized) {

    initializeGraphIndexes();

  }

  const outgoing =
    outgoingIndex.get(entityId) ?? [];

  const incoming =
    incomingIndex.get(entityId) ?? [];

  const relationshipIds = [
    ...new Set([
      ...outgoing,
      ...incoming,
    ]),
  ];

  return relationshipIds.map(getRelationshipById);

}

/**
 * Lightweight neighbor references for traversal algorithms.
 * Not exported.
 *
 * @param {string} entityId
 * @returns {Array<{
 *   entityId: string,
 *   relationshipId: string,
 *   direction: "outgoing"|"incoming"
 * }>}
 */
function getNeighborReferences(entityId) {

  if (!initialized) {
    initializeGraphIndexes();
  }

  if (!entityId) {
    return [];
  }

  const references = [];
  const seen = new Set();

  const outgoing =
    outgoingIndex.get(entityId) ?? [];

  for (const relationshipId of outgoing) {
    const relationship =
      getRelationshipById(relationshipId);

    const neighborEntityId =
      relationship?.objectEntityId;

    if (!neighborEntityId) {
      continue;
    }

    const key =
      `${relationshipId}::outgoing::${neighborEntityId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    references.push({
      entityId: neighborEntityId,
      relationshipId,
      direction: "outgoing",
    });
  }

  const incoming =
    incomingIndex.get(entityId) ?? [];

  for (const relationshipId of incoming) {
    const relationship =
      getRelationshipById(relationshipId);

    const neighborEntityId =
      relationship?.subjectEntityId;

    if (!neighborEntityId) {
      continue;
    }

    const key =
      `${relationshipId}::incoming::${neighborEntityId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    references.push({
      entityId: neighborEntityId,
      relationshipId,
      direction: "incoming",
    });
  }

  return references;
}

function findNeighbors(entityId) {

  const references =
    getNeighborReferences(entityId);

  return references.map((ref) => {
    const relationship =
      getRelationshipById(ref.relationshipId);

    return {
      direction: ref.direction,

      relationship,

      entity:
        getEntityById(ref.entityId),

      predicate:
        relationship?.canonicalPredicate ??
        relationship?.predicate,
    };
  });

}

/**
 * Breadth-first search for connected entities up to maxDepth.
 *
 * @param {string} startEntityId
 * @param {number} [maxDepth=2]
 * @returns {Array<{
 *   depth: number,
 *   entity: object|null,
 *   relationship: object|null,
 *   direction: string
 * }>}
 */
function findConnectedEntities(
  startEntityId,
  maxDepth = 2,
) {
  if (!startEntityId) {
    return [];
  }

  const resolvedDepth =
    Number.isFinite(Number(maxDepth))
      ? Math.max(0, Number(maxDepth))
      : 2;

  if (resolvedDepth === 0) {
    return [];
  }

  if (!initialized) {
    initializeGraphIndexes();
  }

  const queue = [];

  const visited = new Set();

  const results = [];

  queue.push({
    entityId: startEntityId,
    depth: 0,
  });

  visited.add(startEntityId);

  while (queue.length > 0) {

    const current = queue.shift();

    if (current.depth >= resolvedDepth) {
      continue;
    }

    const neighbors =
      getNeighborReferences(
        current.entityId
      );

    for (const neighbor of neighbors) {

      if (visited.has(neighbor.entityId)) {
        continue;
      }

      visited.add(
        neighbor.entityId
      );

      const nextDepth =
        current.depth + 1;

      queue.push({
        entityId:
          neighbor.entityId,
        depth:
          nextDepth,
      });

      results.push({
        depth:
          nextDepth,
        entity:
          getEntityById(
            neighbor.entityId
          ),
        relationship:
          getRelationshipById(
            neighbor.relationshipId
          ),
        direction:
          neighbor.direction,
      });

    }

  }

  return results;
}

/**
 * Find the shortest path between two entities using BFS.
 *
 * @param {string} startEntityId
 * @param {string} targetEntityId
 * @returns {Array<{
 *   entity: object|null,
 *   relationship: object|null
 * }>|null}
 */
function findShortestPath(
  startEntityId,
  targetEntityId,
) {
  if (
    !startEntityId ||
    !targetEntityId
  ) {
    return null;
  }

  if (!initialized) {
    initializeGraphIndexes();
  }

  if (startEntityId === targetEntityId) {
    return [
      {
        entity:
          getEntityById(startEntityId),
        relationship: null,
      },
    ];
  }

  const queue = [];

  const visited = new Set();

  const parents = new Map();

  queue.push({
    entityId: startEntityId,
    previousEntityId: null,
    relationshipId: null,
    depth: 0,
  });

  visited.add(startEntityId);

  let found = false;

  while (queue.length > 0) {

    const current = queue.shift();

    const neighbors =
      getNeighborReferences(
        current.entityId
      );

    for (const neighbor of neighbors) {

      if (visited.has(neighbor.entityId)) {
        continue;
      }

      visited.add(neighbor.entityId);

      parents.set(
        neighbor.entityId,
        {
          previousEntityId:
            current.entityId,
          relationshipId:
            neighbor.relationshipId,
        }
      );

      if (
        neighbor.entityId ===
        targetEntityId
      ) {
        found = true;
        break;
      }

      queue.push({
        entityId:
          neighbor.entityId,
        previousEntityId:
          current.entityId,
        relationshipId:
          neighbor.relationshipId,
        depth:
          current.depth + 1,
      });

    }

    if (found) {
      break;
    }

  }

  if (!found) {
    return null;
  }

  const reversedPath = [];

  let currentEntityId =
    targetEntityId;

  while (currentEntityId) {

    const parent =
      parents.get(currentEntityId);

    reversedPath.push({
      entity:
        getEntityById(
          currentEntityId
        ),
      relationship:
        parent?.relationshipId
          ? getRelationshipById(
              parent.relationshipId
            )
          : null,
    });

    currentEntityId =
      parent?.previousEntityId ??
      null;

  }

  return reversedPath.reverse();
}

export {

  initializeGraphIndexes,

  refreshIndexes,

  findEntity,

  findRelationships,

  findNeighbors,

  findConnectedEntities,

  findShortestPath,

};
