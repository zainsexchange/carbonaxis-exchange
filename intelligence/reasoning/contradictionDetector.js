/**
 * Contradiction discovery only — no confidence scoring.
 */

import {
  EVIDENCE_POLARITY,
  MULTI_VALUED_PREDICATES,
} from "../truth/truthConstants.js";

function claimIdentity(record = {}) {
  const subjectEntityId = String(
    record.subjectEntityId || "",
  ).trim();

  const predicate = String(
    record.metadata?.canonicalPredicate ||
      record.predicate ||
      "",
  )
    .trim()
    .toUpperCase();

  const objectEntityId = String(
    record.objectEntityId || "",
  ).trim();

  if (!subjectEntityId || !predicate) {
    return null;
  }

  return {
    subjectEntityId,
    predicate,
    objectEntityId,
    polarity:
      record.metadata?.polarity ||
      EVIDENCE_POLARITY.AFFIRMS,
    key: `${subjectEntityId.toLowerCase()}::${predicate}`,
    objectKey: objectEntityId
      ? `${subjectEntityId.toLowerCase()}::${predicate}::${objectEntityId.toLowerCase()}`
      : null,
  };
}

/**
 * Detect contradictions across normalized evidence.
 *
 * @param {object[]} evidence
 * @returns {object[]}
 */
export function detectContradictions(
  evidence = [],
) {
  const items = Array.isArray(evidence)
    ? evidence
    : [];

  const byObjectClaim = new Map();
  const byExclusiveClaim = new Map();
  const multiValued = new Set(
    MULTI_VALUED_PREDICATES,
  );

  for (const record of items) {
    const identity = claimIdentity(record);

    if (!identity) {
      continue;
    }

    if (identity.objectKey) {
      const bucket =
        byObjectClaim.get(
          identity.objectKey,
        ) ?? [];

      bucket.push(record);
      byObjectClaim.set(
        identity.objectKey,
        bucket,
      );
    }

    if (
      !multiValued.has(identity.predicate) &&
      identity.objectEntityId
    ) {
      const bucket =
        byExclusiveClaim.get(
          identity.key,
        ) ?? [];

      bucket.push(record);
      byExclusiveClaim.set(
        identity.key,
        bucket,
      );
    }
  }

  const contradictions = [];
  const seenKeys = new Set();

  for (const [
    objectKey,
    records,
  ] of byObjectClaim) {
    const affirming = records.filter(
      (record) =>
        (record.metadata?.polarity ||
          EVIDENCE_POLARITY.AFFIRMS) ===
        EVIDENCE_POLARITY.AFFIRMS,
    );

    const conflicting = records.filter(
      (record) =>
        record.metadata?.polarity ===
        EVIDENCE_POLARITY.NEGATES,
    );

    if (
      affirming.length === 0 ||
      conflicting.length === 0
    ) {
      continue;
    }

    const sample = affirming[0];
    const key = `polarity::${objectKey}`;

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);

    contradictions.push({
      type: "POLARITY_CONFLICT",
      subjectEntityId:
        sample.subjectEntityId,
      predicate: sample.predicate,
      objectEntityId:
        sample.objectEntityId,
      supportingEvidence: affirming,
      conflictingEvidence: conflicting,
    });
  }

  for (const [
    claimKey,
    records,
  ] of byExclusiveClaim) {
    const objects = [
      ...new Set(
        records
          .map(
            (record) =>
              record.objectEntityId,
          )
          .filter(Boolean),
      ),
    ];

    if (objects.length < 2) {
      continue;
    }

    const alreadyCovered =
      contradictions.some(
        (item) =>
          `${String(item.subjectEntityId || "")
            .toLowerCase()}::${item.predicate}` ===
          claimKey,
      );

    if (alreadyCovered) {
      continue;
    }

    const sample = records[0];
    const key = `object::${claimKey}`;

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);

    contradictions.push({
      type: "OBJECT_CONFLICT",
      subjectEntityId:
        sample.subjectEntityId,
      predicate: sample.predicate,
      objectEntityId: null,
      objectEntityIds: objects,
      supportingEvidence: [],
      conflictingEvidence: records,
    });
  }

  return contradictions;
}

export default detectContradictions;
