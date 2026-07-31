import planReasoningQuery from "../graph/reasoningQueryPlanner.js";

export const reasoningQueryPlannerStage = {
    name: "reasoning_query_planner",

    shouldSkip(context = {}) {
        return (
            !context.question ||
            !context.knowledgeGraph?.snapshot
        );
    },

    execute(context = {}) {
        const plannerResult =
            planReasoningQuery({
                question:
                    context.question,

                graph:
                    context.knowledgeGraph
                        .snapshot,

                options:
                    context.reasoningOptions ??
                    {},
            });

        context.reasoningPlan = {
            status:
                plannerResult.status,

            question:
                plannerResult.question,

            resolution:
                plannerResult.resolution ??
                null,

            candidates:
                plannerResult.candidates ??
                {},
        };

        context.reasoningQuery =
            plannerResult.reasoningQuery;

        context.reasoningPlanner = {
            statistics: {
                resolved:
                    plannerResult.status ===
                    "resolved",

                candidateEntityCount:
                    plannerResult
                        .candidates
                        ?.entities
                        ?.length ?? 0,

                candidateObjectCount:
                    plannerResult
                        .candidates
                        ?.objects
                        ?.length ?? 0,
            },
        };

        return context.reasoningPlanner;
    },
};

export default reasoningQueryPlannerStage;