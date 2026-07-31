import {
  registerEntity,
  listEntities,
  resetEntityRegistry,
  getRegistrySize,
} from "./intelligence/graph/entityRegistry.js";

resetEntityRegistry();

const samples = [
  {
    canonicalSubject: "Pakistan Green Transition Strategy",
    entityType: "policy_document",
    parentCountry: "Pakistan",
    aliases: ["Pakistan Green Transition Strategy"],
    entityCandidateId:
      "POLICY_DOCUMENT_PAKISTAN_GREEN_TRANSITION_STRATEGY",
  },

  {
    canonicalSubject: "Pakistan Green Transition Strategy",
    entityType: "policy_document",
    parentCountry: "Pakistan",
    aliases: ["Pakistan Green Transition Strategy"],
    entityCandidateId:
      "POLICY_DOCUMENT_PAKISTAN_GREEN_TRANSITION_STRATEGY",
  },

  {
    canonicalSubject: "Saudi Vision 2030",
    entityType: "policy_document",
    parentCountry: "Saudi Arabia",
    aliases: ["Saudi Vision 2030"],
    entityCandidateId:
      "POLICY_DOCUMENT_SAUDI_VISION_2030",
  },

  {
    canonicalSubject: "Ministry of Climate Change",
    entityType: "government_organization",
    aliases: ["Ministry of Climate Change"],
    entityCandidateId:
      "GOVERNMENT_ORGANIZATION_MINISTRY_OF_CLIMATE_CHANGE",
  },

  {
    canonicalSubject: "Pakistan Green Transition Strategy",
    entityType: "policy_document",
    parentCountry: "Pakistan",
    aliases: [
      "Pakistan Green Transition Strategy",
      "Pakistan Green Transition Strategy 2025",
    ],
    entityCandidateId:
      "POLICY_DOCUMENT_PAKISTAN_GREEN_TRANSITION_STRATEGY",
  },
];

console.log("\n=== Registration ===\n");

for (const sample of samples) {
  const result = registerEntity(sample);

  console.log({
    entityId: result.entityId,
    created: result.created,
    canonicalName: result.entity.canonicalName,
    occurrenceCount: result.entity.occurrenceCount,
  });
}

console.log("\n=== Registry Size ===");
console.log(getRegistrySize());

console.log("\n=== Registry ===");
console.log(JSON.stringify(listEntities(), null, 2));