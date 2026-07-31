import { buildPropositions } from "./propositionPipeline.js";
import { cleanDocument } from "./documentCleaner.js";
import {
  resolveContextBlocks,
} from "./contextResolver.js";
import {
  buildContextualSentence,
} from "./contextualSentenceBuilder.js";
import {
  resolveContextSubject,
} from "./contextSubjectResolver.js";
import {
  registerEntity,
} from "../graph/entityRegistry.js";
import {
  registerRelationship,
} from "../graph/relationshipRegistry.js";
import {
  normalizePredicate,
} from "./predicateCanonicalizer.js";

/**
 * Applies the richer context subject to an extracted proposition.
 *
 * The proposition extractor may reduce:
 *
 * "Pakistan Green Transition Strategy"
 *
 * to:
 *
 * "Pakistan"
 *
 * This helper preserves the full semantic subject while retaining the
 * parser's original subject for debugging and provenance.
 *
 * @param {object} proposition
 * @param {object} contextualSentence
 * @returns {object}
 */
function applyContextSubjectResolution(
  proposition,
  contextualSentence,
) {
  const subjectResolution =
    resolveContextSubject(
      contextualSentence,
      proposition,
    );

  const parserSubject =
    proposition.subject || null;

  const parserCanonicalSubject =
    proposition.canonicalSubject || null;

  const shouldOverride =
    subjectResolution.overrideRecommended === true &&
    Boolean(subjectResolution.resolvedSubject);

  const registryInput = {
    canonicalSubject:
      shouldOverride
        ? subjectResolution.canonicalSubject
        : proposition.canonicalSubject ||
          proposition.subject,

    entityType:
      subjectResolution.entityType,

    parentCountry:
      subjectResolution.parentCountry,

    aliases:
      subjectResolution.aliases,

    entityCandidateId:
      subjectResolution.entityCandidateId,
  };

  const registryResult =
    registerEntity(registryInput);

  const legacySubjectEntityId =
    proposition.subjectEntityId || null;

  const entityEnrichedProposition = {
    ...proposition,

    /*
     * Preserve what the proposition extractor originally returned.
     */
    parserSubject,
    parserCanonicalSubject,

    legacySubjectEntityId,

    /*
     * Replace the reduced parser subject only when the context resolver
     * has a stronger semantic subject.
     */
    subject: shouldOverride
      ? subjectResolution.resolvedSubject
      : proposition.subject,

    canonicalSubject: shouldOverride
      ? subjectResolution.canonicalSubject
      : proposition.canonicalSubject,

    /*
     * Context-subject resolution metadata.
     */
    semanticSubject:
      subjectResolution.resolvedSubject,

    semanticCanonicalSubject:
      subjectResolution.canonicalSubject,

    subjectEntityType:
      subjectResolution.entityType,

    subjectParentCountry:
      subjectResolution.parentCountry,

    subjectAliases:
      subjectResolution.aliases,

    subjectEntityCandidateId:
      subjectResolution.entityCandidateId,

    subjectResolutionSource:
      subjectResolution.source,

    subjectOverrideApplied:
      shouldOverride,

    subjectResolutionConfidence:
      subjectResolution.confidence,

    subjectEntityId:
      registryResult.entityId,

    entityResolved: true,

    entityRegistryCreated:
      registryResult.created,

    entityRegistryOccurrenceCount:
      registryResult.entity.occurrenceCount,
  };

  if (!entityEnrichedProposition.predicate) {
    console.error(
      "[Semantic Pipeline] Invalid proposition reaching relationship registry:",
      JSON.stringify(entityEnrichedProposition, null, 2)
    );
  }

  const predicateInfo =
    normalizePredicate(
      entityEnrichedProposition.predicate
    );

  const propositionForGraph = {
    ...entityEnrichedProposition,

    originalPredicate:
      predicateInfo.originalPredicate,

    canonicalPredicate:
      predicateInfo.canonicalPredicate,
  };

  console.log({
    predicate: propositionForGraph.predicate,
    canonicalPredicate: propositionForGraph.canonicalPredicate,
  });

  const relationshipResult =
    registerRelationship(
      propositionForGraph
    );

  return {
    ...propositionForGraph,

    relationshipId:
      relationshipResult.relationshipId,

    relationshipResolved: true,

    relationshipRegistryCreated:
      relationshipResult.created,

    relationshipRegistryOccurrenceCount:
      relationshipResult.relationship
        .occurrenceCount,

    relationshipAverageConfidence:
      relationshipResult.relationship
        .averageConfidence,

    relationshipMaxConfidence:
      relationshipResult.relationship
        .maxConfidence,
  };
}

