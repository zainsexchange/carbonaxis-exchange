import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  createExecutionPlan,
  planQuery,
  EXECUTION_STRATEGY,
} from "../../intelligence/planner/queryPlanner.js";

describe("Query Planner", () => {
  it("plans definition questions as ONTOLOGY", () => {
    const plan = createExecutionPlan(
      "What is Green Hydrogen?",
    );

    assert.equal(
      plan.strategy,
      EXECUTION_STRATEGY.ONTOLOGY,
    );
    assert.equal(
      plan.requiresSemanticSearch,
      true,
    );
    assert.equal(
      plan.requiresOntologyExpansion,
      true,
    );
    assert.equal(
      plan.requiresInference,
      false,
    );
  });

  it("plans relationship questions as GRAPH with shortest path", () => {
    const plan = createExecutionPlan(
      "How is UAE related to Green Hydrogen?",
    );

    assert.equal(
      plan.strategy,
      EXECUTION_STRATEGY.GRAPH,
    );
    assert.equal(
      plan.requiresGraphTraversal,
      true,
    );
    assert.equal(
      plan.requiresShortestPath,
      true,
    );
  });

  it("plans classification with inference", () => {
    const plan = createExecutionPlan(
      "Is Green Hydrogen a clean fuel?",
    );

    assert.equal(
      plan.strategy,
      EXECUTION_STRATEGY.REASONING,
    );
    assert.equal(
      plan.requiresInference,
      true,
    );
  });

  it("attaches execution plans to context", () => {
    const context = planQuery({
      question:
        "Compare UAE and Saudi hydrogen policies.",
    });

    assert.equal(
      context.executionPlan.strategy,
      EXECUTION_STRATEGY.COMPARISON,
    );
    assert.equal(
      context.executionPlan.comparisonMode,
      true,
    );
  });
});
