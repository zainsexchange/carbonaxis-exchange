import { GREEN_KNOWLEDGE } from "./greenKnowledge.js";
import { getPlan } from "../config/plans.js";

const SYSTEM_BASE = `You are CarbonAxis Intelligence — the AI assistant of CarbonAxis Exchange.

## How you work (two strengths)
1) GENERAL MODE
- Answer normal everyday questions clearly, helpfully, and conversationally — like a strong general AI assistant.
- Be useful for business, research, writing, explanations, planning, education, and market basics.
- Keep a professional CarbonAxis tone, but do NOT force climate topics into unrelated questions.
- Do NOT push trading language unless the user explicitly asks about buying, selling, or market deals.

2) GREEN ENERGY / CLIMATE INTELLIGENCE (your signature strength — be outstanding here)
Trigger when the user asks about green energy, carbon credits, RECs, climate finance, ESG, net zero, renewable power, biochar, methane, hydrogen, CBAM, environmental regulation, project feasibility, policy risk, or climate-market analysis.

This mode is for many users — not traders only:
- researchers and students
- project developers and operators
- compliance / ESG / policy teams
- investors and market participants
- anyone exploring green energy or carbon markets

In this mode:
- If the user is ASKING TO LEARN / EXPLAIN (what is, explain, meaning, simple words): answer in clear natural language. Do NOT force a decision verdict template.
- If the user is ASKING ABOUT FEASIBILITY / REGULATION RISK / GO OR NO-GO: be decision-ready and lead with PROCEED | PROCEED_SHORT_TERM | CAUTION | AVOID, plus horizon analysis (months to 3–4 years). Trading is only one possible angle among analysis use-cases.
- Answer worldwide with honest confidence notes; deepest regional packs cover South Asia and GCC/MENA
- Make answers attractive, practical, and responsible
- Never invent fake statute numbers; if uncertain, say so
- Never claim guaranteed returns

## Product identity
CarbonAxis Exchange is a worldwide green-energy and climate-markets intelligence platform (with marketplace / credit discovery). Your expertise is green energy analysis, climate regulation outlook, and carbon-market understanding across global regions, with deepest packs for South Asia and GCC/MENA.

## Multilingual (required)
- Detect the language of the user's latest message and **reply in that same language**.
- Supported well: English, Urdu, Arabic, Hindi, French, Spanish, Portuguese, Chinese, German, Turkish, and other major languages the model knows.
- Keep CarbonAxis terms clear: when useful, keep product names (CarbonAxis, tCO₂e, REC, CBAM, Verra) in Latin script and explain them in the user's language.
- Do not switch to English unless the user writes in English or explicitly asks for English.
- For mixed-language questions, prefer the dominant language of the user message.
- Markdown headings/tables are fine in any language; keep formatting clean.

${GREEN_KNOWLEDGE}`;

/** Detect if text uses a non-Latin primary script (Arabic, CJK, Cyrillic, Devanagari, etc.) */
function hasNonLatinScript(text = "") {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0900-\u097F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(
    String(text || "")
  );
}

/**
 * Rough language hint for prompts + fallback messaging.
 * Returns ISO-ish label, not a perfect detector.
 */
function detectLanguageHint(text = "") {
  const t = String(text || "");
  if (/[\u0600-\u06FF]/.test(t)) {
    // Urdu often includes Arabic script + specific letters; treat Arabic-script as Arabic/Urdu family
    if (/[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06D2]/.test(t)) return "Urdu";
    return "Arabic";
  }
  if (/[\u0900-\u097F]/.test(t)) return "Hindi";
  if (/[\u4E00-\u9FFF]/.test(t)) return "Chinese";
  if (/[\u3040-\u30FF]/.test(t)) return "Japanese";
  if (/[\uAC00-\uD7AF]/.test(t)) return "Korean";
  if (/[\u0400-\u04FF]/.test(t)) return "Russian";
  const lower = t.toLowerCase();
  if (/\b(hola|gracias|qué|porque|mercado|energía|crédito)\b/.test(lower)) return "Spanish";
  if (/\b(bonjour|merci|énergie|crédit|marché|pourquoi)\b/.test(lower)) return "French";
  if (/\b(obrigado|energia|crédito|mercado|porque)\b/.test(lower)) return "Portuguese";
  if (/\b(danke|energie|kredit|markt|warum)\b/.test(lower)) return "German";
  if (/\b(teşekkür|enerji|karbon|piyasa)\b/.test(lower)) return "Turkish";
  if (/\b(kya|hai|carbon|solar|energy|credit|matlab|samjhao)\b/.test(lower) &&
      /\b(kya|hai|kaise|matlab|samjhao|batao|urdu)\b/.test(lower)) {
    return "Urdu (Roman)";
  }
  return "English";
}

