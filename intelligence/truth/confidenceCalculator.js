import { resolveAuthority } from "./authorityResolver.js";

function clamp(value, minimum = 0, maximum = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return minimum;
  }

  return Math.min(
    maximum,
    Math.max(minimum, number)
  );
}

function average(values = []) {
  const valid = values
    .map(Number)
    .filter((value) =>
      Number.isFinite(value)
    );

  if (!valid.length) {
    return 0;
  }

  return (
    valid.reduce(
      (sum, value) => sum + value,
      0
    ) / valid.length
  );
}

function uniqueCount(values = []) {
  return new Set(
    values
      .map((value) =>
        String(value || "").trim()
      )
      .filter(Boolean)
  ).size;
}

function toPercentage(value) {
  return Math.round(clamp(value) * 100);
}

function calculateSourceDiversity(
  evidence = []
) {
  const sourceClasses = uniqueCount(
    evidence.map(
      (item) =>
        item.document?.sourceClass
    )
  );

  const documents = uniqueCount(
    evidence.map(
      (item) => item.documentId
    )
  );

  const authorities = uniqueCount(
    evidence.map(
      (item) =>
        item.document?.issuingAuthority
    )
  );

  const sourceClassScore = Math.min(
    sourceClasses / 3,
    1
  );

  const documentScore = Math.min(
    documents / 4,
    1
  );

  const authorityScore = Math.min(
    authorities / 3,
    1
  );

  return clamp(
    sourceClassScore * 0.35 +
      documentScore * 0.4 +
      authorityScore * 0.25
  );
}

function calculateEvidenceCoverage(
  evidence = []
) {
  if (!evidence.length) {
    return 0;
  }

  if (evidence.length >= 6) return 1;
  if (evidence.length === 5) return 0.92;
  if (evidence.length === 4) return 0.84;
  if (evidence.length === 3) return 0.72;
  if (evidence.length === 2) return 0.58;

  return 0.4;
}

function calculateAgreementScore({
  evidence = [],
  conflictCount = 0,
}) {
  if (!evidence.length) {
    return 0;
  }

  const penalty = Math.min(
    Number(conflictCount || 0) /
      evidence.length,
    1
  );

  return clamp(1 - penalty);
}

function calculateAverageAuthority(
  evidence = []
) {
  if (!evidence.length) {
    return 0;
  }

  const authorityScores = evidence.map(
    (item) => {
      const authority = resolveAuthority(
        item.document || {}
      );

      return authority.score / 100;
    }
  );

  return average(authorityScores);
}

function resolveEvidenceDate(item = {}) {
  const document = item.document || {};

  return (
    document.lastVerifiedAt ||
    document.publicationDate ||
    document.effectiveDate ||
    null
  );
}

function calculateFreshnessScore(
  evidence = []
) {
  const currentTime = Date.now();

  const freshnessScores = evidence
    .map(resolveEvidenceDate)
    .map((value) => {
      if (!value) {
        return null;
      }

      const date = new Date(value);

      if (
        Number.isNaN(date.getTime())
      ) {
        return null;
      }

      const ageInYears =
        Math.max(
          currentTime - date.getTime(),
          0
        ) /
        (1000 * 60 * 60 * 24 * 365.25);

      if (ageInYears <= 1) return 1;
      if (ageInYears <= 2) return 0.9;
      if (ageInYears <= 3) return 0.8;
      if (ageInYears <= 5) return 0.65;
      if (ageInYears <= 8) return 0.45;

      return 0.25;
    })
    .filter((value) => value !== null);

  if (!freshnessScores.length) {
    return 0;
  }

  return average(freshnessScores);
}

function resolveConfidenceLevel(score) {
  if (score >= 0.9) return "very_high";
  if (score >= 0.78) return "high";
  if (score >= 0.62) return "moderate";
  if (score >= 0.45) return "low";

  return "insufficient";
}

