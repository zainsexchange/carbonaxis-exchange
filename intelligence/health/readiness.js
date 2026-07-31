/**
 * Readiness probe — app can serve reasoning traffic.
 */

import {
  collectGraphStatistics,
} from "../telemetry/graphStatistics.js";

/**
 * @param {object} [options]
 * @returns {object}
 */
export function checkReadiness(
  options = {},
) {
  const graph = collectGraphStatistics();

  const ready =
    options.requireGraph !== true ||
    graph.entityCount > 0;

  return {
    status: ready ? "ready" : "not_ready",
    ready,
    graph,
    timestamp: new Date().toISOString(),
  };
}

export default checkReadiness;
