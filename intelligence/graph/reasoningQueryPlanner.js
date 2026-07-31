const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_PATHS = 25;

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s%-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function normalizePositiveInteger(
  value,
  fallback,
  maximum,
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return fallback;
  }

  return Math.min(
    parsedValue,
    maximum,
  );
}

function getEntityNodes(graph = {}) {
  return normalizeArray(
    graph.entityNodes ??
    graph.entities,
  );
}

function getObjectNodes(graph = {}) {
  return normalizeArray(
    graph.objectNodes ??
    graph.objects,
  );
}

function getGraphEdges(graph = {}) {
  return normalizeArray(
    graph.edges ??
    graph.relationshipEdges ??
    graph.relationships,
  );
}

function getNodeId(node = {}) {
  return normalizeText(
    node.nodeId ??
    node.entityId ??
    node.objectNodeId ??
    node.id,
  );
}

function getNodeLabels(node = {}) {
  const labels = [
    node.canonicalName,
    node.name,
    node.value,
    node.objectKey,
    node.canonicalKey,
  ];

  if (Array.isArray(node.aliases)) {
    labels.push(...node.aliases);
  }

  return [
    ...new Set(
      labels
        .map(normalizeText)
        .filter(Boolean),
    ),
  ];
}

function tokenize(value) {
  return normalizeKey(value)
    .split(" ")
    .filter(
      (token) =>
        token.length > 1,
    );
}

function calculateLabelScore(
  question,
  label,
) {
  const normalizedQuestion =
    normalizeKey(question);

  const normalizedLabel =
    normalizeKey(label);

  if (
    !normalizedQuestion ||
    !normalizedLabel
  ) {
    return 0;
  }

  if (
    normalizedQuestion ===
    normalizedLabel
  ) {
    return 1;
  }

  if (
    normalizedQuestion.includes(
      normalizedLabel,
    )
  ) {
    return 0.95;
  }

  const questionTokens =
    new Set(
      tokenize(
        normalizedQuestion,
      ),
    );

  const labelTokens =
    tokenize(
      normalizedLabel,
    );

  if (labelTokens.length === 0) {
    return 0;
  }

  const matchedTokenCount =
    labelTokens.filter(
      (token) =>
        questionTokens.has(token),
    ).length;

  const coverage =
    matchedTokenCount /
    labelTokens.length;

  const questionCoverage =
    questionTokens.size > 0
      ? matchedTokenCount /
        questionTokens.size
      : 0;

  return Number(
    (
      coverage * 0.8 +
      questionCoverage * 0.2
    ).toFixed(6),
  );
}

function rankGraphNodes(
  question,
  nodes = [],
) {
  return normalizeArray(nodes)
    .map((node) => {
      const labels =
        getNodeLabels(node);

      const labelScores =
        labels.map(
          (label) => ({
            label,
            score:
              calculateLabelScore(
                question,
                label,
              ),
          }),
        );

      labelScores.sort(
        (
          first,
          second,
        ) =>
          second.score -
          first.score,
      );

      const bestMatch =
        labelScores[0] ?? {
          label: null,
          score: 0,
        };

      return {
        node,
        nodeId:
          getNodeId(node),

        matchedLabel:
          bestMatch.label,

        score:
          bestMatch.score,
      };
    })
    .filter(
      (candidate) =>
        candidate.nodeId &&
        candidate.score > 0,
    )
    .sort(
      (
        first,
        second,
      ) =>
        second.score -
          first.score ||
        first.nodeId.localeCompare(
          second.nodeId,
        ),
    );
}

function determineReachableTargets(
  graph,
  startNodeId,
) {
  const targets = new Set();

  for (
    const edge
    of getGraphEdges(graph)
  ) {
    const fromNodeId =
      normalizeText(
        edge.fromNodeId ??
        edge.subjectEntityId,
      );

    const toNodeId =
      normalizeText(
        edge.toNodeId ??
        edge.objectEntityId ??
        edge.targetEntityId,
      );

    if (
      fromNodeId ===
        startNodeId &&
      toNodeId
    ) {
      targets.add(toNodeId);
    }
  }

  return targets;
}

function selectStartCandidate(
  rankedEntities = [],
  minimumScore = 0.45,
) {
  return (
    rankedEntities.find(
      (candidate) =>
        candidate.score >=
        minimumScore,
    ) ?? null
  );
}