function resolveReliabilityLevel({
  score,
  evidence = [],
}) {
  const officialEvidenceCount =
    evidence.filter((item) =>
      [
        "government",
        "un",
        "standard_body",
        "registry",
        "international_organization",
      ].includes(
        String(
          item.document?.sourceClass || ""
        ).toLowerCase()
      )
    ).length;

  if (
    score >= 0.85 &&
    officialEvidenceCount >= 2
  ) {
    return "official_source";
  }

  if (score >= 0.72) {
    return "strong_evidence";
  }

  if (score >= 0.52) {
    return "partial_evidence";
  }

  if (evidence.length > 0) {
    return "general_answer";
  }

  return "insufficient_evidence";
}

function buildConfidenceExplanation({
  evidence = [],
  conflicts = [],
  averageEvidenceScore,
  averageSemanticSimilarity,
  sourceDiversity,
  evidenceCoverage,
  agreement,
  averageAuthority,
  freshness,
}) {
  const positiveSignals = [];
  const warningSignals = [];

  const uniqueDocumentCount =
    uniqueCount(
      evidence.map(
        (item) => item.documentId
      )
    );

  const uniqueAuthorityCount =
    uniqueCount(
      evidence.map(
        (item) =>
          item.document?.issuingAuthority
      )
    );

  const officialEvidenceCount =
    evidence.filter((item) =>
      [
        "government",
        "un",
        "standard_body",
        "registry",
        "international_organization",
      ].includes(
        String(
          item.document?.sourceClass || ""
        ).toLowerCase()
      )
    ).length;

  if (averageEvidenceScore >= 0.75) {
    positiveSignals.push(
      "The retrieved evidence has strong overall evidence scores."
    );
  } else if (
    averageEvidenceScore < 0.55
  ) {
    warningSignals.push(
      "The retrieved evidence has relatively low evidence scores."
    );
  }

  if (
    averageSemanticSimilarity >= 0.75
  ) {
    positiveSignals.push(
      "The evidence closely matches the question."
    );
  } else if (
    averageSemanticSimilarity < 0.55
  ) {
    warningSignals.push(
      "The semantic match between the question and evidence is limited."
    );
  }

  if (
    agreement >= 0.9 &&
    conflicts.length === 0
  ) {
    positiveSignals.push(
      "No direct conflicts were detected in the selected evidence."
    );
  }

  if (conflicts.length > 0) {
    warningSignals.push(
      `${conflicts.length} evidence conflict${
        conflicts.length === 1 ? "" : "s"
      } ${
        conflicts.length === 1
          ? "was"
          : "were"
      } detected.`
    );
  }

  if (officialEvidenceCount > 0) {
    positiveSignals.push(
      `${officialEvidenceCount} official evidence item${
        officialEvidenceCount === 1
          ? ""
          : "s"
      } ${
        officialEvidenceCount === 1
          ? "was"
          : "were"
      } included.`
    );
  }

  if (averageAuthority >= 0.9) {
    positiveSignals.push(
      "The supporting evidence comes from highly authoritative sources."
    );
  } else if (averageAuthority < 0.75) {
    warningSignals.push(
      "Source authority is limited because the evidence is not primarily from official institutions."
    );
  }

  if (uniqueDocumentCount >= 3) {
    positiveSignals.push(
      `The answer is supported by ${uniqueDocumentCount} distinct documents.`
    );
  } else if (uniqueDocumentCount === 1) {
    warningSignals.push(
      "Only one unique document supports the answer."
    );
  }

  if (
    uniqueAuthorityCount <= 1 &&
    evidence.length > 1
  ) {
    warningSignals.push(
      "The evidence has limited publisher diversity."
    );
  }

  if (sourceDiversity >= 0.7) {
    positiveSignals.push(
      "The supporting evidence has strong source diversity."
    );
  } else if (sourceDiversity < 0.45) {
    warningSignals.push(
      "The supporting evidence has limited source diversity."
    );
  }

  if (evidenceCoverage >= 0.75) {
    positiveSignals.push(
      "A broad set of relevant evidence was available."
    );
  } else if (evidenceCoverage < 0.6) {
    warningSignals.push(
      "Evidence coverage is moderate or limited."
    );
  }

  if (freshness >= 0.8) {
    positiveSignals.push(
      "The supporting evidence is recent."
    );
  } else if (
    freshness > 0 &&
    freshness < 0.5
  ) {
    warningSignals.push(
      "Some supporting evidence may be outdated."
    );
  } else if (freshness === 0) {
    warningSignals.push(
      "Freshness could not be determined from the available metadata."
    );
  }

  const summary = [
    ...positiveSignals.slice(0, 3),
    ...warningSignals.slice(0, 3),
  ];

  return {
    summary,
    positiveSignals,
    warningSignals,

    evidenceProfile: {
      evidenceCount: evidence.length,
      uniqueDocumentCount,
      uniqueAuthorityCount,
      officialEvidenceCount,
    },
  };
}