export function buildSemanticKnowledge(text = "") {
  const cleanedText = cleanDocument(text);

  const contextBlocks =
    resolveContextBlocks(cleanedText);

  const contextualSentences =
    contextBlocks.map(buildContextualSentence);

  const rewrittenBlockCount =
    contextualSentences.filter(
      (sentence) =>
        sentence.rewrittenApplied === true,
    ).length;

  let skippedKnowledgeGraphBlocks = 0;

  let propositions = [];
  let parserRaw = 0;
  let parserValid = 0;
  let parserRejected = 0;
  const parserRejectedDetails = [];

  for (const contextualSentence of contextualSentences) {
    if (!contextualSentence.rewritten) {
      continue;
    }

    /*
     * Structural content such as headings should not become
     * propositions or graph relationships.
     */
    if (contextualSentence.skipKnowledgeGraph === true) {
      skippedKnowledgeGraphBlocks++;
      continue;
    }

    const extracted =
      buildPropositions(contextualSentence.rewritten);

    const validation =
      extracted.validation ?? null;

    if (validation) {
      parserRaw += validation.raw;
      parserValid += validation.valid;
      parserRejected += validation.rejected;

      if (Array.isArray(validation.invalid)) {
        parserRejectedDetails.push(
          ...validation.invalid,
        );
      }
    } else {
      parserRaw += extracted.length;
      parserValid += extracted.length;
    }

    const enriched = extracted.map(
      (proposition) => {
        const propositionWithContext = {
          ...proposition,

          originalBlockText:
            contextualSentence.original ?? null,

          contextualSentence:
            contextualSentence.rewritten ?? null,

          rewriteType:
            contextualSentence.rewriteType ?? null,

          rewrittenApplied:
            contextualSentence.rewrittenApplied ?? false,

          rewriteConfidence:
            contextualSentence.confidence ?? null,

          contextSubject:
            contextualSentence.contextSubject ?? null,

          contextPath:
            Array.isArray(contextualSentence.contextPath)
              ? contextualSentence.contextPath
              : [],

          sourceLine:
            contextualSentence.sourceLine ?? null,

          blockType:
            contextualSentence.blockType ?? null,

          markerType:
            contextualSentence.markerType ?? null,

          markerValue:
            contextualSentence.markerValue ?? null,
        };

        return applyContextSubjectResolution(
          propositionWithContext,
          contextualSentence,
        );
      },
    );

    propositions.push(...enriched);
  }

  const structuredFacts =
    propositions.filter(
      (proposition) =>
        proposition.hasStructuredValue === true,
    );

  const highConfidenceFacts =
    propositions.filter(
      (proposition) =>
        proposition.confidence >= 0.90,
    );

  return {
    propositionCount: propositions.length,

    skippedKnowledgeGraphBlocks,

    entities: [...new Set(
      propositions
        .map((p) => p.canonicalSubject)
        .filter(Boolean)
    )],

    structuredFacts,

    highConfidenceFacts,

    propositions,

    preprocessing: {
      rawLength: String(text || "").length,
      cleanedLength: cleanedText.length,
      blockCount: contextBlocks.length,
      rewrittenBlockCount,
      subjectOverrideCount:
        propositions.filter(
          (proposition) =>
            proposition.subjectOverrideApplied === true,
        ).length,
      parser: {
        raw: parserRaw,
        valid: parserValid,
        rejected: parserRejected,
        invalid: parserRejectedDetails.slice(0, 25),
      },
    },
  };
}
