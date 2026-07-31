function normalizeText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnit(value = "") {
  const unit = normalizeText(value).toLowerCase();

  const aliases = {
    percent: "%",
    percentage: "%",
    percentages: "%",
    pct: "%",

    year: "year",
    years: "year",

    tonne: "tonne",
    tonnes: "tonne",

    ton: "ton",
    tons: "ton",

    kilogram: "kg",
    kilograms: "kg",

    megawatt: "mw",
    megawatts: "mw",

    gigawatt: "gw",
    gigawatts: "gw",

    kilowatt: "kw",
    kilowatts: "kw",

    dollar: "usd",
    dollars: "usd",

    euro: "eur",
    euros: "eur",

    rupee: "pkr",
    rupees: "pkr",
  };

  return aliases[unit] || unit;
}

function normalizeNumericInput(text = "") {
  return String(text || "")
    .replace(/\u0000/g, "")

    /*
     * Remove citation markers such as:
     * [CA-001], CA-001, [CA-023]
     */
    .replace(/\[?CA-\d+\]?/gi, " ")

    /*
     * Remove common structured identifiers:
     * ISO-14064, Article-12, Section-5,
     * Chapter-7, Clause-10, Table-2.
     */
    .replace(
      /\b(?:ISO|Article|Section|Chapter|Clause|Table|Figure|Annex|Appendix|Schedule|Rule|Regulation)-?\s*\d+(?:[.-]\d+)*\b/gi,
      " "
    )

    /*
     * Normalize comma-separated numbers:
     * 500,000 -> 500000
     * 1,250,000.50 -> 1250000.50
     */
    .replace(
      /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g,
      (match) => match.replace(/,/g, "")
    )

    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyYear(value, unit = "") {
  return (
    !unit &&
    Number.isInteger(value) &&
    value >= 1900 &&
    value <= 2200
  );
}

function classifyNumericType(value, unit = "") {
  if (isLikelyYear(value, unit)) {
    return "year";
  }

  if (unit === "%") {
    return "percentage";
  }

  if (["usd", "eur", "gbp", "pkr"].includes(unit)) {
    return "currency";
  }

  if (["mw", "gw", "kw"].includes(unit)) {
    return "energy_capacity";
  }

  if (
    [
      "kg",
      "ton",
      "tonne",
      "tco2e",
      "mtco2e",
    ].includes(unit)
  ) {
    return "quantity";
  }

  if (unit === "year") {
    return "duration";
  }

  return "number";
}

function extractNumbers(text = "") {
  const normalizedText =
    normalizeNumericInput(text);

  const numbers = [];

  /*
   * Supports:
   *
   * 45%
   * 45 percent
   * 4.5 GW
   * 500,000 tonnes
   * USD 2.5 million
   * 2030
   *
   * Currency symbols are handled separately below.
   */
  const numericPattern =
  /(?<![\w-])(-?\d+(?:\.\d+)?)\s*(%|percent(?:age)?s?|pct|years?|kilowatts?|megawatts?|gigawatts?|kw|mw|gw|kilograms?|kg|tons?|tonnes?|tco2e|mtco2e|usd|eur|gbp|pkr)?(?![\w-])/gi;
  let match;

  while (
    (match = numericPattern.exec(normalizedText))
  ) {
    const raw = normalizeText(match[0]);
    const value = Number(match[1]);
    const unit = normalizeUnit(match[2]);

    if (!Number.isFinite(value)) {
      continue;
    }

    /*
     * Ignore isolated zero-padding fragments.
     * Proper comma-separated values were already normalized,
     * so "000 ton" should no longer occur legitimately.
     */
    if (
      /^0{2,}(?:\s|$)/.test(raw) &&
      value === 0
    ) {
      continue;
    }

    numbers.push({
      raw,
      value,
      unit,
      type: classifyNumericType(
        value,
        unit
      ),
      startIndex: match.index,
      endIndex:
        match.index + match[0].length,
    });
  }

  /*
   * Currency symbols:
   * $25 million
   * €10.5
   * £8
   */
  const currencyPattern =
    /(?<![\w-])([$€£])\s*(-?\d+(?:\.\d+)?)(?![\w-])/g;

  const currencyMap = {
    $: "usd",
    "€": "eur",
    "£": "gbp",
  };

  while (
    (match = currencyPattern.exec(normalizedText))
  ) {
    const value = Number(match[2]);

    if (!Number.isFinite(value)) {
      continue;
    }

    const unit = currencyMap[match[1]];

    numbers.push({
      raw: normalizeText(match[0]),
      value,
      unit,
      type: "currency",
      startIndex: match.index,
      endIndex:
        match.index + match[0].length,
    });
  }

  return numbers.sort(
    (left, right) =>
      left.startIndex - right.startIndex
  );
}

function unitsAreCompatible(
  answerUnit,
  evidenceUnit
) {
  if (answerUnit === evidenceUnit) {
    return true;
  }

  /*
   * A unitless value should not support a clearly
   * unit-bearing answer claim.
   *
   * Example:
   * answer: 45%
   * evidence: section 45
   */
  if (answerUnit && !evidenceUnit) {
    return false;
  }

  if (!answerUnit && evidenceUnit) {
    return false;
  }

  return false;
}

function numericValuesEqual(
  left,
  right
) {
  const tolerance = Math.max(
    0.0001,
    Math.abs(left) * 0.000001,
    Math.abs(right) * 0.000001
  );

  return Math.abs(left - right) <= tolerance;
}

function buildEvidenceNumbers(
  evidence = []
) {
  const evidenceNumbers = [];

  for (
    let index = 0;
    index < evidence.length;
    index += 1
  ) {
    const item = evidence[index];

    const citationId =
      item.citationId ||
      `CA-${String(index + 1).padStart(
        3,
        "0"
      )}`;

    const extractedNumbers =
      extractNumbers(item.content || "");

    for (const number of extractedNumbers) {
      evidenceNumbers.push({
        ...number,
        citationId,

        documentId:
          item.document?._id ||
          item.documentId ||
          null,

        chunkId:
          item._id ||
          item.chunkId ||
          null,

        chunkIndex:
          Number.isInteger(
            item.chunkIndex
          )
            ? item.chunkIndex
            : null,
      });
    }
  }

  return evidenceNumbers;
}

function findNumericSupport(
  answerNumber,
  evidenceNumbers
) {
  return evidenceNumbers.filter(
    (evidenceNumber) => {
      if (
        !unitsAreCompatible(
          answerNumber.unit,
          evidenceNumber.unit
        )
      ) {
        return false;
      }

      return numericValuesEqual(
        answerNumber.value,
        evidenceNumber.value
      );
    }
  );
}

export function verifyNumericFacts({
  answer = "",
  evidence = [],
} = {}) {
  const answerNumbers =
    extractNumbers(answer);

  const evidenceNumbers =
    buildEvidenceNumbers(evidence);

  const verifiedNumbers = [];
  const mismatches = [];

  for (const answerNumber of answerNumbers) {
    const supportingEvidence =
      findNumericSupport(
        answerNumber,
        evidenceNumbers
      );

    if (supportingEvidence.length > 0) {
      verifiedNumbers.push({
        ...answerNumber,

        supported: true,

        supportingEvidence:
          supportingEvidence
            .slice(0, 5)
            .map((item) => ({
              citationId:
                item.citationId,

              documentId:
                item.documentId,

              chunkId:
                item.chunkId,

              chunkIndex:
                item.chunkIndex,

              raw: item.raw,
            })),
      });

      continue;
    }

    mismatches.push({
      ...answerNumber,
      supported: false,

      reason:
        answerNumber.unit
          ? `The value ${answerNumber.raw} was not found with a compatible unit in the selected evidence.`
          : `The value ${answerNumber.raw} was not found in the selected evidence.`,
    });
  }

  const uniqueEvidenceNumbers =
    new Set(
      evidenceNumbers.map(
        (item) =>
          `${item.value}:${item.unit}`
      )
    ).size;

  return {
    passed: mismatches.length === 0,

    status:
      answerNumbers.length === 0
        ? "not_applicable"
        : mismatches.length === 0
          ? "verified"
          : "warning",

    answerNumberCount:
      answerNumbers.length,

    verifiedNumberCount:
      verifiedNumbers.length,

    mismatchCount:
      mismatches.length,

    evidenceNumberCount:
      evidenceNumbers.length,

    uniqueEvidenceNumberCount:
      uniqueEvidenceNumbers,

    answerNumbers,

    verifiedNumbers,

    mismatches,

    /*
     * Retained temporarily for debugging.
     * Do not expose this entire array publicly
     * in production API responses.
     */
    evidenceNumbers,
  };
}