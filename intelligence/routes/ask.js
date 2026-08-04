import express from "express";

import { authenticateToken } from "../../middleware/auth.js";
import { askCarbonBrain } from "../services/askCarbonBrain.js";
import RetrievalAudit from "../models/RetrievalAudit.js";

const router = express.Router();

router.post(
  "/ask",
  authenticateToken,
  async (req, res) => {
    const startedAt = Date.now();

    try {
      const question = String(req.body?.question || "").trim();
      const conversation = Array.isArray(req.body?.conversation)
        ? req.body.conversation
        : [];

      if (question.length < 3) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid question.",
        });
      }

      const result = await askCarbonBrain({
        question,
        conversation,

        user: {
          id: req.user.id,
          role: req.user.role,
          workspaceId: req.user.workspaceId || null,
        },
      });

      try {
        await RetrievalAudit.create({
          userId: req.user.id,
          question,
          mode: result.answerMode === "general" ? "general" : "green",

          retrievedChunks: Array.isArray(result.citations)
            ? result.citations.map((citation) => ({
                chunkId: citation.reference?.chunkId,
                documentId: citation.reference?.documentId,
                score: citation.semanticScore,
                pageNumber: citation.pageNumber,
                sectionTitle: citation.sectionTitle,
                visibility: citation.visibility,
              }))
            : [],

          sourceDocumentIds: [
            ...new Set(
              (result.citations || [])
                .map((citation) => citation.reference?.documentId)
                .filter(Boolean)
            ),
          ],

          provider: result.provider,
          model: result.model,

          reliabilityLevel:
            result.confidence?.reliabilityLevel || null,

          reliabilityScore:
            result.confidence?.score ?? 0,

          answer: result.answer,

          latencyMs: Date.now() - startedAt,

          tokenUsage: result.tokenUsage,

          metadata: {
            answerMode: result.answerMode || "evidence",
            truthStatus: result.truthStatus,
            citationCount: Array.isArray(result.citations)
              ? result.citations.length
              : 0,
            conflictCount: Array.isArray(result.conflicts)
              ? result.conflicts.length
              : 0,
            explainability: result.explainability,
          },
        });
      } catch (auditError) {
        console.error(
          "Carbon Brain audit logging failed:",
          auditError.message
        );
      }

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Carbon Brain API error:", error);

      return res.status(500).json({
        success: false,
        message:
          "Carbon Brain is temporarily unavailable. Please try again shortly.",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

export default router;