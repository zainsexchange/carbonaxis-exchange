/**
 * Carbon Brain
 * Multi-Hop Reasoning Engine
 *
 * Stage 1:
 * - Input normalization
 * - Graph structure normalization
 * - Node and edge lookup
 * - Adjacency index creation
 * - Cycle-safe path state helpers
 *
 * This module does not mutate the graph.
 */

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_PATHS = 25;
const MAX_ALLOWED_DEPTH = 10;
const MAX_ALLOWED_PATHS = 250;

/**
 * Normalize text without changing its original case.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Normalize text for deterministic comparisons.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeKey(value) {
  return normalizeText(value)
    .replace(/[.:;,!?]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Convert an unknown value into a finite number.
 *
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function toFiniteNumber(
  value,
  fallback = 0,
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

/**
 * Restrict a number to a range.
 *
 * @param {unknown} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
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
 * Normalize an integer option.
 *
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} maximum
 * @returns {number}
 */
function normalizePositiveInteger(
  value,
  fallback,
  maximum,
) {
  const number = Number(value);

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
 * Normalize a possible array.
 *
 * @param {unknown} value
 * @returns {Array<unknown>}
 */
function normalizeArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}

/**
 * Safely clone provenance records.
 *
 * @param {unknown} provenance
 * @returns {Array<object>}
 */
function cloneProvenance(provenance) {
  return normalizeArray(
    provenance,
  ).map((record) => ({
    ...record,

    contextPath:
      Array.isArray(
        record?.contextPath,
      )
        ? [...record.contextPath]
        : [],
  }));
}

/**
 * Safely clone a graph node.
 *
 * @param {unknown} node
 * @returns {object | null}
 */
function cloneNode(node) {
  if (
    !node ||
    typeof node !== "object"
  ) {
    return null;
  }

  return {
    ...node,

    aliases:
      Array.isArray(node.aliases)
        ? [...node.aliases]
        : [],

    provenance:
      cloneProvenance(
        node.provenance,
      ),
  };
}

/**
 * Safely clone a graph edge.
 *
 * @param {unknown} edge
 * @returns {object | null}
 */
function cloneEdge(edge) {
  if (
    !edge ||
    typeof edge !== "object"
  ) {
    return null;
  }

  return {
    ...edge,

    confidenceValues:
      Array.isArray(
        edge.confidenceValues,
      )
        ? [...edge.confidenceValues]
        : [],

    provenance:
      cloneProvenance(
        edge.provenance,
      ),

    structuredValue:
      edge.structuredValue &&
      typeof edge.structuredValue ===
        "object"
        ? {
            ...edge.structuredValue,

            allYears:
              Array.isArray(
                edge.structuredValue
                  .allYears,
              )
                ? [
                    ...edge
                      .structuredValue
                      .allYears,
                  ]
                : [],
          }
        : null,
  };
}

/**
 * Return all entity nodes from supported graph shapes.
 *
 * @param {object} graph
 * @returns {Array<object>}
 */
function getEntityNodes(graph = {}) {
  if (
    Array.isArray(
      graph.entityNodes,
    )
  ) {
    return graph.entityNodes
      .map(cloneNode)
      .filter(Boolean);
  }

  if (
    Array.isArray(
      graph.entities,
    )
  ) {
    return graph.entities
      .map(cloneNode)
      .filter(Boolean);
  }

  return normalizeArray(
    graph.nodes,
  )
    .filter(
      (node) =>
        node?.nodeType ===
        "entity",
    )
    .map(cloneNode)
    .filter(Boolean);
}

/**
 * Return all literal object nodes from supported graph shapes.
 *
 * @param {object} graph
 * @returns {Array<object>}
 */
function getObjectNodes(graph = {}) {
  if (
    Array.isArray(
      graph.objectNodes,
    )
  ) {
    return graph.objectNodes
      .map(cloneNode)
      .filter(Boolean);
  }

  if (
    Array.isArray(
      graph.objects,
    )
  ) {
    return graph.objects
      .map(cloneNode)
      .filter(Boolean);
  }

  return normalizeArray(
    graph.nodes,
  )
    .filter(
      (node) =>
        node?.nodeType ===
        "object",
    )
    .map(cloneNode)
    .filter(Boolean);
}

