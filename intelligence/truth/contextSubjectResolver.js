/**
 * Resolves a semantic context subject into a stable entity candidate.
 *
 * This module prevents document, policy, company, institution, and
 * organization names from being reduced to only their first named entity.
 *
 * Example:
 *
 * "Pakistan Green Transition Strategy"
 *
 * becomes:
 *
 * {
 *   resolvedSubject: "Pakistan Green Transition Strategy",
 *   canonicalSubject: "Pakistan Green Transition Strategy",
 *   entityType: "policy_document",
 *   parentCountry: "Pakistan"
 * }
 */

const ENTITY_TYPE_RULES = [
  {
    type: "policy_document",
    pattern:
      /\b(strategy|strategies|policy|policies|plan|roadmap|framework|vision|agenda|programme|program|initiative|transition pathway|action plan|master plan|nationally determined contribution|ndc)\b/i,
  },
  {
    type: "government_organization",
    pattern:
      /\b(ministry|department|authority|agency|commission|council|secretariat|directorate|bureau|government office)\b/i,
  },
  {
    type: "company",
    pattern:
      /\b(ltd|limited|plc|inc|incorporated|corporation|corp|company|co|llc|pvt|private limited|group|holdings)\b\.?$/i,
  },
  {
    type: "institution",
    pattern:
      /\b(university|institute|institution|academy|college|centre|center|laboratory|lab|school)\b/i,
  },
  {
    type: "standard",
    pattern:
      /\b(iso|iec|standard|protocol|methodology|guideline|guidelines|specification|code of practice)\b/i,
  },
  {
    type: "treaty_or_agreement",
    pattern:
      /\b(agreement|accord|convention|treaty|declaration|memorandum of understanding|mou)\b/i,
  },
  {
    type: "fund_or_financial_vehicle",
    pattern:
      /\b(fund|facility|bond programme|bond program|financing facility|investment vehicle)\b/i,
  },
];

const COUNTRY_ALIASES = [
  {
    canonical: "Pakistan",
    aliases: ["Pakistan", "Pakistani"],
  },
  {
    canonical: "Saudi Arabia",
    aliases: [
      "Saudi Arabia",
      "Saudi Arabian",
      "Saudi",
      "Kingdom of Saudi Arabia",
      "KSA",
    ],
  },
  {
    canonical: "United Arab Emirates",
    aliases: [
      "United Arab Emirates",
      "Emirati",
      "UAE",
    ],
  },
  {
    canonical: "United Kingdom",
    aliases: [
      "United Kingdom",
      "British",
      "UK",
      "Great Britain",
    ],
  },
  {
    canonical: "United States",
    aliases: [
      "United States of America",
      "United States",
      "American",
      "USA",
      "US",
    ],
  },
  {
    canonical: "European Union",
    aliases: [
      "European Union",
      "EU",
      "European",
    ],
  },
  {
    canonical: "Qatar",
    aliases: ["Qatar", "Qatari"],
  },
  {
    canonical: "Oman",
    aliases: ["Oman", "Omani"],
  },
  {
    canonical: "Kuwait",
    aliases: ["Kuwait", "Kuwaiti"],
  },
  {
    canonical: "Bahrain",
    aliases: ["Bahrain", "Bahraini"],
  },
  {
    canonical: "India",
    aliases: ["India", "Indian"],
  },
  {
    canonical: "China",
    aliases: ["China", "Chinese"],
  },
];

