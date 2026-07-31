/**
 * Weighted confidence aggregation.
 * Input: evidence + contradictions.
 * Output: overall + per-source confidences only.
 */

import {
  EVIDENCE_SOURCE,
  SOURCE_WEIGHTS,
} from "../truth/truthConstants.js";

const CONFLICT_CONFIDENCE_FACTOR = 0.45;

function averageConfidence(
  items = [],
) {
  if (!items.length) {
    return null;
  }

  const total = items.reduce(
    (sum, item) =>
      sum + Number(item.confidence || 0),
    0,
  );

  return Number(
    (total / items.length).toFixed(4),
  );
}

/**
 * @param {{
 *   evidence?: object[],
 *   contradictions?: object[],
 * }} input
 * @returns {object}
 */
export function calculateConfidence({
  evidence = [],
  contradictions = [],
} = {}) {
  const items = Array.isArray(evidence)
    ? evidence
    : [];

  const bySource = {
    [EVIDENCE_SOURCE.DOCUMENT]: [],
    [EVIDENCE_SOURCE.GRAPH]: [],
    [EVIDENCE_SOURCE.INFERENCE]: [],
    [EVIDENCE_SOURCE.ONTOLOGY]: [],
  };

  for (const record of items) {
    const sourceType =
      record.sourceType ||
      EVIDENCE_SOURCE.DOCUMENT;

    if (bySource[sourceType]) {
      bySource[sourceType].push(record);
    }
  }

  let weightedScore = 0;
  let totalWeight = 0;

  for (const record of items) {
    const sourceType =
      record.sourceType ||
      EVIDENCE_SOURCE.DOCUMENT;

    const sourceWeight =
      SOURCE_WEIGHTS[sourceType] ?? 0.5;

    const confidence = Number(
      record.confidence,
    );

    const safe =
      Number.isFinite(confidence)
        ? Math.max(0, Math.min(1, confidence))
        : 0;

    weightedScore += safe * sourceWeight;
    totalWeight += sourceWeight;
  }

  let overallConfidence =
    totalWeight > 0
      ? weightedScore / totalWeight
      : 0;

  if (
    Array.isArray(contradictions) &&
    contradictions.length > 0
  ) {
    overallConfidence *=
      CONFLICT_CONFIDENCE_FACTOR;
  }

  return {
    overallConfidence: Number(
      overallConfidence.toFixed(4),
    ),
    documentConfidence: averageConfidence(
      bySource[EVIDENCE_SOURCE.DOCUMENT],
    ),
    graphConfidence: averageConfidence(
      bySource[EVIDENCE_SOURCE.GRAPH],
    ),
    inferenceConfidence: averageConfidence(
      bySource[EVIDENCE_SOURCE.INFERENCE],
    ),
    ontologyConfidence: averageConfidence(
      bySource[EVIDENCE_SOURCE.ONTOLOGY],
    ),
  };
}

export default calculateConfidence;
