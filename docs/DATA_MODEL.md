# Carbon Brain Data Model

Carbon Brain uses **three complementary data planes**.

## 1) Durable knowledge store (MongoDB)

Used by the Knowledge Library / RAG path.

| Collection / model | Module | Purpose |
|--------------------|--------|---------|
| Knowledge documents | `intelligence/models/KnowledgeDocument.js` | Title, country, source class, trust, file metadata, processing status |
| Knowledge chunks | `intelligence/models/KnowledgeChunk.js` | Text segments for retrieval |
| Knowledge embeddings | `intelligence/models/KnowledgeEmbedding.js` | Vector representations |
| Knowledge jobs | `intelligence/models/KnowledgeJob.js` | Async processing jobs |
| Retrieval audits | (related audit model if present) | Query audit trail |

### KnowledgeDocument (high level)

Important fields:

- identity: `title`, `description`
- jurisdiction: `country`, `jurisdiction`, `issuingAuthority`
- classification: `documentType`, `sourceClass`, `sourceTrustScore`
- lifecycle: processing/status timestamps
- file linkage: checksum / storage path references

Documents are **uploaded via API** to `uploads/knowledge/`, then processed into chunks + embeddings in MongoDB.

## 2) Working memory graph (in-process registries)

Built from semantic extraction / sync — not a replacement for MongoDB.

| Store | Module | Contents |
|-------|--------|----------|
| Entity Registry | `intelligence/graph/entityRegistry.js` | Canonical entities (`entityId`, `canonicalName`, type, aliases) |
| Relationship Registry | `intelligence/graph/relationshipRegistry.js` | Edges (`subjectEntityId`, `predicate`, `objectEntityId` or literal) |
| Traversal indexes | `intelligence/graph/graphTraversalEngine.js` | Outgoing/incoming adjacency for BFS / shortest path |
| Knowledge graph store | `intelligence/graph/knowledgeGraphStore.js` | Hybrid edge materialization helper |

### Relationship key form

```
subjectEntityId::predicate::entity|literal::reference
```

Both display `predicate` and `canonicalPredicate` may be stored.

### Inference note

V1 inferred facts are **returned as evidence objects**, not automatically persisted into the relationship registry.

## 3) Reasoning artifacts (per query)

| Artifact | Where | Durable? |
|----------|-------|----------|
| `ReasoningContext` | `intelligence/reasoning/reasoningContext.js` | No (request lifetime) |
| `ExecutionPlan` | `intelligence/planner/executionPlan.js` | No (returned/traced) |
| Normalized evidence | `intelligence/truth/evidenceModel.js` | No |
| Truth result | `intelligence/truth/truthEngine.js` | No (unless API logs it) |
| Telemetry | `intelligence/telemetry/metricsCollector.js` | In-memory recent buffer |

### Universal evidence record

```
evidenceId
sourceType      // DOCUMENT | GRAPH | INFERENCE | ONTOLOGY
subjectEntityId
objectEntityId
predicate
confidence
provenance
inferred
ontology
explanation
metadata        // polarity, names, inferenceRule, ...
```

### Truth result

```
truthStatus
confidence
supportingEvidence
conflictingEvidence
inferredEvidence
ontologyEvidence
explanation
recommendations
executionPlan
executionTrace
metrics
telemetry
```

## Ontology data (curated code)

Not user uploads — versioned in git:

```
intelligence/ontology/
  conceptHierarchy.js
  canonicalPredicates.js
  entityAliases.js
  entityTypes.js
  protectedConcepts.js
```

Hierarchy edges (example):

```
Solar PV → Renewable Energy → Energy
Green Hydrogen → Hydrogen → Clean Fuel → ...
```

## Local disk layout

| Path | Purpose | In git? |
|------|---------|---------|
| `uploads/knowledge/` | Multer destination for PDFs | **No** |
| `.env` | Secrets | **No** |
| `tests/fixtures/*.json` | Synthetic regression graphs | **Yes** |
| `docs/` | Product + ops docs | **Yes** |
| `node_modules/` | Dependencies | **No** |

## Hostinger vs Atlas vs Render (data placement)

```
Hostinger
  └─ static UI only

Render
  ├─ API process
  ├─ optional ephemeral uploads/
  └─ connects to Atlas

MongoDB Atlas
  └─ documents, chunks, embeddings, jobs  ← durable knowledge

GitHub (private)
  └─ code, ontology, fixtures, docs       ← no customer PDFs/secrets
```

### Recommendation for production knowledge data

1. **Upload documents through the Render library API** (admin-authenticated).
2. Let processing write **chunks + embeddings to Atlas**.
3. Keep PDFs out of git and out of Hostinger.
4. If Render disk is ephemeral, plan object storage later; until then treat **Mongo embeddings as the recoverable corpus**.
5. Use Hostinger only to ship the Intelligence UI that calls Render.

## Test / fixture data model

Fixtures under `tests/fixtures/` use a simple portable schema:

```json
{
  "name": "hydrogen",
  "entities": [{ "canonicalSubject": "...", "entityType": "..." }],
  "relationships": [{ "subject": "...", "predicate": "IS_A", "object": "..." }],
  "questions": [{ "question": "...", "expectedStrategy": "REASONING" }]
}
```

`loadFixtureIntoRegistries()` maps names → registry IDs for deterministic tests without Mongo.

## Migration mindset

When evolving schemas:

1. Prefer additive Mongo fields with defaults
2. Keep evidence model backward compatible (`normalizeEvidence` tolerates aliases)
3. Version fixture expectations when planner/truth semantics change intentionally
4. Document breaking changes in `docs/ROADMAP.md` / release notes
