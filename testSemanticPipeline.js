import {
  buildSemanticKnowledge,
} from "./intelligence/truth/semanticPipeline.js";
import {
  resetEntityRegistry,
  listEntities,
} from "./intelligence/graph/entityRegistry.js";
import {
  resetRelationshipRegistry,
  listRelationships,
} from "./intelligence/graph/relationshipRegistry.js";
import {
  buildKnowledgeGraph,
  getKnowledgeGraphSummary,
  getEntityNeighborhood,
  getKnowledgeGraphSnapshot,
} from "./intelligence/graph/knowledgeGraphStore.js";
import {
  traverseOneHop,
  traversePredicate,
  traverseGraph,
  getTraversalEvidence,
} from "./intelligence/graph/knowledgeGraphTraversalEngine.js";
import {
  reasonAboutEntity,
  reasonByPredicate,
  buildReasoningEvidencePackage,
  getEntityReasoningTrace,
} from "./intelligence/graph/graphReasoningEngine.js";
import {
  buildEntityLinkIndex,
  matchObjectNodeToEntity,
  linkAllGraphObjects,
  getAllObjectEntityLinks,
  getObjectEntityLinkSummary,
  getObjectEntityLinkSnapshot,
  resetObjectEntityLinks,
} from "./intelligence/graph/objectEntityLinker.js";
import {
  discoverEntitiesFromGraph,
  getAllDiscoveredEntities,
  getAllEntityDiscoveryRecords,
  getEntityDiscoverySummary,
  getEntityDiscoverySnapshot,
  mergeExistingAndDiscoveredEntities,
  resetEntityDiscovery,
} from "./intelligence/graph/entityDiscoveryEngine.js";
import {
  createAugmentationPlan,
  getPendingEntityInsertions,
  getPendingRelationshipInsertions,
  getAugmentationSummary,
  getAugmentationSnapshot,
  resetGraphAugmentation,
  applyAugmentationPlan,
  getAugmentedGraphSnapshot,
  getAugmentationMutationReport,
  getAppliedEntityInsertions,
  getAppliedRelationshipInsertions,
  getEntityIdMappings,
} from "./intelligence/graph/graphAugmentationEngine.js";
import {
  synchronizeAugmentedGraph,
  getSynchronizationSummary,
  resetSynchronization,
} from "./intelligence/graph/graphRegistrySynchronizer.js";

resetEntityRegistry();
resetRelationshipRegistry();

const sample = `
Pakistan Green Transition Strategy

Energy Targets

• 60% renewable electricity by 2035
• Expand solar generation
• Develop wind corridors

Finance

1. Mobilize USD 18 billion through green bonds
2. Establish climate investment funds
`;

const result = buildSemanticKnowledge(sample);

console.log(
  JSON.stringify(result, null, 2)
);

const firstRelationship = listRelationships()[0];

console.log("\n=== FIRST RELATIONSHIP ===\n");

console.log(
  JSON.stringify(firstRelationship, null, 2)
);

console.log("\n================================");
console.log("KNOWLEDGE GRAPH TEST");
console.log("================================");

const graphSummary = buildKnowledgeGraph();

console.log("\nGraph Summary:");
console.log(
  JSON.stringify(
    graphSummary,
    null,
    2,
  ),
);

console.log("\nKnowledge Graph Summary:");
console.log(
  JSON.stringify(
    getKnowledgeGraphSummary(),
    null,
    2,
  ),
);

const firstEntity =
  listEntities()[0];

if (firstEntity) {
  const neighborhood =
    getEntityNeighborhood(
      firstEntity.entityId,
    );

  console.log("\nFirst Entity Neighborhood:");
  console.log(
    JSON.stringify(
      neighborhood,
      null,
      2,
    ),
  );
}

console.log("\n================================");
console.log("GRAPH TRAVERSAL TEST");
console.log("================================");

const entityId = "ENTITY_000001";

console.log("\nOne Hop Traversal");
console.log(
  JSON.stringify(
    traverseOneHop(entityId),
    null,
    2,
  ),
);

console.log("\nPredicate Traversal (includes)");
console.log(
  JSON.stringify(
    traversePredicate("includes"),
    null,
    2,
  ),
);

console.log("\nGraph Traversal");
console.log(
  JSON.stringify(
    traverseGraph(entityId),
    null,
    2,
  ),
);

