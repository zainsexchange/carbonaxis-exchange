import { semanticRetrieve } from "../retrieval/semanticRetriever.js";
import {
  rankEvidence,
  detectRequestedCountries,
  canonicalizeCountry,
} from "./evidenceRanker.js";
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

function buildExplainability(
  evidence = [],
  conflicts = [],
  {
    requestedCountries = [],
    jurisdictionMiss = false,
  } = {}
) {
  const reasons = [];

  if (!evidence.length) {
    if (jurisdictionMiss || requestedCountries.length > 0) {
      reasons.push(
        `No permitted in-jurisdiction evidence was found for ${
          requestedCountries.join(", ") || "the requested country"
        }.`
      );
      reasons.push(
        "Out-of-country retrieval hits were excluded and were not counted as support."
      );
      return reasons;
    }

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
      `${recentEvidence.length} evidence item${
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
  question = "",
  rankingStatistics = {},
}) {
  const evidenceCount = evidence.length;
  const conflictCount = conflicts.length;
  const uniqueDocumentCount = new Set(
    evidence
      .map((item) => String(item.documentId || ""))
      .filter(Boolean)
  ).size;

  const requestedCountries =
    Array.isArray(rankingStatistics.requestedCountries) &&
    rankingStatistics.requestedCountries.length
      ? rankingStatistics.requestedCountries
      : detectRequestedCountries(question);

  const authoritativeEvidence = evidence.filter((item) =>
    [
      "government",
      "un",
      "registry",
      "standard_body",
      "international_organization",
    ].includes(
      String(item.document?.sourceClass || "").toLowerCase()
    )
  ).length;

  const verifiedEvidence = evidence.filter((item) =>
    ["verified", "published"].includes(
      String(item.document?.status || "").toLowerCase()
    )
  ).length;

  /*
   * No evidence available.
   */
  if (evidenceCount === 0) {
    if (
      requestedCountries.length > 0 ||
      rankingStatistics.jurisdictionMiss
    ) {
      return {
        code: "no_evidence",
        label: "No Evidence",
        color: "gray",
        reason: `No in-jurisdiction evidence was found for ${requestedCountries.join(
          ", "
        ) || "the requested country"}. Out-of-country sources were not used as support.`,
      };
    }

    return {
      code: "no_evidence",
      label: "No Evidence",
      color: "gray",
      reason:
        "No relevant evidence was found in the knowledge library.",
    };
  }

  /*
   * Safety net: never mark Supported when every hit is outside
   * the countries named in the question.
   */
  if (requestedCountries.length > 0) {
    const requestedSet = new Set(
      requestedCountries.map((country) =>
        canonicalizeCountry(country).toLowerCase()
      )
    );

    const inJurisdictionCount = evidence.filter((item) => {
      const country = canonicalizeCountry(
        item.document?.country || item.document?.jurisdiction || ""
      ).toLowerCase();

      return country && requestedSet.has(country);
    }).length;

    if (inJurisdictionCount === 0) {
      return {
        code: "no_evidence",
        label: "No Evidence",
        color: "gray",
        reason: `Retrieved sources are outside ${requestedCountries.join(
          ", "
        )} and cannot support this answer.`,
      };
    }
  }

  /*
   * Conflicting information.
   */
  if (conflictCount > 0) {
    return {
      code: "conflicted",
      label: "Conflicted",
      color: "red",
      reason: `${conflictCount} conflict${
        conflictCount === 1 ? "" : "s"
      } detected across retrieved evidence.`,
    };
  }

  /*
   * Strongly supported.
   */
  if (
    uniqueDocumentCount >= 2 &&
    confidence.score >= 0.8 &&
    (authoritativeEvidence >= 1 || verifiedEvidence >= 2)
  ) {
    return {
      code: "supported",
      label: "Supported",
      color: "green",
      reason:
        "Multiple independent sources consistently support this answer.",
    };
  }

  /*
   * Reasonably supported.
   */
  if (
    evidenceCount >= 2 &&
    confidence.score >= 0.5
  ) {
    return {
      code: "supported",
      label: "Supported",
      color: "green",
      reason:
        "Multiple pieces of evidence support this answer.",
    };
  }

  /*
   * Limited support.
   */
  if (evidenceCount >= 1 && confidence.score >= 0.5) {
    return {
      code: "partial_support",
      label: "Partial Support",
      color: "yellow",
      reason: "Limited evidence supports this answer.",
    };
  }

  /*
   * Weak evidence.
   */
  return {
    code: "insufficient_evidence",
    label: "Insufficient Evidence",
    color: "orange",
    reason:
      "The available evidence is insufficient to fully support this answer.",
  };
}

export function buildTruthPackageFromEvidence({
  question,
  evidence = [],
  maximumCitations =
    DEFAULT_OPTIONS.maximumCitations,
  upstreamStatistics = {},
  pipelineStartedAt = null,
}) {
  const evaluationStartedAt = Date.now();
  const cleanedQuestion = normalizeQuestion(question);

  const rankingStatistics = upstreamStatistics?.ranking || {};
  const requestedCountries =
    Array.isArray(rankingStatistics.requestedCountries) &&
    rankingStatistics.requestedCountries.length
      ? rankingStatistics.requestedCountries
      : detectRequestedCountries(cleanedQuestion);

  let normalizedEvidence = Array.isArray(evidence)
    ? evidence
    : [];

  /*
   * Final jurisdiction gate: drop out-of-country hits before
   * confidence, citations, and SUPPORTED labels are computed.
   */
  if (requestedCountries.length > 0) {
    const requestedSet = new Set(
      requestedCountries.map((country) =>
        canonicalizeCountry(country).toLowerCase()
      )
    );

    normalizedEvidence = normalizedEvidence.filter((item) => {
      const country = canonicalizeCountry(
        item.document?.country ||
          item.document?.jurisdiction ||
          ""
      ).toLowerCase();

      return country && requestedSet.has(country);
    });
  }

  /*
   * Detect disagreements across the evidence selected by
   * the upstream orchestration pipeline.
   */
  const conflictResult =
    detectConflicts(normalizedEvidence);

  /*
   * Calculate confidence from the final evidence set and
   * detected conflicts.
   */
  let confidence =
    calculateConfidence({
      evidence: normalizedEvidence,
      conflicts:
        conflictResult.conflicts,
    });

  if (normalizedEvidence.length === 0) {
    confidence = {
      ...confidence,
      score: 0,
      label: "Insufficient",
      percentage: 0,
    };
  }

  /*
   * Build safe user-facing citations.
   */
  const citationResult =
    buildCitations(
      normalizedEvidence,
      {
        maximumCitations,
      }
    );

  const truthStatus =
    resolveTruthStatus({
      evidence: normalizedEvidence,
      confidence,
      conflicts:
        conflictResult.conflicts,
      question: cleanedQuestion,
      rankingStatistics: {
        ...rankingStatistics,
        requestedCountries,
        jurisdictionMiss:
          Boolean(rankingStatistics.jurisdictionMiss) ||
          (requestedCountries.length > 0 &&
            normalizedEvidence.length === 0),
      },
    });

  const explainability =
    buildExplainability(
      normalizedEvidence,
      conflictResult.conflicts,
      {
        requestedCountries,
        jurisdictionMiss:
          requestedCountries.length > 0 &&
          normalizedEvidence.length === 0,
      }
    );

  const completedAt = Date.now();

  return {
    question: cleanedQuestion,

    truthStatus,

    confidence,

    evidenceSummary:
      buildEvidenceSummary(
        normalizedEvidence
      ),

    evidence: normalizedEvidence,

    conflicts:
      conflictResult.conflicts,

    citations:
      citationResult.citations,

    explainability,

    statistics: {
      ...upstreamStatistics,

      conflicts:
        conflictResult.statistics,

      citations:
        citationResult.statistics,

      evaluationLatencyMs:
        completedAt -
        evaluationStartedAt,

      totalLatencyMs:
        completedAt -
        (
          Number.isFinite(
            pipelineStartedAt
          )
            ? pipelineStartedAt
            : evaluationStartedAt
        ),
    },
  };
}

export async function buildTruthPackage({
  question,
  user,
  retrievalLimit =
    DEFAULT_OPTIONS.retrievalLimit,
  evidenceLimit =
    DEFAULT_OPTIONS.evidenceLimit,
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
  const cleanedQuestion =
    normalizeQuestion(question);

  /*
   * Legacy retrieval workflow retained for existing callers.
   */
  const retrieval =
    await semanticRetrieve({
      question: cleanedQuestion,
      user,
      limit: retrievalLimit,
      minimumScore:
        minimumSemanticScore,
    });

  const ranking =
    rankEvidence(
      retrieval.results,
      {
        question:
          cleanedQuestion,

        limit:
          Math.max(
            evidenceLimit,
            retrievalLimit
          ),
      }
    );

  const clustering =
    clusterEvidence(
      ranking.evidence,
      {
        maximumChunksPerDocument,
        maximumDocuments,
      }
    );

  const clusteredEvidence =
    clustering
      .flattenedEvidence
      .slice(
        0,
        evidenceLimit
      );

  /*
   * Delegate truth evaluation to the reusable pure entry point.
   */
  return buildTruthPackageFromEvidence({
    question:
      cleanedQuestion,

    evidence:
      clusteredEvidence,

    maximumCitations,

    pipelineStartedAt:
      startedAt,

    upstreamStatistics: {
      retrieval:
        retrieval.statistics,

      ranking:
        ranking.statistics,

      clustering: {
        ...clustering.statistics,

        selectedEvidenceCount:
          clusteredEvidence.length,
      },
    },
  });
}
