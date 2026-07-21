(() => {
  const token = (localStorage.getItem("token") || "").trim();
  const guestLanding = document.getElementById("aiGuestLanding");

  if (!token) {
    return;
  }

  document.documentElement.classList.add("ai-has-token");
  if (guestLanding) guestLanding.hidden = true;
  localStorage.setItem("token", token);

  const chatLog = document.getElementById("aiChatLog");
  const form = document.getElementById("aiAskForm");
  const questionInput = document.getElementById("aiQuestion");
  const countryInput = document.getElementById("aiCountry");
  const productInput = document.getElementById("aiProduct");
  const quotaEl = document.getElementById("aiQuota");
  const planEl = document.getElementById("aiPlan");
  const modeBadge = document.getElementById("aiModeBadge");
  const sendBtn = document.getElementById("aiSendBtn");
  const threadList = document.getElementById("aiThreadList");
  const newChatBtn = document.getElementById("aiNewChatBtn");

  let activeThreadId = null;
  const conversation = [];

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  function looksGreen(text) {
    const t = text || "";
    // don't mark country-only general facts as green specialty
    if (/\b(population|capital|currency|language|gdp|how many people)\b/i.test(t)) {
      return false;
    }
    return /green energy|climate|carbon|credit|rec\b|renewable|solar|wind|biochar|methane|hydrogen|net.?zero|esg|emission|co2|feasib|regulat|offset|policy|research/i.test(
      t
    );
  }

  function renderQuota(quota) {
    if (!quota) return;
    if (quotaEl) {
      quotaEl.textContent = quota.unlimited
        ? "Unlimited"
        : `${quota.remaining}/${quota.limit} left`;
    }
    if (planEl) planEl.textContent = quota.planName || "Free";
  }

  function setModeBadge(mode) {
    if (!modeBadge) return;
    if (mode === "green") {
      modeBadge.textContent = "Green specialty";
      modeBadge.classList.add("is-green");
    } else if (mode === "compare") {
      modeBadge.textContent = "Market compare";
      modeBadge.classList.add("is-green");
    } else if (mode === "general") {
      modeBadge.textContent = "General";
      modeBadge.classList.remove("is-green");
    } else {
      modeBadge.textContent = "Ready";
      modeBadge.classList.remove("is-green");
    }
  }

  function forceRelogin(message) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    appendMessage("assistant", message || "Session expired. Please login again.");
    setTimeout(() => {
      window.location.href = "/login.html";
    }, 1200);
  }

  function clearChatLog(welcome = true) {
    chatLog.innerHTML = "";
    conversation.length = 0;
    if (welcome) {
      appendMessage(
        "assistant",
        "New private chat started. Only you can see this thread."
      );
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isMdTableRow(line) {
    const t = String(line || "").trim();
    if (!t.includes("|")) return false;
    return (t.match(/\|/g) || []).length >= 2;
  }

  function isMdTableSeparator(line) {
    const t = String(line || "").trim();
    if (!t.includes("-") || !t.includes("|")) return false;
    return /^[\s|:=-]+$/.test(t);
  }

  function splitMdTableCells(line) {
    let t = String(line || "").trim();
    if (t.startsWith("|")) t = t.slice(1);
    if (t.endsWith("|")) t = t.slice(0, -1);
    return t.split("|").map((c) => c.trim());
  }

  function inlineMd(text) {
    let html = escapeHtml(String(text ?? ""));
    // remove leftover markdown heading marks anywhere in the line
    html = html.replace(/#{1,6}\s*/g, "");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    return html;
  }

  function renderMdTable(rows) {
    if (!rows.length) return "";
    const dataRows = rows.filter((r) => !isMdTableSeparator(r));
    if (!dataRows.length) return "";
    const header = splitMdTableCells(dataRows[0]);
    const bodyRows = dataRows.slice(1);
    let html = '<div class="ai-table-wrap"><table class="ai-md-table"><thead><tr>';
    header.forEach((cell) => {
      html += `<th>${inlineMd(cell)}</th>`;
    });
    html += "</tr></thead><tbody>";
    bodyRows.forEach((row) => {
      const cells = splitMdTableCells(row);
      html += "<tr>";
      header.forEach((_, idx) => {
        html += `<td>${inlineMd(cells[idx] || "")}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  function stripHeadingMarks(line) {
    return String(line || "")
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.+)\*\*$/, "$1")
      .trim();
  }

  /** Turn markdown into safe aligned HTML (hide ### and raw pipes) */
  function formatAssistantHtml(text) {
    const rawLines = String(text ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n");
    const blocks = [];
    let i = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        const codeLines = [];
        i += 1;
        while (i < rawLines.length && !rawLines[i].trim().startsWith("```")) {
          codeLines.push(rawLines[i]);
          i += 1;
        }
        if (i < rawLines.length) i += 1;
        blocks.push(
          `<pre class="ai-md-pre"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`
        );
        continue;
      }

      if (
        isMdTableRow(line) &&
        i + 1 < rawLines.length &&
        isMdTableSeparator(rawLines[i + 1])
      ) {
        const tableRows = [];
        while (i < rawLines.length && isMdTableRow(rawLines[i])) {
          tableRows.push(rawLines[i]);
          i += 1;
        }
        blocks.push(renderMdTable(tableRows));
        continue;
      }

      if (/^#{1,6}/.test(trimmed)) {
        const title = stripHeadingMarks(trimmed);
        if (title) blocks.push(`<h4 class="ai-md-h">${inlineMd(title)}</h4>`);
      } else if (/^\*\*[^*].*\*\*$/.test(trimmed)) {
        blocks.push(
          `<h4 class="ai-md-h">${inlineMd(stripHeadingMarks(trimmed))}</h4>`
        );
      } else if (/^[-*•]\s+/.test(trimmed)) {
        const items = [];
        while (i < rawLines.length && /^[-*•]\s+/.test(rawLines[i].trim())) {
          items.push(
            `<li>${inlineMd(rawLines[i].trim().replace(/^[-*•]\s+/, ""))}</li>`
          );
          i += 1;
        }
        blocks.push(`<ul class="ai-md-list">${items.join("")}</ul>`);
        continue;
      } else if (/^\d+[.)]\s+/.test(trimmed)) {
        const items = [];
        while (i < rawLines.length && /^\d+[.)]\s+/.test(rawLines[i].trim())) {
          items.push(
            `<li>${inlineMd(rawLines[i].trim().replace(/^\d+[.)]\s+/, ""))}</li>`
          );
          i += 1;
        }
        blocks.push(`<ol class="ai-md-list">${items.join("")}</ol>`);
        continue;
      } else if (trimmed === "" || trimmed === "---" || trimmed === "***") {
        blocks.push('<div class="ai-md-gap"></div>');
      } else {
        blocks.push(`<p class="ai-md-p">${inlineMd(trimmed)}</p>`);
      }
      i += 1;
    }

    return blocks.join("");
  }

  function shouldSkipTypewriter(text) {
    return /#{1,6}|\|[^\n]+\|/.test(String(text || ""));
  }

  function setAssistantBody(el, text) {
    el.innerHTML = formatAssistantHtml(text);
  }

  function appendMessage(role, text, { stream = false } = {}) {
    const bubble = document.createElement("div");
    bubble.className = `ai-bubble ai-bubble-${role}`;
    bubble.innerHTML = `<div class="ai-bubble-label">${
      role === "user" ? "You" : "CarbonAxis"
    }</div><div class="ai-bubble-body"></div>`;
    const body = bubble.querySelector(".ai-bubble-body");
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;

    if (role === "user") {
      body.textContent = text;
      return Promise.resolve(body);
    }

    // Never typewriter tables/headings — avoids flashing raw ### and | pipes
    if (!stream || shouldSkipTypewriter(text)) {
      setAssistantBody(body, text);
      return Promise.resolve(body);
    }
    return typewriter(body, text);
  }
  function typewriter(el, fullText) {
    return new Promise((resolve) => {
      el.textContent = "";
      el.classList.add("typing");
      let i = 0;
      const chunk = Math.max(2, Math.floor(fullText.length / 180));
      const speed = fullText.length > 900 ? 8 : 14;

      function tick() {
        i = Math.min(fullText.length, i + chunk);
        // while typing keep plain text; format when finished
        el.textContent = fullText.slice(0, i);
        chatLog.scrollTop = chatLog.scrollHeight;
        if (i < fullText.length) setTimeout(tick, speed);
        else {
          el.classList.remove("typing");
          setAssistantBody(el, fullText);
          resolve(el);
        }
      }
      tick();
    });
  }

  async function wakeApi() {
    try {
      const base = API.BASE.replace(/\/api\/?$/, "");
      await fetch(base + "/", { method: "GET", mode: "cors", cache: "no-store" });
    } catch (_) {}
  }

  async function fetchJson(url, options, timeoutMs = 90000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      const raw = await res.text();
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
      return { res, data, raw };
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadThreads() {
    if (!threadList || !API.aiThreads) return;
    try {
      const { res, data } = await fetchJson(`${API.BASE}${API.aiThreads}`, {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        forceRelogin("Invalid or expired token. Please login again.");
        return;
      }
      const threads = data?.threads || [];
      if (!threads.length) {
        threadList.innerHTML =
          '<p class="ai-thread-empty">No chats yet. Start a new one.</p>';
        return;
      }
      threadList.innerHTML = threads
        .map((t) => {
          const active = String(t._id) === String(activeThreadId) ? "active" : "";
          return `
          <div class="ai-thread-item ${active}" data-id="${t._id}">
            <button type="button" class="ai-thread-open" data-id="${t._id}">
              ${escapeHtml(t.title || "New chat")}
            </button>
            <button type="button" class="ai-thread-delete" data-id="${t._id}" title="Delete">✕</button>
          </div>`;
        })
        .join("");
    } catch (err) {
      console.error(err);
      threadList.innerHTML = '<p class="ai-thread-empty">Unable to load chats.</p>';
    }
  }

  async function openThread(id) {
    const { res, data } = await fetchJson(
      `${API.BASE}${API.aiThreads}/${id}`,
      { headers: authHeaders() }
    );
    if (res.status === 401) {
      forceRelogin("Invalid or expired token. Please login again.");
      return;
    }
    if (!data?.success) return;

    activeThreadId = data.thread._id;
    clearChatLog(false);
    conversation.length = 0;

    (data.thread.messages || []).forEach((m) => {
      appendMessage(m.role, m.content);
      conversation.push({ role: m.role, content: m.content });
    });

    if (!(data.thread.messages || []).length) {
      appendMessage(
        "assistant",
        "This chat is empty. Ask anything to continue."
      );
    }

    document.getElementById("aiThreadSidebar")?.classList.remove("open");
    loadThreads();
  }

  async function startNewChat() {
    activeThreadId = null;
    clearChatLog(true);
    try {
      const { data } = await fetchJson(`${API.BASE}${API.aiThreads}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ title: "New chat" }),
      });
      if (data?.thread?._id) {
        activeThreadId = data.thread._id;
      }
    } catch (err) {
      console.error(err);
    }
    loadThreads();
    document.getElementById("aiThreadSidebar")?.classList.remove("open");
  }

  async function deleteThread(id) {
    if (!confirm("Delete this private chat?")) return;
    await fetchJson(`${API.BASE}${API.aiThreads}/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (String(activeThreadId) === String(id)) {
      activeThreadId = null;
      clearChatLog(true);
    }
    loadThreads();
  }

  threadList?.addEventListener("click", (e) => {
    const del = e.target.closest(".ai-thread-delete");
    if (del) {
      deleteThread(del.getAttribute("data-id"));
      return;
    }
    const open = e.target.closest(".ai-thread-open");
    if (open) openThread(open.getAttribute("data-id"));
  });

  newChatBtn?.addEventListener("click", startNewChat);

  async function loadQuota() {
    try {
      if (!API.aiQuota) return;
      const { res, data } = await fetchJson(
        `${API.BASE}${API.aiQuota}`,
        { headers: authHeaders() },
        45000
      );
      if (res.status === 401) {
        forceRelogin("Invalid or expired token. Please login again.");
        return;
      }
      if (data?.success) renderQuota(data.quota);
    } catch (err) {
      console.error(err);
    }
  }

  document.querySelectorAll("[data-ai-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      questionInput.value = btn.getAttribute("data-ai-example") || "";
      questionInput.focus();
      setModeBadge(looksGreen(questionInput.value) ? "green" : "general");
    });
  });

  questionInput.addEventListener("input", () => {
    const q = questionInput.value.trim();
    if (!q) return setModeBadge("ready");
    setModeBadge(looksGreen(q) ? "green" : "general");
  });

  questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = questionInput.value.trim();
    const country = countryInput?.value.trim() || "";
    const product = productInput?.value.trim() || "";
    if (question.length < 3) return;

    const green = looksGreen(`${question} ${country} ${product}`);
    setModeBadge(green ? "green" : "general");

    appendMessage("user", question);
    conversation.push({ role: "user", content: question });
    questionInput.value = "";
    sendBtn.disabled = true;
    sendBtn.textContent = "…";

    const thinking = document.createElement("div");
    thinking.className = "ai-bubble ai-bubble-assistant ai-thinking";
    thinking.textContent = green
      ? "Connecting… preparing green analysis"
      : "Connecting… thinking";
    chatLog.appendChild(thinking);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
      if (!API.aiAsk) {
        throw new Error("Missing api.js AI routes — re-upload js/api.js");
      }

      thinking.textContent = "Waking server…";
      await wakeApi();
      thinking.textContent = green ? "Analyzing…" : "Thinking…";

      const body = {
        question,
        country,
        product,
        conversation: conversation.slice(-8),
        threadId: activeThreadId,
      };

      let result;
      try {
        result = await fetchJson(
          `${API.BASE}${API.aiAsk}`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(body),
          },
          90000
        );
      } catch (_) {
        thinking.textContent = "Retrying… server was slow";
        await wakeApi();
        result = await fetchJson(
          `${API.BASE}${API.aiAsk}`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(body),
          },
          90000
        );
      }

      const { res, data } = result;
      thinking.remove();

      if (res.status === 401) {
        forceRelogin(
          data?.message || "Invalid or expired token. Please login again."
        );
        return;
      }

      if (!data) {
        throw new Error(`Bad server response (${res.status})`);
      }

      if (!data.success) {
        await appendMessage("assistant", data.message || "Unable to answer.", {
          stream: true,
        });
        if (data.quota) renderQuota(data.quota);
        return;
      }

      if (data.threadId) activeThreadId = data.threadId;
      if (data.mode) setModeBadge(data.mode);
      await appendMessage("assistant", data.answer, { stream: true });
      conversation.push({ role: "assistant", content: data.answer });
      renderQuota(data.quota);
      loadThreads();
    } catch (err) {
      thinking.remove();
      console.error(err);
      const timedOut = err?.name === "AbortError";
      await appendMessage(
        "assistant",
        timedOut
          ? "Request timed out. Please try again."
          : err?.message
            ? `Connection issue: ${err.message}`
            : "Network error. Please try again.",
        { stream: true }
      );
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send";
    }
  });

  const compareForm = document.getElementById("aiCompareForm");
  const compareBtn = document.getElementById("aiCompareBtn");
  const suggestionRow = document.getElementById("aiSuggestionRow");
  const tabChat = document.getElementById("aiTabChat");
  const tabCompare = document.getElementById("aiTabCompare");
  const tabCalc = document.getElementById("aiTabCalc");
  const calcPanel = document.getElementById("aiCalcPanel");
  const calcForm = document.getElementById("aiCalcForm");
  const calcFields = document.getElementById("aiCalcFields");
  const calcResult = document.getElementById("aiCalcResult");
  const calcBtn = document.getElementById("aiCalcBtn");
  const chatPanel = document.getElementById("aiChatPanel");

  let calcType = "solar";
  let calcCatalog = null;
  let lastCalcResult = null;

  function setAiView(view) {
    const isCompare = view === "compare";
    const isCalc = view === "calc";
    const isChat = view === "chat";
    tabChat?.classList.toggle("is-active", isChat);
    tabCompare?.classList.toggle("is-active", isCompare);
    tabCalc?.classList.toggle("is-active", isCalc);
    if (form) form.hidden = !isChat;
    if (suggestionRow) suggestionRow.hidden = !isChat;
    if (chatLog) chatLog.hidden = !isChat;
    if (compareForm) compareForm.hidden = !isCompare;
    if (calcPanel) calcPanel.hidden = !isCalc;
    if (chatPanel) {
      chatPanel.classList.remove("ai-view-chat", "ai-view-compare", "ai-view-calc");
      chatPanel.classList.add(
        isCalc ? "ai-view-calc" : isCompare ? "ai-view-compare" : "ai-view-chat"
      );
    }
    if (isCalc) {
      setModeBadge("ready");
      if (modeBadge) {
        modeBadge.textContent = "Calculators";
        modeBadge.classList.add("is-green");
      }
      ensureCalcCatalog().then(() => {
        if (calcPanel && !calcPanel.hidden) renderCalcFields();
      });
      renderCalcFields();
    } else {
      setModeBadge(isCompare ? "compare" : "ready");
    }
  }

  tabChat?.addEventListener("click", () => setAiView("chat"));
  tabCompare?.addEventListener("click", () => setAiView("compare"));
  tabCalc?.addEventListener("click", () => setAiView("calc"));

  const FALLBACK_MARKETS = [
    { name: "World Average", region: "Global", tPerMWh: 0.48 },
    { name: "Pakistan", region: "South Asia", tPerMWh: 0.57 },
    { name: "India", region: "South Asia", tPerMWh: 0.71 },
    { name: "Oman", region: "GCC", tPerMWh: 0.45 },
    { name: "UAE", region: "GCC", tPerMWh: 0.42 },
    { name: "Saudi Arabia", region: "GCC", tPerMWh: 0.55 },
    { name: "United States", region: "Americas", tPerMWh: 0.38 },
    { name: "Brazil", region: "Americas", tPerMWh: 0.1 },
    { name: "European Union", region: "Europe", tPerMWh: 0.25 },
    { name: "Germany", region: "Europe", tPerMWh: 0.35 },
    { name: "China", region: "Asia-Pacific", tPerMWh: 0.58 },
    { name: "Japan", region: "Asia-Pacific", tPerMWh: 0.47 },
    { name: "Australia", region: "Asia-Pacific", tPerMWh: 0.55 },
    { name: "Kenya", region: "Africa", tPerMWh: 0.18 },
    { name: "South Africa", region: "Africa", tPerMWh: 0.9 },
  ];

  function getCalcMarkets() {
    return calcCatalog?.markets?.length ? calcCatalog.markets : FALLBACK_MARKETS;
  }

  function buildMarketPicker(selected = "World Average", id = "calcMarket") {
    const markets = [...getCalcMarkets()].sort((a, b) => {
      if (a.region === b.region) return a.name.localeCompare(b.name);
      return (a.region || "").localeCompare(b.region || "");
    });
    const current =
      markets.find((m) => m.name === selected) ||
      markets.find((m) => m.name === "World Average") ||
      markets[0];
    const factor =
      current?.tPerMWh != null ? Number(current.tPerMWh).toFixed(2) : "—";

    const byRegion = {};
    markets.forEach((m) => {
      const region = m.region || "Other";
      if (!byRegion[region]) byRegion[region] = [];
      byRegion[region].push(m);
    });

    const menuGroups = Object.keys(byRegion)
      .sort((a, b) => a.localeCompare(b))
      .map((region) => {
        const items = byRegion[region]
          .map((m) => {
            const f =
              m.tPerMWh != null ? Number(m.tPerMWh).toFixed(2) : "—";
            return `<button type="button" role="option" class="ai-market-option${
              m.name === current.name ? " is-selected" : ""
            }" data-value="${escapeHtml(m.name)}" data-factor="${f}" data-region="${escapeHtml(
              m.region || ""
            )}">
              <span>${escapeHtml(m.name)}</span>
              <small>${f} tCO₂e/MWh</small>
            </button>`;
          })
          .join("");
        return `<div class="ai-market-group">
          <div class="ai-market-group-label">${escapeHtml(region)}</div>
          ${items}
        </div>`;
      })
      .join("");

    return `
    <div class="ai-market-picker" data-market-picker="${escapeHtml(id)}">
      <input type="hidden" id="${escapeHtml(id)}" value="${escapeHtml(current.name)}" />
      <button type="button" class="ai-market-trigger" aria-expanded="false" aria-haspopup="listbox">
        <span class="ai-market-trigger-text">
          <span class="ai-market-trigger-label">${escapeHtml(current.name)}</span>
          <span class="ai-market-trigger-meta">${factor} tCO₂e/MWh · ${escapeHtml(current.region || "")}</span>
        </span>
        <span class="ai-market-trigger-caret" aria-hidden="true">▾</span>
      </button>
      <div class="ai-market-menu" role="listbox" hidden>
        ${menuGroups}
      </div>
    </div>`;
  }

  function closeAllMarketMenus() {
    document.querySelectorAll(".ai-market-menu").forEach((menu) => {
      menu.hidden = true;
    });
    document.querySelectorAll(".ai-market-trigger").forEach((trigger) => {
      trigger.setAttribute("aria-expanded", "false");
    });
  }

  function bindMarketPickers(root = document) {
    root.querySelectorAll("[data-market-picker]").forEach((picker) => {
      if (picker.dataset.bound) return;
      picker.dataset.bound = "1";
      const hidden = picker.querySelector('input[type="hidden"]');
      const trigger = picker.querySelector(".ai-market-trigger");
      const menu = picker.querySelector(".ai-market-menu");
      const label = picker.querySelector(".ai-market-trigger-label");
      const meta = picker.querySelector(".ai-market-trigger-meta");

      trigger?.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = menu.hidden;
        closeAllMarketMenus();
        menu.hidden = !willOpen;
        trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });

      picker.querySelectorAll(".ai-market-option").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          hidden.value = btn.dataset.value;
          label.textContent = btn.dataset.value;
          meta.textContent = `${btn.dataset.factor} tCO₂e/MWh · ${btn.dataset.region}`;
          picker
            .querySelectorAll(".ai-market-option")
            .forEach((b) => b.classList.remove("is-selected"));
          btn.classList.add("is-selected");
          closeAllMarketMenus();
        });
      });
    });
  }

  if (!window.__aiMarketPickerBound) {
    window.__aiMarketPickerBound = true;
    document.addEventListener("click", closeAllMarketMenus);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllMarketMenus();
    });
  }

  async function ensureCalcCatalog() {
    if (calcCatalog) return calcCatalog;
    try {
      const { res, data } = await fetchJson(
        `${API.BASE}${API.calcCatalog}`,
        { headers: authHeaders() },
        30000
      );
      if (res.status === 401) {
        forceRelogin(data?.message);
        return null;
      }
      if (data?.markets) {
        calcCatalog = data;
        return calcCatalog;
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  }

  function renderCalcFields() {
    if (!calcFields) return;
    const selectedMarket =
      document.getElementById("calcMarket")?.value || "World Average";
    if (calcType === "solar") {
      calcFields.innerHTML = `
        <label class="ai-compare-full">Market / grid
          ${buildMarketPicker(selectedMarket)}
        </label>
        <label>Annual generation (MWh)
          <input id="calcAnnualMWh" type="number" min="0" step="any" placeholder="e.g. 50000" />
        </label>
        <label>Or capacity (MW)
          <input id="calcCapacityMW" type="number" min="0" step="any" placeholder="e.g. 25" />
        </label>
        <label>Capacity factor (0–1)
          <input id="calcCF" type="number" min="0" max="1" step="0.01" value="0.22" />
        </label>
        <label>Years
          <input id="calcYears" type="number" min="1" max="40" value="1" />
        </label>
        <label class="ai-compare-full">Custom grid factor tCO₂e/MWh (optional — overrides market)
          <input id="calcCustomFactor" type="number" min="0" max="2" step="0.001" placeholder="Leave blank to use market library" />
        </label>`;
    } else if (calcType === "methane") {
      calcFields.innerHTML = `
        <label class="ai-compare-full">Context market (for Intelligence follow-up)
          ${buildMarketPicker(selectedMarket)}
        </label>
        <label>Methane (tonnes)
          <input id="calcCH4t" type="number" min="0" step="any" placeholder="e.g. 100" />
        </label>
        <label>Or methane (m³)
          <input id="calcCH4m3" type="number" min="0" step="any" placeholder="optional" />
        </label>
        <label>GWP100
          <input id="calcGWP" type="number" min="1" max="100" step="0.1" value="28" />
        </label>
        <label>Capture efficiency (0–1)
          <input id="calcEff" type="number" min="0" max="1" step="0.01" value="1" />
        </label>
        <label>Years
          <input id="calcYears" type="number" min="1" max="40" value="1" />
        </label>`;
    } else if (calcType === "biochar") {
      calcFields.innerHTML = `
        <label class="ai-compare-full">Context market
          ${buildMarketPicker(selectedMarket)}
        </label>
        <label>Biochar (tonnes)
          <input id="calcBiochar" type="number" min="0" step="any" placeholder="e.g. 1000" required />
        </label>
        <label>Carbon fraction (0–1)
          <input id="calcCarbonFrac" type="number" min="0" max="1" step="0.01" value="0.75" />
        </label>
        <label>Permanence factor (0–1)
          <input id="calcPerm" type="number" min="0" max="1" step="0.01" value="0.8" />
        </label>
        <label>Years
          <input id="calcYears" type="number" min="1" max="40" value="1" />
        </label>`;
    } else {
      calcFields.innerHTML = `
        <label class="ai-compare-full">Context market
          ${buildMarketPicker(selectedMarket)}
        </label>
        <label>Credits (tCO₂e)
          <input id="calcCredits" type="number" min="0" step="any" placeholder="e.g. 5000" required />
        </label>
        <label>Price per credit
          <input id="calcPrice" type="number" min="0" step="any" placeholder="e.g. 12.5" required />
        </label>
        <label>Currency
          <input id="calcCurrency" type="text" value="USD" maxlength="8" />
        </label>`;
    }
    bindMarketPickers(calcFields);
  }

  document.getElementById("aiCalcTypeRow")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-calc]");
    if (!btn) return;
    calcType = btn.dataset.calc;
    document
      .querySelectorAll("#aiCalcTypeRow .ai-calc-type")
      .forEach((b) => b.classList.toggle("is-active", b === btn));
    if (calcResult) {
      calcResult.hidden = true;
      calcResult.innerHTML = "";
    }
    renderCalcFields();
  });

  function renderCalcResult(result) {
    if (!calcResult) return;
    lastCalcResult = result;
    const r = result.results || {};
    const headline =
      result.type === "dealValue"
        ? `${escapeHtml(r.unit)} ${escapeHtml(r.dealValue)}`
        : `${escapeHtml(r.tCO2ePerYear)} ${escapeHtml(r.unit)}/year`;
    const total =
      result.type === "dealValue"
        ? ""
        : `<p><strong>Total (${escapeHtml(
            result.inputs?.years || 1
          )} yr):</strong> ${escapeHtml(r.tCO2eTotal)} ${escapeHtml(r.unit)}</p>`;

    calcResult.hidden = false;
    calcResult.innerHTML = `
      <h3>${escapeHtml(result.title)}</h3>
      <p class="ai-calc-headline">${headline}</p>
      <p><strong>Market:</strong> ${escapeHtml(result.market)} ${
        result.region ? `· ${escapeHtml(result.region)}` : ""
      }</p>
      ${total}
      <p class="ai-calc-formula"><strong>Formula:</strong> ${escapeHtml(
        result.formula
      )}</p>
      <ul class="ai-calc-assumptions">
        ${(result.assumptions || [])
          .map((a) => `<li>${escapeHtml(a)}</li>`)
          .join("")}
      </ul>
      <p class="ai-calc-disclaimer">${escapeHtml(result.disclaimer)}</p>
      <div class="ai-compare-actions">
        <button type="button" class="btn btn-primary" id="aiCalcAskBtn">Ask Intelligence about this result</button>
      </div>`;

    document.getElementById("aiCalcAskBtn")?.addEventListener("click", () => {
      const prompt =
        result.askIntelligencePrompt ||
        `Help me interpret this ${result.type} calculation for ${result.market}.`;
      setAiView("chat");
      if (questionInput) {
        questionInput.value = prompt;
        questionInput.focus();
      }
    });
  }

  calcForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const market = document.getElementById("calcMarket")?.value || "World Average";
    const years = Number(document.getElementById("calcYears")?.value || 1);
    let inputs = { market, years };

    if (calcType === "solar") {
      inputs = {
        market,
        years,
        annualMWh: document.getElementById("calcAnnualMWh")?.value,
        capacityMW: document.getElementById("calcCapacityMW")?.value,
        capacityFactor: document.getElementById("calcCF")?.value,
        customGridFactor: document.getElementById("calcCustomFactor")?.value,
      };
    } else if (calcType === "methane") {
      inputs = {
        market,
        years,
        methaneTonnes: document.getElementById("calcCH4t")?.value,
        methaneM3: document.getElementById("calcCH4m3")?.value,
        gwp: document.getElementById("calcGWP")?.value,
        captureEfficiency: document.getElementById("calcEff")?.value,
      };
    } else if (calcType === "biochar") {
      inputs = {
        market,
        years,
        biocharTonnes: document.getElementById("calcBiochar")?.value,
        carbonFraction: document.getElementById("calcCarbonFrac")?.value,
        permanenceFactor: document.getElementById("calcPerm")?.value,
      };
    } else {
      inputs = {
        market,
        credits: document.getElementById("calcCredits")?.value,
        pricePerCredit: document.getElementById("calcPrice")?.value,
        currency: document.getElementById("calcCurrency")?.value || "USD",
      };
    }

    if (calcBtn) {
      calcBtn.disabled = true;
      calcBtn.textContent = "Calculating…";
    }

    try {
      await wakeApi();
      const { res, data } = await fetchJson(
        `${API.BASE}${API.calcRun}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ type: calcType, inputs }),
        },
        30000
      );

      if (res.status === 401) {
        forceRelogin(data?.message);
        return;
      }
      if (!data?.success) {
        if (calcResult) {
          calcResult.hidden = false;
          calcResult.innerHTML = `<p class="ai-calc-disclaimer">${escapeHtml(
            data?.message || "Calculation failed"
          )}</p>`;
        }
        return;
      }
      renderCalcResult(data.result);
    } catch (err) {
      console.error(err);
      if (calcResult) {
        calcResult.hidden = false;
        calcResult.innerHTML = `<p class="ai-calc-disclaimer">${escapeHtml(
          err.message || "Network error"
        )}</p>`;
      }
    } finally {
      if (calcBtn) {
        calcBtn.disabled = false;
        calcBtn.textContent = "Calculate";
      }
    }
  });

  compareForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const countryA = document.getElementById("compareCountryA")?.value || "";
    const countryB = document.getElementById("compareCountryB")?.value || "";
    const product = document.getElementById("compareProduct")?.value.trim() || "";
    const note = document.getElementById("compareNote")?.value.trim() || "";

    if (!countryA || !countryB) return;
    if (countryA === countryB) {
      await appendMessage(
        "assistant",
        "Please choose two different markets to compare.",
        { stream: true }
      );
      return;
    }

    const userLine = `Compare markets: ${countryA} vs ${countryB}${
      product ? ` · focus: ${product}` : ""
    }${note ? ` · note: ${note}` : ""}`;

    setModeBadge("compare");
    appendMessage("user", userLine);
    conversation.push({ role: "user", content: userLine });

    if (compareBtn) {
      compareBtn.disabled = true;
      compareBtn.textContent = "Comparing…";
    }

    const thinking = document.createElement("div");
    thinking.className = "ai-bubble ai-bubble-assistant ai-thinking";
    thinking.textContent = "Comparing markets…";
    chatLog.appendChild(thinking);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
      if (!API.aiCompare) {
        throw new Error("Missing compare API — re-upload js/api.js");
      }
      await wakeApi();
      thinking.textContent = "Building compare brief…";

      const { res, data } = await fetchJson(
        `${API.BASE}${API.aiCompare}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            countryA,
            countryB,
            product,
            note,
            threadId: activeThreadId,
          }),
        },
        90000
      );

      thinking.remove();

      if (res.status === 401) {
        forceRelogin(data?.message || "Session expired. Please login again.");
        return;
      }

      if (!data?.success) {
        await appendMessage(
          "assistant",
          data?.message || "Unable to compare markets.",
          { stream: true }
        );
        if (data?.quota) renderQuota(data.quota);
        return;
      }

      if (data.threadId) activeThreadId = data.threadId;
      setModeBadge("compare");
      await appendMessage("assistant", data.answer, { stream: true });
      conversation.push({ role: "assistant", content: data.answer });
      renderQuota(data.quota);
      loadThreads();
    } catch (err) {
      thinking.remove();
      console.error(err);
      await appendMessage(
        "assistant",
        err?.name === "AbortError"
          ? "Compare timed out. Please try again."
          : err?.message || "Network error. Please try again.",
        { stream: true }
      );
    } finally {
      if (compareBtn) {
        compareBtn.disabled = false;
        compareBtn.textContent = "Run compare";
      }
    }
  });

  function applyMarketplaceDeepLink() {
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("from") !== "marketplace") return;

    const q = (params.get("q") || "").trim();
    const country = (params.get("country") || "").trim();
    const product = (params.get("product") || "").trim();
    const title = (params.get("title") || "").trim();

    // Stay on chat view
    document.getElementById("aiTabChat")?.click();

    if (countryInput) countryInput.value = country;
    if (productInput) productInput.value = product;
    if (questionInput && q) {
      questionInput.value = q;
      setModeBadge("green");
    }

    if (title) {
      appendMessage(
        "assistant",
        `Marketplace listing loaded: **${title}** (${country || "market"}). Running CarbonAxis Intelligence brief…`
      );
    }

    // Clean URL so refresh doesn’t re-fire
    window.history.replaceState({}, "", "/ai-intelligence.html");

    if (q && form) {
      setTimeout(() => form.requestSubmit(), 350);
    }
  }

  loadQuota();
  loadThreads().finally(() => {
    applyMarketplaceDeepLink();
    if (window.location.hash === "#compare") {
      document.getElementById("aiTabCompare")?.click();
    }
  });
})();
