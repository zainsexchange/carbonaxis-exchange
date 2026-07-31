/**
 * Formal reasoning context — shared mutable state
 * for the Carbon Brain reasoning pipeline.
 *
 * Modules mutate one context (compiler-style)
 * instead of passing anonymous plain objects.
 */

function emptyMetrics() {
  return {
    retrievalTime: 0,
    graphTraversalTime: 0,
    inferenceTime: 0,
    reasoningTime: 0,
    truthTime: 0,
    totalExecutionTime: 0,
    cacheHit: false,
  };
}

export class ReasoningContext {
  /**
   * @param {string} [question]
   */
  constructor(question = "") {
    this.question = String(question || "").trim();

    this.retrievedChunks = [];
    this.documentEvidence = [];
    this.entities = [];
    this.relationships = [];

    this.graphEvidence = [];
    this.inferredEvidence = [];
    this.ontologyEvidence = [];

    /*
     * Compatibility alias used by normalizeEvidence().
     */
    this.inferredRelationships = [];

    this.evidence = [];
    this.conflicts = [];
    this.contradictions = [];

    this.confidence = null;
    this.explanation = null;
    this.truthResult = null;
    this.truthStatus = null;

    this.executionPlan = null;

    this.executionTrace = [];
    this.metrics = emptyMetrics();

    this._stageStartedAt = new Map();
    this._pipelineStartedAt = Date.now();
  }

  /**
   * Build a ReasoningContext from a plain query object
   * or return the same instance if already typed.
   *
   * @param {object|ReasoningContext} input
   * @returns {ReasoningContext}
   */
  static fromInput(input = {}) {
    if (input instanceof ReasoningContext) {
      return input;
    }

    const context = new ReasoningContext(
      input.question || "",
    );

    context.retrievedChunks = Array.isArray(
      input.retrievedChunks,
    )
      ? [...input.retrievedChunks]
      : [];

    context.documentEvidence = Array.isArray(
      input.documentEvidence,
    )
      ? [...input.documentEvidence]
      : [];

    context.entities = Array.isArray(
      input.entities,
    )
      ? [...input.entities]
      : [];

    context.relationships = Array.isArray(
      input.relationships,
    )
      ? [...input.relationships]
      : [];

    context.graphEvidence = Array.isArray(
      input.graphEvidence,
    )
      ? [...input.graphEvidence]
      : [];

    const inferred = Array.isArray(
      input.inferredEvidence,
    )
      ? input.inferredEvidence
      : Array.isArray(
            input.inferredRelationships,
          )
        ? input.inferredRelationships
        : [];

    context.inferredEvidence = [...inferred];
    context.inferredRelationships = [
      ...inferred,
    ];

    context.ontologyEvidence = Array.isArray(
      input.ontologyEvidence,
    )
      ? [...input.ontologyEvidence]
      : [];

    if (Array.isArray(input.evidence)) {
      context.evidence = [...input.evidence];
    }

    if (input.executionPlan) {
      context.executionPlan =
        input.executionPlan;
    }

    if (
      input.metrics &&
      typeof input.metrics === "object"
    ) {
      context.metrics = {
        ...emptyMetrics(),
        ...input.metrics,
      };
    }

    return context;
  }

  /**
   * @param {string} stage
   * @returns {ReasoningContext}
   */
  beginStage(stage) {
    const name = String(stage || "Unknown");
    this._stageStartedAt.set(name, Date.now());
    return this;
  }

  /**
   * @param {string} stage
   * @param {object} [details]
   * @returns {object}
   */
  endStage(stage, details = {}) {
    const name = String(stage || "Unknown");
    const startedAt =
      this._stageStartedAt.get(name) ??
      Date.now();

    const finishedAt = Date.now();
    const duration = finishedAt - startedAt;

    this._stageStartedAt.delete(name);

    const entry = {
      stage: name,
      startedAt,
      finishedAt,
      duration,
      ...details,
    };

    this.executionTrace.push(entry);
    return entry;
  }

  /**
   * @param {string} key
   * @param {number} valueMs
   * @returns {ReasoningContext}
   */
  setMetric(key, valueMs) {
    if (
      key &&
      Object.prototype.hasOwnProperty.call(
        this.metrics,
        key,
      )
    ) {
      this.metrics[key] = Number(valueMs) || 0;
    }

    return this;
  }

  /**
   * @param {number} [startedAt]
   * @returns {ReasoningContext}
   */
  markTotal(startedAt = this._pipelineStartedAt) {
    this.metrics.totalExecutionTime =
      Date.now() - Number(startedAt || Date.now());

    return this;
  }

  /**
   * Snapshot for caching / API responses.
   *
   * @returns {object}
   */
  toJSON() {
    return {
      question: this.question,
      retrievedChunks: this.retrievedChunks,
      documentEvidence: this.documentEvidence,
      entities: this.entities,
      relationships: this.relationships,
      graphEvidence: this.graphEvidence,
      inferredEvidence: this.inferredEvidence,
      ontologyEvidence: this.ontologyEvidence,
      evidence: this.evidence,
      conflicts: this.conflicts,
      contradictions: this.contradictions,
      confidence: this.confidence,
      explanation: this.explanation,
      truthResult: this.truthResult,
      truthStatus: this.truthStatus,
      executionPlan: this.executionPlan
        ? this.executionPlan.toJSON
          ? this.executionPlan.toJSON()
          : this.executionPlan
        : null,
      executionTrace: this.executionTrace,
      metrics: { ...this.metrics },
    };
  }
}

/**
 * @param {object|ReasoningContext} input
 * @returns {ReasoningContext}
 */
export function createReasoningContext(
  input = {},
) {
  if (
    typeof input === "string" ||
    typeof input === "number"
  ) {
    return new ReasoningContext(String(input));
  }

  return ReasoningContext.fromInput(input);
}

export default ReasoningContext;
