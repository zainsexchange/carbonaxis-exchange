import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  registerEntity,
  resetEntityRegistry,
  getEntityByName,
} from "../../intelligence/graph/entityRegistry.js";

import {
  registerRelationship,
  resetRelationshipRegistry,
} from "../../intelligence/graph/relationshipRegistry.js";

import {
  initializeGraphIndexes,
} from "../../intelligence/graph/graphTraversalEngine.js";

const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
);

/**
 * @param {string} name
 * @returns {object}
 */
export function loadFixture(name) {
  const filePath = path.join(
    __dirname,
    `${name}.json`,
  );

  return JSON.parse(
    readFileSync(filePath, "utf8"),
  );
}

/**
 * Load entities/relationships into registries.
 *
 * @param {object} fixture
 * @returns {{ entities: Map<string, string> }}
 */
export function loadFixtureIntoRegistries(
  fixture,
) {
  resetEntityRegistry();
  resetRelationshipRegistry();

  const entities = new Map();

  for (const item of fixture.entities || []) {
    const result = registerEntity({
      canonicalSubject:
        item.canonicalSubject,
      entityType:
        item.entityType || "GENERIC",
    });

    entities.set(
      item.canonicalSubject,
      result.entityId,
    );
  }

  for (const edge of fixture.relationships || []) {
    const subjectId = entities.get(
      edge.subject,
    );
    const objectId = entities.get(
      edge.object,
    );

    if (!subjectId || !objectId) {
      continue;
    }

    registerRelationship({
      subjectEntityId: subjectId,
      predicate: edge.predicate,
      canonicalPredicate: edge.predicate,
      objectEntityId: objectId,
      object: edge.object,
    });
  }

  initializeGraphIndexes();

  return { entities };
}

/**
 * Build injected evidence streams from a fixture graph.
 *
 * @param {object} fixture
 * @returns {object}
 */
export function buildEvidenceFromFixture(
  fixture,
) {
  const { entities } =
    loadFixtureIntoRegistries(fixture);

  const graphEvidence = (
    fixture.relationships || []
  ).map((edge) => ({
    subjectEntityId: entities.get(
      edge.subject,
    ),
    predicate: edge.predicate,
    objectEntityId: entities.get(
      edge.object,
    ),
    confidence: 1.0,
    subject: edge.subject,
    object: edge.object,
  }));

  const documentEvidence = graphEvidence
    .filter(
      (edge) =>
        edge.predicate === "SUPPORTS",
    )
    .map((edge) => ({
      ...edge,
      confidence: 0.92,
      text: `${edge.subject} supports ${edge.object}.`,
    }));

  return {
    entities,
    retrievedChunks: documentEvidence,
    graphEvidence,
    inferredEvidence: [],
    ontologyEvidence: graphEvidence.filter(
      (edge) => edge.predicate === "IS_A",
    ),
  };
}

export function resolveEntityId(name) {
  return getEntityByName(name)?.entityId || null;
}
