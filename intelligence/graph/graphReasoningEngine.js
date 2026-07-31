import {
  traverseOneHop,
  traversePredicate,
  getTraversalEvidence,
} from "./knowledgeGraphTraversalEngine.js";

import {
  getGraphEntityNode,
  normalizeGraphKey,
} from "./knowledgeGraphStore.js";

/**
 * Safely convert any value into a finite number.
 */
function toFiniteNumber(
  value,
  fallback = 0,
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

/**
 * Restrict a number to a range.
 */
function clamp(
  value,
  minimum = 0,
  maximum = 1,
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      toFiniteNumber(
        value,
        minimum,
      ),
    ),
  );
}

/**
 * Normalize a result limit.
 */
function normalizeLimit(
  value,
  fallback = 10,
  maximum = 100,
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 1
  ) {
    return fallback;
  }

  return Math.min(
    number,
    maximum,
  );
}

/**
 * Normalize a string for comparison.
 */
function normalizeText(
  value,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " ",
    );
}

/**
 * Split text into searchable terms.
 */
function tokenizeText(
  value,
) {
  return normalizeText(
    value,
  )
    .replace(
      /[^a-z0-9%$€£.\- ]/g,
      " ",
    )
    .split(
      /\s+/,
    )
    .map((token) =>
      token.trim(),
    )
    .filter(
      (token) =>
        token.length > 1,
    );
}

/**
 * Return unique primitive values.
 */
function uniqueValues(
  values,
) {
  return Array.from(
    new Set(
      values.filter(
        (value) =>
          value !== null &&
          value !== undefined &&
          value !== "",
      ),
    ),
  );
}

/**
 * Calculate average.
 */
function average(
  values,
) {
  const validValues =
    values
      .map((value) =>
        toFiniteNumber(
          value,
          NaN,
        ),
      )
      .filter(
        Number.isFinite,
      );

  if (
    validValues.length === 0
  ) {
    return 0;
  }

  return (
    validValues.reduce(
      (
        total,
        value,
      ) =>
        total + value,
      0,
    ) /
    validValues.length
  );
}

/**
 * Calculate minimum.
 */
function minimum(
  values,
) {
  const validValues =
    values
      .map((value) =>
        toFiniteNumber(
          value,
          NaN,
        ),
      )
      .filter(
        Number.isFinite,
      );

  if (
    validValues.length === 0
  ) {
    return 0;
  }

  return Math.min(
    ...validValues,
  );
}

/**
 * Safely clone structured values.
 */
function cloneStructuredValue(
  structuredValue,
) {
  if (
    !structuredValue ||
    typeof structuredValue !==
      "object"
  ) {
    return null;
  }

  return {
    ...structuredValue,

    allYears:
      Array.isArray(
        structuredValue.allYears,
      )
        ? [
            ...structuredValue.allYears,
          ]
        : [],
  };
}

/**
 * Safely clone provenance.
 */
function cloneProvenance(
  provenance,
) {
  if (
    !Array.isArray(
      provenance,
    )
  ) {
    return [];
  }

  return provenance.map(
    (item) => ({
      ...item,

      contextPath:
        Array.isArray(
          item?.contextPath,
        )
          ? [
              ...item.contextPath,
            ]
          : [],
    }),
  );
}

/**
 * Safely clone an edge.
 */
function cloneReasoningEdge(
  edge,
) {
  if (
    !edge ||
    typeof edge !== "object"
  ) {
    return null;
  }

  return {
    ...edge,

    structuredValue:
      cloneStructuredValue(
        edge.structuredValue,
      ),

    confidenceValues:
      Array.isArray(
        edge.confidenceValues,
      )
        ? [
            ...edge.confidenceValues,
          ]
        : [],

    provenance:
      cloneProvenance(
        edge.provenance,
      ),
  };
}

/**
 * Measure token overlap between a query and graph text.
 */
