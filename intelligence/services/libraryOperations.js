/**
 * Knowledge Library operations dashboard helpers.
 * Read-only analytics over KnowledgeDocument — does not alter RAG ask flow.
 */

import KnowledgeDocument from "../models/KnowledgeDocument.js";
import KnowledgeJob from "../models/KnowledgeJob.js";
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
 * Additive signals only — does not affect RAG evidence ranking.
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
  breakdown.metadata = Math.round((metaFilled / metaFields.length) * 20);

  const authority = Number(
    doc.sourceAuthorityScore ?? resolveSourceAuthorityScore(doc)
  );
  breakdown.officialSource = Math.round((Math.min(100, authority) / 100) * 20);

  const chars = Number(doc.extractedCharacterCount || 0);
  const pages = Number(doc.pageCount || 0);
  // OCR / extract quality proxy: text density vs pages when available.
  if (chars <= 0) {
    breakdown.ocrText = 0;
  } else if (pages > 0) {
    const density = chars / pages;
    breakdown.ocrText =
      density >= 800 ? 12 : density >= 300 ? 9 : density >= 80 ? 6 : 3;
  } else {
    breakdown.ocrText =
      chars >= 5000 ? 12 : chars >= 500 ? 8 : 4;
  }

  const chunks = Number(doc.chunkCount || 0);
  breakdown.chunks =
    chunks >= 8 ? 12 : chunks >= 3 ? 9 : chunks >= 1 ? 5 : 0;

  const embeddings = Number(doc.embeddingCount || 0);
  if (embeddings <= 0) {
    breakdown.embeddings = 0;
  } else if (chunks > 0 && embeddings >= chunks) {
    breakdown.embeddings = 12;
  } else if (embeddings > 0) {
    breakdown.embeddings = 7;
  } else {
    breakdown.embeddings = 0;
  }

  const citationSignals =
    (Array.isArray(doc.topics) ? doc.topics.length : 0) +
    (Array.isArray(doc.tags) ? doc.tags.length : 0) +
    (Array.isArray(doc.technologies) ? doc.technologies.length : 0) +
    (Array.isArray(doc.metadata?.technologies)
      ? doc.metadata.technologies.length
      : 0);
  breakdown.citations =
    citationSignals >= 6 ? 8 : citationSignals >= 3 ? 5 : citationSignals > 0 ? 3 : 0;

  const hasRelations = Boolean(
    doc.supersedesDocumentId ||
      doc.duplicateOf ||
      (Array.isArray(doc.metadata?.relatedDocuments) &&
        doc.metadata.relatedDocuments.length) ||
      (Array.isArray(doc.relatedDocuments) && doc.relatedDocuments.length)
  );
  breakdown.relationships = hasRelations ? 8 : 0;

  const status = String(doc.status || "").toLowerCase();
  breakdown.publishReadiness =
    status === "published" || status === "verified"
      ? 8
      : status === "pending_review"
        ? 4
        : status === "failed"
          ? 0
          : 2;

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
  const all = await KnowledgeDocument.find({})
    .select(
      "title country status issuingAuthority documentType sourceAuthorityScore supersedesDocumentId topics tags description metadata"
    )
    .lean();

  const supersedes = doc.supersedesDocumentId
    ? all.find((item) => String(item._id) === String(doc.supersedesDocumentId))
    : null;

  const supersededBy = all.filter(
    (item) =>
      item.supersedesDocumentId &&
      String(item.supersedesDocumentId) === String(doc._id)
  );

  const titleToken = String(doc.title || "")
    .trim()
    .toLowerCase();

  const citedBy = all
    .filter((item) => String(item._id) !== String(doc._id))
    .filter((item) => {
      const blob = `${item.title || ""} ${item.description || ""} ${(item.topics || []).join(" ")} ${item.metadata?.summary || ""}`.toLowerCase();
      return (
        titleToken.length >= 12 &&
        blob.includes(titleToken.slice(0, Math.min(40, titleToken.length)))
      );
    })
    .slice(0, 8);

  const similar = all
    .filter((item) => String(item._id) !== String(doc._id))
    .map((item) => {
      let score = 0;
      if (item.country && item.country === doc.country) score += 2;
      if (
        item.issuingAuthority &&
        item.issuingAuthority === doc.issuingAuthority
      ) {
        score += 2;
      }
      const sharedTopics = (item.topics || []).filter((topic) =>
        (doc.topics || []).includes(topic)
      );
      score += Math.min(3, sharedTopics.length);
      if (item.documentType && item.documentType === doc.documentType) {
        score += 1;
      }
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((row) => row.item);

  const chain = [];
  let cursor = doc;
  const seen = new Set([String(doc._id)]);
  chain.push({
    id: String(doc._id),
    title: doc.title,
    status: doc.status,
  });

  while (cursor?.supersedesDocumentId && chain.length < 8) {
    const next = all.find(
      (item) => String(item._id) === String(cursor.supersedesDocumentId)
    );
    if (!next || seen.has(String(next._id))) break;
    seen.add(String(next._id));
    chain.push({
      id: String(next._id),
      title: next.title,
      status: next.status,
    });
    cursor = next;
  }

  const graphNodes = [
    {
      id: String(doc._id),
      title: doc.title,
      kind: "focus",
      status: doc.status,
    },
  ];
  const graphEdges = [];
  const addNode = (item, kind) => {
    if (!item) return;
    const id = String(item._id || item.id);
    if (!graphNodes.some((node) => node.id === id)) {
      graphNodes.push({
        id,
        title: item.title,
        kind,
        status: item.status,
      });
    }
  };

  if (supersedes) {
    addNode(supersedes, "supersedes");
    graphEdges.push({
      from: String(doc._id),
      to: String(supersedes._id),
      type: "supersedes",
    });
  }
  for (const item of supersededBy) {
    addNode(item, "superseded_by");
    graphEdges.push({
      from: String(item._id),
      to: String(doc._id),
      type: "supersedes",
    });
  }
  for (const item of citedBy) {
    addNode(item, "cited_by");
    graphEdges.push({
      from: String(item._id),
      to: String(doc._id),
      type: "cites",
    });
  }
  for (const item of similar.slice(0, 5)) {
    addNode(item, "similar");
    graphEdges.push({
      from: String(doc._id),
      to: String(item._id),
      type: "similar",
    });
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
      citedBy: citedBy.map((item) => ({
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
      graph: {
        nodes: graphNodes,
        edges: graphEdges,
      },
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

  const ruleSuggestions = [];

  if (!documents.some((doc) => /hydrogen/i.test(doc.title || ""))) {
    ruleSuggestions.push({
      level: "high",
      source: "rules",
      text: "Upload a national Hydrogen Roadmap / Hydrogen Strategy (Tier 1).",
    });
  }

  for (const row of countryCoverage) {
    if (row.percent < 50) {
      ruleSuggestions.push({
        level: "medium",
        source: "rules",
        text: `${row.country} coverage is ${row.percent}% of target (${row.count}/${row.target}). Prioritize Tier 1 government docs.`,
      });
    }
  }

  if (awaitingReview > 0) {
    ruleSuggestions.push({
      level: "high",
      source: "rules",
      text: `${awaitingReview} document(s) awaiting review/publish before they can power answers.`,
    });
  }

  if (outdated > 0) {
    ruleSuggestions.push({
      level: "medium",
      source: "rules",
      text: `${outdated} document(s) look outdated (>1 year since verify/publication). Re-verify or supersede.`,
    });
  }

  if (failedEmbeddings.length > 0) {
    ruleSuggestions.push({
      level: "high",
      source: "rules",
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
    ruleSuggestions.push({
      level: "medium",
      source: "rules",
      text: `Duplicate titles detected (${duplicateTitles.length} groups). Review for better-version / archive.`,
    });
  }

  if (missingThemes.length > 0) {
    ruleSuggestions.push({
      level: "medium",
      source: "rules",
      text: `Missing theme coverage signals: ${missingThemes.slice(0, 4).join(", ")}.`,
    });
  }

  const suggestions = await enrichSuggestionsWithAi({
    ruleSuggestions,
    totals: {
      documents: documents.length,
      awaitingReview,
      outdated,
      missingThemes,
      countryCoverage,
    },
  });

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

  const libraryGraph = await buildLibraryRelationshipGraph({ limit: 50 });

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
    libraryGraph,
    documents: serialized.slice(0, 100),
  };
}

/**
 * Optional AI enrichment for admin suggestions only.
 * Soft-fails to rule suggestions — never touches RAG ask path.
 */
async function enrichSuggestionsWithAi({
  ruleSuggestions = [],
  totals = {},
} = {}) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return ruleSuggestions;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are Carbon Brain Knowledge Ops. Return 3-5 short actionable library curation suggestions as a JSON array of strings. Focus on missing Tier-1 official GCC documents, duplicates, outdated docs, and coverage gaps. No markdown.",
          },
          {
            role: "user",
            content: JSON.stringify({
              totals,
              existingSuggestions: ruleSuggestions.map((item) => item.text),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return ruleSuggestions;
    }

    const payload = await response.json();
    const content = String(payload?.choices?.[0]?.message?.content || "").trim();
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      return ruleSuggestions;
    }

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || !parsed.length) {
      return ruleSuggestions;
    }

    const aiItems = parsed
      .map((text) => String(text || "").trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((text) => ({
        level: "medium",
        source: "ai",
        text,
      }));

    const merged = [...ruleSuggestions];
    for (const item of aiItems) {
      if (
        !merged.some(
          (existing) =>
            existing.text.toLowerCase() === item.text.toLowerCase()
        )
      ) {
        merged.push(item);
      }
    }
    return merged.slice(0, 12);
  } catch {
    return ruleSuggestions;
  }
}

/**
 * Corpus relationship graph for admin / Intelligence Center.
 * Derived from Mongo KnowledgeDocument only — does not alter RAG ask.
 *
 * Edge types:
 * - supersedes | references | similar | supports | implements | mentions
 */
export async function buildLibraryRelationshipGraph(query = {}) {
  const limit = Math.min(80, Math.max(10, Number(query.limit) || 50));
  const countryFilter = String(query.country || "").trim();
  const seed = String(query.q || query.seed || "").trim().toLowerCase();

  let documents = await KnowledgeDocument.find({})
    .select(
      "title country status issuingAuthority documentType sourceClass topics tags sectors technologies supersedesDocumentId metadata description"
    )
    .sort({ updatedAt: -1 })
    .lean();

  if (countryFilter) {
    const re = new RegExp(
      countryFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
    documents = documents.filter((doc) => re.test(String(doc.country || "")));
  }

  if (seed) {
    documents = documents.filter((doc) => {
      const blob = `${doc.title || ""} ${(doc.topics || []).join(" ")} ${(doc.tags || []).join(" ")} ${doc.issuingAuthority || ""}`.toLowerCase();
      return blob.includes(seed);
    });
  }

  documents = documents.slice(0, limit);

  const byId = new Map(documents.map((doc) => [String(doc._id), doc]));
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();

  const addDocNode = (doc) => {
    const id = `doc:${doc._id}`;
    if (nodeIds.has(id)) return id;
    nodeIds.add(id);
    nodes.push({
      id,
      kind: "document",
      label: doc.title || "Untitled",
      title: doc.title || "Untitled",
      country: normalizeCountry(doc.country),
      status: doc.status,
      authority: doc.issuingAuthority || "",
      documentType: doc.documentType || "other",
    });
    return id;
  };

  const addThemeNode = (theme) => {
    const id = `theme:${theme}`;
    if (nodeIds.has(id)) return id;
    nodeIds.add(id);
    nodes.push({
      id,
      kind: "theme",
      label: theme,
      title: theme,
    });
    return id;
  };

  const addEdge = (from, to, type, derived = true) => {
    if (!from || !to || from === to) return;
    const key = `${from}|${to}|${type}`;
    if (edges.some((e) => `${e.from}|${e.to}|${e.type}` === key)) return;
    edges.push({ from, to, type, derived });
  };

  const themesOf = (doc) => {
    const blob = `${doc.title || ""} ${(doc.topics || []).join(" ")} ${(doc.tags || []).join(" ")} ${(doc.sectors || []).join(" ")} ${(doc.technologies || []).join(" ")}`;
    const fromKeywords = Object.entries(THEME_KEYWORDS)
      .filter(([, patterns]) => patterns.some((re) => re.test(blob)))
      .map(([theme]) => theme);
    const fromTopics = (doc.topics || [])
      .map((t) => String(t || "").trim())
      .filter((t) => t.length >= 3 && t.length <= 40)
      .slice(0, 4);
    return [...new Set([...fromKeywords, ...fromTopics])];
  };

  const relationVerb = (doc) => {
    const type = String(doc.documentType || "").toLowerCase();
    if (/law|regulation|decree/.test(type)) return "implements";
    if (/strategy|roadmap|policy|plan/.test(type)) return "supports";
    return "mentions";
  };

  for (const doc of documents) {
    const docId = addDocNode(doc);

    if (doc.supersedesDocumentId) {
      const older = byId.get(String(doc.supersedesDocumentId));
      if (older) {
        addEdge(docId, addDocNode(older), "supersedes", false);
      }
    }

    const related = [
      ...(Array.isArray(doc.metadata?.relatedDocuments)
        ? doc.metadata.relatedDocuments
        : []),
      ...(Array.isArray(doc.relatedDocuments) ? doc.relatedDocuments : []),
    ];
    for (const rel of related.slice(0, 6)) {
      const targetId = String(rel.documentId || rel.id || rel || "").trim();
      const target = byId.get(targetId);
      if (!target) continue;
      const type = String(rel.relation || rel.type || "references")
        .toLowerCase()
        .replace(/\s+/g, "_");
      const allowed = new Set([
        "references",
        "supports",
        "implements",
        "supersedes",
        "amends",
        "related",
      ]);
      addEdge(
        docId,
        addDocNode(target),
        allowed.has(type) ? type : "references",
        !rel.relation && !rel.type
      );
    }

    const themes = themesOf(doc);
    const verb = relationVerb(doc);
    for (const theme of themes.slice(0, 5)) {
      addEdge(docId, addThemeNode(theme), verb, true);
    }
  }

  // Limited similar edges between docs sharing country + ≥2 topics.
  for (let i = 0; i < documents.length; i += 1) {
    for (let j = i + 1; j < documents.length; j += 1) {
      const a = documents[i];
      const b = documents[j];
      if (a.country && b.country && a.country !== b.country) continue;
      const shared = (a.topics || []).filter((t) =>
        (b.topics || []).includes(t)
      );
      if (shared.length < 2) continue;
      addEdge(addDocNode(a), addDocNode(b), "similar", true);
      if (edges.filter((e) => e.type === "similar").length >= 24) break;
    }
    if (edges.filter((e) => e.type === "similar").length >= 24) break;
  }

  // Sample reasoning paths: document → theme → document (same theme).
  const paths = [];
  const themeToDocs = new Map();
  for (const edge of edges) {
    if (!edge.from.startsWith("doc:") || !edge.to.startsWith("theme:")) continue;
    const list = themeToDocs.get(edge.to) || [];
    list.push(edge.from);
    themeToDocs.set(edge.to, list);
  }

  for (const [themeId, docIds] of themeToDocs.entries()) {
    if (docIds.length < 2) continue;
    const themeLabel =
      nodes.find((n) => n.id === themeId)?.label || themeId.replace("theme:", "");
    const a = nodes.find((n) => n.id === docIds[0]);
    const b = nodes.find((n) => n.id === docIds[1]);
    if (!a || !b) continue;
    paths.push({
      labels: [a.label, themeLabel, b.label],
      nodeIds: [a.id, themeId, b.id],
      edgeTypes: [
        edges.find((e) => e.from === a.id && e.to === themeId)?.type ||
          "mentions",
        edges.find((e) => e.from === b.id && e.to === themeId)?.type ||
          "mentions",
      ],
    });
    if (paths.length >= 8) break;
  }

  // Prefer a Hydrogen → Net Zero style path when present.
  const preferred = ["Hydrogen", "Net Zero", "Carbon Markets", "ESG"];
  const preferredPath = [];
  for (const theme of preferred) {
    const id = `theme:${theme}`;
    if (nodeIds.has(id)) preferredPath.push(id);
  }
  if (preferredPath.length >= 2) {
    const labels = preferredPath.map(
      (id) => nodes.find((n) => n.id === id)?.label || id
    );
    // Attach a seed document if one links to the first theme.
    const firstTheme = preferredPath[0];
    const seedDocEdge = edges.find(
      (e) => e.to === firstTheme && e.from.startsWith("doc:")
    );
    if (seedDocEdge) {
      const seedNode = nodes.find((n) => n.id === seedDocEdge.from);
      paths.unshift({
        labels: [seedNode?.label, ...labels].filter(Boolean),
        nodeIds: [seedDocEdge.from, ...preferredPath],
        edgeTypes: preferredPath.map(() => "supports"),
      });
    } else {
      paths.unshift({
        labels,
        nodeIds: preferredPath,
        edgeTypes: preferredPath.slice(1).map(() => "related"),
      });
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    summary: {
      documents: documents.length,
      nodes: nodes.length,
      edges: edges.length,
      themes: nodes.filter((n) => n.kind === "theme").length,
      paths: paths.length,
    },
    nodes,
    edges,
    paths: paths.slice(0, 8),
  };
}

/**
 * Live processing queue for bulk ingest monitoring.
 * Reads KnowledgeJob + KnowledgeDocument processing fields only.
 * Does not start/stop jobs or alter RAG.
 */
const QUEUE_STAGES = Object.freeze([
  { key: "uploading", label: "Uploading", match: ["not_started", "uploaded", "queued"] },
  { key: "ocr", label: "OCR", match: ["extracting", "extracting_text", "metadata", "extracting_metadata"] },
  { key: "chunking", label: "Chunking", match: ["chunking", "creating_chunks"] },
  { key: "embedding", label: "Embedding", match: ["embedding", "generating_embeddings"] },
  { key: "publishing", label: "Publishing", match: ["indexing", "finalizing", "completed"] },
]);

function mapQueueStage(stage = "", status = "", docStatus = "") {
  const raw = String(stage || status || "").toLowerCase();
  if (raw === "failed" || docStatus === "failed") {
    return { key: "failed", label: "Failed" };
  }
  if (docStatus === "published" || docStatus === "verified") {
    return { key: "publishing", label: "Published" };
  }
  for (const stageDef of QUEUE_STAGES) {
    if (stageDef.match.includes(raw)) return { key: stageDef.key, label: stageDef.label };
  }
  if (["pending_review", "draft"].includes(docStatus)) {
    return { key: "publishing", label: "Awaiting publish" };
  }
  if (docStatus === "processing" || status === "processing") {
    return { key: "ocr", label: "OCR" };
  }
  return { key: "uploading", label: "Uploading" };
}

function stageBars(currentKey, progress = 0, failed = false) {
  const order = QUEUE_STAGES.map((s) => s.key);
  const idx = order.indexOf(currentKey === "failed" ? "ocr" : currentKey);
  return QUEUE_STAGES.map((stage, i) => {
    let fill = 0;
    if (failed) {
      fill = i < idx ? 100 : i === idx ? Math.max(5, Number(progress) || 0) : 0;
    } else if (i < idx) {
      fill = 100;
    } else if (i === idx) {
      fill = Math.max(8, Math.min(100, Number(progress) || 0));
    }
    return {
      key: stage.key,
      label: stage.label,
      fill,
      active: !failed && i === idx,
      done: !failed && i < idx,
    };
  });
}

export async function buildProcessingQueue(query = {}) {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 40));
  const activeOnly = String(query.active || "1") !== "0";

  const jobs = await KnowledgeJob.find({})
    .sort({ updatedAt: -1 })
    .limit(limit * 2)
    .lean();

  const docIds = [...new Set(jobs.map((job) => String(job.documentId)))];
  const recentDocs = await KnowledgeDocument.find({
    $or: [
      { _id: { $in: docIds } },
      {
        status: { $in: ["processing", "draft", "failed", "pending_review"] },
      },
      {
        processingStage: {
          $in: [
            "uploaded",
            "extracting",
            "metadata",
            "chunking",
            "embedding",
            "indexing",
            "failed",
          ],
        },
      },
    ],
  })
    .select(
      "title country status visibility processingStage processingProgress processingMessage processingError processingStartedAt processingCompletedAt chunkCount embeddingCount updatedAt createdAt"
    )
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const docsById = new Map(recentDocs.map((doc) => [String(doc._id), doc]));
  // Include docs referenced by jobs even if not in recentDocs filter slice.
  const missingIds = docIds.filter((id) => !docsById.has(id)).slice(0, limit);
  if (missingIds.length) {
    const extra = await KnowledgeDocument.find({ _id: { $in: missingIds } })
      .select(
        "title country status visibility processingStage processingProgress processingMessage processingError processingStartedAt processingCompletedAt chunkCount embeddingCount updatedAt createdAt"
      )
      .lean();
    for (const doc of extra) docsById.set(String(doc._id), doc);
  }

  const latestJobByDoc = new Map();
  for (const job of jobs) {
    const id = String(job.documentId);
    if (!latestJobByDoc.has(id)) latestJobByDoc.set(id, job);
  }

  const items = [];
  const seen = new Set();

  for (const [docId, job] of latestJobByDoc.entries()) {
    const doc = docsById.get(docId);
    if (!doc) continue;
    seen.add(docId);
    const stage = mapQueueStage(
      job.currentStep || doc.processingStage,
      job.status,
      doc.status
    );
    const progress = Number(
      job.progress ?? doc.processingProgress ?? 0
    );
    const failed = job.status === "failed" || doc.status === "failed" || stage.key === "failed";
    const inFlightStage = [
      "uploaded",
      "extracting",
      "metadata",
      "chunking",
      "embedding",
      "indexing",
    ].includes(doc.processingStage || "");
    const active =
      failed ||
      ["queued", "processing"].includes(job.status) ||
      ["processing", "draft"].includes(doc.status) ||
      inFlightStage;

    if (activeOnly && !active && doc.status === "published") continue;

    items.push({
      id: docId,
      jobId: String(job._id),
      title: doc.title || "Untitled",
      country: doc.country || "",
      documentStatus: doc.status,
      jobStatus: job.status,
      stage: stage.key,
      stageLabel: stage.label,
      progress,
      bars: stageBars(failed ? "failed" : stage.key, progress, failed),
      message:
        doc.processingMessage ||
        job.errorMessage ||
        doc.processingError ||
        "",
      error: job.errorMessage || doc.processingError || "",
      chunkCount: doc.chunkCount || 0,
      embeddingCount: doc.embeddingCount || 0,
      startedAt: job.startedAt || doc.processingStartedAt || job.createdAt,
      updatedAt: job.updatedAt || doc.updatedAt,
      active: Boolean(active),
      failed,
    });
  }

  for (const doc of recentDocs) {
    const id = String(doc._id);
    if (seen.has(id)) continue;
    const stage = mapQueueStage(doc.processingStage, "", doc.status);
    const progress = Number(doc.processingProgress || 0);
    const failed = doc.status === "failed" || stage.key === "failed";
    const active =
      failed ||
      doc.status === "processing" ||
      ["uploaded", "extracting", "metadata", "chunking", "embedding", "indexing"].includes(
        doc.processingStage || ""
      );

    if (activeOnly && !active) continue;

    items.push({
      id,
      jobId: null,
      title: doc.title || "Untitled",
      country: doc.country || "",
      documentStatus: doc.status,
      jobStatus: null,
      stage: stage.key,
      stageLabel: stage.label,
      progress,
      bars: stageBars(failed ? "failed" : stage.key, progress, failed),
      message: doc.processingMessage || doc.processingError || "",
      error: doc.processingError || "",
      chunkCount: doc.chunkCount || 0,
      embeddingCount: doc.embeddingCount || 0,
      startedAt: doc.processingStartedAt || doc.createdAt,
      updatedAt: doc.updatedAt,
      active: Boolean(active),
      failed,
    });
  }

  items.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });

  const clipped = items.slice(0, limit);
  const counts = {
    uploading: 0,
    ocr: 0,
    chunking: 0,
    embedding: 0,
    publishing: 0,
    failed: 0,
    active: 0,
    completed: 0,
  };

  for (const item of clipped) {
    if (item.failed) counts.failed += 1;
    else if (counts[item.stage] !== undefined) counts[item.stage] += 1;
    if (item.active) counts.active += 1;
    if (item.stage === "publishing" && item.progress >= 100 && !item.failed) {
      counts.completed += 1;
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    stages: QUEUE_STAGES.map((s) => ({ key: s.key, label: s.label })),
    counts,
    items: clipped,
  };
}

export { serializeDocument, GCC_TARGETS };
