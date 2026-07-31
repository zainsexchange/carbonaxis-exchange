import {
  buildTruthPackageFromEvidence,
} from "../truth/documentTruthPackage.js";

const DEFAULT_MAXIMUM_CITATIONS = 8;

function resolveEvidence(context = {}) {
  if (Array.isArray(context.clusteredEvidence)) {
    return context.clusteredEvidence;
  }

  if (Array.isArray(context.evidenceClusters?.flattenedEvidence)) {
    return context.evidenceClusters.flattenedEvidence;
  }

  if (Array.isArray(context.evidence)) {
    return context.evidence;
  }

  return [];
}

function buildUpstreamStatistics(context = {}) {
  return {
    semantic:
      context.semantic?.statistics ??
      null,

    ranking:
      context.evidenceRankingStatistics ??
      context.evidence?.statistics ??
      null,

    clustering:
      context.evidenceClusteringStatistics ??
      null,

    reasoning: {
      status:
        context.multiHopReasoning
          ?.statistics
          ?.status ??
        null,

      pathCount:
        context.multiHopReasoning
          ?.statistics
          ?.pathCount ??
        0,

      bestPathFound:
        context.multiHopReasoning
          ?.statistics
          ?.bestPathFound ??
        false,
    },
  };
}

export const truthEngineStage = {
  name: "truth_engine",

  shouldSkip(context = {}) {
    return (
      typeof context.question !== "string" ||
      context.question.trim().length < 3
    );
  },

  execute(context = {}) {
    const evidence =
      resolveEvidence(context);

    const maximumCitations =
      Number.isFinite(
        context.truthOptions
          ?.maximumCitations
      )
        ? context.truthOptions
            .maximumCitations
        : DEFAULT_MAXIMUM_CITATIONS;

    const truthPackage =
      buildTruthPackageFromEvidence({
        question:
          context.question,

        evidence,

        maximumCitations,

        upstreamStatistics:
          buildUpstreamStatistics(
            context
          ),

        pipelineStartedAt:
          Number.isFinite(
            context.pipelineStartedAt
          )
            ? context.pipelineStartedAt
            : null,
      });

    context.truthPackage =
      truthPackage;

    context.confidence =
      truthPackage.confidence ?? null;

    context.citations =
      truthPackage.citations ?? [];

    context.conflicts =
      truthPackage.conflicts ?? [];

    context.explainability =
      truthPackage.explainability ?? [];

    context.truthStatus =
      truthPackage.truthStatus ?? null;

    context.truthEvaluation = {
      status:
        truthPackage
          .truthStatus
          ?.code ??
        "unknown",

      confidenceScore:
        truthPackage
          .confidence
          ?.score ??
        0,

      confidencePercentage:
        truthPackage
          .confidence
          ?.percentage ??
        0,

      evidenceCount:
        truthPackage
          .evidence
          ?.length ??
        0,

      conflictCount:
        truthPackage
          .conflicts
          ?.length ??
        0,

      citationCount:
        truthPackage
          .citations
          ?.length ??
        0,

      reasoningPathCount:
        context.multiHopReasoning
          ?.result
          ?.pathCount ??
        0,

      bestReasoningPath:
        context.multiHopReasoning
          ?.result
          ?.bestPath ??
        null,
    };

    return context.truthPackage;
  },
};

export default truthEngineStage;
