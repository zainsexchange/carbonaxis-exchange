# Document Priority & Source Authority Score

| Field | Value |
|-------|--------|
| **Standard** | CB-STD-001 companion |
| **Module** | `intelligence/config/sourceAuthority.js` |
| **Status** | Mandatory for curation + ranking |

---

## 1. Populate the library in this order

### Tier 1 — Highest priority (~70% of the library)

These are the documents Carbon Brain should trust most.

- Government laws
- Cabinet decisions
- National strategies
- Ministerial regulations
- Official policies
- Executive regulations

**Folders:** `01_GCC/{Country}/Laws|Policies|Strategies|…`  
**Typical metadata:** `sourceClass=government`, `documentType=law|regulation|policy|strategy`  
**sourceAuthorityScore:** **100**

### Tier 2 — Government implementation (~15%)

- Government implementation plans
- National roadmaps
- Official guidance
- Regulatory frameworks
- National reports

**Folders:** `01_GCC/{Country}/Reports|MRV|Policies|…`  
**Typical metadata:** `sourceClass=government`, `documentType=report|guidance|framework`  
**sourceAuthorityScore:** **100** (government) with Tier-2 soft ranking (slightly below Tier-1 types)

### Tier 3 — International organizations (~8%)

- UNFCCC, IEA, IRENA, World Bank, IPCC, OECD, IFC

**Folders:** `02_International/…`  
**Scores:** UN 98 · IEA/IRENA 97 · World Bank/IPCC/OECD/IFC 96

### Tier 4 — Standards (~5%)

- ISO, GHG Protocol, ISSB, SBTi, TCFD

**Folders:** `04_Standards/…`  
**sourceAuthorityScore:** **95**  
Used especially for questions like: *“How should Scope 3 emissions be reported?”*

### Tier 5 — Research (~2%)

- Research papers and white papers

**Folders:** `05_Research/`  
**sourceAuthorityScore:** peer-reviewed **90** · industry **80** · news **60** · blog **30**

---

## 2. sourceAuthorityScore (0–100)

| Source | Score |
|--------|------:|
| Government | 100 |
| UN | 98 |
| IEA | 97 |
| IRENA | 97 |
| World Bank | 96 |
| ISO / standards bodies | 95 |
| Peer-reviewed journal | 90 |
| Industry report | 80 |
| News | 60 |
| Blog | 30 |

Stored on every `KnowledgeDocument` as:

- `sourceAuthorityScore` (0–100)
- `sourceTrustScore` (= score / 100)
- `curationTier` (1–5)
- `authorityTier` (synced with curationTier for CB-STD-001)

Resolved automatically at **upload** and **process** from `sourceClass` + `issuingAuthority` + `documentType`.

---

## 3. Evidence ranking

`intelligence/truth/evidenceRanker.js` weights **sourceQuality at 30%** of the evidence score (up from 20%), using `sourceAuthorityScore / 100`.

All else equal, an official ministry document outranks a consultancy report.

---

## 4. Operator checklist

1. Fill Tier 1 first until ~70% of active docs are government law/strategy/policy/regulation.  
2. Prefer `visibility=public` + `sourceClass=government` for official GCC PDFs.  
3. Put international packs under `02_International`, standards under `04_Standards`.  
4. Re-process or Publish after metadata changes so scores refresh.
