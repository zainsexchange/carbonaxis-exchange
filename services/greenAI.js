import { GREEN_KNOWLEDGE } from "./greenKnowledge.js";
import { getPlan } from "../config/plans.js";

const SYSTEM_BASE = `You are CarbonAxis Intelligence — the AI assistant of CarbonAxis Exchange.

## How you work (two strengths)
1) GENERAL MODE
- Answer normal everyday questions clearly, helpfully, and conversationally — like a strong general AI assistant.
- Be useful for business, research, writing, explanations, planning, and market basics.
- Keep a professional CarbonAxis tone, but do NOT force climate topics into unrelated questions.

2) GREEN ENERGY / CLIMATE MODE (your signature strength — be outstanding here)
Trigger when the user asks about green energy, carbon credits, RECs, climate finance, ESG, net zero, renewable power, biochar, methane, hydrogen, CBAM, environmental regulation, trading feasibility in climate markets, or restriction risk.

In this mode:
- If the user is ASKING TO LEARN / EXPLAIN (what is, explain, meaning, simple words): answer in clear natural language. Do NOT force a trading verdict template.
- If the user is ASKING ABOUT TRADING / FEASIBILITY / REGULATION RISK: be decision-ready and lead with PROCEED | PROCEED_SHORT_TERM | CAUTION | AVOID, plus horizon analysis (months to 3–4 years).
- Prioritize Pakistan and Oman depth; still answer worldwide with honest confidence notes
- Make answers attractive, practical, and responsible
- Never invent fake statute numbers; if uncertain, say so
- Never claim guaranteed returns

## Product identity
CarbonAxis Exchange is a carbon credits / climate markets platform. Your deepest expertise is green energy and climate-regulation advisory, especially Pakistan and Oman.

${GREEN_KNOWLEDGE}`;

function isGreenEnergyQuestion(question = "", country = "", product = "") {
  const q = String(question || "").toLowerCase();
  const c = String(country || "").toLowerCase();
  const p = String(product || "").toLowerCase();
  const text = `${q} ${c} ${p}`;

  // Green / climate topics only — do NOT treat country names alone as green questions
  const greenTopic =
    /green energy|climate|carbon|credit|rec\b|renewable|solar|wind|biochar|methane|hydrogen|net.?zero|esg|cbam|emission|co2|tco2|offset|nepra|aedb|otc|feasib|regulat|energy transition|voluntary carbon|vcu|sequestr|forestry|nature-based|clean energy|decarbon/.test(
      text
    );

  // Country + green trade context (not “oman population”)
  const countryWithGreenIntent =
    /(pakistan|oman|uae|united arab emirates)/.test(text) &&
    /(trade|trading|credit|solar|wind|renew|regulat|feasib|carbon|green|energy|rec\b|invest|market)/.test(
      text
    );

  return greenTopic || countryWithGreenIntent || Boolean(p && /solar|wind|biochar|methane|carbon|rec|hydrogen|renew/.test(p));
}

function isExplainQuestion(question = "") {
  const q = String(question).toLowerCase();
  return /^(what is|what's|whats|explain|define|meaning of|tell me about|how does|how do|simple words|in simple)/i.test(
    q.trim()
  ) || /\b(explain|what are|what is|in simple words|eli5|basics of)\b/i.test(q);
}

function isTradeDecisionQuestion(question = "", country = "", product = "") {
  const text = `${question} ${country} ${product}`.toLowerCase();
  return /feasib|trade|trading|buy|sell|invest|restrict|regulat|long.?term|short.?term|otc|should i|is it (safe|ok|good)|proceed|outlook|risk/.test(
    text
  );
}

function isGeneralFactQuestion(question = "") {
  const q = String(question).toLowerCase();
  return /\b(population|capital|currency|language|president|prime minister|weather|time zone|gdp|area|who is|when did|where is|how many people)\b/.test(
    q
  );
}

