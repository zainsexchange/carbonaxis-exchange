/**
 * Carbon Brain source authority + library curation priority.
 *
 * sourceAuthorityScore: 0–100 (higher = more trusted in evidence ranking)
 * curationTier: 1–5 (populate library in this order; ~70% should be Tier 1)
 */

export const SOURCE_AUTHORITY_SCORES = Object.freeze({
  government: 100,
  un: 98,
  iea: 97,
  irena: 97,
  world_bank: 96,
  ipcc: 96,
  oecd: 96,
  ifc: 96,
  international_organization: 96,
  iso: 95,
  standard_body: 95,
  registry: 94,
  research: 90,
  peer_reviewed: 90,
  industry: 80,
  customer: 70,
  internal: 72,
  news: 60,
  blog: 30,
  other: 45,
});

/**
 * Named issuers override generic sourceClass when known.
 * Keys are lowercase substrings / exact aliases.
 */
export const ISSUER_AUTHORITY_SCORES = Object.freeze([
  { match: /\bunited nations\b|\bunfccc\b|\bun\b/i, score: 98, key: "un" },
  { match: /\binternational energy agency\b|\biea\b/i, score: 97, key: "iea" },
  { match: /\birena\b|international renewable energy agency/i, score: 97, key: "irena" },
  { match: /\bworld bank\b|\bibrd\b|\bida\b/i, score: 96, key: "world_bank" },
  { match: /\bipcc\b|intergovernmental panel on climate change/i, score: 96, key: "ipcc" },
  { match: /\boecd\b/i, score: 96, key: "oecd" },
  { match: /\bifc\b|international finance corporation/i, score: 96, key: "ifc" },
  { match: /\biso\b|international organization for standardization/i, score: 95, key: "iso" },
  { match: /\bghg protocol\b|greenhouse gas protocol/i, score: 95, key: "standard_body" },
  { match: /\bissb\b|ifrs foundation\b/i, score: 95, key: "standard_body" },
  { match: /\btcfd\b/i, score: 95, key: "standard_body" },
  { match: /\bsbti\b|science based targets/i, score: 95, key: "standard_body" },
  { match: /\bverra\b|\bgold standard\b|\bicvcm\b/i, score: 94, key: "registry" },
]);

/**
 * Library population priority (~70% of corpus should be Tier 1).
 */
export const CURATION_TIERS = Object.freeze({
  1: {
    shareTarget: 0.7,
    label: "Highest Priority — Official Government",
    documentTypes: [
      "law",
      "regulation",
      "policy",
      "strategy",
    ],
    sourceClasses: ["government"],
    folderHints: [
      "01_GCC/*/Laws",
      "01_GCC/*/Policies",
      "01_GCC/*/Strategies",
      "01_GCC/*/Hydrogen",
      "01_GCC/*/Renewable_Energy",
      "01_GCC/*/Net_Zero",
      "01_GCC/*/Electricity",
      "01_GCC/*/Climate",
      "01_GCC/*/Carbon_Markets",
      "01_GCC/*/ESG",
    ],
    examples: [
      "Government laws",
      "Cabinet decisions",
      "National strategies",
      "Ministerial regulations",
      "Official policies",
      "Executive regulations",
    ],
  },
  2: {
    shareTarget: 0.15,
    label: "Government Implementation & Guidance",
    documentTypes: ["framework", "guidance", "report"],
    sourceClasses: ["government"],
    folderHints: [
      "01_GCC/*/Reports",
      "01_GCC/*/Policies",
      "01_GCC/*/MRV",
      "01_GCC/*/Strategies",
    ],
    examples: [
      "Government implementation plans",
      "National roadmaps",
      "Official guidance",
      "Regulatory frameworks",
      "National reports",
    ],
  },
  3: {
    shareTarget: 0.08,
    label: "International Organizations",
    documentTypes: ["report", "framework", "guidance", "strategy"],
    sourceClasses: ["un", "international_organization"],
    folderHints: [
      "02_International/UNFCCC",
      "02_International/IEA",
      "02_International/IRENA",
      "02_International/World_Bank",
      "02_International/IPCC",
      "02_International/OECD",
      "02_International/IFC",
    ],
    examples: ["UNFCCC", "IEA", "IRENA", "World Bank", "IPCC", "OECD"],
  },
  4: {
    shareTarget: 0.05,
    label: "Standards & Frameworks",
    documentTypes: ["standard", "methodology", "framework", "guidance"],
    sourceClasses: ["standard_body", "registry"],
    folderHints: [
      "04_Standards/ISO",
      "04_Standards/GHG_Protocol",
      "04_Standards/ISSB",
      "04_Standards/SBTi",
      "04_Standards/TCFD",
      "03_Carbon_Markets/Verra",
      "03_Carbon_Markets/Gold_Standard",
      "03_Carbon_Markets/ICVCM",
    ],
    examples: ["ISO", "GHG Protocol", "ISSB", "SBTi", "TCFD"],
  },
  5: {
    shareTarget: 0.02,
    label: "Research & White Papers",
    documentTypes: ["research", "report", "other"],
    sourceClasses: ["research", "other", "internal"],
    folderHints: ["05_Research"],
    examples: ["Peer-reviewed papers", "White papers", "Industry analysis"],
  },
});

