import crypto from "crypto";
import openai, {
  AI_MODELS,
  EMBEDDING_DIMENSIONS,
} from "../config/openai.js";
const DEFAULT_MODEL =
AI_MODELS.EMBEDDING;

const DEFAULT_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS || 1536
);

const MAX_BATCH_SIZE = 50;
const MAX_TEXT_CHARACTERS = 24000;

function cleanEmbeddingText(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_CHARACTERS);
}

function createContentChecksum(value = "") {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function splitIntoBatches(items, batchSize = MAX_BATCH_SIZE) {
  const batches = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

function validateDimensions(value) {
  if (!Number.isInteger(value) || value < 1 || value > 4096) {
    throw new Error(
      "EMBEDDING_DIMENSIONS must be an integer between 1 and 4096."
    );
  }

  return value;
}

export async function generateEmbeddings(
  chunks,
  {
    model = DEFAULT_MODEL,
    dimensions = DEFAULT_DIMENSIONS,
  } = {}
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required to generate embeddings."
    );
  }

  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error(
      "At least one knowledge chunk is required."
    );
  }

  const resolvedDimensions = validateDimensions(
    Number(dimensions)
  );

  const preparedChunks = chunks.map((chunk, arrayIndex) => {
    const content = cleanEmbeddingText(chunk?.content);

    if (!content || content.length < 20) {
      throw new Error(
        `Chunk at position ${arrayIndex} has insufficient text.`
      );
    }

    return {
      chunkId: chunk?._id || chunk?.chunkId || null,
      documentId: chunk?.documentId || null,
      chunkIndex:
        Number.isInteger(chunk?.chunkIndex)
          ? chunk.chunkIndex
          : arrayIndex,
      content,
      contentChecksum: createContentChecksum(content),
      visibility: chunk?.visibility || "internal",
      ownerId: chunk?.ownerId || null,
      workspaceId: chunk?.workspaceId || null,
    };
  });

  const batches = splitIntoBatches(preparedChunks);
  const generated = [];

  for (const batch of batches) {
    const response = await openai.embeddings.create({
      model,
      input: batch.map((item) => item.content),
      encoding_format: "float",
      dimensions: resolvedDimensions,
    });

    if (
      !Array.isArray(response.data) ||
      response.data.length !== batch.length
    ) {
      throw new Error(
        "Embedding provider returned an unexpected result count."
      );
    }

    const orderedResults = [...response.data].sort(
      (a, b) => a.index - b.index
    );

    orderedResults.forEach((result, resultIndex) => {
      const source = batch[resultIndex];

      if (
        !Array.isArray(result.embedding) ||
        result.embedding.length !== resolvedDimensions
      ) {
        throw new Error(
          `Embedding dimension mismatch for chunk ${source.chunkIndex}.`
        );
      }

      generated.push({
        chunkId: source.chunkId,
        documentId: source.documentId,
        chunkIndex: source.chunkIndex,

        provider: "openai",
        model,
        dimensions: result.embedding.length,
        embedding: result.embedding,

        contentChecksum: source.contentChecksum,
        version: 1,
        active: true,
        status: "ready",

        visibility: source.visibility,
        ownerId: source.ownerId,
        workspaceId: source.workspaceId,

        metadata: {
          sourceCharacters: source.content.length,
        },
      });
    });
  }

  return {
    embeddings: generated,

    statistics: {
      chunkCount: preparedChunks.length,
      batchCount: batches.length,
      model,
      dimensions: resolvedDimensions,
    },
  };
}