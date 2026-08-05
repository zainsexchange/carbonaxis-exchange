/**
 * Knowledge relationship graph client (admin library APIs).
 * Does not call ask / RAG endpoints.
 */

function apiBase() {
  if (typeof window !== "undefined" && window.API && window.API.BASE) {
    return window.API.BASE;
  }
  return "http://localhost:5000/api";
}

function authHeaders() {
  const token =
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("adminToken") ||
        localStorage.getItem("token"))) ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch corpus relationship graph from library ops.
 * @returns {Promise<object|null>}
 */
export async function fetchLibraryGraph(params = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.country) qs.set("country", params.country);
  if (params.limit) qs.set("limit", String(params.limit));

  const url =
    `${apiBase()}/intelligence/library/graph` +
    (qs.toString() ? `?${qs}` : "");

  try {
    const res = await fetch(url, {
      headers: {
        ...authHeaders(),
        Accept: "application/json",
      },
    });
    const text = await res.text();
    if (text.trim().startsWith("<")) return null;
    const data = JSON.parse(text);
    if (!res.ok || !data.success) return null;
    return data.graph || null;
  } catch {
    return null;
  }
}

/** @deprecated use fetchLibraryGraph — kept for IC call sites */
export async function fetchGraphPath(seed) {
  const graph = await fetchLibraryGraph({ q: seed || "", limit: 40 });
  if (!graph) return null;
  const path = (graph.paths && graph.paths[0]) || null;
  return {
    graph,
    path,
    labels: path?.labels || [],
  };
}