const TIER1_DOC_TYPES = new Set(CURATION_TIERS[1].documentTypes);
const TIER2_DOC_TYPES = new Set(CURATION_TIERS[2].documentTypes);
const TIER4_DOC_TYPES = new Set(CURATION_TIERS[4].documentTypes);

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEnum(value = "") {
  return normalizeText(value).toLowerCase();
}

/**
 * Resolve 0–100 sourceAuthorityScore for a knowledge document.
 */
export function resolveSourceAuthorityScore(document = {}) {
  if (
    Number.isFinite(Number(document.sourceAuthorityScore)) &&
    Number(document.sourceAuthorityScore) > 0
  ) {
    return Math.max(
      0,
      Math.min(100, Math.round(Number(document.sourceAuthorityScore)))
    );
  }

  const issuer = normalizeText(
    document.issuingAuthority || document.authority || ""
  );

  for (const entry of ISSUER_AUTHORITY_SCORES) {
    if (issuer && entry.match.test(issuer)) {
      return entry.score;
    }
  }

  const sourceClass = normalizeEnum(document.sourceClass || "other");

  if (Object.prototype.hasOwnProperty.call(SOURCE_AUTHORITY_SCORES, sourceClass)) {
    return SOURCE_AUTHORITY_SCORES[sourceClass];
  }

  // Soft aliases
  if (sourceClass === "corporate") {
    return SOURCE_AUTHORITY_SCORES.industry;
  }

  return SOURCE_AUTHORITY_SCORES.other;
}

/**
 * 0–1 form used by evidence ranking / confidence.
 */
export function resolveSourceAuthorityUnitScore(document = {}) {
  return resolveSourceAuthorityScore(document) / 100;
}

/**
 * Infer curation tier 1–5 for population priority + ranking soft boost.
 */
export function resolveCurationTier(document = {}) {
  if (
    Number.isInteger(Number(document.curationTier)) &&
    Number(document.curationTier) >= 1 &&
    Number(document.curationTier) <= 5
  ) {
    return Number(document.curationTier);
  }

  // Legacy CB-STD authorityTier (1 = strongest) maps directly.
  if (
    Number.isInteger(Number(document.authorityTier)) &&
    Number(document.authorityTier) >= 1 &&
    Number(document.authorityTier) <= 5
  ) {
    return Number(document.authorityTier);
  }

  const sourceClass = normalizeEnum(document.sourceClass || "other");
  const documentType = normalizeEnum(document.documentType || "other");
  const score = resolveSourceAuthorityScore(document);

  if (sourceClass === "government" && TIER1_DOC_TYPES.has(documentType)) {
    return 1;
  }

  if (sourceClass === "government" && TIER2_DOC_TYPES.has(documentType)) {
    return 2;
  }

  if (sourceClass === "government") {
    return 2;
  }

  if (
    sourceClass === "un" ||
    sourceClass === "international_organization" ||
    score >= 96
  ) {
    return 3;
  }

  if (
    sourceClass === "standard_body" ||
    sourceClass === "registry" ||
    TIER4_DOC_TYPES.has(documentType) ||
    score === 95
  ) {
    return 4;
  }

  return 5;
}

/**
 * Persistable fields to attach at upload / process time.
 */
export function buildAuthorityFields(document = {}) {
  const sourceAuthorityScore = resolveSourceAuthorityScore(document);
  const curationTier = resolveCurationTier({
    ...document,
    sourceAuthorityScore,
  });

  return {
    sourceAuthorityScore,
    curationTier,
    authorityTier: curationTier,
    sourceTrustScore: sourceAuthorityScore / 100,
  };
}

export default {
  SOURCE_AUTHORITY_SCORES,
  ISSUER_AUTHORITY_SCORES,
  CURATION_TIERS,
  resolveSourceAuthorityScore,
  resolveSourceAuthorityUnitScore,
  resolveCurationTier,
  buildAuthorityFields,
};
