import {
    discoverBreadthFirstPaths,
} from "../graph/multiHopReasoningEngine.js";

export const multiHopReasoningStage = {
    name: "multi_hop_reasoning",

    shouldSkip(context = {}) {
        return (
            !context.knowledgeGraph?.snapshot ||
            !context.reasoningQuery
        );
    },

    execute(context = {}) {
        const reasoningResult =
            discoverBreadthFirstPaths(
                context.knowledgeGraph.snapshot,
                context.reasoningQuery,
            );

        context.multiHopReasoning = {
            result: reasoningResult,

            statistics: {
                status:
                    reasoningResult.status,

                pathCount:
                    reasoningResult.pathCount,

                bestPathFound:
                    reasoningResult.bestPath !==
                    null,

                graphSummary:
                    reasoningResult.graphSummary,
            },
        };

        return context.multiHopReasoning;
    },
};

export default multiHopReasoningStage;