import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  loadFixture,
  buildEvidenceFromFixture,
} from "../fixtures/loadFixture.js";

import {
  planQuery,
} from "../../intelligence/planner/queryPlanner.js";

import {
  runInference,
} from "../../intelligence/reasoning/inferenceEngine.js";

import {
  evaluateTruth,
} from "../../intelligence/truth/truthEngine.js";

import {
  clearReasoningCache,
} from "../../intelligence/cache/reasoningCache.js";

import {
  resetEvidenceSequence,
} from "../../intelligence/truth/evidenceModel.js";

describe("Integration — full reasoning flow", () => {
  it("runs planner → graph → inference → truth", async () => {
    clearReasoningCache();
    resetEvidenceSequence();

    const fixture = loadFixture("hydrogen");
    const streams =
      buildEvidenceFromFixture(fixture);

    const inferred = runInference();

    const context = planQuery({
      question:
        "Is Green Hydrogen a clean fuel?",
      retrievedChunks:
        streams.retrievedChunks,
      graphEvidence: streams.graphEvidence,
      inferredEvidence: inferred,
      ontologyEvidence:
        streams.ontologyEvidence,
    });

    assert.equal(
      context.executionPlan.strategy,
      "REASONING",
    );
    assert.equal(
      context.executionPlan
        .requiresInference,
      true,
    );

    const result = await evaluateTruth(
      context,
      { useCache: false },
    );

    assert.ok(result.executionPlan);
    assert.ok(
      result.executionTrace.some(
        (entry) =>
          entry.stage === "Query Planning",
      ),
    );
    assert.ok(result.metrics);
    assert.ok(
      typeof result.confidence === "number",
    );
    assert.ok(result.truthStatus);
    assert.ok(
      ["SUPPORTED", "PARTIALLY_SUPPORTED"]
        .includes(result.truthStatus),
    );
  });

  it("includes metrics and cache behavior", async () => {
    clearReasoningCache();
    resetEvidenceSequence();

    const fixture = loadFixture(
      "gcc_energy",
    );
    const streams =
      buildEvidenceFromFixture(fixture);

    const payload = {
      question:
        "How is UAE related to Green Hydrogen?",
      ...streams,
    };

    const first = await evaluateTruth(
      payload,
    );
    const second = await evaluateTruth(
      payload,
    );

    assert.equal(
      first.executionPlan.strategy,
      "GRAPH",
    );
    assert.equal(
      first.metrics.cacheHit,
      false,
    );
    assert.equal(
      second.metrics.cacheHit,
      true,
    );
    assert.ok(
      first.metrics.totalExecutionTime >= 0,
    );
  });
});