/**
 * Return all relationship edges from supported graph shapes.
 *
 * @param {object} graph
 * @returns {Array<object>}
 */
function getRelationshipEdges(
  graph = {},
) {
  const edges =
    graph.relationshipEdges ??
    graph.relationships ??
    graph.edges ??
    [];

  return normalizeArray(edges)
    .map(cloneEdge)
    .filter(Boolean);
}

/**
 * Resolve a graph node identifier.
 *
 * @param {object} node
 * @returns {string | null}
 */
function getNodeId(node = {}) {
  const nodeId = normalizeText(
    node.nodeId ??
    node.entityId ??
    node.objectNodeId ??
    node.id,
  );

  return nodeId || null;
}

/**
 * Resolve a relationship identifier.
 *
 * @param {object} edge
 * @returns {string | null}
 */
function getEdgeId(edge = {}) {
  const edgeId = normalizeText(
    edge.relationshipId ??
    edge.edgeId ??
    edge.id,
  );

  return edgeId || null;
}

/**
 * Resolve the source node identifier.
 *
 * @param {object} edge
 * @returns {string | null}
 */
function getFromNodeId(edge = {}) {
  const nodeId = normalizeText(
    edge.fromNodeId ??
    edge.subjectNodeId ??
    edge.subjectEntityId,
  );

  return nodeId || null;
}

/**
 * Resolve the target node identifier.
 *
 * Supports entity and literal-object edges.
 *
 * @param {object} edge
 * @returns {string | null}
 */
function getToNodeId(edge = {}) {
  const explicitNodeId =
    normalizeText(
      edge.toNodeId ??
      edge.objectNodeId ??
      edge.objectEntityId ??
      edge.targetEntityId,
    );

  if (explicitNodeId) {
    return explicitNodeId;
  }

  const objectValue =
    normalizeText(edge.object);

  if (!objectValue) {
    return null;
  }

  return `OBJECT::${normalizeKey(
    objectValue,
  )}`;
}

/**
 * Resolve an edge predicate.
 *
 * @param {object} edge
 * @returns {string}
 */
function getPredicate(edge = {}) {
  return normalizeText(
    edge.predicate ??
    edge.normalizedPredicate,
  );
}

/**
 * Resolve edge confidence.
 *
 * @param {object} edge
 * @returns {number | null}
 */
function getEdgeConfidence(
  edge = {},
) {
  const confidence =
    edge.averageConfidence ??
    edge.maxConfidence ??
    edge.confidence;

  const numericConfidence =
    Number(confidence);

  if (
    !Number.isFinite(
      numericConfidence,
    )
  ) {
    return null;
  }

  return Number(
    clamp(
      numericConfidence,
    ).toFixed(6),
  );
}

/**
 * Determine whether an edge points to another entity.
 *
 * @param {object} edge
 * @returns {boolean}
 */
function isEntityRelationship(
  edge = {},
) {
  return Boolean(
    normalizeText(
      edge.objectEntityId ??
      edge.targetEntityId,
    ),
  ) ||
    edge.objectType === "entity" ||
    edge.relationshipType ===
      "entity_to_entity" ||
    edge.edgeType ===
      "entity_relationship";
}

/**
 * Build node lookup indexes.
 *
 * @param {object} graph
 * @returns {{
 *   byId: Map<string, object>,
 *   byNormalizedId: Map<string, object>,
 *   entityIds: Set<string>,
 *   objectNodeIds: Set<string>
 * }}
 */