const MULTILINGUAL_REPLY_RULE =
  "LANGUAGE RULE: Reply in the same language as the user's question. If the question is not in English, do not answer in English unless they asked for English.";

function isGreenEnergyQuestion(question = "", country = "", product = "") {
  const q = String(question || "").toLowerCase();
  const c = String(country || "").toLowerCase();
  const p = String(product || "").toLowerCase();
  const text = `${q} ${c} ${p}`;
  const raw = `${question} ${country} ${product}`;

  // English / latin climate topics
  const greenTopic =
    /green energy|climate|carbon|credit|rec\b|renewable|solar|wind|biochar|methane|hydrogen|net.?zero|esg|cbam|emission|co2|tco2|offset|nepra|aedb|otc|feasib|regulat|energy transition|voluntary carbon|vcu|sequestr|forestry|nature-based|clean energy|decarbon|grid factor|tco₂e|tco2e/.test(
      text
    );

  // Common non-English climate / energy terms (Arabic, Urdu/Hindi, Romance, etc.)
  const multilingualGreen =
    /كربون|طاقة|متجدد|شمسي|مناخ|ائتمان|انبعاث|هيدروجين|كهرباء|کاربن|توانائی|شمسی|ماحول|کریڈٹ|گرین|کاربن کریڈٹ|طاقة خضراء|طاقة متجددة|crédito|carbono|énergie|climatique|renouvelable|emisión|emissão|klima|karbon|enerji|可再生能源|碳信用|碳市场|기후|탄소/.test(
      raw
    ) ||
    /\b(carbono|crédito|créditos|renovable|renováveis|énergie|climatique|emisiones|emissions|karbon|enerji|yeşil|iklim)\b/i.test(
      text
    );

  // Non-Latin question that also mentions a known climate market / country in latin
  const scriptPlusMarket =
    hasNonLatinScript(raw) &&
    /(pakistan|oman|uae|saudi|india|europe|eu\b|cbam|solar|carbon|climate|green)/i.test(
      raw
    );

  // Country + green trade context (not “oman population”)
  const countryWithGreenIntent =
    /(pakistan|oman|uae|united arab emirates|saudi|india|europe|china|brazil|kenya)/.test(
      text
    ) &&
    /(trade|trading|credit|solar|wind|renew|regulat|feasib|carbon|green|energy|rec\b|invest|market|کربون|شمسی|توانائی)/.test(
      text
    );

  return (
    greenTopic ||
    multilingualGreen ||
    scriptPlusMarket ||
    countryWithGreenIntent ||
    Boolean(p && /solar|wind|biochar|methane|carbon|rec|hydrogen|renew/.test(p))
  );
}

function isHydrogenTaxonomyQuestion(question = "") {
  const q = String(question || "").toLowerCase();
  if (!/\bhydrogen\b|\bh2\b|هيدروجين|ہائیڈروجن/.test(q)) return false;
  return (
    /\b(type|types|color|colours|colors|kind|kinds|categor|classif|grey|gray|blue|green|pink|turquoise|yellow|white|brown|black|purple)\b/.test(
      q
    ) ||
    /\bhow many\b/.test(q) ||
    /\bwhat (is|are)\b/.test(q)
  );
}

function isExplainQuestion(question = "") {
  const q = String(question).toLowerCase();
  const raw = String(question || "");
  return (
    /^(what is|what's|whats|explain|define|meaning of|tell me about|how does|how do|simple words|in simple)/i.test(
      q.trim()
    ) ||
    /\b(explain|what are|what is|in simple words|eli5|basics of|samjhao|batao|matlab)\b/i.test(q) ||
    /(?:ما هو|ما هي|اشرح|شرح|يعني|کیا ہے|کیا ہیں|سمجھاؤ|بتاؤ|का क्या मतलब)/.test(raw)
  );
}

/** Policy / research overview — natural brief, not verdict template */
function isResearchQuestion(question = "") {
  const q = String(question).toLowerCase();
  return /\b(policy|policies|framework|strategy|roadmap|overview|research|analysis|brief|update|rules?|regulation|regulations|law|laws|how does .+ work)\b/.test(
    q
  ) && !/\b(should i|buy|sell|feasib|go\/no-go|proceed|invest now|restrict me)\b/.test(q);
}

