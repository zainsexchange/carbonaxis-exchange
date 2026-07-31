const METADATA_PREFIXES = Object.freeze([
  "country:",
  "country ",
  "jurisdiction:",
  "jurisdiction ",
  "document type:",
  "document type ",
  "source class:",
  "source class ",
  "publication date:",
  "publication date ",
  "effective date:",
  "effective date ",
  "issuing authority:",
  "issuing authority ",
  "authority:",
  "language:",
  "language ",
  "version:",
  "page:",
  "page ",
  "section:",
  "chapter:",
  "table:",
  "figure:",
  "appendix:",
]);

const HEADING_PATTERNS = Object.freeze([
  /^executive summary$/i,
  /^general overview$/i,
  /^strategic targets(?: and milestones)?$/i,
  /^target hierarchy$/i,
  /^sector programs?$/i,
  /^grid modernization$/i,
  /^finance$/i,
  /^transport$/i,
  /^industry$/i,
  /^agriculture(?: and methane)?$/i,
  /^carbon markets?(?: and digital mrv)?$/i,
  /^implementation$/i,
  /^governance$/i,
  /^test questions?/i,
  /^key \d{4} outcomes?$/i,
  /^indicator\b/i,
]);

const INTERNAL_TEST_PATTERNS = Object.freeze([
  "synthetic test document",
  "synthetic policy framework",
  "fictional, internally generated",
  "fictional internally generated",
  "created to test carbon brain",
  "carbon brain test document",
  "document ingestion",
  "retrieval, metadata and citation validation",
  "citation validation",
  "development test document",
  "do not cite as an official policy",
  "not an official government policy",
  "test questions for carbon brain",
]);

const INCOMPLETE_ENDINGS = Object.freeze([
  ",",
  ":",
  ";",
  "-",
  "–",
  "—",
  "(",
  "/",
]);

const LOW_INFORMATION_PHRASES = Object.freeze([
  "english",
  "federal",
  "global",
  "internal",
  "strategy",
  "other",
  "unknown",
  "not available",
]);

