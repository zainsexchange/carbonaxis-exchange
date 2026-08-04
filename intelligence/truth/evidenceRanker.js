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
function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Canonical country names used for jurisdiction gating.
 * Detection must come from the question, not from retrieved hits,
 * otherwise an Oman ask with only UAE docs never applies a filter.
 */
const COUNTRY_ALIASES = Object.freeze([
  {
    canonical: "United Arab Emirates",
    aliases: ["united arab emirates", "uae", "u.a.e.", "u.a.e", "emirati", "emirates"],
  },
  {
    canonical: "Saudi Arabia",
    aliases: ["saudi arabia", "kingdom of saudi arabia", "ksa", "saudi", "saudi arabian"],
  },
  {
    canonical: "Oman",
    aliases: ["oman", "sultanate of oman", "omani"],
  },
  {
    canonical: "Qatar",
    aliases: ["qatar", "qatari", "state of qatar"],
  },
  {
    canonical: "Bahrain",
    aliases: ["bahrain", "bahraini", "kingdom of bahrain"],
  },
  {
    canonical: "Kuwait",
    aliases: ["kuwait", "kuwaiti", "state of kuwait"],
  },
  {
    canonical: "Pakistan",
    aliases: ["pakistan", "pakistani"],
  },
  {
    canonical: "India",
    aliases: ["india", "indian"],
  },
  {
    canonical: "China",
    aliases: ["china", "chinese", "prc"],
  },
  {
    canonical: "United Kingdom",
    aliases: ["united kingdom", "uk", "u.k.", "great britain", "british"],
  },
  {
    canonical: "United States",
    aliases: ["united states of america", "united states", "usa", "u.s.a.", "u.s.", "american"],
  },
  {
    canonical: "European Union",
    aliases: ["european union", "eu", "european"],
  },
]);

const UNSPECIFIED_COUNTRIES = Object.freeze([
  "",
  "global",
  "other",
  "unknown",
  "unspecified",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
]);

function isComparisonQuestion(question = "") {
  const normalizedQuestion = normalizeText(question).toLowerCase();

  return /\b(compare|comparison|versus|vs\.?|difference|differences|between|relative to|compared with|compared to)\b/i.test(
    normalizedQuestion
  );
}

function wantsInternationalContext(question = "") {
  return /\b(global|international|worldwide|world\s+wide|across\s+countries|gcc|gulf\s+cooperation)\b/i.test(
    normalizeText(question)
  );
}

function canonicalizeCountry(value = "") {
  const normalized = normalizeText(value).toLowerCase();

  if (!normalized || UNSPECIFIED_COUNTRIES.includes(normalized)) {
    return "";
  }

  for (const entry of COUNTRY_ALIASES) {
    if (entry.canonical.toLowerCase() === normalized) {
      return entry.canonical;
    }

    for (const alias of entry.aliases) {
      if (alias === normalized) {
        return entry.canonical;
      }
    }
  }

  return normalizeText(value);
}

/**
 * Detect countries named in the question using the alias table.
 * Do not require those countries to already exist in retrieval hits.
 */
function detectRequestedCountries(question = "") {
  const normalizedQuestion = normalizeText(question).toLowerCase();

  if (!normalizedQuestion) {
    return [];
  }

  const matches = [];

  for (const entry of COUNTRY_ALIASES) {
    const patterns = [entry.canonical, ...entry.aliases]
      .map((alias) => alias.toLowerCase())
      .sort((a, b) => b.length - a.length);

    const hit = patterns.some((alias) => {
      const pattern = new RegExp(
        `\\b${escapeRegExp(alias)}\\b`,
        "i"
      );
      return pattern.test(normalizedQuestion);
    });

    if (hit) {
      matches.push(entry.canonical);
    }
  }

  return [...new Set(matches)];
}

function getEvidenceCountry(item = {}) {
  return canonicalizeCountry(
    item?.document?.country ||
      item?.document?.jurisdiction ||
      item?.country ||
      item?.jurisdiction ||
      ""
  );
}

function applyCountryScope(results = [], question = "") {
  const requestedCountries = detectRequestedCountries(question);
  const comparisonQuestion = isComparisonQuestion(question);
  const allowUnspecified = wantsInternationalContext(question);

  if (requestedCountries.length === 0) {
    return {
      results,
      requestedCountries,
      countryFilterApplied: false,
      comparisonQuestion,
      jurisdictionMiss: false,
      excludedCountryCount: 0,
    };
  }

  const requestedCountrySet = new Set(
    requestedCountries.map((country) => country.toLowerCase())
  );

  const scopedResults = results.filter((item) => {
    const country = getEvidenceCountry(item).toLowerCase();

    if (!country) {
      /*
       * For a specific-country ask, do not let Global/blank metadata
       * masquerade as in-jurisdiction policy evidence.
       */
      return allowUnspecified || comparisonQuestion;
    }

    return requestedCountrySet.has(country);
  });

  /*
   * Never fall back to out-of-jurisdiction hits. An Oman question must
   * not be "supported" by UAE documents just because they are similar.
   */
  return {
    results: scopedResults,
    requestedCountries,
    countryFilterApplied: true,
    comparisonQuestion,
    jurisdictionMiss: scopedResults.length === 0,
    excludedCountryCount: results.length - scopedResults.length,
  };
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
    question = "",
    limit = 10,
    weights = DEFAULT_WEIGHTS,
  } = {}
) {
  if (!Array.isArray(results)) {
    throw new Error(
      "Evidence results must be supplied as an array."
    );
  }
  const countryScope = applyCountryScope(
  results,
  question
);

const scopedResults = countryScope.results;

  const resolvedWeights = validateWeights(weights);
  const resolvedLimit = Math.max(
    1,
    Math.min(Number(limit) || 10, 30)
  );

  const seen = new Set();
  const ranked = [];

  for (const item of scopedResults) {
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
scopedInputCount: scopedResults.length,
requestedCountries:
  countryScope.requestedCountries,
countryFilterApplied:
  countryScope.countryFilterApplied,
comparisonQuestion:
  countryScope.comparisonQuestion,
jurisdictionMiss:
  Boolean(countryScope.jurisdictionMiss),
excludedCountryCount:
  countryScope.excludedCountryCount,
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
  detectRequestedCountries,
  isComparisonQuestion,
  applyCountryScope,
  canonicalizeCountry,
};