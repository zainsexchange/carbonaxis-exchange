import {
  registerEntity,
  resetEntityRegistry,
} from "./entityRegistry.js";

import {
  registerRelationship,
  resetRelationshipRegistry,
} from "./relationshipRegistry.js";

import {
  buildKnowledgeGraph,
  getKnowledgeGraphSnapshot,
  resetKnowledgeGraphStore,
} from "./knowledgeGraphStore.js";

/* -------------------------------------------------------------------------- */
/*                               Reset State                                  */
/* -------------------------------------------------------------------------- */

resetKnowledgeGraphStore();
resetRelationshipRegistry();
resetEntityRegistry();

/* -------------------------------------------------------------------------- */
/*                              Register Entities                             */
/* -------------------------------------------------------------------------- */

const strategyResult =
  registerEntity({
    canonicalSubject:
      "Pakistan Green Transition Strategy",

    entityType: "policy_strategy",
  });

const solarResult =
  registerEntity({
    canonicalSubject:
      "Expanding Solar Generation",

    entityType: "climate_initiative",
  });

console.log(
  "\nRegistered entities:",
);

console.log({
  strategyEntityId:
    strategyResult.entityId,

  solarEntityId:
    solarResult.entityId,
});

/* -------------------------------------------------------------------------- */
/*                        Register Literal Relationship                       */
/* -------------------------------------------------------------------------- */

const literalRelationship =
  registerRelationship({
    subjectEntityId:
      strategyResult.entityId,

    subject:
      "Pakistan Green Transition Strategy",

    canonicalSubject:
      "Pakistan Green Transition Strategy",

    predicate: "targets",

    object:
      "60% renewable electricity by 2035",

    confidence: 0.94,
  });

/* -------------------------------------------------------------------------- */
/*                    Register Entity-to-Entity Relationship                  */
/* -------------------------------------------------------------------------- */

const entityRelationship =
  registerRelationship({
    subjectEntityId:
      strategyResult.entityId,

    subject:
      "Pakistan Green Transition Strategy",

    canonicalSubject:
      "Pakistan Green Transition Strategy",

    predicate: "includes",

    object:
      "Expanding Solar Generation",

    objectEntityId:
      solarResult.entityId,

    confidence: 0.91,
  });

console.log(
  "\nRegistered relationships:",
);

console.log({
  literalRelationshipId:
    literalRelationship.relationshipId,

  entityRelationshipId:
    entityRelationship.relationshipId,
});

/* -------------------------------------------------------------------------- */
/*                              Build Graph                                   */
/* -------------------------------------------------------------------------- */

const buildSummary =
  buildKnowledgeGraph();

const snapshot =
  getKnowledgeGraphSnapshot();

/* -------------------------------------------------------------------------- */
/*                           Inspect Edge Types                               */
/* -------------------------------------------------------------------------- */

const literalEdge =
  snapshot.edges.find(
    (edge) =>
      edge.objectType === "literal",
  );

const entityEdge =
  snapshot.edges.find(
    (edge) =>
      edge.objectType === "entity",
  );

/* -------------------------------------------------------------------------- */
/*                              Assertions                                    */
/* -------------------------------------------------------------------------- */

const assertions = {
  entityNodeCountCorrect:
    snapshot.entityNodes.length === 2,

  objectNodeCountCorrect:
    snapshot.objectNodes.length === 1,

  edgeCountCorrect:
    snapshot.edges.length === 2,

  literalEdgeFound:
    Boolean(literalEdge),

  entityEdgeFound:
    Boolean(entityEdge),

  literalTargetsObjectNode:
    literalEdge?.toNodeId?.startsWith(
      "OBJECT::",
    ) === true,

  entityTargetsEntityNode:
    entityEdge?.toNodeId ===
    solarResult.entityId,

  entityObjectIdPreserved:
    entityEdge?.objectEntityId ===
    solarResult.entityId,

  entityObjectTypeCorrect:
    entityEdge?.objectType === "entity",
};

const allPassed =
  Object.values(assertions).every(
    Boolean,
  );

/* -------------------------------------------------------------------------- */
/*                               Output                                       */
/* -------------------------------------------------------------------------- */

console.log("\nBuild summary:");

console.dir(
  buildSummary,
  {
    depth: null,
  },
);

console.log(
  "\nSnapshot counts:",
);

console.log({
  entityNodes:
    snapshot.entityNodes.length,

  objectNodes:
    snapshot.objectNodes.length,

  edges:
    snapshot.edges.length,
});

console.log(
  "\nLiteral edge:",
);

console.dir(
  literalEdge,
  {
    depth: null,
  },
);

console.log(
  "\nEntity-to-entity edge:",
);

console.dir(
  entityEdge,
  {
    depth: null,
  },
);

console.log(
  "\nAssertions:",
);

console.table(assertions);

if (!allPassed) {
  throw new Error(
    "Hybrid knowledge graph runtime verification failed.",
  );
}

console.log(
  "\n✅ Hybrid knowledge graph runtime verification passed.",
);