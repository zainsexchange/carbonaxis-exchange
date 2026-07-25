import mongoose from "mongoose";

const knowledgeJobSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeDocument",
      required: true,
      index: true,
    },

    jobType: {
      type: String,
      enum: [
        "extract_text",
        "extract_metadata",
        "create_chunks",
        "generate_embeddings",
        "process_document",
        "reprocess_document",
      ],
      default: "process_document",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "queued",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      default: "queued",
      index: true,
    },

    currentStep: {
      type: String,
      enum: [
        "queued",
        "extracting_text",
        "extracting_metadata",
        "creating_chunks",
        "generating_embeddings",
        "finalizing",
        "completed",
        "failed",
      ],
      default: "queued",
      index: true,
    },

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    maximumAttempts: {
      type: Number,
      default: 3,
      min: 1,
      max: 10,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    errorMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },

    errorCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },

    priority: {
      type: Number,
      default: 5,
      min: 1,
      max: 10,
      index: true,
    },

    lockedAt: {
      type: Date,
      default: null,
    },

    lockedBy: {
      type: String,
      default: "",
      trim: true,
    },

    result: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "knowledge_jobs",
  }
);

knowledgeJobSchema.index({
  status: 1,
  priority: -1,
  createdAt: 1,
});

knowledgeJobSchema.index({
  documentId: 1,
  jobType: 1,
  status: 1,
});

knowledgeJobSchema.index({
  lockedAt: 1,
  status: 1,
});

const KnowledgeJob =
  mongoose.models.KnowledgeJob ||
  mongoose.model("KnowledgeJob", knowledgeJobSchema);

export default KnowledgeJob;