import {
  clusterEvidence,
} from "./intelligence/truth/evidenceClusterer.js";

const evidence = [
  {
    documentId: "uae-001",
    chunkId: "uae-chunk-1",
    title: "UAE Net Zero Strategy",
    country: "UAE",
    issuingAuthority:
      "UAE Ministry of Energy",
    documentType: "strategy",
    evidenceScore: 0.91,
    text: "The UAE supports renewable energy.",
  },
  {
    documentId: "uae-001",
    chunkId: "uae-chunk-2",
    title: "UAE Net Zero Strategy",
    country: "UAE",
    issuingAuthority:
      "UAE Ministry of Energy",
    documentType: "strategy",
    evidenceScore: 0.86,
    text: "The strategy includes green hydrogen.",
  },
  {
    documentId: "saudi-001",
    chunkId: "saudi-chunk-1",
    title: "Saudi Green Initiative",
    country: "Saudi Arabia",
    issuingAuthority:
      "Saudi Green Initiative",
    documentType: "strategy",
    evidenceScore: 0.88,
    text: "Saudi Arabia supports clean hydrogen.",
  },
  {
    documentId: "saudi-001",
    chunkId: "saudi-chunk-2",
    title: "Saudi Green Initiative",
    country: "Saudi Arabia",
    issuingAuthority:
      "Saudi Green Initiative",
    documentType: "strategy",
    evidenceScore: 0.81,
    text: "Renewable capacity will increase.",
  },
  {
    documentId: "uae-001",
    chunkId: "uae-chunk-1",
    title: "UAE Net Zero Strategy",
    country: "UAE",
    evidenceScore: 0.91,
    text: "The UAE supports renewable energy.",
  },
];

const result = clusterEvidence(evidence, {
  maximumChunksPerDocument: 2,
  maximumDocuments: 5,
});

console.dir(result, {
  depth: null,
});