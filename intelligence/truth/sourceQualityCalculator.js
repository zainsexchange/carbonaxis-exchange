import { resolveAuthority } from "./authorityResolver.js";

function clamp(value, minimum = 0, maximum = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return minimum;
  }

  return Math.min(
    maximum,
    Math.max(minimum, number)
  );
}

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toPercentage(value) {
  return Math.round(clamp(value) * 100);
}

function resolveReferenceDate(document = {}) {
  return (
    document.lastVerifiedAt ||
    document.publicationDate ||
    document.effectiveDate ||
    null
  );
}

function calculateFreshness(document = {}) {
  const value = resolveReferenceDate(document);

  if (!value) {
    return {
      score: 0,
      status: "unknown",
      reason:
        "No publication, effective, or verification date is available.",
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      score: 0,
      status: "invalid",
      reason:
        "The available source date is invalid.",
    };
  }

  const ageInYears =
    Math.max(
      Date.now() - date.getTime(),
      0
    ) /
    (1000 * 60 * 60 * 24 * 365.25);

  if (ageInYears <= 1) {
    return {
      score: 1,
      status: "current",
      reason:
        "The source was published, effective, or verified within the last year.",
    };
  }

  if (ageInYears <= 2) {
    return {
      score: 0.9,
      status: "recent",
      reason:
        "The source date is within the last two years.",
    };
  }

  if (ageInYears <= 3) {
    return {
      score: 0.8,
      status: "recent",
      reason:
        "The source date is within the last three years.",
    };
  }

  if (ageInYears <= 5) {
    return {
      score: 0.65,
      status: "aging",
      reason:
        "The source is between three and five years old.",
    };
  }

  if (ageInYears <= 8) {
    return {
      score: 0.45,
      status: "old",
      reason:
        "The source is between five and eight years old.",
    };
  }

  return {
    score: 0.25,
    status: "outdated",
    reason:
      "The source is more than eight years old.",
  };
}

function calculateVerification(document = {}) {
  const status = normalizeText(
    document.status
  ).toLowerCase();

  const lastVerifiedAt =
    document.lastVerifiedAt;

  if (status === "verified") {
    return {
      score: 1,
      status: "verified",
      reason:
        "The source is marked as verified.",
    };
  }

  if (status === "published") {
    return {
      score: 0.9,
      status: "published",
      reason:
        "The source is marked as published.",
    };
  }

  if (lastVerifiedAt) {
    return {
      score: 0.85,
      status: "previously_verified",
      reason:
        "A verification date is available.",
    };
  }

  if (status === "pending_review") {
    return {
      score: 0.45,
      status: "pending_review",
      reason:
        "The source is pending human review.",
    };
  }

  if (status === "processing") {
    return {
      score: 0.25,
      status: "processing",
      reason:
        "The source is still being processed.",
    };
  }

  if (status === "failed") {
    return {
      score: 0,
      status: "failed",
      reason:
        "Document processing failed.",
    };
  }

  return {
    score: 0.35,
    status: "unverified",
    reason:
      "No verified or published status is available.",
  };
}

function calculateMetadataCompleteness(
  document = {}
) {
  const fields = [
    document.title,
    document.issuingAuthority,
    document.country,
    document.jurisdiction,
    document.documentType,
    document.sourceClass,
    document.language,
    document.publicationDate,
    document.effectiveDate,
  ];

  const completedFields = fields.filter(
    (value) =>
      value !== null &&
      value !== undefined &&
      normalizeText(value) !== ""
  ).length;

  const score =
    completedFields / fields.length;

  return {
    score,
    completedFields,
    totalFields: fields.length,
    status:
      score >= 0.85
        ? "complete"
        : score >= 0.6
          ? "partial"
          : "limited",
    reason: `${completedFields} of ${fields.length} core metadata fields are available.`,
  };
}

