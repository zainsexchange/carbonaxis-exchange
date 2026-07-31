# Carbon Brain Roadmap

## v1.0 — Feature Complete (current)

Capability complete for a deterministic knowledge + reasoning platform:

- Semantic pipeline → propositions → entities / relationships
- Ontology + hierarchy resolution
- Knowledge graph registries and traversal (BFS, shortest path)
- Inference engine (transitive / ontology IS_A)
- Query planner with explicit execution strategies
- Reasoning pipeline + shared `ReasoningContext`
- Truth engine with contradictions, confidence, explainability
- Cache layer, telemetry hooks, health probes
- Test / regression / benchmark harness
- Product documentation in `docs/`

**v1.0 focus now:** stabilize — testing depth, performance evidence, production hardening — not new cognitive features.

### Stabilization sprints

1. **Testing** — expand fixtures, raise public-API coverage, keep regression floors green
2. **Performance** — 10k entities / 100k relationships benches, memory profiles, cache ratios
3. **Quality** — false-positive inference review, contradiction accuracy, confidence calibration
4. **Production** — structured logging, request IDs, timeouts, rate limits, graceful shutdown, config validation

---

## v1.5 — Operational Learning & Scale

- Feedback engine (live beyond the scaffold in `intelligence/learning/feedbackEngine.js`)
- Advanced inference rules (`PART_OF`, `LOCATED_IN`, `CAUSES`, …)
- Incremental graph updates
- Planner optimization from feedback (which strategies win)
- Distributed / shared cache
- Richer ontology branches for sustainability & policy domains

Feedback loop (system learning, not model training):

```
User question → Answer → User feedback
  → confidence adjustment
  → rule tuning
  → planner optimization
```

Questions the feedback loop should answer:

- Which planner strategies produce the best answers?
- Which inference rules create false positives?
- Which ontology branches are traversed most?
- Which queries consistently miss the cache?

---

## v2.0 — Agentic & Probabilistic Reasoning

- Multi-agent reasoning
- Parallel execution plans
- Temporal reasoning
- Probabilistic / Dempster–Shafer evidence fusion
- Policy simulation
- Cross-document hypothesis generation

At this stage Carbon Brain stops being “a knowledge graph with AI” and becomes an **agentic reasoning system** that can build and execute its own plans.

Example:

> Compare UAE and Saudi Arabia hydrogen policies.

```
Retrieve UAE policy
  → Retrieve Saudi policy
  → Extract entities
  → Compare graph neighborhoods
  → Apply inference
  → Detect contradictions
  → Build comparison
  → Generate answer
```

---

## Non-Goals (near term)

- Replacing deterministic truth with LLM judgment
- Training foundation models inside this repository
- Coupling retrieval, reasoning, and response generation into one module
- Materializing every inferred edge into the registry without provenance

---

## Guiding Constraint

If a proposed feature breaks any of these, it does not ship:

1. Pipelines over monoliths
2. Deterministic core reasoning
3. Explainable truth objects
4. Explicit execution plans
5. Shared reasoning context with traces and metrics

Architecture discipline is the product moat. Features inherit it — they must not erase it.
