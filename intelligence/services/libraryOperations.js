/**
 * Knowledge Library operations dashboard helpers.
 * Read-only analytics over KnowledgeDocument — does not alter RAG ask flow.
 */

import KnowledgeDocument from "../models/KnowledgeDocument.js";
import {
  resolveSourceAuthorityScore,
  resolveCurationTier,
} from "../config/sourceAuthority.js";

const GCC_TARGETS = Object.freeze({
  "United Arab Emirates": 100,
  UAE: 100,
  "Saudi Arabia": 80,
  Saudi: 80,
  Oman: 60,
  Qatar: 40,
  Bahrain: 30,
  Kuwait: 30,
});

const GCC_FLAGS = Object.freeze({
  "United Arab Emirates": "🇦🇪",
  UAE: "🇦🇪",
  "Saudi Arabia": "🇸🇦",
  Saudi: "🇸🇦",
  Oman: "🇴🇲",
  Qatar: "🇶🇦",
  Bahrain: "🇧🇭",
  Kuwait: "🇰🇼",
});

const THEME_KEYWORDS = Object.freeze({
  Hydrogen: [/hydrogen/i, /h2\b/i],
  "Carbon Capture": [/ccus/i, /carbon capture/i, /\bccs\b/i],
  "Grid Storage": [/storage/i, /battery/i, /grid/i],
  Solar: [/solar/i, /pv\b/i],
  Wind: [/wind/i],
  "Net Zero": [/net.?zero/i],
  ESG: [/\besg\b/i],
  "Carbon Markets": [/carbon market/i, /article.?6/i, /verra/i],
});

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysSince(value) {
  const d = asDate(value);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeCountry(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "Global";
  const lower = raw.toLowerCase();
  if (lower === "uae" || lower.includes("emirates")) {
    return "United Arab Emirates";
  }
  if (lower.includes("saudi")) return "Saudi Arabia";
  if (lower === "oman" || lower.includes("oman")) return "Oman";
  if (lower === "qatar") return "Qatar";
  if (lower === "bahrain") return "Bahrain";
  if (lower === "kuwait") return "Kuwait";
  return raw;
}

/**
 * Document quality score 0–100 for library ops (not answer confidence).
 */
export function calculateDocumentQualityScore(doc = {}) {
  const breakdown = {};

  const metaFields = [
    doc.title,
    doc.country,
    doc.issuingAuthority,
    doc.documentType,
    doc.sourceClass,
    doc.language,
    doc.publicationDate || doc.effectiveDate,
    Array.isArray(doc.topics) && doc.topics.length ? "topics" : "",
    Array.isArray(doc.sectors) && doc.sectors.length ? "sectors" : "",
    doc.officialUrl || doc.sourceUrl || "",
  ];
  const metaFilled = metaFields.filter(Boolean).length;
  breakdown.metadata = Math.round((metaFilled / metaFields.length) * 25);

  const authority = Number(
    doc.sourceAuthorityScore ?? resolveSourceAuthorityScore(doc)
  );
  breakdown.officialSource = Math.round((Math.min(100, authority) / 100) * 25);

  const chars = Number(doc.extractedCharacterCount || 0);
  breakdown.ocrText =
    chars >= 5000 ? 10 : chars >= 500 ? 7 : chars > 0 ? 4 : 0;

  const chunks = Number(doc.chunkCount || 0);
  breakdown.chunks =
    chunks >= 8 ? 15 : chunks >= 3 ? 11 : chunks >= 1 ? 7 : 0;

  const embeddings = Number(doc.embeddingCount || 0);
  breakdown.embeddings =
    embeddings > 0 && embeddings >= chunks
      ? 15
      : embeddings > 0
        ? 10
        : 0;

  const citationSignals =
    (Array.isArray(doc.topics) ? doc.topics.length : 0) +
    (Array.isArray(doc.tags) ? doc.tags.length : 0);
  breakdown.citations = citationSignals >= 4 ? 5 : citationSignals > 0 ? 3 : 0;

  const hasRelations = Boolean(
    doc.supersedesDocumentId ||
      doc.duplicateOf ||
      (Array.isArray(doc.metadata?.relatedDocuments) &&
        doc.metadata.relatedDocuments.length) ||
      (Array.isArray(doc.relatedDocuments) && doc.relatedDocuments.length)
  );
  breakdown.relationships = hasRelations ? 5 : 0;

  const total = Object.values(breakdown).reduce((sum, n) => sum + n, 0);

  return {
    score: Math.max(0, Math.min(100, total)),
    breakdown,
  };
}

function serializeDocument(doc, { includeQuality = true } = {}) {
  const quality = includeQuality
    ? calculateDocumentQualityScore(doc)
    : null;

  return {
    id: String(doc._id),
    title: doc.title || "",
    fileName: doc.fileName || "",
    country: doc.country || "",
    jurisdiction: doc.jurisdiction || "",
    issuingAuthority: doc.issuingAuthority || "",
    documentType: doc.documentType || "other",
    sourceClass: doc.sourceClass || "other",
    language: doc.language || "",
    status: doc.status || "draft",
    visibility: doc.visibility || "internal",
    version: doc.version || 1,
    publicationDate: doc.publicationDate || null,
    effectiveDate: doc.effectiveDate || null,
    lastVerifiedAt: doc.lastVerifiedAt || null,
    topics: doc.topics || [],
    sectors: doc.sectors || [],
    tags: doc.tags || [],
    technologies: doc.technologies || doc.metadata?.technologies || [],
    officialUrl: doc.officialUrl || "",
    sourceUrl: doc.sourceUrl || doc.officialUrl || "",
    chunkCount: doc.chunkCount || 0,
    embeddingCount: doc.embeddingCount || 0,
    pageCount: doc.pageCount || 0,
    extractedCharacterCount: doc.extractedCharacterCount || 0,
    sourceAuthorityScore:
      doc.sourceAuthorityScore ?? resolveSourceAuthorityScore(doc),
    curationTier: doc.curationTier ?? resolveCurationTier(doc),
    authorityTier: doc.authorityTier ?? resolveCurationTier(doc),
    supersedesDocumentId: doc.supersedesDocumentId
      ? String(doc.supersedesDocumentId)
      : null,
    qualityScore: quality?.score ?? null,
    qualityBreakdown: quality?.breakdown ?? null,
    processingStage: doc.processingStage || "",
    processingProgress: doc.processingProgress || 0,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

export function buildDocumentFilter(query = {}) {
  const filter = {};

  if (query.country) {
    filter.country = new RegExp(
      String(query.country).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
  }

  if (query.authority) {
    filter.issuingAuthority = new RegExp(
      String(query.authority).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
  }

  if (query.sector) {
    filter.sectors = {
      $elemMatch: {
        $regex: String(query.sector).trim(),
        $options: "i",
      },
    };
  }

  if (query.status) {
    filter.status = String(query.status).trim();
  }

  if (query.source || query.sourceClass) {
    filter.sourceClass = String(query.source || query.sourceClass).trim();
  }

  if (query.language) {
    filter.language = new RegExp(
      String(query.language).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
  }

  if (query.visibility) {
    filter.visibility = String(query.visibility).trim();
  }

  if (query.documentType || query.type) {
    filter.documentType = String(query.documentType || query.type).trim();
  }

  if (query.year) {
    const year = Number(query.year);
    if (Number.isInteger(year) && year >= 1990 && year <= 2100) {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year + 1, 0, 1));
      filter.$or = [
        { publicationDate: { $gte: start, $lt: end } },
        { effectiveDate: { $gte: start, $lt: end } },
        {
          publicationDate: null,
          effectiveDate: null,
          createdAt: { $gte: start, $lt: end },
        },
      ];
    }
  }

  if (query.q) {
    const q = String(query.q).trim();
    if (q) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { title: { $regex: q, $options: "i" } },
            { issuingAuthority: { $regex: q, $options: "i" } },
            { fileName: { $regex: q, $options: "i" } },
            { topics: { $elemMatch: { $regex: q, $options: "i" } } },
          ],
        },
      ];
    }
  }

  return filter;
}

