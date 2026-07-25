import "dotenv/config";
import mongoose from "mongoose";

import { buildTruthPackage } from "./intelligence/truth/truthEngine.js";

try {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("MongoDB connected");

  const result = await buildTruthPackage({
    question:
      "What does the strategy say about renewable energy and green hydrogen?",

    user: {
      id: process.env.TEST_ADMIN_USER_ID,
      role: "admin",
      workspaceId: null,
    },

    retrievalLimit: 10,
    evidenceLimit: 6,
    minimumSemanticScore: 0.3,
    maximumCitations: 6,
  });

  console.log({
    truthStatus: result.truthStatus,
    confidence: result.confidence,
    evidenceSummary: result.evidenceSummary,
    conflictCount: result.conflicts.length,
    citationCount: result.citations.length,
    explainability: result.explainability,
    totalLatencyMs: result.statistics.totalLatencyMs,
  });

  console.log(
    result.citations.map((citation) => ({
      citationId: citation.citationId,
      label: citation.label,
      confidencePercentage:
        citation.confidencePercentage,
    }))
  );
} catch (error) {
  console.error("Truth Engine test failed:");
  console.error(error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}