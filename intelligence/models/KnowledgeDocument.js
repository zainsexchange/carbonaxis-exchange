import mongoose from "mongoose";

const knowledgeDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    country: {
      type: String,
      default: "Global",
      trim: true,
      index: true,
    },

    jurisdiction: {
      type: String,
      default: "",
      trim: true,
    },

    issuingAuthority: {
      type: String,
      default: "",
      trim: true,
    },

    documentType: {
      type: String,
      enum: [
        "law",
        "regulation",
        "policy",
        "strategy",
        "framework",
        "standard",
        "methodology",
        "guidance",
        "research",
        "report",
        "internal",
        "other",
      ],
      default: "other",
      index: true,
    },

    sourceClass: {
      type: String,
      enum: [
        "government",
        "un",
        "international_organization",
        "registry",
        "standard_body",
        "research",
        "internal",
        "customer",
        "other",
      ],
      default: "other",
      index: true,
    },

    officialUrl: {
      type: String,
      default: "",
      trim: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    storageKey: {
      type: String,
      default: "",
      select: false,
    },

    mimeType: {
      type: String,
      default: "application/pdf",
    },

    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },

    checksum: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    language: {
      type: String,
      default: "English",
      trim: true,
      index: true,
    },

    publicationDate: {
      type: Date,
      default: null,
    },

    effectiveDate: {
      type: Date,
      default: null,
    },

    lastVerifiedAt: {
      type: Date,
      default: null,
      index: true,
    },

    topics: {
      type: [String],
      default: [],
    },

    sectors: {
      type: [String],
      default: [],
    },

    tags: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "draft",
        "processing",
        "pending_review",
        "verified",
        "published",
        "archived",
        "superseded",
        "failed",
      ],
      default: "draft",
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

    allowDownload: {
      type: Boolean,
      default: false,
    },

    allowQuotation: {
      type: Boolean,
      default: false,
    },

    version: {
      type: Number,
      default: 1,
      min: 1,
    },

    supersedesDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeDocument",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "knowledge_documents",
  }
);

knowledgeDocumentSchema.index({
  title: "text",
  description: "text",
  issuingAuthority: "text",
  topics: "text",
  sectors: "text",
  tags: "text",
});

knowledgeDocumentSchema.index({
  visibility: 1,
  status: 1,
  country: 1,
  documentType: 1,
});

const KnowledgeDocument =
  mongoose.models.KnowledgeDocument ||
  mongoose.model("KnowledgeDocument", knowledgeDocumentSchema);

export default KnowledgeDocument;