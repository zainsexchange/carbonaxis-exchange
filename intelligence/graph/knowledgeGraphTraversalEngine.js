import {
  buildKnowledgeGraph,
  getGraphEntityNode,
  getGraphObjectNode,
  getOutgoingEdges,
  getIncomingEdgesByObject,
  getEdgesByPredicate,
  normalizeGraphKey,
} from "./knowledgeGraphStore.js";

/**
 * Safely clone provenance records.
 */
function cloneProvenance(provenance) {
  if (!Array.isArray(provenance)) {
    return [];
  }

  return provenance.map((item) => ({
    ...item,
    contextPath: Array.isArray(
      item?.contextPath,
    )
      ? [...item.contextPath]
      : [],
  }));
}

/**
 * Safely clone a graph edge.
 */
function cloneEdge(edge) {
  if (!edge || typeof edge !== "object") {
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

    structuredValue:
      edge.structuredValue &&
      typeof edge.structuredValue === "object"
        ? {
            ...edge.structuredValue,

            allYears:
              Array.isArray(
                edge.structuredValue.allYears,
              )
                ? [
                    ...edge.structuredValue.allYears,
                  ]
                : [],
          }
        : null,

    provenance:
      cloneProvenance(
        edge.provenance,
      ),
  };
}

/**
 * Normalize traversal depth.
 */
function normalizeDepth(
  depth,
  defaultDepth = 1,
) {
  const numericDepth =
    Number(depth);

  if (
    !Number.isInteger(numericDepth) ||
    numericDepth < 1
  ) {
    return defaultDepth;
  }

  return Math.min(
    numericDepth,
    10,
  );
}

/**
 * Normalize confidence threshold.
 */
function normalizeConfidenceThreshold(
  value,
) {
  const numericValue =
    Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(
      0,
      numericValue,
    ),
  );
}

/**
 * Check whether an edge satisfies traversal filters.
 */
