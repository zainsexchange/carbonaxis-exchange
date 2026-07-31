import { findBestEvidenceSpan } from "./evidenceSpanMatcher.js";
import { classifyReasoning } from "./reasoningClassifier.js";
function normalizeText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSectionHeading(value = "") {
  const text = normalizeText(value)
    .replace(/[:\-–—]+$/, "")
    .trim();

  if (!text) {
    return true;
  }

  const normalized = text.toLowerCase();

  const knownHeadings = new Set([
    "analysis",
    "conclusion",
    "summary",
    "targets",
    "objectives",
    "key sectors",
    "focus areas",
    "investment",
    "hydrogen production",
    "implementation phases",
    "long-term commitment",
    "target clarity",
    "sectoral focus",
    "timeline differences",
    "pakistan's renewable strategy",
    "uae's renewable strategy",
    "comparison of renewable strategies",
  ]);

  if (knownHeadings.has(normalized)) {
    return true;
  }

  const words = text.split(/\s+/);

  const hasEndingPunctuation = /[.!?]$/.test(text);

  const containsNumber = /\d/.test(text);

  const looksLikeTitle =
    words.length <= 8 &&
    !hasEndingPunctuation &&
    !containsNumber;

  return looksLikeTitle;
}

function splitIntoClaims(answer = "") {
  const rawText = String(answer || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!rawText) {
    return [];
  }

  const cleanedLines = rawText
    .split("\n")
    .map((line) => {
      return (
        line
          // Remove Markdown headings
          .replace(/^\s{0,3}#{1,6}\s*/, "")

          // Remove bullets
          .replace(/^\s*[-*•]\s+/, "")

          // Remove ordered-list numbering
          .replace(/^\s*\d+[.)]\s+/, "")

          // Remove bold/italic Markdown
          .replace(/\*\*/g, "")
          .replace(/__/g, "")
          .replace(/(?<!\*)\*(?!\*)/g, "")
          .replace(/(?<!_)_(?!_)/g, "")

          // Remove blockquote marker
          .replace(/^\s*>\s*/, "")

          .trim()
      );
    })
    .filter(Boolean);

  const meaningfulLines = cleanedLines.filter((line) => {
    const normalized = line
      .replace(/\[CA-\d+\]/gi, "")
      .replace(/\(\[CA-\d+\]\)/gi, "")
      .replace(/[:\-–—\s]/g, "")
      .trim();

    if (normalized.length < 12) {
      return false;
    }

    return !isSectionHeading(line);
  });

  return meaningfulLines
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((claim) => normalizeText(claim))
    .filter(Boolean)
    .filter((claim) => {
      const withoutCitation = claim
        .replace(/\[CA-\d+\]/gi, "")
        .replace(/\(\[CA-\d+\]\)/gi, "")
        .trim();

      return withoutCitation.length >= 12;
    });
}

function extractCitationIds(text = "") {
  const matches =
    String(text || "").match(
      /\bCA-\d+\b/gi
    ) || [];

  return [
    ...new Set(
      matches.map((value) =>
        value.toUpperCase()
      )
    ),
  ];
}


function resolveCitationId(
  item,
  index
) {
  return (
    item.citationId ||
    `CA-${String(index + 1).padStart(
      3,
      "0"
    )}`
  );
}

function buildEvidenceIndex(
  evidence = []
) {
  return evidence.map(
    (item, index) => ({
      citationId:
        resolveCitationId(item, index),

      documentId:
        item.document?._id ||
        item.documentId ||
        null,

      chunkId:
        item._id ||
        item.chunkId ||
        null,

      chunkIndex:
        Number.isInteger(
          item.chunkIndex
        )
          ? item.chunkIndex
          : null,

      content: (item.content || "")
  .replace(/\u0000/g, "")
  .trim(),

evidenceScore:
  Number(
    item.evidenceScore || 0
  ),

      semanticScore:
        Number(
          item.semanticScore || 0
        ),
    })
  );
}

function calculateSupportScore({
  overlap,
  evidenceScore,
  semanticScore,
  directlyCited,
}) {
  const score =
    overlap * 0.55 +
    evidenceScore * 0.25 +
    semanticScore * 0.15 +
    (directlyCited ? 0.05 : 0);

  return Math.min(
    1,
    Math.max(0, score)
  );
}

function resolveSupportStatus(score) {
  if (score >= 0.72) {
    return "strong";
  }

  if (score >= 0.5) {
    return "moderate";
  }

  if (score >= 0.32) {
    return "weak";
  }

  return "unsupported";
}

export function buildClaimTraceability({
  answer = "",
  evidence = [],
} = {}) {
  const claims =
    splitIntoClaims(answer);

  const evidenceIndex =
    buildEvidenceIndex(evidence);

  const tracedClaims =
  claims.map((claim, claimIndex) => {
    const citedIds =
      extractCitationIds(claim);

    const matches =
      evidenceIndex
        .map((item) => {
          const span =
            findBestEvidenceSpan({
              claim,
              content: item.content,
            });

          const overlap =
            span.score;

          const directlyCited =
            citedIds.includes(
              item.citationId
            );

          const supportScore =
            calculateSupportScore({
              overlap,
              evidenceScore:
                item.evidenceScore,
              semanticScore:
                item.semanticScore,
              directlyCited,
            });

          return {
            citationId:
              item.citationId,

            documentId:
              item.documentId,

            chunkId:
              item.chunkId,

            chunkIndex:
              item.chunkIndex,

            overlap,

            supportScore,

            supportPercentage:
              Math.round(
                supportScore * 100
              ),

            directlyCited,

            paragraphIndex:
              span.paragraphIndex,

            sentenceIndex:
              span.sentenceIndex,

            matchedText:
              span.matchedText,

            spanPercentage:
              span.percentage,
          };
        })
        .sort(
          (left, right) =>
            right.supportScore -
            left.supportScore
        );

    const bestMatch =
      matches[0] || null;

    const supportStatus =
      bestMatch
        ? resolveSupportStatus(
            bestMatch.supportScore
          )
        : "unsupported";

    const supportingEvidence =
      matches
        .filter(
          (match) =>
            match.supportScore >=
            0.32
        )
        .slice(0, 3);

    const reasoning =
      classifyReasoning({
        claim,
        supportingEvidence,
      });

    return {
      claimId: `CL-${String(
        claimIndex + 1
      ).padStart(3, "0")}`,

      text: claim,

      citedIds,

      supportStatus,

      supported:
        supportStatus !==
        "unsupported",

      bestSupportPercentage:
        bestMatch?.supportPercentage ||
        0,

      reasoningType:
        reasoning.type,

      reasoningLabel:
        reasoning.label,

      reasoningConfidence:
        reasoning.confidence,

      supportingEvidence,
    };
  });
  const supportedCount =
    tracedClaims.filter(
      (claim) => claim.supported
    ).length;

  const unsupportedCount =
    tracedClaims.length -
    supportedCount;

  const averageSupport =
    tracedClaims.length > 0
      ? tracedClaims.reduce(
          (total, claim) =>
            total +
            claim.bestSupportPercentage,
          0
        ) / tracedClaims.length
      : 0;

  return {
    status:
      tracedClaims.length === 0
        ? "not_applicable"
        : unsupportedCount === 0
          ? "verified"
          : supportedCount > 0
            ? "partial"
            : "unsupported",

    claimCount:
      tracedClaims.length,

    supportedClaimCount:
      supportedCount,

    unsupportedClaimCount:
      unsupportedCount,

    averageSupportPercentage:
      Math.round(averageSupport),

    claims: tracedClaims,
  };
}