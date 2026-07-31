/**
 * Execution strategy enum — explicit planner decisions.
 */
export const EXECUTION_STRATEGY = Object.freeze({
  SEMANTIC: "SEMANTIC",
  GRAPH: "GRAPH",
  ONTOLOGY: "ONTOLOGY",
  HYBRID: "HYBRID",
  COMPARISON: "COMPARISON",
  REASONING: "REASONING",
});

export const PLAN_PRIORITY = Object.freeze({
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
});

/**
 * Contract between the query planner and the engine.
 * Every question produces exactly one ExecutionPlan.
 */
export class ExecutionPlan {
  /**
   * @param {string} [question]
   */
  constructor(question = "") {
    this.question = String(question || "").trim();

    this.steps = [];
    this.strategy = EXECUTION_STRATEGY.HYBRID;
    this.priority = PLAN_PRIORITY.NORMAL;

    this.requiresSemanticSearch = false;
    this.requiresGraphTraversal = false;
    this.requiresShortestPath = false;
    this.requiresInference = false;
    this.requiresOntologyExpansion = false;
    this.requiresTruthEvaluation = true;
    this.comparisonMode = false;

    this.matchedRules = [];
    this.createdAt = new Date().toISOString();
  }

  /**
   * @param {string} id
   * @param {object} [details]
   * @returns {ExecutionPlan}
   */
  addStep(id, details = {}) {
    this.steps.push({
      id: String(id || "").trim(),
      enabled: details.enabled !== false,
      ...details,
    });

    return this;
  }

  /**
   * Rebuild the ordered step list from boolean flags.
   *
   * @returns {ExecutionPlan}
   */
  rebuildSteps() {
    this.steps = [];

    this.addStep("SEMANTIC_RETRIEVAL", {
      enabled: this.requiresSemanticSearch,
    });

    this.addStep("GRAPH_TRAVERSAL", {
      enabled: this.requiresGraphTraversal,
    });

    this.addStep("SHORTEST_PATH", {
      enabled: this.requiresShortestPath,
    });

    this.addStep("ONTOLOGY_EXPANSION", {
      enabled: this.requiresOntologyExpansion,
    });

    this.addStep("INFERENCE", {
      enabled: this.requiresInference,
    });

    this.addStep("TRUTH_EVALUATION", {
      enabled: this.requiresTruthEvaluation,
    });

    this.addStep("COMPARISON", {
      enabled: this.comparisonMode,
    });

    return this;
  }

  /**
   * @returns {object}
   */
  toJSON() {
    return {
      question: this.question,
      strategy: this.strategy,
      priority: this.priority,
      requiresSemanticSearch:
        this.requiresSemanticSearch,
      requiresGraphTraversal:
        this.requiresGraphTraversal,
      requiresShortestPath:
        this.requiresShortestPath,
      requiresInference:
        this.requiresInference,
      requiresOntologyExpansion:
        this.requiresOntologyExpansion,
      requiresTruthEvaluation:
        this.requiresTruthEvaluation,
      comparisonMode: this.comparisonMode,
      matchedRules: [...this.matchedRules],
      steps: this.steps.map((step) => ({
        ...step,
      })),
      createdAt: this.createdAt,
    };
  }
}

export default ExecutionPlan;
