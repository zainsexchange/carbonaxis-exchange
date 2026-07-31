import assert from "node:assert/strict";

import {
  prepareReasoningGraph,
  discoverBreadthFirstPaths,
} from "../../intelligence/graph/multiHopReasoningEngine.js";

/*
 * Simple graph:
 *
 * A
 * │
 * ▼
 * B
 * │
 * ▼
 * C
 */

const graph = {
  entityNodes: [
    {
      nodeId: "ENTITY_A",
      canonicalName: "Entity A",
      nodeType: "entity",
    },
    {
      nodeId: "ENTITY_B",
      canonicalName: "Entity B",
      nodeType: "entity",
    },
    {
      nodeId: "ENTITY_C",
      canonicalName: "Entity C",
      nodeType: "entity",
    },
  ],

  relationshipEdges: [
    {
      relationshipId: "REL_1",
      fromNodeId: "ENTITY_A",
      toNodeId: "ENTITY_B",

      predicate: "supports",

      objectType: "entity",

      confidence: 0.95,
    },

    {
      relationshipId: "REL_2",
      fromNodeId: "ENTITY_B",
      toNodeId: "ENTITY_C",

      predicate: "includes",

      objectType: "entity",

      confidence: 0.90,
    },
  ],
};

console.log("");

console.log(
  "===== Multi-Hop Runtime Tests =====",
);

const prepared =
  prepareReasoningGraph(graph);

assert.equal(
  prepared.summary.entityNodeCount,
  3,
);

assert.equal(
  prepared.summary.relationshipCount,
  2,
);

console.log(
  "✓ Graph preparation",
);

const result =
  discoverBreadthFirstPaths(
    graph,
    {
      startNodeId: "ENTITY_A",

      targetNodeId: "ENTITY_C",

      maxDepth: 5,
    },
  );

assert.equal(
  result.status,
  "success",
);

assert.equal(
  result.pathCount,
  1,
);

assert.equal(
  result.paths.length,
  1,
);

assert.equal(
  result.paths[0].pathLength,
  2,
);

assert.equal(
  result.paths[0].steps.length,
  2,
);

assert.equal(
  result.paths[0].steps[0].predicate,
  "supports",
);

assert.equal(
  result.paths[0].steps[1].predicate,
  "includes",
);

console.log(
  "✓ Multi-hop discovery",
);

console.log("");

console.log(
  "Runtime verification passed.",
);

console.log("");