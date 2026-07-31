# Carbon Brain Benchmarks

Benchmarks quantify latency, memory, and cache behavior as the graph grows.

## Layout

```
benchmarks/
  graphBenchmark.js
  plannerBenchmark.js
  inferenceBenchmark.js
  truthBenchmark.js
  runBenchmarks.js
```

## Commands

```bash
npm run bench        # smoke profile
npm run bench:full   # larger synthetic graph
```

### Smoke defaults

| Bench | Scale |
|-------|-------|
| Graph | 1,000 entities / 5,000 relationships |
| Planner | 1,000 plans |
| Inference | 200-node IS_A chain |
| Truth | 50 evaluateTruth iterations |

### Full defaults

| Bench | Scale |
|-------|-------|
| Graph | 10,000 entities / 100,000 relationships |
| Planner | 5,000 plans |
| Inference | 500-node chain |
| Truth | 200 iterations |

## What Each Bench Measures

### Graph (`runGraphBenchmark`)

- Registry load time
- BFS connected-entity latency
- Shortest-path latency
- Heap used (MB)

### Planner (`runPlannerBenchmark`)

- Total / average plan latency
- Strategy distribution via `plannerStatistics`

### Inference (`runInferenceBenchmark`)

- Transitive closure style cost on an IS_A chain
- Inferred fact count

### Truth (`runTruthBenchmark`)

- End-to-end `evaluateTruth` average latency
- Reasoning cache hit ratio

## Telemetry Pairing

Production queries should emit structured metrics via:

`intelligence/telemetry/metricsCollector.js`

Example shape:

```json
{
  "queryId": "...",
  "planner": "GRAPH",
  "cacheHit": true,
  "retrievalMs": 18,
  "graphMs": 4,
  "inferenceMs": 2,
  "truthMs": 1,
  "totalMs": 28,
  "entitiesVisited": 46,
  "relationshipsVisited": 81,
  "inferredFacts": 7,
  "contradictions": 0
}
```

`evaluateTruth` records telemetry automatically. Use `pipelineProfiler.js` to roll up `executionTrace` stage timings.

## Interpreting Results

1. **Planner should stay near-constant** — rule matching is O(rules × keywords).
2. **Graph BFS/path scale with branching** — watch depth caps.
3. **Inference grows with IS_A density** — transitive closure is the hot path.
4. **Truth should cache-hit** on repeated identical question + evidence fingerprints.
5. Track **cache hit ratio** and **heap MB** before claiming readiness for larger corpora.

## Suggested Stabilization Targets (v1.0)

These are engineering goals, not hard SLOs yet:

| Path | Smoke expectation |
|------|-------------------|
| Planner avg | ≪ 1 ms |
| Inference (200-chain) | low single-digit–tens of ms on typical hardware |
| Truth cached repeat | near-zero incremental cost after first miss |
| Graph smoke load (1k/5k) | sub-second load on developer machines |

Re-baseline after major graph or inference changes and store notes beside fixture updates.
