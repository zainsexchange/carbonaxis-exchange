import {
  getKnowledgeGraphSnapshot,
} from "./knowledgeGraphStore.js";

import {
  getAllDiscoveredEntities,
} from "./entityDiscoveryEngine.js";

/**
 * Graph Augmentation Engine — Phase 1
 *
 * Responsibilities:
 * - Load the current graph snapshot.
 * - Load deterministically discovered entities.
 * - Detect duplicates against existing graph entities.
 * - Plan new entity-node insertions.
 * - Plan Entity → Entity relationship insertions.
 * - Preserve provenance and confidence.
 * - Expose planning registries, summaries, and snapshots.
 *
 * Phase 1 does NOT:
 * - Mutate the knowledge graph.
 * - Insert graph nodes.
 * - Insert graph edges.
 * - Remove object nodes.
 * - Rebuild graph indexes.
 */

const augmentationState = {
  graphSnapshot: null,
  augmentationPlan: null,

  augmentedGraphSnapshot: null,
  mutationReport: null,

  entityInsertionRegistry: new Map(),
  relationshipInsertionRegistry: new Map(),
  duplicateRegistry: new Map(),

  entityIdMappingRegistry: new Map(),
  appliedEntityInsertionRegistry: new Map(),
  appliedRelationshipInsertionRegistry: new Map(),

  counters: {
    plan: 0,
    entityInsertion: 0,
    relationshipInsertion: 0,
    duplicate: 0,
  },

  createdAt: null,
  updatedAt: null,
};

const DEFAULT_OPTIONS = Object.freeze({
  minimumDiscoveryConfidence: 0.72,
  planRelationshipInsertions: true,
  skipDuplicateEntities: true,
  skipDuplicateRelationships: true,
  requireSourceObjectNode: true,
  preserveOriginalObjectEdge: true,
});

/* -------------------------------------------------------------------------- */
/*                               Basic Helpers                                */
/* -------------------------------------------------------------------------- */

function cleanString(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9%$€£]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentifier(value) {
  return cleanString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizePredicate(value) {
  return normalizeText(value)
    .replace(/\s+/g, "_");
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value instanceof Map) {
    return Array.from(value.values());
  }

  if (value && typeof value === "object") {
    return Object.values(value);
  }

  return [];
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      toArray(values)
        .map(cleanString)
        .filter(Boolean),
    ),
  );
}

function clamp(value, minimum = 0, maximum = 1) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, numericValue));
}

function round(value, digits = 6) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(digits));
}

function nowIso() {
  return new Date().toISOString();
}

function cloneStructuredValue(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    ...value,
    allYears: Array.isArray(value.allYears)
      ? [...value.allYears]
      : [],
  };
}

function cloneProvenanceItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  return {
    ...item,
    contextPath: Array.isArray(item.contextPath)
      ? [...item.contextPath]
      : [],
  };
}

function cloneProvenance(items) {
  return toArray(items)
    .map(cloneProvenanceItem)
    .filter(Boolean);
}

