import { resolveAuthority } from "./authorityResolver.js";
import { calculateSourceQuality } from "./sourceQualityCalculator.js";

function normalizeText(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function buildCitationLabel({
  title,
  issuingAuthority,
  publicationDate,
  sectionTitle,
  pageNumber,
}) {
  const parts = [];

  if (title) {
    parts.push(title);
  }

  if (issuingAuthority) {
    parts.push(issuingAuthority);
  }

  if (publicationDate) {
    parts.push(publicationDate);
  }

  if (sectionTitle) {
    parts.push(`Section: ${sectionTitle}`);
  }

  if (pageNumber) {
    parts.push(`Page ${pageNumber}`);
  }

  return parts.join(" · ");
}

function buildCitationKey(item = {}) {
  return [
    String(item.documentId || ""),
    String(item.chunkId || ""),
    normalizeText(item.sectionTitle),
    String(item.pageNumber || ""),
  ].join("::");
}

function createCitation(item, index) {
  const document = item.document || {};
  const authority = resolveAuthority(document);

  const quality = calculateSourceQuality({
    document,
    evidenceItem: item,
  });

  const title = normalizeText(
    document.title || "Untitled source"
  );

  const issuingAuthority = normalizeText(
    document.issuingAuthority
  );

  const sectionTitle = normalizeText(
    item.sectionTitle
  );

  const publicationDate = formatDate(
    document.publicationDate
  );

  const effectiveDate = formatDate(
    document.effectiveDate
  );

  const lastVerifiedAt = formatDate(
    document.lastVerifiedAt
  );

  const pageNumber =
    Number.isInteger(item.pageNumber) &&
    item.pageNumber > 0
      ? item.pageNumber
      : null;

  const evidenceScore = Number.isFinite(
    Number(item.evidenceScore)
  )
    ? Number(item.evidenceScore)
    : 0;

  const semanticScore = Number.isFinite(
    Number(item.score)
  )
    ? Number(item.score)
    : 0;

  return {
    citationNumber: index + 1,

    citationId: `CA-${String(index + 1).padStart(3, "0")}`,

    title,
    issuingAuthority,
    country: normalizeText(document.country),
    jurisdiction: normalizeText(
      document.jurisdiction
    ),

    documentType: normalizeText(
      document.documentType
    ),

    sourceClass: normalizeText(
      document.sourceClass
    ),

    authority: {
      score: authority.score,
      level: authority.level,
      stars: authority.stars,
      color: authority.color,
      badge: authority.badge,
      description: authority.description,
    },

    quality: {
      score: quality.score,
      percentage: quality.percentage,
      level: quality.level,
      label: quality.label,
      stars: quality.stars,
      color: quality.color,
      breakdown: quality.breakdown,
      strengths: quality.strengths,
      warnings: quality.warnings,
    },

    sectionTitle,
    pageNumber,

    publicationDate,
    effectiveDate,
    lastVerifiedAt,

    officialUrl: normalizeText(
      document.officialUrl
    ),

    documentVersion:
      Number(document.version) || 1,

    documentStatus: normalizeText(
      document.status
    ),

    visibility: normalizeText(
      item.visibility || document.visibility
    ),

    evidenceScore,
    semanticScore,

    confidencePercentage: Math.round(
      evidenceScore * 100
    ),

    allowQuotation:
      document.allowQuotation === true,

    allowDownload:
      document.allowDownload === true,

    excerpt:
      document.allowQuotation === true
        ? normalizeText(item.content).slice(0, 500)
        : "",

    label: buildCitationLabel({
      title,
      issuingAuthority,
      publicationDate,
      sectionTitle,
      pageNumber,
    }),

    reference: {
      documentId: item.documentId,
      chunkId: item.chunkId,
      chunkIndex:
        Number.isInteger(item.chunkIndex)
          ? item.chunkIndex
          : null,
    },
  };
}

export function buildCitations(
  evidence = [],
  {
    maximumCitations = 12,
  } = {}
) {
  if (!Array.isArray(evidence)) {
    throw new Error(
      "Evidence must be supplied as an array."
    );
  }

  const resolvedMaximum = Math.max(
    1,
    Math.min(
      Number(maximumCitations) || 12,
      30
    )
  );

  const seen = new Set();
  const citations = [];

  for (const item of evidence) {
    if (
      !item?.documentId ||
      !item?.chunkId ||
      !item?.document
    ) {
      continue;
    }

    const key = buildCitationKey(item);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    citations.push(
      createCitation(item, citations.length)
    );

    if (citations.length >= resolvedMaximum) {
      break;
    }
  }

  const sourceClassCounts = citations.reduce(
    (counts, citation) => {
      const key =
        citation.sourceClass || "other";

      counts[key] = (counts[key] || 0) + 1;

      return counts;
    },
    {}
  );

  const uniqueDocuments = new Set(
    citations.map((citation) =>
      String(citation.reference.documentId)
    )
  );

  return {
    citations,

    statistics: {
      citationCount: citations.length,
      uniqueDocumentCount:
        uniqueDocuments.size,
      sourceClassCounts,
      quotedCitationCount:
        citations.filter(
          (citation) =>
            citation.allowQuotation &&
            citation.excerpt
        ).length,
    },
  };
}
