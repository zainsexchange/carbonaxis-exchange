const PREDICATE_MAP = new Map([
  ["supports", "SUPPORTS"],
  ["support", "SUPPORTS"],
  ["supporting", "SUPPORTS"],

  ["focuses on", "FOCUSES_ON"],
  ["focus on", "FOCUSES_ON"],

  ["targets", "TARGETS"],
  ["target", "TARGETS"],

  ["requires", "REQUIRES"],
  ["require", "REQUIRES"],

  ["includes", "INCLUDES"],
  ["include", "INCLUDES"],

  ["has objective", "HAS_OBJECTIVE"],

  ["aims to", "AIMS_TO"],
  ["seeks to", "AIMS_TO"],
]);

function normalizePredicate(predicate = "") {
  const normalized = String(predicate)
    .trim()
    .toLowerCase();

  return {
    originalPredicate: predicate,
    canonicalPredicate:
      PREDICATE_MAP.get(normalized) ??
      normalized.toUpperCase().replace(/\s+/g, "_"),
  };
}

export { normalizePredicate };
