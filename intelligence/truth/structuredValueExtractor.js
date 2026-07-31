const CURRENCY_CODES = Object.freeze([
  "USD",
  "EUR",
  "GBP",
  "AED",
  "PKR",
  "SAR",
  "QAR",
  "OMR",
  "KWD",
  "BHD",
]);

const SCALE_MULTIPLIERS = Object.freeze({
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000,
  trillion: 1_000_000_000_000,
});

const MEASUREMENT_UNITS = Object.freeze([
  "%",
  "GW",
  "MW",
  "TW",
  "GWh",
  "MWh",
  "TWh",
  "kWh",
  "MtCO2e",
  "MtCO2",
  "tCO2e",
  "tCO2",
  "kgCO2e",
  "kgCO2",
  "tonnes",
  "tons",
  "ton",
  "kg",
  "km",
  "hectares",
]);

const TEMPORAL_SIGNAL_PATTERN =
  /\b(?:by|before|until|through|from|between|during|in)\s+(19|20)\d{2}\b/i;

function normalizeWhitespace(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value = "") {
  const parsed =
    Number(
      String(value)
        .replace(/,/g, "")
        .trim()
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function normalizeCurrency(value = "") {
  const currency =
    String(value)
      .trim()
      .toUpperCase();

  return CURRENCY_CODES.includes(currency)
    ? currency
    : null;
}

function normalizeScale(value = "") {
  const scale =
    String(value)
      .trim()
      .toLowerCase();

  return SCALE_MULTIPLIERS[scale]
    ? scale
    : null;
}

function normalizeUnit(value = "") {
  const candidate =
    String(value)
      .trim();

  const normalized =
    MEASUREMENT_UNITS.find(
      (unit) =>
        unit.toLowerCase() ===
        candidate.toLowerCase()
    );

  return normalized || null;
}

function extractYears(value = "") {
  const text =
    normalizeWhitespace(value);

  const matches =
    text.match(/\b(?:19|20)\d{2}\b/g) || [];

  return [
    ...new Set(
      matches.map(Number)
    ),
  ];
}

function extractPrimaryYear(value = "") {
  const text =
    normalizeWhitespace(value);

  const contextualMatch =
    text.match(
      /\b(?:by|before|until|through|during|in)\s+((?:19|20)\d{2})\b/i
    );

  if (contextualMatch) {
    return Number(
      contextualMatch[1]
    );
  }

  const years =
    extractYears(text);

  return years.length === 1
    ? years[0]
    : null;
}

function extractYearRange(value = "") {
  const text =
    normalizeWhitespace(value);

  const rangeMatch =
    text.match(
      /\b((?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2})\b/i
    );

  if (!rangeMatch) {
    return null;
  }

  const startYear =
    Number(rangeMatch[1]);

  const endYear =
    Number(rangeMatch[2]);

  if (
    !Number.isFinite(startYear) ||
    !Number.isFinite(endYear)
  ) {
    return null;
  }

  return {
    startYear,
    endYear,
  };
}

function extractPercentage(value = "") {
  const text =
    normalizeWhitespace(value);

  const match =
  text.match(
    /(-?\d+(?:,\d{3})*(?:\.\d+)?)\s*(%|percent|per cent)(?=\s|$|[.,;:!?])/i
  );

  if (!match) {
    return null;
  }

  const number =
    normalizeNumber(match[1]);

  if (number === null) {
    return null;
  }

  return {
    number,
    unit: "%",
    raw:
      normalizeWhitespace(
        match[0]
      ),
  };
}

function extractCurrencyAmount(value = "") {
  const text =
    normalizeWhitespace(value);

  const currencyPattern =
    CURRENCY_CODES.join("|");

  const match =
    text.match(
      new RegExp(
        `\\b(${currencyPattern})\\s*([\\d,]+(?:\\.\\d+)?)\\s*(thousand|million|billion|trillion)?\\b`,
        "i"
      )
    );

  if (!match) {
    return null;
  }

  const currency =
    normalizeCurrency(match[1]);

  const number =
    normalizeNumber(match[2]);

  const scale =
    normalizeScale(match[3]);

  if (
    !currency ||
    number === null
  ) {
    return null;
  }

  const multiplier =
    scale
      ? SCALE_MULTIPLIERS[scale]
      : 1;

  return {
    number,
    currency,
    scale,
    normalizedAmount:
      number * multiplier,
    raw:
      normalizeWhitespace(
        match[0]
      ),
  };
}

function extractMeasurement(value = "") {
  const text =
    normalizeWhitespace(value);

  const unitPattern =
    MEASUREMENT_UNITS
      .filter(
        (unit) => unit !== "%"
      )
      .sort(
        (a, b) =>
          b.length - a.length
      )
      .map((unit) =>
        unit.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )
      )
      .join("|");

  const match =
    text.match(
      new RegExp(
        `(-?\\d+(?:,\\d{3})*(?:\\.\\d+)?)\\s*(${unitPattern})\\b`,
        "i"
      )
    );

  if (!match) {
    return null;
  }

  const number =
    normalizeNumber(match[1]);

  const unit =
    normalizeUnit(match[2]);

  if (
    number === null ||
    !unit
  ) {
    return null;
  }

  return {
    number,
    unit,
    raw:
      normalizeWhitespace(
        match[0]
      ),
  };
}

function removeExtractedValue(
  value = "",
  rawValue = ""
) {
  const text =
    normalizeWhitespace(value);

  const raw =
    normalizeWhitespace(rawValue);

  if (!raw) {
    return text;
  }

  return normalizeWhitespace(
    text.replace(raw, " ")
  );
}

function removeTemporalLanguage(
  value = ""
) {
  return normalizeWhitespace(value)
    .replace(
      /\b(?:by|before|until|through|during|in)\s+(?:19|20)\d{2}\b/gi,
      " "
    )
    .replace(
      /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:19|20)\d{2}\b/gi,
      " "
    )
    .trim();
}

