/**
 * Global carbon / climate screening calculators.
 * Deterministic math for worldwide markets — not limited to Pakistan/Oman.
 * Factors are indicative screening defaults (not registry issuance values).
 */

/** Grid emission factors — tCO2e per MWh (indicative / screening order of magnitude) */
export const GRID_FACTORS = {
  // South Asia
  Pakistan: { tPerMWh: 0.57, region: "South Asia", note: "Thermal-heavy mix; verify with latest NEPRA/grid inventory" },
  India: { tPerMWh: 0.71, region: "South Asia", note: "Coal-heavy; state grids vary widely" },
  Bangladesh: { tPerMWh: 0.58, region: "South Asia", note: "Gas + coal mix" },
  SriLanka: { tPerMWh: 0.52, region: "South Asia", note: "Thermal + hydro mix" },

  // Middle East / GCC
  Oman: { tPerMWh: 0.45, region: "GCC", note: "Gas-dominant; Vision 2040 transition" },
  UAE: { tPerMWh: 0.42, region: "GCC", note: "Gas + growing nuclear/solar" },
  "Saudi Arabia": { tPerMWh: 0.55, region: "GCC", note: "Oil/gas heavy; Vision 2030 renewables ramp" },
  Qatar: { tPerMWh: 0.48, region: "GCC", note: "Gas-dominant" },
  Bahrain: { tPerMWh: 0.55, region: "GCC", note: "Gas-dominant" },
  Kuwait: { tPerMWh: 0.62, region: "GCC", note: "Oil/gas heavy" },
  Jordan: { tPerMWh: 0.46, region: "MENA", note: "Import + gas mix" },
  Egypt: { tPerMWh: 0.48, region: "MENA", note: "Gas + oil; renewables growing" },
  Morocco: { tPerMWh: 0.55, region: "MENA", note: "Coal + renewables transition" },

  // Africa
  "South Africa": { tPerMWh: 0.90, region: "Africa", note: "Coal-heavy; high avoided-emissions potential" },
  Kenya: { tPerMWh: 0.18, region: "Africa", note: "Geothermal/hydro heavy — lower grid factor" },
  Nigeria: { tPerMWh: 0.44, region: "Africa", note: "Gas + limited grid access context" },
  Ghana: { tPerMWh: 0.38, region: "Africa", note: "Hydro + thermal" },
  Ethiopia: { tPerMWh: 0.12, region: "Africa", note: "Hydro-dominant" },

  // Asia-Pacific
  China: { tPerMWh: 0.58, region: "Asia-Pacific", note: "Coal still material; province-level varies" },
  Japan: { tPerMWh: 0.47, region: "Asia-Pacific", note: "LNG + nuclear/renewables mix" },
  "South Korea": { tPerMWh: 0.46, region: "Asia-Pacific", note: "Coal/LNG mix" },
  Indonesia: { tPerMWh: 0.75, region: "Asia-Pacific", note: "Coal-heavy" },
  Vietnam: { tPerMWh: 0.55, region: "Asia-Pacific", note: "Coal + hydro + gas" },
  Thailand: { tPerMWh: 0.46, region: "Asia-Pacific", note: "Gas + coal" },
  Philippines: { tPerMWh: 0.58, region: "Asia-Pacific", note: "Coal + geothermal" },
  Malaysia: { tPerMWh: 0.55, region: "Asia-Pacific", note: "Gas + coal" },
  Singapore: { tPerMWh: 0.41, region: "Asia-Pacific", note: "Gas-dominant city-state" },
  Australia: { tPerMWh: 0.55, region: "Asia-Pacific", note: "State NEM factors vary (coal → renewables)" },
  "New Zealand": { tPerMWh: 0.12, region: "Asia-Pacific", note: "Hydro/geothermal heavy" },

  // Europe
  "European Union": { tPerMWh: 0.25, region: "Europe", note: "EU average; country factors differ strongly" },
  Germany: { tPerMWh: 0.35, region: "Europe", note: "Coal exit + renewables" },
  "United Kingdom": { tPerMWh: 0.21, region: "Europe", note: "Gas + renewables" },
  France: { tPerMWh: 0.06, region: "Europe", note: "Nuclear-heavy — low grid factor" },
  Spain: { tPerMWh: 0.18, region: "Europe", note: "High renewables share" },
  Italy: { tPerMWh: 0.28, region: "Europe", note: "Gas + renewables" },
  Poland: { tPerMWh: 0.70, region: "Europe", note: "Coal-heavy" },
  Netherlands: { tPerMWh: 0.32, region: "Europe", note: "Gas + renewables" },
  Norway: { tPerMWh: 0.02, region: "Europe", note: "Hydro-dominant" },
  Turkey: { tPerMWh: 0.45, region: "Europe/MENA", note: "Coal + gas + hydro" },

  // Americas
  "United States": { tPerMWh: 0.38, region: "Americas", note: "National average; eGRID subregions vary a lot" },
  Canada: { tPerMWh: 0.12, region: "Americas", note: "Hydro-heavy national average" },
  Mexico: { tPerMWh: 0.42, region: "Americas", note: "Gas + oil + renewables" },
  Brazil: { tPerMWh: 0.10, region: "Americas", note: "Hydro-heavy" },
  Chile: { tPerMWh: 0.35, region: "Americas", note: "Thermal + renewables transition" },
  Colombia: { tPerMWh: 0.18, region: "Americas", note: "Hydro + thermal" },
  Argentina: { tPerMWh: 0.32, region: "Americas", note: "Gas + hydro" },

  // Global fallbacks
  "World Average": { tPerMWh: 0.48, region: "Global", note: "IEA-style order-of-magnitude average" },
  Custom: { tPerMWh: null, region: "Custom", note: "Enter your own grid factor" },
};

