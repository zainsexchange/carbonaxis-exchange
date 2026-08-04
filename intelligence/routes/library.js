import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import mongoose from "mongoose";

import KnowledgeJob from "../models/KnowledgeJob.js";
import KnowledgeChunk from "../models/KnowledgeChunk.js";
import { processKnowledgeDocument } from "../services/processKnowledgeDocument.js";
import {
  authenticateToken,
  requireAdminRole,
} from "../../middleware/auth.js";

import KnowledgeDocument from "../models/KnowledgeDocument.js";

const router = express.Router();

const uploadFolder = path.resolve("uploads", "knowledge");
fs.mkdirSync(uploadFolder, { recursive: true });

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
  "/documents",
  authenticateToken,
  requireAdminRole,
  async (req, res) => {
    try {
      const limit = Math.min(
        200,
        Math.max(1, Number(req.query.limit) || 50)
      );

      const documents = await KnowledgeDocument.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select(
          "title fileName country jurisdiction issuingAuthority documentType sourceClass language status processingStage processingProgress chunkCount pageCount embeddingCount visibility createdAt updatedAt"
        )
        .lean();

      return res.json({
        success: true,
        count: documents.length,
        documents: documents.map((doc) => ({
          id: doc._id,
          title: doc.title,
          fileName: doc.fileName,
          country: doc.country,
          jurisdiction: doc.jurisdiction,
          issuingAuthority: doc.issuingAuthority,
          documentType: doc.documentType,
          sourceClass: doc.sourceClass,
          language: doc.language,
          status: doc.status,
          processingStage: doc.processingStage,
          processingProgress: doc.processingProgress,
          chunkCount: doc.chunkCount,
          pageCount: doc.pageCount,
          embeddingCount: doc.embeddingCount,
          visibility: doc.visibility,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        })),
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

      if (!document.country) {
        document.country = "Global";
      }

      await document.save();

      await KnowledgeChunk.updateMany(
        { documentId: document._id },
        {
          $set: {
            country: document.country || "Global",
            language: document.language || "English",
            documentType: document.documentType || "other",
            sourceClass: document.sourceClass || "other",
            updatedAt: new Date(),
          },
        }
      );

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

export default router;