document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  try {
    const response = await fetch(`${API.BASE}${API.dashboard}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      renderEmptyActivity("Could not load dashboard data.");
      renderEmptyWatchlist("Could not load watchlist.");
      return;
    }

    updateGreeting(data.user.name);
    updateProfile(data.user);
    updateStats(data.stats, data.user);
    renderActivity(data.activity || []);
    renderWatchlistPreview(data.watchlist || []);
  } catch (error) {
    console.error(error);
    renderEmptyActivity("Network error loading activity.");
    renderEmptyWatchlist("Network error loading watchlist.");
  }
});

function updateGreeting(name) {
  const greeting = document.getElementById("dashboardGreeting");
  if (!greeting) return;

  const hour = new Date().getHours();
  let message = "Welcome";
  if (hour < 12) message = "Good Morning";
  else if (hour < 18) message = "Good Afternoon";
  else message = "Good Evening";

  greeting.textContent = `${message}, ${name}`;
}

function updateProfile(user) {
  const avatar = document.querySelector(".profile-avatar");
  const account = document.querySelector(".profile-btn span:nth-child(2)");

  if (avatar && user?.name) {
    avatar.textContent = user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }

  if (account && user?.name) {
    account.textContent = user.name.split(" ")[0];
  }
}

function updateStats(stats, user) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("creditsWatched", stats.creditsWatched ?? 0);
  setText("projectsSubmitted", stats.projectsSubmitted ?? 0);
  setText("verifiedProjects", stats.verifiedProjects ?? 0);
  setText("openDeals", stats.openDeals ?? 0);

  const co2 = Number(stats.co2ePotential || 0);
  setText(
    "co2eImpact",
    co2 > 0 ? `${co2.toLocaleString()} t` : "—"
  );

  const aiLimit =
    stats.aiLimit == null || stats.aiLimit === Infinity || stats.aiLimit > 900000
      ? "∞"
      : stats.aiLimit;
  setText("aiSearches", `${stats.aiSearches || 0} / ${aiLimit}`);

  const headline = document.getElementById("workspaceHeadline");
  const sub = document.getElementById("workspaceSub");
  const plan = (user?.subscription || "free").toString();
  if (headline) {
    headline.textContent =
      plan === "free"
        ? "Free plan workspace"
        : `${plan.charAt(0).toUpperCase()}${plan.slice(1)} plan workspace`;
  }
  if (sub) {
    sub.textContent = `${stats.projectsSubmitted || 0} projects · ${
      stats.creditsWatched || 0
    } watchlist · ${stats.openDeals || 0} open deals`;
  }
}

function timeAgo(dateValue) {
  if (!dateValue) return "";
  const s = Math.floor((Date.now() - new Date(dateValue).getTime()) / 1000);
  if (Number.isNaN(s) || s < 0) return "";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(dateValue).toLocaleDateString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEmptyActivity(message) {
  const list = document.getElementById("activityList");
  const badge = document.getElementById("activityBadge");
  if (badge) badge.textContent = "Empty";
  if (!list) return;
  list.innerHTML = `
    <div class="activity-item dash-empty">
      <div>
        <h4>${escapeHtml(message || "No activity yet")}</h4>
        <p>Create a project, save a listing, or request a deal to see activity here.</p>
        <p style="margin-top:10px">
          <a class="btn btn-outline" href="/marketplace.html">Browse marketplace</a>
          <a class="btn btn-primary" href="/project-editor.html">Add project</a>
        </p>
      </div>
    </div>`;
}

function renderActivity(items) {
  const list = document.getElementById("activityList");
  const badge = document.getElementById("activityBadge");
  if (!list) return;

  if (!items.length) {
    renderEmptyActivity("No activity yet");
    return;
  }

  if (badge) badge.textContent = `${items.length} updates`;

  const typeLabel = {
    project: "Project",
    watchlist: "Watchlist",
    deal: "Deal",
  };

  list.innerHTML = items
    .map((item) => {
      const href = item.href || "#";
      return `
      <a class="activity-item activity-item-link" href="${escapeHtml(href)}">
        <div class="activity-dot"></div>
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(typeLabel[item.type] || item.type)} · ${escapeHtml(
        item.detail || ""
      )}</p>
        </div>
        <span>${escapeHtml(timeAgo(item.at))}</span>
      </a>`;
    })
    .join("");
}

function renderEmptyWatchlist(message) {
  const grid = document.getElementById("watchlistPreview");
  if (!grid) return;
  grid.innerHTML = `
    <div class="watchlist-item dash-empty">
      <h4>${escapeHtml(message || "No saved listings")}</h4>
      <p>Add projects from the marketplace to track them here.</p>
      <a class="btn btn-outline" href="/marketplace.html">Open marketplace</a>
    </div>`;
}

function renderWatchlistPreview(items) {
  const grid = document.getElementById("watchlistPreview");
  if (!grid) return;

  if (!items.length) {
    renderEmptyWatchlist("No saved listings yet");
    return;
  }

  grid.innerHTML = items
    .map(
      (item) => `
    <a class="watchlist-item watchlist-item-link" href="/watchlist.html">
      <h4>${escapeHtml(item.title || "Listing")}</h4>
      <p>${escapeHtml(item.country || "—")}${
        item.volume ? ` · ${escapeHtml(item.volume)}` : ""
      }</p>
      <span>${escapeHtml(item.price || item.category || "Saved")}</span>
    </a>`
    )
    .join("");
}

function inlinePulseMd(text) {
  let html = escapeHtml(String(text ?? ""));
  html = html.replace(/#{1,6}\s*/g, "");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  return html;
}

function stripPulseHeading(line) {
  return String(line || "")
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .trim();
}

/** Render pulse markdown like Intelligence (no raw ### or - shown) */
function formatPulseHtml(text) {
  const lines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (/^#{1,6}/.test(trimmed)) {
      const title = stripPulseHeading(trimmed);
      if (title) blocks.push(`<h4 class="ai-md-h">${inlinePulseMd(title)}</h4>`);
    } else if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(
          `<li>${inlinePulseMd(lines[i].trim().replace(/^[-*•]\s+/, ""))}</li>`
        );
        i += 1;
      }
      blocks.push(`<ul class="ai-md-list">${items.join("")}</ul>`);
      continue;
    } else if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(
          `<li>${inlinePulseMd(lines[i].trim().replace(/^\d+[.)]\s+/, ""))}</li>`
        );
        i += 1;
      }
      blocks.push(`<ol class="ai-md-list">${items.join("")}</ol>`);
      continue;
    } else if (trimmed === "" || trimmed === "---" || trimmed === "***") {
      blocks.push('<div class="ai-md-gap"></div>');
    } else if (trimmed) {
      blocks.push(`<p class="ai-md-p">${inlinePulseMd(trimmed)}</p>`);
    }
    i += 1;
  }

  return blocks.join("");
}

async function refreshIntelligencePulse() {
  const token = (localStorage.getItem("token") || "").trim();
  const btn = document.getElementById("aiPulseRefreshBtn");
  const live = document.getElementById("aiPulseLive");
  const body = document.getElementById("aiPulseLiveBody");
  const meta = document.getElementById("aiPulseLiveMeta");
  const badge = document.getElementById("aiPulseBadge");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }
  if (!API?.aiAsk) {
    alert("AI API not loaded. Re-upload js/api.js");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Refreshing…";
  }
  if (badge) badge.textContent = "Updating…";

  try {
    const question = `Give a short CarbonAxis Intelligence market pulse (max 180 words) for dashboard users.

