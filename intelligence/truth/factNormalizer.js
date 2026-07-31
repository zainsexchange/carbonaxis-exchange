const TOPIC_ALIASES = Object.freeze({
  renewables: "renewable_energy",
  renewable: "renewable_energy",
  renewable_power: "renewable_energy",
  clean_energy: "renewable_energy",
  green_energy: "renewable_energy",

  renewable_target: "renewable_target",
  renewable_targets: "renewable_target",
  electricity_target: "renewable_target",
  clean_energy_target: "renewable_target",

  green_hydrogen: "hydrogen",
  clean_hydrogen: "hydrogen",
  hydrogen_strategy: "hydrogen",

  carbon_credits: "carbon_market",
  carbon_credit: "carbon_market",
  emissions_trading: "carbon_market",
  carbon_trading: "carbon_market",
  ets: "carbon_market",

  climate_finance: "investment",
  green_finance: "investment",
  clean_energy_investment: "investment",

  electric_vehicles: "transport",
  electric_mobility: "transport",
  clean_transport: "transport",
  public_transport: "transport",

  pv: "solar_capacity",
  solar: "solar_capacity",
  solar_power: "solar_capacity",
  photovoltaic: "solar_capacity",

  wind: "wind_capacity",
  wind_power: "wind_capacity",

  netzero: "net_zero",
  net_zero_target: "net_zero",
  carbon_neutrality: "net_zero",

  battery: "energy_storage",
  batteries: "energy_storage",
  battery_storage: "energy_storage",
  storage: "energy_storage",

  measurement_reporting_verification: "mrv",
  monitoring_reporting_verification: "mrv",
  verification_system: "mrv",

  carbon_registry: "registry",
  credit_registry: "registry",
});

const CURRENCY_MULTIPLIERS = Object.freeze({
  thousand: 1_000,
  k: 1_000,

  million: 1_000_000,
  mn: 1_000_000,
  m: 1_000_000,

  billion: 1_000_000_000,
  bn: 1_000_000_000,
  b: 1_000_000_000,

  trillion: 1_000_000_000_000,
  tn: 1_000_000_000_000,
  t: 1_000_000_000_000,
});

