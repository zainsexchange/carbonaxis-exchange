/**
 * Truth Engine — thin orchestrator over the
 * reasoning pipeline. No retrieval. No OpenAI.
 */

import {
  TRUTH_STATUS,
  EVIDENCE_SOURCE,
} from "./truthConstants.js";

import {
  runReasoningPipeline,
} from "../reasoning/reasoningPipeline.js";

import {
  collectEvidence,
} from "../reasoning/evidenceCollector.js";

import {
  detectContradictions,
} from "../reasoning/contradictionDetector.js";

import {
  calculateConfidence,
} from "../reasoning/confidenceEngine.js";

import {
  collectMetricsFromContext,
  recordQueryMetrics,
} from "../telemetry/metricsCollector.js";

import {
  recordPlannerPlan,
} from "../telemetry/plannerStatistics.js";

const STATUS_THRESHOLDS = Object.freeze({
  supported: 0.75,
  partial: 0.45,
});

function buildRecommendations({
  truthStatus,
  contradictions = [],
}) {
  if (
    truthStatus ===
    TRUTH_STATUS.CONFLICTING
  ) {
    return [
      "Human review required.",
      `${contradictions.length} contradiction${
        contradictions.length === 1
          ? ""
          : "s"
      } detected across evidence sources.`,
    ];
  }

  if (
    truthStatus ===
    TRUTH_STATUS.INSUFFICIENT_EVIDENCE
  ) {
    return [
      "Gather additional documentary or graph evidence before asserting this claim.",
    ];
  }

  if (
    truthStatus ===
    TRUTH_STATUS.PARTIALLY_SUPPORTED
  ) {
    return [
      "Treat as provisional; seek corroborating sources.",
    ];
  }

  return [
    "Evidence is consistent enough for a supported statement.",
  ];
}

/**
 * Map reasoning pipeline output → truth result.
 *
 * @param {object} reasoning
 * @returns {object}
 */
export function buildTruthResult(
  reasoning = {},
) {
  const evidence = Array.isArray(
    reasoning.evidence,
  )
    ? reasoning.evidence
    : [];

  const contradictions = Array.isArray(
    reasoning.contradictions,
  )
    ? reasoning.contradictions
    : [];

  const confidence =
    reasoning.confidence || {};

  const explanationPacket =
    reasoning.explanation || {};

  const conflictingEvidence = [];
  const conflictingIds = new Set();

  for (const contradiction of contradictions) {
    for (const record of (
      contradiction.conflictingEvidence ||
      []
    )) {
      if (
        record?.evidenceId &&
        !conflictingIds.has(
          record.evidenceId,
        )
      ) {
        conflictingIds.add(
          record.evidenceId,
        );
        conflictingEvidence.push(record);
      }
    }
  }

  const supportingEvidence = evidence.filter(
    (record) =>
      !conflictingIds.has(
        record.evidenceId,
      ),
  );

  const inferredEvidence = evidence.filter(
    (record) =>
      record.inferred === true ||
      record.sourceType ===
        EVIDENCE_SOURCE.INFERENCE,
  );

  const ontologyEvidence = evidence.filter(
    (record) =>
      record.ontology === true ||
      record.sourceType ===
        EVIDENCE_SOURCE.ONTOLOGY,
  );

  const overall = Number(
    confidence.overallConfidence,
  );

  const safeConfidence =
    Number.isFinite(overall) ? overall : 0;

  let truthStatus =
    TRUTH_STATUS.INSUFFICIENT_EVIDENCE;

  if (evidence.length === 0) {
    truthStatus =
      TRUTH_STATUS.INSUFFICIENT_EVIDENCE;
  } else if (contradictions.length > 0) {
    truthStatus =
      TRUTH_STATUS.CONFLICTING;
  } else if (
    safeConfidence >=
    STATUS_THRESHOLDS.supported
  ) {
    truthStatus = TRUTH_STATUS.SUPPORTED;
  } else if (
    safeConfidence >=
    STATUS_THRESHOLDS.partial
  ) {
    truthStatus =
      TRUTH_STATUS.PARTIALLY_SUPPORTED;
  }

  const explanation = Array.isArray(
    explanationPacket.explanation,
  )
    ? explanationPacket.explanation
    : [];

  return {
    truthStatus,
    confidence: safeConfidence,
    supportingEvidence,
    conflictingEvidence,
    inferredEvidence,
    ontologyEvidence,
    explanation,
    explanationSummary:
      explanationPacket.summary || null,
    reasoningPath:
      explanationPacket.reasoningPath ||
      [],
    recommendations: buildRecommendations({
      truthStatus,
      contradictions,
    }),
    confidenceBreakdown: confidence,
    contradictions,
  };
}

/**
 * @param {object|import("../reasoning/reasoningContext.js").ReasoningContext} input
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function evaluateTruth(
  input = {},
  options = {},
) {
  const startedAt = Date.now();

  const reasoningContext =
    await runReasoningPipeline(
      input,
      options,
    );

  reasoningContext.beginStage(
    "Truth Evaluation",
  );

  const result =
    buildTruthResult(reasoningContext);

  reasoningContext.truthResult = result;
  reasoningContext.truthStatus =
    result.truthStatus;

  const truthEntry =
    reasoningContext.endStage(
      "Truth Evaluation",
      {
        truthStatus: result.truthStatus,
        confidence: result.confidence,
        supportingCount:
          result.supportingEvidence
            ?.length ?? 0,
        conflictingCount:
          result.conflictingEvidence
            ?.length ?? 0,
      },
    );

  reasoningContext.setMetric(
    "truthTime",
    truthEntry.duration,
  );
  reasoningContext.markTotal(startedAt);

  if (reasoningContext.executionPlan) {
    recordPlannerPlan(
      reasoningContext.executionPlan,
    );
  }

  const telemetry = recordQueryMetrics(
    collectMetricsFromContext(
      reasoningContext,
      result,
    ),
  );

  return {
    question:
      reasoningContext.question || null,
    ...result,
    executionPlan:
      reasoningContext.executionPlan
        ?.toJSON
        ? reasoningContext.executionPlan.toJSON()
        : reasoningContext.executionPlan,
    executionTrace:
      reasoningContext.executionTrace,
    metrics: {
      ...reasoningContext.metrics,
    },
    telemetry,
    context: reasoningContext,
  };
}

/*
 * Compatibility aliases — keep older call sites
 * working while the pipeline owns the logic.
 */
export function detectConflicts(evidence = []) {
  const contradictions =
    detectContradictions(evidence);

  return {
    hasConflicts: contradictions.length > 0,
    conflicts: contradictions,
    conflictingEvidenceIds: [
      ...new Set(
        contradictions.flatMap((item) =>
          [
            ...(item.supportingEvidence ||
              []),
            ...(item.conflictingEvidence ||
              []),
          ].map(
            (record) => record.evidenceId,
          ),
        ),
      ),
    ],
  };
}

export function scoreEvidence(
  evidence = [],
  conflictResult = null,
) {
  const contradictions =
    conflictResult?.conflicts ||
    detectContradictions(evidence);

  const confidence =
    calculateConfidence({
      evidence,
      contradictions,
    });

  return {
    confidence:
      confidence.overallConfidence,
    ...confidence,
    conflicts: contradictions,
  };
}

export {
  collectEvidence,
  detectContradictions,
  calculateConfidence,
  TRUTH_STATUS,
  EVIDENCE_SOURCE,
};
