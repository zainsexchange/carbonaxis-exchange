const SOURCE_QUALITY_SCORES = Object.freeze({
  government: 1.0,
  un: 0.98,
  standard_body: 0.95,
  registry: 0.93,
  international_organization: 0.9,
  research: 0.78,
  internal: 0.72,
  customer: 0.65,
  other: 0.5,
});

const STATUS_SCORES = Object.freeze({
  published: 1.0,
  verified: 0.95,
  pending_review: 0.65,
  draft: 0.35,
  processing: 0.2,
  failed: 0,
  archived: 0.25,
  superseded: 0.15,
});

const DEFAULT_WEIGHTS = Object.freeze({
  semanticSimilarity: 0.45,
  sourceQuality: 0.2,
  verificationStatus: 0.15,
  freshness: 0.1,
  metadataQuality: 0.05,
  contentQuality: 0.05,
});

function clamp(value, minimum = 0, maximum = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, number));
}

function normalizeText(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEnum(value = "") {
  return normalizeText(value).toLowerCase();
}

function calculateFreshnessScore(document = {}) {
  const relevantDate =
    document.lastVerifiedAt ||
    document.effectiveDate ||
    document.publicationDate;

  if (!relevantDate) {
    return 0.4;
  }

  const timestamp = new Date(relevantDate).getTime();

  if (Number.isNaN(timestamp)) {
    return 0.4;
  }

  const ageInDays = Math.max(
    0,
    (Date.now() - timestamp) / (1000 * 60 * 60 * 24)
  );

  if (ageInDays <= 365) return 1;
  if (ageInDays <= 730) return 0.9;
  if (ageInDays <= 1095) return 0.8;
  if (ageInDays <= 1825) return 0.65;
  if (ageInDays <= 3650) return 0.5;

  return 0.35;
}

function calculateMetadataQuality(item = {}) {
  const document = item.document || {};

  const importantFields = [
    document.title,
    document.country,
    document.issuingAuthority,
    document.documentType,
    document.sourceClass,
    document.publicationDate,
    item.sectionTitle,
  ];

  const completedFields = importantFields.filter(
    (value) => normalizeText(value).length > 0
  ).length;

  return completedFields / importantFields.length;
}

function calculateContentQuality(item = {}) {
  const content = normalizeText(item.content);

  if (!content) return 0;

  let score = 0;

  if (content.length >= 200) score += 0.25;
  if (content.length >= 500) score += 0.2;
  if (content.length <= 5000) score += 0.15;

  if (/[.!?]/.test(content)) score += 0.15;
  if (normalizeText(item.sectionTitle)) score += 0.15;

  const repeatedCharacterPattern = /(.)\1{15,}/;

  if (!repeatedCharacterPattern.test(content)) {
    score += 0.1;
  }

  return clamp(score);
}

function resolveSourceQuality(document = {}) {
  const sourceClass = normalizeEnum(document.sourceClass);

  return SOURCE_QUALITY_SCORES[sourceClass] ?? 0.5;
}

function resolveVerificationStatus(document = {}) {
  const status = normalizeEnum(document.status);

  return STATUS_SCORES[status] ?? 0.3;
}

function validateWeights(weights) {
  const resolved = {
    ...DEFAULT_WEIGHTS,
    ...(weights || {}),
  };

  const total = Object.values(resolved).reduce(
    (sum, value) => sum + Number(value || 0),
    0
  );

  if (Math.abs(total - 1) > 0.001) {
    throw new Error(
      "Evidence ranking weights must add up to 1."
    );
  }

  return resolved;
}

function calculateEvidenceScore(item, weights) {
  const semanticSimilarity = clamp(item.score);
  const sourceQuality = resolveSourceQuality(item.document);
  const verificationStatus = resolveVerificationStatus(
    item.document
  );
  const freshness = calculateFreshnessScore(item.document);
  const metadataQuality = calculateMetadataQuality(item);
  const contentQuality = calculateContentQuality(item);

  const evidenceScore =
    semanticSimilarity * weights.semanticSimilarity +
    sourceQuality * weights.sourceQuality +
    verificationStatus * weights.verificationStatus +
    freshness * weights.freshness +
    metadataQuality * weights.metadataQuality +
    contentQuality * weights.contentQuality;

  return {
    evidenceScore: clamp(evidenceScore),

    signals: {
      semanticSimilarity,
      sourceQuality,
      verificationStatus,
      freshness,
      metadataQuality,
      contentQuality,
    },
  };
}

function createDeduplicationKey(item = {}) {
  return [
    item.documentId,
    item.sectionTitle,
    normalizeText(item.content).slice(0, 250),
  ].join("::");
}

export function rankEvidence(
  results,
  {
    limit = 10,
    weights = DEFAULT_WEIGHTS,
  } = {}
) {
  if (!Array.isArray(results)) {
    throw new Error(
      "Evidence results must be supplied as an array."
    );
  }

  const resolvedWeights = validateWeights(weights);
  const resolvedLimit = Math.max(
    1,
    Math.min(Number(limit) || 10, 30)
  );

  const seen = new Set();
  const ranked = [];

  for (const item of results) {
    if (!item?.content || !item?.documentId) {
      continue;
    }

    const deduplicationKey = createDeduplicationKey(item);

    if (seen.has(deduplicationKey)) {
      continue;
    }

    seen.add(deduplicationKey);

    const ranking = calculateEvidenceScore(
      item,
      resolvedWeights
    );

    ranked.push({
      ...item,

      evidenceScore: ranking.evidenceScore,
      evidenceSignals: ranking.signals,
    });
  }

  ranked.sort((a, b) => {
    if (b.evidenceScore !== a.evidenceScore) {
      return b.evidenceScore - a.evidenceScore;
    }

    return Number(b.score || 0) - Number(a.score || 0);
  });

  return {
    evidence: ranked.slice(0, resolvedLimit),

    statistics: {
      inputCount: results.length,
      uniqueCount: ranked.length,
      returnedCount: Math.min(
        ranked.length,
        resolvedLimit
      ),

      averageEvidenceScore: ranked.length
        ? ranked.reduce(
            (sum, item) => sum + item.evidenceScore,
            0
          ) / ranked.length
        : 0,

      highestEvidenceScore:
        ranked[0]?.evidenceScore || 0,
    },

    weights: resolvedWeights,
  };
}

export {
  DEFAULT_WEIGHTS,
  SOURCE_QUALITY_SCORES,
  STATUS_SCORES,
};