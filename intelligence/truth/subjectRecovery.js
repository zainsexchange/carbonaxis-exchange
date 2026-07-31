const SUBJECT_PATTERNS = Object.freeze([
  /^(The strategy)/i,
  /^(The policy)/i,
  /^(The framework)/i,
  /^(The government)/i,
  /^(The ministry)/i,
  /^(The objective)/i,
  /^(The program)/i,
  /^(Pakistan)/i,
  /^(UAE)/i,
]);

function normalizeWhitespace(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectExplicitSubject(clause = "") {

  const text =
    normalizeWhitespace(clause);

  for (const pattern of SUBJECT_PATTERNS) {

    const match =
      text.match(pattern);

    if (match) {

      return match[1];
    }
  }

  return null;
}

function extractLeadingNamedEntity(clause = "") {
  const text = normalizeWhitespace(clause);

  const patterns = [
    /^([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*)\s+(supports|targets|plans|aims|seeks|includes|requires|provides|reduces|mobilizes)\b/i,
    /^((?:Government|Ministry|Department|Authority|National)\s+of\s+[A-Z][A-Za-z\s-]+?)\s+(supports|targets|plans|aims|seeks|includes|requires|provides|reduces|mobilizes)\b/i,
    /^([A-Z][A-Za-z]+(?:\s+of\s+[A-Z][A-Za-z]+)+)\s+(supports|targets|plans|aims|seeks|includes|requires|provides|reduces|mobilizes)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

export function recoverSubjects(
  propositions = []
) {
  let previousSentence = null;
  let previousSubject = null;

  return propositions.map((proposition) => {
    if (
      proposition.originalSentence !== previousSentence
    ) {
      previousSentence = proposition.originalSentence;
      previousSubject = null;
    }

    let subject = detectExplicitSubject(
      proposition.clause
    );

    if (!subject) {
      subject = extractLeadingNamedEntity(
        proposition.clause
      );
    }

    if (subject) {
      previousSubject = subject;

      return {
        ...proposition,
        subject,
      };
    }

    if (previousSubject) {
      return {
        ...proposition,
        subject: previousSubject,
      };
    }

    return {
      ...proposition,
      subject: previousSubject,
    };
  });
}