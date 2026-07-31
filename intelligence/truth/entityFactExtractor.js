function normalizeText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEntity(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim();
}

function resolveDocumentEntity(item = {}) {
  return normalizeText(
    item.country ||
    item.document?.country ||
    item.metadata?.country ||
    item.document?.metadata?.country ||
    item.jurisdiction ||
    item.document?.jurisdiction ||
    ""
  );
}

function extractNumbers(text = "") {
  const matches =
    String(text || "").match(
      /\b(?:USD\s*)?\d[\d,]*(?:\.\d+)?\s*(?:%|GW|MW|billion|million|tonnes?|tons?|years?)?\b/gi
    ) || [];

  return [
    ...new Set(
      matches.map((value) =>
        normalizeText(value)
      )
    ),
  ];
}

function splitEvidenceIntoSentences(content = "") {
  const normalized =
    String(content || "")
      .replace(/\u0000/g, "")
      .replace(/\r\n/g, "\n")
      .trim();

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) =>
      normalizeText(
        sentence
          .replace(/^\s*[-•]\s*/, "")
      )
    )
    .filter((sentence) =>
      sentence.length >= 15
    );
}

function detectTopic(text = "") {
  const normalized =
    normalizeText(text).toLowerCase();

  const topicRules = [
    {
      topic: "renewable_target",
      terms: [
        "renewable share",
        "renewable electricity",
        "renewable generation",
        "electricity generation",
      ],
    },
    {
      topic: "solar_capacity",
      terms: [
        "solar capacity",
        "solar",
      ],
    },
    {
      topic: "wind_capacity",
      terms: [
        "wind capacity",
        "wind",
      ],
    },
    {
      topic: "investment",
      terms: [
        "investment",
        "climate finance",
        "green bonds",
        "finance",
      ],
    },
    {
      topic: "hydrogen",
      terms: [
        "hydrogen",
        "green hydrogen",
        "renewable hydrogen",
      ],
    },
    {
      topic: "transport",
      terms: [
        "electric vehicle",
        "clean transport",
        "public transport",
        "transport",
      ],
    },
    {
      topic: "industry",
      terms: [
        "industrial efficiency",
        "industry",
        "industrial",
      ],
    },
    {
      topic: "carbon_market",
      terms: [
        "carbon market",
        "carbon registry",
        "registry",
        "mrv",
      ],
    },
    {
      topic: "net_zero",
      terms: [
        "net zero",
        "net-zero",
        "emissions reduction",
      ],
    },
  ];

  for (const rule of topicRules) {
    if (
      rule.terms.some((term) =>
        normalized.includes(term)
      )
    ) {
      return rule.topic;
    }
  }

  return "general";
}

function buildFact({
  entity,
  citationId,
  documentId,
  chunkId,
  chunkIndex,
  sentence,
  evidenceScore,
  semanticScore,
}) {
  return {
    entity,
    entityKey:
      normalizeEntity(entity),

    topic:
      detectTopic(sentence),

    statement:
      sentence,

    numbers:
      extractNumbers(sentence),

    citationId:
      citationId || null,

    documentId:
      documentId || null,

    chunkId:
      chunkId || null,

    chunkIndex:
      Number.isInteger(chunkIndex)
        ? chunkIndex
        : null,

    evidenceScore:
      Number(evidenceScore || 0),

    semanticScore:
      Number(semanticScore || 0),
  };
}

export function extractEntityFacts(
  evidence = []
) {
  const facts = [];

  evidence.forEach((item, index) => {
    const entity =
      resolveDocumentEntity(item);

    if (!entity) {
      return;
    }

    const citationId =
      item.citationId ||
      `CA-${String(index + 1).padStart(
        3,
        "0"
      )}`;

    const documentId =
      item.document?._id ||
      item.documentId ||
      null;

    const chunkId =
      item._id ||
      item.chunkId ||
      null;

    const sentences =
      splitEvidenceIntoSentences(
        item.content || ""
      );

    sentences.forEach((sentence) => {
      facts.push(
        buildFact({
          entity,
          citationId,
          documentId,
          chunkId,
          chunkIndex:
            item.chunkIndex,
          sentence,
          evidenceScore:
            item.evidenceScore,
          semanticScore:
            item.semanticScore,
        })
      );
    });
  });

  return facts;
}

export function groupFactsByEntity(
  facts = []
) {
  return facts.reduce(
    (groups, fact) => {
      const key =
        fact.entityKey ||
        "unknown";

      if (!groups[key]) {
        groups[key] = {
          entity:
            fact.entity ||
            "Unknown",

          facts: [],
        };
      }

      groups[key].facts.push(fact);

      return groups;
    },
    {}
  );
}

export function groupFactsByTopic(
  facts = []
) {
  return facts.reduce(
    (groups, fact) => {
      const topic =
        fact.topic ||
        "general";

      if (!groups[topic]) {
        groups[topic] = [];
      }

      groups[topic].push(fact);

      return groups;
    },
    {}
  );
}