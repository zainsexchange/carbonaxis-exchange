import {
    rankEvidence,
} from "../truth/evidenceRanker.js";

import {
    clusterEvidence,
} from "../truth/evidenceClusterer.js";

export const evidenceRankingStage = {
    name: "evidence_ranking",

    shouldSkip(context) {
        return (
            !context.semantic ||
            !Array.isArray(
                context.semantic.results,
            ) ||
            context.semantic.results.length === 0
        );
    },

    async execute(context) {
        const result =
            rankEvidence(
                context.semantic.results,
                {
                    question:
                        context.question,

                    limit:
                        context.options
                            ?.evidenceLimit ??
                        10,
                },
            );

        context.evidence =
            result.evidence;

        context.evidenceRankingStatistics =
            result.statistics;

        context.evidenceRankingWeights =
            result.weights;

        return result;
    },
};

export const evidenceClusteringStage = {
    name: "evidence_clustering",

    shouldSkip(context) {
        return (
            !Array.isArray(context.evidence) ||
            context.evidence.length === 0
        );
    },

    execute(context) {
        const result = clusterEvidence(
            context.evidence,
            {
                maximumChunksPerDocument:
                    context.options
                        ?.maximumChunksPerDocument ??
                    3,

                maximumDocuments:
                    context.options
                        ?.maximumDocuments ??
                    8,
            }
        );

        context.evidenceClusters =
            result.clusters;

        context.clusteredEvidence =
            result.flattenedEvidence;

        context.evidenceClusteringStatistics =
            result.statistics;

        return result;
    },
};