export function calculateConfidence({
  evidence = [],
  conflicts = [],
}) {
  if (!Array.isArray(evidence)) {
    throw new Error(
      "Evidence must be supplied as an array."
    );
  }

  if (!Array.isArray(conflicts)) {
    throw new Error(
      "Conflicts must be supplied as an array."
    );
  }

  const averageEvidenceScore = average(
    evidence.map(
      (item) => item.evidenceScore
    )
  );

  const averageSemanticSimilarity =
    average(
      evidence.map(
        (item) => item.score
      )
    );

  const sourceDiversity =
    calculateSourceDiversity(evidence);

  const evidenceCoverage =
    calculateEvidenceCoverage(evidence);

  const agreement =
    calculateAgreementScore({
      evidence,
      conflictCount:
        conflicts.length,
    });

  const conflictPenalty = Math.min(
    conflicts.length * 0.08,
    0.32
  );

  /*
   * Existing scoring formula preserved.
   * Authority and freshness are currently
   * explainability signals only.
   */
  const rawScore =
    averageEvidenceScore * 0.38 +
    averageSemanticSimilarity * 0.2 +
    sourceDiversity * 0.14 +
    evidenceCoverage * 0.14 +
    agreement * 0.14 -
    conflictPenalty;

  const score = clamp(rawScore);

  const averageAuthority =
    calculateAverageAuthority(evidence);

  const freshness =
    calculateFreshnessScore(evidence);

  const explanation =
    buildConfidenceExplanation({
      evidence,
      conflicts,
      averageEvidenceScore,
      averageSemanticSimilarity,
      sourceDiversity,
      evidenceCoverage,
      agreement,
      averageAuthority,
      freshness,
    });

  return {
    score,
    percentage: Math.round(
      score * 100
    ),

    level:
      resolveConfidenceLevel(score),

    reliabilityLevel:
      resolveReliabilityLevel({
        score,
        evidence,
      }),

    breakdown: {
      evidenceStrength:
        toPercentage(
          averageEvidenceScore
        ),

      semanticSimilarity:
        toPercentage(
          averageSemanticSimilarity
        ),

      sourceDiversity:
        toPercentage(sourceDiversity),

      evidenceCoverage:
        toPercentage(evidenceCoverage),

      agreement:
        toPercentage(agreement),

      authority:
        toPercentage(averageAuthority),

      freshness:
        toPercentage(freshness),

      conflictPenalty:
        Math.round(
          conflictPenalty * 100
        ),
    },

    summary: explanation.summary,

    positiveSignals:
      explanation.positiveSignals,

    warningSignals:
      explanation.warningSignals,

    evidenceProfile:
      explanation.evidenceProfile,

    signals: {
      averageEvidenceScore,
      averageSemanticSimilarity,
      sourceDiversity,
      evidenceCoverage,
      agreement,
      averageAuthority,
      freshness,
      conflictPenalty,
      evidenceCount: evidence.length,
      conflictCount:
        conflicts.length,
    },
  };
}