/**
 * Liveness probe — process is up.
 */

export function checkLiveness() {
  return {
    status: "ok",
    alive: true,
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export default checkLiveness;
