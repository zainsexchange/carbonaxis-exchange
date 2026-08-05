# Carbon Brain — Publish Workflow Guide

**Normative decision:** [CTO-008](./CTO-DECISION-008.md)  
**Audience:** Knowledge operators, admins, CTO review  
**Principle:** Ingestion ≠ trusted knowledge.

---

## The simple flow (what you use every day)

```
Upload
  ↓
Process
  ↓
Publish
```

| Step | Meaning |
|------|---------|
| **Upload** | File + metadata enter the system. Not trusted yet. |
| **Process** | OCR/extract, chunk, embed, index. Still not trusted for answers. |
| **Publish** | Human (or gated promote) marks the document trusted. Now it can power Carbon Brain. |

That separation is intentional. Enterprise governance systems work this way.

---

## Full document lifecycle (system of record)

Prefer this model over a single “Published” flag:

```
Draft
  ↓
Processing
  ↓
Pending Review
  ↓
Verified
  ↓
Published
  ↓
Archived
```

### Stage definitions

| Status | Operator meaning | Answers? |
|--------|------------------|----------|
| **Draft** | Uploaded or metadata started; not finished | No |
| **Processing** | Pipeline running (extract → chunk → embed) | No |
| **Pending Review** | Processed; waiting for human QA | No |
| **Verified** | Metadata, authority, jurisdiction checked | Yes* |
| **Published** | Official trusted corpus entry | Yes* |
| **Archived** | Kept for audit; retired from active use | No |

\*Retrieval allows `verified` and `published`. Public users typically need `published` + `visibility: public`.

### Extra statuses (ops, not happy path)

| Status | When |
|--------|------|
| **failed** | Processing error — fix and re-process |
| **superseded** | Replaced by a newer / better version |

---

## Where each change happens

| Lifecycle step | Where you act | What actually changes |
|----------------|---------------|------------------------|
| Upload | **Knowledge Upload** (`admin-carbon-brain-library.html`) | New Mongo `KnowledgeDocument` · file stored · usually `draft` |
| Process | Same page → Process / auto-process | `status: processing` then pipeline stages · ends **Pending Review** (unless auto-promote) |
| Review / Verify | Upload page or Knowledge Library ops · status update | `status: verified` · `lastVerifiedAt` · `verifiedBy` |
| Publish | **Publish** button or “Publish official docs for answers” | `status: published` · usually `visibility: public` |
| Archive | Admin status update | `status: archived` · drops out of answer citations |
| Monitor backlog | **Knowledge Library** (`admin-knowledge-library.html`) | Read-only ops: awaiting review, quality, coverage heat map |

### What stays undisturbed

- Carbon Brain **ask / RAG / Truth Engine** code paths (they only *read* status)
- Disk corpus layout under `CarbonBrain-Knowledge/`
- Hostinger static pages only need UI uploads when buttons/labels change; **status logic lives on Render (Mongo + API)**

---

## Operator checklist (per document)

1. Confirm official source URL / provenance (CTO-001).
2. Upload with country, authority, document type, source class.
3. Run **Process** until chunks + embeddings exist.
4. Spot-check metadata and jurisdiction (UAE doc must not answer Oman-only questions).
5. **Verify** or **Publish** — only then expect citations in Executive Workspace.
6. When replaced: mark old doc **superseded** or **archived**; keep the new version published.

---

## Auto-promote (exception, not the default)

Some Tier-1 government + public documents may be promoted to `published` after process by admin batch (`promote-authoritative`) or explicit publish.

Rules of thumb:

- Test PDFs, drafts, internal-only → stay **Pending Review** until deliberate Publish.
- Official ministry / regulator strategy with public visibility → eligible for Publish.
- Never treat “file in the folder” or “uploaded to Hostinger” as Published.

---

## Trust boundary (one diagram)

```
┌─────────────────────────────────────┐
│  INGESTION (not trusted)            │
│  Draft · Processing · Pending Review│
└─────────────────┬───────────────────┘
                  │  Publish / Verify
                  ▼
┌─────────────────────────────────────┐
│  TRUSTED KNOWLEDGE                  │
│  Verified · Published               │──► Carbon Brain answers & citations
└─────────────────┬───────────────────┘
                  │  Archive / Supersede
                  ▼
┌─────────────────────────────────────┐
│  RETIRED (audit only)               │
│  Archived · Superseded              │
└─────────────────────────────────────┘
```

---

## Related surfaces

| Surface | URL / path |
|---------|------------|
| Knowledge Upload | `/admin-carbon-brain-library.html` |
| Knowledge Library ops | `/admin-knowledge-library.html` |
| Executive Workspace | `/carbon-brain.html` |
| Schema | `intelligence/models/KnowledgeDocument.js` → `status` enum |
| Retrieval gate | `intelligence/retrieval/semanticRetriever.js` |
