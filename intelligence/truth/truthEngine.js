import { semanticRetrieve } from "../retrieval/semanticRetriever.js";
import { rankEvidence } from "./evidenceRanker.js";
import { clusterEvidence } from "./evidenceClusterer.js";
import { detectConflicts } from "./conflictDetector.js";
import { calculateConfidence } from "./confidenceCalculator.js";
import { buildCitations } from "./citationBuilder.js";

const DEFAULT_OPTIONS = Object.freeze({
  retrievalLimit: 12,
  evidenceLimit: 8,
  minimumSemanticScore: 0.3,
  maximumCitations: 8,

  // Multi-document evidence controls
  maximumChunksPerDocument: 2,
  maximumDocuments: 6,
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
    throw new Error("Question cannot exceed 4,000 characters.");
  }

  return question;
}

function buildExplainability(evidence = [], conflicts = []) {
  const reasons = [];

  if (!evidence.length) {
    reasons.push("No relevant evidence was found in the permitted knowledge library.");

    return reasons;
  }

  const officialEvidence = evidence.filter((item) =>
    [
      "government",
      "un",
      "standard_body",
      "registry",
      "international_organization",
    ].includes(
      String(item.document?.sourceClass || "").toLowerCase()
    )
  );

  const verifiedEvidence = evidence.filter((item) =>
    ["verified", "published"].includes(
      String(item.document?.status || "").toLowerCase()
    )
  );

  const recentEvidence = evidence.filter((item) => {
    const dateValue =
      item.document?.lastVerifiedAt ||
      item.document?.effectiveDate ||
      item.document?.publicationDate;

    if (!dateValue) {
      return false;
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const ageInDays =
      (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

    return ageInDays <= 1095;
  });

  if (officialEvidence.length > 0) {
    reasons.push(
      `${officialEvidence.length} authoritative source${
        officialEvidence.length === 1 ? "" : "s"
      } supported the result.`
    );
  }

  if (verifiedEvidence.length > 0) {
    reasons.push(
      `${verifiedEvidence.length} verified or published source${
        verifiedEvidence.length === 1 ? "" : "s"
      } were used.`
    );
  }

 if (recentEvidence.length > 0) {
  reasons.push(
    `${recentEvidence.length} source${
      recentEvidence.length === 1 ? "" : "s"
    } ${
      recentEvidence.length === 1 ? "was" : "were"
    } published, effective, or verified within the last three years.`
  );
}

  if (conflicts.length === 0) {
    reasons.push("No direct numeric conflicts were detected.");
  } else {
    reasons.push(
      `${conflicts.length} potential conflict${
        conflicts.length === 1 ? "" : "s"
      } were detected and reduced confidence.`
    );
  }

  const bestEvidence = evidence[0];

  if (bestEvidence) {
    reasons.push(
      `The highest-ranked evidence had an evidence score of ${Math.round(
        Number(bestEvidence.evidenceScore || 0) * 100
      )}%.`
    );
  }

  return reasons;
}

function buildEvidenceSummary(evidence = []) {
  const uniqueDocumentIds = new Set(
    evidence.map((item) => String(item.documentId))
  );

  const sourceClassCounts = evidence.reduce((counts, item) => {
    const sourceClass =
      String(item.document?.sourceClass || "other")
        .trim()
        .toLowerCase() || "other";

    counts[sourceClass] = (counts[sourceClass] || 0) + 1;

    return counts;
  }, {});

  const countries = [
    ...new Set(
      evidence
        .map((item) => String(item.document?.country || "").trim())
        .filter(Boolean)
    ),
  ];

  return {
    evidenceCount: evidence.length,
    uniqueDocumentCount: uniqueDocumentIds.size,
    sourceClassCounts,
    countries,
    highestEvidenceScore: evidence.length
      ? Number(evidence[0].evidenceScore || 0)
      : 0,
    averageEvidenceScore: evidence.length
      ? evidence.reduce(
          (sum, item) => sum + Number(item.evidenceScore || 0),
          0
        ) / evidence.length
      : 0,
  };
}

function resolveTruthStatus({
  evidence,
  confidence,
  conflicts,
}) {
  if (!evidence.length) {
    return "insufficient_evidence";
  }

  if (conflicts.length > 0 && confidence.score < 0.62) {
    return "conflicted";
  }

  if (confidence.score >= 0.78) {
    return "strong";
  }

  if (confidence.score >= 0.52) {
    return "partial";
  }

  return "weak";
}

export async function buildTruthPackage({
  question,
  user,
  retrievalLimit = DEFAULT_OPTIONS.retrievalLimit,
  evidenceLimit = DEFAULT_OPTIONS.evidenceLimit,
  minimumSemanticScore =
    DEFAULT_OPTIONS.minimumSemanticScore,
  maximumCitations =
    DEFAULT_OPTIONS.maximumCitations,
  maximumChunksPerDocument =
    DEFAULT_OPTIONS.maximumChunksPerDocument,
  maximumDocuments =
    DEFAULT_OPTIONS.maximumDocuments,
}) {
  const startedAt = Date.now();
  const cleanedQuestion = normalizeQuestion(question);

  /*
   * STEP 1: Permission-aware semantic retrieval
   */
  const retrieval = await semanticRetrieve({
    question: cleanedQuestion,
    user,
    limit: retrievalLimit,
    minimumScore: minimumSemanticScore,
  });

  /*
   * STEP 2: Rank evidence using authority, verification,
   * freshness, metadata, and content quality.
   */
  const ranking = rankEvidence(retrieval.results, {
  /*
   * Rank the wider retrieval set first. The clusterer will
   * then reduce document dominance and select the final set.
   */
  limit: Math.max(
    evidenceLimit,
    retrievalLimit
  ),
});
/*
 * STEP 3: Group evidence by source document and prevent
 * one document from dominating the final truth package.
 */
const clustering = clusterEvidence(
  ranking.evidence,
  {
    maximumChunksPerDocument,
    maximumDocuments,
  }
);

/*
 * Preserve the existing evidenceLimit contract.
 * Clustering may return several chunks per document, but the
 * final truth package remains capped at evidenceLimit items.
 */
const clusteredEvidence =
  clustering.flattenedEvidence.slice(
    0,
    evidenceLimit
  );

  /*
   * STEP 3: Detect disagreements across separate documents.
   */
  const conflictResult =
  detectConflicts(clusteredEvidence);

  /*
   * STEP 4: Calculate measurable confidence.
   */
  const confidence = calculateConfidence({
  evidence: clusteredEvidence,
  conflicts: conflictResult.conflicts,
});

  /*
   * STEP 5: Build safe, user-facing citations.
   */
  const citationResult = buildCitations(
  clusteredEvidence,
  {
    maximumCitations,
  }
);

  const truthStatus = resolveTruthStatus({
  evidence: clusteredEvidence,
  confidence,
  conflicts: conflictResult.conflicts,
});

  const explainability = buildExplainability(
  clusteredEvidence,
  conflictResult.conflicts
);

  return {
    question: cleanedQuestion,

    truthStatus,

    confidence,

    evidenceSummary: buildEvidenceSummary(
  clusteredEvidence
),

evidence: clusteredEvidence,

    conflicts: conflictResult.conflicts,

    citations: citationResult.citations,

    explainability,

    statistics: {
  retrieval: retrieval.statistics,
  ranking: ranking.statistics,

  clustering: {
    ...clustering.statistics,
    selectedEvidenceCount:
      clusteredEvidence.length,
  },

  conflicts: conflictResult.statistics,
  citations: citationResult.statistics,
  totalLatencyMs: Date.now() - startedAt,
},

  };
}