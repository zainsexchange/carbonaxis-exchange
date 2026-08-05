import { escapeHtml } from "../components/dom.js";
import { fmt, pct, metricBar, metricCard } from "../components/IcMetric.js";
import { renderCtoStrip } from "../components/IcCtoStrip.js";
import { renderIcPanel, comingSoonPanel } from "../components/IcPanel.js";

const card = metricCard;
const bar = metricBar;
const panel = renderIcPanel;
const ctoStrip = renderCtoStrip;

export const VIEW_TITLES = {
  dashboard: "Dashboard",
  library: "Documents",
  document: "Document Detail",
  countries: "Countries",
  authorities: "Authorities",
  chunks: "Chunks",
  embeddings: "Embeddings",
  graph: "Knowledge Graph Explorer",
  entity: "Entity Detail",
  relationship: "Relationship Detail",
  semantic: "Semantic Search",
  planner: "Query Planner",
  truth: "Truth Engine",
  inference: "Inference",
  reasoning: "Reasoning",
  confidence: "Confidence",
  evidence: "Evidence",
  queries: "Query Analytics",
  reports: "Executive Reports",
  users: "Users",
  telemetry: "Telemetry",
  benchmarks: "Benchmarks",
  kpis: "Launch KPIs",
  monitoring: "Intelligence Monitoring",
  health: "Health Monitor",
  settings: "Settings",
  security: "Security",
  apikeys: "API Keys",
  logs: "Logs",
  backups: "Backups",
};

export const DEMO_DOC = {
  id: "UAE-RE-000001",
  title: "UAE Energy Strategy 2050",
  country: "UAE",
  authority: "MOEI",
  category: "Renewable Energy",
  status: "Active",
  chunks: 312,
  entities: 185,
  relationships: 698,
  confidence: 98,
};

