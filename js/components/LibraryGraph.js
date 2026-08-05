/**
 * Interactive library relationship graph (documents + themes).
 * Read-only visualization — no RAG side effects.
 */

import { escapeHtml } from "./dom.js";

const EDGE_COLORS = {
  supersedes: "rgba(59,130,246,.7)",
  references: "rgba(249,115,22,.7)",
  similar: "rgba(148,163,184,.45)",
  supports: "rgba(0,229,176,.65)",
  implements: "rgba(168,85,247,.65)",
  mentions: "rgba(100,116,139,.5)",
  related: "rgba(148,163,184,.4)",
  amends: "rgba(234,179,8,.65)",
};

function truncate(text, max = 28) {
  const s = String(text || "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Radial force-ish layout: themes on outer ring, documents on inner.
 */
export function layoutLibraryGraph(nodes = [], width = 720, height = 420) {
  const cx = width / 2;
  const cy = height / 2;
  const docs = nodes.filter((n) => n.kind === "document");
  const themes = nodes.filter((n) => n.kind === "theme");
  const positions = {};

  themes.forEach((node, idx) => {
    const angle = (Math.PI * 2 * idx) / Math.max(themes.length, 1) - Math.PI / 2;
    positions[node.id] = {
      x: cx + Math.cos(angle) * Math.min(width, height) * 0.38,
      y: cy + Math.sin(angle) * Math.min(width, height) * 0.38,
    };
  });

  docs.forEach((node, idx) => {
    const angle = (Math.PI * 2 * idx) / Math.max(docs.length, 1) - Math.PI / 2;
    positions[node.id] = {
      x: cx + Math.cos(angle) * Math.min(width, height) * 0.22,
      y: cy + Math.sin(angle) * Math.min(width, height) * 0.22,
    };
  });

  return positions;
}

export function renderLibraryGraphSvg(
  container,
  graph = {},
  { width = 720, height = 420, onNodeClick } = {}
) {
  if (!container) return;

  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const positions = layoutLibraryGraph(nodes, width, height);

  if (!nodes.length) {
    container.innerHTML =
      '<p class="ic-muted">No relationship nodes yet — upload and process documents, then open this graph.</p>';
    return;
  }

  const edgeHtml = edges
    .map((edge) => {
      const a = positions[edge.from];
      const b = positions[edge.to];
      if (!a || !b) return "";
      const stroke = EDGE_COLORS[edge.type] || EDGE_COLORS.related;
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${stroke}" stroke-width="1.4" opacity="0.85"><title>${escapeHtml(edge.type)}</title></line>`;
    })
    .join("");

  const nodeHtml = nodes
    .map((node) => {
      const p = positions[node.id];
      if (!p) return "";
      const isTheme = node.kind === "theme";
      const r = isTheme ? 12 : 9;
      const fill = isTheme ? "#00e5b0" : "#3b82f6";
      return `
        <g class="lib-graph-node" data-id="${escapeHtml(node.id)}" data-kind="${escapeHtml(node.kind || "")}" style="cursor:pointer">
          <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" stroke="rgba(255,255,255,.3)" stroke-width="1"></circle>
          <text x="${p.x + r + 4}" y="${p.y + 4}" fill="#e8f7f2" font-size="10">${escapeHtml(truncate(node.label || node.title, 26))}</text>
        </g>`;
    })
    .join("");

  container.innerHTML = `
    <svg class="lib-graph-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Knowledge relationship graph" style="width:100%;height:auto;background:rgba(0,0,0,.22);border-radius:12px;border:1px solid rgba(255,255,255,.08)">
      ${edgeHtml}${nodeHtml}
    </svg>
    <p class="ic-muted" style="margin-top:8px;font-size:12px">
      Themes (green) · Documents (blue) · Edges: supersedes / supports / implements / references / similar
    </p>
  `;

  container.querySelectorAll(".lib-graph-node").forEach((g) => {
    g.addEventListener("click", () => {
      const id = g.getAttribute("data-id");
      const node = nodes.find((n) => n.id === id);
      onNodeClick?.(node, graph);
    });
  });
}

export function renderReasoningPaths(container, paths = []) {
  if (!container) return;
  if (!paths.length) {
    container.innerHTML =
      '<p class="ic-muted">No multi-hop paths yet. Paths appear when documents share themes.</p>';
    return;
  }

  container.innerHTML = paths
    .map((path) => {
      const labels = path.labels || [];
      return `<div class="ic-graph-path" style="margin-bottom:12px">${labels
        .map(
          (label, i) =>
            `${i ? '<span class="ic-graph-arrow">↓</span>' : ""}<button type="button" class="ic-graph-node" data-path-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`
        )
        .join("")}</div>`;
    })
    .join("");
}
