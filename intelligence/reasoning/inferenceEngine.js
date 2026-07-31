import {
  listEntities,
  getEntityById,
  getEntityByName,
} from "../graph/entityRegistry.js";

import {
  listRelationships,
  createRelationshipKey,
} from "../graph/relationshipRegistry.js";

import {
  getAncestors,
  resolveConcept,
} from "../ontology/hierarchyResolver.js";

/**
 * Extensible inference rule table.
 * Add PART_OF / LOCATED_IN / etc. later without
 * rewriting the transitive core loop.
 */
const INFERENCE_RULES = Object.freeze([
  {
    id: "TRANSITIVE_IS_A",
    predicate: "IS_A",
  },
]);

const DEFAULT_INFERENCE_CONFIDENCE = 0.98;

function normalizePredicate(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function getCanonicalPredicate(
  relationship = {},
) {
  return normalizePredicate(
    relationship.canonicalPredicate ||
      relationship.predicate,
  );
}

function buildExistingRelationshipKeys(
  relationships = [],
) {
  const keys = new Set();

  for (const relationship of relationships) {
    try {
      keys.add(
        createRelationshipKey({
          subjectEntityId:
            relationship.subjectEntityId,

          predicate:
            getCanonicalPredicate(
              relationship,
            ) ||
            relationship.predicate,

          canonicalPredicate:
            getCanonicalPredicate(
              relationship,
            ),

          objectEntityId:
            relationship.objectEntityId,

          object:
            relationship.object,
        }),
      );
    } catch {
      // Skip incomplete relationships.
    }
  }

  return keys;
}

function buildInferenceKey({
  subjectEntityId,
  objectEntityId,
  predicate,
  objectName = null,
}) {
  return createRelationshipKey({
    subjectEntityId,
    predicate,
    canonicalPredicate: predicate,
    objectEntityId,
    object: objectName,
  });
}

function createInferredRecord({
  subjectEntityId,
  objectEntityId,
  predicate,
  inferenceRule,
  confidence =
    DEFAULT_INFERENCE_CONFIDENCE,
}) {
  return {
    subjectEntityId,
    objectEntityId,
    predicate,
    inferred: true,
    inferenceRule,
    confidence,
  };
}

function dedupeInferred(records = []) {
  const seen = new Set();
  const unique = [];

  for (const record of records) {
    let key;

    try {
      const objectEntity =
        getEntityById(
          record.objectEntityId,
        );

      key = buildInferenceKey({
        subjectEntityId:
          record.subjectEntityId,
        objectEntityId:
          record.objectEntityId,
        predicate: record.predicate,
        objectName:
          objectEntity?.canonicalName ??
          null,
      });
    } catch {
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(record);
  }

  return unique;
}

/**
 * Infer A PREDICATE C from
 * A PREDICATE B and B PREDICATE C
 * for every transitive rule in INFERENCE_RULES.
 *
 * Does not mutate the relationship registry.
 *
 * @returns {object[]}
 */
export function inferTransitiveRelationships() {
  const relationships =
    listRelationships();

  const existingKeys =
    buildExistingRelationshipKeys(
      relationships,
    );

  const inferredKeys = new Set();
  const inferred = [];

  for (const rule of INFERENCE_RULES) {
    const predicate =
      normalizePredicate(rule.predicate);

    if (!predicate) {
      continue;
    }

    const matching =
      relationships.filter(
        (relationship) => {
          return (
            getCanonicalPredicate(
              relationship,
            ) === predicate &&
            relationship.subjectEntityId &&
            relationship.objectEntityId
          );
        },
      );

    const outgoingBySubject = new Map();

    for (const relationship of matching) {
      const subjectId =
        relationship.subjectEntityId;

      const bucket =
        outgoingBySubject.get(
          subjectId,
        ) ?? [];

      bucket.push(relationship);
      outgoingBySubject.set(
        subjectId,
        bucket,
      );
    }

    for (const firstHop of matching) {
      const secondHops =
        outgoingBySubject.get(
          firstHop.objectEntityId,
        ) ?? [];

      for (const secondHop of secondHops) {
        const subjectEntityId =
          firstHop.subjectEntityId;

        const objectEntityId =
          secondHop.objectEntityId;

        if (
          !subjectEntityId ||
          !objectEntityId ||
          subjectEntityId ===
            objectEntityId
        ) {
          continue;
        }

        const objectEntity =
          getEntityById(objectEntityId);

        let inferenceKey;

        try {
          inferenceKey =
            buildInferenceKey({
              subjectEntityId,
              objectEntityId,
              predicate,
              objectName:
                objectEntity
                  ?.canonicalName ??
                secondHop.object ??
                null,
            });
        } catch {
          continue;
        }

        if (
          existingKeys.has(
            inferenceKey,
          ) ||
          inferredKeys.has(
            inferenceKey,
          )
        ) {
          continue;
        }

        inferredKeys.add(inferenceKey);

        inferred.push(
          createInferredRecord({
            subjectEntityId,
            objectEntityId,
            predicate,
            inferenceRule: rule.id,
            confidence:
              DEFAULT_INFERENCE_CONFIDENCE,
          }),
        );
      }
    }
  }

  return inferred;
}

/**
 * Infer IS_A edges from ontology ancestors when
 * those ancestor entities already exist in the
 * entity registry and the edge is missing.
 *
 * Does not mutate the relationship registry.
 *
 * @returns {object[]}
 */
export function inferOntologyRelationships() {
  const entities = listEntities();
  const relationships =
    listRelationships();

  const existingKeys =
    buildExistingRelationshipKeys(
      relationships,
    );

  const inferredKeys = new Set();
  const inferred = [];

  for (const entity of entities) {
    const concept = resolveConcept(
      entity.canonicalName,
    );

    if (!concept) {
      continue;
    }

    const ancestors = getAncestors(
      concept.canonicalName ||
        concept.name ||
        entity.canonicalName,
    );

    for (const ancestorName of ancestors) {
      const ancestorEntity =
        getEntityByName(ancestorName);

      if (!ancestorEntity) {
        continue;
      }

      if (
        ancestorEntity.entityId ===
        entity.entityId
      ) {
        continue;
      }

      let inferenceKey;

      try {
        inferenceKey = buildInferenceKey({
          subjectEntityId:
            entity.entityId,
          objectEntityId:
            ancestorEntity.entityId,
          predicate: "IS_A",
          objectName:
            ancestorEntity.canonicalName,
        });
      } catch {
        continue;
      }

      if (
        existingKeys.has(inferenceKey) ||
        inferredKeys.has(inferenceKey)
      ) {
        continue;
      }

      inferredKeys.add(inferenceKey);

      inferred.push(
        createInferredRecord({
          subjectEntityId:
            entity.entityId,
          objectEntityId:
            ancestorEntity.entityId,
          predicate: "IS_A",
          inferenceRule: "ONTOLOGY_IS_A",
          confidence:
            DEFAULT_INFERENCE_CONFIDENCE,
        }),
      );
    }
  }

  return inferred;
}

/**
 * Orchestrator — runs V1 inference without
 * mutating registries.
 *
 * @returns {object[]}
 */
export function runInference() {
  const inferred = [];

  inferred.push(
    ...inferTransitiveRelationships(),
  );

  inferred.push(
    ...inferOntologyRelationships(),
  );

  return dedupeInferred(inferred);
}

export {
  INFERENCE_RULES,
};
