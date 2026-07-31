import {
    buildKnowledgeGraph,
    getKnowledgeGraphSnapshot,
    getKnowledgeGraphSummary,
} from "../graph/knowledgeGraphStore.js";

import {
    linkAllGraphObjects,
    getObjectEntityLinkSummary,
} from "../graph/objectEntityLinker.js";

import {
    discoverEntitiesFromGraph,
    getEntityDiscoverySummary,
} from "../graph/entityDiscoveryEngine.js";

import {
    createAugmentationPlan,
    applyAugmentationPlan,
    getAugmentationSummary,
    getAugmentationMutationReport,
    getAugmentedGraphSnapshot,
} from "../graph/graphAugmentationEngine.js";

import {
    synchronizeAugmentedGraph,
    getSynchronizationReport,
    getSynchronizationSummary,
} from "../graph/graphRegistrySynchronizer.js";

function getEvidenceCount(context = {}) {
    if (Array.isArray(context.clusteredEvidence)) {
        return context.clusteredEvidence.length;
    }

    if (Array.isArray(context.evidence)) {
        return context.evidence.length;
    }

    return 0;
}

export const knowledgeGraphStage = {
    name: "knowledge_graph",

    shouldSkip(context) {
        return getEvidenceCount(context) === 0;
    },

    execute(context) {
        const graphBuildResult =
            buildKnowledgeGraph();

        const graphSnapshot =
            getKnowledgeGraphSnapshot();

        const objectLinkingResult =
            linkAllGraphObjects({
                reset: true,
            });

        const entityDiscoveryResult =
            discoverEntitiesFromGraph({
                reset: true,
                snapshot: graphSnapshot,
            });

        const augmentationPlan =
            createAugmentationPlan({
                reset: true,
                graphSnapshot,
            });

        const augmentationApplication =
            applyAugmentationPlan({
                graphSnapshot,
            });

        const synchronizationResult =
            synchronizeAugmentedGraph();

        context.knowledgeGraph = {
            buildResult: graphBuildResult,
            snapshot: graphSnapshot,
            summary:
                getKnowledgeGraphSummary(),
        };

        context.objectEntityLinking = {
            result: objectLinkingResult,
            summary:
                getObjectEntityLinkSummary(),
        };

        context.entityDiscovery = {
            result: entityDiscoveryResult,
            summary:
                getEntityDiscoverySummary(),
        };

        context.graphAugmentation = {
            plan: augmentationPlan,
            application:
                augmentationApplication,
            summary:
                getAugmentationSummary(),
            mutationReport:
                getAugmentationMutationReport(),
            snapshot:
                getAugmentedGraphSnapshot(),
        };

        context.graphSynchronization = {
            result: synchronizationResult,
            report:
                getSynchronizationReport(),
            summary:
                getSynchronizationSummary(),
        };

        return {
            graph: context.knowledgeGraph,
            objectEntityLinking:
                context.objectEntityLinking,
            entityDiscovery:
                context.entityDiscovery,
            augmentation:
                context.graphAugmentation,
            synchronization:
                context.graphSynchronization,
        };
    },
};

export default knowledgeGraphStage;