function calculateTextRelevance(
  query,
  text,
) {
  const queryTokens =
    uniqueValues(
      tokenizeText(
        query,
      ),
    );

  const textTokens =
    new Set(
      tokenizeText(
        text,
      ),
    );

  if (
    queryTokens.length === 0
  ) {
    return 1;
  }

  const matchedTokens =
    queryTokens.filter(
      (token) =>
        textTokens.has(
          token,
        ),
    );

  return clamp(
    matchedTokens.length /
      queryTokens.length,
  );
}

/**
 * Build searchable text for an edge.
 */
function buildEdgeSearchText(
  edge,
) {
  const provenanceText =
    cloneProvenance(
      edge?.provenance,
    )
      .flatMap(
        (item) => [
          item.originalBlockText,
          item.contextualSentence,
          item.clause,
          Array.isArray(
            item.contextPath,
          )
            ? item.contextPath.join(
                " ",
              )
            : "",
        ],
      )
      .join(
        " ",
      );

  return [
    edge?.subject,
    edge?.canonicalSubject,
    edge?.predicate,
    edge?.object,
    edge?.structuredValue?.metric,
    edge?.structuredValue?.raw,
    provenanceText,
  ]
    .filter(Boolean)
    .join(
      " ",
    );
}

/**
 * Score one edge against a reasoning query.
 */
function scoreReasoningEdge(
  edge,
  query = "",
  options = {},
) {
  const confidence =
    clamp(
      edge?.averageConfidence,
    );

  const relevance =
    calculateTextRelevance(
      query,
      buildEdgeSearchText(
        edge,
      ),
    );

  const occurrenceCount =
    Math.max(
      1,
      toFiniteNumber(
        edge?.occurrenceCount,
        1,
      ),
    );

  const occurrenceScore =
    clamp(
      occurrenceCount / 3,
    );

  const provenanceCount =
    Array.isArray(
      edge?.provenance,
    )
      ? edge.provenance.length
      : 0;

  const provenanceScore =
    clamp(
      provenanceCount / 2,
    );

  const confidenceWeight =
    clamp(
      options.confidenceWeight ??
        0.45,
    );

  const relevanceWeight =
    clamp(
      options.relevanceWeight ??
        0.35,
    );

  const occurrenceWeight =
    clamp(
      options.occurrenceWeight ??
        0.1,
    );

  const provenanceWeight =
    clamp(
      options.provenanceWeight ??
        0.1,
    );

  const totalWeight =
    confidenceWeight +
    relevanceWeight +
    occurrenceWeight +
    provenanceWeight;

  const normalizedScore =
    totalWeight > 0
      ? (
          confidence *
            confidenceWeight +
          relevance *
            relevanceWeight +
          occurrenceScore *
            occurrenceWeight +
          provenanceScore *
            provenanceWeight
        ) /
        totalWeight
      : 0;

  return {
    confidence:
      Number(
        confidence.toFixed(
          6,
        ),
      ),

    relevance:
      Number(
        relevance.toFixed(
          6,
        ),
      ),

    occurrenceScore:
      Number(
        occurrenceScore.toFixed(
          6,
        ),
      ),

    provenanceScore:
      Number(
        provenanceScore.toFixed(
          6,
        ),
      ),

    totalScore:
      Number(
        clamp(
          normalizedScore,
        ).toFixed(
          6,
        ),
      ),
  };
}

/**
 * Convert one edge into an evidence-backed fact.
 */