function selectTargetCandidate({
  rankedEntities = [],
  rankedObjects = [],
  startNodeId,
  reachableTargets,
  minimumScore = 0.35,
}) {
  const candidates = [
    ...rankedEntities,
    ...rankedObjects,
  ]
    .filter(
      (candidate) =>
        candidate.nodeId !==
        startNodeId,
    )
    .map((candidate) => ({
      ...candidate,

      reachable:
        reachableTargets.has(
          candidate.nodeId,
        ),
    }))
    .sort(
      (
        first,
        second,
      ) =>
        Number(second.reachable) -
          Number(first.reachable) ||
        second.score -
          first.score ||
        first.nodeId.localeCompare(
          second.nodeId,
        ),
    );

  return (
    candidates.find(
      (candidate) =>
        candidate.score >=
        minimumScore,
    ) ?? null
  );
}

function createUnresolvedResult({
  question,
  reason,
  rankedEntities,
  rankedObjects,
}) {
  return {
    status: "unresolved",

    reason,

    question,

    reasoningQuery: null,

    candidates: {
      entities:
        rankedEntities.slice(0, 5),

      objects:
        rankedObjects.slice(0, 5),
    },
  };
}

function planReasoningQuery({
  question = "",
  graph = {},
  options = {},
} = {}) {
  const normalizedQuestion =
    normalizeText(question);

  if (!normalizedQuestion) {
    throw new TypeError(
      "Reasoning query planner requires a question.",
    );
  }

  const entityNodes =
    getEntityNodes(graph);

  const objectNodes =
    getObjectNodes(graph);

  if (
    entityNodes.length === 0 &&
    objectNodes.length === 0
  ) {
    return createUnresolvedResult({
      question:
        normalizedQuestion,

      reason:
        "reasoning_graph_empty",

      rankedEntities: [],
      rankedObjects: [],
    });
  }

  const rankedEntities =
    rankGraphNodes(
      normalizedQuestion,
      entityNodes,
    );

  const rankedObjects =
    rankGraphNodes(
      normalizedQuestion,
      objectNodes,
    );

  const startCandidate =
    selectStartCandidate(
      rankedEntities,
      options.minimumStartScore ??
        0.45,
    );

  if (!startCandidate) {
    return createUnresolvedResult({
      question:
        normalizedQuestion,

      reason:
        "start_node_not_resolved",

      rankedEntities,
      rankedObjects,
    });
  }

  const reachableTargets =
    determineReachableTargets(
      graph,
      startCandidate.nodeId,
    );

  const targetCandidate =
    selectTargetCandidate({
      rankedEntities,
      rankedObjects,

      startNodeId:
        startCandidate.nodeId,

      reachableTargets,

      minimumScore:
        options.minimumTargetScore ??
        0.35,
    });

  if (!targetCandidate) {
    return createUnresolvedResult({
      question:
        normalizedQuestion,

      reason:
        "target_node_not_resolved",

      rankedEntities,
      rankedObjects,
    });
  }

  const reasoningQuery = {
    startNodeId:
      startCandidate.nodeId,

    targetNodeId:
      targetCandidate.nodeId,

    maxDepth:
      normalizePositiveInteger(
        options.maxDepth,
        DEFAULT_MAX_DEPTH,
        10,
      ),

    maxPaths:
      normalizePositiveInteger(
        options.maxPaths,
        DEFAULT_MAX_PATHS,
        250,
      ),

    predicates:
      normalizeArray(
        options.predicates,
      ),

    entityRelationshipsOnly:
      options
        .entityRelationshipsOnly ===
      true,

    minimumConfidence:
      Number.isFinite(
        Number(
          options.minimumConfidence,
        ),
      )
        ? Math.min(
            1,
            Math.max(
              0,
              Number(
                options.minimumConfidence,
              ),
            ),
          )
        : 0,
  };

  return {
    status: "resolved",

    question:
      normalizedQuestion,

    reasoningQuery,

    resolution: {
      startNode: {
        nodeId:
          startCandidate.nodeId,

        matchedLabel:
          startCandidate
            .matchedLabel,

        score:
          startCandidate.score,
      },

      targetNode: {
        nodeId:
          targetCandidate.nodeId,

        matchedLabel:
          targetCandidate
            .matchedLabel,

        score:
          targetCandidate.score,

        directlyReachable:
          targetCandidate
            .reachable,
      },
    },

    candidates: {
      entities:
        rankedEntities.slice(0, 5),

      objects:
        rankedObjects.slice(0, 5),
    },
  };
}

export {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_PATHS,

  normalizeText,
  normalizeKey,

  getEntityNodes,
  getObjectNodes,
  getGraphEdges,

  getNodeId,
  getNodeLabels,

  calculateLabelScore,
  rankGraphNodes,

  determineReachableTargets,

  planReasoningQuery,
};

export default planReasoningQuery;