import {
  CONCEPT_HIERARCHY,
} from "./conceptHierarchy.js";

const conceptIndex = new Map();

const aliasIndex = new Map();

const childrenIndex = new Map();

function normalizeKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function initializeHierarchy() {

  for (const [name, definition] of Object.entries(CONCEPT_HIERARCHY)) {

    const normalizedName =
      normalizeKey(name);

    conceptIndex.set(
      normalizedName,
      {
        canonicalName: name,
        ...definition,
      }
    );

    aliasIndex.set(
      normalizedName,
      name
    );

    if (Array.isArray(definition.aliases)) {

      for (const alias of definition.aliases) {

        aliasIndex.set(
          normalizeKey(alias),
          name
        );

      }

    }

    if (definition.parent) {

      if (!childrenIndex.has(definition.parent)) {

        childrenIndex.set(
          definition.parent,
          []
        );

      }

      childrenIndex
        .get(definition.parent)
        .push(name);

    }

  }

}

initializeHierarchy();

function resolveConcept(name = "") {

  const canonical =
    aliasIndex.get(
      normalizeKey(name)
    );

  if (!canonical) {

    return null;

  }

  return conceptIndex.get(
    normalizeKey(canonical)
  );

}

function getParent(name = "") {

  const concept =
    resolveConcept(name);

  return concept?.parent ?? null;

}

function getChildren(name = "") {

  const concept =
    resolveConcept(name);

  if (!concept) {

    return [];

  }

  return [
    ...(childrenIndex.get(
      concept.canonicalName
    ) || [])
  ];

}

function getAncestors(name = "") {

  const ancestors = [];

  let current =
    resolveConcept(name);

  while (
    current &&
    current.parent
  ) {

    ancestors.push(
      current.parent
    );

    current =
      resolveConcept(
        current.parent
      );

  }

  return ancestors;

}

function getDescendants(name = "") {

  const descendants = [];

  function visit(parent) {

    const children =
      getChildren(parent);

    for (const child of children) {

      descendants.push(child);

      visit(child);

    }

  }

  visit(name);

  return descendants;

}

function isAncestorOf(parent, child) {

  return getAncestors(child)
    .includes(parent);

}

function isDescendantOf(child, parent) {

  return getAncestors(child)
    .includes(parent);

}

function getLowestCommonAncestor(a, b) {

  const first = [
    resolveConcept(a)?.canonicalName,
    ...getAncestors(a),
  ];

  const second =
    new Set([
      resolveConcept(b)?.canonicalName,
      ...getAncestors(b),
    ]);

  return (
    first.find(
      concept =>
        second.has(concept)
    ) ?? null
  );

}

export {

  resolveConcept,

  getParent,

  getChildren,

  getAncestors,

  getDescendants,

  isAncestorOf,

  isDescendantOf,

  getLowestCommonAncestor,

};