function createReasoningFact(
  edge,
  query = "",
  options = {},
) {
  const clonedEdge =
    cloneReasoningEdge(
      edge,
    );

  if (!clonedEdge) {
    return null;
  }

  const score =
    scoreReasoningEdge(
      clonedEdge,
      query,
      options,
    );

  const bestProvenance =
    clonedEdge.provenance
      .slice()
      .sort(
        (
          first,
          second,
        ) =>
          toFiniteNumber(
            second?.confidence,
          ) -
          toFiniteNumber(
            first?.confidence,
          ),
      )[0] ?? null;

  return {
    factId:
      clonedEdge.relationshipId,

    relationshipId:
      clonedEdge.relationshipId,

    subject:
      clonedEdge.subject,

    canonicalSubject:
      clonedEdge.canonicalSubject,

    predicate:
      clonedEdge.predicate,

    object:
      clonedEdge.object,

    statement:
      bestProvenance
        ?.contextualSentence ??
      bestProvenance?.clause ??
      `${clonedEdge.subject} ${clonedEdge.predicate} ${clonedEdge.object}.`,

    structuredValue:
      cloneStructuredValue(
        clonedEdge.structuredValue,
      ),

    confidence:
      score.confidence,

    relevance:
      score.relevance,

    reasoningScore:
      score.totalScore,

    occurrenceCount:
      clonedEdge.occurrenceCount,

    evidenceCount:
      clonedEdge.provenance.length,

    provenance:
      cloneProvenance(
        clonedEdge.provenance,
      ),

    scoreBreakdown:
      score,
  };
}

/**
 * Group facts by predicate.
 */
function groupFactsByPredicate(
  facts,
) {
  const groups =
    new Map();

  for (
    const fact
    of facts
  ) {
    const key =
      normalizeGraphKey(
        fact.predicate,
      ) || "unknown";

    if (
      !groups.has(
        key,
      )
    ) {
      groups.set(
        key,
        {
          predicate:
            fact.predicate,
          normalizedPredicate:
            key,
          facts: [],
        },
      );
    }

    groups
      .get(
        key,
      )
      .facts.push(
        fact,
      );
  }

  return Array.from(
    groups.values(),
  ).map(
    (group) => ({
      ...group,

      factCount:
        group.facts.length,

      averageConfidence:
        Number(
          average(
            group.facts.map(
              (fact) =>
                fact.confidence,
            ),
          ).toFixed(
            6,
          ),
        ),

      averageReasoningScore:
        Number(
          average(
            group.facts.map(
              (fact) =>
                fact.reasoningScore,
            ),
          ).toFixed(
            6,
          ),
        ),
    }),
  );
}

/**
 * Detect potentially conflicting structured facts.
 *
 * This is conservative. It only marks facts as potentially conflicting
 * when they share a predicate and metric but contain different numeric
 * values for an overlapping or identical time reference.
 */
function detectStructuredConflicts(
  facts,
) {
  const conflicts = [];

  for (
    let firstIndex = 0;
    firstIndex <
    facts.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex =
        firstIndex + 1;
      secondIndex <
      facts.length;
      secondIndex += 1
    ) {
      const first =
        facts[firstIndex];

      const second =
        facts[secondIndex];

      if (
        normalizeGraphKey(
          first.predicate,
        ) !==
        normalizeGraphKey(
          second.predicate,
        )
      ) {
        continue;
      }

      const firstValue =
        first.structuredValue;

      const secondValue =
        second.structuredValue;

      if (
        !firstValue ||
        !secondValue
      ) {
        continue;
      }

      const firstMetric =
        normalizeText(
          firstValue.metric,
        );

      const secondMetric =
        normalizeText(
          secondValue.metric,
        );

      if (
        !firstMetric ||
        !secondMetric ||
        firstMetric !==
          secondMetric
      ) {
        continue;
      }

      const firstNumber =
        toFiniteNumber(
          firstValue.normalizedAmount ??
            firstValue.number,
          NaN,
        );

      const secondNumber =
        toFiniteNumber(
          secondValue.normalizedAmount ??
            secondValue.number,
          NaN,
        );

      if (
        !Number.isFinite(
          firstNumber,
        ) ||
        !Number.isFinite(
          secondNumber,
        ) ||
        firstNumber ===
          secondNumber
      ) {
        continue;
      }

      const firstYears =
        uniqueValues([
          firstValue.year,
          ...(Array.isArray(
            firstValue.allYears,
          )
            ? firstValue.allYears
            : []),
        ]);

      const secondYears =
        uniqueValues([
          secondValue.year,
          ...(Array.isArray(
            secondValue.allYears,
          )
            ? secondValue.allYears
            : []),
        ]);

      const overlappingYears =
        firstYears.filter(
          (year) =>
            secondYears.includes(
              year,
            ),
        );

      const sameTemporalScope =
        overlappingYears.length >
          0 ||
        (
          firstYears.length ===
            0 &&
          secondYears.length ===
            0
        );

      if (
        !sameTemporalScope
      ) {
        continue;
      }

      conflicts.push({
        conflictId:
          `${first.factId}::${second.factId}`,

        type:
          "structured_value_conflict",

        severity:
          "potential",

        predicate:
          first.predicate,

        metric:
          firstValue.metric,

        firstFactId:
          first.factId,

        secondFactId:
          second.factId,

        firstValue:
          firstValue,

        secondValue:
          secondValue,

        overlappingYears,

        explanation:
          `Potentially conflicting values were found for ${firstValue.metric}.`,
      });
    }
  }

  return conflicts;
}

