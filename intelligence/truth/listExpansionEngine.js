import {
  PROTECTED_CONCEPTS,
} from "../ontology/protectedConcepts.js";

const LEADING_CONNECTOR_PATTERN =
  /^(?:and|or|as well as)\s+/i;

const TRAILING_PUNCTUATION_PATTERN =
  /[.;:!?]+$/;

function normalizeWhitespace(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanListItem(value = "") {
  return normalizeWhitespace(value)
    .replace(LEADING_CONNECTOR_PATTERN, "")
    .replace(TRAILING_PUNCTUATION_PATTERN, "")
    .trim();
}

function createPlaceholder(index) {
  return `__PROTECTED_PHRASE_${index}__`;
}

function protectKnownPhrases(value = "") {
  let protectedText =
    normalizeWhitespace(value);

  const replacements = [];

  PROTECTED_CONCEPTS.forEach(
    (phrase, index) => {
      const escapedPhrase =
        phrase.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

      const pattern =
        new RegExp(
          `\\b${escapedPhrase}\\b`,
          "gi"
        );

      protectedText =
        protectedText.replace(
          pattern,
          (matchedText) => {
            const placeholder =
              createPlaceholder(index);

            replacements.push({
              placeholder,
              value: matchedText,
            });

            return placeholder;
          }
        );
    }
  );

  return {
    protectedText,
    replacements,
  };
}

function restoreProtectedPhrases(
  value = "",
  replacements = []
) {
  let restoredValue = value;

  for (const replacement of replacements) {
    restoredValue =
      restoredValue.replaceAll(
        replacement.placeholder,
        replacement.value
      );
  }

  return restoredValue;
}

function hasListSignal(value = "") {
  const text =
    normalizeWhitespace(value);

  if (!text) {
    return false;
  }

  const commaCount =
    (text.match(/,/g) || []).length;

  const hasFinalConjunction =
    /,\s*(?:and|or)\s+/i.test(text) ||
    /\s+(?:and|or)\s+/i.test(text);

  return (
    commaCount >= 1 &&
    hasFinalConjunction
  );
}

function containsLikelySentenceBoundary(
  value = ""
) {
  return /[.!?]\s+[A-Z]/.test(
    String(value)
  );
}

function containsLikelyIndependentClause(
  value = ""
) {
  const text =
    normalizeWhitespace(value);

  const verbSignals =
    text.match(
      /\b(?:is|are|was|were|has|have|had|will|shall|must|supports?|targets?|aims?|plans?|seeks?|requires?|includes?|provides?|reduces?|increases?|mobilizes?|develops?|establishes?)\b/gi
    ) || [];

  return verbSignals.length > 1;
}

function splitProtectedList(
  protectedText = ""
) {
  return protectedText
    .replace(
      /,\s*(?:and|or)\s+/gi,
      ","
    )
    .split(",")
    .map(cleanListItem)
    .filter(Boolean);
}

function isSafeListItem(value = "") {
  const item =
    cleanListItem(value);

  if (!item) {
    return false;
  }

  if (item.length < 2) {
    return false;
  }

  if (
    containsLikelySentenceBoundary(
      item
    )
  ) {
    return false;
  }

  return true;
}

function shouldExpandObject(
  object = ""
) {
  const text =
    normalizeWhitespace(object);

  if (!text) {
    return false;
  }

  if (!hasListSignal(text)) {
    return false;
  }

  if (
    containsLikelySentenceBoundary(
      text
    )
  ) {
    return false;
  }

  if (
    containsLikelyIndependentClause(
      text
    )
  ) {
    return false;
  }

  return true;
}

function findContextPrefix(
  object = "",
  firstListItem = ""
) {
  const fullObject =
    normalizeWhitespace(object);

  const firstItem =
    cleanListItem(firstListItem);

  if (
    !fullObject ||
    !firstItem
  ) {
    return "";
  }

  const firstItemIndex =
    fullObject
      .toLowerCase()
      .indexOf(
        firstItem.toLowerCase()
      );

  if (firstItemIndex <= 0) {
    return "";
  }

  const prefix =
    normalizeWhitespace(
      fullObject.slice(
        0,
        firstItemIndex
      )
    );

  if (!prefix) {
    return "";
  }

  const hasContextSignal =
    /\b(?:through|via|using|with|by|from|under|within|across|toward|towards|for|into|of)\b\s*$/i.test(
      prefix
    );

  if (!hasContextSignal) {
    return "";
  }

  return prefix;
}

function attachContextPrefix(
  prefix = "",
  item = ""
) {
  const normalizedPrefix =
    normalizeWhitespace(prefix);

  const normalizedItem =
    cleanListItem(item);

  if (!normalizedPrefix) {
    return normalizedItem;
  }

  if (!normalizedItem) {
    return normalizedPrefix;
  }

  return normalizeWhitespace(
    `${normalizedPrefix} ${normalizedItem}`
  );
}

function buildExpandedProposition(
  proposition,
  object,
  index,
  total,
  contextPrefix = ""
) {
  const cleanedObject =
    cleanListItem(object);

  const contextualObject =
    attachContextPrefix(
      contextPrefix,
      cleanedObject
    );

  return {
    ...proposition,

    object:
      contextualObject,

    expanded: true,

    contextPreserved:
      Boolean(contextPrefix),

    contextPrefix:
      contextPrefix || null,

    expansionIndex: index,

    expansionCount: total,

    valid: Boolean(
      proposition.subject &&
      proposition.predicate &&
      contextualObject
    ),
  };
}

function expandSingleProposition(
  proposition = {}
) {
  const object =
    normalizeWhitespace(
      proposition.object
    );

  if (
    !shouldExpandObject(object)
  ) {
    return [
      {
        ...proposition,
        object:
          cleanListItem(object),
        expanded:
          Boolean(
            proposition.expanded
          ),
        expansionIndex: null,
        expansionCount: null,
      },
    ];
  }

  const {
    protectedText,
    replacements,
  } = protectKnownPhrases(object);

  const protectedItems =
    splitProtectedList(
      protectedText
    );

  const restoredItems =
    protectedItems
      .map((item) =>
        restoreProtectedPhrases(
          item,
          replacements
        )
      )
      .map(cleanListItem)
      .filter(isSafeListItem);

  const contextPrefix =
    findContextPrefix(
      object,
      restoredItems[0]
    );

  if (restoredItems.length < 2) {
    return [
      {
        ...proposition,
        object:
          cleanListItem(object),
        expanded:
          Boolean(
            proposition.expanded
          ),
        expansionIndex: null,
        expansionCount: null,
      },
    ];
  }

  return restoredItems.map(
    (item, index) =>
      buildExpandedProposition(
        proposition,
        item,
        index,
        restoredItems.length,
        contextPrefix
      )
  );
}

export function expandPropositionLists(
  propositions = []
) {
  if (!Array.isArray(propositions)) {
    return [];
  }

  return propositions.flatMap(
    (proposition) =>
      expandSingleProposition(
        proposition
      )
  );
}