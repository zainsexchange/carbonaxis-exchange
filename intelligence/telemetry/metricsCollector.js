/**
 * Collects per-query telemetry for Carbon Brain.
 */

import { randomUUID } from "node:crypto";

/**
 * @param {object} [input]
 * @returns {object}
 */
export function createQueryMetrics(
  input = {},
) {
  return {
    queryId:
      input.queryId || randomUUID(),
    question: input.question || null,
    planner:
      input.planner ||
      input.strategy ||
      null,
    cacheHit: Boolean(input.cacheHit),
    retrievalMs:
      Number(input.retrievalMs) || 0,
    graphMs: Number(input.graphMs) || 0,
    inferenceMs:
      Number(input.inferenceMs) || 0,
    truthMs: Number(input.truthMs) || 0,
    totalMs: Number(input.totalMs) || 0,
    entitiesVisited:
      Number(input.entitiesVisited) || 0,
    relationshipsVisited:
      Number(input.relationshipsVisited) ||
      0,
    inferredFacts:
      Number(input.inferredFacts) || 0,
    contradictions:
      Number(input.contradictions) || 0,
    truthStatus:
      input.truthStatus || null,
    confidence:
      Number.isFinite(
        Number(input.confidence),
      )
        ? Number(input.confidence)
        : null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build metrics from a ReasoningContext / truth result.
 *
 * @param {object} context
 * @param {object} [result]
 * @returns {object}
 */
export function collectMetricsFromContext(
  context = {},
  result = {},
) {
  const metrics = context.metrics || {};
  const plan =
    context.executionPlan ||
    result.executionPlan ||
    {};

  return createQueryMetrics({
    question:
      context.question ||
      result.question,
    planner: plan.strategy,
    cacheHit: metrics.cacheHit,
    retrievalMs: metrics.retrievalTime,
    graphMs: metrics.graphTraversalTime,
    inferenceMs: metrics.inferenceTime,
    truthMs: metrics.truthTime,
    totalMs: metrics.totalExecutionTime,
    entitiesVisited:
      context.entities?.length || 0,
    relationshipsVisited:
      context.relationships?.length || 0,
    inferredFacts:
      context.inferredEvidence?.length ||
      result.inferredEvidence?.length ||
      0,
    contradictions:
      context.contradictions?.length ||
      result.contradictions?.length ||
      0,
    truthStatus:
      result.truthStatus ||
      context.truthStatus,
    confidence:
      result.confidence ??
      context.confidence
        ?.overallConfidence,
  });
}

const recentMetrics = [];
const MAX_RECENT = 200;

/**
 * @param {object} metrics
 */
export function recordQueryMetrics(
  metrics,
) {
  recentMetrics.unshift(metrics);

  if (recentMetrics.length > MAX_RECENT) {
    recentMetrics.length = MAX_RECENT;
  }

  return metrics;
}

export function getRecentQueryMetrics(
  limit = 20,
) {
  return recentMetrics.slice(0, limit);
}

export function clearQueryMetrics() {
  recentMetrics.length = 0;
}