/**
 * Produce an overall reasoning confidence.
 */
function calculateReasoningConfidence(
  facts,
  conflicts = [],
) {
  if (
    !Array.isArray(
      facts,
    ) ||
    facts.length === 0
  ) {
    return {
      confidence: 0,
      label: "insufficient",
      breakdown: {
        averageFactConfidence: 0,
        minimumFactConfidence: 0,
        evidenceCoverage: 0,
        conflictPenalty: 0,
      },
    };
  }

  const averageFactConfidence =
    average(
      facts.map(
        (fact) =>
          fact.confidence,
      ),
    );

  const minimumFactConfidence =
    minimum(
      facts.map(
        (fact) =>
          fact.confidence,
      ),
    );

  const evidenceCoverage =
    clamp(
      facts.filter(
        (fact) =>
          fact.evidenceCount > 0,
      ).length /
        facts.length,
    );

  const conflictPenalty =
    clamp(
      conflicts.length /
        Math.max(
          1,
          facts.length,
        ),
    ) * 0.35;

  const confidence =
    clamp(
      (
        averageFactConfidence *
          0.55 +
        minimumFactConfidence *
          0.2 +
        evidenceCoverage *
          0.25
      ) -
        conflictPenalty,
    );

  let label =
    "low";

  if (
    confidence >= 0.85
  ) {
    label = "high";
  } else if (
    confidence >= 0.65
  ) {
    label = "moderate";
  } else if (
    confidence < 0.35
  ) {
    label = "insufficient";
  }

  return {
    confidence:
      Number(
        confidence.toFixed(
          6,
        ),
      ),

    label,

    breakdown: {
      averageFactConfidence:
        Number(
          averageFactConfidence.toFixed(
            6,
          ),
        ),

      minimumFactConfidence:
        Number(
          minimumFactConfidence.toFixed(
            6,
          ),
        ),

      evidenceCoverage:
        Number(
          evidenceCoverage.toFixed(
            6,
          ),
        ),

      conflictPenalty:
        Number(
          conflictPenalty.toFixed(
            6,
          ),
        ),
    },
  };
}

/**
 * Generate an extractive explanation from graph facts.
 *
 * No LLM is used here. The explanation is grounded entirely in the
 * statements already stored in graph provenance.
 */
function generateReasoningExplanation(
  entity,
  facts,
  options = {},
) {
  if (
    !entity ||
    facts.length === 0
  ) {
    return "";
  }

  const maximumStatements =
    normalizeLimit(
      options.maximumStatements,
      5,
      20,
    );

  const selectedFacts =
    facts.slice(
      0,
      maximumStatements,
    );

  if (
    selectedFacts.length === 1
  ) {
    return selectedFacts[0]
      .statement;
  }

  const entityName =
    entity.canonicalName ??
    entity.entityId ??
    "The entity";

  const statements =
    selectedFacts.map(
      (fact) =>
        fact.statement
          .replace(
            /\.$/,
            "",
          )
          .trim(),
    );

  return (
    `${entityName} is connected to ${selectedFacts.length} relevant graph facts. ` +
    statements
      .map(
        (
          statement,
          index,
        ) =>
          `${index + 1}. ${statement}.`,
      )
      .join(
        " ",
      )
  );
}

