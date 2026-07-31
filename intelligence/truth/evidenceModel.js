/**
 * Common evidence model for Carbon Brain reasoning.
 *
 * Every source — document, graph, inference, ontology —
 * normalizes into one universal shape so the Truth Engine
 * never branches on origin type.
 */

import {
  EVIDENCE_SOURCE,
  EVIDENCE_POLARITY,
  NEGATED_PREDICATE_MAP,
  SOURCE_WEIGHTS,
} from "./truthConstants.js";

let evidenceSequence = 0;

function nextEvidenceId(sourceType) {
  evidenceSequence += 1;

  return `ev_${String(sourceType || "UNK")
    .toLowerCase()}_${evidenceSequence}`;
}

function clampConfidence(value, fallback = 0.5) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numeric));
}

function normalizeText(value) {
  const text = String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || null;
}

function normalizePredicate(value) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  return text
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function resolvePolarity(item = {}, predicate) {
  const explicit = String(
    item.polarity ||
      item.metadata?.polarity ||
      "",
  )
    .trim()
    .toUpperCase();

  if (
    explicit === EVIDENCE_POLARITY.NEGATES ||
    explicit === EVIDENCE_POLARITY.AFFIRMS
  ) {
    return explicit;
  }

  if (
    item.negated === true ||
    item.metadata?.negated === true
  ) {
    return EVIDENCE_POLARITY.NEGATES;
  }

  if (
    predicate &&
    NEGATED_PREDICATE_MAP[predicate]
  ) {
    return EVIDENCE_POLARITY.NEGATES;
  }

  return EVIDENCE_POLARITY.AFFIRMS;
}

function resolveCanonicalPredicate(predicate) {
  if (!predicate) {
    return null;
  }

  return (
    NEGATED_PREDICATE_MAP[predicate] ||
    predicate
  );
}

function resolveConfidence(item = {}, fallback = 0.5) {
  return clampConfidence(
    item.confidence ??
      item.weightedConfidence ??
      item.evidenceScore ??
      item.semanticScore ??
      item.score,
    fallback,
  );
}

function buildProvenance(item = {}, extras = {}) {
  const base =
    item.provenance &&
    typeof item.provenance === "object"
      ? { ...item.provenance }
      : {};

  return {
    documentId:
      normalizeText(
        base.documentId ?? item.documentId,
      ),
    chunkId:
      normalizeText(
        base.chunkId ?? item.chunkId,
      ),
    relationshipId:
      normalizeText(
        base.relationshipId ??
          item.relationshipId,
      ),
    inferenceRule:
      normalizeText(
        base.inferenceRule ??
          item.inferenceRule,
      ),
    sourceClass:
      normalizeText(
        base.sourceClass ??
          item.document?.sourceClass ??
          item.sourceClass,
      ),
    ...extras,
  };
}

function buildExplanation(item = {}, sourceType) {
  const provided = normalizeText(item.explanation);

  if (provided) {
    return provided;
  }

  const subject =
    normalizeText(
      item.subject ||
        item.subjectName ||
        item.subjectEntityId,
    );

  const object =
    normalizeText(
      item.object ||
        item.objectName ||
        item.objectEntityId,
    );

  const predicate =
    normalizePredicate(
      item.predicate ||
        item.canonicalPredicate,
    );

  const text = normalizeText(
    item.text ||
      item.content ||
      item.chunkText,
  );

  const triple =
    subject && predicate && object
      ? `${subject} ${predicate} ${object}`
      : null;

  if (sourceType === EVIDENCE_SOURCE.DOCUMENT) {
    if (text) {
      return `Document states: ${text.slice(0, 180)}`;
    }

    return triple
      ? `Document supports ${triple}.`
      : "Document evidence supports the claim.";
  }

  if (sourceType === EVIDENCE_SOURCE.GRAPH) {
    return triple
      ? `Knowledge Graph links ${triple}.`
      : "Knowledge Graph supports the claim.";
  }

  if (sourceType === EVIDENCE_SOURCE.INFERENCE) {
    const rule = normalizeText(
      item.inferenceRule ||
        item.provenance?.inferenceRule,
    );

    return triple
      ? `Inference derives ${triple}${
          rule ? ` (${rule})` : ""
        }.`
      : "Inference supports the claim.";
  }

  if (sourceType === EVIDENCE_SOURCE.ONTOLOGY) {
    return triple
      ? `Ontology places ${triple}.`
      : "Ontology supports the claim.";
  }

  return "Evidence supports the claim.";
}

/**
 * Build one universal evidence record.
 *
 * @param {object} item
 * @param {string} sourceType
 * @returns {object}
 */
