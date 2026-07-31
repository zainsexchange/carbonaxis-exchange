/**
 * Collect and normalize injected evidence streams.
 * Merge → normalize → dedupe → sort by confidence.
 * Never retrieves. Never scores.
 */

import {
  EVIDENCE_SOURCE,
  EVIDENCE_POLARITY,
} from "../truth/truthConstants.js";

import {
  normalizeEvidence,
} from "../truth/evidenceModel.js";

import {
  getEntityById,
} from "../graph/entityRegistry.js";

function resolveEntityLabel(entityId) {
  if (!entityId) {
    return null;
  }

  try {
    const entity = getEntityById(entityId);
    return entity?.canonicalName || entityId;
  } catch {
    return entityId;
  }
}

function enrichExplanation(record) {
  const subject =
    record.metadata?.subjectName ||
    resolveEntityLabel(
      record.subjectEntityId,
    );

  const object =
    record.metadata?.objectName ||
    resolveEntityLabel(
      record.objectEntityId,
    );

  const predicate =
    record.predicate || "RELATED_TO";

  if (
    record.sourceType ===
      EVIDENCE_SOURCE.DOCUMENT &&
    record.explanation?.startsWith(
      "Document states:",
    )
  ) {
    return record.explanation;
  }

  if (subject && object) {
    if (
      record.sourceType ===
      EVIDENCE_SOURCE.DOCUMENT
    ) {
      if (
        record.metadata?.polarity ===
        EVIDENCE_POLARITY.NEGATES
      ) {
        return `Document states ${subject} does not ${predicate
          .replace(/_/g, " ")
          .toLowerCase()} ${object}.`;
      }

      return `Document states ${subject} ${predicate} ${object}.`;
    }

    if (
      record.sourceType ===
      EVIDENCE_SOURCE.GRAPH
    ) {
      return `Knowledge Graph links ${subject} to ${object} via ${predicate}.`;
    }

    if (
      record.sourceType ===
      EVIDENCE_SOURCE.INFERENCE
    ) {
      const rule =
        record.provenance?.inferenceRule ||
        record.metadata?.inferenceRule;

      return `Inference derives ${subject} ${predicate} ${object}${
        rule ? ` (${rule})` : ""
      }.`;
    }

    if (
      record.sourceType ===
      EVIDENCE_SOURCE.ONTOLOGY
    ) {
      return `Ontology places ${subject} under ${object} via ${predicate}.`;
    }
  }

  return record.explanation;
}

function buildDedupKey(record = {}) {
  return [
    record.sourceType || "",
    record.subjectEntityId || "",
    record.predicate || "",
    record.objectEntityId || "",
    record.metadata?.polarity ||
      EVIDENCE_POLARITY.AFFIRMS,
    record.provenance?.documentId || "",
    record.provenance?.relationshipId || "",
    record.provenance?.inferenceRule || "",
  ]
    .join("::")
    .toLowerCase();
}

/**
 * @param {object} context
 * @returns {object[]}
 */
export function collectEvidence(context = {}) {
  const normalized = normalizeEvidence(context)
    .map((record) => ({
      ...record,
      explanation:
        enrichExplanation(record),
    }));

  const seen = new Set();
  const unique = [];

  for (const record of normalized) {
    const key = buildDedupKey(record);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(record);
  }

  return unique.sort(
    (left, right) =>
      Number(right.confidence || 0) -
      Number(left.confidence || 0),
  );
}

export default collectEvidence;
