import { buildTruthPackage } from "../truth/documentTruthPackage.js";
import {
  filterLowQualityFacts,
} from "../truth/factQualityEngine.js";
import {
  normalizeFacts,
} from "../truth/factNormalizer.js";
import {
  filterMetadataFacts,
} from "../truth/metadataFilter.js";
import {
  extractEntityFacts,
  groupFactsByEntity,
} from "../truth/entityFactExtractor.js";
import { buildEntityComparison } from "../truth/entityComparisonEngine.js";
import {
  summarizeEntityComparison,
  buildComparisonPromptContext,
} from "../truth/comparisonSummarizer.js";
import {
  buildSemanticKnowledge,
} from "../truth/semanticPipeline.js";
import generateCarbonBrainResponse from "./generateCarbonBrainResponse.js";

const DEFAULT_OPTIONS = Object.freeze({
  retrievalLimit: 12,
  evidenceLimit: 8,
  minimumSemanticScore: 0.3,
  maximumCitations: 8,
  maximumContextCharacters: 30_000,
});

function normalizeQuestion(value = "") {
  const question = String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (question.length < 3) {
    throw new Error("A valid question is required.");
  }

  if (question.length > 4000) {
    throw new Error(
      "Question cannot exceed 4,000 characters."
    );
  }

  return question;
}

function normalizeConversation(conversation = []) {
  if (!Array.isArray(conversation)) {
    return [];
  }

  return conversation
    .filter((message) =>
      ["user", "assistant"].includes(message?.role)
    )
    .map((message) => ({
      role: message.role,
      content: String(message.content || "")
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, 4000),
    }))
    .filter((message) => message.content)
    .slice(-6);
}

function buildEvidenceContext(
  evidence = [],
  maximumCharacters = DEFAULT_OPTIONS.maximumContextCharacters
) {
  let usedCharacters = 0;
  const blocks = [];

  for (let index = 0; index < evidence.length; index += 1) {
    const item = evidence[index];
    const citationId = `CA-${String(index + 1).padStart(3, "0")}`;

    const block = [
      `[${citationId}]`,
      `Title: ${item.document?.title || "Untitled source"}`,
      `Authority: ${item.document?.issuingAuthority || "Unknown"}`,
      `Country: ${item.document?.country || "Unknown"}`,
      `Source class: ${item.document?.sourceClass || "other"}`,
      `Document status: ${item.document?.status || "unknown"}`,
      `Section: ${item.sectionTitle || "Not specified"}`,
      `Page: ${item.pageNumber || "Not available"}`,
      `Publication date: ${
        item.document?.publicationDate || "Not available"
      }`,
      `Evidence score: ${Math.round(
        Number(item.evidenceScore || 0) * 100
      )}%`,
      "",
      "Evidence text:",
      String(item.content || "").trim(),
    ].join("\n");

    if (
      usedCharacters + block.length >
      maximumCharacters
    ) {
      break;
    }

    blocks.push(block);
    usedCharacters += block.length;
  }

  return blocks.join("\n\n---\n\n");
}

function buildConflictContext(conflicts = []) {
  if (!conflicts.length) {
    return "No direct numeric conflicts were detected.";
  }

  return conflicts
    .slice(0, 10)
    .map((conflict, index) => {
      return [
        `Conflict ${index + 1}: ${conflict.type}`,
        `Source A: ${conflict.left?.title || "Unknown"}`,
        `Value A: ${conflict.left?.value || "Unknown"}`,
        `Source B: ${conflict.right?.title || "Unknown"}`,
        `Value B: ${conflict.right?.value || "Unknown"}`,
        `Preferred source: ${
          conflict.preferredSource || "undetermined"
        }`,
      ].join("\n");
    })
    .join("\n\n");
}