export async function listLibraryDocuments(query = {}) {
  const limit = Math.min(300, Math.max(1, Number(query.limit) || 100));
  const filter = buildDocumentFilter(query);

  const documents = await KnowledgeDocument.find(filter)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return {
    count: documents.length,
    documents: documents.map((doc) => serializeDocument(doc)),
  };
}

export async function getLibraryDocumentDetail(documentId) {
  const doc = await KnowledgeDocument.findById(documentId).lean();
  if (!doc) return null;

  const base = serializeDocument(doc);

  const supersedes = doc.supersedesDocumentId
    ? await KnowledgeDocument.findById(doc.supersedesDocumentId)
        .select("title country status issuingAuthority")
        .lean()
    : null;

  const supersededBy = await KnowledgeDocument.find({
    supersedesDocumentId: doc._id,
  })
    .select("title country status issuingAuthority")
    .limit(20)
    .lean();

  const similar = await KnowledgeDocument.find({
    _id: { $ne: doc._id },
    $or: [
      { country: doc.country },
      { issuingAuthority: doc.issuingAuthority },
      {
        topics: {
          $in: Array.isArray(doc.topics) ? doc.topics.slice(0, 5) : [],
        },
      },
    ],
  })
    .select(
      "title country status issuingAuthority documentType sourceAuthorityScore"
    )
    .limit(8)
    .lean();

  const chain = [];
  let cursor = doc;
  const seen = new Set([String(doc._id)]);
  chain.push({
    id: String(doc._id),
    title: doc.title,
    status: doc.status,
  });

  while (cursor?.supersedesDocumentId && chain.length < 8) {
    const next = await KnowledgeDocument.findById(cursor.supersedesDocumentId)
      .select("title status supersedesDocumentId")
      .lean();
    if (!next || seen.has(String(next._id))) break;
    seen.add(String(next._id));
    chain.push({
      id: String(next._id),
      title: next.title,
      status: next.status,
    });
    cursor = next;
  }

  return {
    ...base,
    summary:
      doc.description ||
      doc.metadata?.summary ||
      doc.aiMetadata?.summary ||
      "",
    relationships: {
      supersedes: supersedes
        ? {
            id: String(supersedes._id),
            title: supersedes.title,
            country: supersedes.country,
            status: supersedes.status,
            issuingAuthority: supersedes.issuingAuthority,
          }
        : null,
      supersededBy: supersededBy.map((item) => ({
        id: String(item._id),
        title: item.title,
        country: item.country,
        status: item.status,
        issuingAuthority: item.issuingAuthority,
      })),
      similar: similar.map((item) => ({
        id: String(item._id),
        title: item.title,
        country: item.country,
        status: item.status,
        issuingAuthority: item.issuingAuthority,
        documentType: item.documentType,
        sourceAuthorityScore: item.sourceAuthorityScore,
      })),
      chain,
    },
  };
}