function createEvidenceRecord(
  item = {},
  sourceType = EVIDENCE_SOURCE.DOCUMENT,
) {
  const resolvedSourceType =
    EVIDENCE_SOURCE[
      String(
        item.sourceType ||
          item.source ||
          sourceType,
      )
        .trim()
        .toUpperCase()
    ] || sourceType;

  const rawPredicate = normalizePredicate(
    item.predicate ||
      item.canonicalPredicate,
  );

  const polarity = resolvePolarity(
    item,
    rawPredicate,
  );

  const predicate =
    resolveCanonicalPredicate(
      rawPredicate,
    ) || rawPredicate;

  const defaults = {
    [EVIDENCE_SOURCE.DOCUMENT]: 0.5,
    [EVIDENCE_SOURCE.GRAPH]: 1.0,
    [EVIDENCE_SOURCE.INFERENCE]: 0.98,
    [EVIDENCE_SOURCE.ONTOLOGY]: 0.96,
  };

  const inferred =
    resolvedSourceType ===
      EVIDENCE_SOURCE.INFERENCE ||
    item.inferred === true;

  const ontology =
    resolvedSourceType ===
      EVIDENCE_SOURCE.ONTOLOGY ||
    item.ontology === true;

  const provenance = buildProvenance(item);

  const metadata = {
    ...(item.metadata &&
    typeof item.metadata === "object"
      ? item.metadata
      : {}),
    polarity,
    canonicalPredicate: predicate,
    rawPredicate,
    subjectName:
      normalizeText(
        item.subject ||
          item.subjectName,
      ),
    objectName:
      normalizeText(
        item.object ||
          item.objectName,
      ),
    text:
      normalizeText(
        item.text ||
          item.content ||
          item.chunkText,
      ),
  };

  if (item.inferenceRule) {
    metadata.inferenceRule =
      normalizeText(item.inferenceRule);
  }

  return {
    evidenceId:
      normalizeText(
        item.evidenceId || item.id,
      ) ||
      nextEvidenceId(resolvedSourceType),

    sourceType: resolvedSourceType,

    subjectEntityId:
      normalizeText(item.subjectEntityId),

    objectEntityId:
      normalizeText(item.objectEntityId),

    predicate,

    confidence: resolveConfidence(
      item,
      defaults[resolvedSourceType] ?? 0.5,
    ),

    provenance,

    inferred,

    ontology,

    explanation: buildExplanation(
      item,
      resolvedSourceType,
    ),

    metadata,
  };
}

/**
 * @param {object} item
 * @returns {object}
 */
export function createDocumentEvidence(
  item = {},
) {
  return createEvidenceRecord(
    item,
    EVIDENCE_SOURCE.DOCUMENT,
  );
}

/**
 * @param {object} item
 * @returns {object}
 */
export function createGraphEvidence(
  item = {},
) {
  return createEvidenceRecord(
    {
      confidence: item.confidence ?? 1.0,
      ...item,
    },
    EVIDENCE_SOURCE.GRAPH,
  );
}

/**
 * @param {object} item
 * @returns {object}
 */
export function createInferenceEvidence(
  item = {},
) {
  return createEvidenceRecord(
    {
      confidence: item.confidence ?? 0.98,
      inferred: true,
      ...item,
    },
    EVIDENCE_SOURCE.INFERENCE,
  );
}

/**
 * @param {object} item
 * @returns {object}
 */
export function createOntologyEvidence(
  item = {},
) {
  return createEvidenceRecord(
    {
      confidence: item.confidence ?? 0.96,
      ontology: true,
      ...item,
    },
    EVIDENCE_SOURCE.ONTOLOGY,
  );
}

function routeEvidenceItem(item = {}) {
  if (
    item &&
    typeof item === "object" &&
    item.evidenceId &&
    item.sourceType &&
    Object.prototype.hasOwnProperty.call(
      item,
      "inferred",
    ) &&
    Object.prototype.hasOwnProperty.call(
      item,
      "ontology",
    )
  ) {
    return item;
  }

  const sourceType = String(
    item?.sourceType ||
      item?.source ||
      "",
  )
    .trim()
    .toUpperCase();

  if (sourceType === EVIDENCE_SOURCE.GRAPH) {
    return createGraphEvidence(item);
  }

  if (
    sourceType === EVIDENCE_SOURCE.INFERENCE ||
    item?.inferred === true
  ) {
    return createInferenceEvidence(item);
  }

  if (
    sourceType === EVIDENCE_SOURCE.ONTOLOGY ||
    item?.ontology === true
  ) {
    return createOntologyEvidence(item);
  }

  return createDocumentEvidence(
    item && typeof item === "object"
      ? item
      : { text: item },
  );
}

/**
 * Normalize any evidence input into the universal model.
 *
 * Accepts:
 * - an array of mixed evidence items
 * - a queryContext object with stream arrays
 * - already-normalized evidence records
 *
 * @param {object|object[]} input
 * @returns {object[]}
 */
export function normalizeEvidence(input = []) {
  if (Array.isArray(input)) {
    return input.map(routeEvidenceItem);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  /*
   * Already a flat evidence bag.
   */
  /*
   * Only reuse a pre-built evidence bag when it
   * actually contains records. An empty array on
   * ReasoningContext must not hide stream fields.
   */
  if (
    Array.isArray(input.evidence) &&
    input.evidence.length > 0
  ) {
    return input.evidence.map(
      routeEvidenceItem,
    );
  }

  const streams = [
    ...(Array.isArray(input.retrievedChunks)
      ? input.retrievedChunks.map((item) =>
          createDocumentEvidence(item),
        )
      : []),

    ...(Array.isArray(input.documentEvidence)
      ? input.documentEvidence.map((item) =>
          createDocumentEvidence(item),
        )
      : []),

    ...(Array.isArray(input.graphEvidence)
      ? input.graphEvidence.map((item) =>
          createGraphEvidence(item),
        )
      : []),

    ...(Array.isArray(
      input.inferredRelationships,
    )
      ? input.inferredRelationships.map(
          (item) =>
            createInferenceEvidence(item),
        )
      : []),

    ...(Array.isArray(input.inferredEvidence)
      ? input.inferredEvidence.map((item) =>
          createInferenceEvidence(item),
        )
      : []),

    ...(Array.isArray(input.ontologyEvidence)
      ? input.ontologyEvidence.map((item) =>
          createOntologyEvidence(item),
        )
      : []),
  ];

  return streams;
}

/**
 * Reset evidence id counter (tests only).
 */
export function resetEvidenceSequence() {
  evidenceSequence = 0;
}

export {
  EVIDENCE_SOURCE,
  SOURCE_WEIGHTS,
};
