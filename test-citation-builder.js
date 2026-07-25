import { buildCitations } from "./intelligence/truth/citationBuilder.js";

const evidence = [
  {
    score: 0.81,
    evidenceScore: 0.9,

    documentId: "document-a",
    chunkId: "chunk-a",
    chunkIndex: 2,

    sectionTitle: "Renewable Energy",
    pageNumber: 27,

    content:
      "The strategy supports renewable energy and green hydrogen deployment.",

    visibility: "public",

    document: {
      title: "UAE Net Zero 2050 Strategy",
      issuingAuthority:
        "Ministry of Energy",
      country: "UAE",
      jurisdiction:
        "United Arab Emirates",
      documentType: "strategy",
      sourceClass: "government",
      publicationDate: "2025-01-15",
      effectiveDate: "2025-02-01",
      lastVerifiedAt: "2026-07-20",
      officialUrl:
        "https://example.gov/strategy",
      version: 1,
      status: "published",
      allowQuotation: true,
      allowDownload: false,
    },
  },

  {
    score: 0.78,
    evidenceScore: 0.87,

    documentId: "document-b",
    chunkId: "chunk-b",
    chunkIndex: 4,

    sectionTitle:
      "Green Hydrogen",
    pageNumber: 41,

    content:
      "The document discusses renewable hydrogen production and export infrastructure.",

    visibility: "internal",

    document: {
      title:
        "National Hydrogen Strategy",
      issuingAuthority:
        "Energy Authority",
      country: "UAE",
      jurisdiction:
        "United Arab Emirates",
      documentType: "strategy",
      sourceClass: "government",
      publicationDate: "2024-06-01",
      lastVerifiedAt: "2026-07-18",
      version: 2,
      status: "verified",
      allowQuotation: false,
      allowDownload: false,
    },
  },
];

const result = buildCitations(evidence);

console.log(result.statistics);

console.log(result.citations);