function detectMissingThemes(documents = []) {
  const blob = documents
    .map(
      (doc) =>
        `${doc.title || ""} ${(doc.topics || []).join(" ")} ${(doc.tags || []).join(" ")} ${(doc.sectors || []).join(" ")}`
    )
    .join(" | ");

  return Object.entries(THEME_KEYWORDS)
    .filter(([, patterns]) => !patterns.some((re) => re.test(blob)))
    .map(([theme]) => theme);
}

export async function buildLibraryDashboard() {
  const documents = await KnowledgeDocument.find({})
    .sort({ updatedAt: -1 })
    .lean();

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

  const addedThisWeek = documents.filter((doc) => {
    const created = asDate(doc.createdAt);
    return created && created.getTime() >= weekAgo;
  }).length;

  const awaitingReview = documents.filter((doc) =>
    ["pending_review", "draft"].includes(doc.status)
  ).length;

  const outdated = documents.filter((doc) => {
    const ref = asDate(
      doc.lastVerifiedAt || doc.publicationDate || doc.effectiveDate
    );
    if (!ref) return doc.status === "published" || doc.status === "verified";
    return ref.getTime() < yearAgo;
  }).length;

  const failedEmbeddings = documents.filter(
    (doc) =>
      doc.status === "failed" ||
      (Number(doc.chunkCount || 0) > 0 &&
        Number(doc.embeddingCount || 0) === 0)
  );

  const government = documents.filter(
    (doc) => doc.sourceClass === "government"
  ).length;
  const international = documents.filter((doc) =>
    ["un", "international_organization", "standard_body", "registry"].includes(
      doc.sourceClass
    )
  ).length;

  const authorities = new Map();
  for (const doc of documents) {
    const name = String(doc.issuingAuthority || "").trim() || "Unspecified";
    const entry = authorities.get(name) || {
      name,
      count: 0,
      sourceClass: doc.sourceClass || "other",
    };
    entry.count += 1;
    authorities.set(name, entry);
  }

  const topAuthorities = [...authorities.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const countryCounts = new Map();
  for (const doc of documents) {
    const country = normalizeCountry(doc.country);
    countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
  }

  const countryCoverage = [
    "United Arab Emirates",
    "Saudi Arabia",
    "Oman",
    "Qatar",
    "Bahrain",
    "Kuwait",
  ]
    .map((country) => {
      const count = countryCounts.get(country) || 0;
      const target = GCC_TARGETS[country] || 50;
      const percent = Math.min(100, Math.round((count / target) * 100));
      return {
        country,
        flag: GCC_FLAGS[country] || "",
        count,
        target,
        percent,
      };
    })
    .sort((a, b) => b.percent - a.percent);

  const missingThemes = detectMissingThemes(documents);

  const withEmbeddings = documents.filter(
    (doc) => Number(doc.embeddingCount || 0) > 0
  ).length;
  const withChunks = documents.filter(
    (doc) => Number(doc.chunkCount || 0) > 0
  ).length;
  const withRelations = documents.filter(
    (doc) => doc.supersedesDocumentId
  ).length;

  const metadataComplete = documents.filter((doc) => {
    return (
      doc.title &&
      doc.country &&
      doc.issuingAuthority &&
      doc.documentType &&
      doc.sourceClass
    );
  }).length;

  const total = documents.length || 1;

  const health = {
    coverage: Math.round(
      countryCoverage.reduce((sum, row) => sum + row.percent, 0) /
        Math.max(countryCoverage.length, 1)
    ),
    metadata: Math.round((metadataComplete / total) * 100),
    embeddings: Math.round((withEmbeddings / total) * 100),
    relationships: Math.round((withRelations / total) * 100),
    entities: 0,
    brokenLinks: documents.filter(
      (doc) =>
        doc.officialUrl &&
        !/^https?:\/\//i.test(String(doc.officialUrl || ""))
    ).length,
    duplicates: documents.filter(
      (doc) => doc.duplicateOf || doc.status === "superseded"
    ).length,
    failedEmbeddings: failedEmbeddings.length,
    missingThemes,
  };

  health.overall = Math.round(
    (health.coverage +
      health.metadata +
      health.embeddings +
      health.relationships) /
      4
  );

  const suggestions = [];

  if (!documents.some((doc) => /hydrogen/i.test(doc.title || ""))) {
    suggestions.push({
      level: "high",
      text: "Upload a national Hydrogen Roadmap / Hydrogen Strategy (Tier 1).",
    });
  }

  for (const row of countryCoverage) {
    if (row.percent < 50) {
      suggestions.push({
        level: "medium",
        text: `${row.country} coverage is ${row.percent}% of target (${row.count}/${row.target}). Prioritize Tier 1 government docs.`,
      });
    }
  }

  if (awaitingReview > 0) {
    suggestions.push({
      level: "high",
      text: `${awaitingReview} document(s) awaiting review/publish before they can power answers.`,
    });
  }

  if (outdated > 0) {
    suggestions.push({
      level: "medium",
      text: `${outdated} document(s) look outdated (>1 year since verify/publication). Re-verify or supersede.`,
    });
  }

  if (failedEmbeddings.length > 0) {
    suggestions.push({
      level: "high",
      text: `${failedEmbeddings.length} document(s) have chunks but no embeddings — re-process them.`,
    });
  }

  const titleCounts = new Map();
  for (const doc of documents) {
    const key = String(doc.title || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  }
  const duplicateTitles = [...titleCounts.entries()].filter(
    ([, count]) => count > 1
  );
  if (duplicateTitles.length > 0) {
    suggestions.push({
      level: "medium",
      text: `Duplicate titles detected (${duplicateTitles.length} groups). Review for better-version / archive.`,
    });
  }

  if (missingThemes.length > 0) {
    suggestions.push({
      level: "medium",
      text: `Missing theme coverage signals: ${missingThemes.slice(0, 4).join(", ")}.`,
    });
  }

  const timelineMap = new Map();
  for (const doc of documents) {
    const date =
      asDate(doc.publicationDate) ||
      asDate(doc.effectiveDate) ||
      asDate(doc.createdAt);
    if (!date) continue;
    const year = date.getUTCFullYear();
    const list = timelineMap.get(year) || [];
    list.push({
      id: String(doc._id),
      title: doc.title,
      country: doc.country,
      documentType: doc.documentType,
      status: doc.status,
    });
    timelineMap.set(year, list);
  }

  const timeline = [...timelineMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, items]) => ({
      year,
      count: items.length,
      documents: items.slice(0, 8),
    }));

  const relationshipNodes = documents
    .filter((doc) => doc.supersedesDocumentId)
    .slice(0, 20)
    .map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      supersedesDocumentId: String(doc.supersedesDocumentId),
      country: doc.country,
      status: doc.status,
    }));

  const serialized = documents.map((doc) => serializeDocument(doc));

  return {
    updatedAt: new Date().toISOString(),
    totals: {
      documents: documents.length,
      authorities: authorities.size,
      countries: new Set(
        documents.map((doc) => normalizeCountry(doc.country))
      ).size,
      knowledgeChunks: documents.reduce(
        (sum, doc) => sum + Number(doc.chunkCount || 0),
        0
      ),
      embeddings: documents.reduce(
        (sum, doc) => sum + Number(doc.embeddingCount || 0),
        0
      ),
      entities: 0,
      relationships: withRelations,
    },
    actionable: {
      addedThisWeek,
      awaitingReview,
      outdated,
      failedEmbeddings: failedEmbeddings.length,
    },
    authorities: {
      total: authorities.size,
      government,
      international,
      top: topAuthorities,
    },
    countryCoverage,
    health,
    suggestions,
    timeline,
    relationshipNodes,
    documents: serialized.slice(0, 100),
  };
}

export { serializeDocument, GCC_TARGETS };
