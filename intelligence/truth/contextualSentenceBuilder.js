/**
 * Converts incomplete document fragments, such as bullets and targets,
 * into grammatically complete sentences for proposition extraction.
 *
 * Document hierarchy remains available as metadata and is not injected
 * as a breadcrumb string.
 */

const SENTENCE_END_PATTERN = /[.!?]$/;

const AUXILIARY_OR_FINITE_VERB_PATTERN =
  /\b(is|are|was|were|has|have|had|will|shall|should|would|can|could|may|might|must|aims|seeks|targets|includes|requires|supports|provides|commits|plans)\b/i;

const NUMERIC_START_PATTERN =
  /^(?:[$€£]\s*)?\d+(?:[,.]\d+)?(?:\s*%|\s+(?:percent|million|billion|trillion|mw|gw|kg|tonnes?|tons?|tco2e|mtco2e))?\b/i;

const CURRENCY_START_PATTERN =
  /^(?:USD|EUR|GBP|PKR|AED|SAR|QAR|KWD|BHD|OMR)\s+\d/i;

const IMPERATIVE_VERBS = new Set([
  "accelerate",
  "adopt",
  "allocate",
  "build",
  "create",
  "cut",
  "decarbonize",
  "deploy",
  "develop",
  "enable",
  "encourage",
  "enhance",
  "establish",
  "expand",
  "finance",
  "fund",
  "generate",
  "implement",
  "increase",
  "install",
  "integrate",
  "introduce",
  "invest",
  "launch",
  "mobilize",
  "modernize",
  "promote",
  "provide",
  "reduce",
  "restore",
  "scale",
  "strengthen",
  "support",
  "transition",
]);

const IRREGULAR_GERUNDS = new Map([
  ["be", "being"],
  ["cut", "cutting"],
  ["lie", "lying"],
  ["run", "running"],
  ["set", "setting"],
]);

const CONTENT_TYPES = Object.freeze({
  EMPTY: "empty",
  COMPLETE_SENTENCE: "completeSentence",
  NUMERIC_TARGET: "numericTarget",
  IMPERATIVE: "imperative",
  PREPOSITIONAL_PHRASE: "prepositionalPhrase",
  NOUN_PHRASE: "nounPhrase",
  HEADING: "heading",
  LIST_ITEM: "listItem",
  FRAGMENT: "fragment",
});

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * @param {string} value
 * @returns {string}
 */
function removeTerminalPunctuation(value) {
  return normalizeText(value)
    .replace(/[.!?]+$/g, "")
    .trim();
}

/**
 * @param {string} value
 * @returns {string}
 */
function ensureTerminalPunctuation(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  return SENTENCE_END_PATTERN.test(normalized)
    ? normalized
    : `${normalized}.`;
}

/**
 * Uses the root context as the semantic subject.
 *
 * Example:
 * [
 *   "Pakistan Green Transition Strategy",
 *   "Energy Targets"
 * ]
 *
 * Subject:
 * Pakistan Green Transition Strategy
 *
 * @param {string[]} contextPath
 * @returns {string|null}
 */