/**
 * Reason over all direct facts connected to an entity.
 */
export function reasonAboutEntity(
  entityId,
  options = {},
) {
  const entity =
    getGraphEntityNode(
      entityId,
    );

  if (!entity) {
    return {
      found: false,
      entityId,
      entity: null,
      query:
        options.query ?? "",
      facts: [],
      predicateGroups: [],
      conflicts: [],
      explanation: "",
      confidence: {
        confidence: 0,
        label:
          "insufficient",
        breakdown: {
          averageFactConfidence: 0,
          minimumFactConfidence: 0,
          evidenceCoverage: 0,
          conflictPenalty: 0,
        },
      },
      factCount: 0,
    };
  }

  const query =
    String(
      options.query ?? "",
    ).trim();

  const traversal =
    traverseOneHop(
      entityId,
      {
        predicate:
          options.predicate,

        objectSearch:
          options.objectSearch,

        minimumConfidence:
          options.minimumConfidence,
      },
    );

  const limit =
    normalizeLimit(
      options.limit,
      10,
      100,
    );

  const minimumReasoningScore =
    clamp(
      options.minimumReasoningScore ??
        0,
    );

  const facts =
    traversal.paths
      .flatMap(
        (path) =>
          path.edges,
      )
      .map(
        (edge) =>
          createReasoningFact(
            edge,
            query,
            options,
          ),
      )
      .filter(Boolean)
      .filter(
        (fact) =>
          fact.reasoningScore >=
          minimumReasoningScore,
      )
      .sort(
        (
          first,
          second,
        ) =>
          second.reasoningScore -
            first.reasoningScore ||
          second.confidence -
            first.confidence ||
          String(
            first.relationshipId,
          ).localeCompare(
            String(
              second.relationshipId,
            ),
          ),
      )
      .slice(
        0,
        limit,
      );

  const predicateGroups =
    groupFactsByPredicate(
      facts,
    );

  const conflicts =
    detectStructuredConflicts(
      facts,
    );

  const confidence =
    calculateReasoningConfidence(
      facts,
      conflicts,
    );

  const explanation =
    generateReasoningExplanation(
      entity,
      facts,
      options,
    );

  return {
    found: true,
    entityId,
    entity,
    query,
    facts,
    predicateGroups,
    conflicts,
    explanation,
    confidence,
    factCount:
      facts.length,
  };
}

/**
 * Reason over a requested predicate across the graph.
 */
export function reasonByPredicate(
  predicate,
  options = {},
) {
  const query =
    String(
      options.query ??
        predicate ??
        "",
    ).trim();

  const traversal =
    traversePredicate(
      predicate,
      {
        objectSearch:
          options.objectSearch,

        minimumConfidence:
          options.minimumConfidence,
      },
    );

  const limit =
    normalizeLimit(
      options.limit,
      25,
      100,
    );

  const facts =
    traversal.paths
      .flatMap(
        (path) =>
          path.edges,
      )
      .map(
        (edge) =>
          createReasoningFact(
            edge,
            query,
            options,
          ),
      )
      .filter(Boolean)
      .sort(
        (
          first,
          second,
        ) =>
          second.reasoningScore -
            first.reasoningScore ||
          second.confidence -
            first.confidence,
      )
      .slice(
        0,
        limit,
      );

  const conflicts =
    detectStructuredConflicts(
      facts,
    );

  const confidence =
    calculateReasoningConfidence(
      facts,
      conflicts,
    );

  return {
    predicate,
    normalizedPredicate:
      normalizeGraphKey(
        predicate,
      ),
    query,
    facts,
    conflicts,
    confidence,
    factCount:
      facts.length,
  };
}

/**
 * Build a citation-ready evidence package for an entity.
 */
