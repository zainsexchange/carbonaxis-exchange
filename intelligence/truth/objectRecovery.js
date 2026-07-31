function normalizeWhitespace(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractObject(clause = "", predicate = null) {

  const text =
    normalizeWhitespace(clause);

  if (!text)
    return null;

  if (!predicate)
    return text;

  const pattern =
    new RegExp(
      "\\b" +
      escapeRegex(predicate) +
      "\\b",
      "i"
    );

  const match =
    pattern.exec(text);

  if (!match)
    return text;

  const object =
    normalizeWhitespace(
      text.slice(
        match.index +
        match[0].length
      )
    );

  return object || null;
}

export function recoverObjects(
  propositions = []
) {

  return propositions.map(
    proposition => {

      const object =
        extractObject(
          proposition.clause,
          proposition.predicate
        );

      return {

        ...proposition,

        object,

        valid:
          Boolean(
            proposition.subject &&
            proposition.predicate &&
            object
          )

      };

    }
  );

}