import {
    getStages,
} from "./stageRegistry.js";

export const carbonBrainStages =
    getStages([
        "bootstrap",
        "infrastructure_validation",
        "semantic_retrieval",
        "evidence_ranking",
        "evidence_clustering",
        "semantic_knowledge",
        "knowledge_graph",
        "reasoning_query_planner",
        "multi_hop_reasoning",
        "truth_engine",
        "response_generation",
    ]);

export default carbonBrainStages;
