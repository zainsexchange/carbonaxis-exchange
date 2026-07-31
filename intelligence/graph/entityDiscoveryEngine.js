import {
  getKnowledgeGraphSnapshot,
  normalizeGraphKey,
} from "./knowledgeGraphStore.js";

/**
 * Entity Discovery Engine
 *
 * Deterministically inspects graph object nodes and identifies objects that
 * are suitable for promotion into first-class entity candidates.
 *
 * Important:
 * - No LLM is used.
 * - Existing graph state is not mutated directly.
 * - Promoted entities are stored in an isolated discovery registry.
 * - The resulting entities can be passed into the Object-to-Entity Linker.
 */

const discoveredEntityRegistry = new Map();
const discoveryRecords = new Map();

let discoveredEntityCounter = 0;
let discoveryRecordCounter = 0;

const DEFAULT_OPTIONS = Object.freeze({
  minimumConfidence: 0.72,
  minimumTokenCount: 1,
  maximumTokenCount: 12,
  allowStructuredMetrics: false,
  allowActionPhrases: true,
  allowGenericConcepts: true,
  requireProvenance: false,
});

/**
 * Action phrases that can still represent useful graph concepts.
 *
 * Examples:
 * - expanding solar generation
 * - developing wind corridors
 * - establishing climate investment funds
 */
const ACTION_PREFIXES = Object.freeze([
  "adopting",
  "building",
  "creating",
  "developing",
  "establishing",
  "expanding",
  "financing",
  "funding",
  "implementing",
  "improving",
  "investing",
  "mobilizing",
  "promoting",
  "reducing",
  "supporting",
  "targeting",
]);

/**
 * Object values that usually represent literal measurements rather than
 * independent entities.
 */
const NON_ENTITY_STRUCTURED_TYPES = Object.freeze([
  "percentage",
  "currency",
  "number",
  "date",
  "year",
  "duration",
  "temperature",
  "distance",
  "weight",
]);

/**
 * Generic stop values that should not become entities.
 */
const BLOCKED_GENERIC_VALUES = Object.freeze([
  "none",
  "null",
  "unknown",
  "not available",
  "not applicable",
  "n a",
  "na",
  "yes",
  "no",
  "true",
  "false",
]);

function cleanString(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  const text = cleanString(value);

  if (!text) {
    return "";
  }

  if (typeof normalizeGraphKey === "function") {
    return normalizeGraphKey(text);
  }

  return text
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
      values
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

function tokenize(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return [];
  }

  return normalized.split(/\s+/).filter(Boolean);
}

function titleCase(value) {
  return cleanString(value)
    .split(/\s+/)
    .map((word) => {
      if (!word) {
        return word;
      }

      if (/^[A-Z0-9]{2,}$/.test(word)) {
        return word;
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
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

function cloneObjectNode(objectNode) {
  if (!objectNode || typeof objectNode !== "object") {
    return null;
  }

  return {
    ...objectNode,
    structuredValue: cloneStructuredValue(objectNode.structuredValue),
    provenance: Array.isArray(objectNode.provenance)
      ? objectNode.provenance
          .map(cloneProvenanceItem)
          .filter(Boolean)
      : [],
  };
}

function cloneDiscoveredEntity(entity) {
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
    sourceObjectNodeIds: Array.isArray(entity.sourceObjectNodeIds)
      ? [...entity.sourceObjectNodeIds]
      : [],
    provenance: Array.isArray(entity.provenance)
      ? entity.provenance
          .map(cloneProvenanceItem)
          .filter(Boolean)
      : [],
    discoverySignals: Array.isArray(entity.discoverySignals)
      ? entity.discoverySignals.map((signal) => ({
          ...signal,
        }))
      : [],
  };
}

function cloneDiscoveryRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  return {
    ...record,
    objectNode: cloneObjectNode(record.objectNode),
    entity: cloneDiscoveredEntity(record.entity),
    signals: Array.isArray(record.signals)
      ? record.signals.map((signal) => ({
          ...signal,
        }))
      : [],
    rejectionReasons: Array.isArray(record.rejectionReasons)
      ? [...record.rejectionReasons]
      : [],
  };
}

/**
 * Read object nodes from supported graph snapshot shapes.
 */
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
      return values.filter(
        (node) =>
          node &&
          (
            node.nodeType === "object" ||
            node.objectKey ||
            node.value
          ),
      );
    }
  }

  return toArray(snapshot?.nodes).filter(
    (node) =>
      node?.nodeType === "object" ||
      Boolean(node?.objectKey),
  );
}

