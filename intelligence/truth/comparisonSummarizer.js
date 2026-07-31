function normalizeText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueValues(values = []) {
  return [
    ...new Set(
      values.filter(Boolean)
    ),
  ];
}

function formatTopicLabel(topic = "") {
  return normalizeText(topic)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function selectStatements(
  entity = {},
  limit = 2
) {
  return uniqueValues(
    (entity.facts || [])
      .map((fact) =>
        normalizeText(
          fact.statement
        )
      )
      .filter(Boolean)
  ).slice(0, limit);
}

function selectNumbers(
  entity = {},
  limit = 8
) {
  return uniqueValues(
    entity.numbers || []
  ).slice(0, limit);
}

function buildEntitySummary(
  entity = {}
) {
  return {
    entity:
      entity.entity ||
      entity.entityKey ||
      "Unknown",

    entityKey:
      entity.entityKey ||
      "",

    hasEvidence:
      Boolean(
        entity.hasEvidence
      ),

    factCount:
      Number(
        entity.factCount || 0
      ),

    strongestFactStrength:
      Number(
        entity.strongestFactStrength ||
        0
      ),

    statements:
      selectStatements(entity),

    numbers:
      selectNumbers(entity),

    citationIds:
      uniqueValues(
        entity.citationIds || []
      ),

    documentIds:
      uniqueValues(
        entity.documentIds || []
      ),
  };
}

function buildComparisonStatus(
  comparison = {}
) {
  if (comparison.absent) {
    return {
      code: "no_evidence",
      label: "No Evidence",
    };
  }

  if (comparison.complete) {
    return {
      code: "comparable",
      label: "Comparable Evidence",
    };
  }

  if (comparison.partial) {
    return {
      code: "evidence_gap",
      label: "Evidence Gap",
    };
  }

  return {
    code: "unknown",
    label: "Unknown",
  };
}

function buildComparisonInstruction({
  topic,
  status,
  entities,
}) {
  const topicLabel =
    formatTopicLabel(topic);

  if (
    status.code ===
    "comparable"
  ) {
    return (
      `Compare the available ${topicLabel} evidence ` +
      `for ${entities
        .map(
          (item) => item.entity
        )
        .join(" and ")}. ` +
      "State similarities or differences only when supported by the supplied facts."
    );
  }

  if (
    status.code ===
    "evidence_gap"
  ) {
    const available =
      entities
        .filter(
          (item) =>
            item.hasEvidence
        )
        .map(
          (item) =>
            item.entity
        );

    const missing =
      entities
        .filter(
          (item) =>
            !item.hasEvidence
        )
        .map(
          (item) =>
            item.entity
        );

    return (
      `${topicLabel} evidence is available for ` +
      `${available.join(", ") || "none"}, ` +
      `but not for ${missing.join(", ") || "none"}. ` +
      "Describe this as an evidence gap. Do not claim that the missing entity has no policy, target, plan, or activity."
    );
  }

  return (
    `No usable ${topicLabel} evidence was found. ` +
    "Do not produce a substantive comparison for this topic."
  );
}

function buildTopicSummary(
  topic,
  comparison = {}
) {
  const entities =
    (comparison.entities || [])
      .map(
        buildEntitySummary
      );

  const status =
    buildComparisonStatus(
      comparison
    );

  return {
    topic,

    topicLabel:
      formatTopicLabel(topic),

    status,

    complete:
      Boolean(
        comparison.complete
      ),

    partial:
      Boolean(
        comparison.partial
      ),

    absent:
      Boolean(
        comparison.absent
      ),

    entities,

    evidenceAvailableFor:
      comparison
        .evidenceAvailableFor ||
      [],

    evidenceMissingFor:
      comparison
        .evidenceMissingFor ||
      [],

    citationIds:
      uniqueValues(
        comparison.citationIds ||
        []
      ),

    documentIds:
      uniqueValues(
        comparison.documentIds ||
        []
      ),

    instruction:
      buildComparisonInstruction({
        topic,
        status,
        entities,
      }),
  };
}

function buildNarrativeRules() {
  return [
    "Use only the structured facts supplied in the comparison summary.",
    "Do not treat missing retrieved evidence as proof that a policy, target, or initiative does not exist.",
    "For evidence gaps, use language such as 'the selected evidence does not provide' or 'no comparable detail was found in the available evidence'.",
    "Attach the supplied citation IDs to factual claims whenever possible.",
    "Do not invent numeric targets, dates, capacities, investment values, or policy names.",
    "Separate direct facts from analytical conclusions.",
    "Use 'comparable evidence' only when at least two entities have topic-level evidence.",
    "Keep conclusions proportional to the strength and completeness of the evidence.",
  ];
}

export function summarizeEntityComparison(
  comparisonResult = {}
) {
  const comparisons =
    comparisonResult
      .comparisons || {};

  const topicSummaries =
    Object.entries(
      comparisons
    ).reduce(
      (
        result,
        [topic, comparison]
      ) => {
        result[topic] =
          buildTopicSummary(
            topic,
            comparison
          );

        return result;
      },
      {}
    );

  const topics =
    Object.keys(
      topicSummaries
    );

  const comparableTopics =
    topics.filter(
      (topic) =>
        topicSummaries[topic]
          .status.code ===
        "comparable"
    );

  const evidenceGapTopics =
    topics.filter(
      (topic) =>
        topicSummaries[topic]
          .status.code ===
        "evidence_gap"
    );

  const noEvidenceTopics =
    topics.filter(
      (topic) =>
        topicSummaries[topic]
          .status.code ===
        "no_evidence"
    );

  return {
    status:
      comparisonResult.status ||
      "not_applicable",

    entities:
      comparisonResult.entities ||
      [],

    entityCount:
      Number(
        comparisonResult
          .entityCount || 0
      ),

    topicCount:
      topics.length,

    comparableTopicCount:
      comparableTopics.length,

    evidenceGapTopicCount:
      evidenceGapTopics.length,

    noEvidenceTopicCount:
      noEvidenceTopics.length,

    comparableTopics,

    evidenceGapTopics,

    noEvidenceTopics,

    narrativeRules:
      buildNarrativeRules(),

    topics:
      topicSummaries,
  };
}

export function buildComparisonPromptContext(
  comparisonSummary = {}
) {
  if (
    !comparisonSummary ||
    comparisonSummary.status !==
      "ready"
  ) {
    return "";
  }

  const compactTopics =
    Object.values(
      comparisonSummary.topics ||
      {}
    ).map(
      (topic) => ({
        topic:
          topic.topicLabel,

        status:
          topic.status.label,

        entities:
          topic.entities.map(
            (entity) => ({
              entity:
                entity.entity,

              hasEvidence:
                entity.hasEvidence,

              statements:
                entity.statements,

              numbers:
                entity.numbers,

              citationIds:
                entity.citationIds,
            })
          ),

        evidenceMissingFor:
          topic.evidenceMissingFor,

        instruction:
          topic.instruction,
      })
    );

  return [
    "STRUCTURED ENTITY COMPARISON",
    JSON.stringify(
      {
        entities:
          comparisonSummary.entities,

        rules:
          comparisonSummary
            .narrativeRules,

        topics:
          compactTopics,
      },
      null,
      2
    ),
  ].join("\n\n");
}