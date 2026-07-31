# Carbon Brain Troubleshooting

## First three artifacts to inspect

For any bad answer:

1. **`executionPlan`** — Did the planner choose the right strategy?
2. **`executionTrace`** — Which stages ran, and for how long?
3. **`truthStatus` + `recommendations`** — Supported, partial, conflicting, or insufficient?

```js
const result = await evaluateTruth(payload, { useCache: false });
console.log(result.executionPlan);
console.log(result.executionTrace);
console.log(result.truthStatus, result.confidence, result.recommendations);
```

---

## Planner issues

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Always HYBRID / too many modules | No rule match | Add keywords/patterns in `plannerRules.js` |
| Definition question runs inference | Wrong rule priority / refine logic | Adjust `refinePlan()` in `queryPlanner.js` |
| Comparison mode off for “vs” | Keyword padding | Ensure ` vs ` style tokens match |

Regression guard: `npm run test:regression`

---

## Retrieval / empty evidence

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No chunks | Doc not processed / embeddings missing | Re-run library processing job |
| Wrong country scope | Metadata country placeholder | Patch document country; see prior admin PATCH flow |
| Local works, Render empty | Different Mongo DB / env URI | Compare `MONGODB_URI` |

---

## Graph / traversal

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Neighbors empty | Indexes not built | `initializeGraphIndexes()` / `refreshIndexes()` |
| Shortest path null | No connecting relationships | Verify registry edges; check predicate direction |
| Stale neighbors after register | Indexes not refreshed | Refresh after bulk inserts |

Unit guard: `tests/unit/graphTraversal.test.js`

---

## Inference

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Missing `A IS_A C` | Gap in chain or non-IS_A predicates | Ensure both hops are `IS_A` / canonical |
| Too many inferences | Long chains | Cap / filter later; inspect `inferenceRule` |
| Inferred facts “disappear” | Not materialized into registry (by design) | Pass as `inferredEvidence` into truth |

---

## Conflicts & confidence

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Unexpected `CONFLICTING` | Polarity map treated as opposite claims | Check `NEGATED_PREDICATE_MAP` / polarity metadata |
| Multi-parent `IS_A` flagged conflict | Should not happen | Confirm predicate is in `MULTI_VALUED_PREDICATES` |
| Confidence too high under conflict | Penalty not applied | Ensure contradictions passed into `calculateConfidence` |
| Confidence too low | Only weak document scores | Add graph/ontology evidence or improve retrieval |

Conflict example that **should** conflict:

```
UAE SUPPORTS Green Hydrogen
UAE DOES_NOT_SUPPORT Green Hydrogen
→ CONFLICTING + “Human review required.”
```

---

## Cache problems

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Code changed but answer identical | Reasoning cache hit | `clearReasoningCache()` or `{ useCache: false }` |
| Cache never hits | Fingerprint includes volatile fields | Inspect `buildReasoningCacheKey` |
| Cache grows forever | Process long-lived | In-memory LRU/TTL already limited; restart clears |

---

## Frontend (Hostinger) vs backend (Render)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Old UI behavior | Static file cache | Hard refresh / bump `?v=` query on scripts |
| CORS errors | Origin not allowed | Update Render CORS for Hostinger domain |
| Mixed content | http API from https site | Use https Render URL |

---

## Secrets & `.env`

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `.env` appears in git status as tracked | Historically committed | `git rm --cached .env` and rotate keys |
| App can’t find keys on Render | Env not set in dashboard | Add vars; redeploy |

---

## Tests failing locally

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:regression
```

Common fixes:

- Reset registries between tests (harness tests should already do this)
- Clear reasoning cache in truth tests
- Don’t rely on uploads/ or live Mongo for unit tests

---

## Performance regressions

Compare against smoke benches:

```bash
npm run bench
```

If graph load/traversal spikes:

- Check accidental full scans without indexes
- Lower BFS `maxDepth`
- Ensure planner disables graph when unnecessary

---

## Escalation data to capture

When opening an issue, include:

1. Question text
2. `executionPlan.strategy` + enabled flags
3. `truthStatus`, `confidence`
4. `executionTrace` JSON
5. Whether `cacheHit` was true
6. Environment (local / Render) and git commit SHA
