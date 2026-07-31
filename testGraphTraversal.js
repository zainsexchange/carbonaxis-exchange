import {
    registerEntity,
    resetEntityRegistry,
} from "./intelligence/graph/entityRegistry.js";

import {
    registerRelationship,
    resetRelationshipRegistry,
} from "./intelligence/graph/relationshipRegistry.js";

import {
    initializeGraphIndexes,
    findNeighbors,
    findRelationships,
} from "./intelligence/graph/graphTraversalEngine.js";

// Clean registries
resetEntityRegistry();
resetRelationshipRegistry();

// Register Entities
const uae = registerEntity({
    canonicalSubject: "United Arab Emirates",
    entityType: "COUNTRY",
});

const hydrogen = registerEntity({
    canonicalSubject: "Green Hydrogen",
    entityType: "TECHNOLOGY",
});

const solar = registerEntity({
    canonicalSubject: "Solar PV",
    entityType: "TECHNOLOGY",
});

// Register Relationships
registerRelationship({
    subjectEntityId: uae.entityId,
    predicate: "SUPPORTS",
    canonicalPredicate: "SUPPORTS",
    objectEntityId: hydrogen.entityId,
});

registerRelationship({
    subjectEntityId: uae.entityId,
    predicate: "INVESTS_IN",
    canonicalPredicate: "INVESTS_IN",
    objectEntityId: solar.entityId,
});

// Build indexes
initializeGraphIndexes();

console.log("=================================");
console.log("Neighbors of UAE");
console.log("=================================");

console.dir(
    findNeighbors(uae.entityId),
    { depth: null }
);

console.log();

console.log("=================================");
console.log("Relationships of UAE");
console.log("=================================");

console.dir(
    findRelationships(uae.entityId),
    { depth: null }
);