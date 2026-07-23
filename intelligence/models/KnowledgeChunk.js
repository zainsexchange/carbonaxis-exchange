import mongoose from "mongoose";

const knowledgeChunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeDocument",
      required: true,
      index: true,
    },

    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    pageNumber: {
      type: Number,
      default: null,
      min: 1,
    },

    sectionTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    tokenCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    embedding: {
      type: [Number],
      default: [],
      select: false,
    },

    language: {
      type: String,
      default: "English",
      trim: true,
      index: true,
    },

    country: {
      type: String,
      default: "Global",
      trim: true,
      index: true,
    },

    documentType: {
      type: String,
      default: "other",
      index: true,
    },

    sourceClass: {
      type: String,
      default: "other",
      index: true,
    },

    status: {
      type: String,
      enum: [
        "processing",
        "ready",
        "archived",
        "superseded",
        "failed",
      ],
      default: "processing",
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

    allowedRoles: {
      type: [String],
      default: [],
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "knowledge_chunks",
  }
);

knowledgeChunkSchema.index(
  {
    documentId: 1,
    chunkIndex: 1,
  },
  {
    unique: true,
  }
);

knowledgeChunkSchema.index({
  visibility: 1,
  status: 1,
  country: 1,
  documentType: 1,
  sourceClass: 1,
});

const KnowledgeChunk =
  mongoose.models.KnowledgeChunk ||
  mongoose.model("KnowledgeChunk", knowledgeChunkSchema);

export default KnowledgeChunk;