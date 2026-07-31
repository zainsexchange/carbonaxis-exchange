/**
 * Deterministic planner rules — no OpenAI.
 */

import {
  EXECUTION_STRATEGY,
} from "./executionPlan.js";

/**
 * Higher priority wins when multiple rules match.
 */
export const PLANNER_RULES = Object.freeze([
  {
    id: "COMPARE",
    keywords: [
      "compare",
      "comparison",
      "difference",
      "differences",
      "versus",
      " vs ",
      "vs.",
    ],
    strategy: EXECUTION_STRATEGY.COMPARISON,
    priority: 100,
  },

  {
    id: "EXPLAIN",
    keywords: [
      "how",
      "why",
      "relationship",
      "related",
      "connected",
      "connection",
      "link",
      "linked",
    ],
    strategy: EXECUTION_STRATEGY.GRAPH,
    priority: 80,
  },

  {
    id: "CLASSIFICATION",
    keywords: [
      "type",
      "category",
      "classify",
      "kind of",
      "form of",
    ],
    patterns: [
      /\bis\b.+\ba\b/,
      /\bis\b.+\ban\b/,
    ],
    strategy: EXECUTION_STRATEGY.REASONING,
    priority: 70,
  },

  {
    id: "DEFINITION",
    keywords: [
      "what is",
      "what's",
      "define",
      "definition",
      "meaning of",
    ],
    strategy: EXECUTION_STRATEGY.ONTOLOGY,
    priority: 60,
  },

  {
    id: "FACT",
    keywords: [
      "what",
      "when",
      "where",
      "which",
      "who",
    ],
    strategy: EXECUTION_STRATEGY.SEMANTIC,
    priority: 40,
  },
]);

/**
 * Default capability profile per strategy.
 */
export const STRATEGY_PROFILES = Object.freeze({
  [EXECUTION_STRATEGY.SEMANTIC]: {
    requiresSemanticSearch: true,
    requiresGraphTraversal: false,
    requiresShortestPath: false,
    requiresInference: false,
    requiresOntologyExpansion: false,
    requiresTruthEvaluation: true,
    comparisonMode: false,
  },

  [EXECUTION_STRATEGY.GRAPH]: {
    requiresSemanticSearch: true,
    requiresGraphTraversal: true,
    requiresShortestPath: true,
    requiresInference: false,
    requiresOntologyExpansion: false,
    requiresTruthEvaluation: true,
    comparisonMode: false,
  },

  [EXECUTION_STRATEGY.ONTOLOGY]: {
    requiresSemanticSearch: true,
    requiresGraphTraversal: false,
    requiresShortestPath: false,
    requiresInference: false,
    requiresOntologyExpansion: true,
    requiresTruthEvaluation: true,
    comparisonMode: false,
  },

  [EXECUTION_STRATEGY.REASONING]: {
    requiresSemanticSearch: true,
    requiresGraphTraversal: true,
    requiresShortestPath: false,
    requiresInference: true,
    requiresOntologyExpansion: true,
    requiresTruthEvaluation: true,
    comparisonMode: false,
  },

  [EXECUTION_STRATEGY.HYBRID]: {
    requiresSemanticSearch: true,
    requiresGraphTraversal: true,
    requiresShortestPath: false,
    requiresInference: true,
    requiresOntologyExpansion: true,
    requiresTruthEvaluation: true,
    comparisonMode: false,
  },

  [EXECUTION_STRATEGY.COMPARISON]: {
    requiresSemanticSearch: true,
    requiresGraphTraversal: true,
    requiresShortestPath: false,
    requiresInference: true,
    requiresOntologyExpansion: true,
    requiresTruthEvaluation: true,
    comparisonMode: true,
  },
});