function calculateTraceability(
  document = {},
  item = {}
) {
  let score = 0;

  const signals = {
    documentId: Boolean(
      item.documentId
    ),
    chunkId: Boolean(item.chunkId),
    chunkIndex: Number.isInteger(
      item.chunkIndex
    ),
    officialUrl: Boolean(
      normalizeText(document.officialUrl)
    ),
    pageNumber:
      Number.isInteger(item.pageNumber) &&
      item.pageNumber > 0,
    sectionTitle: Boolean(
      normalizeText(item.sectionTitle)
    ),
  };

  if (signals.documentId) score += 0.25;
  if (signals.chunkId) score += 0.25;
  if (signals.chunkIndex) score += 0.15;
  if (signals.officialUrl) score += 0.15;
  if (signals.pageNumber) score += 0.1;
  if (signals.sectionTitle) score += 0.1;

  return {
    score: clamp(score),
    status:
      score >= 0.8
        ? "high"
        : score >= 0.5
          ? "moderate"
          : "limited",
    signals,
    reason:
      score >= 0.8
        ? "The evidence can be traced to a detailed source location."
        : score >= 0.5
          ? "The evidence has moderate traceability."
          : "The evidence has limited source-location metadata.",
  };
}

function resolveQualityLevel(score) {
  if (score >= 0.9) {
    return {
      level: "very_high",
      label: "Very High",
      stars: 5,
      color: "green",
    };
  }

  if (score >= 0.78) {
    return {
      level: "high",
      label: "High",
      stars: 4,
      color: "green",
    };
  }

  if (score >= 0.62) {
    return {
      level: "moderate",
      label: "Moderate",
      stars: 3,
      color: "yellow",
    };
  }

  if (score >= 0.45) {
    return {
      level: "low",
      label: "Low",
      stars: 2,
      color: "orange",
    };
  }

  return {
    level: "limited",
    label: "Limited",
    stars: 1,
    color: "red",
  };
}

export function calculateSourceQuality({
  document = {},
  evidenceItem = {},
} = {}) {
  const authority = resolveAuthority(
    document
  );

  const authorityScore =
    clamp(authority.score / 100);

  const freshness =
    calculateFreshness(document);

  const verification =
    calculateVerification(document);

  const metadataCompleteness =
    calculateMetadataCompleteness(
      document
    );

  const traceability =
    calculateTraceability(
      document,
      evidenceItem
    );

  /*
   * Authority and verification receive the
   * highest weights because they most directly
   * influence source reliability.
   */
  const rawScore =
    authorityScore * 0.3 +
    verification.score * 0.25 +
    freshness.score * 0.15 +
    metadataCompleteness.score * 0.15 +
    traceability.score * 0.15;

  const score = clamp(rawScore);
  const qualityLevel =
    resolveQualityLevel(score);

  const strengths = [];
  const warnings = [];

  if (authorityScore >= 0.9) {
    strengths.push(
      "The source has high institutional authority."
    );
  } else if (authorityScore < 0.75) {
    warnings.push(
      "The source is not classified as a high-authority institution."
    );
  }

  if (verification.score >= 0.85) {
    strengths.push(
      "The source is verified or published."
    );
  } else if (verification.score < 0.6) {
    warnings.push(
      verification.reason
    );
  }

  if (freshness.score >= 0.8) {
    strengths.push(
      "The source is recent."
    );
  } else if (
    freshness.score > 0 &&
    freshness.score < 0.5
  ) {
    warnings.push(
      "The source may be outdated."
    );
  }

  if (
    metadataCompleteness.score >= 0.85
  ) {
    strengths.push(
      "The source has complete metadata."
    );
  } else if (
    metadataCompleteness.score < 0.6
  ) {
    warnings.push(
      "Important source metadata is missing."
    );
  }

  if (traceability.score >= 0.8) {
    strengths.push(
      "The evidence is highly traceable."
    );
  } else if (traceability.score < 0.5) {
    warnings.push(
      "The exact evidence location is only partially traceable."
    );
  }

  return {
    score,
    percentage: toPercentage(score),
    level: qualityLevel.level,
    label: qualityLevel.label,
    stars: qualityLevel.stars,
    color: qualityLevel.color,

    breakdown: {
      authority:
        toPercentage(authorityScore),
      verification:
        toPercentage(
          verification.score
        ),
      freshness:
        toPercentage(freshness.score),
      metadataCompleteness:
        toPercentage(
          metadataCompleteness.score
        ),
      traceability:
        toPercentage(
          traceability.score
        ),
    },

    details: {
      authority,
      verification,
      freshness,
      metadataCompleteness,
      traceability,
    },

    strengths,
    warnings,
  };
}