export const GWP100 = {
  CH4: 28, // IPCC AR5 approx commonly used in screening
  N2O: 265,
};

export const BIOCHAR_DEFAULTS = {
  carbonFraction: 0.75, // mass fraction carbon in biochar
  permanenceFactor: 0.8, // share considered durable over crediting horizon (screening)
};

const DISCLAIMER =
  "Indicative screening estimate only — not a methodology, not MRV, and not a registry issuance figure. Always verify with local grid inventories, project design documents, and an accredited standard (e.g. Verra, Gold Standard, ISO).";

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 2) {
  const f = 10 ** digits;
  return Math.round(num(value) * f) / f;
}

export function listCalcMarkets() {
  return Object.entries(GRID_FACTORS)
    .filter(([key]) => key !== "Custom")
    .map(([name, meta]) => ({
      name,
      region: meta.region,
      tPerMWh: meta.tPerMWh,
      note: meta.note,
    }))
    .sort((a, b) => {
      if (a.region === b.region) return a.name.localeCompare(b.name);
      return a.region.localeCompare(b.region);
    });
}

export function getGridFactor(market, customFactor) {
  if (customFactor !== undefined && customFactor !== null && customFactor !== "") {
    const c = num(customFactor, NaN);
    if (!Number.isFinite(c) || c < 0 || c > 2) {
      throw new Error("Custom grid factor must be between 0 and 2 tCO2e/MWh.");
    }
    return {
      market: market || "Custom",
      tPerMWh: c,
      region: "Custom",
      note: "User-supplied grid factor",
      source: "custom",
    };
  }

  const key = String(market || "").trim();
  const hit =
    GRID_FACTORS[key] ||
    Object.entries(GRID_FACTORS).find(
      ([name]) => name.toLowerCase() === key.toLowerCase()
    )?.[1];

  if (!hit || hit.tPerMWh == null) {
    throw new Error(
      "Select a market from the worldwide list, or enter a custom grid factor (tCO2e/MWh)."
    );
  }

  const resolvedName =
    GRID_FACTORS[key]
      ? key
      : Object.keys(GRID_FACTORS).find((n) => n.toLowerCase() === key.toLowerCase());

  return {
    market: resolvedName,
    tPerMWh: hit.tPerMWh,
    region: hit.region,
    note: hit.note,
    source: "library",
  };
}

/**
 * Solar / renewable avoided emissions → indicative tCO2e / year
 * annualMWh OR capacityMW × capacityFactor × 8760
 */
