# CB-STD-001 — Carbon Brain Knowledge Standard

| Field | Value |
|-------|--------|
| **Standard ID** | CB-STD-001 |
| **Title** | Carbon Brain Knowledge Standard |
| **Version** | 1.0 |
| **Status** | **Mandatory** |
| **Applies to** | Every document, chunk, entity, relationship |
| **Horizon** | Governs the knowledge base for the next ~10 years |
| **Owner** | CTO / Knowledge Intelligence |
| **Repo** | `knowledge-library/metadata/CB-STD-001.md` |

---

## 1. Why this exists

Everyone builds RAG. Almost nobody builds **Knowledge Standards**.

This standard is how Carbon Brain separates itself from chat wrappers: every fact path is governed, scored, ranked, and auditable.

If we get this wrong now, we will spend months fixing it later.

---

## 2. Document lifecycle (nothing skips)

```
Official Source
  → Verification
  → Download
  → Metadata
  → Cleaning
  → Chunking
  → Embeddings
  → Knowledge Graph
  → Reasoning
  → Carbon Brain
```

**Nothing skips this pipeline.** Sidecar-only PDFs, chat uploads without metadata, and unverified web scrapes are out of scope for the production library.

Cross-check: [CTO Decision #001](./CTO-DECISION-001.md).

---

## 3. Document classes

Every document receives exactly one `documentClass`.

| Class | Description | Trust |
|-------|-------------|-------|
| **GOV** | Government | ★★★★★ |
| **REG** | Regulator | ★★★★★ |
| **LAW** | Law / Legislation | ★★★★★ |
| **STR** | National Strategy | ★★★★★ |
| **INT** | International Organization | ★★★★ |
| **STD** | Standard / Framework | ★★★★ |
| **RES** | Research | ★★★ |
| **IND** | Industry | ★★★ |
| **NEWS** | News | ★★ |
| **BLOG** | Opinion | ★ |

v1.0 GCC Knowledge Pack: prefer **GOV / REG / LAW / STR** only unless an exception is recorded.

---

## 4. Authority tiers

Every authority is ranked. Store as `authorityTier` (1–5) and keep in sync with `curationTier`.

| Tier | Scope | Examples | Library share target |
|------|--------|----------|----------------------|
| **1** | Government laws, cabinet decisions, national strategies, ministerial regulations, official policies, executive regulations | MOEI, MOCCAE, Cabinet | **~70%** |
| **2** | Implementation plans, roadmaps, official guidance, regulatory frameworks, national reports | Ministry reports | ~15% |
| **3** | International organizations | UNFCCC, IEA, IRENA, World Bank, IPCC, OECD | ~8% |
| **4** | Standards & frameworks | ISO, GHG Protocol, ISSB, SBTi, TCFD | ~5% |
| **5** | Research / media | Journals, white papers, news, blogs | ~2% |

### sourceAuthorityScore (0–100)

| Source | Score |
|--------|------:|
| Government | 100 |
| UN | 98 |
| IEA / IRENA | 97 |
| World Bank / IPCC / OECD / IFC | 96 |
| ISO / standards bodies | 95 |
| Peer-reviewed journal | 90 |
| Industry report | 80 |
| News | 60 |
| Blog | 30 |

Code: `intelligence/config/sourceAuthority.js`  
Operator guide: [`DOCUMENT-PRIORITY.md`](./DOCUMENT-PRIORITY.md)

Authority lists live under country `Metadata/authorities.json` and must include `tier`.

---

## 5. Naming & stable IDs

### 5.1 Document ID

```
{CountryToken}-{CategoryCode}-{NNNNNN}
```

Examples: `UAE-RE-000001`, `Saudi-HY-000003`, `Oman-CM-000012`

| Token | Country |
|-------|---------|
| UAE | United Arab Emirates |
| Oman | Oman |
| Saudi | Saudi Arabia |
| Qatar | Qatar |
| Bahrain | Bahrain |
| Kuwait | Kuwait |
| GLOBAL | International |

- Six-digit sequence (scale for 10 years).  
- Files: `{documentId}.pdf` + `{documentId}.json`  
- ❌ Never: `strategy-final-v3.pdf`

### 5.2 Chunk ID

`CHUNK-00000001` — globally unique, never reused.

Must reference: `documentId`, page, section, heading, embedding id, entity ids, relationship ids.

### 5.3 Entity ID

`ENTITY-000001` — globally unique, **immutable** for the life of the knowledge base.

### 5.4 Relationship ID

`RELATIONSHIP-000001` — globally unique, **immutable**.

---

## 5.5 Folder manifests (required)

Every folder under the **master corpus** `CarbonBrain-Knowledge/` and infrastructure `knowledge-library/` **must** contain `manifest.json`.

| Field | Value |
|-------|--------|
| **Schema** | `CB-FOLDER-MANIFEST-1` |
| **Machine schema** | [`../schemas/folder-manifest.schema.json`](../schemas/folder-manifest.schema.json) |
| **Generator** | `node knowledge-library/ingestion/update-folder-manifests.mjs --all` |

**CTO-007:** Documents live only in `CarbonBrain-Knowledge/`. `knowledge-library/` has no country packs.

---

## 6. Master document metadata (40+ fields)

Machine schema: [`document.schema.json`](./document.schema.json)  
Example: [`document.example.json`](./document.example.json)

### Required (ingest gate)

`documentId`, `title`, `country`, `region`, `authority`, `authorityTier`, `documentClass`, `category`, `categoryCode`, `language`, `official`, `publicSource`, `sourceUrl` *(or `provenanceNote`)*, `jurisdiction`, `status`, `verified`, `keywords`, `folder`

### Core identity & classification

| Field | Notes |
|-------|--------|
| documentId | Stable ID |
| title | Official title |
| country | Full name or Global |
| region | e.g. GCC, Global |
| jurisdiction | Legal/regulatory applicability |
| authority | Issuing body |
| authorityCode | Optional short code |
| authorityTier | 1–5 |
| documentClass | GOV…BLOG |
| category | Human label |
| categoryCode | CL, HY, CM, RE, … |
| subcategory | Optional |
| documentType | Freeform subtype (strategy, NDC, report, …) |
| sourceType | Government, Regulator, IGO, … |
| language | English / Arabic / … |
| languages | Optional array if bilingual |

### Provenance & dates

| Field | Notes |
|-------|--------|
| publicationDate | ISO date |
| effectiveDate | ISO date |
| retrievedDate | When downloaded |
| verified | boolean |
| verifiedDate | ISO date |
| verifiedBy | Curator id/name |
| lastReviewed | ISO date |
| official | boolean |
| publicSource | boolean |
| sourceUrl | Official URL |
| provenanceNote | If URL temporarily unavailable |
| checksum | SHA-256 of binary |
| checksumAlgorithm | default `sha256` |
| fileName | On-disk name |
| mimeType | e.g. application/pdf |
| pdfPages | integer |
| byteSize | integer |

### Pipeline versions & counts

| Field | Notes |
|-------|--------|
| embeddingVersion | e.g. v1 |
| ontologyVersion | e.g. 1.0 |
| knowledgeVersion | e.g. 1.0 |
| pipelineVersion | Optional |
| chunkCount | Filled after chunking |
| entityCount | Filled after graph map |
| relationshipCount | Filled after graph map |
| embeddingCount | Usually ≈ chunkCount |
| knowledgeScore | 0–100 (see §8) |
| status | ACTIVE \| SUPERSEDED \| ARCHIVED \| DRAFT_OFFICIAL |

### Lifecycle & duplicates

| Field | Notes |
|-------|--------|
| supersedes | documentId of prior version |
| supersededBy | documentId of newer version |
| versionLabel | Publisher version string |
| relatedDocuments | array of documentIds |
| duplicateOf | Must be empty for ACTIVE canonical |
| keywords | string[] |
| topics | string[] |
| sectors | string[] |
| technologies | string[] |
| folder | Relative folder under country |
| notes | Curator notes |

---

## 7. Chunk identity

Schema: [`chunk.schema.json`](./chunk.schema.json)

Every chunk:

```
CHUNK-########
  → documentId
  → page
  → section
  → heading
  → text
  → embeddingId / embeddingVersion
  → entityIds[]
  → relationshipIds[]
```

No dangling chunks (chunk without document). No chunk without text.

---

## 8. Knowledge Score (per document)

| Factor | Weight |
|--------|--------|
| Authority | 25 |
| Freshness | 15 |
| Completeness | 20 |
| Metadata | 10 |
| Entities | 10 |
| Relationships | 10 |
| Embeddings | 10 |
| **Total** | **100** |

Scoring guidance (v1.0):

- **Authority:** Tier 1 → 25; Tier 2 → 20; Tier 3 → 15; Tier 4 → 10; Tier 5 → 5  
- **Freshness:** published/reviewed within 2y → 15; 2–5y → 10; older → 5; unknown → 0  
- **Completeness:** text extracted + pages known + effective/publication dates → up to 20  
- **Metadata:** all required fields valid → 10; else proportional  
- **Entities / Relationships / Embeddings:** present and non-zero after processing → full weight; else 0 until pipeline runs  

Store result in `knowledgeScore`.

---

## 9. Knowledge Health (admin KPI)

Aggregate library health (example target shape):

| KPI | Meaning |
|-----|---------|
| Knowledge Health | Weighted rollup of coverage + quality gates |
| Coverage | Progress vs pack targets (e.g. 250 docs) |
| Metadata | % docs passing schema + CTO #001 |
| Embeddings | % chunks with embeddings |
| Relationships | % expected edges healthy |
| Entities | % entities linked to ≥1 relationship or document |
| Broken Links | Count of dangling refs (must be **0** for green) |
| Duplicate Documents | Count of unresolved duplicates (must be **0** for green) |

Admin dashboard: `admin-knowledge-library.html`  
Stats file: `library-stats.json` → `knowledgeHealth` object.

---

## 10. Source trust (user-facing)

Every answer should be able to surface trust by class:

| Band | Stars |
|------|-------|
| Government (GOV/REG/LAW/STR) | ★★★★★ |
| International (INT/STD) | ★★★★☆ |
| Research (RES) | ★★★☆☆ |
| Industry (IND) | ★★★☆☆ |
| Media (NEWS/BLOG) | ★☆☆☆☆ |

---

## 11. Duplicate policy

Carbon Brain **never** stores content duplicates as parallel ACTIVE documents.

```
Existing Document
  → Version
  → New Version
  → Supersedes
  → Archive (prior)
```

Use `supersedes` / `supersededBy` / `status: SUPERSEDED|ARCHIVED`.

---

## 12. Knowledge graph rules

1. No orphan entity  
2. No orphan relationship  
3. No broken references  
4. No dangling chunks  
5. Everything connects (document ↔ chunk ↔ entity ↔ relationship)

Violations block “graph healthy” status.

---

## 13. Search priority (deterministic)

Carbon Brain searches / ranks evidence in this order:

1. Government  
2. Regulations  
3. Strategies  
4. International  
5. Research  
6. Industry  
7. Media  

Map via `documentClass` + `authorityTier`. Do not rely on model preference alone.

---

## 14. Category codes

Unchanged primary taxonomy — see [`CATEGORIES.md`](./CATEGORIES.md).

---

## 15. Related standards (series)

| ID | Topic | Status |
|----|--------|--------|
| CB-STD-001 | Knowledge Standard (this doc) | Mandatory v1.0 |
| CB-STD-002 | Knowledge Graph Standard | Planned |
| CB-STD-003 | Semantic Pipeline Standard | Planned |
| CB-STD-004 | Evidence Standard | Planned |
| CB-STD-005 | Confidence Standard | Planned |
| CB-STD-006 | Regulatory Citation Standard | Planned |

---

## 16. CTO audit snapshot (pre-launch)

| Area | Score |
|------|-------|
| AI Architecture | 98 |
| Reasoning Engine | 98 |
| Knowledge Graph | 96 |
| Truth Engine | 98 |
| Query Planner | 97 |
| Testing | 97 |
| Engineering | 97 |
| Product Vision | 99 |
| Knowledge Library | 35 |
| Executive UI | 40 |
| **Overall** | **92 / 100** |

Interpretation: platform is strong; **library + executive surface** are the launch bottleneck — consistent with Operation Carbon Brain v1.0 priority order (Knowledge → Executive UI → Reports).