function mergeProvenance(...collections) {
  const combined = collections
    .flatMap((collection) => cloneProvenance(collection));

  const seen = new Set();

  return combined.filter((item) => {
    const key = JSON.stringify([
      item.sourceDocumentId ?? null,
      item.sourceChunkId ?? null,
      item.sourceLine ?? null,
      item.originalBlockText ?? null,
      item.contextualSentence ?? null,
      item.clause ?? null,
    ]);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/* -------------------------------------------------------------------------- */
/*                              Snapshot Readers                              */
/* -------------------------------------------------------------------------- */

function extractEntityNodes(snapshot) {
  const candidates = [
    snapshot?.entityNodes,
    snapshot?.entities,
    snapshot?.nodes?.entities,
    snapshot?.nodes?.entityNodes,
  ];

  for (const candidate of candidates) {
    const values = toArray(candidate);

    if (values.length > 0) {
      return values.filter((node) => {
        return (
          node &&
          (
            node.nodeType === "entity" ||
            node.entityId ||
            node.canonicalName
          )
        );
      });
    }
  }

  return toArray(snapshot?.nodes).filter((node) => {
    return (
      node?.nodeType === "entity" ||
      Boolean(node?.entityId)
    );
  });
}

function extractObjectNodes(snapshot) {
  const candidates = [
    snapshot?.objectNodes,
    snapshot?.objects,
    snapshot?.nodes?.objects,
    snapshot?.nodes?.objectNodes,
  ];

  for (const candidate of candidates) {
    const values = toArray(candidate);

    if (values.length > 0) {
      return values.filter((node) => {
        return (
          node &&
          (
            node.nodeType === "object" ||
            node.objectKey ||
            node.value
          )
        );
      });
    }
  }

  return toArray(snapshot?.nodes).filter((node) => {
    return (
      node?.nodeType === "object" ||
      Boolean(node?.objectKey)
    );
  });
}

function extractRelationshipEdges(snapshot) {
  const candidates = [
    snapshot?.relationshipEdges,
    snapshot?.relationships,
    snapshot?.edges,
    snapshot?.graphEdges,
  ];

  for (const candidate of candidates) {
    const values = toArray(candidate);

    if (values.length > 0) {
      return values.filter((edge) => {
        return (
          edge &&
          (
            edge.relationshipId ||
            edge.edgeId ||
            edge.predicate
          )
        );
      });
    }
  }

  return [];
}

/* -------------------------------------------------------------------------- */
/*                            Entity Value Helpers                            */
/* -------------------------------------------------------------------------- */

function getEntityNodeId(entity) {
  return cleanString(
    entity?.nodeId ??
    entity?.entityId,
  );
}

function getEntityId(entity) {
  return cleanString(
    entity?.entityId ??
    entity?.nodeId,
  );
}

function getEntityCanonicalName(entity) {
  return cleanString(
    entity?.canonicalName ??
    entity?.name ??
    entity?.label ??
    entity?.title,
  );
}

function getEntityCanonicalKey(entity) {
  return normalizeText(
    entity?.canonicalKey ??
    getEntityCanonicalName(entity),
  );
}

function getEntityAliases(entity) {
  return uniqueStrings([
    getEntityCanonicalName(entity),
    ...(Array.isArray(entity?.aliases)
      ? entity.aliases
      : []),
  ]);
}

function getEntityCandidateIds(entity) {
  return uniqueStrings([
    entity?.candidateId,
    ...(Array.isArray(entity?.candidateIds)
      ? entity.candidateIds
      : []),
  ]);
}

function getSourceObjectNodeIds(entity) {
  return uniqueStrings(
    entity?.sourceObjectNodeIds,
  );
}

function getObjectNodeId(objectNode) {
  return cleanString(
    objectNode?.nodeId ??
    objectNode?.objectNodeId ??
    objectNode?.objectKey,
  );
}

function getObjectValue(objectNode) {
  return cleanString(
    objectNode?.value ??
    objectNode?.object ??
    objectNode?.label ??
    objectNode?.name ??
    objectNode?.objectKey,
  );
}

/* -------------------------------------------------------------------------- */
/*                          Relationship Value Helpers                        */
/* -------------------------------------------------------------------------- */

function getRelationshipId(edge) {
  return cleanString(
    edge?.relationshipId ??
    edge?.edgeId ??
    edge?.id,
  );
}

function getRelationshipSubjectNodeId(edge) {
  return cleanString(
    edge?.subjectNodeId ??
    edge?.fromNodeId ??
    edge?.sourceNodeId ??
    edge?.entityNodeId ??
    edge?.subjectEntityId,
  );
}

function getRelationshipSubjectName(edge) {
  return cleanString(
    edge?.canonicalSubject ??
    edge?.subject ??
    edge?.subjectName,
  );
}

function getRelationshipObjectNodeId(edge) {
  return cleanString(
    edge?.objectNodeId ??
    edge?.toNodeId ??
    edge?.targetNodeId,
  );
}

function getRelationshipObjectValue(edge) {
  return cleanString(
    edge?.object ??
    edge?.objectValue ??
    edge?.target,
  );
}

function getRelationshipPredicate(edge) {
  return cleanString(
    edge?.predicate ??
    edge?.relationshipType ??
    edge?.type,
  );
}

function getRelationshipConfidence(edge) {
  const values = [
    edge?.confidence,
    edge?.averageConfidence,
  ]
    .map(Number)
    .filter(Number.isFinite);

  if (values.length === 0) {
    return 0;
  }

  return clamp(
    values.reduce((sum, value) => sum + value, 0) /
      values.length,
  );
}

function getRelationshipProvenance(edge) {
  if (Array.isArray(edge?.provenance)) {
    return cloneProvenance(edge.provenance);
  }

  if (Array.isArray(edge?.evidence)) {
    return cloneProvenance(edge.evidence);
  }

  const hasInlineEvidence = Boolean(
    edge?.sourceDocumentId ||
    edge?.sourceChunkId ||
    edge?.sourceLine ||
    edge?.originalBlockText ||
    edge?.contextualSentence ||
    edge?.clause,
  );

  if (!hasInlineEvidence) {
    return [];
  }

  return cloneProvenance([
    {
      sourceDocumentId:
        edge.sourceDocumentId ?? null,
      sourceChunkId:
        edge.sourceChunkId ?? null,
      sourceLine:
        edge.sourceLine ?? null,
      contextPath: Array.isArray(edge.contextPath)
        ? [...edge.contextPath]
        : [],
      originalBlockText:
        edge.originalBlockText ?? null,
      contextualSentence:
        edge.contextualSentence ?? null,
      clause:
        edge.clause ?? null,
      confidence:
        edge.confidence ?? null,
    },
  ]);
}

/* -------------------------------------------------------------------------- */
/*                                ID Creation                                 */
/* -------------------------------------------------------------------------- */

function createPlanId() {
  augmentationState.counters.plan += 1;

  return `AUGMENTATION_PLAN_${String(
    augmentationState.counters.plan,
  ).padStart(6, "0")}`;
}

function createEntityInsertionId() {
  augmentationState.counters.entityInsertion += 1;

  return `ENTITY_INSERTION_${String(
    augmentationState.counters.entityInsertion,
  ).padStart(6, "0")}`;
}

function createRelationshipInsertionId() {
  augmentationState.counters.relationshipInsertion += 1;

  return `RELATIONSHIP_INSERTION_${String(
    augmentationState.counters.relationshipInsertion,
  ).padStart(6, "0")}`;
}

function createDuplicateRecordId() {
  augmentationState.counters.duplicate += 1;

  return `AUGMENTATION_DUPLICATE_${String(
    augmentationState.counters.duplicate,
  ).padStart(6, "0")}`;
}

/* -------------------------------------------------------------------------- */
/*                             Registry Key Logic                             */
/* -------------------------------------------------------------------------- */

function createEntityRegistryKey(entity) {
  return (
    getEntityCanonicalKey(entity) ||
    normalizeText(getEntityId(entity)) ||
    normalizeText(getEntityNodeId(entity))
  );
}

function createRelationshipRegistryKey({
  subjectNodeId,
  subjectName,
  predicate,
  objectEntityId,
  objectCanonicalName,
}) {
  return [
    normalizeText(subjectNodeId || subjectName),
    normalizePredicate(predicate),
    normalizeText(objectEntityId || objectCanonicalName),
  ].join("::");
}

function createExistingRelationshipKey(edge) {
  return createRelationshipRegistryKey({
    subjectNodeId: getRelationshipSubjectNodeId(edge),
    subjectName: getRelationshipSubjectName(edge),
    predicate: getRelationshipPredicate(edge),
    objectEntityId:
      edge?.objectEntityId ??
      edge?.targetEntityId ??
      "",
    objectCanonicalName:
      edge?.objectCanonicalName ??
      getRelationshipObjectValue(edge),
  });
}

/* -------------------------------------------------------------------------- */
/*                           Duplicate Index Builder                          */
/* -------------------------------------------------------------------------- */

function buildExistingEntityIndex(entityNodes) {
  const index = {
    byNodeId: new Map(),
    byEntityId: new Map(),
    byCanonicalKey: new Map(),
    byCanonicalName: new Map(),
    byCandidateId: new Map(),
    byAlias: new Map(),
  };

  for (const entity of entityNodes) {
    const nodeId = normalizeText(getEntityNodeId(entity));
    const entityId = normalizeText(getEntityId(entity));
    const canonicalKey = getEntityCanonicalKey(entity);
    const canonicalName = normalizeText(
      getEntityCanonicalName(entity),
    );

    if (nodeId) {
      index.byNodeId.set(nodeId, entity);
    }

    if (entityId) {
      index.byEntityId.set(entityId, entity);
    }

    if (canonicalKey) {
      index.byCanonicalKey.set(canonicalKey, entity);
    }

    if (canonicalName) {
      index.byCanonicalName.set(canonicalName, entity);
    }

    for (const candidateId of getEntityCandidateIds(entity)) {
      const key = normalizeIdentifier(candidateId);

      if (key) {
        index.byCandidateId.set(key, entity);
      }
    }

    for (const alias of getEntityAliases(entity)) {
      const key = normalizeText(alias);

      if (key) {
        index.byAlias.set(key, entity);
      }
    }
  }

  return index;
}

function findDuplicateEntity(discoveredEntity, existingIndex) {
  const checks = [
    {
      matchType: "node_id",
      key: normalizeText(getEntityNodeId(discoveredEntity)),
      registry: existingIndex.byNodeId,
    },
    {
      matchType: "entity_id",
      key: normalizeText(getEntityId(discoveredEntity)),
      registry: existingIndex.byEntityId,
    },
    {
      matchType: "canonical_key",
      key: getEntityCanonicalKey(discoveredEntity),
      registry: existingIndex.byCanonicalKey,
    },
    {
      matchType: "canonical_name",
      key: normalizeText(
        getEntityCanonicalName(discoveredEntity),
      ),
      registry: existingIndex.byCanonicalName,
    },
  ];

  for (const check of checks) {
    if (check.key && check.registry.has(check.key)) {
      return {
        duplicate: true,
        matchType: check.matchType,
        matchedValue: check.key,
        existingEntity: check.registry.get(check.key),
      };
    }
  }

  for (const candidateId of getEntityCandidateIds(
    discoveredEntity,
  )) {
    const key = normalizeIdentifier(candidateId);

    if (key && existingIndex.byCandidateId.has(key)) {
      return {
        duplicate: true,
        matchType: "candidate_id",
        matchedValue: key,
        existingEntity:
          existingIndex.byCandidateId.get(key),
      };
    }
  }

  for (const alias of getEntityAliases(discoveredEntity)) {
    const key = normalizeText(alias);

    if (key && existingIndex.byAlias.has(key)) {
      return {
        duplicate: true,
        matchType: "alias",
        matchedValue: key,
        existingEntity: existingIndex.byAlias.get(key),
      };
    }
  }

  return {
    duplicate: false,
    matchType: null,
    matchedValue: null,
    existingEntity: null,
  };
}

/* -------------------------------------------------------------------------- */
/*                               Clone Helpers                                */
/* -------------------------------------------------------------------------- */

function cloneEntity(entity) {
  if (!entity || typeof entity !== "object") {
    return null;
  }

  return {
    ...entity,
    aliases: Array.isArray(entity.aliases)
      ? [...entity.aliases]
      : [],
    candidateIds: Array.isArray(entity.candidateIds)
      ? [...entity.candidateIds]
      : [],
    sourceObjectNodeIds: Array.isArray(
      entity.sourceObjectNodeIds,
    )
      ? [...entity.sourceObjectNodeIds]
      : [],
    provenance: cloneProvenance(entity.provenance),
    discoverySignals: Array.isArray(
      entity.discoverySignals,
    )
      ? entity.discoverySignals.map((signal) => ({
          ...signal,
        }))
      : [],
  };
}

function cloneEntityInsertion(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  return {
    ...record,
    discoveredEntity: cloneEntity(
      record.discoveredEntity,
    ),
    proposedEntityNode: cloneEntity(
      record.proposedEntityNode,
    ),
    sourceObjectNodeIds: Array.isArray(
      record.sourceObjectNodeIds,
    )
      ? [...record.sourceObjectNodeIds]
      : [],
    provenance: cloneProvenance(record.provenance),
  };
}

function cloneRelationshipInsertion(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  return {
    ...record,
    provenance: cloneProvenance(record.provenance),
    sourceRelationship: record.sourceRelationship
      ? {
          ...record.sourceRelationship,
          provenance: cloneProvenance(
            record.sourceRelationship.provenance,
          ),
        }
      : null,
  };
}

function cloneDuplicateRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  return {
    ...record,
    discoveredEntity: cloneEntity(
      record.discoveredEntity,
    ),
    existingEntity: cloneEntity(
      record.existingEntity,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/*                         Entity Insertion Planning                          */
/* -------------------------------------------------------------------------- */

function buildProposedEntityNode(discoveredEntity) {
  const canonicalName = getEntityCanonicalName(
    discoveredEntity,
  );

  const canonicalKey = getEntityCanonicalKey(
    discoveredEntity,
  );

  const candidateIds = getEntityCandidateIds(
    discoveredEntity,
  );

  return {
    ...cloneEntity(discoveredEntity),

    nodeId:
      getEntityNodeId(discoveredEntity) ||
      `ENTITY::${canonicalKey}`,

    entityId:
      getEntityId(discoveredEntity) ||
      `ENTITY::${canonicalKey}`,

    nodeType: "entity",

    canonicalName,
    canonicalKey,

    aliases: getEntityAliases(discoveredEntity),

    candidateId:
      cleanString(discoveredEntity?.candidateId) ||
      candidateIds[0] ||
      normalizeIdentifier(canonicalName),

    candidateIds,

    augmentationStatus: "planned",
    augmentationSource: "entity_discovery_engine",
  };
}

export function registerEntityInsertion(
  discoveredEntity,
  options = {},
) {
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (
    !discoveredEntity ||
    typeof discoveredEntity !== "object"
  ) {
    return {
      registered: false,
      reason: "invalid_discovered_entity",
      insertion: null,
    };
  }

  const discoveryConfidence = clamp(
    discoveredEntity.discoveryConfidence ??
    discoveredEntity.confidence ??
    0,
  );

  if (
    discoveryConfidence <
    resolvedOptions.minimumDiscoveryConfidence
  ) {
    return {
      registered: false,
      reason: "below_minimum_discovery_confidence",
      confidence: discoveryConfidence,
      insertion: null,
    };
  }

  const registryKey =
    createEntityRegistryKey(discoveredEntity);

  if (!registryKey) {
    return {
      registered: false,
      reason: "missing_entity_registry_key",
      insertion: null,
    };
  }

  if (
    augmentationState.entityInsertionRegistry.has(
      registryKey,
    )
  ) {
    return {
      registered: false,
      reason: "entity_insertion_already_registered",
      insertion: cloneEntityInsertion(
        augmentationState.entityInsertionRegistry.get(
          registryKey,
        ),
      ),
    };
  }

  const timestamp = nowIso();
  const proposedEntityNode =
    buildProposedEntityNode(discoveredEntity);

  const insertion = {
    insertionId: createEntityInsertionId(),
    insertionType: "entity_node",
    status: "pending",

    registryKey,
    reason: "new_discovered_entity",

    discoveredEntityId:
      getEntityId(discoveredEntity),

    proposedEntityId:
      getEntityId(proposedEntityNode),

    proposedNodeId:
      getEntityNodeId(proposedEntityNode),

    canonicalKey:
      getEntityCanonicalKey(proposedEntityNode),

    canonicalName:
      getEntityCanonicalName(proposedEntityNode),

    entityType:
      proposedEntityNode.entityType ?? "concept",

    discoveryConfidence,

    duplicate: false,

    sourceObjectNodeIds:
      getSourceObjectNodeIds(discoveredEntity),

    provenance:
      cloneProvenance(discoveredEntity.provenance),

    discoveredEntity:
      cloneEntity(discoveredEntity),

    proposedEntityNode,

    createdAt: timestamp,
    updatedAt: timestamp,
  };

  augmentationState.entityInsertionRegistry.set(
    registryKey,
    insertion,
  );

  augmentationState.updatedAt = timestamp;

  return {
    registered: true,
    reason: "entity_insertion_registered",
    insertion: cloneEntityInsertion(insertion),
  };
}

/* -------------------------------------------------------------------------- */
/*                      Relationship Insertion Planning                       */
/* -------------------------------------------------------------------------- */

function findEdgesForDiscoveredEntity({
  discoveredEntity,
  relationshipEdges,
  objectNodes,
}) {
  const sourceObjectNodeIds = new Set(
    getSourceObjectNodeIds(discoveredEntity)
      .map(cleanString)
      .filter(Boolean),
  );

  const canonicalKey =
    getEntityCanonicalKey(discoveredEntity);

  const objectValues = new Set();

  for (const objectNode of objectNodes) {
    const objectNodeId = getObjectNodeId(objectNode);
    const objectValue = normalizeText(
      getObjectValue(objectNode),
    );

    if (
      sourceObjectNodeIds.has(objectNodeId) ||
      objectValue === canonicalKey
    ) {
      if (objectValue) {
        objectValues.add(objectValue);
      }

      if (objectNodeId) {
        sourceObjectNodeIds.add(objectNodeId);
      }
    }
  }

  return relationshipEdges.filter((edge) => {
    const edgeObjectNodeId =
      getRelationshipObjectNodeId(edge);

    const edgeObjectValue = normalizeText(
      getRelationshipObjectValue(edge),
    );

    return (
      (
        edgeObjectNodeId &&
        sourceObjectNodeIds.has(edgeObjectNodeId)
      ) ||
      (
        edgeObjectValue &&
        (
          objectValues.has(edgeObjectValue) ||
          edgeObjectValue === canonicalKey
        )
      )
    );
  });
}

export function registerRelationshipInsertion(
  relationshipInput,
  options = {},
) {
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (
    !relationshipInput ||
    typeof relationshipInput !== "object"
  ) {
    return {
      registered: false,
      reason: "invalid_relationship_input",
      insertion: null,
    };
  }

  const {
    sourceRelationship,
    discoveredEntity,
    proposedEntityNode,
  } = relationshipInput;

  if (!sourceRelationship || !proposedEntityNode) {
    return {
      registered: false,
      reason:
        "missing_source_relationship_or_target_entity",
      insertion: null,
    };
  }

  const subjectNodeId =
    getRelationshipSubjectNodeId(sourceRelationship);

  const subjectName =
    getRelationshipSubjectName(sourceRelationship);

  const predicate =
    getRelationshipPredicate(sourceRelationship);

  const objectEntityId =
    getEntityId(proposedEntityNode);

  const objectCanonicalName =
    getEntityCanonicalName(proposedEntityNode);

  if (!predicate) {
    return {
      registered: false,
      reason: "missing_relationship_predicate",
      insertion: null,
    };
  }

  if (!subjectNodeId && !subjectName) {
    return {
      registered: false,
      reason: "missing_relationship_subject",
      insertion: null,
    };
  }

  if (!objectEntityId && !objectCanonicalName) {
    return {
      registered: false,
      reason: "missing_relationship_object_entity",
      insertion: null,
    };
  }

  const registryKey =
    createRelationshipRegistryKey({
      subjectNodeId,
      subjectName,
      predicate,
      objectEntityId,
      objectCanonicalName,
    });

  if (
    resolvedOptions.skipDuplicateRelationships &&
    augmentationState.relationshipInsertionRegistry.has(
      registryKey,
    )
  ) {
    return {
      registered: false,
      reason:
        "relationship_insertion_already_registered",
      insertion: cloneRelationshipInsertion(
        augmentationState.relationshipInsertionRegistry.get(
          registryKey,
        ),
      ),
    };
  }

  const sourceConfidence =
    getRelationshipConfidence(sourceRelationship);

  const discoveryConfidence = clamp(
    discoveredEntity?.discoveryConfidence ??
    discoveredEntity?.confidence ??
    0,
  );

  const combinedConfidence = round(
    sourceConfidence > 0 && discoveryConfidence > 0
      ? (
          sourceConfidence *
          discoveryConfidence
        )
      : Math.max(
          sourceConfidence,
          discoveryConfidence,
        ),
  );

  const provenance = mergeProvenance(
    getRelationshipProvenance(sourceRelationship),
    discoveredEntity?.provenance,
    proposedEntityNode?.provenance,
  );

  const timestamp = nowIso();

  const insertion = {
    insertionId: createRelationshipInsertionId(),
    insertionType: "entity_relationship",
    status: "pending",

    registryKey,
    reason: "promote_object_edge_to_entity_edge",

    sourceRelationshipId:
      getRelationshipId(sourceRelationship),

    subjectNodeId: subjectNodeId || null,
    subjectEntityId:
      sourceRelationship.subjectEntityId ??
      sourceRelationship.entityId ??
      subjectNodeId ??
      null,

    subject:
      subjectName || null,

    predicate,

    normalizedPredicate:
      normalizePredicate(predicate),

    objectEntityId:
      objectEntityId || null,

    objectNodeId:
      getEntityNodeId(proposedEntityNode) || null,

    objectCanonicalName:
      objectCanonicalName || null,

    originalObjectNodeId:
      getRelationshipObjectNodeId(
        sourceRelationship,
      ) || null,

    originalObjectValue:
      getRelationshipObjectValue(
        sourceRelationship,
      ) || null,

    confidence: combinedConfidence,

    sourceRelationshipConfidence:
      sourceConfidence,

    entityDiscoveryConfidence:
      discoveryConfidence,

    preserveOriginalObjectEdge:
      resolvedOptions.preserveOriginalObjectEdge,

    provenance,

    sourceRelationship: {
      ...sourceRelationship,
      provenance: getRelationshipProvenance(
        sourceRelationship,
      ),
    },

    createdAt: timestamp,
    updatedAt: timestamp,
  };

  augmentationState.relationshipInsertionRegistry.set(
    registryKey,
    insertion,
  );

  augmentationState.updatedAt = timestamp;

  return {
    registered: true,
    reason:
      "relationship_insertion_registered",
    insertion:
      cloneRelationshipInsertion(insertion),
  };
}

/* -------------------------------------------------------------------------- */
/*                          Duplicate Record Handling                         */
/* -------------------------------------------------------------------------- */

function registerDuplicateEntity({
  discoveredEntity,
  duplicateMatch,
}) {
  const duplicateId = createDuplicateRecordId();

  const duplicateRecord = {
    duplicateId,
    duplicateType: "entity",
    status: "skipped",

    matchType:
      duplicateMatch.matchType,

    matchedValue:
      duplicateMatch.matchedValue,

    discoveredEntity:
      cloneEntity(discoveredEntity),

    existingEntity:
      cloneEntity(
        duplicateMatch.existingEntity,
      ),

    reason:
      "discovered_entity_matches_existing_graph_entity",

    createdAt: nowIso(),
  };

  augmentationState.duplicateRegistry.set(
    duplicateId,
    duplicateRecord,
  );

  return cloneDuplicateRecord(duplicateRecord);
}

/* -------------------------------------------------------------------------- */
/*                            Augmentation Planner                            */
/* -------------------------------------------------------------------------- */

export function createAugmentationPlan(options = {}) {
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (options.reset !== false) {
    resetGraphAugmentation();
  }

  const graphSnapshot =
    options.graphSnapshot ??
    getKnowledgeGraphSnapshot();

  const discoveredEntities =
    options.discoveredEntities ??
    getAllDiscoveredEntities();

  const entityNodes =
    options.entityNodes ??
    extractEntityNodes(graphSnapshot);

  const objectNodes =
    options.objectNodes ??
    extractObjectNodes(graphSnapshot);

  const relationshipEdges =
    options.relationshipEdges ??
    extractRelationshipEdges(graphSnapshot);

  augmentationState.graphSnapshot = graphSnapshot;
  augmentationState.createdAt = nowIso();
  augmentationState.updatedAt =
    augmentationState.createdAt;

  const existingEntityIndex =
    buildExistingEntityIndex(entityNodes);

  const existingRelationshipKeys = new Set(
    relationshipEdges
      .map(createExistingRelationshipKey)
      .filter(Boolean),
  );

  const entityPlanningResults = [];
  const relationshipPlanningResults = [];
  const duplicates = [];
  const rejectedEntities = [];

  for (const discoveredEntity of discoveredEntities) {
    const duplicateMatch = findDuplicateEntity(
      discoveredEntity,
      existingEntityIndex,
    );

    if (
      duplicateMatch.duplicate &&
      resolvedOptions.skipDuplicateEntities
    ) {
      const duplicateRecord =
        registerDuplicateEntity({
          discoveredEntity,
          duplicateMatch,
        });

      duplicates.push(duplicateRecord);

      entityPlanningResults.push({
        planned: false,
        reason: "duplicate_existing_entity",
        duplicate: duplicateRecord,
      });

      continue;
    }

    const entityRegistration =
      registerEntityInsertion(
        discoveredEntity,
        resolvedOptions,
      );

    entityPlanningResults.push({
      planned: entityRegistration.registered,
      ...entityRegistration,
    });

    if (
      !entityRegistration.registered ||
      !entityRegistration.insertion
    ) {
      rejectedEntities.push({
        discoveredEntity:
          cloneEntity(discoveredEntity),
        reason:
          entityRegistration.reason,
      });

      continue;
    }

    if (
      resolvedOptions.planRelationshipInsertions !==
      true
    ) {
      continue;
    }

    const matchingEdges =
      findEdgesForDiscoveredEntity({
        discoveredEntity,
        relationshipEdges,
        objectNodes,
      });

    if (
      resolvedOptions.requireSourceObjectNode &&
      matchingEdges.length === 0
    ) {
      relationshipPlanningResults.push({
        planned: false,
        reason:
          "no_source_object_relationship_found",
        discoveredEntityId:
          getEntityId(discoveredEntity),
      });

      continue;
    }

    for (const sourceRelationship of matchingEdges) {
      const proposedEntityNode =
        entityRegistration.insertion
          .proposedEntityNode;

      const proposedRelationshipKey =
        createRelationshipRegistryKey({
          subjectNodeId:
            getRelationshipSubjectNodeId(
              sourceRelationship,
            ),
          subjectName:
            getRelationshipSubjectName(
              sourceRelationship,
            ),
          predicate:
            getRelationshipPredicate(
              sourceRelationship,
            ),
          objectEntityId:
            getEntityId(proposedEntityNode),
          objectCanonicalName:
            getEntityCanonicalName(
              proposedEntityNode,
            ),
        });

      if (
        resolvedOptions.skipDuplicateRelationships &&
        existingRelationshipKeys.has(
          proposedRelationshipKey,
        )
      ) {
        relationshipPlanningResults.push({
          planned: false,
          reason:
            "relationship_already_exists_in_graph",
          registryKey:
            proposedRelationshipKey,
        });

        continue;
      }

      const relationshipRegistration =
        registerRelationshipInsertion(
          {
            sourceRelationship,
            discoveredEntity,
            proposedEntityNode,
          },
          resolvedOptions,
        );

      relationshipPlanningResults.push({
        planned:
          relationshipRegistration.registered,
        ...relationshipRegistration,
      });
    }
  }

  const planId = createPlanId();
  const timestamp = nowIso();

  augmentationState.augmentationPlan = {
    planId,
    planType: "knowledge_graph_augmentation",
    phase: "planning",
    status: "ready",

    options: {
      ...resolvedOptions,
    },

    sourceGraphSummary: {
      existingEntityCount:
        entityNodes.length,
      existingObjectNodeCount:
        objectNodes.length,
      existingRelationshipCount:
        relationshipEdges.length,
    },

    discoverySummary: {
      discoveredEntityCount:
        discoveredEntities.length,
      eligibleEntityInsertionCount:
        augmentationState
          .entityInsertionRegistry.size,
      rejectedEntityCount:
        rejectedEntities.length,
      duplicateEntityCount:
        augmentationState
          .duplicateRegistry.size,
    },

    insertionSummary: {
      plannedEntityInsertions:
        augmentationState
          .entityInsertionRegistry.size,

      plannedRelationshipInsertions:
        augmentationState
          .relationshipInsertionRegistry.size,

      totalPlannedInsertions:
        augmentationState
          .entityInsertionRegistry.size +
        augmentationState
          .relationshipInsertionRegistry.size,
    },

    entityPlanningResults,
    relationshipPlanningResults,
    rejectedEntities,
    duplicates,

    mutationApplied: false,
    graphModified: false,

    createdAt:
      augmentationState.createdAt,
    updatedAt: timestamp,
  };

  augmentationState.updatedAt = timestamp;

  return getAugmentationPlan();
}

/* -------------------------------------------------------------------------- */
/*                              Public Getters                                */
/* -------------------------------------------------------------------------- */

export function getPendingEntityInsertions() {
  return Array.from(
    augmentationState
      .entityInsertionRegistry
      .values(),
  )
    .filter((record) => {
      return record.status === "pending";
    })
    .map(cloneEntityInsertion)
    .filter(Boolean);
}

export function getPendingRelationshipInsertions() {
  return Array.from(
    augmentationState
      .relationshipInsertionRegistry
      .values(),
  )
    .filter((record) => {
      return record.status === "pending";
    })
    .map(cloneRelationshipInsertion)
    .filter(Boolean);
}

export function getDuplicateRecords() {
  return Array.from(
    augmentationState.duplicateRegistry.values(),
  )
    .map(cloneDuplicateRecord)
    .filter(Boolean);
}

export function getAugmentationPlan() {
  if (!augmentationState.augmentationPlan) {
    return null;
  }

  return {
    ...augmentationState.augmentationPlan,

    options: {
      ...augmentationState
        .augmentationPlan.options,
    },

    sourceGraphSummary: {
      ...augmentationState
        .augmentationPlan
        .sourceGraphSummary,
    },

    discoverySummary: {
      ...augmentationState
        .augmentationPlan
        .discoverySummary,
    },

    insertionSummary: {
      ...augmentationState
        .augmentationPlan
        .insertionSummary,
    },

    entityPlanningResults:
      augmentationState
        .augmentationPlan
        .entityPlanningResults
        .map((result) => ({
          ...result,
          insertion:
            cloneEntityInsertion(
              result.insertion,
            ),
          duplicate:
            cloneDuplicateRecord(
              result.duplicate,
            ),
        })),

    relationshipPlanningResults:
      augmentationState
        .augmentationPlan
        .relationshipPlanningResults
        .map((result) => ({
          ...result,
          insertion:
            cloneRelationshipInsertion(
              result.insertion,
            ),
        })),

    rejectedEntities:
      augmentationState
        .augmentationPlan
        .rejectedEntities
        .map((item) => ({
          ...item,
          discoveredEntity:
            cloneEntity(
              item.discoveredEntity,
            ),
        })),

    duplicates:
      augmentationState
        .augmentationPlan
        .duplicates
        .map(cloneDuplicateRecord)
        .filter(Boolean),
  };
}

export function getAugmentationSummary() {
  const plan =
    augmentationState.augmentationPlan;

  const pendingEntityInsertions =
    getPendingEntityInsertions();

  const pendingRelationshipInsertions =
    getPendingRelationshipInsertions();

  const discoveryConfidences =
    pendingEntityInsertions
      .map((record) => {
        return Number(
          record.discoveryConfidence,
        );
      })
      .filter(Number.isFinite);

  const relationshipConfidences =
    pendingRelationshipInsertions
      .map((record) => {
        return Number(record.confidence);
      })
      .filter(Number.isFinite);

  const averageDiscoveryConfidence =
    discoveryConfidences.length > 0
      ? discoveryConfidences.reduce(
          (sum, value) => sum + value,
          0,
        ) / discoveryConfidences.length
      : 0;

  const averageRelationshipConfidence =
    relationshipConfidences.length > 0
      ? relationshipConfidences.reduce(
          (sum, value) => sum + value,
          0,
        ) /
        relationshipConfidences.length
      : 0;

  return {
    planId:
      plan?.planId ?? null,

    status:
      plan?.status ?? "not_created",

    phase:
      plan?.phase ?? "planning",

    existingEntities:
      plan?.sourceGraphSummary
        ?.existingEntityCount ?? 0,

    existingObjectNodes:
      plan?.sourceGraphSummary
        ?.existingObjectNodeCount ?? 0,

    existingRelationships:
      plan?.sourceGraphSummary
        ?.existingRelationshipCount ?? 0,

    discoveredEntities:
      plan?.discoverySummary
        ?.discoveredEntityCount ?? 0,

    plannedEntityInsertions:
      pendingEntityInsertions.length,

    plannedRelationshipInsertions:
      pendingRelationshipInsertions.length,

    totalPlannedInsertions:
      pendingEntityInsertions.length +
      pendingRelationshipInsertions.length,

    duplicatesSkipped:
      augmentationState
        .duplicateRegistry.size,

    rejectedEntities:
      plan?.discoverySummary
        ?.rejectedEntityCount ?? 0,

    averageDiscoveryConfidence:
      round(averageDiscoveryConfidence),

    averageRelationshipConfidence:
      round(averageRelationshipConfidence),

    graphModified: false,
    mutationApplied: false,

    createdAt:
      augmentationState.createdAt,

    updatedAt:
      augmentationState.updatedAt,
  };
}

export function getAugmentationSnapshot() {
  return {
    graphSnapshot:
      augmentationState.graphSnapshot,

    plan:
      getAugmentationPlan(),

    pendingEntityInsertions:
      getPendingEntityInsertions(),

    pendingRelationshipInsertions:
      getPendingRelationshipInsertions(),

    duplicates:
      getDuplicateRecords(),

    summary:
      getAugmentationSummary(),

    registryCounts: {
      entityInsertionRegistry:
        augmentationState
          .entityInsertionRegistry.size,

      relationshipInsertionRegistry:
        augmentationState
          .relationshipInsertionRegistry.size,

      duplicateRegistry:
        augmentationState
          .duplicateRegistry.size,
    },

    counters: {
      ...augmentationState.counters,
    },

    createdAt:
      augmentationState.createdAt,

    updatedAt:
      augmentationState.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/*                    Phase 2A — Graph Mutation Helpers                       */
/* -------------------------------------------------------------------------- */

function getNumericEntitySequence(value) {
  const match = cleanString(value).match(
    /^ENTITY_(\d+)$/i,
  );

  if (!match) {
    return null;
  }

  const sequence = Number(match[1]);

  return Number.isFinite(sequence)
    ? sequence
    : null;
}

function getNextPermanentEntitySequence(entityNodes) {
  const sequences = entityNodes
    .flatMap((entity) => [
      getNumericEntitySequence(
        getEntityNodeId(entity),
      ),
      getNumericEntitySequence(
        getEntityId(entity),
      ),
    ])
    .filter(Number.isFinite);

  return sequences.length > 0
    ? Math.max(...sequences) + 1
    : 1;
}

function createPermanentEntityId(sequence) {
  return `ENTITY_${String(sequence).padStart(
    6,
    "0",
  )}`;
}

function getNumericRelationshipSequence(value) {
  const match = cleanString(value).match(
    /^(?:RELATIONSHIP|ENTITY_RELATIONSHIP)_(\d+)$/i,
  );

  if (!match) {
    return null;
  }

  const sequence = Number(match[1]);

  return Number.isFinite(sequence)
    ? sequence
    : null;
}

function getNextRelationshipSequence(
  relationshipEdges,
) {
  const sequences = relationshipEdges
    .flatMap((edge) => [
      getNumericRelationshipSequence(
        edge?.relationshipId,
      ),
      getNumericRelationshipSequence(
        edge?.edgeId,
      ),
      getNumericRelationshipSequence(
        edge?.id,
      ),
    ])
    .filter(Number.isFinite);

  return sequences.length > 0
    ? Math.max(...sequences) + 1
    : 1;
}

function createPermanentRelationshipId(sequence) {
  return `RELATIONSHIP_${String(
    sequence,
  ).padStart(6, "0")}`;
}

function cloneObjectNode(objectNode) {
  if (!objectNode || typeof objectNode !== "object") {
    return null;
  }

  return {
    ...objectNode,

    structuredValue:
      cloneStructuredValue(
        objectNode.structuredValue,
      ),

    provenance:
      cloneProvenance(objectNode.provenance),
  };
}

function cloneRelationshipEdge(edge) {
  if (!edge || typeof edge !== "object") {
    return null;
  }

  return {
    ...edge,

    confidenceValues: Array.isArray(
      edge.confidenceValues,
    )
      ? [...edge.confidenceValues]
      : [],

    provenance:
      cloneProvenance(edge.provenance),

    structuredValue:
      cloneStructuredValue(
        edge.structuredValue,
      ),
  };
}

function createGraphEntityNodeFromInsertion({
  insertion,
  permanentEntityId,
  timestamp,
}) {
  const proposedEntityNode =
    insertion.proposedEntityNode ?? {};

  return {
    ...cloneEntity(proposedEntityNode),

    nodeId: permanentEntityId,
    entityId: permanentEntityId,
    nodeType: "entity",

    canonicalKey:
      insertion.canonicalKey ??
      getEntityCanonicalKey(
        proposedEntityNode,
      ),

    canonicalName:
      insertion.canonicalName ??
      getEntityCanonicalName(
        proposedEntityNode,
      ),

    entityType:
      insertion.entityType ??
      proposedEntityNode.entityType ??
      "concept",

    aliases:
      getEntityAliases(proposedEntityNode),

    candidateId:
      proposedEntityNode.candidateId ??
      null,

    candidateIds:
      getEntityCandidateIds(
        proposedEntityNode,
      ),

    sourceObjectNodeIds: Array.isArray(
      insertion.sourceObjectNodeIds,
    )
      ? [...insertion.sourceObjectNodeIds]
      : [],

    provenance:
      cloneProvenance(
        insertion.provenance,
      ),

    discoveryEntityId:
      insertion.discoveredEntityId ??
      getEntityId(
        insertion.discoveredEntity,
      ) ??
      null,

    discoveryNodeId:
      getEntityNodeId(
        insertion.discoveredEntity,
      ) || null,

    discoveryConfidence:
      insertion.discoveryConfidence ?? 0,

    discoverySource:
      proposedEntityNode.discoverySource ??
      "deterministic_entity_discovery",

    augmentationInsertionId:
      insertion.insertionId,

    augmentationStatus: "applied",
    augmentationSource:
      "graph_augmentation_engine",

    createdAt:
      proposedEntityNode.createdAt ??
      timestamp,

    updatedAt: timestamp,
  };
}

function createEntityRelationshipEdge({
  insertion,
  permanentObjectEntityId,
  relationshipId,
  timestamp,
}) {
  const sourceRelationship =
    insertion.sourceRelationship ?? {};

  const confidence = clamp(
    insertion.confidence ?? 0,
  );

  const subjectEntityId =
    insertion.subjectEntityId ??
    insertion.subjectNodeId ??
    null;

  const subjectName =
    insertion.subject ??
    sourceRelationship.canonicalSubject ??
    sourceRelationship.subject ??
    null;

  const objectCanonicalName =
    insertion.objectCanonicalName ??
    null;

  const normalizedPredicate =
    insertion.normalizedPredicate ??
    normalizePredicate(
      insertion.predicate,
    );

  const relationshipKey = [
    normalizeIdentifier(
      subjectEntityId || subjectName,
    ).toLowerCase(),

    normalizedPredicate,

    normalizeIdentifier(
      permanentObjectEntityId,
    ).toLowerCase(),
  ].join("::");

  return {
    edgeId: relationshipId,
    relationshipId,
    id: relationshipId,

    edgeType: "entity_relationship",
    relationshipType:
      "entity_to_entity",

    relationshipKey,

    fromNodeId:
      subjectEntityId,

    toNodeId:
      permanentObjectEntityId,

    subjectNodeId:
      subjectEntityId,

    subjectEntityId:
      subjectEntityId,

    subject:
      subjectName,

    canonicalSubject:
      subjectName,

    predicate:
      insertion.predicate,

    normalizedPredicate,

    objectNodeId:
      permanentObjectEntityId,

    objectEntityId:
      permanentObjectEntityId,

    targetEntityId:
      permanentObjectEntityId,

    object:
      objectCanonicalName,

    objectCanonicalName,

    objectKey:
      normalizeText(
        objectCanonicalName,
      ),

    structuredValue: null,

    confidenceValues:
      confidence > 0
        ? [confidence]
        : [],

    averageConfidence:
      confidence,

    maxConfidence:
      confidence,

    occurrenceCount: 1,

    sourceRelationshipId:
      insertion.sourceRelationshipId ??
      getRelationshipId(
        sourceRelationship,
      ) ??
      null,

    originalObjectNodeId:
      insertion.originalObjectNodeId ??
      null,

    originalObjectValue:
      insertion.originalObjectValue ??
      null,

    entityDiscoveryConfidence:
      insertion.entityDiscoveryConfidence ??
      0,

    sourceRelationshipConfidence:
      insertion.sourceRelationshipConfidence ??
      0,

    provenance:
      cloneProvenance(
        insertion.provenance,
      ),

    augmentationInsertionId:
      insertion.insertionId,

    augmentationStatus: "applied",

    augmentationSource:
      "graph_augmentation_engine",

    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createEntityNodeDuplicateKey(entity) {
  return [
    normalizeText(
      getEntityNodeId(entity),
    ),
    normalizeText(
      getEntityId(entity),
    ),
    getEntityCanonicalKey(entity),
  ].join("::");
}

function createEntityEdgeDuplicateKey(edge) {
  return [
    normalizeText(
      getRelationshipSubjectNodeId(edge),
    ),

    normalizePredicate(
      getRelationshipPredicate(edge),
    ),

    normalizeText(
      edge?.objectEntityId ??
      edge?.targetEntityId ??
      edge?.toNodeId ??
      edge?.objectCanonicalName ??
      getRelationshipObjectValue(edge),
    ),
  ].join("::");
}

function markEntityInsertionApplied({
  insertion,
  permanentEntityId,
  timestamp,
}) {
  const appliedRecord = {
    ...cloneEntityInsertion(insertion),

    status: "applied",

    permanentEntityId,
    permanentNodeId:
      permanentEntityId,

    appliedAt: timestamp,
    updatedAt: timestamp,
  };

  augmentationState
    .appliedEntityInsertionRegistry
    .set(
      insertion.insertionId,
      appliedRecord,
    );

  const registryRecord =
    augmentationState
      .entityInsertionRegistry
      .get(insertion.registryKey);

  if (registryRecord) {
    registryRecord.status = "applied";
    registryRecord.permanentEntityId =
      permanentEntityId;
    registryRecord.permanentNodeId =
      permanentEntityId;
    registryRecord.appliedAt = timestamp;
    registryRecord.updatedAt = timestamp;
  }

  return appliedRecord;
}

function markRelationshipInsertionApplied({
  insertion,
  relationshipId,
  permanentObjectEntityId,
  timestamp,
}) {
  const appliedRecord = {
    ...cloneRelationshipInsertion(insertion),

    status: "applied",

    permanentRelationshipId:
      relationshipId,

    permanentObjectEntityId,

    appliedAt: timestamp,
    updatedAt: timestamp,
  };

  augmentationState
    .appliedRelationshipInsertionRegistry
    .set(
      insertion.insertionId,
      appliedRecord,
    );

  const registryRecord =
    augmentationState
      .relationshipInsertionRegistry
      .get(insertion.registryKey);

  if (registryRecord) {
    registryRecord.status = "applied";

    registryRecord.permanentRelationshipId =
      relationshipId;

    registryRecord.permanentObjectEntityId =
      permanentObjectEntityId;

    registryRecord.appliedAt =
      timestamp;

    registryRecord.updatedAt =
      timestamp;
  }

  return appliedRecord;
}

/* -------------------------------------------------------------------------- */
/*                     Phase 2A — Apply Mutation Plan                         */
/* -------------------------------------------------------------------------- */

export function applyAugmentationPlan(
  options = {},
) {
  const plan =
    augmentationState.augmentationPlan;

  if (!plan) {
    return {
      applied: false,
      reason:
        "augmentation_plan_not_created",
      report: null,
    };
  }

  if (
    augmentationState.mutationReport &&
    options.force !== true
  ) {
    return {
      applied: false,
      reason:
        "augmentation_plan_already_applied",
      report:
        getAugmentationMutationReport(),
    };
  }

  const sourceGraph =
    options.graphSnapshot ??
    augmentationState.graphSnapshot;

  if (!sourceGraph) {
    return {
      applied: false,
      reason:
        "source_graph_snapshot_unavailable",
      report: null,
    };
  }

  const timestamp = nowIso();

  const existingEntityNodes =
    extractEntityNodes(sourceGraph)
      .map(cloneEntity)
      .filter(Boolean);

  const existingObjectNodes =
    extractObjectNodes(sourceGraph)
      .map(cloneObjectNode)
      .filter(Boolean);

  const existingRelationshipEdges =
    extractRelationshipEdges(sourceGraph)
      .map(cloneRelationshipEdge)
      .filter(Boolean);

  const entityInsertions =
    getPendingEntityInsertions();

  const relationshipInsertions =
    getPendingRelationshipInsertions();

  let nextEntitySequence =
    getNextPermanentEntitySequence(
      existingEntityNodes,
    );

  let nextRelationshipSequence =
    getNextRelationshipSequence(
      existingRelationshipEdges,
    );

  const entityNodeKeys = new Set(
    existingEntityNodes.map(
      createEntityNodeDuplicateKey,
    ),
  );

  const relationshipEdgeKeys = new Set(
    existingRelationshipEdges.map(
      createEntityEdgeDuplicateKey,
    ),
  );

  const insertedEntityNodes = [];
  const insertedRelationshipEdges = [];

  const skippedEntityInsertions = [];
  const skippedRelationshipInsertions = [];

  augmentationState
    .entityIdMappingRegistry
    .clear();

  augmentationState
    .appliedEntityInsertionRegistry
    .clear();

  augmentationState
    .appliedRelationshipInsertionRegistry
    .clear();

  for (const insertion of entityInsertions) {
    const permanentEntityId =
      createPermanentEntityId(
        nextEntitySequence,
      );

    const graphEntityNode =
      createGraphEntityNodeFromInsertion({
        insertion,
        permanentEntityId,
        timestamp,
      });

    const duplicateKey =
      createEntityNodeDuplicateKey(
        graphEntityNode,
      );

    const canonicalDuplicate =
      existingEntityNodes.find(
        (entity) => {
          return (
            getEntityCanonicalKey(entity) &&
            getEntityCanonicalKey(entity) ===
              getEntityCanonicalKey(
                graphEntityNode,
              )
          );
        },
      );

    if (
      entityNodeKeys.has(duplicateKey) ||
      canonicalDuplicate
    ) {
      const existingEntity =
        canonicalDuplicate ?? null;

      const resolvedPermanentEntityId =
        existingEntity
          ? (
              getEntityId(
                existingEntity,
              ) ||
              getEntityNodeId(
                existingEntity,
              )
            )
          : permanentEntityId;

      augmentationState
        .entityIdMappingRegistry
        .set(
          insertion.discoveredEntityId,
          resolvedPermanentEntityId,
        );

      skippedEntityInsertions.push({
        insertionId:
          insertion.insertionId,

        reason:
          "entity_already_exists_in_augmented_graph",

        discoveredEntityId:
          insertion.discoveredEntityId,

        resolvedPermanentEntityId,
      });

      continue;
    }

    nextEntitySequence += 1;

    entityNodeKeys.add(duplicateKey);

    insertedEntityNodes.push(
      graphEntityNode,
    );

    augmentationState
      .entityIdMappingRegistry
      .set(
        insertion.discoveredEntityId,
        permanentEntityId,
      );

    markEntityInsertionApplied({
      insertion,
      permanentEntityId,
      timestamp,
    });
  }

  const augmentedEntityNodes = [
    ...existingEntityNodes,
    ...insertedEntityNodes,
  ];

  for (
    const insertion
    of relationshipInsertions
  ) {
    const permanentObjectEntityId =
      augmentationState
        .entityIdMappingRegistry
        .get(
          insertion.objectEntityId,
        );

    if (!permanentObjectEntityId) {
      skippedRelationshipInsertions.push({
        insertionId:
          insertion.insertionId,

        reason:
          "permanent_object_entity_id_unresolved",

        discoveredObjectEntityId:
          insertion.objectEntityId,
      });

      continue;
    }

    const relationshipId =
      createPermanentRelationshipId(
        nextRelationshipSequence,
      );

    const graphRelationshipEdge =
      createEntityRelationshipEdge({
        insertion,
        permanentObjectEntityId,
        relationshipId,
        timestamp,
      });

    const duplicateKey =
      createEntityEdgeDuplicateKey(
        graphRelationshipEdge,
      );

    if (
      relationshipEdgeKeys.has(
        duplicateKey,
      )
    ) {
      skippedRelationshipInsertions.push({
        insertionId:
          insertion.insertionId,

        reason:
          "entity_relationship_already_exists",

        relationshipKey:
          duplicateKey,
      });

      continue;
    }

    nextRelationshipSequence += 1;

    relationshipEdgeKeys.add(
      duplicateKey,
    );

    insertedRelationshipEdges.push(
      graphRelationshipEdge,
    );

    markRelationshipInsertionApplied({
      insertion,
      relationshipId,
      permanentObjectEntityId,
      timestamp,
    });
  }

  const preserveOriginalObjectEdges =
    options.preserveOriginalObjectEdges ??
    true;

  const retainedExistingEdges =
    preserveOriginalObjectEdges
      ? existingRelationshipEdges
      : existingRelationshipEdges.filter(
          (edge) => {
            const edgeId =
              getRelationshipId(edge);

            return !relationshipInsertions.some(
              (insertion) => {
                return (
                  insertion
                    .sourceRelationshipId ===
                  edgeId
                );
              },
            );
          },
        );

  const augmentedRelationshipEdges = [
    ...retainedExistingEdges,
    ...insertedRelationshipEdges,
  ];

  augmentationState.augmentedGraphSnapshot = {
    ...sourceGraph,

    entityNodes:
      augmentedEntityNodes,

    objectNodes:
      existingObjectNodes,

    relationshipEdges:
      augmentedRelationshipEdges,

    entities:
      augmentedEntityNodes,

    objects:
      existingObjectNodes,

    relationships:
      augmentedRelationshipEdges,

    nodes: {
      entities:
        augmentedEntityNodes,

      objects:
        existingObjectNodes,

      entityNodes:
        augmentedEntityNodes,

      objectNodes:
        existingObjectNodes,
    },

    edges:
      augmentedRelationshipEdges,

    augmentationMetadata: {
      planId: plan.planId,

      mutationPhase:
        "in_memory_graph_augmentation",

      sourceEntityCount:
        existingEntityNodes.length,

      sourceObjectNodeCount:
        existingObjectNodes.length,

      sourceRelationshipCount:
        existingRelationshipEdges.length,

      insertedEntityCount:
        insertedEntityNodes.length,

      insertedRelationshipCount:
        insertedRelationshipEdges.length,

      finalEntityCount:
        augmentedEntityNodes.length,

      finalObjectNodeCount:
        existingObjectNodes.length,

      finalRelationshipCount:
        augmentedRelationshipEdges.length,

      preserveOriginalObjectEdges,

      mutationApplied: true,
      graphModified: true,

      appliedAt: timestamp,
    },
  };

  augmentationState.mutationReport = {
    planId: plan.planId,

    status: "applied",

    phase:
      "in_memory_graph_augmentation",

    applied: true,
    graphModified: true,

    sourceGraph: {
      entityCount:
        existingEntityNodes.length,

      objectNodeCount:
        existingObjectNodes.length,

      relationshipCount:
        existingRelationshipEdges.length,
    },

    insertions: {
      entityInsertionsRequested:
        entityInsertions.length,

      entityInsertionsApplied:
        insertedEntityNodes.length,

      entityInsertionsSkipped:
        skippedEntityInsertions.length,

      relationshipInsertionsRequested:
        relationshipInsertions.length,

      relationshipInsertionsApplied:
        insertedRelationshipEdges.length,

      relationshipInsertionsSkipped:
        skippedRelationshipInsertions.length,
    },

    finalGraph: {
      entityCount:
        augmentedEntityNodes.length,

      objectNodeCount:
        existingObjectNodes.length,

      relationshipCount:
        augmentedRelationshipEdges.length,

      entityToEntityRelationshipCount:
        augmentedRelationshipEdges.filter(
          (edge) => {
            return (
              edge.edgeType ===
                "entity_relationship" ||
              edge.relationshipType ===
                "entity_to_entity"
            );
          },
        ).length,
    },

    preserveOriginalObjectEdges,

    entityIdMappings:
      Array.from(
        augmentationState
          .entityIdMappingRegistry
          .entries(),
      ).map(
        ([
          discoveredEntityId,
          permanentEntityId,
        ]) => ({
          discoveredEntityId,
          permanentEntityId,
        }),
      ),

    insertedEntityNodes:
      insertedEntityNodes.map(
        cloneEntity,
      ),

    insertedRelationshipEdges:
      insertedRelationshipEdges.map(
        cloneRelationshipEdge,
      ),

    skippedEntityInsertions,

    skippedRelationshipInsertions,

    appliedAt: timestamp,
    updatedAt: timestamp,
  };

  if (
    augmentationState.augmentationPlan
  ) {
    augmentationState
      .augmentationPlan
      .status = "applied";

    augmentationState
      .augmentationPlan
      .phase =
        "in_memory_graph_augmentation";

    augmentationState
      .augmentationPlan
      .mutationApplied = true;

    augmentationState
      .augmentationPlan
      .graphModified = true;

    augmentationState
      .augmentationPlan
      .updatedAt = timestamp;
  }

  augmentationState.updatedAt =
    timestamp;

  return {
    applied: true,

    reason:
      "augmentation_plan_applied_in_memory",

    report:
      getAugmentationMutationReport(),

    graph:
      getAugmentedGraphSnapshot(),
  };
}

/* -------------------------------------------------------------------------- */
/*                       Phase 2A — Mutation Getters                          */
/* -------------------------------------------------------------------------- */

export function getEntityIdMappings() {
  return Array.from(
    augmentationState
      .entityIdMappingRegistry
      .entries(),
  ).map(
    ([
      discoveredEntityId,
      permanentEntityId,
    ]) => ({
      discoveredEntityId,
      permanentEntityId,
    }),
  );
}

export function getAppliedEntityInsertions() {
  return Array.from(
    augmentationState
      .appliedEntityInsertionRegistry
      .values(),
  )
    .map(cloneEntityInsertion)
    .filter(Boolean);
}

export function getAppliedRelationshipInsertions() {
  return Array.from(
    augmentationState
      .appliedRelationshipInsertionRegistry
      .values(),
  )
    .map(cloneRelationshipInsertion)
    .filter(Boolean);
}

export function getAugmentedGraphSnapshot() {
  const graph =
    augmentationState
      .augmentedGraphSnapshot;

  if (!graph) {
    return null;
  }

  const entityNodes =
    extractEntityNodes(graph)
      .map(cloneEntity)
      .filter(Boolean);

  const objectNodes =
    extractObjectNodes(graph)
      .map(cloneObjectNode)
      .filter(Boolean);

  const relationshipEdges =
    extractRelationshipEdges(graph)
      .map(cloneRelationshipEdge)
      .filter(Boolean);

  return {
    ...graph,

    entityNodes,
    objectNodes,
    relationshipEdges,

    entities: entityNodes,
    objects: objectNodes,
    relationships:
      relationshipEdges,

    nodes: {
      entities: entityNodes,
      objects: objectNodes,
      entityNodes,
      objectNodes,
    },

    edges:
      relationshipEdges,

    augmentationMetadata:
      graph.augmentationMetadata
        ? {
            ...graph
              .augmentationMetadata,
          }
        : null,
  };
}

export function getAugmentationMutationReport() {
  const report =
    augmentationState.mutationReport;

  if (!report) {
    return null;
  }

  return {
    ...report,

    sourceGraph: {
      ...report.sourceGraph,
    },

    insertions: {
      ...report.insertions,
    },

    finalGraph: {
      ...report.finalGraph,
    },

    entityIdMappings:
      report.entityIdMappings.map(
        (mapping) => ({
          ...mapping,
        }),
      ),

    insertedEntityNodes:
      report.insertedEntityNodes
        .map(cloneEntity)
        .filter(Boolean),

    insertedRelationshipEdges:
      report
        .insertedRelationshipEdges
        .map(cloneRelationshipEdge)
        .filter(Boolean),

    skippedEntityInsertions:
      report.skippedEntityInsertions.map(
        (item) => ({
          ...item,
        }),
      ),

    skippedRelationshipInsertions:
      report
        .skippedRelationshipInsertions
        .map((item) => ({
          ...item,
        })),
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Reset                                     */
/* -------------------------------------------------------------------------- */

export function resetGraphAugmentation() {
  augmentationState.graphSnapshot = null;
  augmentationState.augmentationPlan = null;

  augmentationState.augmentedGraphSnapshot = null;
  augmentationState.mutationReport = null;

  augmentationState
    .entityInsertionRegistry
    .clear();

  augmentationState
    .relationshipInsertionRegistry
    .clear();

  augmentationState
    .duplicateRegistry
    .clear();

  augmentationState
    .entityIdMappingRegistry
    .clear();

  augmentationState
    .appliedEntityInsertionRegistry
    .clear();

  augmentationState
    .appliedRelationshipInsertionRegistry
    .clear();

  augmentationState.counters = {
    plan: 0,
    entityInsertion: 0,
    relationshipInsertion: 0,
    duplicate: 0,
  };

  augmentationState.createdAt = null;
  augmentationState.updatedAt = null;

  return {
    reset: true,
    entityInsertionCount: 0,
    relationshipInsertionCount: 0,
    duplicateCount: 0,
    graphModified: false,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Helper Exports                                */
/* -------------------------------------------------------------------------- */

export {
  DEFAULT_OPTIONS,
  normalizeText,
  normalizeIdentifier,
  normalizePredicate,
  extractEntityNodes,
  extractObjectNodes,
  extractRelationshipEdges,
  getEntityNodeId,
  getEntityId,
  getEntityCanonicalName,
  getEntityCanonicalKey,
  getEntityAliases,
  getEntityCandidateIds,
  getSourceObjectNodeIds,
  getRelationshipId,
  getRelationshipSubjectNodeId,
  getRelationshipSubjectName,
  getRelationshipObjectNodeId,
  getRelationshipObjectValue,
  getRelationshipPredicate,
  getRelationshipConfidence,
  getRelationshipProvenance,
  createEntityRegistryKey,
  createRelationshipRegistryKey,
  buildExistingEntityIndex,
  findDuplicateEntity,
  findEdgesForDiscoveredEntity,
  cloneEntity,
  cloneEntityInsertion,
  cloneRelationshipInsertion,
  cloneDuplicateRecord,
};