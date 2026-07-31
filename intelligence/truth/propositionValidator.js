function isValidProposition(p = {}) {
  return (
    p &&
    p.subject &&
    p.predicate &&
    (p.object || p.objectEntityId)
  );
}

export function validatePropositions(propositions = []) {
  const valid = [];
  const invalid = [];

  for (const proposition of propositions) {
    if (isValidProposition(proposition)) {
      valid.push(proposition);
    } else {
      invalid.push({
        proposition,
        reason: {
          missingSubject: !proposition.subject,
          missingPredicate: !proposition.predicate,
          missingObject:
            !proposition.object &&
            !proposition.objectEntityId,
        },
      });
    }
  }

  return {
    valid,
    invalid,
  };
}

export {
  isValidProposition,
};