Cover:
1) One South Asia or Asia-Pacific green-energy / carbon-market signal
2) One GCC, Europe, or Americas signal
3) One worldwide caution or opportunity

Use clear bullets with bold labels. Do not use markdown headings (no # / ## / ###). Research tone. No Verdict/PROCEED trading template. Not legal advice.`;

    const res = await fetch(`${API.BASE}${API.aiAsk}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question,
        country: "Global",
        product: "green energy",
        conversation: [],
      }),
    });
    const data = await res.json();

    if (!data.success) {
      if (body) {
        body.textContent = data.message || "Could not refresh pulse.";
      }
      if (live) live.hidden = false;
      if (badge) badge.textContent = "Pulse unavailable";
      return;
    }

    if (body) body.innerHTML = formatPulseHtml(data.answer || "");
    if (live) live.hidden = false;
    if (meta) {
      meta.textContent = data.quota?.unlimited
        ? "Live · Unlimited"
        : `Live · ${data.quota?.remaining ?? "?"} left`;
    }
    if (badge) badge.textContent = "Live pulse";

    try {
      localStorage.setItem(
        "carbonaxis_ai_pulse",
        JSON.stringify({
          answer: data.answer,
          at: Date.now(),
          meta: meta?.textContent || "Live",
        })
      );
    } catch (_) {}
  } catch (err) {
    console.error(err);
    if (body) body.textContent = "Network error while refreshing pulse.";
    if (live) live.hidden = false;
    if (badge) badge.textContent = "Offline";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Refresh pulse";
    }
  }
}

function restoreCachedPulse() {
  const live = document.getElementById("aiPulseLive");
  const body = document.getElementById("aiPulseLiveBody");
  const meta = document.getElementById("aiPulseLiveMeta");
  const badge = document.getElementById("aiPulseBadge");
  try {
    const raw = localStorage.getItem("carbonaxis_ai_pulse");
    if (!raw) return;
    const cached = JSON.parse(raw);
    if (!cached?.answer || Date.now() - (cached.at || 0) > 24 * 60 * 60 * 1000) {
      return;
    }
    if (body) body.innerHTML = formatPulseHtml(cached.answer);
    if (live) live.hidden = false;
    if (meta) meta.textContent = cached.meta || "Cached";
    if (badge) badge.textContent = "Cached pulse";
  } catch (_) {}
}

document.addEventListener("DOMContentLoaded", () => {
  restoreCachedPulse();
  document
    .getElementById("aiPulseRefreshBtn")
    ?.addEventListener("click", refreshIntelligencePulse);

  const params = new URLSearchParams(window.location.search);
  const banner = document.getElementById("billingBanner");
  if (banner && params.get("billing") === "success") {
    const plan = params.get("plan") || "Pro";
    banner.hidden = false;
    banner.textContent = `Payment received — ${String(
      plan
    ).toUpperCase()} will activate shortly. Refresh if your plan label has not updated yet.`;
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch (_) {}
  }
});