function createNodeLookup(
  graph = {},
) {
  const byId = new Map();
  const byNormalizedId =
    new Map();

  const entityIds = new Set();
  const objectNodeIds =
    new Set();

  for (
    const node
    of getEntityNodes(graph)
  ) {
    const nodeId =
      getNodeId(node);

    if (!nodeId) {
      continue;
    }

    byId.set(nodeId, node);
    byNormalizedId.set(
      normalizeKey(nodeId),
      node,
    );
    entityIds.add(nodeId);
  }

  for (
    const node
    of getObjectNodes(graph)
  ) {
    const nodeId =
      getNodeId(node);

    if (!nodeId) {
      continue;
    }

    byId.set(nodeId, node);
    byNormalizedId.set(
      normalizeKey(nodeId),
      node,
    );
    objectNodeIds.add(nodeId);
  }

  return {
    byId,
    byNormalizedId,
    entityIds,
    objectNodeIds,
  };
}

/**
 * Build outgoing and incoming adjacency indexes.
 *
 * @param {object} graph
 * @returns {{
 *   outgoing: Map<string, Array<object>>,
 *   incoming: Map<string, Array<object>>,
 *   edgeById: Map<string, object>,
 *   indexedEdgeCount: number,
 *   rejectedEdges: Array<object>
 * }}
 */
function createAdjacencyIndexes(
  graph = {},
) {
  const outgoing = new Map();
  const incoming = new Map();
  const edgeById = new Map();
  const rejectedEdges = [];

  let indexedEdgeCount = 0;

  for (
    const edge
    of getRelationshipEdges(
      graph,
    )
  ) {
    const edgeId =
      getEdgeId(edge);

    const fromNodeId =
      getFromNodeId(edge);

    const toNodeId =
      getToNodeId(edge);

    if (
      !fromNodeId ||
      !toNodeId
    ) {
      rejectedEdges.push({
        edgeId,
        reason:
          "missing_graph_endpoint",
        edge,
      });

      continue;
    }

    if (
      !outgoing.has(
        fromNodeId,
      )
    ) {
      outgoing.set(
        fromNodeId,
        [],
      );
    }

    if (
      !incoming.has(
        toNodeId,
      )
    ) {
      incoming.set(
        toNodeId,
        [],
      );
    }

    outgoing
      .get(fromNodeId)
      .push(edge);

    incoming
      .get(toNodeId)
      .push(edge);

    if (edgeId) {
      edgeById.set(
        edgeId,
        edge,
      );
    }

    indexedEdgeCount += 1;
  }

  return {
    outgoing,
    incoming,
    edgeById,
    indexedEdgeCount,
    rejectedEdges,
  };
}

/**
 * Normalize a multi-hop reasoning request.
 *
 * @param {object} query
 * @returns {object}
 */
function normalizeReasoningQuery(
  query = {},
) {
  const startNodeId =
    normalizeText(
      query.startNodeId ??
      query.subjectNodeId ??
      query.subjectEntityId ??
      query.fromNodeId,
    );

  const targetNodeId =
    normalizeText(
      query.targetNodeId ??
      query.objectEntityId ??
      query.toNodeId,
    );

  if (!startNodeId) {
    throw new TypeError(
      "Multi-hop reasoning requires startNodeId or subjectEntityId.",
    );
  }

  if (!targetNodeId) {
    throw new TypeError(
      "Multi-hop reasoning requires targetNodeId or objectEntityId.",
    );
  }

  const predicates =
    normalizeArray(
      query.predicates ??
      (
        query.predicate
          ? [query.predicate]
          : []
      ),
    )
      .map(normalizeKey)
      .filter(Boolean);

  return {
    startNodeId,
    targetNodeId,

    maxDepth:
      normalizePositiveInteger(
        query.maxDepth,
        DEFAULT_MAX_DEPTH,
        MAX_ALLOWED_DEPTH,
      ),

    maxPaths:
      normalizePositiveInteger(
        query.maxPaths,
        DEFAULT_MAX_PATHS,
        MAX_ALLOWED_PATHS,
      ),

    predicates:
      [...new Set(predicates)],

    entityRelationshipsOnly:
      query
        .entityRelationshipsOnly !==
      false,

    minimumConfidence:
      clamp(
        query.minimumConfidence ??
        0,
      ),
  };
}

