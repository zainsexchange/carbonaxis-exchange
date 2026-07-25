function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDocumentId(evidence = {}) {
  return String(
    evidence.documentId ||
      evidence.metadata?.documentId ||
      evidence.document?._id ||
      evidence.document?._id?.toString?.() ||
      evidence.reference?.documentId ||
      evidence._id ||
      ""
  );
}

function getChunkId(evidence = {}) {
  return String(
    evidence.chunkId ||
      evidence.metadata?.chunkId ||
      evidence.reference?.chunkId ||
      evidence._id ||
      ""
  );
}

function getCountry(evidence = {}) {
  return (
    evidence.country ||
    evidence.metadata?.country ||
    evidence.document?.country ||
    "Unknown"
  );
}

function getJurisdiction(evidence = {}) {
  return (
    evidence.jurisdiction ||
    evidence.metadata?.jurisdiction ||
    evidence.document?.jurisdiction ||
    "Unknown"
  );
}

function getAuthority(evidence = {}) {
  return (
    evidence.issuingAuthority ||
    evidence.metadata?.issuingAuthority ||
    evidence.document?.issuingAuthority ||
    "Unknown authority"
  );
}

function getDocumentType(evidence = {}) {
  return (
    evidence.documentType ||
    evidence.metadata?.documentType ||
    evidence.document?.documentType ||
    "unknown"
  );
}

function getTitle(evidence = {}) {
  return (
    evidence.title ||
    evidence.metadata?.title ||
    evidence.document?.title ||
    "Untitled source"
  );
}

function getEvidenceText(evidence = {}) {
  return (
    evidence.text ||
    evidence.content ||
    evidence.chunkText ||
    evidence.excerpt ||
    ""
  );
}

function getEvidenceScore(evidence = {}) {
  return Number(
    evidence.evidenceScore ??
      evidence.score ??
      evidence.semanticScore ??
      0
  );
}

function buildClusterKey(evidence = {}) {
  const documentId = getDocumentId(evidence);

  if (documentId) {
    return `document:${documentId}`;
  }

  const fallbackParts = [
    getCountry(evidence),
    getAuthority(evidence),
    getTitle(evidence),
  ]
    .map(normalizeText)
    .filter(Boolean);

  return `fallback:${fallbackParts.join("|")}`;
}

export function clusterEvidence(
  evidence = [],
  {
    maximumChunksPerDocument = 3,
    maximumDocuments = 8,
  } = {}
) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return {
      clusters: [],
      flattenedEvidence: [],
      statistics: {
        inputEvidenceCount: 0,
        documentCount: 0,
        returnedEvidenceCount: 0,
        duplicateChunkCount: 0,
      },
    };
  }

  const clusterMap = new Map();
  const seenChunks = new Set();
  let duplicateChunkCount = 0;

  for (const item of evidence) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const chunkId = getChunkId(item);
    const normalizedText = normalizeText(
      getEvidenceText(item)
    );

    const duplicateKey =
      chunkId ||
      `${buildClusterKey(item)}:${normalizedText.slice(
        0,
        240
      )}`;

    if (
      duplicateKey &&
      seenChunks.has(duplicateKey)
    ) {
      duplicateChunkCount += 1;
      continue;
    }

    if (duplicateKey) {
      seenChunks.add(duplicateKey);
    }

    const clusterKey = buildClusterKey(item);

    if (!clusterMap.has(clusterKey)) {
      clusterMap.set(clusterKey, {
        clusterKey,
        documentId: getDocumentId(item) || null,
        title: getTitle(item),
        country: getCountry(item),
        jurisdiction: getJurisdiction(item),
        issuingAuthority: getAuthority(item),
        documentType: getDocumentType(item),
        chunks: [],
        highestEvidenceScore: 0,
        averageEvidenceScore: 0,
      });
    }

    const cluster = clusterMap.get(clusterKey);
    const score = getEvidenceScore(item);

    cluster.chunks.push(item);

    if (score > cluster.highestEvidenceScore) {
      cluster.highestEvidenceScore = score;
    }
  }

  const clusters = [...clusterMap.values()]
    .map((cluster) => {
      cluster.chunks.sort(
        (left, right) =>
          getEvidenceScore(right) -
          getEvidenceScore(left)
      );

      cluster.chunks = cluster.chunks.slice(
        0,
        Math.max(1, maximumChunksPerDocument)
      );

      const totalScore = cluster.chunks.reduce(
        (sum, chunk) =>
          sum + getEvidenceScore(chunk),
        0
      );

      cluster.averageEvidenceScore =
        cluster.chunks.length > 0
          ? totalScore / cluster.chunks.length
          : 0;

      return cluster;
    })
    .sort((left, right) => {
      if (
        right.highestEvidenceScore !==
        left.highestEvidenceScore
      ) {
        return (
          right.highestEvidenceScore -
          left.highestEvidenceScore
        );
      }

      return (
        right.averageEvidenceScore -
        left.averageEvidenceScore
      );
    })
    .slice(0, Math.max(1, maximumDocuments));

  const flattenedEvidence = clusters.flatMap(
    (cluster) =>
      cluster.chunks.map((chunk) => ({
        ...chunk,

        evidenceCluster: {
          clusterKey: cluster.clusterKey,
          documentId: cluster.documentId,
          title: cluster.title,
          country: cluster.country,
          jurisdiction: cluster.jurisdiction,
          issuingAuthority:
            cluster.issuingAuthority,
          documentType: cluster.documentType,
          chunkCount: cluster.chunks.length,
          highestEvidenceScore:
            cluster.highestEvidenceScore,
          averageEvidenceScore:
            cluster.averageEvidenceScore,
        },
      }))
  );

  return {
    clusters,
    flattenedEvidence,

    statistics: {
      inputEvidenceCount: evidence.length,
      documentCount: clusters.length,
      returnedEvidenceCount:
        flattenedEvidence.length,
      duplicateChunkCount,
      maximumChunksPerDocument,
      maximumDocuments,
    },
  };
}

export default clusterEvidence;