/** Explicit go/no-go or deal decision — only then use verdict template */
function isDecisionQuestion(question = "", country = "", product = "") {
  const text = `${question} ${country} ${product}`.toLowerCase();
  return /\b(feasib|go\/?no-?go|should i|buy|sell|invest now|proceed|long.?term vs|short.?term only|otc deal|is it (safe|ok|good) to)\b/.test(
    text
  ) || /\b(restrict|outlook|risk)\b/.test(text) && /\b(for (this|my)|trade|trading|project|invest)\b/.test(text);
}

function isGeneralFactQuestion(question = "") {
  const q = String(question).toLowerCase();
  return /\b(population|capital|currency|language|president|prime minister|weather|time zone|gdp|area|who is|when did|where is|how many people|calculate)\b/.test(
    q
  );
}

function detectCountryFromText(question = "", country = "") {
  if (String(country || "").trim()) return String(country).trim();
  const q = String(question || "").toLowerCase();
  if (/\b(uae|united arab emirates|dubai|abu dhabi)\b/.test(q)) return "UAE";
  if (/\boman\b/.test(q)) return "Oman";
  if (/\bpakistan\b/.test(q)) return "Pakistan";
  if (/\bsaudi|ksa\b/.test(q)) return "Saudi Arabia";
  return "";
}

function buildSystemPrompt(planId, deepAnalysis, greenMode) {
  const plan = getPlan(planId);
  const modeBlock = greenMode
    ? `Active mode: GREEN ENERGY INTELLIGENCE (premium depth). Be especially strong and clear. Use verdict format ONLY for feasibility / regulation / go-no-go questions — not for simple explain questions. Do not overuse the word "trading".`
    : `Active mode: GENERAL. Answer helpfully like a capable general assistant. Do not mention trading or force climate topics unless the user asks.`;

  return `${SYSTEM_BASE}

User plan: ${plan.name}
Deep analysis mode: ${
    deepAnalysis
      ? "ON"
      : "OFF for free tier depth limits — still answer well; mention Pro for deeper regulatory briefs on green questions"
  }
Priority markets: ${plan.marketsPriority.join(", ")}
${modeBlock}
${MULTILINGUAL_REPLY_RULE}
`;
}

/**
 * Whether OpenAI is configured on the server (not whether the last call succeeded).
 */
export function getAiEngineStatus() {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

  if (apiKey) {
    return {
      status: "live",
      provider: "openai",
      label: "Live AI",
      model,
    };
  }

  return {
    status: "offline",
    provider: "local",
    label: "Offline mode",
    model: null,
  };
}

/**
 * Calls OpenAI chat completions if OPENAI_API_KEY is set.
 * Falls back to a deterministic local analysis when no key is configured,
 * so the product flow still works in demos.
 */
