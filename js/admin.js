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

  function adminHeaders(json = false) {
    const headers = { Authorization: `Bearer ${token}` };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.logout = function logout() {
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "admin-login.html";
  };

  window.deleteEarlyAccess = async function (id) {
    if (!confirm("Delete this early access request?")) return;
    await fetch(`${API_BASE}/api/early-access/${id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    location.reload();
  };

  window.deleteProject = async function (id) {
    if (!confirm("Delete this project submission?")) return;
    await fetch(`${API_BASE}/api/project-submissions/${id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    location.reload();
  };

  window.deleteBrokerInquiry = async function (id) {
    if (!confirm("Delete this broker inquiry?")) return;
    await fetch(`${API_BASE}/api/broker-inquiries/${id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    location.reload();
  };

  window.updateProjectStatus = async function (id, status) {
    await fetch(`${API_BASE}/api/project-submissions/${id}/status`, {
      method: "PATCH",
      headers: adminHeaders(true),
      body: JSON.stringify({ status }),
    });
    location.reload();
  };

  window.updateDealStatus = async function (id, status) {
    const adminNotes = prompt("Optional admin note", "") || "";
    await fetch(`${API_BASE}/api/deals/${id}/status`, {
      method: "PATCH",
      headers: adminHeaders(true),
      body: JSON.stringify({ status, adminNotes }),
    });
    location.reload();
  };

  window.filterProjectsByStatus = function (status) {
    const rows = document.querySelectorAll("#projectTable tr");
    const buttons = document.querySelectorAll(".status-filters button");
    buttons.forEach((btn) => btn.classList.remove("active"));
    if (window.event?.target) window.event.target.classList.add("active");
    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display =
        status === "all" || text.includes(status.toLowerCase()) ? "" : "none";
    });
  };

  function downloadCSV(filename, rows) {
    const csv = rows
      .map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  window.exportEarlyAccess = async function () {
    const res = await fetch(`${API_BASE}/api/early-access`, {
      headers: adminHeaders(),
    });
    const data = await res.json();
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
  };

  window.exportProjects = async function () {
    const res = await fetch(`${API_BASE}/api/project-submissions`, {
      headers: adminHeaders(),
    });
    const data = await res.json();
    const rows = [["Project", "Country", "Type", "Credits", "Description", "Date"]];
    (data.data || []).forEach((item) => {
      rows.push([
        item.projectName,
        item.country,
        item.projectType,
        item.credits,
        item.description,
        new Date(item.createdAt).toLocaleString(),
      ]);
    });
    downloadCSV("project-submissions.csv", rows);
  };

  window.exportBrokerInquiries = async function () {
    const res = await fetch(`${API_BASE}/api/broker-inquiries`, {
      headers: adminHeaders(),
    });
    const data = await res.json();
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
  };

  async function loadBrokerInquiries() {
    const res = await fetch(`${API_BASE}/api/broker-inquiries`, {
      headers: adminHeaders(),
    });
    const data = await res.json();
    const table = document.getElementById("brokerTable");
    const list = data.data || [];
    document.getElementById("brokerCount").innerText = list.length;
    document.getElementById("brokerCountText").innerText = list.length;
    table.innerHTML = list
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(item.projectName)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.email)}</td>
        <td>${escapeHtml(item.message)}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td><button class="delete-btn" onclick="deleteBrokerInquiry('${item._id}')">Delete</button></td>
      </tr>`
      )
      .join("");
  }

  async function loadEarlyAccess() {
    const res = await fetch(`${API_BASE}/api/early-access`, {
      headers: adminHeaders(),
    });
    const data = await res.json();
    const table = document.getElementById("earlyAccessTable");
    const list = data.data || [];
    document.getElementById("earlyCount").innerText = list.length;
    document.getElementById("earlyCountText").innerText = list.length;
    table.innerHTML = list
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.email)}</td>
        <td>${escapeHtml(item.role)}</td>
        <td>${escapeHtml(item.message)}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td><button class="delete-btn" onclick="deleteEarlyAccess('${item._id}')">Delete</button></td>
      </tr>`
      )
      .join("");
  }

  async function loadProjects() {
    const res = await fetch(`${API_BASE}/api/project-submissions`, {
      headers: adminHeaders(),
    });
    const data = await res.json();
    const table = document.getElementById("projectTable");
    const list = data.data || [];
    document.getElementById("projectCount").innerText = list.length;
    document.getElementById("projectCountText").innerText = list.length;
    table.innerHTML = list
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(item.projectName)}</td>
        <td>${escapeHtml(item.country)}</td>
        <td><span class="status ${(item.status || "Pending").toLowerCase()}">${escapeHtml(item.status || "Pending")}</span></td>
        <td>${escapeHtml(item.credits)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td>
          <div class="action-buttons">
            <button class="approve-btn" onclick="updateProjectStatus('${item._id}', 'Approved')">Approve</button>
            <button class="reject-btn" onclick="updateProjectStatus('${item._id}', 'Rejected')">Reject</button>
            <button class="delete-btn" onclick="deleteProject('${item._id}')">Delete</button>
          </div>
        </td>
      </tr>`
      )
      .join("");
  }

  async function loadDeals() {
    const table = document.getElementById("dealTable");
    const countEl = document.getElementById("dealCount");
    const countTextEl = document.getElementById("dealCountText");
    if (!table) return;

    const res = await fetch(`${API_BASE}/api/deals/all`, {
      headers: adminHeaders(),
    });
    const data = await res.json();
    const list = data.deals || [];
    if (countEl) countEl.innerText = list.length;
    if (countTextEl) countTextEl.innerText = list.length;

    table.innerHTML = list
      .map((item) => {
        const buyer = item.buyerId || {};
        return `
      <tr>
        <td>${escapeHtml(item.listingTitle)}</td>
        <td>${escapeHtml(buyer.name || "-")}<br><small>${escapeHtml(buyer.email || "")}</small></td>
        <td>${escapeHtml(item.volumeRequested)}</td>
        <td>${escapeHtml(item.bidPrice || "-")}</td>
        <td>${escapeHtml(item.status)}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td>
          <button class="approve-btn" onclick="updateDealStatus('${item._id}', 'Under Review')">Review</button>
          <button class="approve-btn" onclick="updateDealStatus('${item._id}', 'Accepted')">Accept</button>
          <button class="reject-btn" onclick="updateDealStatus('${item._id}', 'Rejected')">Reject</button>
        </td>
      </tr>`;
      })
      .join("");
  }

  function searchTable(inputId, tableId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("keyup", function () {
      const filter = this.value.toLowerCase();
      document.querySelectorAll(`#${tableId} tr`).forEach((row) => {
        row.style.display = row.textContent.toLowerCase().includes(filter)
          ? ""
          : "none";
      });
    });
  }

  Promise.all([
    loadEarlyAccess(),
    loadProjects(),
    loadBrokerInquiries(),
    loadDeals(),
  ]).then(() => {
    const updated = document.getElementById("lastUpdated");
    if (updated) updated.innerText = new Date().toLocaleString();
    searchTable("earlySearch", "earlyAccessTable");
    searchTable("projectSearch", "projectTable");
    searchTable("brokerSearch", "brokerTable");
    searchTable("dealSearch", "dealTable");
  });
})();
