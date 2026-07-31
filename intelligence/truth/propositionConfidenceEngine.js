function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function scoreSubject(proposition = {}) {
  if (!proposition.subject) return 0;

  if (
    proposition.subject.length > 2
  ) {
    return 1;
  }

  return 0.7;
}

function scorePredicate(proposition = {}) {
  if (!proposition.predicate)
    return 0;

  return 1;
}

function scoreObject(proposition = {}) {
  if (!proposition.object)
    return 0;

  if (
    proposition.object.length > 3
  )
    return 1;

  return 0.7;
}

function scoreStructuredValue(
  proposition = {}
) {
  if (
    !proposition.structuredValue
  )
    return 0.5;

  let score = 0.5;

  if (
    proposition.structuredValue.number !==
    null
  )
    score += 0.2;

  if (
    proposition.structuredValue.unit
  )
    score += 0.1;

  if (
    proposition.structuredValue.currency
  )
    score += 0.1;

  if (
    proposition.structuredValue.year
  )
    score += 0.1;

  return clamp(score);
}

function scoreExpansion(
  proposition = {}
) {
  if (
    proposition.expanded
  )
    return 0.95;

  return 1;
}

function scoreContext(
  proposition = {}
) {
  if (
    proposition.contextPreserved
  )
    return 1;

  return 0.95;
}

function scoreExtraction(
  proposition = {}
) {
  let score = 1;

  if (
    proposition.predicateSource ===
    "missing"
  )
    score -= 0.5;

  if (
    proposition.predicateSource ===
    "inherited"
  )
    score -= 0.05;

  return clamp(score);
}

function weightedAverage(
  values = []
) {
  const totalWeight =
    values.reduce(
      (sum, value) =>
        sum + value.weight,
      0
    );

  const weighted =
    values.reduce(
      (sum, value) =>
        sum +
        value.score *
          value.weight,
      0
    );

  return totalWeight
    ? weighted /
        totalWeight
    : 0;
}

export function evaluatePropositionConfidence(
  proposition = {}
) {
  const breakdown = {

    subject:
      scoreSubject(
        proposition
      ),

    predicate:
      scorePredicate(
        proposition
      ),

    object:
      scoreObject(
        proposition
      ),

    structuredValue:
      scoreStructuredValue(
        proposition
      ),

    expansion:
      scoreExpansion(
        proposition
      ),

    context:
      scoreContext(
        proposition
      ),

    extraction:
      scoreExtraction(
        proposition
      ),

  };

  const confidence =
    weightedAverage([
      {
        score:
          breakdown.subject,
        weight: 2,
      },

      {
        score:
          breakdown.predicate,
        weight: 2,
      },

      {
        score:
          breakdown.object,
        weight: 2,
      },

      {
        score:
          breakdown.structuredValue,
        weight: 1,
      },

      {
        score:
          breakdown.expansion,
        weight: 1,
      },

      {
        score:
          breakdown.context,
        weight: 1,
      },

      {
        score:
          breakdown.extraction,
        weight: 2,
      },
    ]);

  return {

    confidence:
      Number(
        confidence.toFixed(3)
      ),

    confidenceBreakdown:
      breakdown,

  };
}

export function evaluatePropositions(
  propositions = []
) {

  return propositions.map(
    proposition => {

      const confidence =
        evaluatePropositionConfidence(
          proposition
        );

      return {

        ...proposition,

        ...confidence

      };

    }
  );

}