export async function runGreenIntelligence({
  question,
  country = "",
  product = "",
  subscription = "free",
  conversation = [],
}) {
  const plan = getPlan(subscription);
  const deepAnalysis = plan.deepAnalysis;
  const inferredCountry = detectCountryFromText(question, country);
  const decisionMode = isDecisionQuestion(question, inferredCountry, product);
  const explainMode = isExplainQuestion(question);
  const researchMode = isResearchQuestion(question);
  const generalFact = isGeneralFactQuestion(question);
  const hydrogenTaxonomy = isHydrogenTaxonomyQuestion(question);
  // General facts (population, capital, etc.) stay general even if a country is mentioned
  const greenMode =
    (!generalFact && isGreenEnergyQuestion(question, inferredCountry, product)) ||
    hydrogenTaxonomy;
  const languageHint = detectLanguageHint(question);
  const naturalGreen =
    greenMode &&
    (explainMode || researchMode || hydrogenTaxonomy) &&
    !decisionMode;
  const system = buildSystemPrompt(subscription, deepAnalysis, greenMode);

  let instruction;
  if (hydrogenTaxonomy) {
    instruction =
      "This is a HYDROGEN TYPES / COLORS taxonomy question. Answer completely: do NOT stop at only Grey, Blue, and Green. Cover the common industry palette including Grey, Blue, Green, Pink/Purple/Red (nuclear), Turquoise (methane pyrolysis), Yellow (mixed/grid electrolysis — note definitions vary), White (natural/geologic hydrogen), and Brown/Black (coal). State that color labels are industry shorthand, not one universal legal list. Always mention White hydrogen when types/colors are asked.";
  } else if (!greenMode) {
    instruction =
      "This is a GENERAL question. Answer clearly and helpfully like a strong general AI. Give the direct factual answer first when asked for population, capital, definitions, calculations, etc. Do NOT use Verdict/PROCEED templates. Do NOT mention trading or carbon markets unless the user asked.";
  } else if (naturalGreen) {
    instruction =
      "This is a GREEN ENERGY RESEARCH / POLICY / LEARNING question. Write a clear natural-language brief (like a strong analyst). Cover key points, known directions, and honest confidence. Do NOT use Verdict/PROCEED template. Do not sound trader-only.";
  } else if (decisionMode || (inferredCountry && product)) {
    instruction = deepAnalysis
      ? "This is a GREEN ENERGY feasibility / go-no-go analysis question. Deliver an outstanding research-style brief with clear verdict and horizon analysis. Focus on intelligence for any stakeholder — not traders only."
      : "This is a GREEN ENERGY feasibility / go-no-go analysis question. Deliver a sharp verdict-led brief. Note Pro unlocks deeper horizon analysis.";
  } else {
    instruction =
      "This is a GREEN ENERGY question. Answer naturally with strong climate-market insight for researchers, developers, policy users, and markets. Use verdict template only if a go/no-go decision is clearly implied.";
  }

  instruction = `${instruction} ${MULTILINGUAL_REPLY_RULE} Detected language hint: ${languageHint}.`;

  const userPayload = [
    inferredCountry ? `Focus country/market: ${inferredCountry}` : null,
    product ? `Product / activity / topic: ${product}` : null,
    `User language hint: ${languageHint}`,
    `User question: ${question}`,
    instruction,
  ]
    .filter(Boolean)
    .join("\n");

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();

  if (!apiKey) {
    return {
      provider: "local",
      answer: localFallbackAnalysis({
        question,
        country: inferredCountry,
        product,
        deepAnalysis,
        greenMode,
        explainMode,
        tradeMode: decisionMode,
        researchMode,
        generalFact,
        hydrogenTaxonomy,
        languageHint,
      }),
      deepAnalysis,
      plan: plan.id,
      mode: greenMode ? "green" : "general",
      language: languageHint,
    };
  }

  const messages = [
    { role: "system", content: system },
    ...conversation
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userPayload },
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: greenMode ? 0.4 : 0.6,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText.slice(0, 500));
      // Soft-fail: never show a hard crash to the user for provider issues
      return {
        provider: "local",
        answer: localFallbackAnalysis({
          question,
          country: inferredCountry,
          product,
          deepAnalysis,
          greenMode,
          explainMode,
          tradeMode: decisionMode,
          researchMode,
          generalFact,
          hydrogenTaxonomy,
          languageHint,
        }),
        deepAnalysis,
        plan: plan.id,
        mode: greenMode ? "green" : "general",
        language: languageHint,
      };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("Empty AI response");
    }

    return {
      provider: "openai",
      answer,
      deepAnalysis,
      plan: plan.id,
      mode: greenMode ? "green" : "general",
      language: languageHint,
    };
  } catch (err) {
    console.error("OpenAI request failed:", err?.message || err);
    return {
      provider: "local",
      answer: localFallbackAnalysis({
        question,
        country: inferredCountry,
        product,
        deepAnalysis,
        greenMode,
        explainMode,
        tradeMode: decisionMode,
        researchMode,
        generalFact,
        hydrogenTaxonomy,
        languageHint,
      }),
      deepAnalysis,
      plan: plan.id,
      mode: greenMode ? "green" : "general",
      language: languageHint,
    };
  }
}

function localCompareFallback({ countryA, countryB, product, deepAnalysis }) {
  const a = countryA;
  const b = countryB;
  const focus = product || "green energy / carbon-market activity";
  const depthOf = (c) =>
    /pakistan|oman|india|uae|saudi|gcc/i.test(c)
      ? "Higher (regional depth pack)"
      : /europe|united states|eu\b|germany|uk\b/i.test(c)
        ? "Medium–high (global coverage)"
        : "Directional (worldwide coverage)";

  return `**Market compare · ${a} vs ${b}**
**Focus:** ${focus}

### Snapshot
| Lens | ${a} | ${b} |
| --- | --- | --- |
| CarbonAxis depth | ${depthOf(a)} | ${depthOf(b)} |
| Policy / transition theme | Energy transition + voluntary carbon interest | Energy transition + voluntary carbon interest |
| Near-term feasibility | Case-by-case — permits, MRV, counterpart checks | Case-by-case — permits, MRV, counterpart checks |
| 1–4 year horizon | Greener / high-integrity assets more durable; high-emission activities tighter over time | Similar pressure path; pace differs by country policy |

### Where ${a} may be stronger
- Local project pipeline fit if aligned with renewables / verified climate outcomes
- Use deepest regional packs when that market is ${a}

### Where ${b} may be stronger
- Diversification of destination rules, buyer access, or industrial demand
- Cross-check export / CBAM-style exposure if credits or products leave the country

### Practical recommendation
Compare **documentation quality**, registry/methodology path, and regulatory horizon for *this specific* ${focus} — not country labels alone.
${deepAnalysis ? "Deep mode: dig into MRV, additionality, offtake, and destination-market rules next." : "Pro unlocks deeper horizon briefs."}

**Disclaimer:** Research brief only — not legal advice. Live OpenAI improves detail when connected.`;
}

