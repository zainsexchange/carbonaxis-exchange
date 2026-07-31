import {
  getKnowledgeGraphSnapshot,
  normalizeGraphKey,
} from "./knowledgeGraphStore.js";

/**
 * Object-to-Entity Link Store
 *
 * This module creates deterministic links between graph object nodes
 * and existing entity nodes.
 *
 * It does not use embeddings or an LLM.
 *
 * Supported matching strategies:
 * 1. Candidate ID match
 * 2. Canonical name match
 * 3. Alias match
 * 4. Normalized text match
 */

const objectEntityLinks =
  new Map();

const objectLinksByObjectNode =
  new Map();

const objectLinksByEntity =
  new Map();

let linkCounter = 0;

/**
 * Convert a value into a clean string.
 */
function cleanString(
  value,
) {
  return String(
    value ?? "",
  ).trim();
}

/**
 * Normalize text for matching.
 */
function normalizeLinkText(
  value,
) {
  const text =
    cleanString(
      value,
    );

  if (!text) {
    return "";
  }

  if (
    typeof normalizeGraphKey ===
    "function"
  ) {
    return normalizeGraphKey(
      text,
    );
  }

  return text
    .toLowerCase()
    .replace(
      /[^a-z0-9%$€£]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

/**
 * Normalize an ID-like value.
 */
function normalizeIdentifier(
  value,
) {
  return cleanString(
    value,
  )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      "_",
    )
    .replace(
      /^_+|_+$/g,
      "",
    );
}

/**
 * Return only unique, non-empty values.
 */
function uniqueStrings(
  values,
) {
  return Array.from(
    new Set(
      values
        .map(
          cleanString,
        )
        .filter(
          Boolean,
        ),
    ),
  );
}

/**
 * Convert unknown input into an array.
 */
function toArray(
  value,
) {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value;
  }

  if (
    value instanceof Map
  ) {
    return Array.from(
      value.values(),
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    return Object.values(
      value,
    );
  }

  return [];
}

/**
 * Clone an entity node.
 */
function cloneEntityNode(
  entity,
) {
  if (
    !entity ||
    typeof entity !==
      "object"
  ) {
    return null;
  }

  return {
    ...entity,

    aliases:
      Array.isArray(
        entity.aliases,
      )
        ? [
            ...entity.aliases,
          ]
        : [],

    candidateIds:
      Array.isArray(
        entity.candidateIds,
      )
        ? [
            ...entity.candidateIds,
          ]
        : [],
  };
}

/**
 * Clone an object node.
 */
function cloneObjectNode(
  objectNode,
) {
  if (
    !objectNode ||
    typeof objectNode !==
      "object"
  ) {
    return null;
  }

  return {
    ...objectNode,

    structuredValue:
      objectNode.structuredValue &&
      typeof objectNode
        .structuredValue ===
        "object"
        ? {
            ...objectNode
              .structuredValue,

            allYears:
              Array.isArray(
                objectNode
                  .structuredValue
                  .allYears,
              )
                ? [
                    ...objectNode
                      .structuredValue
                      .allYears,
                  ]
                : [],
          }
        : null,
  };
}

/**
 * Clone a link.
 */
function cloneObjectEntityLink(
  link,
) {
  if (
    !link ||
    typeof link !==
      "object"
  ) {
    return null;
  }

  return {
    ...link,

    matchedValues:
      Array.isArray(
        link.matchedValues,
      )
        ? link.matchedValues.map(
            (item) => ({
              ...item,
            }),
          )
        : [],

    objectNode:
      cloneObjectNode(
        link.objectNode,
      ),

    entityNode:
      cloneEntityNode(
        link.entityNode,
      ),
  };
}

/**
 * Read entity nodes from different possible snapshot shapes.
 */
function extractEntityNodes(
  snapshot,
) {
  const candidates = [
    snapshot?.entityNodes,
    snapshot?.entities,
    snapshot?.nodes?.entities,
    snapshot?.nodes?.entityNodes,
  ];

  for (
    const candidate
    of candidates
  ) {
    const values =
      toArray(
        candidate,
      );

    if (
      values.length > 0
    ) {
      return values.filter(
        (node) =>
          node &&
          (
            node.nodeType ===
              "entity" ||
            node.entityId ||
            node.canonicalName
          ),
      );
    }
  }

  const genericNodes =
    toArray(
      snapshot?.nodes,
    );

  return genericNodes.filter(
    (node) =>
      node?.nodeType ===
        "entity" ||
      Boolean(
        node?.entityId,
      ),
  );
}

/**
 * Read object nodes from different possible snapshot shapes.
 */
function extractObjectNodes(
  snapshot,
) {
  const candidates = [
    snapshot?.objectNodes,
    snapshot?.objects,
    snapshot?.nodes?.objects,
    snapshot?.nodes?.objectNodes,
  ];

  for (
    const candidate
    of candidates
  ) {
    const values =
      toArray(
        candidate,
      );

    if (
      values.length > 0
    ) {
      return values.filter(
        (node) =>
          node &&
          (
            node.nodeType ===
              "object" ||
            node.objectKey ||
            node.value
          ),
      );
    }
  }

  const genericNodes =
    toArray(
      snapshot?.nodes,
    );

  return genericNodes.filter(
    (node) =>
      node?.nodeType ===
        "object" ||
      Boolean(
        node?.objectKey,
      ),
  );
}

/**
 * Build all searchable names for an entity.
 */
function getEntityNames(
  entity,
) {
  return uniqueStrings([
    entity?.canonicalName,
    entity?.canonicalKey,
    entity?.name,
    entity?.label,
    entity?.title,
    ...(Array.isArray(
      entity?.aliases,
    )
      ? entity.aliases
      : []),
  ]);
}

/**
 * Build all candidate identifiers for an entity.
 */
function getEntityCandidateIds(
  entity,
) {
  return uniqueStrings([
    entity?.candidateId,
    entity?.entityId,
    ...(Array.isArray(
      entity?.candidateIds,
    )
      ? entity.candidateIds
      : []),
  ]);
}

/**
 * Build all searchable values for an object node.
 */
function getObjectValues(
  objectNode,
) {
  return uniqueStrings([
    objectNode?.value,
    objectNode?.object,
    objectNode?.objectKey,
    objectNode?.label,
    objectNode?.name,
    objectNode?.title,
    objectNode
      ?.structuredValue
      ?.raw,
    objectNode
      ?.structuredValue
      ?.metric,
  ]);
}

/**
 * Build candidate identifiers from an object node.
 */
function getObjectCandidateIds(
  objectNode,
) {
  return uniqueStrings([
    objectNode?.candidateId,
    objectNode?.entityCandidateId,
    objectNode?.resolvedEntityId,
    ...(Array.isArray(
      objectNode?.candidateIds,
    )
      ? objectNode.candidateIds
      : []),
  ]);
}

/**
 * Build deterministic indexes for all entity nodes.
 */
export function buildEntityLinkIndex(
  entities = null,
) {
  const snapshot =
    entities
      ? null
      : getKnowledgeGraphSnapshot();

  const entityNodes =
    entities
      ? toArray(
          entities,
        )
      : extractEntityNodes(
          snapshot,
        );

  const canonicalNameIndex =
    new Map();

  const aliasIndex =
    new Map();

  const candidateIdIndex =
    new Map();

  const normalizedTextIndex =
    new Map();

  const entityById =
    new Map();

  for (
    const rawEntity
    of entityNodes
  ) {
    const entity =
      cloneEntityNode(
        rawEntity,
      );

    if (!entity) {
      continue;
    }

    const entityId =
      cleanString(
        entity.entityId ??
          entity.nodeId,
      );

    if (!entityId) {
      continue;
    }

    entityById.set(
      entityId,
      entity,
    );

    const canonicalName =
      cleanString(
        entity.canonicalName,
      );

    const canonicalKey =
      normalizeLinkText(
        entity.canonicalKey ??
          canonicalName,
      );

    if (canonicalKey) {
      canonicalNameIndex.set(
        canonicalKey,
        entity,
      );

      normalizedTextIndex.set(
        canonicalKey,
        entity,
      );
    }

    const aliases =
      Array.isArray(
        entity.aliases,
      )
        ? entity.aliases
        : [];

    for (
      const alias
      of aliases
    ) {
      const aliasKey =
        normalizeLinkText(
          alias,
        );

      if (!aliasKey) {
        continue;
      }

      aliasIndex.set(
        aliasKey,
        entity,
      );

      if (
        !normalizedTextIndex.has(
          aliasKey,
        )
      ) {
        normalizedTextIndex.set(
          aliasKey,
          entity,
        );
      }
    }

    for (
      const candidateId
      of getEntityCandidateIds(
        entity,
      )
    ) {
      const normalizedCandidateId =
        normalizeIdentifier(
          candidateId,
        );

      if (
        normalizedCandidateId
      ) {
        candidateIdIndex.set(
          normalizedCandidateId,
          entity,
        );
      }
    }

    for (
      const name
      of getEntityNames(
        entity,
      )
    ) {
      const normalizedName =
        normalizeLinkText(
          name,
        );

      if (
        normalizedName &&
        !normalizedTextIndex.has(
          normalizedName,
        )
      ) {
        normalizedTextIndex.set(
          normalizedName,
          entity,
        );
      }
    }
  }

  return {
    entityById,
    canonicalNameIndex,
    aliasIndex,
    candidateIdIndex,
    normalizedTextIndex,

    summary: {
      entityCount:
        entityById.size,

      canonicalNameCount:
        canonicalNameIndex.size,

      aliasCount:
        aliasIndex.size,

      candidateIdCount:
        candidateIdIndex.size,

      normalizedTextCount:
        normalizedTextIndex.size,
    },
  };
}

/**
 * Match an object node to an entity.
 */
export function matchObjectNodeToEntity(
  objectNode,
  options = {},
) {
  if (
    !objectNode ||
    typeof objectNode !==
      "object"
  ) {
    return {
      matched: false,
      objectNode: null,
      entityNode: null,
      matchType: null,
      matchConfidence: 0,
      matchedValues: [],
    };
  }

  const index =
    options.entityIndex ??
    buildEntityLinkIndex(
      options.entities,
    );

  const objectValues =
    getObjectValues(
      objectNode,
    );

  const objectCandidateIds =
    getObjectCandidateIds(
      objectNode,
    );

  /**
   * Priority 1:
   * Explicit candidate ID match.
   */
  for (
    const objectCandidateId
    of objectCandidateIds
  ) {
    const normalizedCandidateId =
      normalizeIdentifier(
        objectCandidateId,
      );

    const entity =
      index.candidateIdIndex.get(
        normalizedCandidateId,
      );

    if (entity) {
      return {
        matched: true,

        objectNode:
          cloneObjectNode(
            objectNode,
          ),

        entityNode:
          cloneEntityNode(
            entity,
          ),

        matchType:
          "candidate_id",

        matchConfidence: 1,

        matchedValues: [
          {
            objectValue:
              objectCandidateId,

            entityValue:
              normalizedCandidateId,

            normalizedValue:
              normalizedCandidateId,
          },
        ],
      };
    }
  }

  /**
   * Priority 2:
   * Exact canonical-name match.
   */
  for (
    const objectValue
    of objectValues
  ) {
    const normalizedValue =
      normalizeLinkText(
        objectValue,
      );

    const entity =
      index.canonicalNameIndex.get(
        normalizedValue,
      );

    if (entity) {
      return {
        matched: true,

        objectNode:
          cloneObjectNode(
            objectNode,
          ),

        entityNode:
          cloneEntityNode(
            entity,
          ),

        matchType:
          "canonical_name",

        matchConfidence: 0.99,

        matchedValues: [
          {
            objectValue,

            entityValue:
              entity.canonicalName,

            normalizedValue,
          },
        ],
      };
    }
  }

  /**
   * Priority 3:
   * Exact alias match.
   */
  for (
    const objectValue
    of objectValues
  ) {
    const normalizedValue =
      normalizeLinkText(
        objectValue,
      );

    const entity =
      index.aliasIndex.get(
        normalizedValue,
      );

    if (entity) {
      const matchedAlias =
        entity.aliases.find(
          (alias) =>
            normalizeLinkText(
              alias,
            ) ===
            normalizedValue,
        ) ?? null;

      return {
        matched: true,

        objectNode:
          cloneObjectNode(
            objectNode,
          ),

        entityNode:
          cloneEntityNode(
            entity,
          ),

        matchType:
          "alias",

        matchConfidence: 0.97,

        matchedValues: [
          {
            objectValue,

            entityValue:
              matchedAlias,

            normalizedValue,
          },
        ],
      };
    }
  }

  /**
   * Priority 4:
   * Generic normalized-text match.
   */
  for (
    const objectValue
    of objectValues
  ) {
    const normalizedValue =
      normalizeLinkText(
        objectValue,
      );

    const entity =
      index.normalizedTextIndex.get(
        normalizedValue,
      );

    if (entity) {
      return {
        matched: true,

        objectNode:
          cloneObjectNode(
            objectNode,
          ),

        entityNode:
          cloneEntityNode(
            entity,
          ),

        matchType:
          "normalized_text",

        matchConfidence: 0.95,

        matchedValues: [
          {
            objectValue,

            entityValue:
              entity.canonicalName,

            normalizedValue,
          },
        ],
      };
    }
  }

  return {
    matched: false,

    objectNode:
      cloneObjectNode(
        objectNode,
      ),

    entityNode: null,

    matchType: null,

    matchConfidence: 0,

    matchedValues: [],
  };
}

/**
 * Generate the next link ID.
 */
function createLinkId() {
  linkCounter += 1;

  return `OBJECT_ENTITY_LINK_${String(
    linkCounter,
  ).padStart(
    6,
    "0",
  )}`;
}

/**
 * Build a deterministic unique key for one link.
 */
function createLinkKey(
  objectNodeId,
  entityId,
) {
  return [
    normalizeLinkText(
      objectNodeId,
    ),
    normalizeLinkText(
      entityId,
    ),
  ].join(
    "::",
  );
}

/**
 * Register one matched object-to-entity link.
 */
export function registerObjectEntityLink(
  matchResult,
  options = {},
) {
  if (
    !matchResult?.matched ||
    !matchResult.objectNode ||
    !matchResult.entityNode
  ) {
    return null;
  }

  const objectNodeId =
    cleanString(
      matchResult
        .objectNode
        .nodeId ??
        matchResult
          .objectNode
          .objectKey,
    );

  const entityId =
    cleanString(
      matchResult
        .entityNode
        .entityId ??
        matchResult
          .entityNode
          .nodeId,
    );

  if (
    !objectNodeId ||
    !entityId
  ) {
    return null;
  }

  const linkKey =
    createLinkKey(
      objectNodeId,
      entityId,
    );

  const existingLink =
    objectEntityLinks.get(
      linkKey,
    );

  if (existingLink) {
    existingLink.matchConfidence =
      Math.max(
        existingLink
          .matchConfidence,
        matchResult
          .matchConfidence,
      );

    existingLink.occurrenceCount +=
      1;

    existingLink.updatedAt =
      new Date().toISOString();

    return cloneObjectEntityLink(
      existingLink,
    );
  }

  const timestamp =
    new Date().toISOString();

  const link = {
    linkId:
      createLinkId(),

    linkKey,

    linkType:
      "object_to_entity",

    fromNodeId:
      objectNodeId,

    toNodeId:
      entityId,

    objectNodeId,

    entityId,

    objectValue:
      matchResult
        .objectNode
        .value ??
      matchResult
        .objectNode
        .objectKey ??
      null,

    entityName:
      matchResult
        .entityNode
        .canonicalName ??
      null,

    matchType:
      matchResult.matchType,

    matchConfidence:
      matchResult
        .matchConfidence,

    matchedValues:
      Array.isArray(
        matchResult
          .matchedValues,
      )
        ? matchResult
            .matchedValues
            .map(
              (item) => ({
                ...item,
              }),
            )
        : [],

    objectNode:
      cloneObjectNode(
        matchResult
          .objectNode,
      ),

    entityNode:
      cloneEntityNode(
        matchResult
          .entityNode,
      ),

    occurrenceCount: 1,

    source:
      options.source ??
      "deterministic_object_entity_linker",

    createdAt:
      timestamp,

    updatedAt:
      timestamp,
  };

  objectEntityLinks.set(
    linkKey,
    link,
  );

  if (
    !objectLinksByObjectNode.has(
      objectNodeId,
    )
  ) {
    objectLinksByObjectNode.set(
      objectNodeId,
      new Set(),
    );
  }

  objectLinksByObjectNode
    .get(
      objectNodeId,
    )
    .add(
      linkKey,
    );

  if (
    !objectLinksByEntity.has(
      entityId,
    )
  ) {
    objectLinksByEntity.set(
      entityId,
      new Set(),
    );
  }

  objectLinksByEntity
    .get(
      entityId,
    )
    .add(
      linkKey,
    );

  return cloneObjectEntityLink(
    link,
  );
}

/**
 * Match and register one object node.
 */
export function linkObjectNodeToEntity(
  objectNode,
  options = {},
) {
  const matchResult =
    matchObjectNodeToEntity(
      objectNode,
      options,
    );

  if (
    !matchResult.matched
  ) {
    return {
      matched: false,
      registered: false,
      matchResult,
      link: null,
    };
  }

  const link =
    registerObjectEntityLink(
      matchResult,
      options,
    );

  return {
    matched: true,
    registered:
      Boolean(
        link,
      ),
    matchResult,
    link,
  };
}

/**
 * Link every object node in the current graph snapshot.
 */
export function linkAllGraphObjects(
  options = {},
) {
  if (
    options.reset === true
  ) {
    resetObjectEntityLinks();
  }

  const snapshot =
    getKnowledgeGraphSnapshot();

  const entities =
    extractEntityNodes(
      snapshot,
    );

  const objectNodes =
    extractObjectNodes(
      snapshot,
    );

  const entityIndex =
    buildEntityLinkIndex(
      entities,
    );

  const matched = [];
  const unmatched = [];

  for (
    const objectNode
    of objectNodes
  ) {
    const result =
      linkObjectNodeToEntity(
        objectNode,
        {
          ...options,
          entities,
          entityIndex,
        },
      );

    if (
      result.matched
    ) {
      matched.push(
        result,
      );
    } else {
      unmatched.push({
        objectNode:
          cloneObjectNode(
            objectNode,
          ),

        reason:
          "No deterministic entity match found.",
      });
    }
  }

  return {
    matched,

    unmatched,

    matchedCount:
      matched.length,

    unmatchedCount:
      unmatched.length,

    objectNodeCount:
      objectNodes.length,

    entityCount:
      entities.length,

    linkCount:
      objectEntityLinks.size,

    indexSummary:
      entityIndex.summary,
  };
}

/**
 * Get one link by its unique link key.
 */
export function getObjectEntityLink(
  objectNodeId,
  entityId,
) {
  const linkKey =
    createLinkKey(
      objectNodeId,
      entityId,
    );

  return cloneObjectEntityLink(
    objectEntityLinks.get(
      linkKey,
    ),
  );
}

/**
 * Get all entity links for one object node.
 */
export function getEntityLinksByObjectNode(
  objectNodeId,
) {
  const normalizedObjectNodeId =
    cleanString(
      objectNodeId,
    );

  const linkKeys =
    objectLinksByObjectNode.get(
      normalizedObjectNodeId,
    );

  if (!linkKeys) {
    return [];
  }

  return Array.from(
    linkKeys,
  )
    .map(
      (linkKey) =>
        cloneObjectEntityLink(
          objectEntityLinks.get(
            linkKey,
          ),
        ),
    )
    .filter(
      Boolean,
    );
}

/**
 * Get all object links pointing to one entity.
 */
export function getObjectLinksByEntity(
  entityId,
) {
  const normalizedEntityId =
    cleanString(
      entityId,
    );

  const linkKeys =
    objectLinksByEntity.get(
      normalizedEntityId,
    );

  if (!linkKeys) {
    return [];
  }

  return Array.from(
    linkKeys,
  )
    .map(
      (linkKey) =>
        cloneObjectEntityLink(
          objectEntityLinks.get(
            linkKey,
          ),
        ),
    )
    .filter(
      Boolean,
    );
}

/**
 * Return all registered object-to-entity links.
 */
export function getAllObjectEntityLinks() {
  return Array.from(
    objectEntityLinks.values(),
  )
    .map(
      cloneObjectEntityLink,
    )
    .filter(
      Boolean,
    );
}

/**
 * Return a serializable linker snapshot.
 */
export function getObjectEntityLinkSnapshot() {
  return {
    links:
      getAllObjectEntityLinks(),

    linkCount:
      objectEntityLinks.size,

    objectNodeIndexCount:
      objectLinksByObjectNode.size,

    entityIndexCount:
      objectLinksByEntity.size,
  };
}

/**
 * Return high-level linker statistics.
 */
export function getObjectEntityLinkSummary() {
  const links =
    getAllObjectEntityLinks();

  const matchTypeCounts =
    links.reduce(
      (
        summary,
        link,
      ) => {
        const matchType =
          link.matchType ??
          "unknown";

        summary[matchType] =
          (
            summary[
              matchType
            ] ?? 0
          ) + 1;

        return summary;
      },
      {},
    );

  const averageMatchConfidence =
    links.length > 0
      ? links.reduce(
          (
            total,
            link,
          ) =>
            total +
            Number(
              link.matchConfidence ??
                0,
            ),
          0,
        ) /
        links.length
      : 0;

  return {
    linkCount:
      links.length,

    linkedObjectNodeCount:
      objectLinksByObjectNode.size,

    linkedEntityCount:
      objectLinksByEntity.size,

    matchTypeCounts,

    averageMatchConfidence:
      Number(
        averageMatchConfidence.toFixed(
          6,
        ),
      ),
  };
}

/**
 * Reset all linker state.
 */
export function resetObjectEntityLinks() {
  objectEntityLinks.clear();
  objectLinksByObjectNode.clear();
  objectLinksByEntity.clear();
  linkCounter = 0;

  return {
    reset: true,
    linkCount: 0,
  };
}

export {
  normalizeLinkText,
  normalizeIdentifier,
  extractEntityNodes,
  extractObjectNodes,
  getEntityNames,
  getEntityCandidateIds,
  getObjectValues,
  getObjectCandidateIds,
  createLinkKey,
  cloneObjectEntityLink,
};