export function estimateSolarCredits(input = {}) {
  const {
    market = "World Average",
    customGridFactor,
    annualMWh,
    capacityMW,
    capacityFactor = 0.22,
    years = 1,
  } = input;

  const grid = getGridFactor(market, customGridFactor);
  let mwh = num(annualMWh, NaN);
  let method = "annual_mwh";

  if (!Number.isFinite(mwh) || mwh <= 0) {
    const mw = num(capacityMW, NaN);
    const cf = num(capacityFactor, NaN);
    if (!Number.isFinite(mw) || mw <= 0) {
      throw new Error("Enter annual generation (MWh) or capacity (MW).");
    }
    if (!Number.isFinite(cf) || cf <= 0 || cf > 1) {
      throw new Error("Capacity factor must be between 0 and 1 (e.g. 0.22 = 22%).");
    }
    mwh = mw * cf * 8760;
    method = "capacity_mw_cf";
  }

  const y = Math.max(1, Math.min(40, num(years, 1)));
  const tCO2ePerYear = mwh * grid.tPerMWh;
  const tCO2eTotal = tCO2ePerYear * y;

  return {
    type: "solar",
    title: "Renewable avoided-emissions estimate",
    market: grid.market,
    region: grid.region,
    inputs: {
      annualMWh: round(mwh, 1),
      capacityMW: capacityMW != null && capacityMW !== "" ? num(capacityMW) : null,
      capacityFactor: method === "capacity_mw_cf" ? num(capacityFactor) : null,
      years: y,
      gridFactor_tPerMWh: grid.tPerMWh,
    },
    formula:
      method === "capacity_mw_cf"
        ? "MWh/yr = MW × capacity factor × 8760;  tCO₂e/yr = MWh/yr × grid factor (t/MWh)"
        : "tCO₂e/yr = annual MWh × grid factor (t/MWh)",
    results: {
      tCO2ePerYear: round(tCO2ePerYear, 2),
      tCO2eTotal: round(tCO2eTotal, 2),
      unit: "tCO2e",
    },
    assumptions: [
      grid.note,
      "Assumes generation displaces average grid electricity (simplified OM/BM proxy).",
      "Does not prove additionality, leakage, or eligibility under a specific standard.",
    ],
    disclaimer: DISCLAIMER,
    askIntelligencePrompt: `Interpret this renewable credit screening for ${grid.market}: ~${round(
      tCO2ePerYear,
      1
    )} tCO2e/year using grid factor ${grid.tPerMWh} t/MWh. What diligence should I do for VCM / local rules?`,
  };
}

/**
 * Methane avoidance → tCO2e (GWP100)
 * methaneTonnes OR methaneM3 (approx density 0.000717 t/m3 at STP screening)
 */
export function estimateMethaneCredits(input = {}) {
  const {
    methaneTonnes,
    methaneM3,
    gwp = GWP100.CH4,
    captureEfficiency = 1,
    years = 1,
    market = "World Average",
  } = input;

  let tonnes = num(methaneTonnes, NaN);
  let method = "tonnes";
  if (!Number.isFinite(tonnes) || tonnes <= 0) {
    const m3 = num(methaneM3, NaN);
    if (!Number.isFinite(m3) || m3 <= 0) {
      throw new Error("Enter methane mass (tonnes) or volume (m³).");
    }
    tonnes = m3 * 0.000717;
    method = "m3";
  }

  const eff = num(captureEfficiency, 1);
  if (eff <= 0 || eff > 1) {
    throw new Error("Capture efficiency must be between 0 and 1.");
  }
  const g = num(gwp, GWP100.CH4);
  if (g <= 0 || g > 100) {
    throw new Error("GWP must be a positive screening value (e.g. 28).");
  }

  const y = Math.max(1, Math.min(40, num(years, 1)));
  const tCO2ePerYear = tonnes * eff * g;
  const tCO2eTotal = tCO2ePerYear * y;

  return {
    type: "methane",
    title: "Methane avoidance estimate (CO₂e)",
    market,
    region: getGridFactor(market in GRID_FACTORS ? market : "World Average").region,
    inputs: {
      methaneTonnes: round(tonnes, 4),
      methaneM3: method === "m3" ? num(methaneM3) : null,
      gwp100: g,
      captureEfficiency: eff,
      years: y,
    },
    formula:
      method === "m3"
        ? "CH₄ tonnes ≈ m³ × 0.000717;  tCO₂e = CH₄ tonnes × capture efficiency × GWP100"
        : "tCO₂e = CH₄ tonnes × capture efficiency × GWP100",
    results: {
      tCO2ePerYear: round(tCO2ePerYear, 2),
      tCO2eTotal: round(tCO2eTotal, 2),
      unit: "tCO2e",
    },
    assumptions: [
      `Default GWP100 ≈ ${GWP100.CH4} (IPCC AR5-style screening). Override if your methodology requires AR6.`,
      method === "m3" ? "m³→tonnes uses a simplified STP density factor." : null,
      "Does not replace project-specific baseline, destruction efficiency, or registry rules.",
    ].filter(Boolean),
    disclaimer: DISCLAIMER,
    askIntelligencePrompt: `Explain diligence for a methane-avoidance project (~${round(
      tCO2ePerYear,
      1
    )} tCO2e/year at GWP ${g}) in ${market}. What MRV and integrity checks matter worldwide?`,
  };
}

/**
 * Biochar rough removal estimate
 * biocharTonnes × carbonFraction × (44/12) × permanenceFactor
 */