function buildSystemPrompt(planId, deepAnalysis, greenMode) {
  const plan = getPlan(planId);
  const modeBlock = greenMode
    ? `Active mode: GREEN ENERGY (premium depth). Be especially strong and clear. Use verdict format ONLY for trading/feasibility questions — not for simple explain questions.`
    : `Active mode: GENERAL. Answer helpfully like a capable general assistant. If useful, you may briefly mention CarbonAxis context, but do not force it.`;

  return `${SYSTEM_BASE}

User plan: ${plan.name}
Deep analysis mode: ${
    deepAnalysis
      ? "ON"
      : "OFF for free tier depth limits — still answer well; mention Pro for deeper regulatory briefs on green questions"
  }
Priority markets: ${plan.marketsPriority.join(", ")}
${modeBlock}
`;
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
  const tradeMode = isTradeDecisionQuestion(question, country, product);
  const explainMode = isExplainQuestion(question);
  const generalFact = isGeneralFactQuestion(question);
  // General facts (population, capital, etc.) stay general even if a country is mentioned
  const greenMode =
    !generalFact && isGreenEnergyQuestion(question, country, product);
  const system = buildSystemPrompt(subscription, deepAnalysis, greenMode);

  let instruction;
  if (!greenMode) {
    instruction =
      "This is a GENERAL question. Answer clearly and helpfully like a strong general AI. Give the direct factual answer first when asked for population, capital, definitions, etc. Do NOT use trading Verdict/PROCEED templates.";
  } else if (explainMode && !tradeMode) {
    instruction =
      "This is a GREEN ENERGY LEARNING question. Explain clearly in natural language (like a great tutor). Do NOT use Verdict/PROCEED template.";
  } else if (tradeMode || (country && product)) {
    instruction = deepAnalysis
      ? "This is a GREEN ENERGY trading/feasibility question. Deliver an outstanding regulatory/trading brief with clear verdict and horizon analysis."
      : "This is a GREEN ENERGY trading/feasibility question. Deliver a sharp verdict-led brief. Note Pro unlocks deeper horizon analysis.";
  } else {
    instruction =
      "This is a GREEN ENERGY question. Answer naturally and helpfully with strong climate-market insight. Use verdict template only if a trading decision is implied.";
  }

  const userPayload = [
    country ? `Focus country/market: ${country}` : null,
    product ? `Product / trade item: ${product}` : null,
    `User question: ${question}`,
    instruction,
  ]
    .filter(Boolean)
    .join("\n");

  if (!process.env.OPENAI_API_KEY) {
    return {
      provider: "local",
      answer: localFallbackAnalysis({
        question,
        country,
        product,
        deepAnalysis,
        greenMode,
        explainMode,
        tradeMode,
        generalFact,
      }),
      deepAnalysis,
      plan: plan.id,
      mode: greenMode ? "green" : "general",
    };
  }

  const messages = [
    { role: "system", content: system },
    ...conversation
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userPayload },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
    console.error("OpenAI error:", errText);
    throw new Error("AI provider request failed");
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
  };
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
  generalFact = false,
}) {
  const q = String(question || "");

  // GENERAL MODE — answer facts plainly (no trading template)
  if (!greenMode || generalFact) {
    if (/oman/i.test(q) && /population|people|how many/i.test(q)) {
      return `Yes — about **Oman’s population**:

Recent estimates put Oman’s population at roughly **4.5 to 5.2 million** people (including residents and expatriates; figures vary by year and source).

For the most current official number, check Oman’s National Centre for Statistics and Information (NCSI).

If you meant Oman **green energy / carbon-market** potential instead, ask that next and I’ll go deeper.`;
    }

    if (/pakistan/i.test(q) && /population|people|how many/i.test(q)) {
      return `Yes — about **Pakistan’s population**:

Pakistan’s population is roughly **240+ million** people (approximate recent estimates; it changes with each census/update).

For official figures, use the Pakistan Bureau of Statistics.

Want Pakistan’s **green energy or carbon-credit** angle instead? Ask and I’ll switch to specialty mode.`;
    }

    if (/oman/i.test(q) && /capital/i.test(q)) {
      return `**Muscat** is the capital of Oman.`;
    }

    if (/pakistan/i.test(q) && /capital/i.test(q)) {
      return `**Islamabad** is the capital of Pakistan.`;
    }

    return `I can answer general questions too.

**Your question:** ${q}

Right now the server is running in **backup mode** (no live AI model key configured), so I can only answer a limited set of general facts offline.

Once **OPENAI_API_KEY** is added on Render, I’ll answer general questions fully (population, news-style facts, writing help, etc.) and stay strongest on green energy.

Try asking something like:
- “What is the capital of Oman?”
- “Explain carbon credits in simple words”
- “Is solar REC trading in Oman feasible long term?”`;
  }

  // Learning / explain questions should sound natural — not a trading template
  if (explainMode && !tradeMode) {
    if (/carbon credit/i.test(q)) {
      return `Carbon credits, in simple words:

A carbon credit is like a certificate that represents **1 tonne of CO₂e** reduced or removed from the atmosphere.

**How it works**
1. A climate project (solar, biochar, methane capture, forestry, etc.) proves it cut or removed emissions.
2. After verification, credits can be issued.
3. A company that still produces emissions can buy those credits to support climate action and report progress toward climate goals.

**Why people care**
- Buyers want credible climate impact.
- Project owners earn value from verified reductions/removals.
- Markets need transparency, quality, and clear rules.

**CarbonAxis angle**
CarbonAxis helps discover and trade verified climate assets — with stronger intelligence around green regulation and markets like **Pakistan** and **Oman**.

If you want, ask a next question like:
“Is solar REC trading in Oman feasible long term?”`;
    }

    return `Here’s a simple green-energy answer to your question:

**${q}**

In plain terms: green energy and carbon-market topics are about cutting emissions, using cleaner power, and sometimes trading verified climate results (like carbon credits).

I can go deeper on:
- simple definitions
- country rules (especially Pakistan & Oman)
- whether a product looks long-term or short-term under green regulation

Ask me a more specific follow-up and I’ll answer clearly.`;
  }

  const c = (country || "the selected market").trim() || "the selected market";
  const p = (product || "this activity").trim() || "this activity";
  const focus = /pakistan/i.test(c)
    ? "Pakistan renewable / carbon pathways (NEPRA/AEDB direction, voluntary credit integrity, permitting)"
    : /oman/i.test(c)
      ? "Oman Vision 2040 / energy transition and export-linked green pressure"
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
      "May remain tradeable near-term, but green regulation / financing pressure can tighten within months to ~3–4 years.";
  }

  const depthNote = deepAnalysis
    ? "Deep mode: expand diligence on registry, MRV, offtake contracts, and destination-market rules (e.g. CBAM-like exposure)."
    : "Basic mode: upgrade to Pro for deeper regulatory horizon briefs and project scoring.";

  return `**Verdict:** ${verdict}
**Country / market:** ${c}
**Product / activity:** ${p}
**Current feasibility:** Directionally workable if documentation, permits, and counterparty checks are clean. Focus lens: ${focus}.
**Green regulation outlook:** ${horizon}
**Why this timing:** CarbonAxis prioritizes Pakistan & Oman depth first, then worldwide. Products aligned with renewables / high-integrity credits tend to be longer-term; high-emission or soon-to-be-restricted activities may be short-term only.
**User question addressed:** ${q}
**CarbonAxis recommendation:** ${
    verdict === "PROCEED"
      ? "Pursue with verification-first structuring."
      : verdict === "PROCEED_SHORT_TERM"
        ? "Tradeable near-term only — size positions for regulatory change risk."
        : "Gather more product/country specifics before committing capital."
  }
**Notes:** ${depthNote}
**Disclaimer:** Not legal advice.`;
}
