# Carbon Brain API

Public module APIs used by orchestration, services, and tests. Paths are relative to the repository root.

## Query Planner

**Module:** `intelligence/planner/queryPlanner.js`

| Function | Description |
|----------|-------------|
| `createExecutionPlan(question)` | Build one `ExecutionPlan` from deterministic rules |
| `planQuery(context)` | Attach plan to `ReasoningContext` and trace the planning stage |
| `matchPlannerRules(question)` | Return matched rule objects (priority sorted) |

**Related:** `executionPlan.js`, `plannerRules.js`

```js
import { createExecutionPlan } from "./intelligence/planner/queryPlanner.js";

const plan = createExecutionPlan("Is Green Hydrogen a clean fuel?");
// plan.strategy === "REASONING"
// plan.requiresInference === true
```

### Execution strategies

```js
EXECUTION_STRATEGY = {
  SEMANTIC, GRAPH, ONTOLOGY, HYBRID, COMPARISON, REASONING
}
```

---

## Reasoning Context & Pipeline

**Modules:**  
`intelligence/reasoning/reasoningContext.js`  
`intelligence/reasoning/reasoningPipeline.js`

| Function / Class | Description |
|------------------|-------------|
| `ReasoningContext` | Shared mutable query state |
| `createReasoningContext(input)` | Normalize plain objects into a context |
| `runReasoningPipeline(input, options?)` | Plan → collect → contradict → confidence → explain |

```js
const context = await runReasoningPipeline({
  question: "What is Green Hydrogen?",
  retrievedChunks,
  graphEvidence,
  ontologyEvidence,
});
```

Options:

- `useCache` (default `true`) — skip recompute on reasoning cache hit

---

## Inference Engine

**Module:** `intelligence/reasoning/inferenceEngine.js`

| Function | Description |
|----------|-------------|
| `runInference()` | Run all V1 inference rules |
| `inferTransitiveRelationships()` | `A IS_A B`, `B IS_A C` ⇒ `A IS_A C` |
| `inferOntologyRelationships()` | Infer missing `IS_A` edges from hierarchy ancestors |

Returns lightweight inferred records (`inferred: true`, `inferenceRule`, `confidence`). Does **not** mutate the relationship registry.

---

## Evidence & Reasoning Modules

| Module | Public API |
|--------|------------|
| `evidenceCollector.js` | `collectEvidence(context)` |
| `contradictionDetector.js` | `detectContradictions(evidence)` |
| `confidenceEngine.js` | `calculateConfidence({ evidence, contradictions })` |
| `explanationBuilder.js` | `buildExplanation({ evidence, contradictions, confidence })` |

---

## Evidence Model

**Module:** `intelligence/truth/evidenceModel.js`

| Function | Description |
|----------|-------------|
| `createDocumentEvidence(item)` | Normalize document evidence |
| `createGraphEvidence(item)` | Normalize graph evidence |
| `createInferenceEvidence(item)` | Normalize inferred evidence |
| `createOntologyEvidence(item)` | Normalize ontology evidence |
| `normalizeEvidence(input)` | Accept arrays or stream bags → universal records |

Universal record fields:

```
evidenceId, sourceType, subjectEntityId, objectEntityId,
predicate, confidence, provenance, inferred, ontology,
explanation, metadata
```

Constants live in `intelligence/truth/truthConstants.js`:

- `TRUTH_STATUS`
- `EVIDENCE_SOURCE`
- `SOURCE_WEIGHTS`
- `EVIDENCE_POLARITY`

---

## Truth Engine

**Module:** `intelligence/truth/truthEngine.js`

| Function | Description |
|----------|-------------|
| `evaluateTruth(input, options?)` | Full reasoning + truth result |
| `buildTruthResult(reasoning)` | Map pipeline output → truth object |

Result shape:

```js
{
  truthStatus,          // SUPPORTED | PARTIALLY_SUPPORTED | CONFLICTING | INSUFFICIENT_EVIDENCE
  confidence,
  supportingEvidence,
  conflictingEvidence,
  inferredEvidence,
  ontologyEvidence,
  explanation,
  recommendations,
  executionPlan,
  executionTrace,
  metrics,
  telemetry
}
```

Legacy document RAG package (citations / retrieval-owned evaluation):

- `intelligence/truth/documentTruthPackage.js`
  - `buildTruthPackage`
  - `buildTruthPackageFromEvidence`

---

## Graph Layer

**Entity Registry** — `intelligence/graph/entityRegistry.js`  
`registerEntity`, `getEntityById`, `getEntityByName`, `listEntities`, `resetEntityRegistry`

**Relationship Registry** — `intelligence/graph/relationshipRegistry.js`  
`registerRelationship`, `createRelationshipKey`, `listRelationships`, `resetRelationshipRegistry`

**Traversal** — `intelligence/graph/graphTraversalEngine.js`  
`initializeGraphIndexes`, `findNeighbors`, `findConnectedEntities`, `findShortestPath`

---

## Cache

| Module | Purpose |
|--------|---------|
| `semanticCache.js` | Retrieval result cache |
| `graphCache.js` | Neighborhood / traversal cache |
| `reasoningCache.js` | Full reasoning pipeline cache |

Each exposes `build*CacheKey`, `get*`, `set*`, `clear*`.

---

## Telemetry & Health

**Telemetry:** `metricsCollector`, `pipelineProfiler`, `graphStatistics`, `plannerStatistics`  
**Health:** `liveness`, `readiness`, `dependencyHealth`

`evaluateTruth` automatically records planner usage and query telemetry.

---

## HTTP Surface (application)

| Route area | Module |
|------------|--------|
| Ask / Carbon Brain | `intelligence/routes/ask.js` |
| Knowledge library | `intelligence/routes/library.js` |
| Ask service | `intelligence/services/askCarbonBrain.js` |

Exact HTTP paths and auth follow the Express app in `server.js`.
