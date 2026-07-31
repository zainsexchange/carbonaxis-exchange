import {
  normalizeEntityName,
} from "../ontology/entityNormalizer.js";

const ENTITY_DICTIONARY = Object.freeze({

  Pakistan: [
    "pakistan",
    "government of pakistan",
    "gop",
    "pakistani government",
    "islamic republic of pakistan",
  ],

  UAE: [
    "uae",
    "united arab emirates",
    "emirates",
    "government of the uae",
  ],

  SaudiArabia: [
    "saudi arabia",
    "ksa",
    "kingdom of saudi arabia",
  ],

  Qatar: [
    "qatar",
    "state of qatar",
  ],

  Oman: [
    "oman",
    "sultanate of oman",
  ],

});

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCanonicalEntity(entity = "") {

  const normalized =
    normalize(entity);

  if (!normalized) {
    return null;
  }

  for (const [canonical, aliases] of Object.entries(ENTITY_DICTIONARY)) {

    if (
      aliases.includes(normalized)
    ) {

      return canonical;

    }

  }

  return entity;
}

function buildEntityId(
  canonicalEntity
) {
  if (!canonicalEntity) {
    return null;
  }

  return (
    "ENTITY_" +
    String(canonicalEntity)
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
  );
}

export function resolveEntities(
  propositions = []
) {

  return propositions.map(
    proposition => {

      const subject =
        normalizeEntityName(
          proposition.subject
        );

      const object =
        proposition.object == null
          ? proposition.object
          : normalizeEntityName(
              proposition.object
            );

      const canonicalEntity =
        resolveCanonicalEntity(
          subject
        );

      return {

        ...proposition,

        subject,

        object,

        canonicalSubject:
          canonicalEntity,

        subjectEntityId:
          buildEntityId(
            canonicalEntity
          ),

        entityResolved:
          canonicalEntity !==
          proposition.subject,

      };

    }
  );

}

export function resolveEntity(
  entity = ""
) {

  const normalizedEntity =
    normalizeEntityName(entity);

  const canonical =
    resolveCanonicalEntity(
      normalizedEntity
    );

  return {

    original:
      entity,

    canonical,

    entityId:
      buildEntityId(
        canonical),

    resolved:
      canonical !== entity

  };

}
