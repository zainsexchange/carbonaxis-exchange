/**
 * Page: Enterprise Intelligence Center
 * Entry: intelligence-center.html → type=module
 */
import { escapeHtml } from "../components/dom.js";
import { renderIcSideNav, NAV_BY_SECTION } from "../components/IcSideNav.js";
import {
  renderLibraryGraphSvg,
  renderReasoningPaths,
} from "../components/LibraryGraph.js";
import { fetchLibraryGraph } from "../services/graph.js";
import { loadLibraryStats } from "../services/libraryStats.js";
import { VIEW_TITLES, DEMO_DOC, createIcViews } from "./ic-views.js";

const content = document.getElementById("icContent");
const titleEl = document.getElementById("icTitle");
const kickerEl = document.getElementById("icKicker");
const sideNav = document.getElementById("icSideNav");
const topTabs = document.querySelector(".ic-top-tabs");
const notifyDrawer = document.getElementById("icNotifyDrawer");
const notifyList = document.getElementById("icNotifyList");

const NOTIFICATIONS = [
  { title: "New UAE regulation added", when: "2 hours ago" },
  { title: "Knowledge sync completed", when: "Today" },
  { title: "Benchmark tests passed", when: "Today" },
  { title: "System backup completed", when: "Yesterday" },
];

let section = "dashboard";
let view = "dashboard";
let views = createIcViews({});

function showNodeEvidence(node, graph) {
  const box = content.querySelector("#icGraphEvidence");
  if (!box || !node) return;
  box.hidden = false;
  const related = (graph?.edges || []).filter(
    (e) => e.from === node.id || e.to === node.id
  );
  const lines = related
    .slice(0, 8)
    .map((e) => {
      const otherId = e.from === node.id ? e.to : e.from;
      const other =
        (graph.nodes || []).find((n) => n.id === otherId)?.label || otherId;
      return `<li><span class="ic-muted">${escapeHtml(e.type)}</span> → ${escapeHtml(other)}</li>`;
    })
    .join("");
  box.innerHTML = `<strong>${escapeHtml(node.label || node.title || node.id)}</strong>
    <p class="ic-muted">${escapeHtml(node.kind || "node")}${
      node.country ? " · " + escapeHtml(node.country) : ""
    }${node.status ? " · " + escapeHtml(node.status) : ""}</p>
    <ul>${
      lines ||
      "<li class='ic-muted'>No edges on this node in the current filter.</li>"
    }</ul>`;
}

async function hydrateGraphViews(seed = "") {
  const statusEl =
    content.querySelector("#icGraphStatus") ||
    content.querySelector("#icRelStatus");
  const svgHost =
    content.querySelector("#icGraphSvgHost") ||
    content.querySelector("#icRelSvgHost");
  const pathsHost =
    content.querySelector("#icGraphPaths") ||
    content.querySelector("#icRelPaths");

  if (!svgHost && !pathsHost) return;

  if (statusEl) {
    statusEl.textContent = "Loading live library relationships…";
  }

  const graph = await fetchLibraryGraph({
    q: seed,
    limit: 50,
  });

  if (!graph) {
    if (statusEl) {
      statusEl.textContent =
        "Live graph needs admin login (adminToken) and Render library API.";
    }
    if (svgHost) {
      svgHost.innerHTML =
        '<p class="ic-muted">Sign in as admin, then reopen Knowledge Graph. Data: /api/intelligence/library/graph (ops only — ask engine untouched).</p>';
    }
    return;
  }

  if (statusEl) {
    const s = graph.summary || {};
    statusEl.textContent = `Live Mongo · ${s.nodes || 0} nodes · ${s.edges || 0} edges · ${s.themes || 0} themes · ${s.paths || 0} paths`;
  }

  const legend = content.querySelector("#icRelLegend");
  if (legend) {
    const types = [...new Set((graph.edges || []).map((e) => e.type))];
    legend.innerHTML =
      types.map((t) => `<div class="ic-flag">${escapeHtml(t)}</div>`).join("") ||
      '<div class="ic-flag">no edges</div>';
  }

  renderLibraryGraphSvg(svgHost, graph, {
    onNodeClick: (node) => showNodeEvidence(node, graph),
  });
  renderReasoningPaths(pathsHost, graph.paths || []);

  pathsHost?.querySelectorAll("[data-path-label]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const label = btn.getAttribute("data-path-label");
      const node = (graph.nodes || []).find(
        (n) => (n.label || n.title) === label
      );
      if (node) showNodeEvidence(node, graph);
    });
  });
}

function bindHandlers() {
  content.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-go");
      if (
        next === "library" ||
        next === "document" ||
        next === "entity" ||
        next === "relationship" ||
        next === "graph"
      ) {
        section = "knowledge";
        topTabs?.querySelectorAll(".ic-top-tab").forEach((t) => {
          t.classList.toggle("is-active", t.dataset.section === "knowledge");
        });
      }
      render(next);
    });
  });

  content.querySelectorAll("[data-export]").forEach((btn) => {
    btn.addEventListener("click", () => {
      alert(
        "Executive report “" +
          btn.dataset.export +
          "” is Sprint 2 Priority 3. Workspace export shell is ready."
      );
    });
  });

  const tabs = content.querySelector("[data-tabs]");
  tabs?.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    const idx = tab.dataset.tab;
    tabs
      .querySelectorAll(".ic-tab")
      .forEach((t) => t.classList.toggle("is-active", t === tab));
    content.querySelectorAll("[data-panel]").forEach((p) => {
      p.hidden = p.dataset.panel !== idx;
    });
  });

  content.querySelector("#icGraphRun")?.addEventListener("click", () => {
    const q = content.querySelector("#icGraphSearch")?.value || "";
    hydrateGraphViews(q);
  });
}

function render(nextView) {
  view = views[nextView] ? nextView : "dashboard";
  if (titleEl) titleEl.textContent = VIEW_TITLES[view] || view;
  if (kickerEl) {
    kickerEl.textContent = "CTO-004 · What we know · How healthy · Why trust";
  }
  renderIcSideNav(sideNav, section, view);
  if (content) {
    content.innerHTML = views[view]();
    bindHandlers();
    if (view === "graph" || view === "relationship") {
      const seed = content.querySelector("#icGraphSearch")?.value || "";
      hydrateGraphViews(seed);
    }
  }
}

topTabs?.addEventListener("click", (e) => {
  const tab = e.target.closest(".ic-top-tab[data-section]");
  if (!tab) return;
  section = tab.dataset.section;
  topTabs.querySelectorAll(".ic-top-tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.section === section);
  });
  const first = (NAV_BY_SECTION[section] || [])[0];
  render(first ? first.view : "dashboard");
});

sideNav?.addEventListener("click", (e) => {
  const btn = e.target.closest(".ic-nav-item[data-view]");
  if (!btn) return;
  render(btn.dataset.view);
});

function openNotifications() {
  if (!notifyList || !notifyDrawer) return;
  notifyList.innerHTML = NOTIFICATIONS.map(
    (n) =>
      `<li><strong>${escapeHtml(n.title)}</strong><span>${escapeHtml(n.when)}</span></li>`
  ).join("");
  notifyDrawer.hidden = false;
}

document.getElementById("icNotifyBtn")?.addEventListener("click", openNotifications);
document.getElementById("icNotifyClose")?.addEventListener("click", () => {
  if (notifyDrawer) notifyDrawer.hidden = true;
});

async function boot() {
  const stats = await loadLibraryStats();
  views = createIcViews(stats, DEMO_DOC);
  render("dashboard");
}

boot();
