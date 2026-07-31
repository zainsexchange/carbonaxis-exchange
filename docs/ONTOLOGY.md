# Carbon Brain Ontology

The ontology layer gives Carbon Brain shared meaning for entities, predicates, and concept hierarchies — independent of any single document.

## Location

```
intelligence/ontology/
  canonicalPredicates.js
  conceptHierarchy.js
  hierarchyResolver.js
  entityTypes.js
  entityAliases.js
  entityNormalizer.js
  protectedConcepts.js
```

## Responsibilities

| Module | Role |
|--------|------|
| `canonicalPredicates.js` | Stable predicate vocabulary |
| `conceptHierarchy.js` | Parent/child concept graph (energy, fuels, tech, …) |
| `hierarchyResolver.js` | `resolveConcept`, `getAncestors`, `getChildren`, LCA helpers |
| `entityTypes.js` | Typed entity categories |
| `entityAliases.js` / `entityNormalizer.js` | Alias → canonical name |
| `protectedConcepts.js` | Phrases that must not be over-split by list expansion |

## Hierarchy Resolver API

```js
resolveConcept(name)   // canonical concept or null
getParent(name)
getChildren(name)
getAncestors(name)     // rootward chain
getDescendants(name)
getLowestCommonAncestor(a, b)
```

Example:

```
Green Hydrogen
  → Hydrogen
    → Clean Fuel
      → Energy
```

## How Ontology Enters Reasoning

1. **Predicate canonicalization** — surface forms map to ontology predicates before registration.
2. **Entity normalization** — aliases collapse to canonical subjects/objects.
3. **Ontology inference** — `inferOntologyRelationships()` uses `getAncestors()` to propose missing `IS_A` edges when ancestor entities already exist in the registry.
4. **Planner strategies** — definition / classification questions preferentially enable ontology expansion.

## Relationship to the Graph

Ontology ≠ the knowledge graph.

- **Ontology** = reusable conceptual schema and hierarchy.
- **Knowledge graph** = instance entities and relationships extracted from documents (plus inferred edges as evidence).

Inference may *propose* ontology-backed edges; V1 does not silently materialize them into the registry.

## Extending the Ontology

1. Add concepts to `conceptHierarchy.js` with `parent` and optional `aliases`.
2. Keep names human-readable and stable (`"Renewable Energy"`, not ad-hoc IDs).
3. Add predicates to `canonicalPredicates.js` before using them in extraction rules.
4. Prefer aliases over duplicate concept nodes.
5. Add planner/inference coverage when a new branch becomes query-critical.

## Design Rules

- Prefer **canonical names** in registries; keep aliases in metadata.
- Do not invent hierarchy edges from LLM prose — hierarchy is curated.
- Multi-parent taxonomies are allowed (`IS_A` is multi-valued for conflict detection).
- Keep ontology modules free of OpenAI calls.
