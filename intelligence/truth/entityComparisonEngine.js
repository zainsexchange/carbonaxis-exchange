function normalizeText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEntity(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim();
}

function uniqueValues(values = []) {
  return [
    ...new Set(
      values.filter(Boolean)
    ),
  ];
}

function calculateFactStrength(
  fact = {}
) {
  const evidenceScore =
    Number(fact.evidenceScore || 0);

  const semanticScore =
    Number(fact.semanticScore || 0);

  return Math.min(
    1,
    Math.max(
      0,
      evidenceScore * 0.6 +
      semanticScore * 0.4
    )
  );
}

function sortFactsByStrength(
  facts = []
) {
  return [...facts].sort(
    (left, right) =>
      calculateFactStrength(right) -
      calculateFactStrength(left)
  );
}

function buildTopicProfile(
  facts = []
) {
  const sortedFacts =
    sortFactsByStrength(facts);

  const strongestFact =
    sortedFacts[0] || null;

  return {
    factCount:
      sortedFacts.length,

    hasEvidence:
      sortedFacts.length > 0,

    strongestFact,

    strongestFactStrength:
      strongestFact
        ? Math.round(
            calculateFactStrength(
              strongestFact
            ) * 100
          )
        : 0,

    statements:
      uniqueValues(
        sortedFacts.map(
          (fact) =>
            fact.statement
        )
      ),

    numbers:
      uniqueValues(
        sortedFacts.flatMap(
          (fact) =>
            fact.numbers || []
        )
      ),

    citationIds:
      uniqueValues(
        sortedFacts.map(
          (fact) =>
            fact.citationId
        )
      ),

    documentIds:
      uniqueValues(
        sortedFacts.map(
          (fact) =>
            fact.documentId
        )
      ),

    facts:
      sortedFacts,
  };
}

function groupEntityFactsByTopic(
  facts = []
) {
  return facts.reduce(
    (groups, fact) => {
      const topic =
        fact.topic || "general";

      if (!groups[topic]) {
        groups[topic] = [];
      }

      groups[topic].push(fact);

      return groups;
    },
    {}
  );
}

function resolveEntityName(
  entityKey,
  entityGroups = {}
) {
  return (
    entityGroups[entityKey]?.entity ||
    entityKey ||
    "Unknown"
  );
}

function buildEntityProfile({
  entityKey,
  entityGroup,
}) {
  const facts =
    entityGroup?.facts || [];

  const groupedByTopic =
    groupEntityFactsByTopic(facts);

  const topics =
    Object.entries(
      groupedByTopic
    ).reduce(
      (
        result,
        [topic, topicFacts]
      ) => {
        result[topic] =
          buildTopicProfile(
            topicFacts
          );

        return result;
      },
      {}
    );

  return {
    entity:
      entityGroup?.entity ||
      entityKey,

    entityKey,

    factCount:
      facts.length,

    topicCount:
      Object.keys(topics).length,

    topics,
  };
}

function buildTopicComparison({
  topic,
  entityKeys,
  entityProfiles,
}) {
  const entities =
    entityKeys.map(
      (entityKey) => {
        const profile =
          entityProfiles[
            entityKey
          ];

        const topicProfile =
          profile?.topics?.[
            topic
          ] || null;

        return {
          entity:
            profile?.entity ||
            entityKey,

          entityKey,

          hasEvidence:
            Boolean(
              topicProfile
                ?.hasEvidence
            ),

          factCount:
            topicProfile
              ?.factCount || 0,

          strongestFactStrength:
            topicProfile
              ?.strongestFactStrength ||
            0,

          numbers:
            topicProfile
              ?.numbers || [],

          citationIds:
            topicProfile
              ?.citationIds || [],

          documentIds:
            topicProfile
              ?.documentIds || [],

          strongestStatement:
            topicProfile
              ?.strongestFact
              ?.statement || null,

          facts:
            topicProfile
              ?.facts || [],
        };
      }
    );

  const entitiesWithEvidence =
    entities.filter(
      (item) =>
        item.hasEvidence
    );

  const entitiesWithoutEvidence =
    entities.filter(
      (item) =>
        !item.hasEvidence
    );

  return {
    topic,

    entityCount:
      entities.length,

    evidenceEntityCount:
      entitiesWithEvidence.length,

    missingEvidenceEntityCount:
      entitiesWithoutEvidence.length,

    complete:
      entitiesWithEvidence.length ===
      entities.length,

    partial:
      entitiesWithEvidence.length > 0 &&
      entitiesWithEvidence.length <
        entities.length,

    absent:
      entitiesWithEvidence.length === 0,

    entities,

    evidenceAvailableFor:
      entitiesWithEvidence.map(
        (item) => item.entity
      ),

    evidenceMissingFor:
      entitiesWithoutEvidence.map(
        (item) => item.entity
      ),

    citationIds:
      uniqueValues(
        entitiesWithEvidence.flatMap(
          (item) =>
            item.citationIds
        )
      ),

    documentIds:
      uniqueValues(
        entitiesWithEvidence.flatMap(
          (item) =>
            item.documentIds
        )
      ),
  };
}

export function buildEntityComparison({
  groupedFacts = {},
  requestedEntities = [],
} = {}) {
  const groupedEntityKeys =
    Object.keys(groupedFacts);

  const requestedEntityKeys =
    requestedEntities
      .map(normalizeEntity)
      .filter(Boolean);

  const entityKeys =
    requestedEntityKeys.length > 0
      ? uniqueValues(
          requestedEntityKeys
        )
      : groupedEntityKeys;

  const entityProfiles =
    entityKeys.reduce(
      (profiles, entityKey) => {
        const existingGroup =
          groupedFacts[
            entityKey
          ];

        profiles[entityKey] =
          buildEntityProfile({
            entityKey,
            entityGroup:
              existingGroup || {
                entity:
                  resolveEntityName(
                    entityKey,
                    groupedFacts
                  ),
                facts: [],
              },
          });

        return profiles;
      },
      {}
    );

  const topics =
    uniqueValues(
      entityKeys.flatMap(
        (entityKey) =>
          Object.keys(
            entityProfiles[
              entityKey
            ]?.topics || {}
          )
      )
    );

  const comparisons =
    topics.reduce(
      (result, topic) => {
        result[topic] =
          buildTopicComparison({
            topic,
            entityKeys,
            entityProfiles,
          });

        return result;
      },
      {}
    );

  const comparableTopics =
    topics.filter(
      (topic) =>
        comparisons[topic]
          .evidenceEntityCount >= 2
    );

  const evidenceGapTopics =
    topics.filter(
      (topic) =>
        comparisons[topic].partial
    );

  return {
    status:
      entityKeys.length < 2
        ? "not_applicable"
        : topics.length === 0
          ? "no_evidence"
          : "ready",

    entities:
      entityKeys.map(
        (entityKey) =>
          entityProfiles[
            entityKey
          ].entity
      ),

    entityKeys,

    entityCount:
      entityKeys.length,

    topicCount:
      topics.length,

    comparableTopicCount:
      comparableTopics.length,

    evidenceGapTopicCount:
      evidenceGapTopics.length,

    comparableTopics,

    evidenceGapTopics,

    entityProfiles,

    comparisons,
  };
}