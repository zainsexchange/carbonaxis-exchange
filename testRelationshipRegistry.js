import {
  registerRelationship,
  listRelationships,
  getRelationshipRegistrySize,
  resetRelationshipRegistry,
} from "./intelligence/graph/relationshipRegistry.js";

resetRelationshipRegistry();

const propositions = [
  {
    subjectEntityId: "ENTITY_000001",
    subject: "Pakistan Green Transition Strategy",
    canonicalSubject: "Pakistan Green Transition Strategy",
    predicate: "targets",
    object: "60% renewable electricity by 2035",
    confidence: 0.98,
    structuredValue: {
      type: "percentage",
      number: 60,
      unit: "%",
      year: 2035,
    },
    sourceLine: 5,
    contextPath: [
      "Pakistan Green Transition Strategy",
      "Energy Targets",
    ],
    originalBlockText: "60% renewable electricity by 2035",
    contextualSentence:
      "Pakistan Green Transition Strategy targets 60% renewable electricity by 2035.",
    clause:
      "Pakistan Green Transition Strategy targets 60% renewable electricity by 2035.",
  },

  {
    subjectEntityId: "ENTITY_000001",
    subject: "Pakistan Green Transition Strategy",
    canonicalSubject: "Pakistan Green Transition Strategy",
    predicate: "targets",
    object: "60% renewable electricity by 2035",
    confidence: 0.99,
    sourceLine: 5,
    contextPath: [
      "Pakistan Green Transition Strategy",
      "Energy Targets",
    ],
    originalBlockText: "60% renewable electricity by 2035",
    contextualSentence:
      "Pakistan Green Transition Strategy targets 60% renewable electricity by 2035.",
    clause:
      "Pakistan Green Transition Strategy targets 60% renewable electricity by 2035.",
  },

  {
    subjectEntityId: "ENTITY_000001",
    subject: "Pakistan Green Transition Strategy",
    canonicalSubject: "Pakistan Green Transition Strategy",
    predicate: "includes",
    object: "expanding solar generation",
    confidence: 0.95,
    sourceLine: 6,
    contextPath: [
      "Pakistan Green Transition Strategy",
      "Energy Targets",
    ],
    originalBlockText:
      "Expand solar generation",
    contextualSentence:
      "Pakistan Green Transition Strategy includes expanding solar generation.",
    clause:
      "Pakistan Green Transition Strategy includes expanding solar generation.",
  },

  {
    subjectEntityId: "ENTITY_000002",
    subject: "Saudi Vision 2030",
    canonicalSubject: "Saudi Vision 2030",
    predicate: "targets",
    object: "50% renewable electricity",
    confidence: 0.94,
    sourceLine: 8,
    contextPath: [
      "Saudi Vision 2030",
    ],
    originalBlockText:
      "50% renewable electricity",
    contextualSentence:
      "Saudi Vision 2030 targets 50% renewable electricity.",
    clause:
      "Saudi Vision 2030 targets 50% renewable electricity.",
  },
];

console.log("\n=== Registration ===\n");

for (const proposition of propositions) {

  const result =
    registerRelationship(proposition);

  console.log({
    relationshipId:
      result.relationshipId,

    created:
      result.created,

    occurrenceCount:
      result.relationship.occurrenceCount,

    averageConfidence:
      result.relationship.averageConfidence,
  });

}

console.log("\n=== Registry Size ===");

console.log(
  getRelationshipRegistrySize(),
);

console.log("\n=== Registry ===");

console.log(
  JSON.stringify(
    listRelationships(),
    null,
    2,
  ),
)