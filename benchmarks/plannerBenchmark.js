import {
  createExecutionPlan,
} from "../intelligence/planner/queryPlanner.js";

import {
  recordPlannerPlan,
  collectPlannerStatistics,
  clearPlannerStatistics,
} from "../intelligence/telemetry/plannerStatistics.js";

const SAMPLE_QUESTIONS = [
  "What is Green Hydrogen?",
  "How is UAE related to Green Hydrogen?",
  "Is Green Hydrogen a clean fuel?",
  "Compare UAE and Saudi hydrogen policies.",
  "Where is Solar PV used?",
  "Why does Saudi Arabia support hydrogen?",
];

/**
 * @param {object} [options]
 * @returns {object}
 */
export function runPlannerBenchmark(
  options = {},
) {
  const iterations =
    Number(options.iterations) || 1000;

  clearPlannerStatistics();

  const started = process.hrtime.bigint();

  for (let i = 0; i < iterations; i += 1) {
    const question =
      SAMPLE_QUESTIONS[
        i % SAMPLE_QUESTIONS.length
      ];

    const plan =
      createExecutionPlan(question);

    recordPlannerPlan(plan);
  }

  const elapsedMs =
    Number(
      process.hrtime.bigint() - started,
    ) / 1e6;

  return {
    iterations,
    totalMs: Number(elapsedMs.toFixed(2)),
    avgMs: Number(
      (elapsedMs / iterations).toFixed(4),
    ),
    statistics: collectPlannerStatistics(),
  };
}

export default runPlannerBenchmark;
