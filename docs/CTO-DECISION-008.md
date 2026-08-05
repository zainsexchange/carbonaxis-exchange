# CTO Decision #008 — Knowledge Document Publish Lifecycle

| Field | Value |
|-------|--------|
| **Decision ID** | CTO-008 |
| **Title** | Document lifecycle: ingest ≠ trusted knowledge |
| **Status** | **Mandatory** |
| **Date** | 2026-08-05 |
| **Owner** | CTO / Knowledge Intelligence |
| **Implements** | CB-STD-001 · Mongo `KnowledgeDocument.status` |
| **Ops guide** | [PUBLISH_WORKFLOW.md](./PUBLISH_WORKFLOW.md) |

---

## Problem

Folder copy and PDF upload are not the same as trusted knowledge. If every uploaded file immediately powered Carbon Brain answers, governance collapses: unreviewed OCR, wrong jurisdiction, test PDFs, and draft metadata would be cited as official evidence.

## Decision

**Ingestion is separate from trusted knowledge.**

Simple operator flow:

```
Upload → Process → Publish
```

Full enterprise lifecycle (system of record):

```
Draft
  → Processing
  → Pending Review
  → Verified
  → Published
  → Archived
```

Operational extras (allowed, not on the happy path):

| Status | Role |
|--------|------|
| `failed` | Processing error — re-process or park |
| `superseded` | Replaced by a better / newer version |

### Trust rule (non-negotiable)

| Status | May power Carbon Brain answers? |
|--------|----------------------------------|
| `draft` | No |
| `processing` | No |
| `pending_review` | No |
| `verified` | Yes (internal / admin-eligible retrieval) |
| `published` | Yes (public + internal when visibility allows) |
| `archived` | No |
| `superseded` | No |
| `failed` | No |

Answers cite **verified** or **published** only. Public end users further require `visibility: public` + typically `published`.

---

## Where this lives in the platform

| Stage | What changes | Surface / code |
|-------|----------------|----------------|
| **Draft** | Document record created; file stored; not answer-eligible | Upload UI `admin-carbon-brain-library.html` · library upload API · `KnowledgeDocument` default `status: draft` |
| **Processing** | Extract → metadata → chunk → embed → index | `intelligence/services/processKnowledgeDocument.js` · `processingStage` / `processingProgress` |
| **Pending Review** | Pipeline finished; waiting for human gate | Auto-set after successful process (unless auto-promote rules apply) |
| **Verified** | Human confirms metadata + authority + jurisdiction | Admin status update · PATCH library document · Knowledge Library ops |
| **Published** | Trusted for answers; official corpus | **Publish** button · `POST …/promote-authoritative` · status `published` + usually `visibility: public` |
| **Archived** | Retained for audit; removed from answer path | Admin status → `archived` |

### What does *not* change when you Publish

- RAG planner / Truth Engine / Confidence Engine logic (Freeze Core)
- Corpus folder layout on disk (`CarbonBrain-Knowledge/`)
- CB-STD-001 ID schemes

Publishing only changes **Mongo trust fields** (`status`, `visibility`, `lastVerifiedAt`, `verifiedBy`) so retrieval is allowed to cite the document.

### Operator UIs

| UI | Role in lifecycle |
|----|-------------------|
| `admin-carbon-brain-library.html` | Upload · Process · Publish |
| `admin-knowledge-library.html` | Ops dashboard · awaiting review · quality · coverage |
| `carbon-brain.html` / ask APIs | Consume **published/verified** evidence only |

---

## Rationale

This is how enterprise governance systems work: raw intake, machine processing, human review, then trusted publication. Carbon Brain must never feel like “whatever was uploaded yesterday is now official law.”

---

## Acceptance

1. Upload alone never makes a document answer-eligible.
2. Process alone ends in `pending_review` (or explicit verified/published only via documented auto-promote for Tier-1 government + public).
3. Publish / Verified is an intentional admin action (or batch promote with admin auth).
4. Archived / superseded / failed never appear as trusted citations.
5. Knowledge Library ops surfaces count documents awaiting review.

---

## Related

- CTO-001 — Ingestion gate (metadata before ingest)
- CTO-007 — Single master corpus (`CarbonBrain-Knowledge/`)
- CB-STD-001 — Knowledge Standard
- `docs/PUBLISH_WORKFLOW.md` — operator guide
