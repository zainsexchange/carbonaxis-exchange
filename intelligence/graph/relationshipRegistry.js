/**
 * In-memory relationship registry.
 *
 * Responsibilities:
 * - Assign stable sequential relationship IDs.
 * - Deduplicate identical graph edges.
 * - Track provenance and occurrence counts.
 * - Preserve structured values and confidence metadata.
 */

const registryByKey = new Map();
const registryById = new Map();

let relationshipSequence = 0;

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function createNormalizedKeyPart(value) {
  return normalizeText(value)
    .replace(/[.:;,!?]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * @param {number} sequence
 * @returns {string}
 */
function formatRelationshipId(sequence) {
  return `RELATIONSHIP_${String(sequence).padStart(6, "0")}`;
}

/**
 * Creates a deterministic relationship lookup key.
 *
 * Same subject + predicate + object maps to the same edge.
 *
 * @param {{
 *   subjectEntityId?: string,
 *   predicate?: string,
 *   object?: string
 * }} proposition
 *
 * @returns {string}
 */
function createRelationshipKey(
  proposition = {},
) {
  const subjectEntityId =
    createNormalizedKeyPart(
      proposition.subjectEntityId,
    );

  const predicate =
    createNormalizedKeyPart(
      proposition.canonicalPredicate ||
      proposition.predicate,
    );

  const objectEntityId =
    createNormalizedKeyPart(
      proposition.objectEntityId,
    );

  const object =
    createNormalizedKeyPart(
      proposition.object,
    );

  const objectReference =
    objectEntityId || object;

  if (
    !subjectEntityId ||
    !predicate ||
    !objectReference
  ) {
    throw new TypeError(
      "Relationship key requires subjectEntityId, predicate, and object or objectEntityId.",
    );
  }

  const objectType =
    objectEntityId
      ? "entity"
      : "literal";

  return [
    subjectEntityId,
    predicate,
    objectType,
    objectReference,
  ].join("::");
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeNullableText(value) {
  const normalized = normalizeText(value);

  return normalized || null;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeConfidence(value) {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    return null;
  }

  return Math.max(
    0,
    Math.min(1, confidence),
  );
}

/**
 * @param {unknown} value
 * @returns {object|null}
 */
function cloneStructuredValue(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(normalizeNullableText)
        .filter(Boolean),
    ),
  ];
}

/**
 * @param {object} proposition
 * @returns {object}
 */
function createProvenanceRecord(proposition = {}) {
  return {
    sourceDocumentId:
      normalizeNullableText(
        proposition.sourceDocumentId ||
          proposition.documentId,
      ),

    sourceChunkId:
      normalizeNullableText(
        proposition.sourceChunkId ||
          proposition.chunkId,
      ),

    sourceLine:
      Number.isFinite(
        Number(proposition.sourceLine),
      )
        ? Number(proposition.sourceLine)
        : null,

    contextPath:
      normalizeStringArray(
        proposition.contextPath,
      ),

    originalBlockText:
      normalizeNullableText(
        proposition.originalBlockText,
      ),

    contextualSentence:
      normalizeNullableText(
        proposition.contextualSentence,
      ),

    clause:
      normalizeNullableText(
        proposition.clause,
      ),

    confidence:
      normalizeConfidence(
        proposition.confidence,
      ),
  };
}

/**
 * @param {object} provenance
 * @returns {string}
 */
function createProvenanceKey(provenance = {}) {
  return JSON.stringify({
    sourceDocumentId:
      provenance.sourceDocumentId,

    sourceChunkId:
      provenance.sourceChunkId,

    sourceLine:
      provenance.sourceLine,

    originalBlockText:
      provenance.originalBlockText,
  });
}

/**
 * @param {object[]} current
 * @param {object} incoming
 * @returns {object[]}
 */
function mergeProvenance(
  current = [],
  incoming = {},
) {
  const recordsByKey = new Map();

  for (const record of [
    ...current,
    incoming,
  ]) {
    const key =
      createProvenanceKey(record);

    if (!recordsByKey.has(key)) {
      recordsByKey.set(key, {
        ...record,
        contextPath: [
          ...(record.contextPath || []),
        ],
      });
    }
  }

  return [...recordsByKey.values()];
}

/**
 * Registers or updates a relationship.
 *
 * @param {{
 *   subjectEntityId?: string,
 *   subject?: string,
 *   canonicalSubject?: string,
 *   predicate?: string,
 *   object?: string,
 *   structuredValue?: object|null,
 *   confidence?: number,
 *   sourceDocumentId?: string,
 *   documentId?: string,
 *   sourceChunkId?: string,
 *   chunkId?: string,
 *   sourceLine?: number,
 *   contextPath?: string[],
 *   originalBlockText?: string,
 *   contextualSentence?: string,
 *   clause?: string
 * }} proposition
 *
 * @returns {{
 *   relationshipId: string,
 *   created: boolean,
 *   relationship: object
 * }}
 */
function registerRelationship(proposition = {}) {
  const subjectEntityId =
    normalizeNullableText(
      proposition.subjectEntityId,
    );

  const predicate =
    normalizeNullableText(
      proposition.predicate,
    );

  const object =
    normalizeNullableText(
      proposition.object,
    );

  const objectEntityId =
    normalizeNullableText(
      proposition.objectEntityId,
    );

  if (!subjectEntityId) {
    throw new TypeError(
      "registerRelationship requires subjectEntityId.",
    );
  }

  if (!predicate) {
    throw new TypeError(
      "registerRelationship requires predicate.",
    );
  }

  if (
    !object &&
    !objectEntityId
  ) {
    throw new TypeError(
      "registerRelationship requires object or objectEntityId.",
    );
  }

  const relationshipKey =
    createRelationshipKey({
      subjectEntityId,
      predicate,
      canonicalPredicate:
        proposition.canonicalPredicate,
      object,
      objectEntityId,
    });

  const provenance =
    createProvenanceRecord(proposition);

  const existingRelationship =
    registryByKey.get(relationshipKey);

  if (existingRelationship) {
    existingRelationship.occurrenceCount += 1;
    existingRelationship.updatedAt =
      new Date().toISOString();

    if (
      objectEntityId &&
      !existingRelationship.objectEntityId
    ) {
      existingRelationship.objectEntityId =
        objectEntityId;

      existingRelationship.objectType =
        "entity";
    }

    if (
      proposition.canonicalPredicate &&
      !existingRelationship.canonicalPredicate
    ) {
      existingRelationship.canonicalPredicate =
        proposition.canonicalPredicate;
    }

    existingRelationship.provenance =
      mergeProvenance(
        existingRelationship.provenance,
        provenance,
      );

    const incomingConfidence =
      normalizeConfidence(
        proposition.confidence,
      );

    if (incomingConfidence !== null) {
      existingRelationship.confidenceValues.push(
        incomingConfidence,
      );

      existingRelationship.maxConfidence =
        Math.max(
          ...existingRelationship.confidenceValues,
        );

      existingRelationship.averageConfidence =
        existingRelationship.confidenceValues.reduce(
          (sum, value) => sum + value,
          0,
        ) /
        existingRelationship.confidenceValues.length;
    }

    if (
      !existingRelationship.structuredValue &&
      proposition.structuredValue
    ) {
      existingRelationship.structuredValue =
        cloneStructuredValue(
          proposition.structuredValue,
        );
    }

    return {
      relationshipId:
        existingRelationship.relationshipId,

      created: false,

      relationship:
        cloneRelationship(
          existingRelationship,
        ),
    };
  }

  relationshipSequence += 1;

  const relationshipId =
    formatRelationshipId(
      relationshipSequence,
    );

  const now =
    new Date().toISOString();

  const confidence =
    normalizeConfidence(
      proposition.confidence,
    );

  const relationship = {
    relationshipId,

    relationshipKey,

    subjectEntityId,

    subject:
      normalizeNullableText(
        proposition.subject,
      ),

    canonicalSubject:
      normalizeNullableText(
        proposition.canonicalSubject,
      ),

    predicate,

    canonicalPredicate:
      normalizeNullableText(
        proposition.canonicalPredicate,
      ) ??
      predicate,

    object,

    objectEntityId,

    objectType:
      objectEntityId
        ? "entity"
        : "literal",

    structuredValue:
      cloneStructuredValue(
        proposition.structuredValue,
      ),

    confidenceValues:
      confidence !== null
        ? [confidence]
        : [],

    maxConfidence: confidence,

    averageConfidence: confidence,

    provenance: [provenance],

    occurrenceCount: 1,

    createdAt: now,

    updatedAt: now,
  };

  registryByKey.set(
    relationshipKey,
    relationship,
  );

  registryById.set(
    relationshipId,
    relationship,
  );

  return {
    relationshipId,
    created: true,
    relationship:
      cloneRelationship(
        relationship,
      ),
  };
}

/**
 * @param {string} relationshipId
 * @returns {object|null}
 */
function getRelationshipById(
  relationshipId,
) {
  const normalizedId =
    normalizeText(relationshipId);

  const relationship =
    registryById.get(normalizedId);

  return relationship
    ? cloneRelationship(relationship)
    : null;
}

/**
 * @returns {object[]}
 */
function listRelationships() {
  return [...registryById.values()]
    .sort((left, right) =>
      left.relationshipId.localeCompare(
        right.relationshipId,
      ),
    )
    .map(cloneRelationship);
}

/**
 * @returns {number}
 */
function getRelationshipRegistrySize() {
  return registryById.size;
}

/**
 * Resets the registry.
 *
 * Intended for testing and local development.
 */
function resetRelationshipRegistry() {
  registryByKey.clear();
  registryById.clear();
  relationshipSequence = 0;
}

/**
 * @param {object} relationship
 * @returns {object}
 */
function cloneRelationship(
  relationship,
) {
  return {
    ...relationship,

    structuredValue:
      cloneStructuredValue(
        relationship.structuredValue,
      ),

    confidenceValues: [
      ...relationship.confidenceValues,
    ],

    provenance:
      relationship.provenance.map(
        (record) => ({
          ...record,
          contextPath: [
            ...record.contextPath,
          ],
        }),
      ),
  };
}

export {
  createRelationshipKey,
  formatRelationshipId,
  getRelationshipById,
  getRelationshipRegistrySize,
  listRelationships,
  registerRelationship,
  resetRelationshipRegistry,
};