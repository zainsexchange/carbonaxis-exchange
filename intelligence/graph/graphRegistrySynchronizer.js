/* -------------------------------------------------------------------------- */
/*                     Graph Registry Synchronizer                            */
/* -------------------------------------------------------------------------- */

/*
  Purpose:

  Augmented Graph
        │
        ▼
  Validate
        │
        ▼
  Entity Registry
        │
        ▼
  Relationship Registry
        │
        ▼
  Knowledge Graph Rebuild
        │
        ▼
  Synchronization Report

  The registries remain the permanent source of truth.
*/

import {
  listEntities,
  registerEntity,
} from "./entityRegistry.js";

import {
  listRelationships,
  registerRelationship,
} from "./relationshipRegistry.js";

import {
  buildKnowledgeGraph,
  getKnowledgeGraphSummary,
} from "./knowledgeGraphStore.js";

import {
  getAugmentedGraphSnapshot,
} from "./graphAugmentationEngine.js";

/* -------------------------------------------------------------------------- */
/*                               Module State                                 */
/* -------------------------------------------------------------------------- */

const synchronizationState = {
  report: null,

  validationResult: null,

  entitySynchronizationResult: null,

  relationshipSynchronizationResult: null,

  graphRebuildResult: null,

  synchronizationInProgress: false,

  startedAt: null,

  completedAt: null,

  updatedAt: null,
};

/* -------------------------------------------------------------------------- */
/*                              Basic Helpers                                 */
/* -------------------------------------------------------------------------- */

function nowIso() {
  return new Date().toISOString();
}

function cloneObject(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      cloneObject(item),
    );
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(
        ([key, item]) => [
          key,
          cloneObject(item),
        ],
      ),
    );
  }

  return value;
}

function cloneReport(report) {
  if (
    !report ||
    typeof report !== "object"
  ) {
    return null;
  }

  return cloneObject(report);
}

function createEmptyCounter() {
  return {
    requested: 0,
    existing: 0,
    inserted: 0,
    skipped: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
  };
}

function createInitialReport() {
  const timestamp = nowIso();

  return {
    synchronizationId: null,

    status: "not_started",

    phase: "registry_synchronization",

    startedAt: null,

    completedAt: null,

    updatedAt: timestamp,

    sourceGraph: {
      available: false,

      entityCount: 0,

      objectNodeCount: 0,

      relationshipCount: 0,
    },

    validation: {
      performed: false,

      valid: false,

      errors: [],

      warnings: [],
    },

    entities: {
      before: 0,

      after: 0,

      ...createEmptyCounter(),
    },

    relationships: {
      before: 0,

      after: 0,

      ...createEmptyCounter(),
    },

    graph: {
      rebuildRequested: false,

      rebuilt: false,

      verified: false,

      before: null,

      after: null,
    },

    indexes: {
      rebuilt: false,

      verified: false,
    },

    idMapping: {
      entities: {},
      relationships: {},
    },

    errors: [],

    warnings: [],
  };
}

function createEntityLookup() {
  const lookup = new Map();

  for (const entity of listEntities()) {
    lookup.set(
      entity.canonicalKey,
      entity,
    );
  }

  return lookup;
}

function createRelationshipLookup() {
  const lookup = new Map();

  for (const relationship of listRelationships()) {
    lookup.set(
      relationship.relationshipKey,
      relationship,
    );
  }

  return lookup;
}

