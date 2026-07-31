# Carbon Brain Testing

Testing is part of the v1.0 product. Every commit should be able to prove planner correctness, reasoning stability, and no confidence regressions.

## Layout

```
tests/
  harness.js              # lightweight describe/it runner (node:assert)
  runAll.js
  unit/
  integration/
  regression/
  performance/
  fixtures/
    gcc_energy.json
    hydrogen.json
    carbon_markets.json
    renewable_targets.json
    expected_answers.json
    loadFixture.js
```

## Commands

```bash
npm test                 # unit + integration + regression
npm run test:unit
npm run test:integration
npm run test:regression
npm run test:performance
```

## Unit Coverage Targets

Public APIs under test:

| Area | File |
|------|------|
| Entity Registry | `unit/entityRegistry.test.js` |
| Relationship Registry | `unit/relationshipRegistry.test.js` |
| Graph Traversal / BFS / Shortest Path | `unit/graphTraversal.test.js` |
| Inference Engine | `unit/inferenceEngine.test.js` |
| Query Planner | `unit/queryPlanner.test.js` |
| Truth Engine | `unit/truthEngine.test.js` |
| Evidence Collector + Confidence | `unit/evidenceCollector.test.js` |
| Cache Layer | `unit/cacheLayer.test.js` |

## Integration

`integration/reasoningFlow.test.js` verifies the composed path:

```
Question → Planner → Graph/Inference evidence → Truth → Response object
```

Asserts presence of:

- `executionPlan`
- `executionTrace`
- `metrics`
- `confidence`
- `truthStatus`
- cache hit behavior on repeated identical queries

## Regression

`regression/benchmarkAnswers.test.js` loads permanent fixtures and `expected_answers.json`.

Each case checks:

- expected planner strategy
- minimum confidence floor
- valid truth status enum
- inference requirement flags where relevant

Fixtures are the long-lived benchmark dataset. Prefer extending fixtures over deleting failing cases — failures are product signals.

## Performance Smoke

`performance/smoke.test.js` keeps cheap budgets in CI:

- planner average latency bound
- inference on a modest IS_A chain

Full load tests live under `benchmarks/` — see [BENCHMARKS.md](./BENCHMARKS.md).

## Writing New Tests

1. Use `describe` / `it` / `assert` from `tests/harness.js`.
2. Reset registries / caches / evidence sequence at the start of stateful tests.
3. Prefer fixtures via `loadFixture` / `buildEvidenceFromFixture`.
4. Keep unit tests free of network and OpenAI.
5. For regression, add both a fixture update and an `expected_answers.json` case.

## Harness Notes

The runner is intentionally dependency-free (no Jest/Mocha). It uses ESM imports with cache-busting so sequential files stay isolated.