console.log("\nEvidence");
console.log(
  JSON.stringify(
    getTraversalEvidence(entityId),
    null,
    2,
  ),
);

console.log("\n================================");
console.log("GRAPH REASONING TEST");
console.log("================================");

console.log("\nReason About Entity");
console.log(
  JSON.stringify(
    reasonAboutEntity(entityId),
    null,
    2,
  ),
);

console.log("\nReason By Predicate");
console.log(
  JSON.stringify(
    reasonByPredicate("includes"),
    null,
    2,
  ),
);

console.log("\nEvidence Package");
console.log(
  JSON.stringify(
    buildReasoningEvidencePackage(entityId),
    null,
    2,
  ),
);

console.log("\nReasoning Trace");
console.log(
  JSON.stringify(
    getEntityReasoningTrace(entityId),
    null,
    2,
  ),
);

console.log("\n================================");
console.log("OBJECT TO ENTITY LINKER TEST");
console.log("================================");

resetObjectEntityLinks();

const entityIndex =
  buildEntityLinkIndex();

console.log("\nEntity Link Index");
console.log(
  JSON.stringify(
    entityIndex.summary,
    null,
    2,
  ),
);

const linkerResult =
  linkAllGraphObjects({
    reset: true,
  });

console.log("\nLink All Graph Objects");
console.log(
  JSON.stringify(
    linkerResult,
    null,
    2,
  ),
);

console.log("\nRegistered Object Entity Links");
console.log(
  JSON.stringify(
    getAllObjectEntityLinks(),
    null,
    2,
  ),
);

console.log("\nObject Entity Link Summary");
console.log(
  JSON.stringify(
    getObjectEntityLinkSummary(),
    null,
    2,
  ),
);

console.log("\nObject Entity Link Snapshot");
console.log(
  JSON.stringify(
    getObjectEntityLinkSnapshot(),
    null,
    2,
  ),
);

console.log("\n================================");
console.log("ENTITY DISCOVERY ENGINE TEST");
console.log("================================");

resetEntityDiscovery();

const discoveryResult =
  discoverEntitiesFromGraph({
    reset: true,
  });

console.log("\nDiscovery Result");
console.log(
  JSON.stringify(
    discoveryResult,
    null,
    2,
  ),
);

console.log("\nDiscovered Entities");
console.log(
  JSON.stringify(
    getAllDiscoveredEntities(),
    null,
    2,
  ),
);

console.log("\nDiscovery Records");
console.log(
  JSON.stringify(
    getAllEntityDiscoveryRecords(),
    null,
    2,
  ),
);

console.log("\nDiscovery Summary");
console.log(
  JSON.stringify(
    getEntityDiscoverySummary(),
    null,
    2,
  ),
);

console.log("\nMerged Entity Collection");
console.log(
  JSON.stringify(
    mergeExistingAndDiscoveredEntities([
      {
        nodeId: "ENTITY_000001",
        entityId: "ENTITY_000001",
        canonicalName:
          "Pakistan Green Transition Strategy",
        canonicalKey:
          "pakistan green transition strategy",
        aliases: [
          "Pakistan Green Transition Strategy",
        ],
        candidateIds: [
          "POLICY_DOCUMENT_PAKISTAN_GREEN_TRANSITION_STRATEGY",
        ],
      },
    ]),
    null,
    2,
  ),
);

console.log("\nDiscovery Snapshot");
console.log(
  JSON.stringify(
    getEntityDiscoverySnapshot(),
    null,
    2,
  ),
);

console.log("\n================================");
console.log("GRAPH AUGMENTATION PLANNER TEST");
console.log("================================");

resetGraphAugmentation();

const augmentationPlan = createAugmentationPlan({
  reset: true,
});

console.log("\nAugmentation Plan");
console.log(JSON.stringify(augmentationPlan, null, 2));

console.log("\nPending Entity Insertions");
console.log(
  JSON.stringify(
    getPendingEntityInsertions(),
    null,
    2,
  ),
);

console.log("\nPending Relationship Insertions");
console.log(
  JSON.stringify(
    getPendingRelationshipInsertions(),
    null,
    2,
  ),
);

console.log("\nAugmentation Summary");
console.log(
  JSON.stringify(
    getAugmentationSummary(),
    null,
    2,
  ),
);

console.log("\nAugmentation Snapshot");
console.log(
  JSON.stringify(
    getAugmentationSnapshot(),
    null,
    2,
  ),
);