/**
 * Side-by-side green-energy / climate market comparison.
 */
export async function compareMarkets({
  countryA,
  countryB,
  product = "",
  note = "",
  subscription = "free",
}) {
  const a = String(countryA || "").trim();
  const b = String(countryB || "").trim();
  const focus = String(product || "").trim();
  const extra = String(note || "").trim();

  if (!a || !b) {
    throw new Error("Two markets are required for comparison");
  }
  if (a.toLowerCase() === b.toLowerCase()) {
    throw new Error("Choose two different markets");
  }

  const plan = getPlan(subscription);
  const deepAnalysis = plan.deepAnalysis;
  const system = `${SYSTEM_BASE}

Active mode: MARKET COMPARE (research brief).
Compare green energy / climate / carbon-market conditions for two countries.
Do NOT use trading Verdict/PROCEED templates.
Write for researchers, project owners, policy/ESG teams, and market participants.
Prioritize deepest regional packs when those markets are selected; be honest about confidence levels elsewhere.
Deep analysis: ${deepAnalysis ? "ON — richer horizon and diligence notes" : "OFF — concise but useful; mention Pro for deeper briefs"}.
${MULTILINGUAL_REPLY_RULE}
`;

  const compareLang = detectLanguageHint(`${focus} ${extra}`);
  const userPayload = `Compare these markets for CarbonAxis Intelligence:

Market A: ${a}
Market B: ${b}
Focus activity / product (optional): ${focus || "general green energy & carbon markets"}
User note (optional): ${extra || "n/a"}
User language hint: ${compareLang}

Return a clear research brief with:
1) Short snapshot (markdown table OR clean bullets) covering policy direction, feasibility climate, 12–36 month horizon, CarbonAxis confidence
2) Where A is relatively stronger
3) Where B is relatively stronger
4) Shared risks / what to verify next
5) Practical recommendation (not legal advice)

Formatting rules:
- Use markdown headings with a space after hashes if needed (## Title), but prefer bold section titles like **Market Snapshot**
- Never leave raw ### / ## / # characters as visible text for end users
- Keep columns short and aligned in tables
- Keep language professional. Avoid sounding trader-only.
- ${MULTILINGUAL_REPLY_RULE} If the user note is in a non-English language, write the whole compare brief in that language.`;

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return {
      provider: "local",
      answer: localCompareFallback({
        countryA: a,
        countryB: b,
        product: focus,
        deepAnalysis,
      }),
      deepAnalysis,
      plan: plan.id,
      mode: "compare",
    };
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
        temperature: 0.35,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPayload },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI compare error:", response.status, errText.slice(0, 500));
      return {
        provider: "local",
        answer: localCompareFallback({
          countryA: a,
          countryB: b,
          product: focus,
          deepAnalysis,
        }),
        deepAnalysis,
        plan: plan.id,
        mode: "compare",
      };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new Error("Empty compare response");
    }

    return {
      provider: "openai",
      answer,
      deepAnalysis,
      plan: plan.id,
      mode: "compare",
    };
  } catch (err) {
    console.error("Compare request failed:", err?.message || err);
    return {
      provider: "local",
      answer: localCompareFallback({
        countryA: a,
        countryB: b,
        product: focus,
        deepAnalysis,
      }),
      deepAnalysis,
      plan: plan.id,
      mode: "compare",
    };
  }
}

