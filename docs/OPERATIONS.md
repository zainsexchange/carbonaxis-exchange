# Carbon Brain Operations

How to run Carbon Brain in production-like environments (Render backend + Hostinger frontend).

## Deployment topology

```
Users
  │
  ├─ Hostinger (static frontend)
  │    ai-intelligence.html, js/, style.css, public assets
  │
  └─ Render (Node/Express API + Carbon Brain)
       ├── MongoDB Atlas (knowledge docs/chunks/embeddings)
       ├── OpenAI (embeddings + optional answer narration)
       └── Ephemeral disk (uploads/) — not durable across all dyno types
```

**Rule:** Hostinger holds UI. Render holds API + reasoning. MongoDB holds durable knowledge. Do **not** treat Hostinger as the document database.

## Environment variables (Render)

Set these in the Render dashboard — never in git:

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` / `MONGO_URI` | Yes | Atlas connection |
| `OPENAI_API_KEY` | Yes | Embeddings / generation |
| JWT / session secrets | Yes | Auth |
| App URL / CORS origins | Yes | Allow Hostinger domain |
| Upload path overrides | Optional | Only if not using default `uploads/knowledge` |

Local template: copy `.env.example` → `.env`.

## What lives where

| Data | Local | Git | Hostinger | Render / Atlas |
|------|-------|-----|-----------|----------------|
| Source code / docs / tests | Yes | Yes | Static JS/HTML only | Deployed API |
| `.env` secrets | Yes | **No** | **No** | Render env UI |
| Uploaded PDFs (`uploads/knowledge`) | Yes | **No** | **No** | Render disk or object storage |
| Knowledge metadata/chunks/embeddings | Mongo local/Atlas | **No** | **No** | **Atlas** |
| In-memory entity/relationship registries | Process RAM | N/A | N/A | Rebuild from processing pipeline |
| Test fixtures (`tests/fixtures/*.json`) | Yes | Yes | No | Used in CI only |

## Hostinger (frontend) operations

Publish/update:

- `ai-intelligence.html`
- `js/ai-intelligence.js` (and related JS)
- `style.css`
- Other public pages/assets the Intelligence UI needs

Point the frontend API base URL at the Render service.

**Do not upload knowledge PDFs to Hostinger** for Carbon Brain RAG. Hostinger is for static delivery. Document ingestion must go through the Render library/upload API so files are processed into MongoDB embeddings.

Suggested Hostinger workflow:

1. Build/verify UI locally against Render staging/production API
2. Upload changed static files via Hostinger File Manager or FTP/Git deploy
3. Hard-refresh / cache-bust (`?v=` on script tags if you already do this)
4. Smoke-test Ask from the live domain

## Render (backend) operations

1. Connect private GitHub repo (deploy key / GitHub App still works when repo is private)
2. Set env vars
3. Deploy branch (currently `feature/knowledge-library` or your production branch)
4. Confirm:
   - process boots (`npm start` / `node server.js`)
   - Mongo connects
   - `/ask` or Carbon Brain route responds
5. After making the GitHub repo private: re-check Render still has access

### Uploads on Render

`intelligence/routes/library.js` stores files under:

```
uploads/knowledge/
```

On Render free/ephemeral disks, files can disappear on redeploy. For production knowledge:

- Prefer durable object storage later (S3/R2), **or**
- Re-upload after deploys, **and always** rely on MongoDB chunks/embeddings as source of truth after processing

## Health checks

Modules:

- `intelligence/health/liveness.js` — process up
- `intelligence/health/readiness.js` — ready to reason
- `intelligence/health/dependencyHealth.js` — memory + env presence

Wire these to HTTP routes when hardening production (recommended next ops task).

## Caching

| Cache | Module | Notes |
|-------|--------|-------|
| Semantic | `intelligence/cache/semanticCache.js` | In-process |
| Graph | `intelligence/cache/graphCache.js` | In-process |
| Reasoning | `intelligence/cache/reasoningCache.js` | In-process |

In-process caches reset on restart. That is expected for v1.0. Distributed cache is a v1.5 item.

## Logging & telemetry

`evaluateTruth` attaches:

- `executionPlan`
- `executionTrace`
- `metrics`
- `telemetry` (via `metricsCollector`)

For incidents, capture `queryId` / question / `truthStatus` / `cacheHit` / stage durations.

## Making the GitHub repo private

Yes — supported.

1. Push the clean commit
2. GitHub → Settings → Change visibility → Private
3. Confirm Render deploy access still works
4. Confirm collaborators still have access

## Incident runbook (short)

| Symptom | Check |
|---------|--------|
| Frontend loads, ask fails | Render up? CORS? API URL on Hostinger? |
| 401/403 | Auth token / admin role on library routes |
| Empty answers | Mongo docs processed? embeddings present? retrieval filters? |
| Stale answers after code change | Cache? Render deploy finished? Hostinger JS cache-bust? |
| Upload works locally, not on Render | Disk persistence? multer path? file size limits? |
| Secrets leaked historically | Rotate OpenAI + Mongo credentials; ensure `.env` untracked |

## Backup

- **Atlas**: enable backups / snapshots
- **Uploads**: not in git — export separately if needed
- **Code**: GitHub private repo
- **Fixtures**: in git under `tests/fixtures/` (synthetic, safe)