function extractMetricText(
  value = "",
  extractedValue = null
) {
  let metric =
    normalizeWhitespace(value);

  if (
    extractedValue?.raw
  ) {
    metric =
      removeExtractedValue(
        metric,
        extractedValue.raw
      );
  }

  metric =
    removeTemporalLanguage(
      metric
    )
      .replace(
        /^(?:of|for|toward|towards|through|via|using|with|from|in|on|at)\s+/i,
        ""
      )
      .replace(
        /[.;:!?]+$/g,
        ""
      )
      .trim();

  return metric || null;
}

function detectValueType({
  percentage,
  currency,
  measurement,
  year,
  yearRange,
}) {
  if (currency) {
    return "currency";
  }

  if (percentage) {
    return "percentage";
  }

  if (measurement) {
    return "measurement";
  }

  if (yearRange) {
    return "year_range";
  }

  if (year) {
    return "year";
  }

  return null;
}

function buildStructuredValue(
  object = ""
) {
  const text =
    normalizeWhitespace(object);

  if (!text) {
    return null;
  }

  const percentage =
    extractPercentage(text);

  const currency =
    extractCurrencyAmount(text);

  const measurement =
    extractMeasurement(text);

  const yearRange =
    extractYearRange(text);

  const year =
    yearRange
      ? null
      : extractPrimaryYear(text);

  const primaryValue =
    currency ||
    percentage ||
    measurement;

  const valueType =
    detectValueType({
      percentage,
      currency,
      measurement,
      year,
      yearRange,
    });

  if (!valueType) {
    return null;
  }

  const metric =
    extractMetricText(
      text,
      primaryValue
    );

  const structuredValue = {
    type: valueType,

    number:
      primaryValue?.number ??
      null,

    unit:
      primaryValue?.unit ??
      null,

    currency:
      currency?.currency ??
      null,

    scale:
      currency?.scale ??
      null,

    normalizedAmount:
      currency?.normalizedAmount ??
      null,

    metric,

    year:
      year ?? null,

    yearRange:
      yearRange ?? null,

    allYears:
      extractYears(text),

    raw:
      text,

    temporalSignal:
      TEMPORAL_SIGNAL_PATTERN.test(
        text
      ),
  };

  return structuredValue;
}

export function enrichPropositionValues(
  propositions = []
) {
  if (!Array.isArray(propositions)) {
    return [];
  }

  return propositions.map(
    (proposition) => {
      const structuredValue =
        buildStructuredValue(
          proposition.object
        );

      return {
        ...proposition,

        structuredValue,

        hasStructuredValue:
          Boolean(
            structuredValue
          ),
      };
    }
  );
}

export function extractStructuredValue(
  value = ""
) {
  return buildStructuredValue(
    value
  );
}