/**
 * Read relationship edges from supported graph snapshot shapes.
 */
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
      return values.filter(
        (edge) =>
          edge &&
          (
            edge.relationshipId ||
            edge.edgeId ||
            edge.predicate
          ),
      );
    }
  }

  return [];
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
    objectNode?.title ??
    objectNode?.objectKey ??
    objectNode?.structuredValue?.raw ??
    objectNode?.structuredValue?.metric,
  );
}

function getObjectAliases(objectNode) {
  return uniqueStrings([
    getObjectValue(objectNode),
    objectNode?.objectKey,
    objectNode?.label,
    objectNode?.name,
    objectNode?.title,
    objectNode?.structuredValue?.raw,
    objectNode?.structuredValue?.metric,
  ]);
}

function getObjectProvenance(objectNode, relationshipEdges = []) {
  const directProvenance = Array.isArray(objectNode?.provenance)
    ? objectNode.provenance
    : [];

  const objectNodeId = getObjectNodeId(objectNode);
  const normalizedValue = normalizeText(getObjectValue(objectNode));

  const relationshipProvenance = relationshipEdges
    .filter((edge) => {
      const edgeObjectNodeId = cleanString(
        edge?.objectNodeId ??
        edge?.toNodeId,
      );

      const edgeObjectValue = normalizeText(
        edge?.object ??
        edge?.objectValue,
      );

      return (
        (objectNodeId && edgeObjectNodeId === objectNodeId) ||
        (
          normalizedValue &&
          edgeObjectValue === normalizedValue
        )
      );
    })
    .flatMap((edge) => {
      if (Array.isArray(edge.provenance)) {
        return edge.provenance;
      }

      if (Array.isArray(edge.evidence)) {
        return edge.evidence;
      }

      const hasInlineProvenance =
        edge.sourceDocumentId ||
        edge.sourceChunkId ||
        edge.sourceLine ||
        edge.originalBlockText ||
        edge.contextualSentence ||
        edge.clause;

      return hasInlineProvenance
        ? [
            {
              sourceDocumentId: edge.sourceDocumentId ?? null,
              sourceChunkId: edge.sourceChunkId ?? null,
              sourceLine: edge.sourceLine ?? null,
              contextPath: Array.isArray(edge.contextPath)
                ? [...edge.contextPath]
                : [],
              originalBlockText: edge.originalBlockText ?? null,
              contextualSentence: edge.contextualSentence ?? null,
              clause: edge.clause ?? null,
              confidence: edge.confidence ?? null,
            },
          ]
        : [];
    });

  const combined = [
    ...directProvenance,
    ...relationshipProvenance,
  ]
    .map(cloneProvenanceItem)
    .filter(Boolean);

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

function startsWithActionPhrase(value) {
  const normalized = normalizeText(value);

  return ACTION_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(`${prefix} `),
  );
}

function isBlockedGenericValue(value) {
  return BLOCKED_GENERIC_VALUES.includes(normalizeText(value));
}

function appearsToBeOnlyNumeric(value) {
  const text = cleanString(value);

  if (!text) {
    return false;
  }

  const stripped = text
    .replace(/[$€£,%]/g, "")
    .replace(/\b(?:usd|eur|gbp|pkr|million|billion|trillion)\b/gi, "")
    .replace(/\b(?:by|in|from|to)\b/gi, "")
    .replace(/\d{4}/g, "")
    .replace(/[0-9.\-–—\s]/g, "")
    .trim();

  return stripped.length === 0;
}

function appearsToBeSentence(value) {
  const text = cleanString(value);
  const tokenCount = tokenize(text).length;

  return (
    tokenCount > 14 ||
    /[.!?]$/.test(text)
  );
}

