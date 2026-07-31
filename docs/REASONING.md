# Carbon Brain Reasoning

This document describes how Carbon Brain reaches a conclusion.

## Goal

Answer:

> Given retrieved evidence, graph knowledge, inferred facts, and ontology… **what can we state with confidence?**

## Reasoning Stack

```
Evidence Collector
      │
Contradiction Detector
      │
Confidence Engine
      │
Explanation Builder
      │
Truth Engine (status + recommendations)
```

## Evidence Sources

Every item becomes the same universal record:

| `sourceType` | Typical weight | Notes |
|--------------|----------------|-------|
| `DOCUMENT` | 1.00 | Chunk / proposition backed by text |
| `GRAPH` | 0.98 | Registered relationship |
| `ONTOLOGY` | 0.95 | Hierarchy-backed |
| `INFERENCE` | 0.90 | Derived (`inferred: true`) |

The Truth Engine must not care where evidence originated — only the normalized model.

## Contradiction Detection

V1 rules (deterministic):

1. **Polarity conflict** — same subject + predicate + object with `AFFIRMS` vs `NEGATES`  
   Example: `SUPPORTS` vs `DOES_NOT_SUPPORT`
2. **Object conflict** — exclusive predicates pointing at different objects  
   Multi-valued predicates such as `IS_A` / `PART_OF` are allowed multiple parents

Output example:

```js
{
  type: "POLARITY_CONFLICT",
  subjectEntityId,
  predicate: "SUPPORTS",
  objectEntityId,
  supportingEvidence: [...],
  conflictingEvidence: [...]
}
```

## Confidence

Weighted aggregation:

```
overall = Σ(confidence_i × weight_i) / Σ(weight_i)
```

If contradictions exist, apply a global penalty (V1 factor `0.45`) **after** aggregation so the penalty cannot cancel in the ratio.

Per-source averages are also returned:

```
documentConfidence
graphConfidence
inferenceConfidence
ontologyConfidence
```

## Truth Status

| Status | Meaning |
|--------|---------|
| `SUPPORTED` | Consistent evidence, strong confidence |
| `PARTIALLY_SUPPORTED` | Some support, weaker confidence |
| `CONFLICTING` | Contradictions require human review |
| `INSUFFICIENT_EVIDENCE` | Too little or too weak evidence |

Avoid booleans. Reasoning systems need graded outcomes.

## Explainability

Every truth result includes:

- `explanation` — human-readable lines
- `reasoningPath` — subject → predicate → object steps
- `recommendations` — e.g. “Human review required.”
- `executionTrace` — stage timeline
- `executionPlan` — why certain modules ran

No GPT strings are required for this layer. Explanations are deterministic.

## Inference Rules (V1)

```js
INFERENCE_RULES = [
  { id: "TRANSITIVE_IS_A", predicate: "IS_A" }
]
```

Plus ontology ancestor materialization (`ONTOLOGY_IS_A`) when ancestor entities already exist.

Future rules (`PART_OF`, `LOCATED_IN`, `CAUSES`, …) should extend the rule table without rewriting the engine loop.

## Example

Documents / graph:

```
Green Hydrogen IS_A Hydrogen
Hydrogen IS_A Clean Fuel
```

User:

> Is Green Hydrogen a clean fuel?

Plan: `REASONING` (semantic + graph + inference + ontology + truth)

Inference:

```
Green Hydrogen IS_A Clean Fuel   (TRANSITIVE_IS_A)
```

Truth:

```
SUPPORTED
explanation:
  - Knowledge Graph links Green Hydrogen to Hydrogen via IS_A
  - Inference derives Green Hydrogen IS_A Clean Fuel (TRANSITIVE_IS_A)
```

That is the leap beyond “search and hope the chunk contains the answer.”