export function estimateBiocharCredits(input = {}) {
  const {
    biocharTonnes,
    carbonFraction = BIOCHAR_DEFAULTS.carbonFraction,
    permanenceFactor = BIOCHAR_DEFAULTS.permanenceFactor,
    market = "World Average",
    years = 1,
  } = input;

  const tonnes = num(biocharTonnes, NaN);
  if (!Number.isFinite(tonnes) || tonnes <= 0) {
    throw new Error("Enter biochar mass (tonnes).");
  }
  const cf = num(carbonFraction, BIOCHAR_DEFAULTS.carbonFraction);
  const pf = num(permanenceFactor, BIOCHAR_DEFAULTS.permanenceFactor);
  if (cf <= 0 || cf > 1 || pf <= 0 || pf > 1) {
    throw new Error("Carbon fraction and permanence factor must be between 0 and 1.");
  }

  const y = Math.max(1, Math.min(40, num(years, 1)));
  // C → CO2 molecular weight ratio
  const tCO2ePerYear = tonnes * cf * (44 / 12) * pf;
  const tCO2eTotal = tCO2ePerYear * y;

  return {
    type: "biochar",
    title: "Biochar removal rough estimate",
    market,
    region: "Global",
    inputs: {
      biocharTonnes: tonnes,
      carbonFraction: cf,
      permanenceFactor: pf,
      years: y,
    },
    formula:
      "tCO₂e ≈ biochar tonnes × carbon fraction × (44/12) × permanence factor",
    results: {
      tCO2ePerYear: round(tCO2ePerYear, 2),
      tCO2eTotal: round(tCO2eTotal, 2),
      unit: "tCO2e",
    },
    assumptions: [
      "Screening chemistry only — feedstock, pyrolysis conditions, and soil permanence vary.",
      "Registry methodologies (e.g. biochar CDR) apply stricter tests than this sketch.",
    ],
    disclaimer: DISCLAIMER,
    askIntelligencePrompt: `Review this biochar screening (~${round(
      tCO2ePerYear,
      1
    )} tCO2e) for ${market}. What integrity and permanence issues should I check in global VCM markets?`,
  };
}

/** Credits × price → deal value (any currency label) */
export function estimateDealValue(input = {}) {
  const {
    credits,
    pricePerCredit,
    currency = "USD",
    market = "World Average",
  } = input;

  const vol = num(credits, NaN);
  const price = num(pricePerCredit, NaN);
  if (!Number.isFinite(vol) || vol <= 0) {
    throw new Error("Enter credit volume (tCO2e).");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Enter a non-negative price per credit.");
  }

  const total = vol * price;

  return {
    type: "dealValue",
    title: "Credit deal value",
    market,
    region: "Global",
    inputs: {
      credits: vol,
      pricePerCredit: price,
      currency: String(currency || "USD").toUpperCase(),
    },
    formula: "Deal value = credit volume (tCO₂e) × price per tCO₂e",
    results: {
      dealValue: round(total, 2),
      unit: String(currency || "USD").toUpperCase(),
      tCO2e: vol,
    },
    assumptions: [
      "Price is illustrative unless taken from a live contract.",
      "Does not include brokerage, verification, or delivery risk adjustments.",
    ],
    disclaimer: DISCLAIMER,
    askIntelligencePrompt: `How should I diligence a ${String(
      currency || "USD"
    ).toUpperCase()} ${round(total, 0)} carbon-credit deal for ${vol} tCO2e in ${market}?`,
  };
}

export function runCalculator(type, inputs = {}) {
  switch (String(type || "").toLowerCase()) {
    case "solar":
    case "renewable":
      return estimateSolarCredits(inputs);
    case "methane":
      return estimateMethaneCredits(inputs);
    case "biochar":
      return estimateBiocharCredits(inputs);
    case "deal":
    case "dealvalue":
    case "value":
      return estimateDealValue(inputs);
    default:
      throw new Error(
        "Unknown calculator. Use: solar, methane, biochar, or dealValue."
      );
  }
}

export function getCalculatorCatalog() {
  return {
    success: true,
    disclaimer: DISCLAIMER,
    coverage:
      "Worldwide screening library — South Asia, GCC/MENA, Africa, Asia-Pacific, Europe, Americas, plus World Average and custom factors.",
    calculators: [
      {
        id: "solar",
        name: "Renewable / solar avoided emissions",
        description:
          "Estimate indicative tCO₂e from MWh or MW × capacity factor using a country/region grid factor.",
      },
      {
        id: "methane",
        name: "Methane avoidance (CO₂e)",
        description: "Convert CH₄ tonnes or m³ to tCO₂e with GWP100.",
      },
      {
        id: "biochar",
        name: "Biochar removal (rough)",
        description: "Screening estimate from biochar mass, carbon fraction, and permanence.",
      },
      {
        id: "dealValue",
        name: "Deal value",
        description: "Credits × $/t (or other currency) for indicative contract value.",
      },
    ],
    markets: listCalcMarkets(),
    defaults: {
      gwp100_CH4: GWP100.CH4,
      biochar: BIOCHAR_DEFAULTS,
    },
  };
}