/**
 * Create initial cycle-safe traversal state.
 *
 * @param {string} startNodeId
 * @returns {object}
 */
function createInitialPathState(
  startNodeId,
) {
  const normalizedStartNodeId =
    normalizeText(startNodeId);

  if (!normalizedStartNodeId) {
    throw new TypeError(
      "Initial path state requires startNodeId.",
    );
  }

  return {
    currentNodeId:
      normalizedStartNodeId,

    nodeIds: [
      normalizedStartNodeId,
    ],

    edgeIds: [],

    edges: [],

    visitedNodeIds:
      new Set([
        normalizedStartNodeId,
      ]),

    depth: 0,
  };
}

/**
 * Check whether extending a path would create a cycle.
 *
 * @param {object} pathState
 * @param {string} nextNodeId
 * @returns {boolean}
 */
function wouldCreateCycle(
  pathState,
  nextNodeId,
) {
  return Boolean(
    pathState
      ?.visitedNodeIds
      ?.has(
        normalizeText(
          nextNodeId,
        ),
      ),
  );
}

/**
 * Extend a traversal state by one graph edge.
 *
 * Returns null when the edge is invalid or cyclic.
 *
 * @param {object} pathState
 * @param {object} edge
 * @returns {object | null}
 */
function extendPathState(
  pathState,
  edge,
) {
  if (
    !pathState ||
    typeof pathState !== "object"
  ) {
    throw new TypeError(
      "extendPathState requires a valid path state.",
    );
  }

  const fromNodeId =
    getFromNodeId(edge);

  const nextNodeId =
    getToNodeId(edge);

  if (
    !fromNodeId ||
    !nextNodeId ||
    fromNodeId !==
      pathState.currentNodeId
  ) {
    return null;
  }

  if (
    wouldCreateCycle(
      pathState,
      nextNodeId,
    )
  ) {
    return null;
  }

  const edgeId =
    getEdgeId(edge);

  return {
    currentNodeId:
      nextNodeId,

    nodeIds: [
      ...pathState.nodeIds,
      nextNodeId,
    ],

    edgeIds:
      edgeId
        ? [
            ...pathState.edgeIds,
            edgeId,
          ]
        : [
            ...pathState.edgeIds,
          ],

    edges: [
      ...pathState.edges,
      cloneEdge(edge),
    ],

    visitedNodeIds:
      new Set([
        ...pathState
          .visitedNodeIds,
        nextNodeId,
      ]),

    depth:
      pathState.depth + 1,
  };
}

/**
 * Validate whether an edge can participate in a reasoning path.
 *
 * @param {object} edge
 * @param {object} query
 * @returns {boolean}
 */