export async function analyzeProjectForAI(project, subscription = "free") {
  const question = `Analyze this climate / carbon project for market opportunity, regulatory restriction risk, and listing readiness.

Project name: ${project.projectName}
Type: ${project.projectType}
Country: ${project.country}
Registry: ${project.registry || "n/a"}
Methodology: ${project.methodology || "n/a"}
Estimated credits: ${project.estimatedCredits || "n/a"}
Asking price: ${project.askingPrice || "n/a"} ${project.currency || ""}
Description: ${project.description || "n/a"}

Return:
1) Short aiSummary (max 120 words)
2) opportunityScore 0-100
3) riskScore 0-100
4) marketReadiness 0-100
5) timingSignal one of: LONG_TERM | SHORT_TERM | MIXED | AVOID
6) policyFlags as short bullet phrases
7) recommendedMarkets as country/region list
`;

  const result = await runGreenIntelligence({
    question,
    country: project.country || "",
    product: project.projectType || "",
    subscription,
  });

  // Best-effort parse of scores if model returns them; else heuristic.
  const text = result.answer;
  const opportunityScore = extractScore(text, "opportunity") ?? heuristicScore(project, "opportunity");
  const riskScore = extractScore(text, "risk") ?? heuristicScore(project, "risk");
  const marketReadiness = extractScore(text, "readiness") ?? heuristicScore(project, "readiness");
  const timingSignal = extractTiming(text) || heuristicTiming(project);

  return {
    opportunityScore,
    riskScore,
    marketReadiness,
    timingSignal,
    aiSummary: text.slice(0, 900),
    policyFlags: extractFlags(text),
    recommendedMarkets: recommendMarkets(project.country),
    lastAnalyzed: new Date(),
    rawProvider: result.provider,
  };
}

function extractScore(text, kind) {
  const patterns = {
    opportunity: /opportunity(?:Score)?\s*[:=]?\s*(\d{1,3})/i,
    risk: /risk(?:Score)?\s*[:=]?\s*(\d{1,3})/i,
    readiness: /(?:market)?readiness\s*[:=]?\s*(\d{1,3})/i,
  };
  const m = text.match(patterns[kind]);
  if (!m) return null;
  return Math.min(100, Math.max(0, Number(m[1])));
}

function extractTiming(text) {
  const m = text.match(/\b(LONG_TERM|SHORT_TERM|MIXED|AVOID|PROCEED_SHORT_TERM)\b/i);
  if (!m) return "";
  const v = m[1].toUpperCase();
  if (v === "PROCEED_SHORT_TERM") return "SHORT_TERM";
  return v;
}

function extractFlags(text) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^[-*•\d.\s]+/, "").trim())
    .filter((l) => /policy|regulat|restrict|permit|cbam|nepra|aedb|vision 2040/i.test(l));
  return lines.slice(0, 5);
}

function recommendMarkets(country = "") {
  const c = String(country).toLowerCase();
  if (c.includes("pakistan") || c.includes("پاک")) {
    return ["Pakistan", "GCC buyers", "Voluntary carbon market"];
  }
  if (c.includes("oman")) {
    return ["Oman", "UAE", "EU-linked exporters"];
  }
  return ["Pakistan", "Oman", "Global VCM"];
}

function heuristicScore(project, kind) {
  const type = String(project.projectType || "").toLowerCase();
  const country = String(project.country || "").toLowerCase();
  const hasRegistry = Boolean(project.registry);
  let base = 55;
  if (/solar|wind|renew|biochar|methane|removal|nature/.test(type)) base += 15;
  if (/coal|oil|diesel/.test(type)) base -= 25;
  if (country.includes("pakistan") || country.includes("oman")) base += 8;
  if (hasRegistry) base += 10;
  if (kind === "risk") return Math.min(100, Math.max(10, 100 - base + 10));
  if (kind === "readiness") return Math.min(100, Math.max(15, base - (hasRegistry ? 0 : 15)));
  return Math.min(100, Math.max(15, base));
}

function heuristicTiming(project) {
  const type = String(project.projectType || "").toLowerCase();
  if (/coal|oil|diesel|brown/.test(type)) return "SHORT_TERM";
  if (/hydrogen|removal|biochar|solar|wind/.test(type)) return "LONG_TERM";
  return "MIXED";
}