function inferEntityType(objectValue, objectNode) {
  const normalized = normalizeText(objectValue);
  const structuredType = normalizeText(
    objectNode?.structuredValue?.type,
  );

  if (
    normalized.includes("fund") ||
    normalized.includes("bond") ||
    normalized.includes("finance") ||
    normalized.includes("investment")
  ) {
    return "financial_concept";
  }

  if (
    normalized.includes("solar") ||
    normalized.includes("wind") ||
    normalized.includes("renewable") ||
    normalized.includes("hydrogen") ||
    normalized.includes("energy")
  ) {
    return "energy_concept";
  }

  if (
    normalized.includes("policy") ||
    normalized.includes("strategy") ||
    normalized.includes("framework") ||
    normalized.includes("plan")
  ) {
    return "policy_concept";
  }

  if (
    normalized.includes("project") ||
    normalized.includes("programme") ||
    normalized.includes("program") ||
    normalized.includes("initiative")
  ) {
    return "initiative";
  }

  if (
    normalized.includes("organization") ||
    normalized.includes("authority") ||
    normalized.includes("agency") ||
    normalized.includes("ministry") ||
    normalized.includes("bank")
  ) {
    return "organization";
  }

  if (
    structuredType &&
    !NON_ENTITY_STRUCTURED_TYPES.includes(structuredType)
  ) {
    return `${structuredType}_concept`;
  }

  return "concept";
}

function inferCanonicalName(objectValue) {
  const cleaned = cleanString(objectValue);

  if (!cleaned) {
    return "";
  }

  return titleCase(cleaned);
}

function calculateDiscoverySignals(
  objectNode,
  provenance,
  options,
) {
  const objectValue = getObjectValue(objectNode);
  const normalizedValue = normalizeText(objectValue);
  const tokens = tokenize(objectValue);
  const structuredType = normalizeText(
    objectNode?.structuredValue?.type,
  );

  const signals = [];
  const rejectionReasons = [];

  if (!objectValue || !normalizedValue) {
    rejectionReasons.push("Object value is empty.");
  }

  if (isBlockedGenericValue(objectValue)) {
    rejectionReasons.push("Object value is a blocked generic value.");
  }

  if (tokens.length < options.minimumTokenCount) {
    rejectionReasons.push(
      `Object contains fewer than ${options.minimumTokenCount} token(s).`,
    );
  }

  if (tokens.length > options.maximumTokenCount) {
    rejectionReasons.push(
      `Object contains more than ${options.maximumTokenCount} tokens.`,
    );
  }

  if (appearsToBeOnlyNumeric(objectValue)) {
    rejectionReasons.push(
      "Object appears to contain only a numeric or temporal value.",
    );
  }

  if (appearsToBeSentence(objectValue)) {
    rejectionReasons.push(
      "Object appears to be a complete sentence rather than an entity concept.",
    );
  }

  if (
    structuredType &&
    NON_ENTITY_STRUCTURED_TYPES.includes(structuredType) &&
    options.allowStructuredMetrics !== true
  ) {
    rejectionReasons.push(
      `Structured value type "${structuredType}" is treated as a literal.`,
    );
  }

  const actionPhrase = startsWithActionPhrase(objectValue);

  if (actionPhrase && options.allowActionPhrases !== true) {
    rejectionReasons.push(
      "Action phrases are disabled for entity discovery.",
    );
  }

  if (options.requireProvenance === true && provenance.length === 0) {
    rejectionReasons.push(
      "No provenance is available for the object.",
    );
  }

  let score = 0.4;

  if (tokens.length >= 2 && tokens.length <= 8) {
    score += 0.16;

    signals.push({
      signal: "compact_concept_phrase",
      contribution: 0.16,
    });
  }

  if (tokens.length === 1) {
    score += 0.05;

    signals.push({
      signal: "single_term_concept",
      contribution: 0.05,
    });
  }

  if (actionPhrase) {
    score += 0.08;

    signals.push({
      signal: "recognized_action_concept",
      contribution: 0.08,
    });
  }

  if (provenance.length > 0) {
    score += Math.min(0.14, provenance.length * 0.04);

    signals.push({
      signal: "provenance_available",
      contribution: Math.min(0.14, provenance.length * 0.04),
      count: provenance.length,
    });
  }

  if (
    /(?:fund|bond|policy|strategy|framework|plan|project|programme|program|initiative|authority|agency|ministry|bank|solar|wind|renewable|hydrogen|energy|market|mechanism)/i.test(
      objectValue,
    )
  ) {
    score += 0.14;

    signals.push({
      signal: "recognized_entity_semantics",
      contribution: 0.14,
    });
  }

  if (
    objectNode?.structuredValue &&
    !structuredType
  ) {
    score += 0.02;

    signals.push({
      signal: "structured_context_available",
      contribution: 0.02,
    });
  }

  if (
    structuredType &&
    NON_ENTITY_STRUCTURED_TYPES.includes(structuredType)
  ) {
    score -= 0.24;

    signals.push({
      signal: "literal_structured_value_penalty",
      contribution: -0.24,
      structuredType,
    });
  }

  if (appearsToBeOnlyNumeric(objectValue)) {
    score -= 0.35;

    signals.push({
      signal: "numeric_literal_penalty",
      contribution: -0.35,
    });
  }

  if (appearsToBeSentence(objectValue)) {
    score -= 0.2;

    signals.push({
      signal: "sentence_penalty",
      contribution: -0.2,
    });
  }

  score = clamp(score);

  return {
    score: round(score),
    signals,
    rejectionReasons,
  };
}

