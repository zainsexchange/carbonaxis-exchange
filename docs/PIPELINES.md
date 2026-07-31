# Carbon Brain Pipelines

Carbon Brain uses the same compositional idea everywhere: **small stages, one orchestrator, shared context**.

## 1. Semantic Pipeline

**Entry:** `intelligence/truth/semanticPipeline.js` (+ proposition / entity / predicate helpers)

```
Documents
   → clean / contextualize
   → proposition extraction
   → entity resolution
   → predicate canonicalization
   → entity + relationship registration
   → graph augmentation / sync
```

Outputs feed the Entity Registry, Relationship Registry, and Knowledge Graph Store.

## 2. Carbon Brain Orchestration Pipeline

**Entry:** `intelligence/engine/carbonBrainEngine.js`  
**Stages:** `intelligence/orchestration/*`

Typical stage composition:

1. Bootstrap / infrastructure
2. Semantic retrieval
3. Evidence ranking + clustering
4. Semantic knowledge / graph stages
5. Reasoning query planning (graph-side)
6. Multi-hop reasoning
7. Truth package evaluation
8. Response generation (LLM)

Stages are registered in `stageRegistry.js` and selected via `carbonBrainStages.js`.

## 3. Query Planning

**Entry:** `intelligence/planner/queryPlanner.js`

```
Question
  → match PLANNER_RULES
  → ExecutionPlan (strategy + flags)
  → attach to ReasoningContext
```

Planning is deterministic. It does not call OpenAI.

Example strategies:

| Question pattern | Strategy |
|------------------|----------|
| “What is …” | `ONTOLOGY` |
| “How … related …” | `GRAPH` (+ shortest path) |
| “Is X a Y?” | `REASONING` (+ inference) |
| “Compare A and B” | `COMPARISON` |

## 4. Reasoning Pipeline

**Entry:** `intelligence/reasoning/reasoningPipeline.js`

```
planQuery (if needed)
  → apply plan to evidence streams
  → Evidence Collection
  → Contradiction Detection
  → Confidence Calculation
  → Explanation Builder
```

Each stage appends to `context.executionTrace` and updates `context.metrics`.

## 5. Truth Evaluation

**Entry:** `intelligence/truth/truthEngine.js`

```
runReasoningPipeline(context)
  → buildTruthResult(reasoning)
  → record telemetry
```

Truth evaluation never retrieves and never calls OpenAI. It only judges injected evidence.

## 6. Inference Pass

**Entry:** `intelligence/reasoning/inferenceEngine.js`

Usually invoked when `executionPlan.requiresInference === true`:

```
runInference()
  → inferTransitiveRelationships()
  → inferOntologyRelationships()
```

Inferred facts are returned as evidence candidates — not silently written into the registry.

## Pipeline Consistency Rules

1. **Upstream produces, downstream consumes** — retrieval/graph/inference inject; truth does not fetch.
2. **Plan before execute** — disabled streams are cleared before evidence collection.
3. **Trace everything** — stage timings live on `executionTrace`.
4. **Cache at boundaries** — semantic, graph, and reasoning caches are independent.
5. **LLM last** — response generation may narrate a truth object; it must not invent the truth object.

## Context Mutation Pattern

```
ReasoningContext
  .beginStage(name)
  // work
  .endStage(name, details)
  .setMetric(key, ms)
  .markTotal(startedAt)
```

Treat the context like a compiler IR for one query.
