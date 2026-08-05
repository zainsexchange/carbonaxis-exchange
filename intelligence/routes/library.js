import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import mongoose from "mongoose";

import KnowledgeJob from "../models/KnowledgeJob.js";
import KnowledgeChunk from "../models/KnowledgeChunk.js";
import KnowledgeEmbedding from "../models/KnowledgeEmbedding.js";
import { processKnowledgeDocument } from "../services/processKnowledgeDocument.js";
import {
  authenticateToken,
  requireAdminRole,
} from "../../middleware/auth.js";

import KnowledgeDocument from "../models/KnowledgeDocument.js";
import {
  buildAuthorityFields,
} from "../config/sourceAuthority.js";
import {
  buildLibraryDashboard,
  listLibraryDocuments,
  getLibraryDocumentDetail,
  buildLibraryRelationshipGraph,
} from "../services/libraryOperations.js";

const router = express.Router();

const uploadFolder = path.resolve("uploads", "knowledge");
fs.mkdirSync(uploadFolder, { recursive: true });

const AUTHORITATIVE_SOURCE_CLASSES = new Set([
  "government",
  "un",
  "international_organization",
  "registry",
  "standard_body",
]);

async function syncDocumentAccessFields(document) {
  const accessUpdate = {
    visibility: document.visibility,
    ownerId: document.ownerId || null,
    workspaceId: document.workspaceId || null,
    country: document.country || "Global",
    language: document.language || "English",
    documentType: document.documentType || "other",
    sourceClass: document.sourceClass || "other",
    updatedAt: new Date(),
  };

  await KnowledgeChunk.updateMany(
    { documentId: document._id },
    { $set: accessUpdate }
  );

  await KnowledgeEmbedding.updateMany(
    { documentId: document._id },
    {
      $set: {
        visibility: document.visibility,
        ownerId: document.ownerId || null,
        workspaceId: document.workspaceId || null,
        updatedAt: new Date(),
      },
    }
  );
}

function sanitizeFileName(fileName = "document.pdf") {
  return path
    .basename(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 180);
}

function calculateChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadFolder);
  },

  filename(_req, file, cb) {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(
      file.originalname
    )}`;

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024,
  },

  fileFilter(_req, file, cb) {
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only PDF, DOCX, and TXT files are allowed."));
    }

    cb(null, true);
  },
});

router.post(
  "/upload",
  authenticateToken,
  requireAdminRole,
  upload.single("document"),

  async (req, res) => {
    let uploadedPath = "";

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Document missing.",
        });
      }

      uploadedPath = req.file.path;

      const checksum = await calculateChecksum(req.file.path);

      const duplicate = await KnowledgeDocument.findOne({ checksum }).lean();

      if (duplicate) {
        fs.unlinkSync(req.file.path);

        return res.status(409).json({
          success: false,
          message: "This document has already been uploaded.",
          existingDocumentId: duplicate._id,
        });
      }

      const validSourceClasses = [
        "government",
        "un",
        "international_organization",
        "registry",
        "standard_body",
        "research",
        "internal",
        "customer",
        "other",
      ];

      const validDocumentTypes = [
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
      ];

      const validVisibilities = [
        "public",
        "internal",
        "private",
        "workspace",
      ];

      const sourceClass = validSourceClasses.includes(req.body.sourceClass)
        ? req.body.sourceClass
        : "other";

      const documentType = validDocumentTypes.includes(req.body.documentType)
        ? req.body.documentType
        : "other";

      const visibility = validVisibilities.includes(req.body.visibility)
        ? req.body.visibility
        : "internal";

      const authorityFields = buildAuthorityFields({
        sourceClass,
        documentType,
        issuingAuthority: String(req.body.issuingAuthority || "").trim(),
      });

      const document = await KnowledgeDocument.create({
        title: String(
          req.body.title || req.file.originalname
        ).trim(),

        description: String(req.body.description || "").trim(),

        country: String(req.body.country || "Global").trim(),

        jurisdiction: String(req.body.jurisdiction || "").trim(),

        issuingAuthority: String(
          req.body.issuingAuthority || ""
        ).trim(),

        documentType,
        sourceClass,

        sourceAuthorityScore: authorityFields.sourceAuthorityScore,
        curationTier: authorityFields.curationTier,
        authorityTier: authorityFields.authorityTier,
        sourceTrustScore: authorityFields.sourceTrustScore,

        officialUrl: String(req.body.officialUrl || "").trim(),

        fileName: req.file.originalname,

        storageKey: req.file.path,

        mimeType: req.file.mimetype,

        fileSize: req.file.size,

        checksum,

        language: String(req.body.language || "English").trim(),

        topics: String(req.body.topics || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),

        sectors: String(req.body.sectors || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),

        tags: String(req.body.tags || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),

        status: "draft",

        visibility,

        ownerId:
          visibility === "private" ? req.user.id : null,

        workspaceId: null,

        allowDownload: false,

        allowQuotation: false,

        createdBy: req.user.id,

        lastVerifiedAt: null,
      });

      return res.status(201).json({
        success: true,
        message: "Knowledge document uploaded successfully.",
        document: {
          id: document._id,
          title: document.title,
          fileName: document.fileName,
          country: document.country,
          documentType: document.documentType,
          sourceClass: document.sourceClass,
          visibility: document.visibility,
          status: document.status,
        },
      });
    } catch (error) {
      console.error("Knowledge upload error:", error);

      if (uploadedPath && fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }

      return res.status(500).json({
        success: false,
        message: "Document upload failed.",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

router.get(
  "/dashboard",
  authenticateToken,
  requireAdminRole,
  async (_req, res) => {
    try {
      const dashboard = await buildLibraryDashboard();
      return res.json({
        success: true,
        dashboard,
      });
    } catch (error) {
      console.error("Knowledge library dashboard error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to build knowledge library dashboard.",
      });
    }
  }
);

/**
 * Corpus relationship graph (documents + themes + typed edges).
 * Admin ops only — does not change RAG ask retrieval.
 */
router.get(
  "/graph",
  authenticateToken,
  requireAdminRole,
  async (req, res) => {
    try {
      const graph = await buildLibraryRelationshipGraph(req.query || {});
      return res.json({
        success: true,
        graph,
      });
    } catch (error) {
      console.error("Knowledge library graph error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to build knowledge relationship graph.",
      });
    }
  }
);

router.get(
  "/documents",
  authenticateToken,
  requireAdminRole,
  async (req, res) => {
    try {
      const result = await listLibraryDocuments(req.query || {});
      return res.json({
        success: true,
        count: result.count,
        documents: result.documents,
      });
    } catch (error) {
      console.error("Knowledge documents list error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to list knowledge documents.",
      });
    }
  }
);

router.get(
  "/documents/:id",
  authenticateToken,
  requireAdminRole,
  async (req, res) => {
    try {
      const documentId = String(req.params.id || "").trim();
      if (!mongoose.Types.ObjectId.isValid(documentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid knowledge document ID.",
        });
      }

      const document = await getLibraryDocumentDetail(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Knowledge document not found.",
        });
      }

      return res.json({
        success: true,
        document,
      });
    } catch (error) {
      console.error("Knowledge document detail error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load knowledge document.",
      });
    }
  }
);

router.post(
  "/:id/process",
  authenticateToken,
  requireAdminRole,
  async (req, res) => {
    try {
      const documentId = String(req.params.id || "").trim();

      if (!mongoose.Types.ObjectId.isValid(documentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid knowledge document ID.",
        });
      }

      const document = await KnowledgeDocument.findById(documentId)
        .select("_id title status createdBy");

      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Knowledge document not found.",
        });
      }

      const existingJob = await KnowledgeJob.findOne({
        documentId: document._id,
        status: {
          $in: ["queued", "processing"],
        },
      }).sort({
        createdAt: -1,
      });

      if (existingJob) {
        return res.status(409).json({
          success: false,
          message: "This document is already being processed.",
          job: {
            id: existingJob._id,
            status: existingJob.status,
            currentStep: existingJob.currentStep,
            progress: existingJob.progress,
          },
        });
      }

      const job = await KnowledgeJob.create({
        documentId: document._id,
        jobType:
          document.status === "failed"
            ? "reprocess_document"
            : "process_document",

        status: "queued",
        currentStep: "queued",
        progress: 0,

        createdBy: req.user.id,
        workspaceId: null,
        priority: 5,

        metadata: {
          requestedFrom: "admin_api",
          documentTitle: document.title,
        },
      });

      /*
       * Return immediately, then process asynchronously.
       *
       * This is suitable for the development version. A persistent queue
       * worker will replace setImmediate before large-scale production use.
       */
      setImmediate(async () => {
        try {
          await processKnowledgeDocument({
            documentId: document._id,
            jobId: job._id,
            requestedBy: req.user.id,
          });
        } catch (error) {
          console.error(
            `Knowledge job ${job._id} failed:`,
            error.message
          );
        }
      });

      return res.status(202).json({
        success: true,
        message: "Document processing has started.",
        job: {
          id: job._id,
          documentId: document._id,
          status: job.status,
          currentStep: job.currentStep,
          progress: job.progress,
        },
      });
    } catch (error) {
      console.error("Start knowledge processing error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to start document processing.",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);
router.get(
  "/jobs/:jobId",
  authenticateToken,
  requireAdminRole,
  async (req, res) => {
    try {
      const jobId = String(req.params.jobId || "").trim();

      if (!mongoose.Types.ObjectId.isValid(jobId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid knowledge job ID.",
        });
      }

      const job = await KnowledgeJob.findById(jobId)
        .populate("documentId", "title fileName status")
        .lean();

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Knowledge job not found.",
        });
      }

      return res.json({
        success: true,

        job: {
          id: job._id,
          document: job.documentId,
          jobType: job.jobType,
          status: job.status,
          currentStep: job.currentStep,
          progress: job.progress,
          attempts: job.attempts,
          maximumAttempts: job.maximumAttempts,
          errorMessage: job.errorMessage,
          errorCode: job.errorCode,
          result: job.result,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          failedAt: job.failedAt,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
      });
    } catch (error) {
      console.error("Knowledge job status error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load knowledge job.",
      });
    }
  }
);

/**
 * Correct document metadata after upload/process.
 * Example: set country from Global → Pakistan without re-uploading.
 */
router.patch(
  "/:id",
  authenticateToken,
  requireAdminRole,
  async (req, res) => {
    try {
      const documentId = String(req.params.id || "").trim();

      if (!mongoose.Types.ObjectId.isValid(documentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid knowledge document ID.",
        });
      }

      const document = await KnowledgeDocument.findById(documentId);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Knowledge document not found.",
        });
      }

      const updatableStringFields = [
        "title",
        "description",
        "country",
        "jurisdiction",
        "issuingAuthority",
        "language",
        "officialUrl",
      ];

      for (const field of updatableStringFields) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          document[field] = String(req.body[field] || "").trim();
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "documentType")) {
        const allowed = [
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
        ];
        const nextType = String(req.body.documentType || "").trim();
        if (allowed.includes(nextType)) {
          document.documentType = nextType;
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "sourceClass")) {
        const allowed = [
          "government",
          "un",
          "international_organization",
          "registry",
          "standard_body",
          "research",
          "internal",
          "customer",
          "other",
        ];
        const nextClass = String(req.body.sourceClass || "").trim();
        if (allowed.includes(nextClass)) {
          document.sourceClass = nextClass;
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "visibility")) {
        const allowed = ["public", "internal", "private", "workspace"];
        const nextVisibility = String(req.body.visibility || "").trim();
        if (allowed.includes(nextVisibility)) {
          document.visibility = nextVisibility;
          document.ownerId =
            nextVisibility === "private" ? req.user.id : null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
        const allowed = [
          "draft",
          "processing",
          "pending_review",
          "verified",
          "published",
          "archived",
          "superseded",
          "failed",
        ];
        const nextStatus = String(req.body.status || "").trim();
        if (allowed.includes(nextStatus)) {
          document.status = nextStatus;
          if (nextStatus === "verified" || nextStatus === "published") {
            document.lastVerifiedAt = new Date();
            document.verifiedBy = req.user.id;
          }
        }
      }

      if (!document.country) {
        document.country = "Global";
      }

      const authorityFields = buildAuthorityFields(document);
      document.sourceAuthorityScore =
        authorityFields.sourceAuthorityScore;
      document.curationTier = authorityFields.curationTier;
      document.authorityTier = authorityFields.authorityTier;
      document.sourceTrustScore = authorityFields.sourceTrustScore;

      await document.save();
      await syncDocumentAccessFields(document);

      return res.json({
        success: true,
        message: "Knowledge document metadata updated.",
        document: {
          id: document._id,
          title: document.title,
          country: document.country,
          jurisdiction: document.jurisdiction,
          issuingAuthority: document.issuingAuthority,
          documentType: document.documentType,
          sourceClass: document.sourceClass,
          language: document.language,
          visibility: document.visibility,
          status: document.status,
        },
      });
    } catch (error) {
      console.error("Knowledge document update error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to update knowledge document.",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

/**
 * Promote processed official docs into answer-eligible status.
 * government/public → published; other authoritative → verified.
 */
router.post(
  "/promote-authoritative",
  authenticateToken,
  requireAdminRole,
  async (req, res) => {
    try {
      const documents = await KnowledgeDocument.find({
        sourceClass: { $in: [...AUTHORITATIVE_SOURCE_CLASSES] },
        status: { $in: ["pending_review", "verified"] },
        chunkCount: { $gt: 0 },
        embeddingCount: { $gt: 0 },
      });

      const promoted = [];

      for (const document of documents) {
        // Make authoritative processed docs answer-eligible for all users.
        document.visibility = "public";
        document.status = "published";
        document.lastVerifiedAt = new Date();
        document.verifiedBy = req.user.id;
        await document.save();
        await syncDocumentAccessFields(document);

        promoted.push({
          id: document._id,
          title: document.title,
          status: document.status,
          visibility: document.visibility,
        });
      }

      return res.json({
        success: true,
        message: `Promoted ${promoted.length} authoritative document(s) for answer retrieval.`,
        count: promoted.length,
        documents: promoted,
      });
    } catch (error) {
      console.error("Knowledge promote error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to promote authoritative documents.",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

export default router;