const LOW_INFORMATION_SUBJECTS = new Set([
  "strategy",
  "policy",
  "plan",
  "roadmap",
  "framework",
  "programme",
  "program",
  "initiative",
  "document",
  "report",
  "section",
  "chapter",
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * @param {string} value
 * @returns {string}
 */
function removeTerminalPunctuation(value) {
  return normalizeText(value)
    .replace(/[.:;,!?]+$/g, "")
    .trim();
}

/**
 * Escapes a string for use inside a regular expression.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Tests whether an alias exists as a complete phrase.
 *
 * @param {string} subject
 * @param {string} alias
 * @returns {boolean}
 */
function containsAlias(subject, alias) {
  const pattern = new RegExp(
    `(?:^|\\b)${escapeRegExp(alias)}(?:\\b|$)`,
    "i",
  );

  return pattern.test(subject);
}

/**
 * @param {string} subject
 * @returns {string|null}
 */
function detectParentCountry(subject) {
  const normalized = normalizeText(subject);

  if (!normalized) {
    return null;
  }

  /*
   * Prefer longer aliases first so "Saudi Arabia" is matched before
   * the shorter alias "Saudi".
   */
  const candidates = COUNTRY_ALIASES.flatMap((entry) =>
    entry.aliases.map((alias) => ({
      canonical: entry.canonical,
      alias,
    })),
  ).sort((left, right) => right.alias.length - left.alias.length);

  for (const candidate of candidates) {
    if (containsAlias(normalized, candidate.alias)) {
      return candidate.canonical;
    }
  }

  return null;
}

/**
 * @param {string} subject
 * @returns {string}
 */
function detectEntityType(subject) {
  const normalized = normalizeText(subject);

  if (!normalized) {
    return "unknown";
  }

  for (const rule of ENTITY_TYPE_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.type;
    }
  }

  if (detectParentCountry(normalized)) {
    const countryOnlyMatch = COUNTRY_ALIASES.some((entry) =>
      entry.aliases.some(
        (alias) =>
          normalized.toLowerCase() === alias.toLowerCase(),
      ),
    );

    if (countryOnlyMatch) {
      return "country";
    }
  }

  return "generic_entity";
}

/**
 * Determines whether the context subject is meaningful enough to preserve.
 *
 * @param {string} subject
 * @returns {boolean}
 */
function isUsableContextSubject(subject) {
  const normalized = removeTerminalPunctuation(subject);

  if (!normalized) {
    return false;
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return false;
  }

  if (
    words.length === 1 &&
    LOW_INFORMATION_SUBJECTS.has(normalized.toLowerCase())
  ) {
    return false;
  }

  return true;
}

/**
 * Generates a deterministic candidate entity ID.
 *
 * This is a candidate identifier only. Persistence and deduplication
 * should be handled by the entity registry or knowledge graph layer.
 *
 * @param {string} entityType
 * @param {string} canonicalSubject
 * @returns {string|null}
 */
function createEntityCandidateId(
  entityType,
  canonicalSubject,
) {
  const normalized = normalizeText(canonicalSubject);

  if (!normalized) {
    return null;
  }

  const slug = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!slug) {
    return null;
  }

  const typePrefix = String(entityType || "entity")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${typePrefix || "ENTITY"}_${slug}`;
}

/**
 * Creates aliases for the resolved subject.
 *
 * This remains conservative and does not invent abbreviations.
 *
 * @param {string} canonicalSubject
 * @returns {string[]}
 */
function buildAliases(canonicalSubject) {
  const normalized = removeTerminalPunctuation(
    canonicalSubject,
  );

  return normalized ? [normalized] : [];
}

/**
 * Calculates confidence for the context-subject resolution.
 *
 * @param {{
 *   subject: string,
 *   entityType: string,
 *   parentCountry: string|null,
 *   source: string
 * }} options
 * @returns {number}
 */
function calculateResolutionConfidence({
  subject,
  entityType,
  parentCountry,
  source,
}) {
  let confidence = 0.6;

  if (isUsableContextSubject(subject)) {
    confidence += 0.15;
  }

  if (
    entityType &&
    !["generic_entity", "unknown"].includes(entityType)
  ) {
    confidence += 0.12;
  }

  if (parentCountry) {
    confidence += 0.06;
  }

  if (source === "contextSubject") {
    confidence += 0.05;
  }

  return Math.min(
    0.98,
    Number(confidence.toFixed(3)),
  );
}

/**
 * Resolves the best semantic subject for a contextual sentence.
 *
 * Priority:
 * 1. contextualSentence.contextSubject
 * 2. first meaningful contextPath entry
 * 3. extracted proposition subject
 *
 * @param {{
 *   contextSubject?: string|null,
 *   contextPath?: string[],
 *   original?: string,
 *   rewritten?: string
 * }} contextualSentence
 *
 * @param {{
 *   subject?: string|null,
 *   canonicalSubject?: string|null
 * }} proposition
 *
 * @returns {{
 *   resolvedSubject: string|null,
 *   canonicalSubject: string|null,
 *   entityType: string,
 *   parentCountry: string|null,
 *   aliases: string[],
 *   entityCandidateId: string|null,
 *   source: "contextSubject" | "contextPath" | "proposition" | "missing",
 *   overrideRecommended: boolean,
 *   confidence: number
 * }}
 */
function resolveContextSubject(
  contextualSentence = {},
  proposition = {},
) {
  const directContextSubject = removeTerminalPunctuation(
    contextualSentence.contextSubject,
  );

  const contextPath = Array.isArray(
    contextualSentence.contextPath,
  )
    ? contextualSentence.contextPath
        .map(removeTerminalPunctuation)
        .filter(Boolean)
    : [];

  const propositionSubject = removeTerminalPunctuation(
    proposition.canonicalSubject ||
      proposition.subject,
  );

  let resolvedSubject = null;
  let source = "missing";

  if (isUsableContextSubject(directContextSubject)) {
    resolvedSubject = directContextSubject;
    source = "contextSubject";
  } else {
    const firstUsableContextEntry =
      contextPath.find(isUsableContextSubject);

    if (firstUsableContextEntry) {
      resolvedSubject = firstUsableContextEntry;
      source = "contextPath";
    } else if (
      isUsableContextSubject(propositionSubject)
    ) {
      resolvedSubject = propositionSubject;
      source = "proposition";
    }
  }

  if (!resolvedSubject) {
    return {
      resolvedSubject: null,
      canonicalSubject: null,
      entityType: "unknown",
      parentCountry: null,
      aliases: [],
      entityCandidateId: null,
      source: "missing",
      overrideRecommended: false,
      confidence: 0,
    };
  }

  const canonicalSubject = resolvedSubject;
  const entityType =
    detectEntityType(canonicalSubject);
  const parentCountry =
    detectParentCountry(canonicalSubject);
  const aliases =
    buildAliases(canonicalSubject);

  const normalizedPropositionSubject =
    propositionSubject.toLowerCase();

  const normalizedResolvedSubject =
    canonicalSubject.toLowerCase();

  const overrideRecommended =
    source !== "proposition" &&
    normalizedResolvedSubject !==
      normalizedPropositionSubject;

  const confidence =
    calculateResolutionConfidence({
      subject: canonicalSubject,
      entityType,
      parentCountry,
      source,
    });

  return {
    resolvedSubject,
    canonicalSubject,
    entityType,
    parentCountry,
    aliases,
    entityCandidateId:
      createEntityCandidateId(
        entityType,
        canonicalSubject,
      ),
    source,
    overrideRecommended,
    confidence,
  };
}

export {
  buildAliases,
  calculateResolutionConfidence,
  createEntityCandidateId,
  detectEntityType,
  detectParentCountry,
  isUsableContextSubject,
  resolveContextSubject,
};