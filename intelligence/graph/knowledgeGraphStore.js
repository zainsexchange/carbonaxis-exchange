import {
  listEntities,
  getEntityById,
} from "./entityRegistry.js";

import {
  listRelationships,
  getRelationshipById,
} from "./relationshipRegistry.js";

/**
 * In-memory graph indexes.
 *
 * Nodes come from the Entity Registry.
 * Edges come from the Relationship Registry.
 */
const outgoingEdgesByEntityId = new Map();
const incomingEdgesByObjectKey = new Map();
const relationshipsByPredicate = new Map();
const objectNodesByKey = new Map();

let graphBuiltAt = null;

/**
 * Convert any text value into a stable graph lookup key.
 */
function normalizeGraphKey(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Return a safe copy of an array.
 */
function cloneArray(value) {
  return Array.isArray(value)
    ? [...value]
    : [];
}

/**
 * Return a safe copy of a plain object.
 */
function cloneObject(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return value ?? null;
  }

  return {
    ...value,
  };
}

/**
 * Create a lightweight graph node from an entity registry entry.
 */
function createEntityNode(entity = {}) {
  return {
    nodeId: entity.entityId ?? null,
    nodeType: "entity",
    entityId: entity.entityId ?? null,
    canonicalKey: entity.canonicalKey ?? null,
    canonicalName: entity.canonicalName ?? null,
    aliases: cloneArray(entity.aliases),
    entityType: entity.entityType ?? null,
    parentCountry: entity.parentCountry ?? null,
    candidateId: entity.candidateId ?? null,
    candidateIds: cloneArray(entity.candidateIds),
    occurrenceCount:
      Number(entity.occurrenceCount) || 0,
    createdAt: entity.createdAt ?? null,
    updatedAt: entity.updatedAt ?? null,
  };
}

/**
 * Create an object node for relationship objects that are not yet
 * registered as full entities.
 */
function createObjectNode(relationship = {}) {
  const objectValue =
    relationship.object ?? "";

  const objectKey =
    normalizeGraphKey(objectValue);

  return {
    nodeId: `OBJECT::${objectKey}`,
    nodeType: "object",
    objectKey,
    value: objectValue,
    structuredValue:
      cloneObject(
        relationship.structuredValue,
      ),
  };
}

/**
 * Create a graph edge from a relationship registry entry.
 */
function createGraphEdge(
  relationship = {},
) {
  const objectEntityId =
    relationship.objectEntityId ?? null;

  const objectType =
    objectEntityId
      ? "entity"
      : relationship.objectType ||
        "literal";

  const objectKey =
    objectEntityId
      ? normalizeGraphKey(
          objectEntityId,
        )
      : normalizeGraphKey(
          relationship.object,
        );

  const toNodeId =
    objectEntityId ||
    (
      objectKey
        ? `OBJECT::${objectKey}`
        : null
    );

  return {
    edgeId:
      relationship.relationshipId ??
      null,

    edgeType: "relationship",

    relationshipId:
      relationship.relationshipId ??
      null,

    relationshipKey:
      relationship.relationshipKey ??
      null,

    fromNodeId:
      relationship.subjectEntityId ??
      null,

    toNodeId,

    subjectEntityId:
      relationship.subjectEntityId ??
      null,

    subject:
      relationship.subject ?? null,

    canonicalSubject:
      relationship.canonicalSubject ??
      null,

    predicate:
      relationship.predicate ?? null,

    object:
      relationship.object ?? null,

    objectEntityId,

    objectType,

    objectKey,

    structuredValue:
      cloneObject(
        relationship.structuredValue,
      ),

    confidenceValues:
      cloneArray(
        relationship.confidenceValues,
      ),

    averageConfidence:
      Number(
        relationship.averageConfidence,
      ) || 0,

    maxConfidence:
      Number(
        relationship.maxConfidence,
      ) || 0,

    occurrenceCount:
      Number(
        relationship.occurrenceCount,
      ) || 0,

    provenance:
      cloneArray(
        relationship.provenance,
      ).map((item) => ({
        ...item,

        contextPath:
          cloneArray(
            item?.contextPath,
          ),
      })),

    createdAt:
      relationship.createdAt ?? null,

    updatedAt:
      relationship.updatedAt ?? null,
  };
}

/**
 * Add a value to a Map whose values are arrays.
 */
function appendToMapArray(
  map,
  key,
  value,
) {
  if (!key) {
    return;
  }

  const existing =
    map.get(key) ?? [];

  existing.push(value);
  map.set(key, existing);
}

/**
 * Clear all generated graph indexes.
 */
export function resetKnowledgeGraphStore() {
  outgoingEdgesByEntityId.clear();
  incomingEdgesByObjectKey.clear();
  relationshipsByPredicate.clear();
  objectNodesByKey.clear();

  graphBuiltAt = null;
}

/**
 * Rebuild the graph from the current entity and relationship registries.
 */
