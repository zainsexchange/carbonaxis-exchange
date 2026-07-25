function clamp(value, minimum = 0, maximum = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, number));
}

function average(values = []) {
  const valid = values
    .map(Number)
    .filter((value) => Number.isFinite(value));

  if (!valid.length) {
    return 0;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function uniqueCount(values = []) {
  return new Set(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ).size;
}

function calculateSourceDiversity(evidence = []) {
  const sourceClasses = uniqueCount(
    evidence.map((item) => item.document?.sourceClass)
  );

  const documents = uniqueCount(
    evidence.map((item) => item.documentId)
  );

  const authorities = uniqueCount(
    evidence.map((item) => item.document?.issuingAuthority)
  );

  const sourceClassScore = Math.min(sourceClasses / 3, 1);
  const documentScore = Math.min(documents / 4, 1);
  const authorityScore = Math.min(authorities / 3, 1);

  return clamp(
    sourceClassScore * 0.35 +
      documentScore * 0.4 +
      authorityScore * 0.25
  );
}

function calculateEvidenceCoverage(evidence = []) {
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
    Number(conflictCount || 0) / evidence.length,
    1
  );

  return clamp(1 - penalty);
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
  const officialEvidenceCount = evidence.filter((item) =>
    [
      "government",
      "un",
      "standard_body",
      "registry",
      "international_organization",
    ].includes(
      String(item.document?.sourceClass || "").toLowerCase()
    )
  ).length;

  if (score >= 0.85 && officialEvidenceCount >= 2) {
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

export function calculateConfidence({
  evidence = [],
  conflicts = [],
}) {
  if (!Array.isArray(evidence)) {
    throw new Error("Evidence must be supplied as an array.");
  }

  if (!Array.isArray(conflicts)) {
    throw new Error("Conflicts must be supplied as an array.");
  }

  const averageEvidenceScore = average(
    evidence.map((item) => item.evidenceScore)
  );

  const averageSemanticSimilarity = average(
    evidence.map((item) => item.score)
  );

  const sourceDiversity = calculateSourceDiversity(evidence);
  const evidenceCoverage = calculateEvidenceCoverage(evidence);

  const agreement = calculateAgreementScore({
    evidence,
    conflictCount: conflicts.length,
  });

  const conflictPenalty = Math.min(
    conflicts.length * 0.08,
    0.32
  );

  const rawScore =
    averageEvidenceScore * 0.38 +
    averageSemanticSimilarity * 0.2 +
    sourceDiversity * 0.14 +
    evidenceCoverage * 0.14 +
    agreement * 0.14 -
    conflictPenalty;

  const score = clamp(rawScore);

  return {
    score,
    percentage: Math.round(score * 100),
    level: resolveConfidenceLevel(score),

    reliabilityLevel: resolveReliabilityLevel({
      score,
      evidence,
    }),

    signals: {
      averageEvidenceScore,
      averageSemanticSimilarity,
      sourceDiversity,
      evidenceCoverage,
      agreement,
      conflictPenalty,
      evidenceCount: evidence.length,
      conflictCount: conflicts.length,
    },
  };
}