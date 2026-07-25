import mongoose from "mongoose";

const knowledgeEmbeddingSchema = new mongoose.Schema(
  {
    chunkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeChunk",
      required: true,
      index: true,
    },

    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeDocument",
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["openai", "voyage", "local", "other"],
      default: "openai",
      required: true,
      index: true,
    },

    model: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    dimensions: {
      type: Number,
      required: true,
      min: 1,
    },

    embedding: {
      type: [Number],
      required: true,
      select: false,
    },

    contentChecksum: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    version: {
      type: Number,
      default: 1,
      min: 1,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["ready", "inactive", "failed"],
      default: "ready",
      index: true,
    },

    visibility: {
      type: String,
      enum: ["public", "internal", "private", "workspace"],
      default: "internal",
      index: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },

    metadata: {
  type: mongoose.Schema.Types.Mixed,
  default: () => ({}),
},
  },
  {
    timestamps: true,
    collection: "knowledge_embeddings",
  }
);

knowledgeEmbeddingSchema.index(
  {
    chunkId: 1,
    provider: 1,
    model: 1,
    version: 1,
  },
  {
    unique: true,
  }
);

knowledgeEmbeddingSchema.index({
  active: 1,
  status: 1,
  visibility: 1,
  provider: 1,
  model: 1,
});

const KnowledgeEmbedding =
  mongoose.models.KnowledgeEmbedding ||
  mongoose.model("KnowledgeEmbedding", knowledgeEmbeddingSchema);

export default KnowledgeEmbedding;