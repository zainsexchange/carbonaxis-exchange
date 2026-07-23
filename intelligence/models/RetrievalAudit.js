import mongoose from "mongoose";

const retrievalAuditSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatThread",
      default: null,
      index: true,
    },

    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    mode: {
      type: String,
      enum: ["general", "green", "compare", "project", "enterprise"],
      default: "green",
      index: true,
    },

    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    retrievedChunks: [
      {
        chunkId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "KnowledgeChunk",
          required: true,
        },

        documentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "KnowledgeDocument",
          required: true,
        },

        score: {
          type: Number,
          default: 0,
        },

        pageNumber: {
          type: Number,
          default: null,
        },

        sectionTitle: {
          type: String,
          default: "",
        },

        visibility: {
          type: String,
          enum: ["public", "internal", "private", "workspace"],
          required: true,
        },
      },
    ],

    sourceDocumentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "KnowledgeDocument",
      },
    ],

    provider: {
      type: String,
      default: "openai",
      trim: true,
    },

    model: {
      type: String,
      default: "",
      trim: true,
    },

    promptVersion: {
      type: String,
      default: "rag-v1",
      trim: true,
    },

    reliabilityLevel: {
      type: String,
      enum: [
        "official_source",
        "strong_evidence",
        "partial_evidence",
        "general_answer",
        "insufficient_evidence",
      ],
      default: "general_answer",
      index: true,
    },

    reliabilityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },

    answer: {
      type: String,
      default: "",
      maxlength: 30000,
    },

    attemptedExtraction: {
      type: Boolean,
      default: false,
      index: true,
    },

    refusalReason: {
      type: String,
      default: "",
      trim: true,
    },

    latencyMs: {
      type: Number,
      default: 0,
      min: 0,
    },

    tokenUsage: {
      inputTokens: {
        type: Number,
        default: 0,
        min: 0,
      },

      outputTokens: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalTokens: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "retrieval_audits",
  }
);

retrievalAuditSchema.index({
  userId: 1,
  createdAt: -1,
});

retrievalAuditSchema.index({
  reliabilityLevel: 1,
  attemptedExtraction: 1,
  createdAt: -1,
});

const RetrievalAudit =
  mongoose.models.RetrievalAudit ||
  mongoose.model("RetrievalAudit", retrievalAuditSchema);

export default RetrievalAudit;