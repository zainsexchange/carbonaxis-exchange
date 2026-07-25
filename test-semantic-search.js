import "dotenv/config";
import mongoose from "mongoose";

import { semanticRetrieve } from "./intelligence/retrieval/semanticRetriever.js";

try {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("MongoDB connected");

  const result = await semanticRetrieve({
    question:
      "What does the strategy say about renewable energy and green hydrogen?",

    user: {
      // Admin is needed because your test document is internal.
      id: process.env.TEST_ADMIN_USER_ID,
      role: "admin",
      workspaceId: null,
    },

    limit: 5,
    minimumScore: 0.3,
  });

  console.log(result.statistics);

  console.log(
    result.results.map((item) => ({
      score: item.score,
      title: item.document?.title,
      sectionTitle: item.sectionTitle,
      preview: item.content?.slice(0, 250),
    }))
  );
} catch (error) {
  console.error("Semantic search failed:");
  console.error(error);
} finally {
  await mongoose.disconnect();
}