function normalizeWhitespace(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableText(value = "") {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[“”‘’"'`]/g, "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[,:;!?]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEntity(value = "") {
  return normalizeWhitespace(value)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTopic(value = "") {
  const normalized = normalizeComparableText(value)
    .replace(/[-\s]+/g, "_");

  return TOPIC_ALIASES[normalized] || normalized || "general";
}

function normalizePercentageText(value = "") {
  return String(value)
    .replace(
      /\b(\d+(?:\.\d+)?)\s*(?:percent|per\s+cent)\b/gi,
      "$1%"
    )
    .replace(/\s+%/g, "%");
}

function detectCurrency(value = "") {
  const text = String(value).toLowerCase();

  if (/\busd\b|\$\s*\d/.test(text)) {
    return "USD";
  }

  if (/\baed\b/.test(text)) {
    return "AED";
  }

  if (/\bpkr\b|\brs\.?\s*\d/i.test(value)) {
    return "PKR";
  }

  if (/\beur\b|€\s*\d/.test(text)) {
    return "EUR";
  }

  if (/\bgbp\b|£\s*\d/.test(text)) {
    return "GBP";
  }

  return null;
}

function normalizeCurrencyAmounts(value = "") {
  const text = normalizePercentageText(value);

  const pattern =
    /(?:\b(USD|AED|PKR|EUR|GBP)\b|([$€£]))?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(thousand|million|billion|trillion|k|mn|bn|tn|m|b|t)?\s*(?:\b(USD|AED|PKR|EUR|GBP)\b)?/gi;

  return text.replace(
    pattern,
    (
      fullMatch,
      prefixCurrency,
      currencySymbol,
      numericValue,
      magnitude,
      suffixCurrency
    ) => {
      const hasCurrency =
        prefixCurrency ||
        currencySymbol ||
        suffixCurrency;

      if (!hasCurrency) {
        return fullMatch;
      }

      const parsedNumber = Number(
        String(numericValue).replace(/,/g, "")
      );

      if (!Number.isFinite(parsedNumber)) {
        return fullMatch;
      }

      const normalizedMagnitude =
        String(magnitude || "").toLowerCase();

      const multiplier =
        CURRENCY_MULTIPLIERS[normalizedMagnitude] || 1;

      const absoluteValue =
        parsedNumber * multiplier;

      let currency =
        prefixCurrency ||
        suffixCurrency ||
        null;

      if (!currencySymbol && !currency) {
        return fullMatch;
      }

      if (!currency) {
        if (currencySymbol === "$") {
          currency = "USD";
        } else if (currencySymbol === "€") {
          currency = "EUR";
        } else if (currencySymbol === "£") {
          currency = "GBP";
        }
      }

      return `${currency} ${absoluteValue}`;
    }
  );
}

function extractNormalizedNumbers(statement = "") {
  const normalizedStatement =
    normalizeCurrencyAmounts(
      normalizePercentageText(statement)
    );

  const numericValues = [];

  const percentagePattern =
    /\b(\d+(?:\.\d+)?)%/g;

  for (
    const match of normalizedStatement.matchAll(
      percentagePattern
    )
  ) {
    numericValues.push({
      type: "percentage",
      value: Number(match[1]),
      unit: "%",
      canonicalValue: `${Number(match[1])}%`,
      raw: match[0],
    });
  }

  const currencyPattern =
    /\b(USD|AED|PKR|EUR|GBP)\s+(\d+(?:\.\d+)?)/g;

  for (
    const match of normalizedStatement.matchAll(
      currencyPattern
    )
  ) {
    numericValues.push({
      type: "currency",
      value: Number(match[2]),
      unit: match[1],
      canonicalValue: `${match[1]} ${Number(match[2])}`,
      raw: match[0],
    });
  }

  const capacityPattern =
    /\b(\d+(?:\.\d+)?)\s*(MW|GW|TW)\b/gi;

  for (
    const match of normalizedStatement.matchAll(
      capacityPattern
    )
  ) {
    const unit = match[2].toUpperCase();

    numericValues.push({
      type: "capacity",
      value: Number(match[1]),
      unit,
      canonicalValue: `${Number(match[1])} ${unit}`,
      raw: match[0],
    });
  }

  const emissionsPattern =
    /\b(\d+(?:\.\d+)?)\s*(tCO2e|MtCO2e|GtCO2e)\b/gi;

  for (
    const match of normalizedStatement.matchAll(
      emissionsPattern
    )
  ) {
    numericValues.push({
      type: "emissions",
      value: Number(match[1]),
      unit: match[2],
      canonicalValue: `${Number(match[1])} ${match[2]}`,
      raw: match[0],
    });
  }

  const yearPattern =
    /\b(19|20)\d{2}\b/g;

  for (
    const match of normalizedStatement.matchAll(
      yearPattern
    )
  ) {
    numericValues.push({
      type: "year",
      value: Number(match[0]),
      unit: "year",
      canonicalValue: match[0],
      raw: match[0],
    });
  }

  return numericValues;
}

function buildStatementFingerprint(statement = "") {
  return normalizeComparableText(
    normalizeCurrencyAmounts(
      normalizePercentageText(statement)
    )
  )
    .replace(/\bthe\b/g, "")
    .replace(/\ba\b/g, "")
    .replace(/\ban\b/g, "")
    .replace(/\bshall\b/g, "will")
    .replace(/\baims?\s+to\b/g, "")
    .replace(/\bplans?\s+to\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFactFingerprint(fact = {}) {
  const entity =
    normalizeComparableText(
      fact.entity || fact.country || "unknown"
    );

  const topic =
    normalizeTopic(fact.topic || "general");

  const statement =
    buildStatementFingerprint(
      fact.statement || fact.text || ""
    );

  return [
    entity,
    topic,
    statement,
  ].join("::");
}

function choosePreferredFact(left, right) {
  const leftScore = Number(
    left.evidenceScore ||
    left.score ||
    left.relevanceScore ||
    0
  );

  const rightScore = Number(
    right.evidenceScore ||
    right.score ||
    right.relevanceScore ||
    0
  );

  if (rightScore > leftScore) {
    return right;
  }

  if (leftScore > rightScore) {
    return left;
  }

  const leftLength =
    normalizeWhitespace(
      left.statement || left.text || ""
    ).length;

  const rightLength =
    normalizeWhitespace(
      right.statement || right.text || ""
    ).length;

  return rightLength > leftLength
    ? right
    : left;
}

function mergeDuplicateFacts(existingFact, newFact) {
  const preferredFact =
    choosePreferredFact(
      existingFact,
      newFact
    );

  const sources = [
    ...(existingFact.sources || []),
    ...(newFact.sources || []),
  ];

  const sourceIdentifiers = [
    existingFact.documentId,
    existingFact.chunkId,
    existingFact.citationId,
    newFact.documentId,
    newFact.chunkId,
    newFact.citationId,
  ].filter(Boolean);

  return {
    ...existingFact,
    ...preferredFact,

    duplicateCount:
      Number(existingFact.duplicateCount || 1) +
      Number(newFact.duplicateCount || 1),

    sources: Array.from(
      new Set([
        ...sources,
        ...sourceIdentifiers,
      ])
    ),

    normalizedNumbers: Array.from(
      new Map(
        [
          ...(existingFact.normalizedNumbers || []),
          ...(newFact.normalizedNumbers || []),
        ].map((item) => [
          `${item.type}:${item.canonicalValue}`,
          item,
        ])
      ).values()
    ),
  };
}

export function normalizeFact(fact = {}) {
  const originalStatement =
    normalizeWhitespace(
      fact.statement || fact.text || ""
    );

  const normalizedStatement =
    normalizeWhitespace(
      normalizeCurrencyAmounts(
        normalizePercentageText(
          originalStatement
        )
      )
    );

  return {
    ...fact,

    entity:
      normalizeEntity(
        fact.entity ||
        fact.country ||
        fact.jurisdiction ||
        "Unknown"
      ),

    topic:
      normalizeTopic(
        fact.topic ||
        fact.category ||
        "general"
      ),

    statement:
      normalizedStatement,

    originalStatement,

    statementFingerprint:
      buildStatementFingerprint(
        normalizedStatement
      ),

    normalizedNumbers:
      extractNormalizedNumbers(
        normalizedStatement
      ),

    duplicateCount:
      Number(fact.duplicateCount || 1),
  };
}

export function normalizeFacts(facts = []) {
  if (!Array.isArray(facts)) {
    return {
      facts: [],
      inputCount: 0,
      outputCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
    };
  }

  const normalizedByFingerprint =
    new Map();

  const invalidFacts = [];

  for (const fact of facts) {
    const normalizedFact =
      normalizeFact(fact);

    if (!normalizedFact.statement) {
      invalidFacts.push(fact);
      continue;
    }

    const fingerprint =
      buildFactFingerprint(
        normalizedFact
      );

    const existingFact =
      normalizedByFingerprint.get(
        fingerprint
      );

    if (!existingFact) {
      normalizedByFingerprint.set(
        fingerprint,
        {
          ...normalizedFact,
          fingerprint,
        }
      );

      continue;
    }

    normalizedByFingerprint.set(
      fingerprint,
      mergeDuplicateFacts(
        existingFact,
        normalizedFact
      )
    );
  }

  const normalizedFacts =
    Array.from(
      normalizedByFingerprint.values()
    );

  return {
    facts:
      normalizedFacts,

    inputCount:
      facts.length,

    outputCount:
      normalizedFacts.length,

    duplicateCount:
      Math.max(
        0,
        facts.length -
        normalizedFacts.length -
        invalidFacts.length
      ),

    invalidCount:
      invalidFacts.length,

    invalidFacts,
  };
}