function synchronizeEntities(
  augmentedGraph,
  report,
) {
  const lookup =
    createEntityLookup();

  const mapping =
    report.idMapping.entities;

  const entityNodes =
    Array.isArray(
      augmentedGraph?.entityNodes,
    )
      ? augmentedGraph.entityNodes
      : [];

  report.entities.before =
    lookup.size;

  report.entities.requested =
    entityNodes.length;

  for (const entity of entityNodes) {
    try {
      const canonicalKey =
        entity.canonicalKey;

      if (!canonicalKey) {
        report.entities.rejected += 1;

        report.errors.push({
          code:
            "ENTITY_MISSING_CANONICAL_KEY",

          entityId:
            entity.entityId,
        });

        continue;
      }

      /* Already exists */

      const existing =
        lookup.get(canonicalKey);

      if (existing) {
        report.entities.existing += 1;

        mapping[
          entity.entityId
        ] =
          existing.entityId;

        continue;
      }

      /* Register */

      const result =
        registerEntity({
          canonicalSubject:
            entity.canonicalName,

          entityType:
            entity.entityType,

          parentCountry:
            entity.parentCountry,

          aliases:
            entity.aliases,

          entityCandidateId:
            entity.candidateId,
        });

      lookup.set(
        canonicalKey,
        result.entity,
      );

      mapping[
        entity.entityId
      ] =
        result.entityId;

      if (result.created) {
        report.entities.inserted += 1;
      } else {
        report.entities.skipped += 1;
      }
    } catch (error) {
      report.entities.failed += 1;

      report.errors.push({
        code:
          "ENTITY_SYNCHRONIZATION_FAILED",

        entityId:
          entity?.entityId,

        message:
          error.message,
      });
    }
  }

  report.entities.after =
    listEntities().length;

  return report.entities;
}

function synchronizeRelationships(
  augmentedGraph,
  report,
) {
  const lookup =
    createRelationshipLookup();

  const entityMapping =
    report.idMapping.entities;

  const entityLookup = new Map(
    listEntities().map((entity) => [
      entity.entityId,
      entity.entityId,
    ]),
  );

  const relationshipMapping =
    report.idMapping.relationships;

  const relationshipEdges =
    Array.isArray(
      augmentedGraph?.relationshipEdges,
    )
      ? augmentedGraph.relationshipEdges
      : Array.isArray(
          augmentedGraph?.edges,
        )
      ? augmentedGraph.edges
      : [];

  report.relationships.before =
    lookup.size;

  report.relationships.requested =
    relationshipEdges.length;

  for (const edge of relationshipEdges) {
    try {
      const registrySubjectId =
        entityMapping[
          edge.subjectEntityId
        ];

      if (!registrySubjectId) {
        report.relationships.rejected += 1;

        report.errors.push({
          code:
            "UNKNOWN_SUBJECT_ENTITY",

          relationshipId:
            edge.relationshipId,

          subjectEntityId:
            edge.subjectEntityId,
        });

        continue;
      }

      const sourceObjectEntityId =
        edge.objectEntityId ||
        edge.targetEntityId ||
        (
          edge.relationshipType === "entity_to_entity"
            ? edge.toNodeId
            : null
        );

      const isEntityRelationship =
        edge.objectType === "entity" ||
        edge.relationshipType === "entity_to_entity" ||
        Boolean(sourceObjectEntityId);

      const registryObjectEntityId =
        isEntityRelationship
          ? (
              entityLookup.get(sourceObjectEntityId) ||
              report.idMapping.entities[
                sourceObjectEntityId
              ] ||
              sourceObjectEntityId
            )
          : null;

      console.log({
        relationshipId: edge.relationshipId,
        objectType: edge.objectType,
        edgeObjectEntityId: edge.objectEntityId,
        mappedObjectEntityId: registryObjectEntityId,
        edgeObject: edge.object,
      });

      const result =
        registerRelationship({
          subjectEntityId:
            registrySubjectId,

          subject:
            edge.subject,

          canonicalSubject:
            edge.canonicalSubject,

          predicate:
            edge.predicate ||
            edge.normalizedPredicate,

          object:
            edge.object ||
            edge.objectCanonicalName ||
            edge.objectKey,

          objectEntityId:
            registryObjectEntityId,

          structuredValue:
            edge.structuredValue,

          confidence:
            edge.averageConfidence ??
            edge.maxConfidence ??
            edge.confidence,

          provenance:
            edge.provenance,
        });

      relationshipMapping[
        edge.relationshipId
      ] =
        result.relationshipId;

      lookup.set(
        result.relationship
          .relationshipKey,
        result.relationship,
      );

      if (result.created) {
        report.relationships.inserted += 1;
      } else {
        report.relationships.skipped += 1;
      }
    } catch (error) {
      report.relationships.failed += 1;

      report.errors.push({
        code:
          "RELATIONSHIP_SYNCHRONIZATION_FAILED",

        relationshipId:
          edge?.relationshipId,

        message:
          error.message,
      });
    }
  }

  report.relationships.after =
    listRelationships().length;

  return report.relationships;
}

