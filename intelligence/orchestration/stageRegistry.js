import {
    bootstrapStage,
    infrastructureStage,
    semanticRetrievalStage,
} from "./stageDefinitions.js";

import {
    evidenceRankingStage,
    evidenceClusteringStage,
} from "./evidenceStages.js";

import {
    semanticKnowledgeStage,
} from "./semanticKnowledgeStage.js";

import {
    knowledgeGraphStage,
} from "./knowledgeGraphStage.js";

import {
    reasoningQueryPlannerStage,
} from "./reasoningQueryPlannerStage.js";

import {
    multiHopReasoningStage,
} from "./multiHopReasoningStage.js";

import {
    truthEngineStage,
} from "./truthEngineStage.js";

import {
    responseGenerationStage,
} from "./responseGenerationStage.js";

export const STAGE_NAMES = Object.freeze({
    BOOTSTRAP:
        "bootstrap",

    INFRASTRUCTURE_VALIDATION:
        "infrastructure_validation",

    SEMANTIC_RETRIEVAL:
        "semantic_retrieval",

    EVIDENCE_RANKING:
        "evidence_ranking",

    EVIDENCE_CLUSTERING:
        "evidence_clustering",

    SEMANTIC_KNOWLEDGE:
        "semantic_knowledge",

    KNOWLEDGE_GRAPH:
        "knowledge_graph",

    REASONING_QUERY_PLANNER:
        "reasoning_query_planner",

    MULTI_HOP_REASONING:
        "multi_hop_reasoning",

    TRUTH_ENGINE:
        "truth_engine",

    RESPONSE_GENERATION:
        "response_generation",
});

export const STAGE_REGISTRY =
    Object.freeze({
        [STAGE_NAMES.BOOTSTRAP]:
            bootstrapStage,

        [STAGE_NAMES.INFRASTRUCTURE_VALIDATION]:
            infrastructureStage,

        [STAGE_NAMES.SEMANTIC_RETRIEVAL]:
            semanticRetrievalStage,

        [STAGE_NAMES.EVIDENCE_RANKING]:
            evidenceRankingStage,

        [STAGE_NAMES.EVIDENCE_CLUSTERING]:
            evidenceClusteringStage,

        [STAGE_NAMES.SEMANTIC_KNOWLEDGE]:
            semanticKnowledgeStage,

        [STAGE_NAMES.KNOWLEDGE_GRAPH]:
            knowledgeGraphStage,

        [STAGE_NAMES.REASONING_QUERY_PLANNER]:
            reasoningQueryPlannerStage,

        [STAGE_NAMES.MULTI_HOP_REASONING]:
            multiHopReasoningStage,

        [STAGE_NAMES.TRUTH_ENGINE]:
            truthEngineStage,

        [STAGE_NAMES.RESPONSE_GENERATION]:
            responseGenerationStage,
    });

export function getStage(stageName) {
    if (
        typeof stageName !== "string" ||
        !stageName.trim()
    ) {
        throw new TypeError(
            "Stage name must be a non-empty string.",
        );
    }

    const normalizedStageName =
        stageName.trim();

    const stage =
        STAGE_REGISTRY[
            normalizedStageName
        ];

    if (!stage) {
        throw new Error(
            `Pipeline stage "${normalizedStageName}" is not registered.`,
        );
    }

    return stage;
}

export function getStages(stageNames = []) {
    if (!Array.isArray(stageNames)) {
        throw new TypeError(
            "Stage names must be supplied as an array.",
        );
    }

    return stageNames.map(
        stageName =>
            getStage(stageName),
    );
}

export function hasStage(stageName) {
    return (
        typeof stageName === "string" &&
        Boolean(
            STAGE_REGISTRY[
                stageName.trim()
            ],
        )
    );
}

export function listRegisteredStages() {
    return Object.keys(
        STAGE_REGISTRY,
    );
}