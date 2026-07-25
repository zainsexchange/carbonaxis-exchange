import mongoose from "mongoose";
import KnowledgeDocument from "./intelligence/models/KnowledgeDocument.js";

const testUserId = new mongoose.Types.ObjectId();

const document = new KnowledgeDocument({
  title: "Carbon Brain Test Document",
  fileName: "carbon-brain-test.pdf",
  checksum: "test-checksum-caip-014",
  createdBy: testUserId,
});

const validationError = document.validateSync();

if (validationError) {
  console.error("Validation failed:");
  console.error(validationError);
  process.exit(1);
}

console.log("KnowledgeDocument model validation passed.");

console.log({
  title: document.title,
  status: document.status,
  processingStage: document.processingStage,
  processingProgress: document.processingProgress,
  sourceTrustScore: document.sourceTrustScore,
  chunkCount: document.chunkCount,
  embeddingCount: document.embeddingCount,
  pageCount: document.pageCount,
  extractedCharacterCount:
    document.extractedCharacterCount,
  active: document.active,
  visibility: document.visibility,
  metadata: document.metadata,
});