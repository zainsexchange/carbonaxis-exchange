/*
|--------------------------------------------------------------------------
| Carbon Brain Engine
|--------------------------------------------------------------------------
|
| Central orchestration layer for Carbon Brain.
|
| Every intelligence module is coordinated here.
| Individual modules remain independent and testable.
|
*/

import {
  executePipeline,
} from "../orchestration/pipelineOrchestrator.js";

import {
  carbonBrainStages,
} from "../orchestration/carbonBrainStages.js";

export const ENGINE_VERSION = "1.0.0";

export const PIPELINE_STAGES = Object.freeze({
  INITIALIZE: "initialize",

  INFRASTRUCTURE_VALIDATION:
    "infrastructure_validation",

  INTENT_ANALYSIS: "intent_analysis",

  SEMANTIC_RETRIEVAL: "semantic_retrieval",

  GRAPH_LOOKUP: "graph_lookup",

  MULTI_HOP_REASONING: "multi_hop_reasoning",

  TRUTH_ANALYSIS: "truth_analysis",

  EVIDENCE_RANKING: "evidence_ranking",

  CITATION_BUILDING: "citation_building",

  CONFIDENCE_SCORING: "confidence_scoring",

  RESPONSE_GENERATION: "response_generation",

  COMPLETE: "complete",
});

export const ENGINE_STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
});

function now() {
  return Date.now();
}

function normalizeQuestion(
  question,
) {
  return String(
    question ?? "",
  ).trim();
}

function validateQuestion(
  question,
) {
  const normalizedQuestion =
    normalizeQuestion(
      question,
    );

  if (!normalizedQuestion) {
    throw new TypeError(
      "Carbon Brain requires a non-empty question.",
    );
  }

  return normalizedQuestion;
}

function serializeError(
  error,
) {
  return {
    name:
      error?.name ??
      "Error",

    message:
      error?.message ??
      "Unknown Carbon Brain error.",

    stack:
      error?.stack ??
      null,
  };
}

function createExecutionContext(question, options = {}) {
  const normalizedQuestion =
    normalizeQuestion(question);

  const startedAt =
    now();

  return {
    id:
      crypto.randomUUID(),

    version:
      ENGINE_VERSION,

    startedAt,

    pipelineStartedAt:
      startedAt,

    completedAt:
      null,

    question:
      normalizedQuestion,

    options,

    user:
      options?.user ??
      null,

    status:
      ENGINE_STATUS.PENDING,

    error:
      null,

    currentStage:
      PIPELINE_STAGES.INITIALIZE,

    stageHistory: [],

    bootstrap:
      null,

    infrastructure:
      null,

    semantic:
      null,

    evidence:
      null,

    evidenceClusters:
      null,

    clusteredEvidence: [],

    semanticKnowledge:
      null,

    knowledgeGraph:
      null,

    objectEntityLinking:
      null,

    entityDiscovery:
      null,

    graphAugmentation:
      null,

    graphSynchronization:
      null,

    reasoningPlan:
      null,

    reasoningQuery:
      null,

    reasoningPlanner:
      null,

    multiHopReasoning:
      null,

    truthPackage:
      null,

    truthEvaluation:
      null,

    citations:
      null,

    confidence:
      null,

    response:
      null,

    metrics: {
      totalExecutionTime:
        0,

      stageExecutionTimes:
        {},
    },
  };
}

function enterStage(context, stage) {
  context.currentStage = stage;

  context.status =
    ENGINE_STATUS.RUNNING;

  context.stageHistory.push({
    stage,

    timestamp: now(),
  });
}

function finishExecution(context) {
  context.completedAt = now();

  context.metrics.totalExecutionTime =
    context.completedAt - context.startedAt;

  context.currentStage = PIPELINE_STAGES.COMPLETE;

  context.status =
    ENGINE_STATUS.COMPLETED;

  return context;
}

function failExecution(
  context,
  error,
) {
  context.completedAt =
    now();

  context.metrics.totalExecutionTime =
    context.completedAt -
    context.startedAt;

  context.status =
    ENGINE_STATUS.FAILED;

  context.error =
    serializeError(
      error,
    );

  return context;
}

export async function answer(question, options = {}) {
  let context =
    createExecutionContext(
      question,
      options,
    );

  try {
    const normalizedQuestion =
      validateQuestion(
        question,
      );

    context.question =
      normalizedQuestion;

    const pipelineResult =
      await executePipeline({
        context,
        stages:
          carbonBrainStages,
      });

    /*
     * Preserve the context produced by the orchestrator,
     * including completed stages, timings, and partial results.
     */
    context =
      pipelineResult.context ??
      context;

    if (
      pipelineResult.status ===
      "failed"
    ) {
      const pipelineError =
        pipelineResult.error;

      const error =
        new Error(
          pipelineError?.message ||
          "Carbon Brain pipeline failed.",
        );

      error.name =
        pipelineError?.name ||
        "PipelineError";

      error.pipelineStage =
        pipelineError?.stage ??
        null;

      throw error;
    }

    return finishExecution(
      context,
    );
  } catch (error) {
    return failExecution(
      context,
      error,
    );
  }
}

export {
  createExecutionContext,
  enterStage,
  finishExecution,

  normalizeQuestion,
  validateQuestion,
  serializeError,
  failExecution,
};