export function buildKnowledgeGraph() {
  resetKnowledgeGraphStore();

  const relationships =
    listRelationships();

  for (const relationship of relationships) {
    const edge =
      createGraphEdge(
        relationship,
      );

    if (!edge.fromNodeId) {
      continue;
    }

    appendToMapArray(
      outgoingEdgesByEntityId,
      edge.fromNodeId,
      edge,
    );

    appendToMapArray(
      incomingEdgesByObjectKey,
      edge.objectKey,
      edge,
    );

    appendToMapArray(
      relationshipsByPredicate,
      normalizeGraphKey(
        edge.predicate,
      ),
      edge,
    );

    if (
      edge.objectType === "literal" &&
      edge.objectKey &&
      !objectNodesByKey.has(
        edge.objectKey,
      )
    ) {
      objectNodesByKey.set(
        edge.objectKey,
        createObjectNode(
          relationship,
        ),
      );
    }
  }

  graphBuiltAt =
    new Date().toISOString();

  return getKnowledgeGraphSummary();
}

/**
 * Ensure the graph has been built before reading it.
 */
function ensureGraphBuilt() {
  if (!graphBuiltAt) {
    buildKnowledgeGraph();
  }
}

/**
 * Return one entity node.
 */
export function getGraphEntityNode(
  entityId,
) {
  const entity =
    getEntityById(entityId);

  return entity
    ? createEntityNode(entity)
    : null;
}

/**
 * Return one object node by raw object value.
 */
export function getGraphObjectNode(
  objectValue,
) {
  ensureGraphBuilt();

  const objectKey =
    normalizeGraphKey(
      objectValue,
    );

  const node =
    objectNodesByKey.get(
      objectKey,
    );

  return node
    ? {
        ...node,
        structuredValue:
          cloneObject(
            node.structuredValue,
          ),
      }
    : null;
}

/**
 * Return one relationship edge by relationship ID.
 */
export function getGraphEdgeById(
  relationshipId,
) {
  const relationship =
    getRelationshipById(
      relationshipId,
    );

  return relationship
    ? createGraphEdge(
        relationship,
      )
    : null;
}

/**
 * Return all outgoing edges for an entity.
 */
export function getOutgoingEdges(
  entityId,
) {
  ensureGraphBuilt();

  return cloneArray(
    outgoingEdgesByEntityId.get(
      entityId,
    ),
  ).map((edge) => ({
    ...edge,
    provenance:
      cloneArray(
        edge.provenance,
      ).map((item) => ({
        ...item,
        contextPath:
          cloneArray(
            item?.contextPath,
          ),
      })),
  }));
}

/**
 * Return all relationships that point to a specific object value.
 */
export function getIncomingEdgesByObject(
  objectValue,
) {
  ensureGraphBuilt();

  const objectKey =
    normalizeGraphKey(
      objectValue,
    );

  return cloneArray(
    incomingEdgesByObjectKey.get(
      objectKey,
    ),
  );
}

/**
 * Return all edges with a matching predicate.
 */
export function getEdgesByPredicate(
  predicate,
) {
  ensureGraphBuilt();

  const predicateKey =
    normalizeGraphKey(
      predicate,
    );

  return cloneArray(
    relationshipsByPredicate.get(
      predicateKey,
    ),
  );
}

/**
 * Return an entity and all of its direct relationships.
 */
export function getEntityNeighborhood(
  entityId,
) {
  ensureGraphBuilt();

  const entityNode =
    getGraphEntityNode(
      entityId,
    );

  if (!entityNode) {
    return null;
  }

  const outgoingEdges =
    getOutgoingEdges(
      entityId,
    );

  const objectNodes =
    outgoingEdges
      .map((edge) =>
        getGraphObjectNode(
          edge.object,
        ),
      )
      .filter(Boolean);

  return {
    entity: entityNode,
    outgoingEdges,
    objectNodes,
    edgeCount:
      outgoingEdges.length,
    objectNodeCount:
      objectNodes.length,
  };
}

/**
 * Return the complete graph snapshot.
 */
export function getKnowledgeGraphSnapshot() {
  ensureGraphBuilt();

  const entityNodes =
    listEntities().map(
      createEntityNode,
    );

  const objectNodes =
    Array.from(
      objectNodesByKey.values(),
    ).map((node) => ({
      ...node,
      structuredValue:
        cloneObject(
          node.structuredValue,
        ),
    }));

  const edges =
    listRelationships().map(
      createGraphEdge,
    );

  return {
    builtAt: graphBuiltAt,
    entityNodes,
    objectNodes,
    edges,
    summary:
      getKnowledgeGraphSummary(),
  };
}

/**
 * Return graph statistics.
 */
export function getKnowledgeGraphSummary() {
  const entityCount =
    listEntities().length;

  const relationshipCount =
    listRelationships().length;

  return {
    builtAt: graphBuiltAt,
    entityNodeCount:
      entityCount,
    objectNodeCount:
      objectNodesByKey.size,
    totalNodeCount:
      entityCount +
      objectNodesByKey.size,
    edgeCount:
      relationshipCount,
    predicateCount:
      relationshipsByPredicate.size,
    outgoingEntityCount:
      outgoingEdgesByEntityId.size,
  };
}

export {
  normalizeGraphKey,
  createEntityNode,
  createObjectNode,
  createGraphEdge,
};