/* -------------------------------------------------------------------------- */
/*                           Public Report Getters                            */
/* -------------------------------------------------------------------------- */

export function getSynchronizationReport() {
  return cloneReport(
    synchronizationState.report,
  );
}

export function getSynchronizationSummary() {
  const report =
    synchronizationState.report;

  if (!report) {
    return {
      status: "not_started",

      synchronizationInProgress:
        synchronizationState
          .synchronizationInProgress,

      startedAt:
        synchronizationState.startedAt,

      completedAt:
        synchronizationState.completedAt,

      validationPassed: false,

      entitiesInserted: 0,

      relationshipsInserted: 0,

      graphRebuilt: false,

      graphVerified: false,

      errorCount: 0,

      warningCount: 0,
    };
  }

  return {
    synchronizationId:
      report.synchronizationId,

    status: report.status,

    synchronizationInProgress:
      synchronizationState
        .synchronizationInProgress,

    startedAt: report.startedAt,

    completedAt: report.completedAt,

    validationPassed:
      report.validation?.valid === true,

    entitiesInserted:
      report.entities?.inserted ?? 0,

    relationshipsInserted:
      report.relationships?.inserted ?? 0,

    entityCountBefore:
      report.entities?.before ?? 0,

    entityCountAfter:
      report.entities?.after ?? 0,

    relationshipCountBefore:
      report.relationships?.before ?? 0,

    relationshipCountAfter:
      report.relationships?.after ?? 0,

    graphRebuilt:
      report.graph?.rebuilt === true,

    graphVerified:
      report.graph?.verified === true,

    errorCount: Array.isArray(
      report.errors,
    )
      ? report.errors.length
      : 0,

    warningCount: Array.isArray(
      report.warnings,
    )
      ? report.warnings.length
      : 0,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Reset State                                   */
/* -------------------------------------------------------------------------- */

export function resetSynchronization() {
  synchronizationState.report = null;

  synchronizationState.validationResult =
    null;

  synchronizationState
    .entitySynchronizationResult = null;

  synchronizationState
    .relationshipSynchronizationResult =
    null;

  synchronizationState.graphRebuildResult =
    null;

  synchronizationState
    .synchronizationInProgress = false;

  synchronizationState.startedAt = null;

  synchronizationState.completedAt = null;

  synchronizationState.updatedAt =
    nowIso();

  return {
    reset: true,

    status: "not_started",

    resetAt:
      synchronizationState.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/*                   Synchronization Entry Point Placeholder                  */
/* -------------------------------------------------------------------------- */

export function synchronizeAugmentedGraph(
  options = {},
) {
  void options;

  const augmentedGraph =
    getAugmentedGraphSnapshot();

  const report =
    createInitialReport();

  report.status =
    "running";

  report.startedAt =
    new Date().toISOString();

  report.sourceGraph.available =
    Boolean(augmentedGraph);

  report.sourceGraph.entityCount =
    augmentedGraph?.entityNodes?.length ??
    0;

  report.sourceGraph.objectNodeCount =
    augmentedGraph?.objectNodes?.length ??
    0;

  report.sourceGraph.relationshipCount =
    augmentedGraph?.relationshipEdges?.length ??
    augmentedGraph?.edges?.length ??
    0;

  synchronizeEntities(
    augmentedGraph,
    report,
  );

  synchronizeRelationships(
    augmentedGraph,
    report,
  );

  const beforeSummary =
    getKnowledgeGraphSummary();

  buildKnowledgeGraph();

  const afterSummary =
    getKnowledgeGraphSummary();

  report.graph.before =
    beforeSummary;

  report.graph.after =
    afterSummary;

  report.graph.rebuildRequested =
    true;

  report.graph.rebuilt =
    true;

  report.indexes.rebuilt =
    true;

  report.status = "success";

  report.completedAt =
    new Date().toISOString();

  report.updatedAt =
    report.completedAt;

  synchronizationState.report =
    report;

  synchronizationState.updatedAt =
    report.updatedAt;

  synchronizationState.completedAt =
    report.completedAt;

  return {
    synchronized: true,

    report:
      getSynchronizationReport(),
  };
}