# Carbon Brain Architecture

Carbon Brain is the reasoning layer of Carbon Axis Exchange. It is **not** a conventional RAG stack. Retrieval is an input — not the product.

## Design Principles

1. **Pipelines instead of monoliths** — semantic, reasoning, and orchestration each compose stages.
2. **Clear separation of responsibilities** — retrieval, graph, inference, planning, truth, and response generation stay independent.
3. **Immutable execution plans** — the planner decides *what* to run before modules execute.
4. **Shared reasoning context** — modules mutate one `ReasoningContext` (compiler-style), not anonymous bags of state.
5. **Deterministic inference** — no OpenAI inside inference, contradiction detection, confidence, or truth evaluation.
6. **Explainable truth** — every conclusion carries evidence, conflicts, confidence, and a reasoning path.
7. **Modular orchestration** — stages plug into the Carbon Brain engine without rewriting the core loop.
8. **Storage-agnostic graph access** — registries and traversal sit above persistence details.

## System Flow

```
User Question
      │
      ▼
Query Planner  →  ExecutionPlan
      │
      ▼
Semantic Retrieval          (if planned)
      │
      ▼
Graph Traversal / Path      (if planned)
      │
      ▼
Inference Engine            (if planned)
      │
      ▼
Reasoning Pipeline
  ├─ Evidence Collection
  ├─ Contradiction Detection
  ├─ Confidence Calculation
  └─ Explanation Builder
      │
      ▼
Truth Engine
      │
      ▼
Response Generator          (optional LLM)
```

## Layer Map

| Layer | Location | Role |
|-------|----------|------|
| Bootstrap / Engine | `intelligence/engine`, `intelligence/bootstrap` | Lifecycle, infrastructure guards |
| Orchestration | `intelligence/orchestration` | Stage registry and pipeline execution |
| Retrieval | `intelligence/retrieval` | Semantic search over knowledge chunks |
| Semantic knowledge | `intelligence/truth/semanticPipeline.js` + related | Documents → propositions → entities/relationships |
| Graph | `intelligence/graph` | Entity/relationship registries, traversal, augmentation |
| Ontology | `intelligence/ontology` | Predicates, hierarchy, aliases, concept types |
| Inference | `intelligence/reasoning/inferenceEngine.js` | Transitive / ontology-derived facts |
| Planner | `intelligence/planner` | Deterministic execution plans |
| Reasoning | `intelligence/reasoning` | Context, evidence, conflicts, confidence, explanation |
| Truth | `intelligence/truth` | Evidence model, constants, truth evaluation |
| Cache | `intelligence/cache` | Semantic / graph / reasoning caches |
| Telemetry | `intelligence/telemetry` | Per-query metrics and profilers |
| Health | `intelligence/health` | Liveness / readiness / dependencies |
| Learning (v1.5) | `intelligence/learning` | Feedback capture scaffold |
| Services / Routes | `intelligence/services`, `intelligence/routes` | HTTP API surface |

## Core Contracts

### ReasoningContext

Shared mutable state for one query: question, evidence streams, conflicts, confidence, explanation, `executionPlan`, `executionTrace`, and `metrics`.

### ExecutionPlan

Planner output: strategy + capability flags (`requiresSemanticSearch`, `requiresGraphTraversal`, `requiresInference`, …). Downstream modules execute only what the plan enables.

### Evidence Model

All sources normalize to one shape (`DOCUMENT | GRAPH | INFERENCE | ONTOLOGY`) so scoring and contradiction logic never branch on origin.

## What Calls OpenAI

| Module | OpenAI? |
|--------|---------|
| Semantic retrieval / embeddings | Yes (upstream) |
| Response generation | Yes (optional) |
| Inference Engine | **No** |
| Contradiction Detector | **No** |
| Confidence Engine | **No** |
| Truth Engine | **No** |
| Query Planner | **No** |
| Explanation Builder | **No** |

## Version Stance

**Carbon Brain v1.0** is feature-complete for:

- Knowledge graph construction from documents
- Deterministic planning and reasoning
- Explainable truth evaluation
- Caching, telemetry hooks, health probes
- Stabilization test + benchmark harness

Further capability growth belongs in v1.5 / v2.0 — see [ROADMAP.md](./ROADMAP.md).

## Ops & maintenance docs

| Doc | Purpose |
|-----|---------|
| [MAINTENANCE.md](./MAINTENANCE.md) | How engineers extend and debug the system |
| [OPERATIONS.md](./OPERATIONS.md) | Render + Hostinger + env + deploy |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Incident playbook |
| [DATA_MODEL.md](./DATA_MODEL.md) | Mongo, registries, evidence, disk layout |