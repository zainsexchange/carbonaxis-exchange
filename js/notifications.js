(function initNotifications() {
  const token = (localStorage.getItem("token") || "").trim();
  if (!token) return;

  const API_BASE =
    typeof API !== "undefined" && API.BASE
      ? API.BASE
      : window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
        ? "http://localhost:5000/api"
        : "https://carbonaxis-exchange.onrender.com/api";

  const menu = document.querySelector(".notification-menu");
  const countEl = document.querySelector(".notification-count");
  const dropdown = document.querySelector(".notification-dropdown");
  if (!menu || !dropdown) return;

  let listEl = dropdown.querySelector(".notification-list");
  if (!listEl) {
    listEl = document.createElement("div");
    listEl.className = "notification-list";
    dropdown.innerHTML = "";
    dropdown.appendChild(listEl);
  }

  let headEl = dropdown.querySelector(".notification-dropdown-head");
  if (!headEl) {
    headEl = document.createElement("div");
    headEl.className = "notification-dropdown-head";
    headEl.innerHTML = `
      <strong>Notifications</strong>
      <button type="button" class="notification-mark-all" hidden>Mark all read</button>
    `;
    dropdown.insertBefore(headEl, listEl);
  }

  const markAllBtn = headEl.querySelector(".notification-mark-all");
  let unreadCount = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatWhen(dateValue) {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";

    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function updateBadge(count) {
    unreadCount = Math.max(0, Number(count) || 0);
    if (!countEl) return;

    if (unreadCount > 0) {
      countEl.hidden = false;
      countEl.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    } else {
      countEl.hidden = true;
      countEl.textContent = "0";
    }

    if (markAllBtn) {
      markAllBtn.hidden = unreadCount === 0;
    }
  }

  function renderEmpty(message) {
    listEl.innerHTML = `<p class="notification-empty">${escapeHtml(message)}</p>`;
  }

  function renderNotifications(items) {
    if (!items.length) {
      renderEmpty("No notifications yet.");
      return;
    }

    listEl.innerHTML = items
      .map((item) => {
        const unreadClass = item.read ? "" : " unread";
        const when = formatWhen(item.createdAt);
        const inner = `
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.message || "")}</p>
          ${when ? `<time class="notification-time">${escapeHtml(when)}</time>` : ""}
        `;

        if (item.href) {
          return `<a class="notification-item notification-item-link${unreadClass}" href="${escapeHtml(item.href)}" data-id="${escapeHtml(item._id)}">${inner}</a>`;
        }

        return `<div class="notification-item${unreadClass}" data-id="${escapeHtml(item._id)}">${inner}</div>`;
      })
      .join("");

    listEl.querySelectorAll("[data-id]").forEach((node) => {
      node.addEventListener("click", () => {
        const id = node.getAttribute("data-id");
        if (id) markRead(id);
      });
    });
  }

  async function markRead(id) {
    try {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        updateBadge(data.unreadCount);
        const node = listEl.querySelector(`[data-id="${id}"]`);
        if (node) node.classList.remove("unread");
      }
    } catch {
      /* ignore */
    }
  }

  async function markAllRead() {
    try {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) return;
      updateBadge(0);
      listEl.querySelectorAll(".notification-item.unread").forEach((node) => {
        node.classList.remove("unread");
      });
    } catch {
      /* ignore */
    }
  }

  async function loadNotifications() {
    renderEmpty("Loading…");

    try {
      const res = await fetch(`${API_BASE}/notifications?limit=15`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (res.status === 404) {
        renderEmpty("Notifications API not live yet. Redeploy server.js on Render.");
        return;
      }

      if (res.status === 401) {
        renderEmpty("Session expired. Please log in again.");
        return;
      }

      if (!res.ok || !data.success) {
        renderEmpty(data.message || "Could not load notifications.");
        return;
      }

      updateBadge(data.unreadCount);
      renderNotifications(data.notifications || []);
    } catch {
      renderEmpty("Could not reach the server. Try again shortly.");
    }
  }

  if (markAllBtn) {
    markAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      markAllRead();
    });
  }

  menu.addEventListener("click", () => {
    if (menu.classList.contains("active")) {
      loadNotifications();
    }
  });

  loadNotifications();
})();
