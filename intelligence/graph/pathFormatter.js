/**
 * Format a shortest-path result into a readable reasoning chain.
 *
 * @param {Array<{
 *   entity?: object|null,
 *   relationship?: object|null
 * }>} path
 * @returns {string}
 */
export function formatPath(path = []) {
  if (!Array.isArray(path) || path.length === 0) {
    return "";
  }

  const lines = [];

  for (let index = 0; index < path.length; index += 1) {
    const step = path[index];

    const entityName =
      step?.entity?.canonicalName ||
      step?.entity?.canonicalSubject ||
      step?.entity?.entityId ||
      "Unknown Entity";

    if (index === 0) {
      lines.push(entityName);
      continue;
    }

    const predicate =
      step?.relationship?.canonicalPredicate ||
      step?.relationship?.predicate ||
      "RELATED_TO";

    lines.push("    │");
    lines.push(` ${predicate}`);
    lines.push("    │");
    lines.push(entityName);
  }

  return lines.join("\n");
}

export default formatPath;
