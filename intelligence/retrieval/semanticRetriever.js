import mongoose from "mongoose";

import KnowledgeEmbedding from "../models/KnowledgeEmbedding.js";
import { generateEmbeddings } from "../services/generateEmbeddings.js";

const VECTOR_INDEX_NAME =
  process.env.VECTOR_INDEX_NAME ||
  "carbon_brain_vector_index";

const DEFAULT_LIMIT = 8;
const MAXIMUM_LIMIT = 20;
const DEFAULT_MINIMUM_SCORE = 0.5;

function normalizeRole(value = "") {
  return String(value).trim().toLowerCase();
}

function asObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}

/**
 * Build permissions before vector retrieval.
 *
 * Public:
 * Available to authenticated users.
 *
 * Internal:
 * CarbonAxis administrators only.
 *
 * Private:
 * Owner only.
 *
 * Workspace:
 * Matching workspace only.
 */
function buildAccessFilter(user = {}) {
  const userId = asObjectId(user.id || user._id);
  const workspaceId = asObjectId(user.workspaceId);
  const role = normalizeRole(user.role);

  const accessRules = [
    {
      visibility: {
        $eq: "public",
      },
    },
  ];

  if (role === "admin") {
    accessRules.push({
      visibility: {
        $eq: "internal",
      },
    });
  }

  if (userId) {
    accessRules.push({
      $and: [
        {
          visibility: {
            $eq: "private",
          },
        },
        {
          ownerId: {
            $eq: userId,
          },
        },
      ],
    });
  }

  if (workspaceId) {
    accessRules.push({
      $and: [
        {
          visibility: {
            $eq: "workspace",
          },
        },
        {
          workspaceId: {
            $eq: workspaceId,
          },
        },
      ],
    });
  }

  return {
    $and: [
      {
        active: {
          $eq: true,
        },
      },
      {
        status: {
          $eq: "ready",
        },
      },
      {
        $or: accessRules,
      },
    ],
  };
}

function validateQuestion(question) {
  const value = String(question || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (value.length < 3) {
    throw new Error(
      "A question of at least 3 characters is required."
    );
  }

  if (value.length > 4000) {
    throw new Error(
      "The semantic-search question cannot exceed 4,000 characters."
    );
  }

  return value;
}

function resolveLimit(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAXIMUM_LIMIT);
}

function resolveMinimumScore(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_MINIMUM_SCORE;
  }

  return Math.max(0, Math.min(1, parsed));
}

export async function semanticRetrieve({
  question,
  user,
  limit = DEFAULT_LIMIT,
  minimumScore = DEFAULT_MINIMUM_SCORE,
}) {
  const startedAt = Date.now();

  const cleanedQuestion = validateQuestion(question);
  const resolvedLimit = resolveLimit(limit);
  const resolvedMinimumScore =
    resolveMinimumScore(minimumScore);

  /*
   * Generate one embedding for the user's question.
   */
  const queryEmbeddingResult = await generateEmbeddings([
    {
      chunkIndex: 0,
      content: cleanedQuestion,
      visibility: "internal",
    },
  ]);

  const queryVector =
    queryEmbeddingResult.embeddings[0]?.embedding;

  if (!Array.isArray(queryVector) || !queryVector.length) {
    throw new Error(
      "The query embedding could not be generated."
    );
  }

  /*
   * MongoDB recommends considering more candidates than the final
   * result count. We use 20x the requested limit, within a safe cap.
   */
  const numCandidates = Math.min(
    Math.max(resolvedLimit * 20, 100),
    1000
  );

  const accessFilter = buildAccessFilter(user);

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector,
        numCandidates,
        limit: resolvedLimit * 2,
        filter: accessFilter,
      },
    },

    {
      $set: {
        score: {
          $meta: "vectorSearchScore",
        },
      },
    },

    {
      $match: {
        score: {
          $gte: resolvedMinimumScore,
        },
      },
    },

    /*
     * Retrieve the knowledge unit belonging to the vector.
     */
    {
      $lookup: {
        from: "knowledge_chunks",
        localField: "chunkId",
        foreignField: "_id",
        as: "chunk",
      },
    },

    {
      $unwind: "$chunk",
    },

    /*
     * Retrieve safe document metadata for citations.
     */
    {
      $lookup: {
        from: "knowledge_documents",
        localField: "documentId",
        foreignField: "_id",
        as: "document",
      },
    },

    {
      $unwind: "$document",
    },

    /*
     * Public users should only receive published public documents.
     * Admins may inspect internal and pending-review material.
     */
    {
      $match:
        normalizeRole(user?.role) === "admin"
          ? {
              "document.status": {
                $in: [
                  "pending_review",
                  "verified",
                  "published",
                ],
              },
            }
          : {
              $or: [
                {
                  "document.visibility": "public",
                  "document.status": "published",
                },
                {
                  "document.visibility": "private",
                  "document.ownerId": asObjectId(
                    user?.id || user?._id
                  ),
                  "document.status": {
                    $in: [
                      "pending_review",
                      "verified",
                      "published",
                    ],
                  },
                },
                ...(asObjectId(user?.workspaceId)
                  ? [
                      {
                        "document.visibility": "workspace",
                        "document.workspaceId": asObjectId(
                          user.workspaceId
                        ),
                        "document.status": {
                          $in: [
                            "pending_review",
                            "verified",
                            "published",
                          ],
                        },
                      },
                    ]
                  : []),
              ],
            },
    },

    {
      $sort: {
        score: -1,
      },
    },

    {
      $limit: resolvedLimit,
    },

    /*
     * Never return:
     * - raw embedding vectors;
     * - private storage paths;
     * - checksums;
     * - internal model data.
     */
    {
      $project: {
        _id: 0,

        score: 1,
        chunkId: "$chunk._id",
        documentId: "$document._id",

        content: "$chunk.content",
        chunkIndex: "$chunk.chunkIndex",
        pageNumber: "$chunk.pageNumber",
        sectionTitle: "$chunk.sectionTitle",

        visibility: "$document.visibility",

        document: {
          title: "$document.title",
          description: "$document.description",
          country: "$document.country",
          jurisdiction: "$document.jurisdiction",
          issuingAuthority:
            "$document.issuingAuthority",
          documentType: "$document.documentType",
          sourceClass: "$document.sourceClass",
          officialUrl: "$document.officialUrl",
          publicationDate:
            "$document.publicationDate",
          effectiveDate: "$document.effectiveDate",
          lastVerifiedAt:
            "$document.lastVerifiedAt",
          status: "$document.status",
          version: "$document.version",
          allowQuotation:
            "$document.allowQuotation",
          allowDownload:
            "$document.allowDownload",
        },
      },
    },
  ];

  const results =
    await KnowledgeEmbedding.aggregate(pipeline);

  console.log("Semantic Retrieval:", {
    resultCount: results.length,
    minimumScore: resolvedMinimumScore,
    user,
  });

  if (results.length) {
    console.log("Top Result:", {
      score: results[0].score,
      title: results[0].document?.title,
      visibility: results[0].visibility,
      status: results[0].document?.status,
    });
  }

  return {
    question: cleanedQuestion,

    results,

    statistics: {
      resultCount: results.length,
      requestedLimit: resolvedLimit,
      minimumScore: resolvedMinimumScore,
      numCandidates,
      embeddingModel:
        queryEmbeddingResult.statistics.model,
      embeddingDimensions:
        queryEmbeddingResult.statistics.dimensions,
      latencyMs: Date.now() - startedAt,
    },
  };
}

export {
  buildAccessFilter,
};