# Carbon Brain Maintenance Guide

This guide is for engineers who will operate and extend Carbon Brain after v1.0.

## Quick start (local)

```bash
npm install
cp .env.example .env   # then fill secrets locally — never commit .env
npm start
npm test
```

Useful scripts:

| Command | Purpose |
|---------|---------|
| `npm test` | Unit + integration + regression |
| `npm run test:unit` | Public API unit tests |
| `npm run test:integration` | Full reasoning flow |
| `npm run test:regression` | Fixture answer floors |
| `npm run test:performance` | Smoke latency budgets |
| `npm run bench` | Smoke benchmarks |
| `npm run bench:full` | Larger synthetic graph |

## Architecture map (where to look)

| Concern | Path |
|---------|------|
| Ask / response | `intelligence/services/askCarbonBrain.js` |
| Orchestration stages | `intelligence/orchestration/` |
| Query planner | `intelligence/planner/` |
| Reasoning pipeline | `intelligence/reasoning/` |
| Truth evaluation | `intelligence/truth/truthEngine.js` |
| Evidence model | `intelligence/truth/evidenceModel.js` |
| Graph registries | `intelligence/graph/` |
| Ontology | `intelligence/ontology/` |
| Caches | `intelligence/cache/` |
| Telemetry | `intelligence/telemetry/` |
| Health probes | `intelligence/health/` |
| Product docs | `docs/` |

Read order for newcomers:

1. `docs/ARCHITECTURE.md`
2. `docs/PIPELINES.md`
3. `docs/REASONING.md`
4. This file + `docs/OPERATIONS.md`

## Safe change rules

1. **Do not put OpenAI inside** inference, planner, contradiction, confidence, or truth scoring.
2. **Plan before execute** — extend `plannerRules.js` / `ExecutionPlan`, do not hard-code “run everything” in stages.
3. **Normalize evidence** through `evidenceModel.js` before scoring.
4. **Prefer new modules** over growing `truthEngine.js` or `askCarbonBrain.js` into monoliths.
5. **Update fixtures + regression cases** when planner/truth behavior intentionally changes.
6. **Never commit** `.env`, `uploads/`, PDFs, or API keys.

## Debugging a single query

1. Call `evaluateTruth(...)` or the ask path with a known question.
2. Inspect:
   - `executionPlan` — which modules were supposed to run
   - `executionTrace` — stage timings and counts
   - `metrics` / `telemetry` — latency + cacheHit
   - `supportingEvidence` / `conflictingEvidence`
   - `recommendations`
3. If cache hides a bug, rerun with `{ useCache: false }`.

## Extending inference

Edit `intelligence/reasoning/inferenceEngine.js`:

- Add to `INFERENCE_RULES` for new transitive predicates
- Keep inferred facts as returned evidence (`inferred: true`) until a deliberate materialization policy exists

## Extending the planner

Edit `intelligence/planner/plannerRules.js` and refine in `queryPlanner.js`.

Add a regression case under `tests/fixtures/expected_answers.json`.

## Common maintenance tasks

### Reset in-memory registries (tests / local)

```js
resetEntityRegistry();
resetRelationshipRegistry();
clearReasoningCache();
resetEvidenceSequence();
```

### Rebuild graph indexes after bulk relationship loads

```js
initializeGraphIndexes(); // or refreshIndexes()
```

### Add a permanent regression fixture

1. Create/update JSON under `tests/fixtures/`
2. Wire it in `tests/fixtures/loadFixture.js` usage
3. Add expected strategy/confidence in `expected_answers.json`
4. Run `npm run test:regression`

## Release checklist

- [ ] `npm test` green
- [ ] `npm run test:performance` green
- [ ] No `.env` or upload binaries in the commit
- [ ] Docs updated if public APIs changed
- [ ] Render env vars verified (see OPERATIONS.md)
- [ ] Hostinger static assets synced if frontend changed

## Ownership boundaries

| Layer | Can call OpenAI? | Mutates Mongo? |
|-------|------------------|----------------|
| Planner / Inference / Truth core | No | No |
| Semantic retrieval / embeddings | Yes | Read |
| Document processing / library routes | Yes (embeddings) | Yes |
| Response generation | Yes | Audit only |

When in doubt: keep reasoning deterministic and put LLM usage at the edges.