function edgeMatchesFilters(
  edge,
  options = {},
) {
  if (!edge) {
    return false;
  }

  const predicateFilter =
    normalizeGraphKey(
      options.predicate,
    );

  if (
    predicateFilter &&
    normalizeGraphKey(
      edge.predicate,
    ) !== predicateFilter
  ) {
    return false;
  }

  const minimumConfidence =
    normalizeConfidenceThreshold(
      options.minimumConfidence,
    );

  if (
    Number(
      edge.averageConfidence,
    ) < minimumConfidence
  ) {
    return false;
  }

  const objectSearch =
    normalizeGraphKey(
      options.objectSearch,
    );

  if (
    objectSearch &&
    !normalizeGraphKey(
      edge.object,
    ).includes(
      objectSearch,
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Return direct outgoing relationships for an entity.
 */
export function traverseOneHop(
  entityId,
  options = {},
) {
  buildKnowledgeGraph();

  const entity =
    getGraphEntityNode(
      entityId,
    );

  if (!entity) {
    return {
      found: false,
      entityId,
      entity: null,
      paths: [],
      edgeCount: 0,
      objectNodeCount: 0,
    };
  }

  const edges =
    getOutgoingEdges(
      entityId,
    )
      .filter((edge) =>
        edgeMatchesFilters(
          edge,
          options,
        ),
      )
      .map(cloneEdge)
      .filter(Boolean);

  const paths =
    edges.map((edge) => {
      const objectNode =
        getGraphObjectNode(
          edge.object,
        );

      return {
        depth: 1,

        pathId:
          `${entityId}::${edge.relationshipId}`,

        startNodeId:
          entityId,

        endNodeId:
          objectNode?.nodeId ??
          edge.toNodeId,

        nodes: [
          entity,
          objectNode,
        ].filter(Boolean),

        edges: [
          edge,
        ],

        predicates: [
          edge.predicate,
        ],

        confidence:
          Number(
            edge.averageConfidence,
          ) || 0,
      };
    });

  return {
    found: true,
    entityId,
    entity,
    paths,
    edgeCount:
      edges.length,
    objectNodeCount:
      paths.length,
  };
}

/**
 * Return incoming relationships for a raw object value.
 */
export function traverseIncomingObject(
  objectValue,
  options = {},
) {
  buildKnowledgeGraph();

  const objectNode =
    getGraphObjectNode(
      objectValue,
    );

  if (!objectNode) {
    return {
      found: false,
      objectValue,
      objectNode: null,
      incomingEdges: [],
      sourceEntities: [],
      edgeCount: 0,
    };
  }

  const incomingEdges =
    getIncomingEdgesByObject(
      objectValue,
    )
      .filter((edge) =>
        edgeMatchesFilters(
          edge,
          options,
        ),
      )
      .map(cloneEdge)
      .filter(Boolean);

  const sourceEntities =
    incomingEdges
      .map((edge) =>
        getGraphEntityNode(
          edge.subjectEntityId,
        ),
      )
      .filter(Boolean);

  return {
    found: true,
    objectValue,
    objectNode,
    incomingEdges,
    sourceEntities,
    edgeCount:
      incomingEdges.length,
  };
}

/**
 * Return all graph edges matching a predicate.
 */
export function traversePredicate(
  predicate,
  options = {},
) {
  buildKnowledgeGraph();

  const edges =
    getEdgesByPredicate(
      predicate,
    )
      .filter((edge) =>
        edgeMatchesFilters(
          edge,
          {
            ...options,
            predicate,
          },
        ),
      )
      .map(cloneEdge)
      .filter(Boolean);

  const paths =
    edges.map((edge) => {
      const sourceEntity =
        getGraphEntityNode(
          edge.subjectEntityId,
        );

      const objectNode =
        getGraphObjectNode(
          edge.object,
        );

      return {
        depth: 1,

        pathId:
          `${edge.subjectEntityId}::${edge.relationshipId}`,

        startNodeId:
          edge.subjectEntityId,

        endNodeId:
          objectNode?.nodeId ??
          edge.toNodeId,

        nodes: [
          sourceEntity,
          objectNode,
        ].filter(Boolean),

        edges: [
          edge,
        ],

        predicates: [
          edge.predicate,
        ],

        confidence:
          Number(
            edge.averageConfidence,
          ) || 0,
      };
    });

  return {
    predicate,
    normalizedPredicate:
      normalizeGraphKey(
        predicate,
      ),
    paths,
    edgeCount:
      edges.length,
  };
}

/**
 * Perform breadth-first traversal from one entity.
 *
 * Current graph structure contains:
 *
 * Entity -> Relationship -> Object node
 *
 * Object nodes may later be promoted to registered entities.
 * This implementation is prepared for multi-hop traversal once
 * object-to-entity linking is introduced.
 */
export function traverseGraph(
  startEntityId,
  options = {},
) {
  buildKnowledgeGraph();

  const maxDepth =
    normalizeDepth(
      options.maxDepth,
      1,
    );

  const startEntity =
    getGraphEntityNode(
      startEntityId,
    );

  if (!startEntity) {
    return {
      found: false,
      startEntityId,
      maxDepth,
      visitedNodeIds: [],
      paths: [],
      pathCount: 0,
    };
  }

  const queue = [
    {
      nodeId:
        startEntityId,
      depth: 0,
      nodes: [
        startEntity,
      ],
      edges: [],
      predicates: [],
      confidenceValues: [],
    },
  ];

  const visitedNodeIds =
    new Set([
      startEntityId,
    ]);

  const paths = [];

  while (queue.length > 0) {
    const current =
      queue.shift();

    if (
      current.depth >= maxDepth
    ) {
      continue;
    }

    const outgoingEdges =
      getOutgoingEdges(
        current.nodeId,
      ).filter((edge) =>
        edgeMatchesFilters(
          edge,
          options,
        ),
      );

    for (
      const rawEdge
      of outgoingEdges
    ) {
      const edge =
        cloneEdge(
          rawEdge,
        );

      if (!edge) {
        continue;
      }

      const objectNode =
        getGraphObjectNode(
          edge.object,
        );

      if (!objectNode) {
        continue;
      }

      const nextDepth =
        current.depth + 1;

      const nextNodes = [
        ...current.nodes,
        objectNode,
      ];

      const nextEdges = [
        ...current.edges,
        edge,
      ];

      const nextPredicates = [
        ...current.predicates,
        edge.predicate,
      ];

      const nextConfidenceValues = [
        ...current.confidenceValues,
        Number(
          edge.averageConfidence,
        ) || 0,
      ];

      const pathConfidence =
        nextConfidenceValues.length > 0
          ? nextConfidenceValues.reduce(
              (
                total,
                confidence,
              ) =>
                total + confidence,
              0,
            ) /
            nextConfidenceValues.length
          : 0;

      const path = {
        depth:
          nextDepth,

        pathId:
          nextEdges
            .map(
              (item) =>
                item.relationshipId,
            )
            .join("::"),

        startNodeId:
          startEntityId,

        endNodeId:
          objectNode.nodeId,

        nodes:
          nextNodes,

        edges:
          nextEdges,

        predicates:
          nextPredicates,

        confidence:
          Number(
            pathConfidence.toFixed(
              6,
            ),
          ),
      };

      paths.push(path);

      if (
        !visitedNodeIds.has(
          objectNode.nodeId,
        )
      ) {
        visitedNodeIds.add(
          objectNode.nodeId,
        );
      }

      /*
       * Object nodes currently have no outgoing edges.
       *
       * Later, when object-node entity promotion is added,
       * linked entity IDs can be queued here for true multi-hop
       * traversal.
       */
    }
  }

  return {
    found: true,
    startEntityId,
    startEntity,
    maxDepth,
    visitedNodeIds:
      Array.from(
        visitedNodeIds,
      ),
    paths,
    pathCount:
      paths.length,
  };
}

/**
 * Find paths containing a requested object phrase.
 */
export function findPathsByObjectText(
  startEntityId,
  objectSearch,
  options = {},
) {
  return traverseGraph(
    startEntityId,
    {
      ...options,
      objectSearch,
    },
  );
}

/**
 * Return direct evidence for an entity's graph relationships.
 */
export function getTraversalEvidence(
  entityId,
  options = {},
) {
  const traversal =
    traverseOneHop(
      entityId,
      options,
    );

  if (!traversal.found) {
    return {
      found: false,
      entityId,
      evidence: [],
      evidenceCount: 0,
    };
  }

  const evidence =
    traversal.paths.flatMap(
      (path) =>
        path.edges.flatMap(
          (edge) =>
            cloneProvenance(
              edge.provenance,
            ).map(
              (provenance) => ({
                relationshipId:
                  edge.relationshipId,

                subject:
                  edge.subject,

                predicate:
                  edge.predicate,

                object:
                  edge.object,

                averageConfidence:
                  edge.averageConfidence,

                ...provenance,
              }),
            ),
        ),
    );

  return {
    found: true,
    entityId,
    evidence,
    evidenceCount:
      evidence.length,
  };
}

export {
  edgeMatchesFilters,
  normalizeDepth,
  normalizeConfidenceThreshold,
};