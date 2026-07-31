/**
 * In-memory canonical entity registry.
 *
 * Responsibilities:
 * - Assign stable sequential entity IDs.
 * - Deduplicate exact normalized canonical names.
 * - Preserve aliases and candidate IDs.
 * - Track occurrence counts.
 *
 * This is an in-memory implementation. It can later be replaced by MongoDB
 * without changing the public API.
 */

const registryByKey = new Map();
const registryById = new Map();

let entitySequence = 0;

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Produces a stable lookup key.
 *
 * Examples:
 *
 * "Pakistan Green Transition Strategy"
 * "Pakistan   Green Transition Strategy"
 * "Pakistan Green Transition Strategy."
 *
 * all become:
 *
 * "pakistan green transition strategy"
 *
 * @param {unknown} value
 * @returns {string}
 */
function createCanonicalKey(value) {
  return normalizeText(value)
    .replace(/[.:;,!?]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * @param {number} sequence
 * @returns {string}
 */
function formatEntityId(sequence) {
  return `ENTITY_${String(sequence).padStart(6, "0")}`;
}

/**
 * @param {unknown[]} values
 * @returns {string[]}
 */
function normalizeAliases(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const aliasesByKey = new Map();

  for (const value of values) {
    const alias = normalizeText(value)
      .replace(/[.:;,!?]+$/g, "")
      .trim();

    const key = createCanonicalKey(alias);

    if (!alias || !key) {
      continue;
    }

    if (!aliasesByKey.has(key)) {
      aliasesByKey.set(key, alias);
    }
  }

  return [...aliasesByKey.values()];
}

/**
 * Merges aliases without changing their existing display form.
 *
 * @param {string[]} currentAliases
 * @param {string[]} incomingAliases
 * @returns {string[]}
 */
function mergeAliases(
  currentAliases = [],
  incomingAliases = [],
) {
  return normalizeAliases([
    ...currentAliases,
    ...incomingAliases,
  ]);
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeNullableText(value) {
  const normalized = normalizeText(value);

  return normalized || null;
}

/**
 * @param {object} resolution
 * @returns {string|null}
 */
function getCanonicalName(resolution = {}) {
  return normalizeNullableText(
    resolution.canonicalSubject ||
      resolution.resolvedSubject ||
      resolution.semanticCanonicalSubject ||
      resolution.semanticSubject ||
      resolution.subject,
  );
}

/**
 * @param {object} resolution
 * @returns {string[]}
 */
function getAliases(resolution = {}) {
  const canonicalName = getCanonicalName(resolution);

  return normalizeAliases([
    canonicalName,
    ...(Array.isArray(resolution.aliases)
      ? resolution.aliases
      : []),
    ...(Array.isArray(resolution.subjectAliases)
      ? resolution.subjectAliases
      : []),
  ]);
}

/**
 * Registers or updates an entity.
 *
 * Exact normalized canonical names are merged.
 * Similar names are intentionally not merged yet.
 *
 * @param {{
 *   canonicalSubject?: string,
 *   resolvedSubject?: string,
 *   semanticCanonicalSubject?: string,
 *   semanticSubject?: string,
 *   subject?: string,
 *   entityType?: string,
 *   subjectEntityType?: string,
 *   parentCountry?: string|null,
 *   subjectParentCountry?: string|null,
 *   aliases?: string[],
 *   subjectAliases?: string[],
 *   entityCandidateId?: string|null,
 *   subjectEntityCandidateId?: string|null
 * }} subjectResolution
 *
 * @returns {{
 *   entityId: string,
 *   created: boolean,
 *   entity: object
 * }}
 */
function registerEntity(subjectResolution = {}) {
  const canonicalName =
    getCanonicalName(subjectResolution);

  if (!canonicalName) {
    throw new TypeError(
      "registerEntity requires a canonical subject.",
    );
  }

  const canonicalKey =
    createCanonicalKey(canonicalName);

  if (!canonicalKey) {
    throw new TypeError(
      "registerEntity could not create a canonical key.",
    );
  }

  const incomingEntityType =
    normalizeNullableText(
      subjectResolution.entityType ||
        subjectResolution.subjectEntityType,
    ) || "generic_entity";

  const incomingParentCountry =
    normalizeNullableText(
      subjectResolution.parentCountry ||
        subjectResolution.subjectParentCountry,
    );

  const incomingCandidateId =
    normalizeNullableText(
      subjectResolution.entityCandidateId ||
        subjectResolution.subjectEntityCandidateId,
    );

  const incomingAliases =
    getAliases(subjectResolution);

  const existingEntity =
    registryByKey.get(canonicalKey);

  if (existingEntity) {
    const now = new Date().toISOString();

    existingEntity.aliases =
      mergeAliases(
        existingEntity.aliases,
        incomingAliases,
      );

    existingEntity.occurrenceCount += 1;
    existingEntity.updatedAt = now;

    /*
     * Preserve the first meaningful value, but allow a generic placeholder
     * to be upgraded when better metadata arrives later.
     */
    if (
      existingEntity.entityType === "generic_entity" &&
      incomingEntityType !== "generic_entity"
    ) {
      existingEntity.entityType =
        incomingEntityType;
    }

    if (
      !existingEntity.parentCountry &&
      incomingParentCountry
    ) {
      existingEntity.parentCountry =
        incomingParentCountry;
    }

    if (
      incomingCandidateId &&
      !existingEntity.candidateIds.includes(
        incomingCandidateId,
      )
    ) {
      existingEntity.candidateIds.push(
        incomingCandidateId,
      );
    }

    return {
      entityId: existingEntity.entityId,
      created: false,
      entity: cloneEntity(existingEntity),
    };
  }

  entitySequence += 1;

  const now = new Date().toISOString();
  const entityId =
    formatEntityId(entitySequence);

  const entity = {
    entityId,
    canonicalKey,
    canonicalName,
    aliases: incomingAliases,
    entityType: incomingEntityType,
    parentCountry: incomingParentCountry,

    candidateId:
      incomingCandidateId,

    candidateIds:
      incomingCandidateId
        ? [incomingCandidateId]
        : [],

    occurrenceCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  registryByKey.set(canonicalKey, entity);
  registryById.set(entityId, entity);

  return {
    entityId,
    created: true,
    entity: cloneEntity(entity),
  };
}

/**
 * @param {string} entityId
 * @returns {object|null}
 */
function getEntityById(entityId) {
  const normalizedId =
    normalizeText(entityId);

  const entity =
    registryById.get(normalizedId);

  return entity
    ? cloneEntity(entity)
    : null;
}

/**
 * @param {string} canonicalName
 * @returns {object|null}
 */
function getEntityByName(canonicalName) {
  const canonicalKey =
    createCanonicalKey(canonicalName);

  const entity =
    registryByKey.get(canonicalKey);

  return entity
    ? cloneEntity(entity)
    : null;
}

/**
 * @returns {object[]}
 */
function listEntities() {
  return [...registryById.values()]
    .sort((left, right) =>
      left.entityId.localeCompare(
        right.entityId,
      ),
    )
    .map(cloneEntity);
}

/**
 * @returns {number}
 */
function getRegistrySize() {
  return registryById.size;
}

/**
 * Resets the in-memory registry.
 *
 * Intended for isolated tests and local development.
 */
function resetEntityRegistry() {
  registryByKey.clear();
  registryById.clear();
  entitySequence = 0;
}

/**
 * Prevent callers from mutating registry state through returned objects.
 *
 * @param {object} entity
 * @returns {object}
 */
function cloneEntity(entity) {
  return {
    ...entity,
    aliases: [...entity.aliases],
    candidateIds: [...entity.candidateIds],
  };
}

export {
  createCanonicalKey,
  formatEntityId,
  getEntityById,
  getEntityByName,
  getRegistrySize,
  listEntities,
  mergeAliases,
  registerEntity,
  resetEntityRegistry,
};