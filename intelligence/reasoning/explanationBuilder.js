/**
 * Deterministic explanation builder.
 * Converts evidence + contradictions + confidence
 * into human-readable reasoning — no OpenAI.
 */

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

function formatTriple(record = {}) {
  const subject =
    record.metadata?.subjectName ||
    resolveEntityLabel(
      record.subjectEntityId,
    ) ||
    record.subjectEntityId ||
    "?";

  const object =
    record.metadata?.objectName ||
    resolveEntityLabel(
      record.objectEntityId,
    ) ||
    record.objectEntityId ||
    "?";

  const predicate =
    record.predicate || "RELATED_TO";

  return `${subject} → ${predicate} → ${object}`;
}

/**
 * @param {{
 *   evidence?: object[],
 *   contradictions?: object[],
 *   confidence?: object,
 * }} input
 * @returns {{
 *   summary: string,
 *   explanation: string[],
 *   reasoningPath: string[],
 * }}
 */
export function buildExplanation({
  evidence = [],
  contradictions = [],
  confidence = {},
} = {}) {
  const items = Array.isArray(evidence)
    ? evidence
    : [];

  const conflicts = Array.isArray(
    contradictions,
  )
    ? contradictions
    : [];

  const explanation = [];
  const reasoningPath = [];

  if (items.length === 0) {
    return {
      summary:
        "Insufficient evidence to support a confident statement.",
      explanation: [
        "Insufficient evidence to support a confident statement.",
      ],
      reasoningPath: [],
    };
  }

  for (const record of items.slice(0, 8)) {
    const line =
      record.explanation ||
      `${record.sourceType} evidence (${record.confidence}).`;

    explanation.push(line);
    reasoningPath.push(formatTriple(record));
  }

  for (const conflict of conflicts) {
    const subject =
      resolveEntityLabel(
        conflict.subjectEntityId,
      ) ||
      conflict.subjectEntityId ||
      "?";

    const object =
      resolveEntityLabel(
        conflict.objectEntityId,
      ) ||
      conflict.objectEntityId ||
      "multiple objects";

    explanation.push(
      `Conflict: ${subject} ${conflict.predicate} ${object} has contradictory evidence.`,
    );

    reasoningPath.push(
      `CONFLICT ${subject} → ${conflict.predicate} → ${object}`,
    );
  }

  const overall =
    Number(confidence.overallConfidence);

  let summary;

  if (conflicts.length > 0) {
    summary =
      "Contradictory evidence prevents a single confident conclusion.";
  } else if (
    Number.isFinite(overall) &&
    overall >= 0.75
  ) {
    summary =
      "Evidence consistently supports the claim.";
  } else if (
    Number.isFinite(overall) &&
    overall >= 0.45
  ) {
    summary =
      "Evidence partially supports the claim.";
  } else {
    summary =
      "Available evidence is weak or incomplete.";
  }

  if (
    Number.isFinite(overall)
  ) {
    summary += ` Overall confidence ${overall.toFixed(2)}.`;
  }

  return {
    summary,
    explanation,
    reasoningPath,
  };
}

export default buildExplanation;
