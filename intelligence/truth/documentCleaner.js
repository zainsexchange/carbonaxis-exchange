const ISOLATED_HEADING_PATTERNS = [
  /^executive summary$/i,
  /^table of contents$/i,
  /^contents$/i,
  /^appendix(?:\s+[a-z0-9]+)?$/i,
  /^annex(?:\s+[a-z0-9]+)?$/i,
  /^introduction$/i,
  /^conclusion$/i,
  /^references$/i,
  /^bibliography$/i,
];

function normalizeInput(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeLine(value = "") {
  return String(value)
    .replace(/[ \t]+/g, " ")
    .trim();
}

function isPageNumberLine(line = "") {
  const value = normalizeLine(line);

  return (
    /^page\s+\d+(?:\s+of\s+\d+)?$/i.test(value) ||
    /^\d+\s*\/\s*\d+$/.test(value) ||
    /^-\s*\d+\s*-$/.test(value)
  );
}

function isIsolatedHeading(line = "") {
  const value = normalizeLine(line);

  if (!value) {
    return false;
  }

  return ISOLATED_HEADING_PATTERNS.some((pattern) =>
    pattern.test(value)
  );
}

function buildLineFrequency(lines = []) {
  const frequency = new Map();

  for (const line of lines) {
    const normalized = normalizeLine(line);

    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();

    frequency.set(
      key,
      (frequency.get(key) || 0) + 1
    );
  }

  return frequency;
}

function isLikelyRepeatedHeader(
  line = "",
  lineFrequency = new Map()
) {
  const value = normalizeLine(line);

  if (!value) {
    return false;
  }

  const count =
    lineFrequency.get(value.toLowerCase()) || 0;

  if (count < 2) {
    return false;
  }

  if (value.length > 140) {
    return false;
  }

  const wordCount = value.split(/\s+/).length;

  if (wordCount > 16) {
    return false;
  }

  const sentencePunctuation =
    /[.!?]$/.test(value);

  if (sentencePunctuation) {
    return false;
  }

  return true;
}

function removeConsecutiveDuplicateLines(lines = []) {
  const output = [];
  let previousComparable = null;

  for (const line of lines) {
    const normalized = normalizeLine(line);
    const comparable = normalized.toLowerCase();

    if (
      normalized &&
      comparable === previousComparable
    ) {
      continue;
    }

    output.push(normalized);

    previousComparable =
      normalized ? comparable : null;
  }

  return output;
}

function collapseBlankLines(lines = []) {
  const output = [];
  let previousWasBlank = false;

  for (const line of lines) {
    const blank = !line;

    if (blank && previousWasBlank) {
      continue;
    }

    output.push(line);
    previousWasBlank = blank;
  }

  while (output[0] === "") {
    output.shift();
  }

  while (output[output.length - 1] === "") {
    output.pop();
  }

  return output;
}

export function cleanDocument(text = "") {
  const normalizedText = normalizeInput(text);

  if (!normalizedText) {
    return "";
  }

  const rawLines = normalizedText
    .split("\n")
    .map(normalizeLine);

  const lineFrequency =
    buildLineFrequency(rawLines);

  const filteredLines = rawLines.filter((line) => {
    if (!line) {
      return true;
    }

    if (isPageNumberLine(line)) {
      return false;
    }

    if (isIsolatedHeading(line)) {
      return false;
    }

    if (
      isLikelyRepeatedHeader(
        line,
        lineFrequency
      )
    ) {
      return false;
    }

    return true;
  });

  const deduplicatedLines =
    removeConsecutiveDuplicateLines(
      filteredLines
    );

  return collapseBlankLines(
    deduplicatedLines
  ).join("\n");
}
