function normalizeText(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForComparison(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%$€£.,:/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumericValue(value = "") {
  const parsed = Number(
    String(value)
      .replace(/,/g, "")
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(value = "") {
  const normalized = String(value).toLowerCase();

  const map = {
    "$": "usd",
    usd: "usd",
    "€": "eur",
    eur: "eur",
    "£": "gbp",
    gbp: "gbp",
  };

  return map[normalized] || "";
}

function normalizeUnit(value = "") {
  const normalized = String(value).toLowerCase();

  const map = {
    "%": "percent",
    percent: "percent",

    tonne: "tonnes",
    tonnes: "tonnes",
    ton: "tonnes",
    tons: "tonnes",

    year: "years",
    years: "years",

    usd: "usd",
    eur: "eur",
    gbp: "gbp",

    million: "million",
    billion: "billion",

    mtco2e: "mtco2e",
    tco2e: "tco2e",
    mw: "mw",
    gw: "gw",
    kg: "kg",
  };

  return map[normalized] || normalized;
}

function extractNumericClaims(text = "") {
  const normalized = normalizeText(text);

  /*
   * Only extract numbers carrying an explicit unit or currency.
   *
   * This intentionally excludes:
   * - page numbers
   * - section numbers
   * - list numbering
   * - bare publication years
   * - version numbers
   * - dates such as 15 July 2026
   */
  const pattern =
    /(?:(?<currency>[$€£]|usd|eur|gbp)\s*)?(?<value>\d+(?:,\d{3})*(?:\.\d+)?)\s*(?<unit>%|percent|usd|eur|gbp|million|billion|mtco2e|tco2e|mw|gw|kg|tonnes?|tons?|years?)\b/gi;

  const claims = [];

  for (const match of normalized.matchAll(pattern)) {
    const numericValue = parseNumericValue(
      match.groups?.value
    );

    if (numericValue === null) {
      continue;
    }

    const currency = normalizeCurrency(
      match.groups?.currency
    );

    const unit = normalizeUnit(
      match.groups?.unit
    );

    claims.push({
      raw: match[0],
      value: numericValue,
      currency,
      unit,
      index: match.index ?? 0,
    });
  }

  return claims;
}

function createContextWindow(
  text,
  index,
  radius = 140
) {
  const normalized = normalizeText(text);

  const start = Math.max(0, index - radius);
  const end = Math.min(
    normalized.length,
    index + radius
  );

  return normalizeText(
    normalized.slice(start, end)
  );
}

function getDocumentDate(document = {}) {
  const value =
    document.lastVerifiedAt ||
    document.effectiveDate ||
    document.publicationDate;

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function getEvidenceCountry(evidence = {}) {
  return normalizeForComparison(
    evidence.country ||
    evidence.document?.country ||
    ""
  );
}

function isPlaceholderCountry(value = "") {
  return new Set([
    "",
    "global",
    "other",
    "unknown",
    "unspecified",
    "international",
  ]).has(normalizeForComparison(value));
}

function hasCompatibleGeography(
  left = {},
  right = {}
) {
  const leftCountry = getEvidenceCountry(left);
  const rightCountry = getEvidenceCountry(right);

  const leftPlaceholder =
    isPlaceholderCountry(leftCountry);

  const rightPlaceholder =
    isPlaceholderCountry(rightCountry);

  /*
   * Be conservative:
   *
   * Pakistan versus UAE should not be treated as a direct
   * contradiction unless both records explicitly identify
   * the same geography.
   */
  if (leftPlaceholder !== rightPlaceholder) {
    return false;
  }

  if (!leftPlaceholder && !rightPlaceholder) {
    return leftCountry === rightCountry;
  }

  return true;
}

function extractNearestYear(
  text = "",
  claimIndex = 0,
  radius = 90
) {
  const normalized = normalizeText(text);

  const start = Math.max(
    0,
    claimIndex - radius
  );

  const end = Math.min(
    normalized.length,
    claimIndex + radius
  );

  const localText = normalized.slice(
    start,
    end
  );

  const years = [
    ...localText.matchAll(
      /\b(?:19|20)\d{2}\b/g
    ),
  ];

  if (!years.length) {
    return null;
  }

  let nearestYear = null;
  let nearestDistance = Infinity;

  for (const yearMatch of years) {
    const absoluteIndex =
      start + (yearMatch.index ?? 0);

    const distance = Math.abs(
      absoluteIndex - claimIndex
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestYear = Number(yearMatch[0]);
    }
  }

  return nearestYear;
}

const CONTEXT_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "also",
  "among",
  "before",
  "being",
  "below",
  "between",
  "carbon",
  "document",
  "during",
  "each",
  "from",
  "have",
  "into",
  "more",
  "other",
  "page",
  "percent",
  "section",
  "strategy",
  "target",
  "test",
  "than",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "under",
  "using",
  "version",
  "were",
  "which",
  "with",
  "within",
  "years",
]);

function getContextKeywords(value = "") {
  return new Set(
    normalizeForComparison(value)
      .split(" ")
      .map((word) =>
        word.replace(
          /^[^\p{L}]+|[^\p{L}]+$/gu,
          ""
        )
      )
      .filter(
        (word) =>
          word.length >= 4 &&
          !CONTEXT_STOP_WORDS.has(word) &&
          !/^\d+$/.test(word)
      )
  );
}

function calculateKeywordOverlap(
  leftContext = "",
  rightContext = ""
) {
  const leftWords =
    getContextKeywords(leftContext);

  const rightWords =
    getContextKeywords(rightContext);

  if (!leftWords.size || !rightWords.size) {
    return {
      overlapCount: 0,
      overlapRatio: 0,
    };
  }

  let overlapCount = 0;

  for (const word of leftWords) {
    if (rightWords.has(word)) {
      overlapCount += 1;
    }
  }

  return {
    overlapCount,
    overlapRatio:
      overlapCount /
      Math.min(
        leftWords.size,
        rightWords.size
      ),
  };
}

function sameTopic(left = {}, right = {}) {
  const leftSection = normalizeForComparison(
    left.sectionTitle
  );

  const rightSection = normalizeForComparison(
    right.sectionTitle
  );

  if (
    leftSection &&
    rightSection &&
    leftSection === rightSection
  ) {
    return true;
  }

  const {
    overlapCount,
    overlapRatio,
  } = calculateKeywordOverlap(
    left.content,
    right.content
  );

  return (
    overlapCount >= 2 &&
    overlapRatio >= 0.3
  );
}

function haveCompatibleUnits(
  leftClaim,
  rightClaim
) {
  if (leftClaim.unit !== rightClaim.unit) {
    return false;
  }

  if (
    leftClaim.currency &&
    rightClaim.currency &&
    leftClaim.currency !== rightClaim.currency
  ) {
    return false;
  }

  return true;
}

function compareNumericClaims(left, right) {
  const leftClaims =
    extractNumericClaims(left.content);

  const rightClaims =
    extractNumericClaims(right.content);

  const conflicts = [];

  for (const leftClaim of leftClaims) {
    for (const rightClaim of rightClaims) {
      if (
        !haveCompatibleUnits(
          leftClaim,
          rightClaim
        )
      ) {
        continue;
      }

      if (
        leftClaim.value === rightClaim.value
      ) {
        continue;
      }

      const leftContext =
        createContextWindow(
          left.content,
          leftClaim.index
        );

      const rightContext =
        createContextWindow(
          right.content,
          rightClaim.index
        );

      const leftYear =
        extractNearestYear(
          left.content,
          leftClaim.index
        );

      const rightYear =
        extractNearestYear(
          right.content,
          rightClaim.index
        );

      /*
       * Different target years are not contradictions.
       *
       * Example:
       * 45% by 2030
       * 60% by 2035
       */
      if (
        leftYear !== null &&
        rightYear !== null &&
        leftYear !== rightYear
      ) {
        continue;
      }

      /*
       * If only one claim has a nearby target year,
       * comparison is too ambiguous.
       */
      if (
        (leftYear === null) !==
        (rightYear === null)
      ) {
        continue;
      }

      const {
        overlapCount,
        overlapRatio,
      } = calculateKeywordOverlap(
        leftContext,
        rightContext
      );

      /*
       * Require strong semantic similarity between
       * the local claim contexts.
       */
      if (
        overlapCount < 2 ||
        overlapRatio < 0.35
      ) {
        continue;
      }

      conflicts.push({
        type: "numeric_disagreement",

        claim: {
          unit: leftClaim.unit,
          currency:
            leftClaim.currency ||
            rightClaim.currency ||
            "",
          targetYear:
            leftYear || rightYear || null,
        },

        left: {
          documentId: left.documentId,
          title:
            left.document?.title || "",
          value: leftClaim.raw,
          numericValue:
            leftClaim.value,
          context: leftContext,
          date: getDocumentDate(
            left.document
          ),
        },

        right: {
          documentId: right.documentId,
          title:
            right.document?.title || "",
          value: rightClaim.raw,
          numericValue:
            rightClaim.value,
          context: rightContext,
          date: getDocumentDate(
            right.document
          ),
        },
      });
    }
  }

  return conflicts;
}

function resolvePreferredSource(conflict) {
  const leftDate = conflict.left.date
    ? new Date(
        conflict.left.date
      ).getTime()
    : 0;

  const rightDate = conflict.right.date
    ? new Date(
        conflict.right.date
      ).getTime()
    : 0;

  if (leftDate > rightDate) {
    return "left";
  }

  if (rightDate > leftDate) {
    return "right";
  }

  return "undetermined";
}

export function detectConflicts(
  evidence = []
) {
  if (!Array.isArray(evidence)) {
    throw new Error(
      "Evidence must be supplied as an array."
    );
  }

  const conflicts = [];

  for (
    let leftIndex = 0;
    leftIndex < evidence.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < evidence.length;
      rightIndex += 1
    ) {
      const left = evidence[leftIndex];
      const right = evidence[rightIndex];

      if (
        !left?.content ||
        !right?.content
      ) {
        continue;
      }

      if (
        String(left.documentId) ===
        String(right.documentId)
      ) {
        continue;
      }

      if (
        !hasCompatibleGeography(
          left,
          right
        )
      ) {
        continue;
      }

      if (!sameTopic(left, right)) {
        continue;
      }

      const numericConflicts =
        compareNumericClaims(
          left,
          right
        );

      for (
        const conflict of numericConflicts
      ) {
        conflicts.push({
          ...conflict,
          preferredSource:
            resolvePreferredSource(
              conflict
            ),
        });
      }
    }
  }

  const uniqueConflicts = [];
  const seen = new Set();

  for (const conflict of conflicts) {
    const key = [
      conflict.type,
      conflict.claim?.unit || "",
      conflict.claim?.currency || "",
      conflict.claim?.targetYear || "",
      conflict.left.documentId,
      conflict.left.numericValue,
      conflict.right.documentId,
      conflict.right.numericValue,
    ].join("::");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueConflicts.push(conflict);
  }

  return {
    conflicts: uniqueConflicts,

    statistics: {
      evidenceCount: evidence.length,
      conflictCount:
        uniqueConflicts.length,
      hasConflicts:
        uniqueConflicts.length > 0,
    },
  };
}