export function buildReasoningEvidencePackage(
  entityId,
  options = {},
) {
  const reasoning =
    reasonAboutEntity(
      entityId,
      options,
    );

  if (
    !reasoning.found
  ) {
    return {
      found: false,
      entityId,
      claims: [],
      citations: [],
      claimCount: 0,
      citationCount: 0,
    };
  }

  const claims =
    reasoning.facts.map(
      (
        fact,
        index,
      ) => ({
        claimId:
          `CLAIM_${String(
            index + 1,
          ).padStart(
            6,
            "0",
          )}`,

        relationshipId:
          fact.relationshipId,

        statement:
          fact.statement,

        subject:
          fact.subject,

        predicate:
          fact.predicate,

        object:
          fact.object,

        confidence:
          fact.confidence,

        reasoningScore:
          fact.reasoningScore,

        citationIds:
          fact.provenance.map(
            (
              _item,
              provenanceIndex,
            ) =>
              `CITATION_${String(
                index + 1,
              ).padStart(
                4,
                "0",
              )}_${String(
                provenanceIndex + 1,
              ).padStart(
                3,
                "0",
              )}`,
          ),
      }),
    );

  const citations =
    reasoning.facts.flatMap(
      (
        fact,
        factIndex,
      ) =>
        fact.provenance.map(
          (
            provenance,
            provenanceIndex,
          ) => ({
            citationId:
              `CITATION_${String(
                factIndex + 1,
              ).padStart(
                4,
                "0",
              )}_${String(
                provenanceIndex + 1,
              ).padStart(
                3,
                "0",
              )}`,

            relationshipId:
              fact.relationshipId,

            sourceDocumentId:
              provenance.sourceDocumentId ??
              null,

            sourceChunkId:
              provenance.sourceChunkId ??
              null,

            sourceLine:
              provenance.sourceLine ??
              null,

            contextPath:
              Array.isArray(
                provenance.contextPath,
              )
                ? [
                    ...provenance.contextPath,
                  ]
                : [],

            originalBlockText:
              provenance.originalBlockText ??
              null,

            contextualSentence:
              provenance.contextualSentence ??
              null,

            clause:
              provenance.clause ??
              null,

            confidence:
              toFiniteNumber(
                provenance.confidence,
                fact.confidence,
              ),
          }),
        ),
    );

  return {
    found: true,
    entityId,
    entity:
      reasoning.entity,
    query:
      reasoning.query,
    claims,
    citations,
    conflicts:
      reasoning.conflicts,
    confidence:
      reasoning.confidence,
    explanation:
      reasoning.explanation,
    claimCount:
      claims.length,
    citationCount:
      citations.length,
  };
}

/**
 * Return raw traversal evidence together with reasoning output.
 */
export function getEntityReasoningTrace(
  entityId,
  options = {},
) {
  const reasoning =
    reasonAboutEntity(
      entityId,
      options,
    );

  const traversalEvidence =
    getTraversalEvidence(
      entityId,
      {
        predicate:
          options.predicate,

        objectSearch:
          options.objectSearch,

        minimumConfidence:
          options.minimumConfidence,
      },
    );

  return {
    found:
      reasoning.found,

    entityId,

    query:
      reasoning.query,

    reasoning,

    traversalEvidence:
      traversalEvidence.evidence ??
      [],

    traceSummary: {
      factCount:
        reasoning.factCount ??
        0,

      evidenceCount:
        traversalEvidence
          .evidenceCount ??
        0,

      conflictCount:
        reasoning.conflicts
          ?.length ?? 0,

      confidence:
        reasoning.confidence
          ?.confidence ?? 0,

      confidenceLabel:
        reasoning.confidence
          ?.label ??
        "insufficient",
    },
  };
}

export {
  scoreReasoningEdge,
  createReasoningFact,
  groupFactsByPredicate,
  detectStructuredConflicts,
  calculateReasoningConfidence,
  generateReasoningExplanation,
};