function createDiscoveredEntityId() {
  discoveredEntityCounter += 1;

  return `DISCOVERED_ENTITY_${String(discoveredEntityCounter).padStart(
    6,
    "0",
  )}`;
}

function createDiscoveryRecordId() {
  discoveryRecordCounter += 1;

  return `ENTITY_DISCOVERY_${String(discoveryRecordCounter).padStart(
    6,
    "0",
  )}`;
}

function createCandidateId(canonicalName, entityType) {
  const normalizedName = normalizeIdentifier(canonicalName);
  const normalizedType = normalizeIdentifier(entityType || "concept");

  return `${normalizedType}_${normalizedName}`;
}

function createDiscoveryKey(objectNode) {
  return normalizeText(
    getObjectValue(objectNode) ||
    getObjectNodeId(objectNode),
  );
}

function mergeProvenance(existing, incoming) {
  const combined = [
    ...(Array.isArray(existing) ? existing : []),
    ...(Array.isArray(incoming) ? incoming : []),
  ]
    .map(cloneProvenanceItem)
    .filter(Boolean);

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

/**
 * Evaluate whether one graph object should become an entity candidate.
 */
export function evaluateObjectForEntityDiscovery(
  objectNode,
  options = {},
) {
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (!objectNode || typeof objectNode !== "object") {
    return {
      eligible: false,
      confidence: 0,
      objectNode: null,
      proposedEntity: null,
      signals: [],
      rejectionReasons: [
        "A valid object node was not provided.",
      ],
    };
  }

  const snapshot = options.snapshot ?? getKnowledgeGraphSnapshot();
  const relationshipEdges =
    options.relationshipEdges ??
    extractRelationshipEdges(snapshot);

  const objectValue = getObjectValue(objectNode);
  const provenance = getObjectProvenance(
    objectNode,
    relationshipEdges,
  );

  const evaluation = calculateDiscoverySignals(
    objectNode,
    provenance,
    resolvedOptions,
  );

  const eligible =
    evaluation.rejectionReasons.length === 0 &&
    evaluation.score >= resolvedOptions.minimumConfidence;

  const canonicalName = inferCanonicalName(objectValue);
  const entityType = inferEntityType(objectValue, objectNode);
  const candidateId = createCandidateId(
    canonicalName,
    entityType,
  );

  const proposedEntity = eligible
    ? {
        nodeId: null,
        nodeType: "entity",
        entityId: null,
        canonicalKey: normalizeText(canonicalName),
        canonicalName,
        aliases: getObjectAliases(objectNode),
        entityType,
        parentCountry: null,
        candidateId,
        candidateIds: [candidateId],
        occurrenceCount: 1,
        sourceObjectNodeIds: [
          getObjectNodeId(objectNode),
        ].filter(Boolean),
        provenance,
        discoveryConfidence: evaluation.score,
        discoverySignals: evaluation.signals,
        discoverySource: "deterministic_entity_discovery",
      }
    : null;

  return {
    eligible,
    confidence: evaluation.score,
    minimumConfidence: resolvedOptions.minimumConfidence,
    objectNode: cloneObjectNode(objectNode),
    proposedEntity,
    signals: evaluation.signals,
    rejectionReasons: evaluation.rejectionReasons,
  };
}

/**
 * Promote one eligible graph object into the discovery registry.
 */
export function promoteObjectToEntity(
  objectNode,
  options = {},
) {
  const evaluation = evaluateObjectForEntityDiscovery(
    objectNode,
    options,
  );

  const discoveryKey = createDiscoveryKey(objectNode);

  if (!discoveryKey) {
    return {
      promoted: false,
      evaluation,
      entity: null,
      record: null,
    };
  }

  if (!evaluation.eligible || !evaluation.proposedEntity) {
    const rejectionRecord = {
      discoveryRecordId: createDiscoveryRecordId(),
      discoveryKey,
      status: "rejected",
      confidence: evaluation.confidence,
      objectNode: cloneObjectNode(objectNode),
      entity: null,
      signals: evaluation.signals,
      rejectionReasons: evaluation.rejectionReasons,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    discoveryRecords.set(
      discoveryKey,
      rejectionRecord,
    );

    return {
      promoted: false,
      evaluation,
      entity: null,
      record: cloneDiscoveryRecord(rejectionRecord),
    };
  }

  const existingEntity = discoveredEntityRegistry.get(discoveryKey);

  if (existingEntity) {
    existingEntity.occurrenceCount += 1;
    existingEntity.discoveryConfidence = Math.max(
      existingEntity.discoveryConfidence,
      evaluation.confidence,
    );

    existingEntity.aliases = uniqueStrings([
      ...existingEntity.aliases,
      ...evaluation.proposedEntity.aliases,
    ]);

    existingEntity.sourceObjectNodeIds = uniqueStrings([
      ...existingEntity.sourceObjectNodeIds,
      ...evaluation.proposedEntity.sourceObjectNodeIds,
    ]);

    existingEntity.provenance = mergeProvenance(
      existingEntity.provenance,
      evaluation.proposedEntity.provenance,
    );

    existingEntity.updatedAt = new Date().toISOString();

    const existingRecord = discoveryRecords.get(discoveryKey);

    if (existingRecord) {
      existingRecord.status = "promoted";
      existingRecord.confidence =
        existingEntity.discoveryConfidence;
      existingRecord.entity = cloneDiscoveredEntity(existingEntity);
      existingRecord.updatedAt = new Date().toISOString();
    }

    return {
      promoted: true,
      reused: true,
      evaluation,
      entity: cloneDiscoveredEntity(existingEntity),
      record: cloneDiscoveryRecord(
        discoveryRecords.get(discoveryKey),
      ),
    };
  }

  const entityId = createDiscoveredEntityId();
  const timestamp = new Date().toISOString();

  const entity = {
    ...evaluation.proposedEntity,
    nodeId: entityId,
    entityId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const discoveryRecord = {
    discoveryRecordId: createDiscoveryRecordId(),
    discoveryKey,
    status: "promoted",
    confidence: evaluation.confidence,
    objectNode: cloneObjectNode(objectNode),
    entity: cloneDiscoveredEntity(entity),
    signals: evaluation.signals,
    rejectionReasons: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  discoveredEntityRegistry.set(discoveryKey, entity);
  discoveryRecords.set(discoveryKey, discoveryRecord);

  return {
    promoted: true,
    reused: false,
    evaluation,
    entity: cloneDiscoveredEntity(entity),
    record: cloneDiscoveryRecord(discoveryRecord),
  };
}

/**
 * Discover and promote eligible objects from the current graph.
 */
export function discoverEntitiesFromGraph(options = {}) {
  if (options.reset === true) {
    resetEntityDiscovery();
  }

  const snapshot = options.snapshot ?? getKnowledgeGraphSnapshot();
  const objectNodes =
    options.objectNodes ??
    extractObjectNodes(snapshot);

  const relationshipEdges =
    options.relationshipEdges ??
    extractRelationshipEdges(snapshot);

  const promoted = [];
  const rejected = [];

  for (const objectNode of objectNodes) {
    const result = promoteObjectToEntity(objectNode, {
      ...options,
      snapshot,
      relationshipEdges,
    });

    if (result.promoted) {
      promoted.push(result);
    } else {
      rejected.push(result);
    }
  }

  return {
    promoted,
    rejected,
    promotedCount: promoted.length,
    rejectedCount: rejected.length,
    objectNodeCount: objectNodes.length,
    discoveredEntityCount: discoveredEntityRegistry.size,
    discoveryRecordCount: discoveryRecords.size,
  };
}

/**
 * Retrieve one discovered entity by canonical key, name, or object value.
 */
export function getDiscoveredEntity(value) {
  const discoveryKey = normalizeText(value);

  if (!discoveryKey) {
    return null;
  }

  return cloneDiscoveredEntity(
    discoveredEntityRegistry.get(discoveryKey),
  );
}

/**
 * Return every promoted entity.
 */
export function getAllDiscoveredEntities() {
  return Array.from(discoveredEntityRegistry.values())
    .map(cloneDiscoveredEntity)
    .filter(Boolean);
}

/**
 * Return every discovery decision, including rejected objects.
 */
export function getAllEntityDiscoveryRecords() {
  return Array.from(discoveryRecords.values())
    .map(cloneDiscoveryRecord)
    .filter(Boolean);
}

/**
 * Build an entity collection suitable for passing into
 * buildEntityLinkIndex() from objectEntityLinker.js.
 */
export function mergeExistingAndDiscoveredEntities(
  existingEntities = [],
) {
  const combined = [
    ...toArray(existingEntities),
    ...getAllDiscoveredEntities(),
  ];

  const merged = new Map();

  for (const entity of combined) {
    if (!entity || typeof entity !== "object") {
      continue;
    }

    const key = normalizeText(
      entity.canonicalKey ??
      entity.canonicalName ??
      entity.entityId ??
      entity.nodeId,
    );

    if (!key) {
      continue;
    }

    if (!merged.has(key)) {
      merged.set(key, cloneDiscoveredEntity(entity) ?? {
        ...entity,
      });

      continue;
    }

    const existing = merged.get(key);

    existing.aliases = uniqueStrings([
      ...(Array.isArray(existing.aliases) ? existing.aliases : []),
      ...(Array.isArray(entity.aliases) ? entity.aliases : []),
    ]);

    existing.candidateIds = uniqueStrings([
      ...(Array.isArray(existing.candidateIds)
        ? existing.candidateIds
        : []),
      ...(Array.isArray(entity.candidateIds)
        ? entity.candidateIds
        : []),
    ]);

    existing.occurrenceCount =
      Number(existing.occurrenceCount ?? 0) +
      Number(entity.occurrenceCount ?? 0);
  }

  return Array.from(merged.values());
}

/**
 * Return a serializable snapshot.
 */
export function getEntityDiscoverySnapshot() {
  return {
    discoveredEntities: getAllDiscoveredEntities(),
    discoveryRecords: getAllEntityDiscoveryRecords(),
    discoveredEntityCount: discoveredEntityRegistry.size,
    discoveryRecordCount: discoveryRecords.size,
  };
}

/**
 * Return summary statistics.
 */
export function getEntityDiscoverySummary() {
  const records = getAllEntityDiscoveryRecords();
  const promotedRecords = records.filter(
    (record) => record.status === "promoted",
  );
  const rejectedRecords = records.filter(
    (record) => record.status === "rejected",
  );

  const averageConfidence =
    records.length > 0
      ? records.reduce(
          (total, record) =>
            total + Number(record.confidence ?? 0),
          0,
        ) / records.length
      : 0;

  const entityTypeCounts = getAllDiscoveredEntities().reduce(
    (summary, entity) => {
      const entityType = entity.entityType ?? "concept";

      summary[entityType] =
        Number(summary[entityType] ?? 0) + 1;

      return summary;
    },
    {},
  );

  return {
    discoveredEntityCount: discoveredEntityRegistry.size,
    promotedRecordCount: promotedRecords.length,
    rejectedRecordCount: rejectedRecords.length,
    totalRecordCount: records.length,
    averageConfidence: round(averageConfidence),
    entityTypeCounts,
  };
}

/**
 * Reset all in-memory discovery state.
 */
export function resetEntityDiscovery() {
  discoveredEntityRegistry.clear();
  discoveryRecords.clear();

  discoveredEntityCounter = 0;
  discoveryRecordCounter = 0;

  return {
    reset: true,
    discoveredEntityCount: 0,
    discoveryRecordCount: 0,
  };
}

export {
  DEFAULT_OPTIONS,
  ACTION_PREFIXES,
  NON_ENTITY_STRUCTURED_TYPES,
  BLOCKED_GENERIC_VALUES,
  normalizeText,
  normalizeIdentifier,
  extractObjectNodes,
  extractRelationshipEdges,
  getObjectNodeId,
  getObjectValue,
  getObjectAliases,
  getObjectProvenance,
  inferEntityType,
  inferCanonicalName,
  calculateDiscoverySignals,
  cloneDiscoveredEntity,
  cloneDiscoveryRecord,
};