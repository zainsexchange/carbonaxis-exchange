import {
  resolveSourceAuthorityScore,
  SOURCE_AUTHORITY_SCORES,
} from "../config/sourceAuthority.js";

const LEVEL_BY_SCORE = Object.freeze([
  { min: 95, level: "Official", stars: 5, color: "green" },
  { min: 90, level: "Institutional", stars: 5, color: "green" },
  { min: 80, level: "Research", stars: 4, color: "blue" },
  { min: 70, level: "Industry", stars: 4, color: "blue" },
  { min: 60, level: "Media", stars: 3, color: "orange" },
  { min: 0, level: "Low Trust", stars: 2, color: "gray" },
]);

const BADGE_BY_CLASS = Object.freeze({
  government: "Government",
  un: "United Nations",
  standard_body: "Standards Body",
  registry: "Certified Registry",
  international_organization: "International Organization",
  research: "Research",
  industry: "Industry",
  corporate: "Corporate",
  internal: "Internal Research",
  customer: "Customer",
  news: "News",
  blog: "Blog",
  other: "Other",
});

/**
 * Resolve display + numeric authority for a knowledge document.
 * Numeric sourceAuthorityScore (0–100) drives ranking.
 */
export function resolveAuthority(document = {}) {
  const sourceClass = String(document.sourceClass || "other")
    .trim()
    .toLowerCase();

  const score = resolveSourceAuthorityScore(document);
  const band =
    LEVEL_BY_SCORE.find((entry) => score >= entry.min) ||
    LEVEL_BY_SCORE[LEVEL_BY_SCORE.length - 1];

  return {
    score,
    level: band.level,
    stars: band.stars,
    color: band.color,
    badge: BADGE_BY_CLASS[sourceClass] || BADGE_BY_CLASS.other,
    description: `Source authority score ${score}/100.`,
    sourceAuthorityScore: score,
  };
}

/**
 * Back-compat matrix for older callers that expect class → score.
 */
export const AUTHORITY_MATRIX = Object.freeze(
  Object.fromEntries(
    Object.entries(SOURCE_AUTHORITY_SCORES).map(([key, score]) => [
      key,
      {
        score,
        level: resolveAuthority({ sourceClass: key }).level,
        stars: resolveAuthority({ sourceClass: key }).stars,
        color: resolveAuthority({ sourceClass: key }).color,
        badge: BADGE_BY_CLASS[key] || BADGE_BY_CLASS.other,
        description: `Source authority score ${score}/100.`,
      },
    ])
  )
);

export default resolveAuthority;
