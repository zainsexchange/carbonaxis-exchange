import {
  extractBasePropositions,
} from "./propositionExtractor.js";

import {
  recoverSubjects,
} from "./subjectRecovery.js";

import {
  recoverPredicates,
} from "./predicateRecovery.js";

import {
  recoverObjects,
} from "./objectRecovery.js";

import {
  expandPropositionLists,
} from "./listExpansionEngine.js";

import {
  enrichPropositionValues,
} from "./structuredValueExtractor.js";

import {
  resolveEntities,
} from "./entityResolver.js";

import {
  evaluatePropositions,
} from "./propositionConfidenceEngine.js";

import {
  validatePropositions,
} from "./propositionValidator.js";

export function buildPropositions(text = "") {
  let propositions =
    extractBasePropositions(text);

  propositions =
    recoverSubjects(
      propositions
    );

  propositions =
    recoverPredicates(
      propositions
    );

  propositions =
    recoverObjects(
      propositions
    );

  propositions =
    expandPropositionLists(
      propositions
    );

  propositions =
    enrichPropositionValues(
      propositions
    );

  propositions =
    resolveEntities(
      propositions
    );

  propositions =
    evaluatePropositions(
      propositions
    );

  const validation =
    validatePropositions(
      propositions
    );

  return validation.valid;
}