function buildSemanticSourceText(evidence = []) {
  if (!Array.isArray(evidence)) {
    return "";
  }

  return evidence
    .map((item) => String(item?.content || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function createInsufficientEvidenceResponse(truthPackage) {
  const requestedCountries =
    truthPackage.statistics?.ranking?.requestedCountries || [];
  const jurisdictionMiss =
    Boolean(truthPackage.statistics?.ranking?.jurisdictionMiss) ||
    (requestedCountries.length > 0 &&
      !(truthPackage.evidence || []).length);

  const countryLabel = requestedCountries.length
    ? requestedCountries.join(", ")
    : "the requested jurisdiction";

  return {
    answer: jurisdictionMiss
      ? `I could not find permitted evidence for ${countryLabel} in the Carbon Axis Knowledge Library. Sources from other countries were not used to support this answer.`
      : "I could not find enough permitted evidence in the Carbon Axis Knowledge Library to answer this reliably.",

    truthStatus: truthPackage.truthStatus,

    confidence: {
      ...(truthPackage.confidence || {}),
      score: 0,
      percentage: 0,
      label: "Insufficient",
    },

    citations: [],

    conflicts: truthPackage.conflicts,

    explainability: truthPackage.explainability,

    relatedQuestions: [],

    limitations: jurisdictionMiss
      ? [
          `No in-jurisdiction evidence was available for ${countryLabel}.`,
          "Out-of-country documents were excluded from support and citations.",
          "The system did not invent an answer from unsupported model knowledge.",
        ]
      : [
          "No sufficiently relevant evidence was found in the permitted knowledge library.",
          "The system did not generate a factual answer from unsupported model knowledge.",
        ],

    provider: "carbon_brain",

    model: null,

    responseId: null,

    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
  };
}

export async function askCarbonBrain({
  question,
  user,
  conversation = [],

  retrievalLimit = DEFAULT_OPTIONS.retrievalLimit,
  evidenceLimit = DEFAULT_OPTIONS.evidenceLimit,
  minimumSemanticScore =
    DEFAULT_OPTIONS.minimumSemanticScore,
  maximumCitations =
    DEFAULT_OPTIONS.maximumCitations,
}) {
  const startedAt = Date.now();
  const cleanedQuestion = normalizeQuestion(question);
  const cleanedConversation =
    normalizeConversation(conversation);

  /*
   * STEP 1: Build the evidence-first Truth Package.
   */
  const truthPackage = await buildTruthPackage({
    question: cleanedQuestion,
    user,
    retrievalLimit,
    evidenceLimit,
    minimumSemanticScore,
    maximumCitations,
  });

  /*
   * Do not ask the model to invent an answer when retrieval failed.
   */
  if (
    truthPackage.truthStatus?.code ===
      "insufficient_evidence" ||
    truthPackage.truthStatus?.code === "no_evidence" ||
    truthPackage.truthStatus ===
      "insufficient_evidence" ||
    truthPackage.evidence.length === 0
  ) {
    const fallback =
      createInsufficientEvidenceResponse(truthPackage);

    return {
      ...fallback,

      question: cleanedQuestion,

      entityComparison: null,

      entityComparisonSummary: null,

      statistics: {
        ...truthPackage.statistics,
        totalLatencyMs: Date.now() - startedAt,
      },
    };
  }

  const selectedEvidence = truthPackage.evidence;

  /*
   * STEP 2: Build semantic knowledge in shadow mode.
   *
   * The semantic result is returned for diagnostics but does not yet
   * influence evidence ranking or answer generation.
   */
  const semanticSourceText =
    buildSemanticSourceText(selectedEvidence);

  let semanticKnowledge = {
    propositionCount: 0,
    entities: [],
    structuredFacts: [],
    highConfidenceFacts: [],
    propositions: [],
  };

  let semanticDiagnostics = {
    status: "not_run",
    sourceCharacterCount: semanticSourceText.length,
    propositionCount: 0,
    entityCount: 0,
    structuredFactCount: 0,
    highConfidenceFactCount: 0,
    error: null,
  };

  if (semanticSourceText) {
    try {
      semanticKnowledge =
        buildSemanticKnowledge(semanticSourceText);

      semanticDiagnostics = {
        status: "completed",

        sourceCharacterCount:
          semanticSourceText.length,

        propositionCount:
          semanticKnowledge.propositionCount || 0,

        entityCount: Array.isArray(
          semanticKnowledge.entities
        )
          ? semanticKnowledge.entities.length
          : 0,

        structuredFactCount: Array.isArray(
          semanticKnowledge.structuredFacts
        )
          ? semanticKnowledge.structuredFacts.length
          : 0,

        highConfidenceFactCount: Array.isArray(
          semanticKnowledge.highConfidenceFacts
        )
          ? semanticKnowledge.highConfidenceFacts.length
          : 0,

        error: null,
      };
    } catch (error) {
      semanticDiagnostics = {
        status: "failed",

        sourceCharacterCount:
          semanticSourceText.length,

        propositionCount: 0,
        entityCount: 0,
        structuredFactCount: 0,
        highConfidenceFactCount: 0,

        error:
          error instanceof Error
            ? error.message
            : "Unknown semantic pipeline error.",
      };
    }
  }

  const requestedCountries =
    truthPackage.statistics?.ranking?.requestedCountries ||
    [];

  const comparisonQuestion = Boolean(
    truthPackage.statistics?.ranking?.comparisonQuestion
  );

  let entityComparison = null;
let entityComparisonSummary = null;
let comparisonPromptContext = "";
let entityFactDiagnostics = null;

if (comparisonQuestion) {
  const extractedEntityFacts =
    extractEntityFacts(selectedEvidence);

  const metadataFilterResult =
    filterMetadataFacts(extractedEntityFacts);

  const factQualityResult =
  filterLowQualityFacts(
    metadataFilterResult.facts
  );

const normalizationResult =
  normalizeFacts(
    factQualityResult.facts
  );

const entityFacts =
  normalizationResult.facts;

const groupedEntityFacts =
  groupFactsByEntity(
    entityFacts
  );

  entityFactDiagnostics = {
    extractedCount:
      extractedEntityFacts.length,

    metadataRemoved:
      metadataFilterResult.removedCount,

    metadataKept:
      metadataFilterResult.keptCount,

    lowQualityRemoved:
      factQualityResult.rejectedCount,

    qualityAccepted:
      factQualityResult.acceptedCount,

    qualityRejectionReasons:
      factQualityResult.rejectionReasons,

    normalizedCount:
      normalizationResult.outputCount,

    duplicateFactsMerged:
      normalizationResult.duplicateCount,

    invalidFactsRemoved:
      normalizationResult.invalidCount,
  };

  entityComparison =
    buildEntityComparison({
      groupedFacts:
        groupedEntityFacts,

      requestedEntities:
        requestedCountries || [],
    });

  entityComparisonSummary =
    summarizeEntityComparison(
      entityComparison
    );

  comparisonPromptContext =
    buildComparisonPromptContext(
      entityComparisonSummary
    );
}

  const evidenceContext = buildEvidenceContext(
    selectedEvidence
  );

  const conflictContext = buildConflictContext(
    truthPackage.conflicts
  );

  const conversationContext = cleanedConversation.length
    ? cleanedConversation
        .map(
          (message) =>
            `${message.role.toUpperCase()}: ${message.content}`
        )
        .join("\n\n")
    : "No previous conversation was supplied.";

  return await generateCarbonBrainResponse({
    question: cleanedQuestion,

    conversationContext,

    truthPackage,

    evidenceContext,

    conflictContext,

    comparisonPromptContext,

    semanticKnowledge,

    semanticDiagnostics,

    entityComparison,

    entityComparisonSummary,

    entityFactDiagnostics,

    startedAt,
  });
}
