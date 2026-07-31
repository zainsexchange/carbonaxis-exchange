const AUTHORITY_MATRIX = Object.freeze({
  government: {
    score: 100,
    level: "Official",
    stars: 5,
    color: "green",
    badge: "Government",
    description:
      "Official government publication.",
  },

  un: {
    score: 98,
    level: "International",
    stars: 5,
    color: "green",
    badge: "United Nations",
    description:
      "United Nations publication.",
  },

  standard_body: {
    score: 96,
    level: "Standards",
    stars: 5,
    color: "green",
    badge: "Standards Body",
    description:
      "Recognized international standard.",
  },

  registry: {
    score: 94,
    level: "Registry",
    stars: 5,
    color: "green",
    badge: "Certified Registry",
    description:
      "Verified environmental registry.",
  },

  international_organization: {
    score: 92,
    level: "Institution",
    stars: 5,
    color: "green",
    badge: "International Organization",
    description:
      "Global institutional source.",
  },

  research: {
    score: 82,
    level: "Research",
    stars: 4,
    color: "blue",
    badge: "Research",
    description:
      "Independent research publication.",
  },

  corporate: {
    score: 78,
    level: "Industry",
    stars: 4,
    color: "blue",
    badge: "Corporate",
    description:
      "Industry publication.",
  },

  internal: {
    score: 72,
    level: "Internal",
    stars: 3,
    color: "yellow",
    badge: "Internal Research",
    description:
      "Internal Carbon Brain document.",
  },

  customer: {
    score: 60,
    level: "Customer",
    stars: 3,
    color: "orange",
    badge: "Customer",
    description:
      "Customer supplied information.",
  },

  other: {
    score: 45,
    level: "Unknown",
    stars: 2,
    color: "gray",
    badge: "Other",
    description:
      "Unclassified source.",
  },
});

export function resolveAuthority(document = {}) {
  const sourceClass = String(
    document.sourceClass || "other"
  )
    .trim()
    .toLowerCase();

  return (
    AUTHORITY_MATRIX[sourceClass] ??
    AUTHORITY_MATRIX.other
  );
}

export { AUTHORITY_MATRIX };