console.log("\n======================================");
console.log("GRAPH AUGMENTATION MUTATION TEST");
console.log("======================================");

const mutationResult = applyAugmentationPlan();

console.log("\nMutation Result");
console.log(JSON.stringify(mutationResult, null, 2));

console.log("\nEntity ID Mapping");
console.log(
  JSON.stringify(
    getEntityIdMappings(),
    null,
    2,
  ),
);

console.log("\nApplied Entity Insertions");
console.log(
  JSON.stringify(
    getAppliedEntityInsertions(),
    null,
    2,
  ),
);

console.log("\nApplied Relationship Insertions");
console.log(
  JSON.stringify(
    getAppliedRelationshipInsertions(),
    null,
    2,
  ),
);

console.log("\nMutation Report");
console.log(
  JSON.stringify(
    getAugmentationMutationReport(),
    null,
    2,
  ),
);

const augmentedGraph = getAugmentedGraphSnapshot();

console.log("\nAugmented Graph Summary");

console.log({
  entityNodes:
    augmentedGraph.entityNodes.length,

  objectNodes:
    augmentedGraph.objectNodes.length,

  relationshipEdges:
    augmentedGraph.relationshipEdges.length,
});

/* -------------------------------------------------------------------------- */
/*                       Registry Synchronization Test                        */
/* -------------------------------------------------------------------------- */

resetSynchronization();

const synchronizationResult =
  synchronizeAugmentedGraph();

const synchronizationSummary =
  getSynchronizationSummary();

const persistedEntities =
  listEntities();

const persistedRelationships =
  listRelationships();

const persistedGraph =
  getKnowledgeGraphSnapshot();

console.log(
  "\nRegistry synchronization result:",
);

console.dir(
  synchronizationResult,
  {
    depth: null,
  },
);

console.log(
  "\nSynchronization summary:",
);

console.dir(
  synchronizationSummary,
  {
    depth: null,
  },
);

console.log(
  "\nPersisted registry counts:",
);

console.log({
  entities:
    persistedEntities.length,

  relationships:
    persistedRelationships.length,
});

console.log(
  "\nPersisted graph counts:",
);

console.log({
  entityNodes:
    persistedGraph.entityNodes.length,

  objectNodes:
    persistedGraph.objectNodes.length,

  edges:
    persistedGraph.edges.length,

  entityToEntityEdges:
    persistedGraph.edges.filter(
      (edge) =>
        edge.objectType ===
        "entity",
    ).length,
});

console.log(
  "\nPersisted entity-to-entity edges:",
);

console.dir(
  persistedGraph.edges.filter(
    (edge) =>
      edge.objectType === "entity",
  ),
  {
    depth: null,
  },
);

/* -------------------------------------------------------------------------- */
/*                              Assertions                                    */
/* -------------------------------------------------------------------------- */

const report =
  synchronizationResult.report;

const assertions = {
  synchronized:
    synchronizationResult
      .synchronized === true,

  statusSuccess:
    report?.status === "success",

  entityMappingCreated:
    Object.keys(
      report?.idMapping
        ?.entities ?? {},
    ).length > 0,

  relationshipMappingCreated:
    Object.keys(
      report?.idMapping
        ?.relationships ?? {},
    ).length > 0,

  entitiesPersisted:
    report?.entities?.after >=
    report?.entities?.before,

  relationshipsPersisted:
    report?.relationships?.after >=
    report?.relationships?.before,

  graphRebuilt:
    report?.graph?.rebuilt === true,

  entityEdgesPersisted:
    persistedGraph.edges.some(
      (edge) =>
        edge.objectType ===
          "entity" &&
        edge.objectEntityId &&
        edge.toNodeId ===
          edge.objectEntityId,
    ),

  noSynchronizationFailures:
    (
      report?.entities?.failed ?? 0
    ) === 0 &&
    (
      report?.relationships
        ?.failed ?? 0
    ) === 0,

  noRejectedRelationships:
    (
      report?.relationships
        ?.rejected ?? 0
    ) === 0,
};

console.log(
  "\nSynchronization assertions:",
);

console.table(assertions);

const allPassed =
  Object.values(assertions).every(
    Boolean,
  );

if (!allPassed) {
  throw new Error(
    "Registry synchronization runtime verification failed.",
  );
}

console.log(
  "\n✅ Registry synchronization runtime verification passed.",
);
