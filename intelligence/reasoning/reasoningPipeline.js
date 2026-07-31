/**
 * Reasoning pipeline orchestrator.
 *
 * Plan → collect → contradict → confidence → explain
 * Modules run only according to the ExecutionPlan.
 */

import {
  ReasoningContext,
  createReasoningContext,
} from "./reasoningContext.js";

import {
  collectEvidence,
} from "./evidenceCollector.js";

import {
  detectContradictions,
} from "./contradictionDetector.js";

import {
  calculateConfidence,
} from "./confidenceEngine.js";

import {
  buildExplanation,
} from "./explanationBuilder.js";

import {
  planQuery,
} from "../planner/queryPlanner.js";

import {
  buildReasoningCacheKey,
  getReasoningCache,
  setReasoningCache,
} from "../cache/reasoningCache.js";

function restoreCachedContext(
  context,
  cached,
) {
  context.evidence = cached.evidence || [];
  context.conflicts = cached.conflicts || [];
  context.contradictions =
    cached.contradictions ||
    cached.conflicts ||
    [];
  context.confidence =
    cached.confidence || null;
  context.explanation =
    cached.explanation || null;

  if (cached.executionPlan) {
    context.executionPlan =
      cached.executionPlan;
  }

  context.executionTrace = [
    ...(cached.executionTrace || []),
    {
      stage: "Reasoning Cache",
      startedAt: Date.now(),
      finishedAt: Date.now(),
      duration: 0,
      cacheHit: true,
    },
  ];

  context.metrics = {
    ...context.metrics,
    ...(cached.metrics || {}),
    cacheHit: true,
    totalExecutionTime: 0,
  };

  return context;
}

/**
 * Drop evidence streams the planner disabled.
 *
 * @param {ReasoningContext} context
 * @returns {ReasoningContext}
 */
function applyPlanToEvidenceStreams(
  context,
) {
  const plan = context.executionPlan;

  if (!plan) {
    return context;
  }

  if (!plan.requiresSemanticSearch) {
    context.retrievedChunks = [];
    context.documentEvidence = [];
  }

  if (!plan.requiresGraphTraversal) {
    context.graphEvidence = [];
  }

  if (!plan.requiresInference) {
    context.inferredEvidence = [];
    context.inferredRelationships = [];
  }

  if (!plan.requiresOntologyExpansion) {
    context.ontologyEvidence = [];
  }

  return context;
}

/**
 * Run the full deterministic reasoning pipeline.
 *
 * @param {object|ReasoningContext} input
 * @param {object} [options]
 * @returns {Promise<ReasoningContext>}
 */
export async function runReasoningPipeline(
  input = {},
  options = {},
) {
  let context =
    createReasoningContext(input);

  if (!context.executionPlan) {
    context = planQuery(context);
  }

  const useCache = options.useCache !== false;
  const cacheKey = useCache
    ? buildReasoningCacheKey({
        ...context,
        strategy:
          context.executionPlan
            ?.strategy || null,
      })
    : null;

  if (useCache && cacheKey) {
    const cached =
      getReasoningCache(cacheKey);

    if (cached) {
      return restoreCachedContext(
        context,
        cached,
      );
    }
  }

  const pipelineStarted = Date.now();

  applyPlanToEvidenceStreams(context);

  context.beginStage("Evidence Collection");
  context.evidence =
    collectEvidence(context);
  context.endStage("Evidence Collection", {
    evidenceCount: context.evidence.length,
    documentCount:
      context.retrievedChunks.length +
      context.documentEvidence.length,
    graphCount:
      context.graphEvidence.length,
    inferredCount:
      context.inferredEvidence.length ||
      context.inferredRelationships.length,
    ontologyCount:
      context.ontologyEvidence.length,
    planStrategy:
      context.executionPlan?.strategy ||
      null,
  });

  if (
    context.executionPlan
      ?.requiresTruthEvaluation !== false
  ) {
    context.beginStage(
      "Contradiction Detection",
    );
    context.conflicts =
      detectContradictions(
        context.evidence,
      );
    context.contradictions =
      context.conflicts;
    context.endStage(
      "Contradiction Detection",
      {
        contradictionsFound:
          context.conflicts.length,
        conflictingClaims:
          context.conflicts.map(
            (item) =>
              `${item.subjectEntityId || "?"} ${item.predicate || "?"} ${item.objectEntityId || ""}`.trim(),
          ),
      },
    );

    context.beginStage(
      "Confidence Calculation",
    );
    context.confidence =
      calculateConfidence({
        evidence: context.evidence,
        contradictions:
          context.contradictions,
      });
    context.endStage(
      "Confidence Calculation",
      {
        overallConfidence:
          context.confidence
            ?.overallConfidence ?? 0,
        documentConfidence:
          context.confidence
            ?.documentConfidence,
        graphConfidence:
          context.confidence
            ?.graphConfidence,
        inferenceConfidence:
          context.confidence
            ?.inferenceConfidence,
        ontologyConfidence:
          context.confidence
            ?.ontologyConfidence,
      },
    );

    context.beginStage(
      "Explanation Builder",
    );
    context.explanation =
      buildExplanation({
        evidence: context.evidence,
        confidence: context.confidence,
        contradictions:
          context.contradictions,
      });
    context.endStage(
      "Explanation Builder",
      {
        explanationCount:
          context.explanation
            ?.explanation
            ?.length ?? 0,
        reasoningPathLength:
          context.explanation
            ?.reasoningPath
            ?.length ?? 0,
      },
    );
  }

  const reasoningTime =
    Date.now() - pipelineStarted;

  context.setMetric(
    "reasoningTime",
    reasoningTime,
  );
  context.markTotal(pipelineStarted);
  context.metrics.cacheHit = false;

  if (useCache && cacheKey) {
    setReasoningCache(cacheKey, {
      evidence: context.evidence,
      conflicts: context.conflicts,
      contradictions:
        context.contradictions,
      confidence: context.confidence,
      explanation: context.explanation,
      executionPlan:
        context.executionPlan?.toJSON
          ? context.executionPlan.toJSON()
          : context.executionPlan,
      executionTrace:
        context.executionTrace,
      metrics: {
        ...context.metrics,
      },
    });
  }

  return context;
}

export {
  ReasoningContext,
  createReasoningContext,
};

export default runReasoningPipeline;