function localFallbackAnalysis({
  question,
  country,
  product,
  deepAnalysis,
  greenMode = true,
  explainMode = false,
  tradeMode = false,
  researchMode = false,
  generalFact = false,
  hydrogenTaxonomy = false,
  languageHint = "English",
}) {
  const q = String(question || "");
  const detected = detectCountryFromText(q, country);
  const nonEnglish = languageHint !== "English";

  const langNote = nonEnglish
    ? `\n\n---\n**Language note:** You asked in **${languageHint}**. Full multilingual replies need OpenAI connected on the server. This offline fallback is in English — connect \`OPENAI_API_KEY\` on Render for native ${languageHint} answers.\n`
    : "";

  if (hydrogenTaxonomy || isHydrogenTaxonomyQuestion(q)) {
    return `Hydrogen “colors” are **industry shorthand** for production pathways — not one universal legal list. Grey / Blue / Green are the most cited trio, but they are **not** the complete set.

Common types:

1. **Grey** — fossil (often steam methane reforming) without CO₂ capture  
2. **Blue** — fossil with CCUS / carbon capture  
3. **Green** — electrolysis powered by renewables  
4. **Pink / Purple / Red** — electrolysis powered by nuclear electricity  
5. **Turquoise** — methane pyrolysis (hydrogen + solid carbon)  
6. **Yellow** — electrolysis using mixed / grid power (definitions vary by source)  
7. **White** — naturally occurring geologic / subsurface hydrogen  
8. **Brown / Black** — from coal gasification (high-emission pathways)

**White hydrogen** specifically means natural geologic hydrogen, not a manufactured “color” from renewables.

If you need the list from a particular official strategy PDF, ask with the country/document name and Carbon Brain can cite library evidence separately.${langNote}`;
  }

  // GENERAL MODE — answer facts plainly (no verdict template)
  if (!greenMode || generalFact) {
    if (/oman/i.test(q) && /population|people|how many/i.test(q)) {
      return `Yes — about **Oman’s population**:

Recent estimates put Oman’s population at roughly **4.5 to 5.2 million** people (including residents and expatriates; figures vary by year and source).

For the most current official number, check Oman’s National Centre for Statistics and Information (NCSI).

If you meant Oman **green energy / carbon-market** potential instead, ask that next and I’ll go deeper.${langNote}`;
    }

    if (/pakistan/i.test(q) && /population|people|how many/i.test(q)) {
      return `Yes — about **Pakistan’s population**:

Pakistan’s population is roughly **240+ million** people (approximate recent estimates; it changes with each census/update).

For official figures, use the Pakistan Bureau of Statistics.

Want Pakistan’s **green energy or carbon-credit** angle instead? Ask and I’ll switch to specialty mode.${langNote}`;
    }

    if (/oman/i.test(q) && /capital/i.test(q)) {
      return `**Muscat** is the capital of Oman.${langNote}`;
    }

    if (/pakistan/i.test(q) && /capital/i.test(q)) {
      return `**Islamabad** is the capital of Pakistan.${langNote}`;
    }

    if (/sohar/i.test(q) && /oman/i.test(q)) {
      return `**Sohar** is a major port city in northern Oman (Al Batinah / North Al Batinah area), northwest of Muscat.

It’s known for:
- the large **Port of Sohar** and industrial / free-zone activity
- shipping, logistics, metals, and energy-related industry
- being one of Oman’s important commercial hubs outside the capital

If you meant something more specific (history, port, industry, or green-energy angle in Sohar), ask a follow-up and I’ll go deeper.${langNote}`;
    }

    if (nonEnglish) {
      return `I received your question in **${languageHint}**.

Offline mode can only reply in English right now. Please ask again after OpenAI is connected on the server, or rewrite the question in English.

**Your question:** ${q}

CarbonAxis specialty topics (in English for now):
- green energy & climate explanations
- country / market research worldwide
- project or regulation feasibility analysis${langNote}`;
    }

    return `I can help with general questions too.

**Your question:** ${q}

I couldn’t pull a live data answer for that in this session. Try a clear fact question I can cover offline, or ask a CarbonAxis specialty question:

- green energy & climate explanations
- country / market research worldwide (deepest packs: South Asia & GCC/MENA)
- project or regulation feasibility analysis

Examples:
- “What is the capital of Oman?”
- “Explain carbon credits in simple words”
- “Is solar in Oman realistic for the next 5 years under green policy?”`;
  }

  // Research / policy / learn — natural brief (NOT verdict template)
  if ((explainMode || researchMode) && !tradeMode) {
    if (/(uae|united arab emirates)/i.test(q) && /carbon|climate|green|esg|net.?zero|policy/i.test(q)) {
      return `**UAE carbon / climate policy — short research brief**

The UAE is advancing a national climate and energy-transition agenda. In practical terms:

**What it is aiming for**
- Net-zero style pathway and cleaner energy mix over time
- Large renewable build-out (especially solar)
- Growing interest in hydrogen and industrial decarbonization
- Stronger ESG / climate reporting expectations for companies and projects

**Carbon-market angle**
- Voluntary carbon market activity is rising across the region
- High-integrity credits (clear MRV, additionality, registry path) matter more than quantity alone
- Export-linked projects may feel destination-market pressure (e.g. EU CBAM-style rules)

**CarbonAxis confidence note**
CarbonAxis has deepest regional packs for South Asia and GCC/MENA. For UAE we can give solid directional research, but treat details as changing — always verify against current UAE government and authority publications.

**Useful next questions**
- “Compare UAE vs Oman renewable strategy”
- “What should a UAE solar project check for carbon-credit readiness?”
- “Is this UAE project feasible long term under green regulation?” (for a go/no-go style brief)${langNote}`;
    }

    if (/carbon credit/i.test(q)) {
      return `Carbon credits, in simple words:

A carbon credit is like a certificate that represents **1 tonne of CO₂e** reduced or removed from the atmosphere.

**How it works**
1. A climate project (solar, biochar, methane capture, forestry, etc.) proves it cut or removed emissions.
2. After verification, credits can be issued.
3. A company that still produces emissions can buy those credits to support climate action and report progress toward climate goals.

**Why people care**
- Organizations want credible climate impact and reporting.
- Project owners can unlock value from verified reductions/removals.
- Markets and regulators need transparency, quality, and clear rules.

**CarbonAxis angle**
CarbonAxis helps people understand and work with verified climate assets — with stronger intelligence around green regulation and markets like **Pakistan** and **Oman**.

Ask a next question like:
“Is solar in Oman realistic for the next 5 years under green policy?”${langNote}`;
    }

    return `Here’s a research-style answer to your question:

**${q}**
${detected ? `\n**Focus market:** ${detected}\n` : ""}
In plain terms: green energy and climate-policy topics cover cleaner power, emissions rules, project readiness, and verified climate results (like carbon credits).

CarbonAxis is strongest on **Pakistan** and **Oman**, with useful worldwide coverage including UAE/GCC themes.

Ask a more specific follow-up (country + topic + time horizon) and I’ll go deeper.${langNote}`;
  }

  const c = (detected || "the selected market").trim() || "the selected market";
  const p = (product || "this activity").trim() || "this activity";
  const focus = /pakistan/i.test(c)
    ? "Pakistan renewable / carbon pathways (NEPRA/AEDB direction, voluntary credit integrity, permitting)"
    : /oman/i.test(c)
      ? "Oman Vision 2040 / energy transition and export-linked green pressure"
      : /uae/i.test(c)
        ? "UAE energy transition / net-zero direction and voluntary carbon market practice (moderate confidence)"
        : "global green-energy and voluntary carbon market practice (lower confidence outside PK/OM)";

  const looksDirty = /coal|crude|diesel|furnace oil|petcoke/i.test(`${p} ${q}`);
  const looksGreenAsset = /solar|wind|hydrogen|biochar|methane|renewable|carbon credit|REC/i.test(
    `${p} ${q}`
  );

  let verdict = "CAUTION";
  let horizon = "Review case-by-case over the next 12–36 months.";
  if (looksGreenAsset) {
    verdict = "PROCEED";
    horizon = "Likely longer-horizon alignment (multi-year), subject to verification quality.";
  } else if (looksDirty) {
    verdict = "PROCEED_SHORT_TERM";
    horizon =
      "May remain workable near-term, but green regulation / financing pressure can tighten within months to ~3–4 years.";
  }

  const depthNote = deepAnalysis
    ? "Deep mode: expand diligence on registry, MRV, contracts, and destination-market rules (e.g. CBAM-like exposure)."
    : "Basic mode: upgrade to Pro for deeper regulatory horizon briefs and project scoring.";

  return `**Verdict:** ${verdict}
**Country / market:** ${c}
**Product / activity:** ${p}
**Current feasibility:** Directionally workable if documentation, permits, and counterpart checks are clean. Focus lens: ${focus}.
**Green regulation outlook:** ${horizon}
**Why this timing:** CarbonAxis covers worldwide markets with deepest regional packs for South Asia and GCC/MENA. Activities aligned with renewables / high-integrity credits tend to be longer-term; high-emission or soon-to-be-restricted activities may be short-term only.
**User question addressed:** ${q}
**CarbonAxis recommendation:** ${
    verdict === "PROCEED"
      ? "Pursue with verification-first structuring."
      : verdict === "PROCEED_SHORT_TERM"
        ? "Near-term only — plan for regulatory change risk."
        : "Gather more activity/country specifics before a final recommendation."
  }
**Notes:** ${depthNote}
**Disclaimer:** Not legal advice.${langNote}`;
}
