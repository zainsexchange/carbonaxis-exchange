/**
 * Shared constants for Carbon Brain truth / reasoning layer.
 * Import these instead of hard-coding status or source strings.
 */

export const TRUTH_STATUS = Object.freeze({
  SUPPORTED: "SUPPORTED",
  PARTIALLY_SUPPORTED: "PARTIALLY_SUPPORTED",
  CONFLICTING: "CONFLICTING",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
});

export const EVIDENCE_SOURCE = Object.freeze({
  DOCUMENT: "DOCUMENT",
  GRAPH: "GRAPH",
  INFERENCE: "INFERENCE",
  ONTOLOGY: "ONTOLOGY",
});

/**
 * V1 source reliability weights for weighted aggregation.
 * Replaceable later by Bayesian / Dempster–Shafer fusion.
 */
export const SOURCE_WEIGHTS = Object.freeze({
  [EVIDENCE_SOURCE.DOCUMENT]: 1.0,
  [EVIDENCE_SOURCE.GRAPH]: 0.98,
  [EVIDENCE_SOURCE.ONTOLOGY]: 0.95,
  [EVIDENCE_SOURCE.INFERENCE]: 0.9,
});

export const EVIDENCE_POLARITY = Object.freeze({
  AFFIRMS: "AFFIRMS",
  NEGATES: "NEGATES",
});

/**
 * Predicates that may have multiple valid objects
 * without implying contradiction (taxonomy / hierarchy).
 */
export const MULTI_VALUED_PREDICATES = Object.freeze([
  "IS_A",
  "PART_OF",
  "RELATED_TO",
  "SUPPORTED_BY",
  "REGULATED_BY",
  "USES",
  "PRODUCES",
]);

/**
 * Map negated predicates onto their affirmative form.
 */
export const NEGATED_PREDICATE_MAP = Object.freeze({
  DOES_NOT_SUPPORT: "SUPPORTS",
  DOES_NOT_SUPPORTS: "SUPPORTS",
  NOT_SUPPORT: "SUPPORTS",
  NOT_SUPPORTS: "SUPPORTS",
  OPPOSES: "SUPPORTS",
  REJECTS: "SUPPORTS",
  DOES_NOT_INCLUDE: "INCLUDES",
  NOT_INCLUDES: "INCLUDES",
  IS_NOT_A: "IS_A",
  IS_NOT: "IS_A",
  NOT_LOCATED_IN: "LOCATED_IN",
  DOES_NOT_LOCATE_IN: "LOCATED_IN",
});