function edgeMatchesQuery(
  edge,
  query,
) {
  if (
    query
      .entityRelationshipsOnly &&
    !isEntityRelationship(edge)
  ) {
    return false;
  }

  const confidence =
    getEdgeConfidence(edge);

  if (
    confidence !== null &&
    confidence <
      query.minimumConfidence
  ) {
    return false;
  }

  if (
    query.predicates.length >
    0
  ) {
    const predicate =
      normalizeKey(
        getPredicate(edge),
      );

    if (
      !query.predicates.includes(
        predicate,
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Build graph indexes required by future BFS and DFS phases.
 *
 * @param {object} graph
 * @returns {object}
 */
function prepareReasoningGraph(
  graph = {},
) {
  const nodeLookup =
    createNodeLookup(graph);

  const adjacency =
    createAdjacencyIndexes(
      graph,
    );

  return {
    nodeLookup,
    adjacency,

    summary: {
      entityNodeCount:
        nodeLookup
          .entityIds
          .size,

      objectNodeCount:
        nodeLookup
          .objectNodeIds
          .size,

      indexedNodeCount:
        nodeLookup.byId.size,

      relationshipCount:
        getRelationshipEdges(
          graph,
        ).length,

      indexedEdgeCount:
        adjacency
          .indexedEdgeCount,

      rejectedEdgeCount:
        adjacency
          .rejectedEdges
          .length,
    },
  };
}

/**
 * Discover reasoning paths using Breadth-First Search.
 *
 * @param {object} graph
 * @param {object} query
 * @returns {object}
 */
function discoverBreadthFirstPaths(
  graph = {},
  query = {},
) {
  const normalizedQuery =
    normalizeReasoningQuery(query);

  const preparedGraph =
    prepareReasoningGraph(graph);

  const {
    outgoing,
  } = preparedGraph.adjacency;

  const queue = [
    createInitialPathState(
      normalizedQuery.startNodeId,
    ),
  ];

  const completedPaths = [];

  while (
    queue.length > 0 &&
    completedPaths.length <
      normalizedQuery.maxPaths
  ) {
    const currentState =
      queue.shift();

    if (
      currentState.depth >=
      normalizedQuery.maxDepth
    ) {
      continue;
    }

    const outgoingEdges =
      outgoing.get(
        currentState.currentNodeId,
      ) || [];

    for (
      const edge
      of outgoingEdges
    ) {
      if (
        !edgeMatchesQuery(
          edge,
          normalizedQuery,
        )
      ) {
        continue;
      }

      const nextState =
        extendPathState(
          currentState,
          edge,
        );

      if (!nextState) {
        continue;
      }

      if (
        nextState.currentNodeId ===
        normalizedQuery.targetNodeId
      ) {
        completedPaths.push(
          nextState,
        );

        if (
          completedPaths.length >=
          normalizedQuery.maxPaths
        ) {
          break;
        }

        continue;
      }

      queue.push(nextState);
    }
  }

  const rankedPaths =
    rankReasoningPaths(
      completedPaths.map(
        formatReasoningPath,
      ),
      query,
    );

  return {
    status: "success",

    query: normalizedQuery,

    pathCount:
      rankedPaths.length,

    bestPath:
      rankedPaths[0] ?? null,

    paths:
      rankedPaths,

    graphSummary:
      preparedGraph.summary,
  };
}

/**
 * Calculate cumulative path confidence.
 *
 * Uses multiplicative confidence so that
 * longer chains naturally become less certain.
 *
 * @param {Array<object>} edges
 * @returns {number|null}
 */
function calculatePathConfidence(
  edges = [],
) {
  const values = edges
    .map(getEdgeConfidence)
    .filter(
      (value) =>
        value !== null,
    );

  if (values.length === 0) {
    return null;
  }

  return Number(
    values
      .reduce(
        (result, value) =>
          result * value,
        1,
      )
      .toFixed(6),
  );
}

/**
 * Merge provenance across a path.
 *
 * @param {Array<object>} edges
 * @returns {Array<object>}
 */
function aggregatePathProvenance(
  edges = [],
) {
  const seen = new Set();
  const provenance = [];

  for (const edge of edges) {
    for (const item of normalizeArray(edge.provenance)) {
      const key = JSON.stringify(item);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      provenance.push(item);
    }
  }

  return provenance;
}

/**
 * Convert a traversal state into
 * a reasoning-friendly structure.
 *
 * @param {object} pathState
 * @returns {object}
 */
function formatReasoningPath(
  pathState,
) {
  const steps =
    pathState.edges.map(
      (edge) => ({
        relationshipId:
          getEdgeId(edge),

        subject:
          edge.subject ??
          edge.canonicalSubject,

        predicate:
          getPredicate(edge),

        object:
          edge.object,

        confidence:
          getEdgeConfidence(edge),

        objectEntityId:
          edge.objectEntityId ??
          edge.targetEntityId ??
          null,

        provenance:
          cloneProvenance(
            edge.provenance,
          ),
      }),
    );

  return {
    pathLength:
      steps.length,

    startNodeId:
      pathState.nodeIds[0],

    endNodeId:
      pathState.currentNodeId,

    nodeIds:
      [...pathState.nodeIds],

    edgeIds:
      [...pathState.edgeIds],

    confidence:
      calculatePathConfidence(
        pathState.edges,
      ),

    provenance:
      aggregatePathProvenance(
        pathState.edges,
      ),

    explanation:
      steps
        .map(
          (step) =>
            `${step.subject} ${step.predicate} ${step.object}`,
        )
        .join(" → "),

    steps,
  };
}

/**
 * Score a formatted reasoning path.
 *
 * Ranking considers:
 * - path confidence
 * - path length
 * - evidence coverage
 *
 * Shorter, well-supported and higher-confidence
 * paths receive better scores.
 *
 * @param {object} path
 * @param {object} options
 * @returns {object}
 */
function scoreReasoningPath(
  path,
  options = {},
) {
  const confidence =
    path.confidence ?? 0;

  const pathLength =
    Math.max(
      1,
      Number(path.pathLength) || 1,
    );

  const evidenceCount =
    Array.isArray(path.provenance)
      ? path.provenance.length
      : 0;

  const confidenceWeight =
    clamp(
      options.confidenceWeight ??
      0.65,
    );

  const lengthWeight =
    clamp(
      options.lengthWeight ??
      0.2,
    );

  const evidenceWeight =
    clamp(
      options.evidenceWeight ??
      0.15,
    );

  const totalWeight =
    confidenceWeight +
    lengthWeight +
    evidenceWeight;

  const lengthScore =
    1 / pathLength;

  const evidenceScore =
    clamp(
      evidenceCount / pathLength,
    );

  const rankingScore =
    totalWeight > 0
      ? (
          confidence *
            confidenceWeight +
          lengthScore *
            lengthWeight +
          evidenceScore *
            evidenceWeight
        ) /
        totalWeight
      : 0;

  return {
    confidence:
      Number(
        confidence.toFixed(6),
      ),

    lengthScore:
      Number(
        lengthScore.toFixed(6),
      ),

    evidenceScore:
      Number(
        evidenceScore.toFixed(6),
      ),

    rankingScore:
      Number(
        clamp(
          rankingScore,
        ).toFixed(6),
      ),
  };
}

/**
 * Rank formatted reasoning paths.
 *
 * @param {Array<object>} paths
 * @param {object} options
 * @returns {Array<object>}
 */
function rankReasoningPaths(
  paths = [],
  options = {},
) {
  return normalizeArray(paths)
    .map((path) => {
      const score =
        scoreReasoningPath(
          path,
          options,
        );

      return {
        ...path,

        rankingScore:
          score.rankingScore,

        scoreBreakdown:
          score,
      };
    })
    .sort(
      (
        first,
        second,
      ) =>
        second.rankingScore -
          first.rankingScore ||
        (
          second.confidence ??
          0
        ) -
          (
            first.confidence ??
            0
          ) ||
        first.pathLength -
          second.pathLength ||
        String(
          first.edgeIds?.join(
            "::",
          ) ?? "",
        ).localeCompare(
          String(
            second.edgeIds?.join(
              "::",
            ) ?? "",
          ),
        ),
    )
    .map(
      (
        path,
        index,
      ) => ({
        ...path,

        rank:
          index + 1,
      }),
    );
}

export {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_PATHS,

  normalizeText,
  normalizeKey,
  clamp,

  getEntityNodes,
  getObjectNodes,
  getRelationshipEdges,

  getNodeId,
  getEdgeId,
  getFromNodeId,
  getToNodeId,
  getPredicate,
  getEdgeConfidence,

  isEntityRelationship,

  createNodeLookup,
  createAdjacencyIndexes,
  normalizeReasoningQuery,

  createInitialPathState,
  wouldCreateCycle,
  extendPathState,
  edgeMatchesQuery,

  prepareReasoningGraph,

  discoverBreadthFirstPaths,

  calculatePathConfidence,
  aggregatePathProvenance,
  formatReasoningPath,

  scoreReasoningPath,
  rankReasoningPaths,
};
