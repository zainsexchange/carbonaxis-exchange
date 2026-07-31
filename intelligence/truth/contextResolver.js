/**
 * Converts document structure into semantic content blocks.
 *
 * Each returned block contains clean linguistic content and separate
 * hierarchy metadata. Breadcrumb text is never injected into the sentence.
 */

const BULLET_PATTERN = /^([•●▪◦‣⁃*-])\s+(.+)$/;
const NUMBERED_PATTERN = /^(\d+)[.)]\s+(.+)$/;
const LETTERED_PATTERN = /^([a-zA-Z])[.)]\s+(.+)$/;

const SENTENCE_END_PATTERN = /[.!?]$/;

const HEADING_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

/**
 * Normalizes a line without destroying its meaning.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeLine(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Removes trailing punctuation when evaluating a possible heading.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeHeading(value) {
  return normalizeLine(value)
    .replace(/[:;,.!?]+$/g, "")
    .trim();
}

/**
 * Determines whether a phrase resembles title case.
 *
 * @param {string} value
 * @returns {boolean}
 */
function looksLikeTitleCase(value) {
  const words = normalizeHeading(value)
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0 || words.length > 12) {
    return false;
  }

  let meaningfulWordCount = 0;
  let titleCaseWordCount = 0;

  for (const word of words) {
    const cleanedWord = word.replace(/[^a-zA-Z0-9'-]/g, "");

    if (!cleanedWord) {
      continue;
    }

    meaningfulWordCount += 1;

    const lowercaseWord = cleanedWord.toLowerCase();

    if (
      HEADING_STOP_WORDS.has(lowercaseWord) ||
      /^[A-Z0-9][A-Za-z0-9'-]*$/.test(cleanedWord) ||
      /^[A-Z]{2,}$/.test(cleanedWord)
    ) {
      titleCaseWordCount += 1;
    }
  }

  return (
    meaningfulWordCount > 0 &&
    titleCaseWordCount / meaningfulWordCount >= 0.8
  );
}

/**
 * Detects sentence-like content that should not be treated as a heading.
 *
 * @param {string} value
 * @returns {boolean}
 */
function looksLikeSentence(value) {
  const line = normalizeLine(value);
  const words = line.split(/\s+/).filter(Boolean);

  if (SENTENCE_END_PATTERN.test(line)) {
    return true;
  }

  if (words.length > 14) {
    return true;
  }

  return /\b(is|are|was|were|will|shall|should|must|has|have|had|targets|supports|seeks|aims|includes|requires|provides)\b/i.test(
    line,
  );
}

/**
 * Determines whether a numbered line is more likely to be a heading.
 *
 * Examples:
 * 1. Energy
 * 2. Finance
 *
 * @param {string} content
 * @returns {boolean}
 */
function looksLikeNumberedHeading(content) {
  const normalized = normalizeHeading(content);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (!normalized || wordCount > 8) {
    return false;
  }

  if (looksLikeSentence(normalized)) {
    return false;
  }

  return looksLikeTitleCase(normalized);
}

/**
 * Determines whether an unnumbered line is likely to be a heading.
 *
 * @param {string} line
 * @param {string} previousLine
 * @param {string} nextLine
 * @returns {boolean}
 */
function looksLikeHeading(line, previousLine = "", nextLine = "") {
  const normalized = normalizeHeading(line);

  if (!normalized) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (wordCount > 12) {
    return false;
  }

  if (!looksLikeTitleCase(normalized)) {
    return false;
  }

  const previousIsBlank = !normalizeLine(previousLine);
  const nextIsBlank = !normalizeLine(nextLine);

  const nextIsList =
    BULLET_PATTERN.test(normalizeLine(nextLine)) ||
    NUMBERED_PATTERN.test(normalizeLine(nextLine)) ||
    LETTERED_PATTERN.test(normalizeLine(nextLine));

  if (
    nextIsList &&
    wordCount <= 6 &&
    looksLikeTitleCase(normalized)
  ) {
    return true;
  }

  if (looksLikeSentence(normalized)) {
    return false;
  }

  return previousIsBlank || nextIsBlank || wordCount <= 4;
}

/**
 * Classifies a document line.
 *
 * @param {string} line
 * @param {string} previousLine
 * @param {string} nextLine
 * @returns {{
 *   type: "blank" | "heading" | "listItem" | "paragraph",
 *   content: string,
 *   markerType?: string,
 *   markerValue?: string
 * }}
 */
function classifyLine(line, previousLine = "", nextLine = "") {
  const normalized = normalizeLine(line);

  if (!normalized) {
    return {
      type: "blank",
      content: "",
    };
  }

  const numberedMatch = normalized.match(NUMBERED_PATTERN);

  if (numberedMatch) {
    const content = normalizeLine(numberedMatch[2]);

    if (looksLikeNumberedHeading(content)) {
      return {
        type: "heading",
        content: normalizeHeading(content),
        markerType: "number",
        markerValue: numberedMatch[1],
      };
    }

    return {
      type: "listItem",
      content,
      markerType: "number",
      markerValue: numberedMatch[1],
    };
  }

  const bulletMatch = normalized.match(BULLET_PATTERN);

  if (bulletMatch) {
    return {
      type: "listItem",
      content: normalizeLine(bulletMatch[2]),
      markerType: "bullet",
      markerValue: bulletMatch[1],
    };
  }

  const letteredMatch = normalized.match(LETTERED_PATTERN);

  if (letteredMatch) {
    return {
      type: "listItem",
      content: normalizeLine(letteredMatch[2]),
      markerType: "letter",
      markerValue: letteredMatch[1],
    };
  }

  if (looksLikeHeading(normalized, previousLine, nextLine)) {
    return {
      type: "heading",
      content: normalizeHeading(normalized),
    };
  }

  return {
    type: "paragraph",
    content: normalized,
  };
}

/**
 * Infers a heading level.
 *
 * Numbered top-level headings reset the hierarchy.
 * Short unnumbered headings generally become children of the document title.
 *
 * @param {object} classification
 * @param {string[]} headingStack
 * @returns {number}
 */
function inferHeadingLevel(classification, headingStack) {
  if (
    classification.markerType === "number" &&
    classification.markerValue
  ) {
    return 1;
  }

  if (headingStack.length === 0) {
    return 0;
  }

  if (headingStack.length === 1) {
    return 1;
  }

  return Math.min(headingStack.length, 2);
}

/**
 * Updates the active heading stack.
 *
 * @param {string[]} headingStack
 * @param {string} heading
 * @param {number} level
 * @returns {string[]}
 */
function updateHeadingStack(headingStack, heading, level) {
  const nextStack = [...headingStack];

  if (level <= 0) {
    return [heading];
  }

  nextStack.splice(level);
  nextStack[level] = heading;

  return nextStack.filter(Boolean);
}

/**
 * Builds structured context blocks from cleaned document text.
 *
 * @param {string} text
 * @returns {Array<{
 *   content: string,
 *   contextPath: string[],
 *   type: "listItem" | "paragraph",
 *   sourceLine: number,
 *   markerType: string | null,
 *   markerValue: string | null
 * }>}
 */
export function resolveContextBlocks(text) {
  const lines = String(text || "").split(/\r?\n/);

  const blocks = [];
  let headingStack = [];

  for (let index = 0; index < lines.length; index += 1) {
    const previousLine = index > 0 ? lines[index - 1] : "";
    const currentLine = lines[index];

    let nextLine = "";
    for (
      let lookAhead = index + 1;
      lookAhead < lines.length;
      lookAhead += 1
    ) {
      if (normalizeLine(lines[lookAhead])) {
        nextLine = lines[lookAhead];
        break;
      }
    }

    const classification = classifyLine(
      currentLine,
      previousLine,
      nextLine,
    );

    if (classification.type === "blank") {
      continue;
    }

    if (classification.type === "heading") {
      const level = inferHeadingLevel(
        classification,
        headingStack,
      );

      headingStack = updateHeadingStack(
        headingStack,
        classification.content,
        level,
      );

      continue;
    }

    blocks.push({
      content: classification.content,
      contextPath: [...headingStack],
      type: classification.type,
      sourceLine: index + 1,
      markerType: classification.markerType || null,
      markerValue: classification.markerValue || null,
    });
  }

  return blocks;
}

/**
 * Legacy text resolver retained temporarily for compatibility.
 *
 * New semantic code should use resolveContextBlocks().
 *
 * @param {string} text
 * @returns {string}
 */
export function resolveContext(text) {
  return resolveContextBlocks(text)
    .map((block) => {
      const sentence = SENTENCE_END_PATTERN.test(block.content)
        ? block.content
        : `${block.content}.`;

      return sentence;
    })
    .join("\n");
}

export {
  classifyLine,
  inferHeadingLevel,
  looksLikeHeading,
  looksLikeNumberedHeading,
  updateHeadingStack,
};
