import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  runPlannerBenchmark,
} from "../../benchmarks/plannerBenchmark.js";

import {
  runInferenceBenchmark,
} from "../../benchmarks/inferenceBenchmark.js";

describe("Performance smoke", () => {
  it("planner stays under budget for 500 plans", () => {
    const result = runPlannerBenchmark({
      iterations: 500,
    });

    assert.ok(result.avgMs < 5);
  });

  it("inference completes on a 100-node chain", () => {
    const result = runInferenceBenchmark({
      chainLength: 100,
    });

    assert.ok(result.inferenceMs < 2000);
    assert.ok(result.inferredCount >= 1);
  });
});
