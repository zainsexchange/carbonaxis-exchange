const PREDICATE_PATTERNS = Object.freeze([
  /\b(supports?)\b/i,
  /\b(targets?)\b/i,
  /\b(aims?\s+to)\b/i,
  /\b(plans?\s+to)\b/i,
  /\b(seeks?\s+to)\b/i,
  /\b(establishes?)\b/i,
  /\b(requires?)\b/i,
  /\b(includes?)\b/i,
  /\b(focuses?\s+on)\b/i,
  /\b(prioritizes?)\b/i,
  /\b(provides?)\b/i,
  /\b(reduces?)\b/i,
  /\b(increases?)\b/i,
  /\b(mobilizes?)\b/i,
  /\b(produces?)\b/i,
  /\b(covers?)\b/i,
  /\b(applies?)\b/i,
  /\b(operates?)\b/i,
  /\b(launches?)\b/i,
  /\b(develops?)\b/i,
  /\b(introduces?)\b/i,
  /\b(expects?\s+to)\b/i,
  /\b(will\s+[a-z]+)\b/i,
  /\b(shall\s+[a-z]+)\b/i,
  /\b(must\s+[a-z]+)\b/i,
]);

function normalizeWhitespace(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectExplicitPredicate(clause = "") {
  const text =
    normalizeWhitespace(clause);

  if (!text) {
    return null;
  }

  let bestMatch = null;

  for (const pattern of PREDICATE_PATTERNS) {
    const match =
      text.match(pattern);

    if (!match) {
      continue;
    }

    const candidate = {
      predicate:
        normalizeWhitespace(match[1]),

      index:
        Number(match.index || 0),

      matchedText:
        match[0],
    };

    if (
      !bestMatch ||
      candidate.index <
        bestMatch.index
    ) {
      bestMatch =
        candidate;
    }
  }

  return bestMatch;
}

function shouldInheritPredicate(
  clause = "",
  explicitPredicate = null,
  previousPredicate = null
) {
  if (explicitPredicate) {
    return false;
  }

  if (!previousPredicate) {
    return false;
  }

  const text =
    normalizeWhitespace(clause);

  if (!text) {
    return false;
  }

  const startsLikeContinuation =
    /^(and|or|as well as|including|such as|with|through|by|toward|towards|for|in|on|at|from)\b/i.test(
      text
    );

  const hasNoStrongVerb =
    !/\b(is|are|was|were|has|have|had|will|shall|must|aims?|targets?|plans?|supports?|establishes?|requires?|includes?|focuses?|seeks?|provides?|reduces?|increases?|mobilizes?|produces?|covers?|applies?|operates?|launches?|develops?|introduces?|expects?|prioritizes?)\b/i.test(
      text
    );

  return (
    startsLikeContinuation ||
    hasNoStrongVerb
  );
}

export function recoverPredicates(
  propositions = []
) {
  let previousPredicate = null;

  return propositions.map(
    (item) => {
      const explicit =
        detectExplicitPredicate(
          item.clause
        );

      if (explicit) {
        previousPredicate =
          explicit.predicate;

        return {
          ...item,

          predicate:
            explicit.predicate,

          predicateSource:
            "explicit",

          predicateIndex:
            explicit.index,
        };
      }

      const inherit =
        shouldInheritPredicate(
          item.clause,
          explicit,
          previousPredicate
        );

      if (
        inherit &&
        previousPredicate
      ) {
        return {
          ...item,

          predicate:
            previousPredicate,

          predicateSource:
            "inherited",

          predicateIndex:
            null,
        };
      }

      return {
        ...item,

        predicate: null,

        predicateSource:
          "missing",

        predicateIndex:
          null,
      };
    }
  );
}