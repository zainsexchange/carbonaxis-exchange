/**
 * Query Planner — deterministic plan generation.
 *
 * Analyzes the question, matches planner rules,
 * produces one ExecutionPlan, and attaches it to
 * the ReasoningContext.
 */

import {
  ExecutionPlan,
  EXECUTION_STRATEGY,
  PLAN_PRIORITY,
} from "./executionPlan.js";

import {
  PLANNER_RULES,
  STRATEGY_PROFILES,
} from "./plannerRules.js";

import {
  createReasoningContext,
} from "../reasoning/reasoningContext.js";

function normalizeQuestion(question = "") {
  return String(question || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(question = "") {
  return ` ${normalizeQuestion(question).toLowerCase()} `;
}

/**
 * @param {string} question
 * @param {object} rule
 * @returns {boolean}
 */
function ruleMatches(question, rule) {
  const haystack = normalizeForMatch(question);

  const keywordHit = (rule.keywords || []).some(
    (keyword) => {
      const needle = String(keyword || "")
        .toLowerCase()
        .trim();

      if (!needle) {
        return false;
      }

      /*
       * Preserve intentional padded tokens like " vs ".
       */
      if (
        needle.startsWith(" ") ||
        needle.endsWith(" ")
      ) {
        return haystack.includes(needle);
      }

      return haystack.includes(` ${needle} `) ||
        haystack.includes(needle);
    },
  );

  if (keywordHit) {
    return true;
  }

  const raw = normalizeQuestion(question).toLowerCase();

  return (rule.patterns || []).some((pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.test(raw);
    }

    return false;
  });
}

/**
 * @param {string} question
 * @returns {object[]}
 */
export function matchPlannerRules(question = "") {
  return PLANNER_RULES
    .filter((rule) => ruleMatches(question, rule))
    .sort(
      (left, right) =>
        (right.priority || 0) -
        (left.priority || 0),
    );
}

function applyProfile(plan, strategy) {
  const profile =
    STRATEGY_PROFILES[strategy] ||
    STRATEGY_PROFILES[EXECUTION_STRATEGY.HYBRID];

  plan.strategy = strategy;
  plan.requiresSemanticSearch =
    profile.requiresSemanticSearch;
  plan.requiresGraphTraversal =
    profile.requiresGraphTraversal;
  plan.requiresShortestPath =
    profile.requiresShortestPath;
  plan.requiresInference =
    profile.requiresInference;
  plan.requiresOntologyExpansion =
    profile.requiresOntologyExpansion;
  plan.requiresTruthEvaluation =
    profile.requiresTruthEvaluation;
  plan.comparisonMode =
    profile.comparisonMode;

  return plan;
}

/**
 * Refine flags beyond the primary strategy profile
 * using secondary rule signals.
 *
 * @param {ExecutionPlan} plan
 * @param {object[]} matchedRules
 * @returns {ExecutionPlan}
 */
function refinePlan(plan, matchedRules = []) {
  const ids = new Set(
    matchedRules.map((rule) => rule.id),
  );

  /*
   * Classification / "is X a Y" always needs
   * ontology + inference + graph support.
   */
  if (ids.has("CLASSIFICATION")) {
    plan.requiresSemanticSearch = true;
    plan.requiresGraphTraversal = true;
    plan.requiresInference = true;
    plan.requiresOntologyExpansion = true;
    plan.requiresTruthEvaluation = true;

    if (
      plan.strategy !==
        EXECUTION_STRATEGY.COMPARISON
    ) {
      plan.strategy =
        EXECUTION_STRATEGY.REASONING;
    }
  }

  /*
   * Relationship questions need shortest path.
   */
  if (ids.has("EXPLAIN")) {
    plan.requiresSemanticSearch = true;
    plan.requiresGraphTraversal = true;
    plan.requiresShortestPath = true;
    plan.requiresTruthEvaluation = true;

    if (
      !ids.has("CLASSIFICATION") &&
      !ids.has("COMPARE")
    ) {
      plan.requiresInference = false;
      plan.strategy =
        EXECUTION_STRATEGY.GRAPH;
    }
  }

  /*
   * Definitions: semantic + ontology, skip graph/inference.
   */
  if (
    ids.has("DEFINITION") &&
    !ids.has("COMPARE") &&
    !ids.has("CLASSIFICATION") &&
    !ids.has("EXPLAIN")
  ) {
    plan.requiresSemanticSearch = true;
    plan.requiresOntologyExpansion = true;
    plan.requiresGraphTraversal = false;
    plan.requiresShortestPath = false;
    plan.requiresInference = false;
    plan.requiresTruthEvaluation = true;
    plan.strategy =
      EXECUTION_STRATEGY.ONTOLOGY;
  }

  /*
   * Comparisons enable full hybrid + comparison mode.
   */
  if (ids.has("COMPARE")) {
    applyProfile(
      plan,
      EXECUTION_STRATEGY.COMPARISON,
    );
  }

  plan.requiresTruthEvaluation = true;
  plan.rebuildSteps();

  return plan;
}

/**
 * Create exactly one execution plan for a question.
 *
 * @param {string} question
 * @returns {ExecutionPlan}
 */
export function createExecutionPlan(
  question = "",
) {
  const cleaned = normalizeQuestion(question);
  const plan = new ExecutionPlan(cleaned);
  const matched = matchPlannerRules(cleaned);

  plan.matchedRules = matched.map(
    (rule) => rule.id,
  );

  if (matched.length === 0) {
    applyProfile(
      plan,
      EXECUTION_STRATEGY.HYBRID,
    );
    plan.priority = PLAN_PRIORITY.NORMAL;
    plan.rebuildSteps();
    return plan;
  }

  const primary = matched[0];
  applyProfile(plan, primary.strategy);

  plan.priority =
    primary.priority >= 90
      ? PLAN_PRIORITY.HIGH
      : PLAN_PRIORITY.NORMAL;

  return refinePlan(plan, matched);
}

/**
 * Plan against a ReasoningContext (or plain object).
 * Attaches executionPlan to the context.
 *
 * @param {object} input
 * @returns {object}
 */
export function planQuery(input = {}) {
  const context =
    createReasoningContext(input);

  const question =
    context.question ||
    String(input.question || "").trim();

  context.beginStage("Query Planning");

  const plan = createExecutionPlan(question);

  context.executionPlan = plan;
  context.question =
    context.question || plan.question;

  context.endStage("Query Planning", {
    strategy: plan.strategy,
    matchedRules: plan.matchedRules,
    requiresSemanticSearch:
      plan.requiresSemanticSearch,
    requiresGraphTraversal:
      plan.requiresGraphTraversal,
    requiresShortestPath:
      plan.requiresShortestPath,
    requiresInference:
      plan.requiresInference,
    requiresOntologyExpansion:
      plan.requiresOntologyExpansion,
    requiresTruthEvaluation:
      plan.requiresTruthEvaluation,
    comparisonMode: plan.comparisonMode,
    stepsEnabled: plan.steps
      .filter((step) => step.enabled)
      .map((step) => step.id),
  });

  return context;
}

export {
  ExecutionPlan,
  EXECUTION_STRATEGY,
  PLAN_PRIORITY,
  PLANNER_RULES,
};

export default {
  createExecutionPlan,
  planQuery,
  matchPlannerRules,
};