/** @param {object} stats */
export function createIcViews(stats, demoDoc = DEMO_DOC) {
  return {
    dashboard() {
      const h = stats.knowledgeHealth || {};
      return `
        ${ctoStrip({
          know: `${fmt(stats.documents)} docs · ${fmt(stats.countries)} countries`,
          health: pct(h.overall),
          trust: "Evidence + confidence on every report",
        })}
        <div class="ic-metric-grid">
          ${card("Knowledge Health", pct(h.overall), { bar: h.overall, sub: "CB-STD-001" })}
          ${card("Documents", fmt(stats.documents), { sub: "Live sidecar count" })}
          ${card("Entities", fmt(stats.entities), { sub: "After graph sync" })}
          ${card("Relationships", fmt(stats.relationships))}
          ${card("Embeddings", fmt(stats.embeddings))}
          ${card("Countries", fmt(stats.countries), { sub: "GCC" })}
          ${card("Authorities", fmt(stats.authorities))}
          ${card("AI Queries Today", "—", { sub: "Wire telemetry" })}
          ${card("Average Response", "—", { sub: "Wire telemetry" })}
          ${card("Cache Hit", "—", { sub: "Wire cache stats" })}
          ${card("Truth Accuracy", "—", { sub: "Benchmark track" })}
          ${card("Graph Health", pct(h.relationships), { bar: h.relationships })}
        </div>
        ${panel(
          "Recent Queries",
          `<ul class="ic-list">
            <li>Should Oman invest in Green Hydrogen? <em>Enterprise Preview</em></li>
            <li>Compare UAE / Saudi / Oman hydrogen readiness <em>Board demo target</em></li>
            <li>UAE Net Zero 2050 — evidence map <em>Knowledge</em></li>
          </ul>`,
          "Trust"
        )}
        ${panel(
          "Knowledge Library",
          `<p class="ic-muted">${fmt(stats.documents)} curated metadata records · health ${pct(h.overall)} · duplicates ${fmt(h.duplicateDocuments ?? 0)}</p>
           <button type="button" class="ic-mini-btn" data-go="library">Open Documents</button>`,
          "Know"
        )}
        ${panel(
          "System Monitoring",
          `<div class="ic-metric-grid">
            ${card("Metadata", pct(h.metadata), { bar: h.metadata })}
            ${card("Embeddings health", pct(h.embeddings), { bar: h.embeddings })}
            ${card("Broken Links", fmt(h.brokenLinks ?? 0))}
            ${card("Last Sync", fmt(stats.lastSync, "Not synced"))}
          </div>`,
          "Health"
        )}
      `;
    },

    library() {
      const h = stats.knowledgeHealth || {};
      const d = demoDoc;
      return `
        ${ctoStrip({
          know: "Document registry",
          health: `Dupes ${fmt(h.duplicateDocuments ?? 0)} · Broken ${fmt(h.brokenLinks ?? 0)}`,
          trust: "Authority + class + source URL required",
        })}
        <div class="ic-metric-grid">
          ${card("Documents", fmt(stats.documents))}
          ${card("Knowledge Health", pct(h.overall), { bar: h.overall })}
          ${card("Metadata", pct(h.metadata), { bar: h.metadata })}
          ${card("Missing Metadata", fmt(h.metadata === 100 ? 0 : "—"))}
        </div>
        ${panel(
          "Documents",
          `<table class="ic-table">
            <thead>
              <tr>
                <th>Title</th><th>Country</th><th>Authority</th><th>Category</th>
                <th>Status</th><th>Chunks</th><th>Entities</th><th>Relationships</th><th>Confidence</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtml(d.title)}</td>
                <td>${escapeHtml(d.country)}</td>
                <td>${escapeHtml(d.authority)}</td>
                <td>${escapeHtml(d.category)}</td>
                <td><span class="ic-status">${escapeHtml(d.status)}</span></td>
                <td>${d.chunks}</td>
                <td>${d.entities}</td>
                <td>${d.relationships}</td>
                <td>${d.confidence}%</td>
                <td><button type="button" class="ic-mini-btn" data-go="document">Open</button></td>
              </tr>
            </tbody>
          </table>
          <p class="ic-muted">Sample row uses CB-STD-001 template ${escapeHtml(d.id)}.</p>`,
          "Know"
        )}
      `;
    },

    document() {
      const d = demoDoc;
      const tabs = [
        "Overview",
        "PDF Preview",
        "Metadata",
        "Chunks",
        "Entities",
        "Relationships",
        "Knowledge Graph",
        "Reasoning",
        "History",
      ];
      return `
        ${ctoStrip({
          know: d.title,
          health: d.status,
          trust: `Confidence ${d.confidence}% · ${d.authority}`,
        })}
        ${panel(
          "Document",
          `<h3 class="ic-doc-title">${escapeHtml(d.title)}</h3>
          <table class="ic-table">
            <tbody>
              <tr><th>Title</th><td>${escapeHtml(d.title)}</td></tr>
              <tr><th>Country</th><td>${escapeHtml(d.country)}</td></tr>
              <tr><th>Authority</th><td>${escapeHtml(d.authority)}</td></tr>
              <tr><th>Category</th><td>${escapeHtml(d.category)}</td></tr>
              <tr><th>Status</th><td>${escapeHtml(d.status)}</td></tr>
              <tr><th>Chunks</th><td>${d.chunks}</td></tr>
              <tr><th>Entities</th><td>${d.entities}</td></tr>
              <tr><th>Relationships</th><td>${d.relationships}</td></tr>
              <tr><th>Confidence</th><td>${d.confidence}%</td></tr>
            </tbody>
          </table>`,
          "Know · Trust"
        )}
        <div class="ic-tabs" data-tabs>
          ${tabs
            .map(
              (t, i) =>
                `<button type="button" class="ic-tab ${i === 0 ? "is-active" : ""}" data-tab="${i}">${t}</button>`
            )
            .join("")}
        </div>
        <div class="ic-tab-panels">
          <div class="ic-tab-panel" data-panel="0">${bar(d.confidence)}<p class="ic-muted">Overview readiness for board packs.</p></div>
          <div class="ic-tab-panel" data-panel="1" hidden><p class="ic-muted">PDF preview after binary ingest (${escapeHtml(d.id)}.pdf).</p></div>
          <div class="ic-tab-panel" data-panel="2" hidden><pre class="ic-code">${escapeHtml(
            JSON.stringify(
              {
                documentId: d.id,
                documentClass: "STR",
                authorityTier: 1,
                categoryCode: "RE",
                standard: "CB-STD-001",
              },
              null,
              2
            )
          )}</pre></div>
          <div class="ic-tab-panel" data-panel="3" hidden><p class="ic-muted">CHUNK-######## viewer binds after chunking.</p></div>
          <div class="ic-tab-panel" data-panel="4" hidden><button type="button" class="ic-mini-btn" data-go="entity">Open sample entity</button></div>
          <div class="ic-tab-panel" data-panel="5" hidden><button type="button" class="ic-mini-btn" data-go="relationship">Open sample relationship</button></div>
          <div class="ic-tab-panel" data-panel="6" hidden><button type="button" class="ic-mini-btn" data-go="graph">Open graph explorer</button></div>
          <div class="ic-tab-panel" data-panel="7" hidden><p class="ic-muted">Reasoning traces attach per Research Session.</p></div>
          <div class="ic-tab-panel" data-panel="8" hidden><p class="ic-muted">Version / supersedes history per duplicate policy.</p></div>
        </div>
      `;
    },

    entity() {
      return `
        ${ctoStrip({
          know: "ENTITY Green Hydrogen",
          health: "Linked graph node",
          trust: "48 relationships",
        })}
        ${panel(
          "Entity",
          `<h3 class="ic-doc-title">Green Hydrogen</h3>
          <div class="ic-metric-grid">
            ${card("Type", "Technology")}
            ${card("Relationships", "48")}
          </div>
          <p><strong>Aliases</strong></p>
          <div class="ic-chip-row"><span>Hydrogen</span><span>Renewable Hydrogen</span></div>
          <p><strong>Connected To</strong></p>
          <div class="ic-chip-row"><span>UAE</span><span>Saudi</span><span>Hydrom</span><span>NEOM</span><span>IRENA</span></div>
          <p class="ic-muted">Immutable ID pattern: ENTITY-000001</p>`,
          "Know · Trust"
        )}
      `;
    },

    countries() {
      const by = stats.byCountry || {};
      const rows = [
        ["UAE", by.uae || 0],
        ["Saudi Arabia", by["saudi-arabia"] || 0],
        ["Oman", by.oman || 0],
        ["Qatar", by.qatar || 0],
        ["Bahrain", by.bahrain || 0],
        ["Kuwait", by.kuwait || 0],
      ];
      return `
        ${ctoStrip({
          know: "6 GCC countries",
          health: pct(stats.knowledgeHealth?.coverage),
          trust: "Authority-tiered sources",
        })}
        <div class="ic-country-grid">
          ${rows
            .map(
              ([name, docs]) => `<article class="ic-country-card">
              <h3>${escapeHtml(name)}</h3>
              <ul>
                <li>Documents <strong>${docs}</strong></li>
                <li>Knowledge Health <strong>${pct(stats.knowledgeHealth?.overall)}</strong></li>
              </ul>
            </article>`
            )
            .join("")}
        </div>
      `;
    },

    authorities() {
      return panel(
        "Authorities",
        `<p class="ic-muted">${fmt(stats.authorities)} authorities in local CB-STD-001 lists.</p>
         <a class="ic-link-btn" href="/CarbonBrain-Knowledge/01_GCC/UAE/Metadata/authorities.json">UAE authorities</a>`,
        "Know"
      );
    },

    chunks() {
      return panel(
        "Chunks",
        `<div class="ic-metric-grid">${card("Knowledge Chunks", fmt(stats.knowledgeChunks))}</div>
         <p class="ic-muted">CHUNK-00000001 → document → page → section → heading → embedding.</p>`,
        "Know"
      );
    },

    embeddings() {
      return panel(
        "Embeddings",
        `<div class="ic-metric-grid">
          ${card("Embeddings", fmt(stats.embeddings))}
          ${card("Health", pct(stats.knowledgeHealth?.embeddings), { bar: stats.knowledgeHealth?.embeddings })}
        </div>`,
        "Health"
      );
    },

    graph() {
      return `
        ${ctoStrip({
          know: "Live document ↔ theme relationships",
          health: "Derived from Mongo library (ops only)",
          trust: "Click node → inspect path & evidence",
        })}
        ${panel(
          "Knowledge Graph Explorer",
          `<div class="ic-graph-search">
            <input id="icGraphSearch" type="search" placeholder="Filter: Hydrogen, UAE, Net Zero…" value="" />
            <button type="button" class="ic-mini-btn" id="icGraphRun">Search graph</button>
          </div>
          <p class="ic-muted" id="icGraphStatus">Loading relationship graph…</p>
          <div id="icGraphSvgHost"></div>
          <h3 class="ic-subhead" style="margin-top:16px">Reasoning paths</h3>
          <div id="icGraphPaths"></div>
          <div class="ic-evidence-box" id="icGraphEvidence" hidden></div>`,
          "Know · Trust"
        )}
      `;
    },

    relationship() {
      return `
        ${ctoStrip({
          know: "Typed edges across the library",
          health: "supersedes · supports · implements · references",
          trust: "Connected knowledge, not isolated PDFs",
        })}
        ${panel(
          "Knowledge Relationships",
          `<p class="ic-muted" id="icRelStatus">Loading…</p>
           <div id="icRelLegend" class="ic-flag-grid" style="margin-bottom:12px"></div>
           <div id="icRelPaths"></div>
           <div id="icRelSvgHost"></div>`,
          "Know · Trust"
        )}
      `;
    },

    semantic() {
      return panel(
        "Semantic Search",
        `<p class="ic-muted">Operator console for retrieval diagnostics. Core frozen — surface only.</p>`,
        "Know"
      );
    },
    planner() {
      return panel(
        "Query Planner",
        `<div class="ic-flag-grid">
          ${["SEMANTIC", "GRAPH", "ONTOLOGY", "HYBRID", "COMPARISON", "REASONING"]
            .map((s) => `<div class="ic-flag">${s}</div>`)
            .join("")}
        </div>`,
        "Health"
      );
    },
    truth() {
      return panel(
        "Truth Engine",
        `<div class="ic-metric-grid">${card("Status", "Healthy")}${card("Sample Decision", "SUPPORTED")}</div>`,
        "Trust"
      );
    },
    inference() {
      return panel(
        "Inference",
        `<p class="ic-muted">Enabled · deterministic rules · no OpenAI inside inference.</p>`,
        "Health"
      );
    },
    reasoning() {
      return panel(
        "Reasoning Debugger",
        `<p class="ic-query-line"><span>Question</span><strong>Should Oman invest in Green Hydrogen?</strong></p>
         <table class="ic-table">
           <tbody>
             <tr><td>Semantic</td><td>92 ms</td></tr>
             <tr><td>Graph</td><td>18 ms</td></tr>
             <tr><td>Inference</td><td>4 ms</td></tr>
             <tr><td>Truth</td><td>7 ms</td></tr>
             <tr><td><strong>Total</strong></td><td><strong>121 ms</strong></td></tr>
           </tbody>
         </table>
         <p class="ic-muted">Visualizes existing telemetry shape — no new backend.</p>`,
        "Health · Trust"
      );
    },
    confidence() {
      return panel(
        "Confidence",
        `<div class="ic-metric-grid">${card("Sample Confidence", "95%", { bar: 95 })}${card("Decision Readiness", "92%", { bar: 92 })}</div>`,
        "Trust"
      );
    },
    evidence() {
      return panel(
        "Evidence Inspector",
        `<div class="ic-metric-grid">
          ${card("Government", "12")}
          ${card("International", "4")}
          ${card("Research", "6")}
          ${card("Industry", "2")}
          ${card("Conflicts", "0")}
          ${card("Confidence", "95%", { bar: 95 })}
          ${card("Decision", "SUPPORTED")}
        </div>`,
        "Trust"
      );
    },

    queries() {
      const topics = [
        ["Hydrogen", 284],
        ["Carbon Markets", 144],
        ["ESG", 102],
        ["Renewables", 388],
      ];
      return `
        ${ctoStrip({ know: "Topic demand", health: "Usage signal", trust: "Guides curation priority" })}
        ${panel(
          "Today's Questions (preview mix)",
          topics
            .map(
              ([t, n]) =>
                `<div class="ic-topic-row"><span>${escapeHtml(t)}</span><strong>${n}</strong>${bar(Math.min(100, n / 4))}</div>`
            )
            .join("") +
            `<p class="ic-muted">Preview distribution — replace with live query logs when telemetry is exposed.</p>`,
          "Know"
        )}
      `;
    },

    reports() {
      return panel(
        "Executive Reports",
        `<div class="ic-cta-row">
          <button type="button" class="ic-mini-btn" data-export="pdf">Generate PDF</button>
          <button type="button" class="ic-mini-btn" data-export="docx">Generate DOCX</button>
          <button type="button" class="ic-mini-btn" data-export="pptx">PowerPoint (Future)</button>
          <button type="button" class="ic-mini-btn" data-export="share">Share Link</button>
          <button type="button" class="ic-mini-btn" data-export="archive">Archive</button>
        </div>
        <p class="ic-muted">Epic 3 Report Engine. Workspace export shell is ready.</p>
        <a class="ic-link-btn" href="/carbon-brain.html">Open Executive Workspace</a>`,
        "Trust"
      );
    },

    users() {
      return panel("Users", `<p class="ic-muted">Demo accounts prep is Sprint 2 launch track.</p>`, "Health");
    },

    telemetry() {
      return panel(
        "Telemetry",
        `<div class="ic-metric-grid">
          ${card("Average Response", "0.82 sec", { sub: "Sample shape" })}
          ${card("Semantic", "92 ms")}
          ${card("Graph", "18 ms")}
          ${card("Inference", "4 ms")}
          ${card("Truth", "7 ms")}
        </div>
        <p class="ic-muted">Uses existing profiler/metrics modules — dashboard visualization only.</p>`,
        "Health"
      );
    },

    benchmarks() {
      return panel(
        "Benchmarks",
        `<p class="ic-muted">First 100 questions — fix knowledge, not prompts.</p>`,
        "Trust"
      );
    },

    kpis() {
      const h = stats.knowledgeHealth || {};
      return panel(
        "Launch KPI Dashboard",
        `<div class="ic-metric-grid">
          ${card("Knowledge Health", pct(h.overall), { bar: h.overall })}
          ${card("Document Coverage", pct(h.coverage), { bar: h.coverage })}
          ${card("Metadata", pct(h.metadata), { bar: h.metadata })}
          ${card("Embeddings", pct(h.embeddings), { bar: h.embeddings })}
          ${card("Graph Integrity", pct(h.relationships), { bar: h.relationships })}
          ${card("Broken Documents", fmt(h.brokenLinks ?? 0))}
          ${card("Duplicate Documents", fmt(h.duplicateDocuments ?? 0))}
        </div>`,
        "Health"
      );
    },

    monitoring() {
      return panel(
        "Intelligence Monitoring",
        `<div class="ic-metric-grid">
          ${card("Truth Engine", "Healthy")}
          ${card("Inference", "Enabled")}
          ${card("Planner", "Healthy")}
          ${card("Semantic", "Healthy")}
          ${card("Graph", "Healthy")}
        </div>`,
        "Health"
      );
    },

    health() {
      const h = stats.knowledgeHealth || {};
      return panel(
        "Health Monitor",
        `<div class="ic-metric-grid">
          ${card("Knowledge Health", pct(h.overall), { bar: h.overall })}
          ${card("Metadata", pct(h.metadata), { bar: h.metadata })}
          ${card("Embeddings", pct(h.embeddings), { bar: h.embeddings })}
          ${card("Broken Documents", fmt(h.brokenLinks ?? 0))}
          ${card("Duplicate Documents", fmt(h.duplicateDocuments ?? 0))}
        </div>`,
        "Health"
      );
    },

    settings() {
      return comingSoonPanel("Settings");
    },
    security() {
      return panel("Security", `<p class="ic-muted">JWT / secrets posture — see ops docs.</p>`, "Trust");
    },
    apikeys() {
      return panel("API Keys", `<p class="ic-muted">Managed on Render env — not stored in browser.</p>`, "Trust");
    },
    logs() {
      return comingSoonPanel("Logs");
    },
    backups() {
      return panel("Backups", `<p class="ic-muted">Atlas backups + knowledge sidecar git discipline.</p>`, "Health");
    },
  };
}
