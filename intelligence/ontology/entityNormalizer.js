import {
  ENTITY_ALIASES,
} from "./entityAliases.js";

function normalizeEntityName(name = "") {

  const original =
    String(name).trim();

  if (!original) {
    return "";
  }

  const lookup =
    original
      .toLowerCase()
      .replace(/\s+/g, " ");

  return (
    ENTITY_ALIASES[lookup] ??
    original
  );

}

export {
  normalizeEntityName,
};
