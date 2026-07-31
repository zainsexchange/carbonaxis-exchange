function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COMPARISON_WORDS = [
  "compare",
  "comparison",
  "compared",
  "versus",
  "vs",
  "than",
  "while",
  "whereas",
  "however",
  "both",
  "either",
  "more",
  "less",
  "higher",
  "lower",
  "better",
  "worse",
  "stronger",
  "weaker",
  "similar",
  "different"
];

const ANALYSIS_WORDS = [
  "analysis",
  "conclusion",
  "overall",
  "therefore",
  "indicates",
  "suggests",
  "demonstrates",
  "shows",
  "implies",
  "reflects",
  "prioritizes",
  "focuses",
  "vision",
  "timeline",
  "strategy",
  "specific",
  "broader",
  "immediate"
];

export function classifyReasoning({
  claim = "",
  supportingEvidence = []
}) {

  const text =
    normalize(claim);

  const evidenceCount =
    supportingEvidence.length;

  const maxSupport =
    Math.max(
      ...supportingEvidence.map(
        e => e.supportPercentage || 0
      ),
      0
    );

  const comparison =
    COMPARISON_WORDS.some(word =>
      text.includes(word)
    );

  const analysis =
    ANALYSIS_WORDS.some(word =>
      text.includes(word)
    );

  // Exact textual support
  if (maxSupport >= 80) {
    return {
      type: "direct",
      label: "Direct Evidence",
      confidence: "high"
    };
  }

  // Multi-document reasoning
  if (
    evidenceCount >= 2 &&
    (comparison || analysis)
  ) {
    return {
      type: "synthesized",
      label: "Synthesized Conclusion",
      confidence: "high"
    };
  }

  // Strong inference
  if (maxSupport >= 45) {
    return {
      type: "inferred",
      label: "Supported Inference",
      confidence: "medium"
    };
  }

  // Weak inference
  if (
    evidenceCount > 0 &&
    maxSupport >= 30
  ) {
    return {
      type: "inferred",
      label: "Supported Inference",
      confidence: "low"
    };
  }

  return {
    type: "unsupported",
    label: "Unsupported",
    confidence: "low"
  };

}