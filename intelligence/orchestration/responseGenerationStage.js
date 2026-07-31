import generateCarbonBrainResponse from "../services/generateCarbonBrainResponse.js";

const DEFAULT_MAXIMUM_CONTEXT_CHARACTERS =
  30_000;

function normalizeConversation(
  conversation = [],
) {
  if (!Array.isArray(conversation)) {
    return [];
  }

  return conversation
    .filter((message) =>
      ["user", "assistant"].includes(
        message?.role,
      ),
    )
    .map((message) => ({
      role:
        message.role,

      content:
        String(
          message.content || "",
        )
          .replace(/\u0000/g, "")
          .trim()
          .slice(0, 4000),
    }))
    .filter((message) =>
      message.content,
    )
    .slice(-6);
}

function buildConversationContext(
  conversation = [],
) {
  const normalizedConversation =
    normalizeConversation(
      conversation,
    );

  if (!normalizedConversation.length) {
    return "No previous conversation was supplied.";
  }

  return normalizedConversation
    .map(
      (message) =>
        `${message.role.toUpperCase()}: ${message.content}`,
    )
    .join("\n\n");
}

function buildEvidenceContext(
  evidence = [],
  maximumCharacters =
    DEFAULT_MAXIMUM_CONTEXT_CHARACTERS,
) {
  if (!Array.isArray(evidence)) {
    return "";
  }

  let usedCharacters = 0;

  const blocks = [];

  for (
    let index = 0;
    index < evidence.length;
    index += 1
  ) {
    const item =
      evidence[index];

    const citationId =
      `CA-${String(index + 1).padStart(3, "0")}`;

    const block = [
      `[${citationId}]`,

      `Title: ${
        item?.document?.title ||
        "Untitled source"
      }`,

      `Authority: ${
        item?.document?.issuingAuthority ||
        "Unknown"
      }`,

      `Country: ${
        item?.document?.country ||
        "Unknown"
      }`,

      `Source class: ${
        item?.document?.sourceClass ||
        "other"
      }`,

      `Document status: ${
        item?.document?.status ||
        "unknown"
      }`,

      `Section: ${
        item?.sectionTitle ||
        "Not specified"
      }`,

      `Page: ${
        item?.pageNumber ||
        "Not available"
      }`,

      `Publication date: ${
        item?.document?.publicationDate ||
        "Not available"
      }`,

      `Evidence score: ${Math.round(
        Number(
          item?.evidenceScore || 0,
        ) * 100,
      )}%`,

      "",

      "Evidence text:",

      String(
        item?.content || "",
      ).trim(),
    ].join("\n");

    if (
      usedCharacters +
        block.length >
      maximumCharacters
    ) {
      break;
    }

    blocks.push(
      block,
    );

    usedCharacters +=
      block.length;
  }

  return blocks.join(
    "\n\n---\n\n",
  );
}

function buildConflictContext(
  conflicts = [],
) {
  if (
    !Array.isArray(conflicts) ||
    !conflicts.length
  ) {
    return "No direct numeric conflicts were detected.";
  }

  return conflicts
    .slice(0, 10)
    .map(
      (conflict, index) =>
        [
          `Conflict ${index + 1}: ${
            conflict?.type ||
            "unknown"
          }`,

          `Source A: ${
            conflict?.left?.title ||
            "Unknown"
          }`,

          `Value A: ${
            conflict?.left?.value ||
            "Unknown"
          }`,

          `Source B: ${
            conflict?.right?.title ||
            "Unknown"
          }`,

          `Value B: ${
            conflict?.right?.value ||
            "Unknown"
          }`,

          `Preferred source: ${
            conflict?.preferredSource ||
            "undetermined"
          }`,
        ].join("\n"),
    )
    .join("\n\n");
}

function isInsufficientEvidence(
  truthPackage,
) {
  const truthStatus =
    truthPackage?.truthStatus;

  const truthStatusCode =
    typeof truthStatus === "object"
      ? truthStatus?.code
      : truthStatus;

  return (
    truthStatusCode ===
      "insufficient_evidence" ||
    truthStatusCode ===
      "no_evidence" ||
    !Array.isArray(
      truthPackage?.evidence,
    ) ||
    truthPackage.evidence.length === 0
  );
}