function normalizeWhitespace(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableText(value = "") {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[“”‘’"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(value = "") {
  const normalized =
    normalizeWhitespace(value);

  if (!normalized) {
    return 0;
  }

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function hasVerbLikeSignal(value = "") {
  return /\b(is|are|was|were|be|been|being|has|have|had|will|would|shall|should|aims?|targets?|plans?|supports?|establishes?|requires?|includes?|focuses?|seeks?|provides?|reduces?|increases?|mobilizes?|produces?|covers?|applies?|operates?|launches?|develops?|introduces?|expects?|prioritizes?)\b/i.test(
    String(value)
  );
}
function containsNumericSignal(value = "") {
  return /\b\d+(?:[,.]\d+)?\s*(?:%|percent|mw|gw|tw|usd|aed|pkr|eur|gbp|tonnes?|tons?|tco2e|mtco2e|gtco2e|years?)?\b/i.test(
    value
  );
}

function looksLikeMetadata(statement = "") {
  const value =
    normalizeComparableText(statement);

  if (!value) {
    return true;
  }

  return METADATA_PREFIXES.some(
    (prefix) =>
      value.startsWith(prefix)
  );
}

function looksLikeHeading(statement = "") {
  const value =
    normalizeWhitespace(statement);

  if (!value) {
    return true;
  }

  if (
    HEADING_PATTERNS.some(
      (pattern) =>
        pattern.test(value)
    )
  ) {
    return true;
  }

  const wordCount =
    countWords(value);

  const hasSentencePunctuation =
    /[.!?]$/.test(value);

  const appearsTitleCased =
    value
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => {
        const cleaned =
          word.replace(
            /[^A-Za-z0-9-]/g,
            ""
          );

        if (!cleaned) {
          return true;
        }

        return (
          /^[A-Z0-9]/.test(cleaned) ||
          cleaned.length <= 3
        );
      });

  return (
    wordCount <= 8 &&
    appearsTitleCased &&
    !hasSentencePunctuation &&
    !hasVerbLikeSignal(value)
  );
}

function looksLikeInternalTestContent(
  statement = ""
) {
  const value =
    normalizeComparableText(statement);

  return INTERNAL_TEST_PATTERNS.some(
    (pattern) =>
      value.includes(pattern)
  );
}

function looksLikeQuestion(statement = "") {
  const value =
    normalizeWhitespace(statement);

  return (
    /\?$/.test(value) ||
    /^\d+\s+(what|when|where|which|who|why|how)\b/i.test(
      value
    )
  );
}

function looksLikeTableRow(statement = "") {
  const value =
    normalizeWhitespace(statement);

  if (!value) {
    return false;
  }

  const numericTokenCount =
    (
      value.match(
        /\b\d+(?:\.\d+)?%?\b/g
      ) || []
    ).length;

  const delimiterCount =
    (
      value.match(
        /[|	]/g
      ) || []
    ).length;

  const wordCount =
    countWords(value);

  if (delimiterCount >= 2) {
    return true;
  }

  return (
    numericTokenCount >= 3 &&
    wordCount <= 12 &&
    !hasVerbLikeSignal(value)
  );
}

function looksLikeFragment(statement = "") {
  const value =
    normalizeWhitespace(statement);

  const wordCount =
    countWords(value);

  if (!value) {
    return true;
  }

  if (wordCount < 4) {
    return true;
  }

  const finalCharacter =
    value.slice(-1);

  if (
    INCOMPLETE_ENDINGS.includes(
      finalCharacter
    )
  ) {
    return true;
  }

  if (
    wordCount < 8 &&
    !hasVerbLikeSignal(value) &&
    !containsNumericSignal(value)
  ) {
    return true;
  }

  return false;
}

function looksLowInformation(statement = "") {
  const value =
    normalizeComparableText(statement);

  if (
    LOW_INFORMATION_PHRASES.includes(
      value
    )
  ) {
    return true;
  }

  const alphabeticCharacters =
    value.replace(
      /[^a-z]/g,
      ""
    ).length;

  return alphabeticCharacters < 5;
}

function scoreFactQuality(fact = {}) {
  const statement =
    normalizeWhitespace(
      fact.statement ||
      fact.text ||
      ""
    );

  const reasons = [];
  let score = 100;

  if (!statement) {
    return {
      score: 0,
      accepted: false,
      reasons: [
        "empty_statement",
      ],
    };
  }

  if (looksLikeMetadata(statement)) {
    score -= 90;
    reasons.push(
      "metadata"
    );
  }

  if (looksLikeHeading(statement)) {
    score -= 70;
    reasons.push(
      "heading"
    );
  }

  if (
    looksLikeInternalTestContent(
      statement
    )
  ) {
    score -= 75;
    reasons.push(
      "internal_test_content"
    );
  }

  if (looksLikeQuestion(statement)) {
    score -= 80;
    reasons.push(
      "question"
    );
  }

  if (looksLikeTableRow(statement)) {
    score -= 45;
    reasons.push(
      "table_row"
    );
  }

  if (looksLikeFragment(statement)) {
    score -= 45;
    reasons.push(
      "fragment"
    );
  }

  if (
    looksLowInformation(statement)
  ) {
    score -= 60;
    reasons.push(
      "low_information"
    );
  }

  if (
    hasVerbLikeSignal(statement)
  ) {
    score += 10;
    reasons.push(
      "verb_signal"
    );
  }

  if (
    containsNumericSignal(statement)
  ) {
    score += 5;
    reasons.push(
      "numeric_signal"
    );
  }

  const boundedScore =
    Math.max(
      0,
      Math.min(100, score)
    );

  return {
    score:
      boundedScore,

    accepted:
      boundedScore >= 45,

    reasons,
  };
}

export function evaluateFactQuality(
  fact = {}
) {
  const statement =
    normalizeWhitespace(
      fact.statement ||
      fact.text ||
      ""
    );

  const result =
    scoreFactQuality(fact);

  return {
    ...fact,

    statement,

    factQuality: {
      score:
        result.score,

      accepted:
        result.accepted,

      reasons:
        result.reasons,
    },
  };
}

export function filterLowQualityFacts(
  facts = []
) {
  if (!Array.isArray(facts)) {
    return {
      facts: [],
      acceptedFacts: [],
      rejectedFacts: [],
      inputCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      rejectionReasons: {},
    };
  }

  const acceptedFacts = [];
  const rejectedFacts = [];
  const rejectionReasons = {};

  for (const fact of facts) {
    const evaluatedFact =
      evaluateFactQuality(fact);

    if (
      evaluatedFact
        .factQuality
        .accepted
    ) {
      acceptedFacts.push(
        evaluatedFact
      );

      continue;
    }

    rejectedFacts.push(
      evaluatedFact
    );

    for (
      const reason of
      evaluatedFact
        .factQuality
        .reasons
    ) {
      rejectionReasons[reason] =
        Number(
          rejectionReasons[reason] ||
          0
        ) + 1;
    }
  }

  return {
    facts:
      acceptedFacts,

    acceptedFacts,

    rejectedFacts,

    inputCount:
      facts.length,

    acceptedCount:
      acceptedFacts.length,

    rejectedCount:
      rejectedFacts.length,

    rejectionReasons,
  };
}