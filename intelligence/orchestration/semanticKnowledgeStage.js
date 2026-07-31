import {
    buildSemanticKnowledge,
} from "../truth/semanticPipeline.js";

function resolveEvidenceText(item = {}) {
    return (
        item.text ??
        item.content ??
        item.chunkText ??
        item.pageContent ??
        ""
    )
        .toString()
        .trim();
}

function getInputEvidence(context = {}) {
    if (
        Array.isArray(context.clusteredEvidence) &&
        context.clusteredEvidence.length > 0
    ) {
        return context.clusteredEvidence;
    }

    if (Array.isArray(context.evidence)) {
        return context.evidence;
    }

    return [];
}

export const semanticKnowledgeStage = {
    name: "semantic_knowledge",

    shouldSkip(context) {
        return getInputEvidence(context).length === 0;
    },

    execute(context) {
        const inputEvidence =
            getInputEvidence(context);

        const results = [];
        const skippedItems = [];
        const errors = [];

        for (
            let index = 0;
            index < inputEvidence.length;
            index += 1
        ) {
            const evidenceItem =
                inputEvidence[index];

            const text =
                resolveEvidenceText(
                    evidenceItem,
                );

            if (!text) {
                skippedItems.push({
                    index,
                    reason:
                        "evidence_text_missing",
                    evidenceId:
                        evidenceItem?.id ??
                        evidenceItem?._id ??
                        null,
                });

                continue;
            }

            try {
                const semanticResult =
                    buildSemanticKnowledge(
                        text,
                    );

                results.push({
                    index,
                    evidenceId:
                        evidenceItem?.id ??
                        evidenceItem?._id ??
                        null,
                    semanticResult,
                });
            } catch (error) {
                errors.push({
                    index,
                    evidenceId:
                        evidenceItem?.id ??
                        evidenceItem?._id ??
                        null,
                    message:
                        error instanceof Error
                            ? error.message
                            : String(error),
                });
            }
        }

        context.semanticKnowledge = {
            results,
            skippedItems,
            errors,

            statistics: {
                inputEvidenceCount:
                    inputEvidence.length,

                processedCount:
                    results.length,

                skippedCount:
                    skippedItems.length,

                errorCount:
                    errors.length,
            },
        };

        return context.semanticKnowledge;
    },
};

export default semanticKnowledgeStage;