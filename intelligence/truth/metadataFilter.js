const EXACT_PREFIXES = [
  "country:",
  "jurisdiction:",
  "document type:",
  "publication date:",
  "effective date:",
  "issuing authority:",
  "authority:",
  "source class:",
  "language:",
  "version:",
  "page ",
  "page:",
  "chapter ",
  "section ",
  "table ",
  "figure ",
  "appendix",
  "copyright",
  "isbn",
  "doi"
];

const CONTAINS_PATTERNS = [
  "synthetic test document",
  "carbon axis exchange",
  "document ingestion",
  "metadata",
  "citation validation",
  "development test document",
  "not an official government policy",
  "fictional, internally generated",
  "internal synthetic test material"
];

function normalize(text = "") {
  return String(text)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeDate(text) {
  return /\b\d{4}-\d{2}-\d{2}\b/.test(text)
      || /\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/.test(text);
}

function looksLikePage(text) {
  return /^page\s+\d+/i.test(text);
}

function looksLikeMetadata(text) {

  const value = normalize(text).toLowerCase();

  if (!value)
    return true;

  if (looksLikePage(value))
    return true;

  if (looksLikeDate(value))
    return false;

  if (
    EXACT_PREFIXES.some(prefix =>
      value.startsWith(prefix)
    )
  ) {
    return true;
  }

  if (
    CONTAINS_PATTERNS.some(pattern =>
      value.includes(pattern)
    )
  ) {
    return true;
  }

  return false;
}

export function filterMetadataFacts(facts = []) {

  const kept = [];
  const removed = [];

  for (const fact of facts) {

    if (
      looksLikeMetadata(fact.statement)
    ) {
      removed.push(fact);
      continue;
    }

    kept.push(fact);
  }

  return {
    facts: kept,
    removed,
    removedCount: removed.length,
    keptCount: kept.length
  };
}