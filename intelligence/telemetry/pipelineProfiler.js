/**
 * Profiles pipeline stage timings from executionTrace.
 */

/**
 * @param {object[]} executionTrace
 * @returns {object}
 */
export function profileExecutionTrace(
  executionTrace = [],
) {
  const stages = {};

  for (const entry of executionTrace || []) {
    const name = entry.stage || "Unknown";

    if (!stages[name]) {
      stages[name] = {
        count: 0,
        totalMs: 0,
        maxMs: 0,
      };
    }

    const duration = Number(
      entry.duration,
    ) || 0;

    stages[name].count += 1;
    stages[name].totalMs += duration;
    stages[name].maxMs = Math.max(
      stages[name].maxMs,
      duration,
    );
  }

  const totalMs = Object.values(stages)
    .reduce(
      (sum, stage) => sum + stage.totalMs,
      0,
    );

  return {
    totalMs,
    stages,
  };
}

/**
 * @param {object} context
 * @returns {object}
 */
export function profileReasoningContext(
  context = {},
) {
  return {
    question: context.question || null,
    strategy:
      context.executionPlan?.strategy ||
      null,
    profile: profileExecutionTrace(
      context.executionTrace,
    ),
    metrics: {
      ...(context.metrics || {}),
    },
  };
}
