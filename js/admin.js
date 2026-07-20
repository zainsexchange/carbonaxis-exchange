(() => {
  const API_BASE =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:5000"
      : "https://carbonaxis-exchange.onrender.com";

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  if (!token || user.role !== "admin") {
    localStorage.removeItem("adminLoggedIn");
    window.location.href = "admin-login.html";
    return;
  }

  const state = {
    deals: [],
    projects: [],
    users: [],
    projectFilter: "Pending",
    dealFilter: "Open",
    userPlanFilter: "all",
    activeDealId: null,
    refreshTimer: null,
  };

  const labelEl = document.getElementById("adminUserLabel");
  if (labelEl) {
    labelEl.textContent = user.name
      ? `${user.name} (${user.email})`
      : user.email || "Admin";
  }

  function adminHeaders(json = false) {
    const headers = { Authorization: `Bearer ${token}` };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  function escapeTextarea(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;");
  }

  function escapeHtml(value) {
    return escapeTextarea(value).replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function statusPill(status, kind = "deal") {
    const raw = String(status || "Pending");
    const slug = raw.toLowerCase().replace(/\s+/g, "-");
    const cls =
      kind === "project" && raw === "Rejected"
        ? "rejected-proj"
        : slug;
    return `<span class="pill ${cls}">${escapeHtml(raw)}</span>`;
  }

  function planPill(plan) {
    const id = ["free", "pro", "enterprise"].includes(plan) ? plan : "free";
    const label = id.charAt(0).toUpperCase() + id.slice(1);
    return `<span class="plan-pill ${id}">${label}</span>`;
  }

  function showToast(title, body, type = "ok") {
    const host = document.getElementById("toastHost");
    if (!host) return;
    const el = document.createElement("div");
    el.className = `toast${type === "error" ? " error" : type === "warn" ? " warn" : ""}`;
    el.innerHTML = `
      <p class="title">${escapeHtml(title)}</p>
      <p class="body">${escapeHtml(body)}</p>
      <div class="actions"><button type="button">Dismiss</button></div>`;
    el.querySelector("button").onclick = () => el.remove();
    host.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  async function apiRequest(url, options = {}) {
    const res = await fetch(url, options);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
  }

  function setCountCard(totalId, textId, list, pendingFn) {
    const total = list.length;
    const pending = pendingFn ? list.filter(pendingFn).length : 0;
    const totalEl = document.getElementById(totalId);
    const textEl = document.getElementById(textId);
    if (totalEl) {
      totalEl.innerHTML =
        pendingFn && pending > 0
          ? `${total}<small>${pending} need attention</small>`
          : String(total);
    }
    if (textEl) textEl.textContent = String(total);
  }

  function applyTableSearch(inputId, tableId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const filter = input.value.toLowerCase();
    document.querySelectorAll(`#${tableId} tr`).forEach((row) => {
      const statusOk = row.dataset.filterVisible !== "0";
      const searchOk =
        !filter || row.textContent.toLowerCase().includes(filter);
      row.style.display = statusOk && searchOk ? "" : "none";
    });
  }

  function applyProjectFilter(status) {
    state.projectFilter = status;
    document.querySelectorAll("#projectStatusFilters button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.status === status);
    });
    document.querySelectorAll("#projectTable tr").forEach((row) => {
      const rowStatus = row.dataset.status || "";
      row.dataset.filterVisible =
        status === "all" || rowStatus === status ? "1" : "0";
    });
    applyTableSearch("projectSearch", "projectTable");
  }

  function applyDealFilter(status) {
    state.dealFilter = status;
    document.querySelectorAll("#dealStatusFilters button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.status === status);
    });
    document.querySelectorAll("#dealTable tr").forEach((row) => {
      const rowStatus = row.dataset.status || "";
      row.dataset.filterVisible =
        status === "all" || rowStatus === status ? "1" : "0";
    });
    applyTableSearch("dealSearch", "dealTable");
  }

  function applyUserPlanFilter(plan) {
    state.userPlanFilter = plan;
    document.querySelectorAll("#userPlanFilters button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.plan === plan);
    });
    document.querySelectorAll("#userTable tr").forEach((row) => {
      const rowPlan = row.dataset.plan || "free";
      row.dataset.filterVisible =
        plan === "all" || rowPlan === plan ? "1" : "0";
    });
    applyTableSearch("userSearch", "userTable");
  }

  window.jumpToSection = function jumpToSection(key) {
    const map = {
      users: "section-users",
      early: "section-early",
      projects: "section-projects",
      deals: "section-deals",
      brokers: "section-brokers",
    };
    const el = document.getElementById(map[key]);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (key === "projects") applyProjectFilter("Pending");
    if (key === "deals") applyDealFilter("Open");
    if (key === "users") applyUserPlanFilter("all");
  };

  window.logout = function logout() {
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "admin-login.html";
  };

  window.closeDealDrawer = function closeDealDrawer() {
    state.activeDealId = null;
    document.getElementById("dealDrawer")?.classList.remove("open");
    document.getElementById("dealDrawerBackdrop")?.classList.remove("open");
    const drawer = document.getElementById("dealDrawer");
    if (drawer) drawer.setAttribute("aria-hidden", "true");
  };

  window.openDealDrawer = function openDealDrawer(id) {
    const deal = state.deals.find((d) => d._id === id);
    if (!deal) return;
    state.activeDealId = id;
    const buyer = deal.buyerId || {};
    document.getElementById("dealDrawerTitle").textContent = deal.listingTitle || "Deal";
    document.getElementById("dealDrawerSubtitle").textContent =
      `${deal.status || "Open"} · ${new Date(deal.createdAt).toLocaleString()}`;

    document.getElementById("dealDrawerBody").innerHTML = `
      <dl>
        <dt>Listing</dt><dd>${escapeHtml(deal.listingTitle)}</dd>
        <dt>Country</dt><dd>${escapeHtml(deal.country || "-")}</dd>
        <dt>Category</dt><dd>${escapeHtml(deal.category || "-")}</dd>
        <dt>Listed price</dt><dd>${escapeHtml(deal.listedPrice || "-")}</dd>
        <dt>Buyer</dt><dd>${escapeHtml(buyer.name || deal.contactName || "-")}</dd>
        <dt>Email</dt><dd>${escapeHtml(buyer.email || deal.contactEmail || "-")}</dd>
        <dt>Company</dt><dd>${escapeHtml(buyer.company || "-")}</dd>
        <dt>Plan</dt><dd>${escapeHtml(buyer.subscription || "-")}</dd>
        <dt>Volume</dt><dd>${escapeHtml(deal.volumeRequested)}</dd>
        <dt>Bid</dt><dd>${escapeHtml(deal.bidPrice || "-")} ${escapeHtml(deal.currency || "USD")}</dd>
        <dt>Status</dt><dd>${statusPill(deal.status || "Open")}</dd>
        <dt>Message</dt><dd>${escapeHtml(deal.message || "-")}</dd>
        <dt>Counter</dt><dd>${escapeHtml(deal.counterPrice || "-")} / ${escapeHtml(deal.counterVolume || "-")}</dd>
        <dt>Desk note</dt><dd>${escapeHtml(deal.adminNotes || "-")}</dd>
      </dl>`;

    document.getElementById("dealDrawerFoot").innerHTML = `
      <label for="dealNoteInput">Admin note</label>
      <textarea id="dealNoteInput" placeholder="Internal note for buyer desk...">${escapeTextarea(deal.adminNotes || "")}</textarea>
      <label for="dealCounterPrice">Counter price</label>
      <input id="dealCounterPrice" type="text" value="${escapeHtml(deal.counterPrice || "")}" placeholder="e.g. 12.50">
      <label for="dealCounterVolume">Counter volume</label>
      <input id="dealCounterVolume" type="text" value="${escapeHtml(deal.counterVolume || "")}" placeholder="e.g. 5000 tCO2e">
      <div class="deal-drawer-actions">
        <button type="button" class="approve-btn" data-action="Under Review">Mark review</button>
        <button type="button" class="reject-btn" data-action="Countered">Send counter</button>
        <button type="button" class="approve-btn" data-action="Accepted">Accept</button>
        <button type="button" class="reject-btn" data-action="Rejected">Reject</button>
        <button type="button" class="row-btn" data-action="Closed">Close</button>
      </div>`;

    document.querySelectorAll("#dealDrawerFoot [data-action]").forEach((btn) => {
      btn.onclick = () =>
        saveDealFromDrawer(btn.dataset.action, id);
    });

    document.getElementById("dealDrawer")?.classList.add("open");
    document.getElementById("dealDrawerBackdrop")?.classList.add("open");
    document.getElementById("dealDrawer")?.setAttribute("aria-hidden", "false");
  };

  async function saveDealFromDrawer(status, id) {
    const adminNotes =
      document.getElementById("dealNoteInput")?.value.trim() || "";
    const counterPrice =
      document.getElementById("dealCounterPrice")?.value.trim() || "";
    const counterVolume =
      document.getElementById("dealCounterVolume")?.value.trim() || "";

    try {
      const data = await apiRequest(`${API_BASE}/api/deals/${id}/status`, {
        method: "PATCH",
        headers: adminHeaders(true),
        body: JSON.stringify({
          status,
          adminNotes,
          counterPrice: status === "Countered" ? counterPrice : counterPrice || undefined,
          counterVolume: status === "Countered" ? counterVolume : counterVolume || undefined,
        }),
      });
      let msg = `Status set to ${status}.`;
      if (data.buyerNotified) msg += " Buyer notified by email.";
      else if (data.notifyError) msg += ` Email not sent (${data.notifyError}).`;
      showToast("Deal updated", msg);
      window.closeDealDrawer();
      await refreshAdminData(false);
    } catch (err) {
      showToast("Update failed", err.message, "error");
    }
  }

  window.deleteEarlyAccess = async function (id) {
    if (!confirm("Delete this early access request?")) return;
    try {
      await apiRequest(`${API_BASE}/api/early-access/${id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      showToast("Deleted", "Early access request removed.");
      await refreshAdminData(false);
    } catch (err) {
      showToast("Delete failed", err.message, "error");
    }
  };

  window.deleteProject = async function (id) {
    if (!confirm("Delete this project submission?")) return;
    try {
      await apiRequest(`${API_BASE}/api/project-submissions/${id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      showToast("Deleted", "Project submission removed.");
      await refreshAdminData(false);
    } catch (err) {
      showToast("Delete failed", err.message, "error");
    }
  };

  window.deleteBrokerInquiry = async function (id) {
    if (!confirm("Delete this broker inquiry?")) return;
    try {
      await apiRequest(`${API_BASE}/api/broker-inquiries/${id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      showToast("Deleted", "Broker inquiry removed.");
      await refreshAdminData(false);
    } catch (err) {
      showToast("Delete failed", err.message, "error");
    }
  };

  window.deleteContactMessage = async function (id) {
    if (!confirm("Delete this contact message?")) return;
    try {
      await apiRequest(`${API_BASE}/api/contact-messages/${id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      showToast("Deleted", "Contact message removed.");
      await refreshAdminData(false);
    } catch (err) {
      showToast("Delete failed", err.message, "error");
    }
  };

  window.updateProjectStatus = async function (id, status) {
    try {
      await apiRequest(`${API_BASE}/api/project-submissions/${id}/status`, {
        method: "PATCH",
        headers: adminHeaders(true),
        body: JSON.stringify({ status }),
      });
      showToast("Project updated", `Marked as ${status}.`);
      await refreshAdminData(false);
    } catch (err) {
      showToast("Update failed", err.message, "error");
    }
  };

  window.updateDealStatus = async function (id, status) {
    window.openDealDrawer(id);
    if (status && status !== "Under Review") {
      const noteInput = document.getElementById("dealNoteInput");
      if (noteInput && !noteInput.value) noteInput.value = "";
    }
  };

  window.filterProjectsByStatus = function (status) {
    applyProjectFilter(status);
  };

  function downloadCSV(filename, rows) {
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  window.exportEarlyAccess = async function () {
    try {
      const data = await apiRequest(`${API_BASE}/api/early-access`, {
        headers: adminHeaders(),
      });
      const rows = [["Name", "Email", "Role", "Message", "Date"]];
      (data.data || []).forEach((item) => {
        rows.push([
          item.name,
          item.email,
          item.role,
          item.message,
          new Date(item.createdAt).toLocaleString(),
        ]);
      });
      downloadCSV("early-access.csv", rows);
      showToast("Export ready", "early-access.csv downloaded.");
    } catch (err) {
      showToast("Export failed", err.message, "error");
    }
  };

  window.exportProjects = async function () {
    try {
      const data = await apiRequest(`${API_BASE}/api/project-submissions`, {
        headers: adminHeaders(),
      });
      const rows = [
        ["Project", "Country", "Type", "Status", "Credits", "Description", "Date"],
      ];
      (data.data || []).forEach((item) => {
        rows.push([
          item.projectName,
          item.country,
          item.projectType,
          item.status || "Pending",
          item.credits,
          item.description,
          new Date(item.createdAt).toLocaleString(),
        ]);
      });
      downloadCSV("project-submissions.csv", rows);
      showToast("Export ready", "project-submissions.csv downloaded.");
    } catch (err) {
      showToast("Export failed", err.message, "error");
    }
  };

  window.exportBrokerInquiries = async function () {
    try {
      const data = await apiRequest(`${API_BASE}/api/broker-inquiries`, {
        headers: adminHeaders(),
      });
      const rows = [["Project", "Name", "Email", "Message", "Date"]];
      (data.data || []).forEach((item) => {
        rows.push([
          item.projectName,
          item.name,
          item.email,
          item.message,
          new Date(item.createdAt).toLocaleString(),
        ]);
      });
      downloadCSV("broker-inquiries.csv", rows);
      showToast("Export ready", "broker-inquiries.csv downloaded.");
    } catch (err) {
      showToast("Export failed", err.message, "error");
    }
  };

  window.exportUsers = async function () {
    try {
      const data = await apiRequest(`${API_BASE}/api/admin/users`, {
        headers: adminHeaders(),
      });
      const rows = [
        ["Name", "Email", "Company", "Country", "Plan", "Stripe", "Joined"],
      ];
      (data.users || []).forEach((item) => {
        rows.push([
          item.name,
          item.email,
          item.company,
          item.country,
          item.subscription || "free",
          item.stripeCustomerId ? "yes" : "no",
          new Date(item.createdAt).toLocaleString(),
        ]);
      });
      downloadCSV("users.csv", rows);
      showToast("Export ready", "users.csv downloaded.");
    } catch (err) {
      showToast("Export failed", err.message, "error");
    }
  };

  window.saveUserPlan = async function (userId) {
    const select = document.getElementById(`plan-select-${userId}`);
    if (!select) return;
    const plan = select.value;
    const user = state.users.find((u) => u._id === userId);
    const current = user?.subscription || "free";
    if (plan === current) {
      showToast("No change", "User is already on this plan.", "warn");
      return;
    }
    if (
      !confirm(
        `Set ${user?.email || "user"} from ${current} to ${plan}?`
      )
    ) {
      select.value = current;
      return;
    }
    try {
      await apiRequest(`${API_BASE}/api/admin/users/${userId}/subscription`, {
        method: "PATCH",
        headers: adminHeaders(true),
        body: JSON.stringify({ plan }),
      });
      showToast("Plan updated", `User moved to ${plan}.`);
      await loadBillingSummary();
      await loadUsers();
    } catch (err) {
      select.value = current;
      showToast("Plan update failed", err.message, "error");
    }
  };

  function renderBrokerTable(list) {
    const table = document.getElementById("brokerTable");
    if (!table) return;
    table.innerHTML = list
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(item.projectName)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.email)}</td>
        <td>${escapeHtml(item.message)}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td><button type="button" class="delete-btn" onclick="deleteBrokerInquiry('${item._id}')">Delete</button></td>
      </tr>`
      )
      .join("");
  }

  function renderEarlyTable(list) {
    const table = document.getElementById("earlyAccessTable");
    if (!table) return;
    table.innerHTML = list
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.email)}</td>
        <td>${escapeHtml(item.role)}</td>
        <td>${escapeHtml(item.message)}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td><button type="button" class="delete-btn" onclick="deleteEarlyAccess('${item._id}')">Delete</button></td>
      </tr>`
      )
      .join("");
  }

  function renderContactTable(list) {
    const table = document.getElementById("contactTable");
    if (!table) return;
    table.innerHTML = list
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.email)}</td>
        <td>${escapeHtml(item.organization || "-")}</td>
        <td>${escapeHtml(item.message)}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td><button type="button" class="delete-btn" onclick="deleteContactMessage('${item._id}')">Delete</button></td>
      </tr>`
      )
      .join("");
  }

  function renderProjectTable(list) {
    const table = document.getElementById("projectTable");
    if (!table) return;
    state.projects = list;
    table.innerHTML = list
      .map((item) => {
        const status = item.status || "Pending";
        return `
      <tr data-status="${escapeHtml(status)}">
        <td>${escapeHtml(item.projectName)}</td>
        <td>${escapeHtml(item.country)}</td>
        <td>${escapeHtml(item.projectType || "-")}</td>
        <td>${statusPill(status, "project")}</td>
        <td>${escapeHtml(item.credits)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td>
          <div class="action-buttons">
            <button type="button" class="approve-btn" onclick="updateProjectStatus('${item._id}', 'Approved')">Approve</button>
            <button type="button" class="reject-btn" onclick="updateProjectStatus('${item._id}', 'Rejected')">Reject</button>
            <button type="button" class="delete-btn" onclick="deleteProject('${item._id}')">Delete</button>
          </div>
        </td>
      </tr>`;
      })
      .join("");
    applyProjectFilter(state.projectFilter);
  }

  function renderDealTable(list) {
    const table = document.getElementById("dealTable");
    if (!table) return;
    state.deals = list;
    table.innerHTML = list
      .map((item) => {
        const buyer = item.buyerId || {};
        const status = item.status || "Open";
        return `
      <tr data-status="${escapeHtml(status)}">
        <td>${escapeHtml(item.listingTitle)}</td>
        <td>${escapeHtml(buyer.name || "-")}<br><small>${escapeHtml(buyer.email || "")}</small></td>
        <td>${escapeHtml(item.volumeRequested)}</td>
        <td>${escapeHtml(item.bidPrice || "-")}</td>
        <td>${statusPill(status)}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td>
          <button type="button" class="row-btn" onclick="openDealDrawer('${item._id}')">Open desk</button>
        </td>
      </tr>`;
      })
      .join("");
    applyDealFilter(state.dealFilter);
    if (state.activeDealId) {
      const stillThere = list.some((d) => d._id === state.activeDealId);
      if (stillThere) window.openDealDrawer(state.activeDealId);
      else window.closeDealDrawer();
    }
  }

  async function loadBrokerInquiries() {
    const data = await apiRequest(`${API_BASE}/api/broker-inquiries`, {
      headers: adminHeaders(),
    });
    const list = data.data || [];
    setCountCard("brokerCount", "brokerCountText", list);
    renderBrokerTable(list);
  }

  async function loadEarlyAccess() {
    const data = await apiRequest(`${API_BASE}/api/early-access`, {
      headers: adminHeaders(),
    });
    const list = data.data || [];
    setCountCard("earlyCount", "earlyCountText", list);
    renderEarlyTable(list);
  }

  async function loadContactMessages() {
    const data = await apiRequest(`${API_BASE}/api/contact-messages`, {
      headers: adminHeaders(),
    });
    const list = data.data || [];
    setCountCard("contactCount", "contactCountText", list);
    renderContactTable(list);
  }

  async function loadProjects() {
    const data = await apiRequest(`${API_BASE}/api/project-submissions`, {
      headers: adminHeaders(),
    });
    const list = data.data || [];
    setCountCard(
      "projectCount",
      "projectCountText",
      list,
      (p) => (p.status || "Pending") === "Pending"
    );
    renderProjectTable(list);
  }

  async function loadDeals() {
    const data = await apiRequest(`${API_BASE}/api/deals/all`, {
      headers: adminHeaders(),
    });
    const list = data.deals || [];
    setCountCard(
      "dealCount",
      "dealCountText",
      list,
      (d) => ["Open", "Under Review", "Countered"].includes(d.status || "Open")
    );
    renderDealTable(list);
  }

  function renderBillingSummary(data) {
    const banner = document.getElementById("billingBanner");
    const title = document.getElementById("billingBannerTitle");
    const body = document.getElementById("billingBannerBody");
    const pill = document.getElementById("billingStripePill");
    const counts = data.counts || { free: 0, pro: 0, enterprise: 0, total: 0 };

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };
    set("planCountFree", counts.free);
    set("planCountPro", counts.pro);
    set("planCountEnterprise", counts.enterprise);
    set("planCountNew", data.newUsers7d || 0);
    set("planCountStripe", data.stripeLinked || 0);
    set("planMrrEst", (data.proMrrLabel || "$0").replace("/mo est.", ""));

    if (banner && title && body && pill) {
      if (data.stripeReady) {
        banner.className = "billing-banner ready";
        title.textContent = "Stripe Pro checkout is live";
        body.textContent =
          "Buyers can upgrade on pricing. Webhook keeps plans in sync.";
        pill.className = "plan-pill pro";
        pill.textContent = "Live";
      } else {
        banner.className = "billing-banner pending";
        title.textContent = "Stripe not configured yet";
        body.textContent =
          "Add STRIPE_SECRET_KEY + STRIPE_PRICE_PRO on Render. Grant Enterprise manually below.";
        pill.className = "plan-pill free";
        pill.textContent = "Setup";
      }
    }
  }

  function renderUserTable(list) {
    const table = document.getElementById("userTable");
    if (!table) return;
    state.users = list;
    table.innerHTML = list
      .map((item) => {
        const plan = item.subscription || "free";
        const stripe = item.stripeCustomerId ? "Linked" : "—";
        return `
      <tr data-plan="${escapeHtml(plan)}">
        <td>${escapeHtml(item.name || "-")}</td>
        <td>${escapeHtml(item.email)}</td>
        <td>${escapeHtml(item.company || "-")}</td>
        <td>${escapeHtml(item.country || "-")}</td>
        <td>${planPill(plan)}</td>
        <td>${escapeHtml(stripe)}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td>
          <select class="plan-select" id="plan-select-${item._id}">
            <option value="free"${plan === "free" ? " selected" : ""}>Free</option>
            <option value="pro"${plan === "pro" ? " selected" : ""}>Pro</option>
            <option value="enterprise"${plan === "enterprise" ? " selected" : ""}>Enterprise</option>
          </select>
          <button type="button" class="approve-btn" onclick="saveUserPlan('${item._id}')">Save</button>
        </td>
      </tr>`;
      })
      .join("");
    applyUserPlanFilter(state.userPlanFilter);
  }

  function markBillingApiMissing() {
    const banner = document.getElementById("billingBanner");
    const title = document.getElementById("billingBannerTitle");
    const body = document.getElementById("billingBannerBody");
    const pill = document.getElementById("billingStripePill");
    if (banner && title && body && pill) {
      banner.className = "billing-banner pending";
      title.textContent = "Users & Billing API not live yet";
      body.textContent =
        "Push server.js to GitHub so Render redeploys. Other admin sections still work.";
      pill.className = "plan-pill free";
      pill.textContent = "Deploy";
    }
  }

  async function loadBillingSummary() {
    try {
      const data = await apiRequest(`${API_BASE}/api/admin/billing/summary`, {
        headers: adminHeaders(),
      });
      renderBillingSummary(data);
      const total = data.counts?.total || 0;
      const pro = data.counts?.pro || 0;
      const totalEl = document.getElementById("userCount");
      const textEl = document.getElementById("userCountText");
      if (totalEl) {
        totalEl.innerHTML =
          pro > 0 ? `${total}<small>${pro} Pro</small>` : String(total);
      }
      if (textEl) textEl.textContent = String(total);
    } catch (err) {
      markBillingApiMissing();
      throw err;
    }
  }

  async function loadUsers() {
    const data = await apiRequest(`${API_BASE}/api/admin/users`, {
      headers: adminHeaders(),
    });
    renderUserTable(data.users || []);
  }

  function bindSearchInputs() {
    [
      ["userSearch", "userTable"],
      ["earlySearch", "earlyAccessTable"],
      ["contactSearch", "contactTable"],
      ["projectSearch", "projectTable"],
      ["brokerSearch", "brokerTable"],
      ["dealSearch", "dealTable"],
    ].forEach(([inputId, tableId]) => {
      const input = document.getElementById(inputId);
      if (!input || input.dataset.bound) return;
      input.dataset.bound = "1";
      input.addEventListener("input", () => applyTableSearch(inputId, tableId));
    });
  }

  function bindStatusFilters() {
    document.querySelectorAll("#userPlanFilters button").forEach((btn) => {
      btn.onclick = () => applyUserPlanFilter(btn.dataset.plan);
    });
    document.querySelectorAll("#projectStatusFilters button").forEach((btn) => {
      btn.onclick = () => applyProjectFilter(btn.dataset.status);
    });
    document.querySelectorAll("#dealStatusFilters button").forEach((btn) => {
      btn.onclick = () => applyDealFilter(btn.dataset.status);
    });
  }

  window.refreshAdminData = async function refreshAdminData(showNotice = true) {
    const jobs = [
      ["billing", loadBillingSummary],
      ["users", loadUsers],
      ["early", loadEarlyAccess],
      ["contact", loadContactMessages],
      ["projects", loadProjects],
      ["brokers", loadBrokerInquiries],
      ["deals", loadDeals],
    ];

    const results = await Promise.allSettled(jobs.map(([, fn]) => fn()));
    const failed = [];
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        failed.push(jobs[i][0]);
        console.error(`Admin load failed (${jobs[i][0]}):`, result.reason);
      }
    });

    const updated = document.getElementById("lastUpdated");
    if (updated) updated.innerText = new Date().toLocaleString();

    if (failed.length === 0) {
      if (showNotice) showToast("Refreshed", "Dashboard data updated.");
      return;
    }

    const billingMissing =
      failed.includes("billing") || failed.includes("users");
    const coreFailed = failed.filter(
      (k) => k !== "billing" && k !== "users"
    );

    if (billingMissing) markBillingApiMissing();

    if (coreFailed.length) {
      showToast(
        "Refresh failed",
        `Could not load: ${coreFailed.join(", ")}`,
        "error"
      );
    } else if (showNotice || billingMissing) {
      showToast(
        "Partial refresh",
        "Users & Billing needs Render deploy (push server.js). Other sections updated.",
        "warn"
      );
    }
  };

  bindStatusFilters();
  bindSearchInputs();
  refreshAdminData(false);

  state.refreshTimer = window.setInterval(() => {
    refreshAdminData(false);
  }, 60000);

  window.addEventListener("beforeunload", () => {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
  });
})();
