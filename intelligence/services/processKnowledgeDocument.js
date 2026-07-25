import mongoose from "mongoose";

import KnowledgeDocument from "../models/KnowledgeDocument.js";
import KnowledgeChunk from "../models/KnowledgeChunk.js";
import KnowledgeEmbedding from "../models/KnowledgeEmbedding.js";
import KnowledgeJob from "../models/KnowledgeJob.js";

import { extractDocumentText } from "./extractDocumentText.js";
import { extractDocumentMetadata } from "./extractDocumentMetadata.js";
import { chunkDocumentText } from "./chunkDocumentText.js";
import { generateEmbeddings } from "./generateEmbeddings.js";

function asDate(value) {
  if (!value) return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pickExistingOrExtracted(existingValue, extractedValue) {
  const existing = String(existingValue || "").trim();

  if (existing && existing.toLowerCase() !== "other") {
    return existingValue;
  }

  return extractedValue;
}

async function updateJob(jobId, updates) {
  if (!jobId) return null;

  return KnowledgeJob.findByIdAndUpdate(
    jobId,
    {
      ...updates,
      updatedAt: new Date(),
    },
    {
      new: true,
    }
  );
}

export async function processKnowledgeDocument({
  documentId,
  jobId = null,
  requestedBy,
}) {
  const startedAt = Date.now();

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    throw new Error("Invalid knowledge document ID.");
  }

  let createdChunkIds = [];
  let createdEmbeddingIds = [];

  try {
    await updateJob(jobId, {
      status: "processing",
      currentStep: "extracting_text",
      progress: 10,
      startedAt: new Date(),
      attempts: 1,
      errorMessage: "",
      errorCode: "",
    });
        async function updateDocumentProgress(documentId, updates = {}) {
  if (!documentId) {
    return null;
  }

  return KnowledgeDocument.findByIdAndUpdate(
    documentId,
    {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
}

    const document = await KnowledgeDocument.findById(documentId)
      .select("+storageKey");

    if (!document) {
      throw new Error("Knowledge document was not found.");
    }

    if (!document.storageKey) {
      throw new Error("Knowledge document storage path is missing.");
    }

    document.status = "processing";
document.processingStage = "extracting";
document.processingProgress = 10;
document.processingMessage = "Extracting document text.";
document.processingError = "";
document.processingStartedAt = new Date();
document.processingCompletedAt = null;

await document.save();

    /*
     * STEP 1: Extract text
     */
    const extraction = await extractDocumentText({
      filePath: document.storageKey,
      mimeType: document.mimeType,
    });
    await updateDocumentProgress(document._id, {
  processingStage: "metadata",
  processingProgress: 30,
  processingMessage: "Extracting and enriching document metadata.",
  extractedCharacterCount: extraction.characterCount,
  pageCount: extraction.pageCount,
});

    await updateJob(jobId, {
      currentStep: "extracting_metadata",
      progress: 30,
      result: {
        characterCount: extraction.characterCount,
        wordCount: extraction.wordCount,
        pageCount: extraction.pageCount,
        extractionMethod: extraction.extractionMethod,
      },
    });


    /*
     * STEP 2: Extract structured metadata
     *
     * Metadata enrichment is useful, but a temporary OpenAI metadata
     * failure should not destroy otherwise valid document processing.
     */
    let extractedMetadata = null;
    let metadataEngineResult = null;
    let metadataWarning = "";

    try {
      metadataEngineResult = await extractDocumentMetadata({
        text: extraction.text,

        existingMetadata: {
          title: document.title,
          description: document.description,
          country: document.country,
          jurisdiction: document.jurisdiction,
          issuingAuthority: document.issuingAuthority,
          documentType: document.documentType,
          sourceClass: document.sourceClass,
          language: document.language,
          publicationDate: document.publicationDate,
          effectiveDate: document.effectiveDate,
          topics: document.topics,
          sectors: document.sectors,
          tags: document.tags,
        },
      });

      extractedMetadata = metadataEngineResult.metadata;
    } catch (metadataError) {
      metadataWarning = metadataError.message;

      console.warn(
        "Knowledge metadata extraction warning:",
        metadataError.message
      );
    }

    await updateJob(jobId, {
      currentStep: "creating_chunks",
      progress: 45,
      metadata: {
        metadataWarning,
      },
    });

    /*
     * STEP 3: Create deterministic knowledge units
     */
    const chunking = chunkDocumentText(extraction.text);
    await updateDocumentProgress(document._id, {
  processingStage: "chunking",
  processingProgress: 45,
  processingMessage: "Creating searchable knowledge chunks.",
});

    const temporaryChunks = chunking.chunks.map((chunk) => ({
      _id: new mongoose.Types.ObjectId(),

      documentId: document._id,

      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      pageNumber: null,
      sectionTitle: chunk.sectionTitle,
      tokenCount: chunk.tokenCount,

      language:
        extractedMetadata?.language ||
        document.language ||
        "English",

      country:
        extractedMetadata?.country ||
        document.country ||
        "Global",

      documentType:
        extractedMetadata?.documentType ||
        document.documentType ||
        "other",

      sourceClass:
        extractedMetadata?.sourceClass ||
        document.sourceClass ||
        "other",

      status: "processing",

      visibility: document.visibility,
      ownerId: document.ownerId,
      workspaceId: document.workspaceId,
      allowedRoles: document.allowedRoles,

      metadata: {
        characterCount: chunk.characterCount,
      },

      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await updateDocumentProgress(document._id, {
  processingStage: "embedding",
  processingProgress: 60,
  processingMessage: `Generating embeddings for ${temporaryChunks.length} chunks.`,
  chunkCount: temporaryChunks.length,
});

    await updateJob(jobId, {
      currentStep: "generating_embeddings",
      progress: 60,
      result: {
        characterCount: extraction.characterCount,
        wordCount: extraction.wordCount,
        pageCount: extraction.pageCount,
        chunkCount: temporaryChunks.length,
        estimatedTokens: chunking.statistics.estimatedTokens,
      },
    });

    /*
     * STEP 4: Generate embeddings before writing to MongoDB.
     *
     * Temporary ObjectIds allow embeddings to reference chunks safely.
     */
    const embeddingResult = await generateEmbeddings(
      temporaryChunks.map((chunk) => ({
        _id: chunk._id,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        visibility: chunk.visibility,
        ownerId: chunk.ownerId,
        workspaceId: chunk.workspaceId,
      }))
    );

    const embeddingDocuments = embeddingResult.embeddings.map(
      (embedding) => ({
        ...embedding,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
    await updateDocumentProgress(document._id, {
  processingStage: "indexing",
  processingProgress: 80,
  processingMessage: `Saving ${embeddingDocuments.length} embeddings to the knowledge index.`,
  embeddingCount: embeddingDocuments.length,
});

    await updateJob(jobId, {
      currentStep: "finalizing",
      progress: 80,
    });

    /*
     * STEP 5: Replace previous processing results safely.
     *
     * The expensive work has already succeeded before existing records
     * are deleted.
     */
    await KnowledgeEmbedding.deleteMany({
      documentId: document._id,
    });

    await KnowledgeChunk.deleteMany({
      documentId: document._id,
    });

    const insertedChunks =
      await KnowledgeChunk.insertMany(temporaryChunks);

    createdChunkIds = insertedChunks.map((chunk) => chunk._id);

    const insertedEmbeddings =
      await KnowledgeEmbedding.insertMany(embeddingDocuments);

    createdEmbeddingIds = insertedEmbeddings.map(
      (embedding) => embedding._id
    );

    await KnowledgeChunk.updateMany(
      {
        documentId: document._id,
      },
      {
        $set: {
          status: "ready",
        },
      }
    );
    await updateDocumentProgress(document._id, {
  processingStage: "indexing",
  processingProgress: 95,
  processingMessage: "Finalizing repository records and document metadata.",
  chunkCount: insertedChunks.length,
  embeddingCount: insertedEmbeddings.length,
});

    /*
     * STEP 6: Enrich the parent document.
     *
     * Manually entered values are preserved where appropriate.
     */
    if (extractedMetadata) {
      document.title = pickExistingOrExtracted(
        document.title,
        extractedMetadata.title
      );

      document.description = pickExistingOrExtracted(
        document.description,
        extractedMetadata.description
      );

      document.country = pickExistingOrExtracted(
        document.country,
        extractedMetadata.country
      );

      document.jurisdiction = pickExistingOrExtracted(
        document.jurisdiction,
        extractedMetadata.jurisdiction
      );

      document.issuingAuthority = pickExistingOrExtracted(
        document.issuingAuthority,
        extractedMetadata.issuingAuthority
      );

      document.documentType = pickExistingOrExtracted(
        document.documentType,
        extractedMetadata.documentType
      );

      document.sourceClass = pickExistingOrExtracted(
        document.sourceClass,
        extractedMetadata.sourceClass
      );

      document.language = pickExistingOrExtracted(
        document.language,
        extractedMetadata.language
      );

      document.publicationDate =
        document.publicationDate ||
        asDate(extractedMetadata.publicationDate);

      document.effectiveDate =
        document.effectiveDate ||
        asDate(extractedMetadata.effectiveDate);

      document.topics =
        document.topics?.length > 0
          ? document.topics
          : extractedMetadata.topics;

      document.sectors =
        document.sectors?.length > 0
          ? document.sectors
          : extractedMetadata.sectors;

      document.tags =
        document.tags?.length > 0
          ? document.tags
          : extractedMetadata.tags;
    }

    document.status = "pending_review";
    document.processingStage = "completed";
document.processingProgress = 100;
document.processingMessage = metadataWarning
  ? "Processing completed with a metadata warning. Human review is required."
  : "Document processing completed successfully.";
document.processingError = "";
document.processingCompletedAt = new Date();
document.indexedAt = new Date();

document.chunkCount = insertedChunks.length;
document.embeddingCount = insertedEmbeddings.length;
document.pageCount = extraction.pageCount;
document.extractedCharacterCount = extraction.characterCount;

    document.metadata = {
      ...(document.metadata || {}),

      processing: {
        characterCount: extraction.characterCount,
        wordCount: extraction.wordCount,
        pageCount: extraction.pageCount,
        extractionMethod: extraction.extractionMethod,

        chunkCount: insertedChunks.length,
        embeddingCount: insertedEmbeddings.length,
        embeddingModel: embeddingResult.statistics.model,
        embeddingDimensions:
          embeddingResult.statistics.dimensions,

        processedAt: new Date(),
        processedBy: requestedBy || null,
      },

      aiMetadata: extractedMetadata
        ? {
            summary: extractedMetadata.summary,
            technologies: extractedMetadata.technologies,
            standardsReferenced:
              extractedMetadata.standardsReferenced,
            targets: extractedMetadata.targets,
            extractionConfidence:
              extractedMetadata.extractionConfidence,
            requiresHumanReview:
              extractedMetadata.requiresHumanReview,
            provider: metadataEngineResult.provider,
            model: metadataEngineResult.model,
            responseId: metadataEngineResult.responseId,
            tokenUsage: metadataEngineResult.tokenUsage,
          }
        : {
            warning: metadataWarning,
            requiresHumanReview: true,
          },
    };

    await document.save();

    const result = {
      documentId: document._id,
      status: document.status,

      extraction: {
        characterCount: extraction.characterCount,
        wordCount: extraction.wordCount,
        pageCount: extraction.pageCount,
        extractionMethod: extraction.extractionMethod,
      },

      chunks: {
        count: insertedChunks.length,
        estimatedTokens: chunking.statistics.estimatedTokens,
      },

      embeddings: {
        count: insertedEmbeddings.length,
        model: embeddingResult.statistics.model,
        dimensions: embeddingResult.statistics.dimensions,
      },

      metadata: {
        extracted: Boolean(extractedMetadata),
        warning: metadataWarning,
      },

      latencyMs: Date.now() - startedAt,
    };

    await updateJob(jobId, {
      status: "completed",
      currentStep: "completed",
      progress: 100,
      completedAt: new Date(),
      result,
    });

    return result;
  } catch (error) {
    console.error("Knowledge document processing failed:", error);

    /*
     * Cleanup applies only to records created during this processing run.
     */
    if (createdEmbeddingIds.length > 0) {
      await KnowledgeEmbedding.deleteMany({
        _id: {
          $in: createdEmbeddingIds,
        },
      }).catch(() => {});
    }

    if (createdChunkIds.length > 0) {
      await KnowledgeChunk.deleteMany({
        _id: {
          $in: createdChunkIds,
        },
      }).catch(() => {});
    }

    await KnowledgeDocument.findByIdAndUpdate(
  documentId,
  {
    $set: {
      status: "failed",
      processingStage: "failed",
      processingMessage: "Document processing failed.",
      processingError: String(
        error.message || "Unknown processing error."
      ).slice(0, 5000),
      processingCompletedAt: new Date(),
    },
  },
  {
    runValidators: true,
  }
).catch(() => {});

    await updateJob(jobId, {
      status: "failed",
      currentStep: "failed",
      failedAt: new Date(),
      errorMessage: error.message,
      errorCode: error.code || "PROCESSING_FAILED",
    }).catch(() => {});

    throw error;
  }
}