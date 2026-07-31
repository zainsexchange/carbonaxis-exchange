const CLAUSE_SEPARATORS = Object.freeze([
  ";",
  "•",
  "\n",
]);

function normalizeWhitespace(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSentences(text = "") {
  const normalized =
    normalizeWhitespace(text);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map(normalizeWhitespace)
    .filter(Boolean);
}

function splitClauses(sentence = "") {
  let clauses = [sentence];

  for (const separator of CLAUSE_SEPARATORS) {
    clauses = clauses.flatMap((clause) =>
      clause
        .split(separator)
        .map(normalizeWhitespace)
        .filter(Boolean)
    );
  }

  return clauses;
}

function createBaseProposition(clause = "", originalSentence = "") {
  return {
    subject: null,
    predicate: null,
    object: null,

    clause: normalizeWhitespace(clause),

    originalSentence:
      normalizeWhitespace(originalSentence),

    confidence: 0,

    expanded: false,

    valid: false,
  };
}

export function extractBasePropositions(text = "") {
  const propositions = [];

  const sentences =
    splitIntoSentences(text);

  for (const sentence of sentences) {
    const clauses =
      splitClauses(sentence);

    for (const clause of clauses) {
      propositions.push(
        createBaseProposition(
          clause,
          sentence
        )
      );
    }
  }

  return propositions;
}