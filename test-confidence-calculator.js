import { calculateConfidence } from "./intelligence/truth/confidenceCalculator.js";

const evidence = [
  {
    score: 0.82,
    evidenceScore: 0.91,
    documentId: "doc-a",
    document: {
      sourceClass: "government",
      issuingAuthority: "Ministry of Energy",
    },
  },
  {
    score: 0.79,
    evidenceScore: 0.88,
    documentId: "doc-b",
    document: {
      sourceClass: "government",
      issuingAuthority: "Climate Authority",
    },
  },
  {
    score: 0.76,
    evidenceScore: 0.84,
    documentId: "doc-c",
    document: {
      sourceClass: "international_organization",
      issuingAuthority: "IRENA",
    },
  },
];

const noConflict = calculateConfidence({
  evidence,
  conflicts: [],
});

const withConflict = calculateConfidence({
  evidence,
  conflicts: [
    {
      type: "numeric_disagreement",
    },
  ],
});

console.log("No conflict:");
console.log(noConflict);

console.log("\nWith conflict:");
console.log(withConflict);