/**
 * Planner strategy usage statistics.
 */

const strategyCounts = new Map();
let totalPlans = 0;

/**
 * @param {object} plan
 */
export function recordPlannerPlan(plan = {}) {
  const strategy =
    plan.strategy || "UNKNOWN";

  strategyCounts.set(
    strategy,
    (strategyCounts.get(strategy) || 0) +
      1,
  );

  totalPlans += 1;
}

/**
 * @returns {object}
 */
export function collectPlannerStatistics() {
  const byStrategy = {};

  for (const [
    strategy,
    count,
  ] of strategyCounts.entries()) {
    byStrategy[strategy] = count;
  }

  return {
    totalPlans,
    byStrategy,
  };
}

export function clearPlannerStatistics() {
  strategyCounts.clear();
  totalPlans = 0;
}