function createInsufficientEvidenceResponse(
  context,
) {
  const truthPackage =
    context.truthPackage;

  return {
    question:
      context.question,

    answer:
      "I could not find enough permitted evidence in the Carbon Axis Knowledge Library to answer this reliably.",

    truthStatus:
      truthPackage?.truthStatus ??
      null,

    confidence:
      truthPackage?.confidence ??
      null,

    citations:
      truthPackage?.citations ??
      [],

    conflicts:
      truthPackage?.conflicts ??
      [],

    explainability:
      truthPackage?.explainability ??
      [],

    relatedQuestions: [],

    limitations: [
      "No sufficiently relevant evidence was found in the permitted knowledge library.",
      "The system did not generate a factual answer from unsupported model knowledge.",
    ],

    provider:
      "carbon_brain",

    model:
      null,

    responseId:
      null,

    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },

    statistics: {
      ...(
        truthPackage?.statistics ??
        {}
      ),

      answerGenerationLatencyMs:
        0,

      totalLatencyMs:
        Number.isFinite(
          context.pipelineStartedAt,
        )
          ? Date.now() -
            context.pipelineStartedAt
          : 0,
    },
  };
}

function applyResponseToContext(
  context,
  response,
) {
  context.response =
    response;

  context.answer =
    response?.answer ??
    null;

  context.confidence =
    response?.confidence ??
    context.confidence ??
    null;

  context.citations =
    response?.citations ??
    context.citations ??
    [];

  context.conflicts =
    response?.conflicts ??
    context.conflicts ??
    [];

  context.explainability =
    response?.explainability ??
    context.explainability ??
    [];

  context.truthStatus =
    response?.truthStatus ??
    context.truthStatus ??
    null;

  context.answerHealth =
    response?.answerHealth ??
    null;

  context.claimTraceability =
    response?.claimTraceability ??
    null;

  context.numericVerification =
    response?.numericVerification ??
    null;

  context.relatedQuestions =
    response?.relatedQuestions ??
    [];

  context.limitations =
    response?.limitations ??
    [];

  context.responseGeneration = {
    status:
      response?.answer
        ? "completed"
        : "empty",

    provider:
      response?.provider ??
      null,

    model:
      response?.model ??
      null,

    responseId:
      response?.responseId ??
      null,

    tokenUsage:
      response?.tokenUsage ??
      null,

    statistics:
      response?.statistics ??
      null,
  };
}

export const responseGenerationStage = {
  name:
    "response_generation",

  shouldSkip(context = {}) {
    return (
      typeof context.question !==
        "string" ||
      context.question.trim().length <
        3 ||
      !context.truthPackage
    );
  },

  async execute(context = {}) {
    if (
      isInsufficientEvidence(
        context.truthPackage,
      )
    ) {
      const fallbackResponse =
        createInsufficientEvidenceResponse(
          context,
        );

      applyResponseToContext(
        context,
        fallbackResponse,
      );

      return fallbackResponse;
    }

    const maximumContextCharacters =
      Number.isFinite(
        context.options
          ?.maximumContextCharacters,
      )
        ? context.options
            .maximumContextCharacters
        : DEFAULT_MAXIMUM_CONTEXT_CHARACTERS;

    const evidenceContext =
      buildEvidenceContext(
        context.truthPackage
          ?.evidence ?? [],
        maximumContextCharacters,
      );

    const conflictContext =
      buildConflictContext(
        context.truthPackage
          ?.conflicts ?? [],
      );

    const conversationContext =
      buildConversationContext(
        context.options
          ?.conversation ?? [],
      );

    const response =
      await generateCarbonBrainResponse({
        question:
          context.question,

        conversationContext,

        truthPackage:
          context.truthPackage,

        evidenceContext,

        conflictContext,

        comparisonPromptContext:
          context.comparisonPromptContext ??
          "",

        semanticKnowledge:
          context.semanticKnowledge ??
          {},

        semanticDiagnostics:
          context.semanticDiagnostics ??
          null,

        entityComparison:
          context.entityComparison ??
          null,

        entityComparisonSummary:
          context.entityComparisonSummary ??
          null,

        entityFactDiagnostics:
          context.entityFactDiagnostics ??
          null,

        startedAt:
          Number.isFinite(
            context.pipelineStartedAt,
          )
            ? context.pipelineStartedAt
            : Date.now(),
      });

    applyResponseToContext(
      context,
      response,
    );

    return response;
  },
};

export default responseGenerationStage;