function selectContextSubject(contextPath) {
  if (!Array.isArray(contextPath)) {
    return null;
  }

  for (const entry of contextPath) {
    const normalized = removeTerminalPunctuation(entry);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

/**
 * @param {string} value
 * @returns {string|null}
 */
function getFirstWord(value) {
  const match = normalizeText(value).match(/^([A-Za-z][A-Za-z'-]*)/);

  return match ? match[1] : null;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function startsWithImperativeVerb(value) {
  const firstWord = getFirstWord(value);

  return Boolean(
    firstWord &&
    IMPERATIVE_VERBS.has(firstWord.toLowerCase()),
  );
}

function isPrepositionalPhrase(text = "") {
  return /^(toward|towards|for|to|by|through|within|under|across|in|on|at|from)\b/i
    .test(normalizeText(text));
}

function looksLikeHeading(text = "") {
  const normalized = normalizeText(text);

  if (!normalized) {
    return false;
  }

  if (/[.!?]$/.test(normalized)) {
    return false;
  }

  const words = normalized.split(/\s+/);

  if (words.length > 8) {
    return false;
  }

  return words.every(
    (word) =>
      /^[A-Z][A-Za-z0-9-]*$/.test(word)
  );
}

function looksLikeNounPhrase(text = "") {
  const normalized = normalizeText(text);

  if (!normalized) {
    return false;
  }

  if (
    startsWithImperativeVerb(normalized) ||
    isCompleteSentence(normalized)
  ) {
    return false;
  }

  return (
    normalized.split(/\s+/).length <= 6 &&
    !/[.!?]$/.test(normalized)
  );
}

/**
 * Converts a base-form verb into a gerund.
 *
 * Examples:
 * expand -> expanding
 * mobilize -> mobilizing
 * establish -> establishing
 * develop -> developing
 *
 * @param {string} verb
 * @returns {string}
 */
function toGerund(verb) {
  const normalized = normalizeText(verb).toLowerCase();

  if (!normalized) {
    return "";
  }

  if (IRREGULAR_GERUNDS.has(normalized)) {
    return IRREGULAR_GERUNDS.get(normalized);
  }

  if (/ie$/i.test(normalized)) {
    return `${normalized.slice(0, -2)}ying`;
  }

  if (
    /e$/i.test(normalized) &&
    !/(ee|ye|oe)$/i.test(normalized)
  ) {
    return `${normalized.slice(0, -1)}ing`;
  }

  if (
    /^[a-z]*[^aeiou][aeiou][^aeiouwxy]$/i.test(normalized) &&
    normalized.length <= 5
  ) {
    const finalCharacter = normalized.at(-1);

    return `${normalized}${finalCharacter}ing`;
  }

  return `${normalized}ing`;
}

/**
 * @param {string} content
 * @returns {string}
 */
function convertImperativeToGerundPhrase(content) {
  const normalized = removeTerminalPunctuation(content);
  const firstWord = getFirstWord(normalized);

  if (!firstWord) {
    return normalized;
  }

  const remainder = normalized
    .slice(firstWord.length)
    .trim();

  const gerund = toGerund(firstWord);

  return remainder
    ? `${gerund} ${remainder}`
    : gerund;
}

/**
 * Determines whether the fragment is already sufficiently sentence-like.
 *
 * @param {string} content
 * @returns {boolean}
 */
function isCompleteSentence(content) {
  const normalized = normalizeText(content);
  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length < 4) {
    return false;
  }

  return AUXILIARY_OR_FINITE_VERB_PATTERN.test(normalized);
}

/**
 * @param {string} content
 * @returns {boolean}
 */
function isNumericTarget(content) {
  const normalized = normalizeText(content);

  return (
    NUMERIC_START_PATTERN.test(normalized) ||
    CURRENCY_START_PATTERN.test(normalized)
  );
}

/**
 * @param {string} content
 * @returns {{
 *   type:
 *     "empty" |
 *     "completeSentence" |
 *     "numericTarget" |
 *     "imperative" |
 *     "fragment",
 *   confidence: number
 * }}
 */
function detectSentenceType(content) {
  const normalized = normalizeText(content);

  if (!normalized) {
    return {
      type: CONTENT_TYPES.EMPTY,
      confidence: 1,
    };
  }

  if (looksLikeHeading(normalized)) {
    return {
      type: CONTENT_TYPES.HEADING,
      confidence: 0.35,
    };
  }

  if (isCompleteSentence(normalized)) {
    return {
      type: CONTENT_TYPES.COMPLETE_SENTENCE,
      confidence: 0.98,
    };
  }

  if (isNumericTarget(normalized)) {
    return {
      type: CONTENT_TYPES.NUMERIC_TARGET,
      confidence: 0.96,
    };
  }

  if (startsWithImperativeVerb(normalized)) {
    return {
      type: CONTENT_TYPES.IMPERATIVE,
      confidence: 0.95,
    };
  }

  if (isPrepositionalPhrase(normalized)) {
    return {
      type: CONTENT_TYPES.PREPOSITIONAL_PHRASE,
      confidence: 0.80,
    };
  }

  if (looksLikeNounPhrase(normalized)) {
    return {
      type: CONTENT_TYPES.NOUN_PHRASE,
      confidence: 0.85,
    };
  }

  return {
    type: CONTENT_TYPES.FRAGMENT,
    confidence: 0.65,
  };
}

/**
 * @param {string} subject
 * @param {string} content
 * @returns {string}
 */
function rewriteNumericTarget(subject, content) {
  return `${subject} targets ${removeTerminalPunctuation(content)}.`;
}

/**
 * @param {string} subject
 * @param {string} content
 * @returns {string}
 */
function rewriteImperative(subject, content) {
  const gerundPhrase =
    convertImperativeToGerundPhrase(content);

  return `${subject} includes ${gerundPhrase}.`;
}

/**
 * Rewrites standalone noun phrases into semantic statements.
 *
 * Example:
 * Green hydrogen
 *
 * ->
 *
 * UAE Energy Strategy focuses on green hydrogen.
 */
function rewriteNounPhrase(subject, content) {
  return `${subject} focuses on ${removeTerminalPunctuation(content)}.`;
}

/**
 * Rewrites directional/prepositional fragments.
 *
 * Example:
 * toward net-zero emissions
 *
 * ->
 *
 * UAE Energy Strategy has objective toward net-zero emissions.
 */
function rewritePrepositionalPhrase(subject, content) {
  return `${subject} has objective ${removeTerminalPunctuation(content)}.`;
}

/**
 * Preserve headings without inventing relationships.
 */
function rewriteHeading(subject, content) {
  return `${subject}: ${removeTerminalPunctuation(content)}.`;
}

/**
 * Conservative fallback for fragments that cannot be confidently
 * classified as an imperative or numeric target.
 *
 * @param {string} subject
 * @param {string} content
 * @returns {string}
 */
function rewriteFragment(subject, content) {
  return `${subject} includes ${removeTerminalPunctuation(content)}.`;
}

/**
 * Converts one structured context block into a contextual sentence.
 *
 * @param {{
 *   content?: string,
 *   contextPath?: string[],
 *   type?: string,
 *   sourceLine?: number,
 *   markerType?: string|null,
 *   markerValue?: string|null
 * }} block
 *
 * @returns {{
 *   original: string,
 *   rewritten: string,
 *   rewriteType: string,
 *   rewrittenApplied: boolean,
 *   skipKnowledgeGraph: boolean,
 *   contextSubject: string|null,
 *   contextPath: string[],
 *   sourceLine: number|null,
 *   blockType: string|null,
 *   markerType: string|null,
 *   markerValue: string|null,
 *   confidence: number
 * }}
 */
function buildContextualSentence(block = {}) {
  const original = normalizeText(block.content);
  const contextPath = Array.isArray(block.contextPath)
    ? block.contextPath
        .map(normalizeText)
        .filter(Boolean)
    : [];

  const contextSubject =
    selectContextSubject(contextPath);

  const detection = detectSentenceType(original);

  const baseResult = {
    original,
    rewritten: original,
    rewriteType: detection.type,
    rewrittenApplied: false,
    skipKnowledgeGraph: false,
    contextSubject,
    contextPath,
    sourceLine: Number.isInteger(block.sourceLine)
      ? block.sourceLine
      : null,
    blockType: block.type || null,
    markerType: block.markerType || null,
    markerValue: block.markerValue || null,
    confidence: detection.confidence,
  };

  if (detection.type === CONTENT_TYPES.EMPTY) {
    return baseResult;
  }

  if (detection.type === CONTENT_TYPES.COMPLETE_SENTENCE) {
    return {
      ...baseResult,
      rewritten: ensureTerminalPunctuation(original),
    };
  }

  /*
   * Without a reliable context subject, avoid inventing one.
   */
  if (!contextSubject) {
    return {
      ...baseResult,
      rewritten: ensureTerminalPunctuation(original),
      confidence: Math.min(detection.confidence, 0.55),
    };
  }

  if (detection.type === CONTENT_TYPES.NUMERIC_TARGET) {
    return {
      ...baseResult,
      rewritten: rewriteNumericTarget(
        contextSubject,
        original,
      ),
      rewrittenApplied: true,
    };
  }

  if (detection.type === CONTENT_TYPES.IMPERATIVE) {
    return {
      ...baseResult,
      rewritten: rewriteImperative(
        contextSubject,
        original,
      ),
      rewrittenApplied: true,
    };
  }

  if (detection.type === CONTENT_TYPES.HEADING) {
    return {
      ...baseResult,
      rewritten: ensureTerminalPunctuation(original),
      rewrittenApplied: false,
      skipKnowledgeGraph: true,
    };
  }

  if (
    detection.type ===
    CONTENT_TYPES.PREPOSITIONAL_PHRASE
  ) {
    return {
      ...baseResult,
      rewritten: rewritePrepositionalPhrase(
        contextSubject,
        original,
      ),
      rewrittenApplied: true,
    };
  }

  if (
    detection.type ===
    CONTENT_TYPES.NOUN_PHRASE
  ) {
    return {
      ...baseResult,
      rewritten: rewriteNounPhrase(
        contextSubject,
        original,
      ),
      rewrittenApplied: true,
    };
  }

  return {
    ...baseResult,
    rewritten: rewriteFragment(
      contextSubject,
      original,
    ),
    rewrittenApplied: true,
  };
}

/**
 * @param {Array<object>} blocks
 * @returns {Array<object>}
 */
function buildContextualSentences(blocks) {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks
    .map(buildContextualSentence)
    .filter((result) => result.original);
}

export {
  CONTENT_TYPES,
  buildContextualSentence,
  buildContextualSentences,
  convertImperativeToGerundPhrase,
  detectSentenceType,
  isCompleteSentence,
  isNumericTarget,
  isPrepositionalPhrase,
  looksLikeHeading,
  looksLikeNounPhrase,
  rewriteHeading,
  rewriteNounPhrase,
  rewritePrepositionalPhrase,
  selectContextSubject,
  startsWithImperativeVerb,
  toGerund,
};