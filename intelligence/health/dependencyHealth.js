/**
 * Dependency health checks (OpenAI, Mongo, memory).
 */

/**
 * @returns {object}
 */
export function checkDependencyHealth() {
  const memory = process.memoryUsage();
  const heapUsedMb = Number(
    (memory.heapUsed / 1024 / 1024)
      .toFixed(2),
  );

  const env = {
    openaiConfigured: Boolean(
      process.env.OPENAI_API_KEY,
    ),
    mongoConfigured: Boolean(
      process.env.MONGODB_URI ||
        process.env.MONGO_URI,
    ),
  };

  const memoryOk = heapUsedMb < 1024;

  return {
    status:
      memoryOk ? "healthy" : "degraded",
    dependencies: {
      memory: {
        status: memoryOk ? "ok" : "high",
        heapUsedMb,
      },
      openai: {
        status: env.openaiConfigured
          ? "configured"
          : "missing",
      },
      mongo: {
        status: env.mongoConfigured
          ? "configured"
          : "missing",
      },
    },
    timestamp: new Date().toISOString(),
  };
}

export default checkDependencyHealth;
