(() => {
  const token = (localStorage.getItem("token") || "").trim();
  if (!token) {
    window.location.href = "/login.html";
    return;
  }
  // keep storage clean
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

  const conversation = [];

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  function looksGreen(text) {
    return /green|climate|carbon|credit|rec\b|renewable|solar|wind|biochar|methane|hydrogen|net.?zero|esg|emission|co2|feasib|regulat|pakistan|oman|uae|otc|offset/i.test(
      text || ""
    );
  }

  function renderQuota(quota) {
    if (!quota) return;
    if (quotaEl) quotaEl.textContent = `${quota.remaining}/${quota.limit} left`;
    if (planEl) planEl.textContent = quota.planName || "Free";
  }

  function setModeBadge(mode) {
    if (!modeBadge) return;
    if (mode === "green") {
      modeBadge.textContent = "Green specialty";
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

  function appendMessage(role, text, { stream = false } = {}) {
    const bubble = document.createElement("div");
    bubble.className = `ai-bubble ai-bubble-${role}`;
    bubble.innerHTML = `<div class="ai-bubble-label">${
      role === "user" ? "You" : "CarbonAxis"
    }</div><div class="ai-bubble-body"></div>`;
    const body = bubble.querySelector(".ai-bubble-body");
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;

    if (!stream || role === "user") {
      body.textContent = text;
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
        el.textContent = fullText.slice(0, i);
        chatLog.scrollTop = chatLog.scrollHeight;
        if (i < fullText.length) setTimeout(tick, speed);
        else {
          el.classList.remove("typing");
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
    } catch (_) {
      /* Render may still be waking */
    }
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

      // Wake Render (cold start is common on mobile)
      thinking.textContent = "Waking server…";
      await wakeApi();
      thinking.textContent = green ? "Analyzing…" : "Thinking…";

      let result;
      try {
        result = await fetchJson(
          `${API.BASE}${API.aiAsk}`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              question,
              country,
              product,
              conversation: conversation.slice(-8),
            }),
          },
          90000
        );
      } catch (firstErr) {
        // one retry after wake
        thinking.textContent = "Retrying… server was slow";
        await wakeApi();
        result = await fetchJson(
          `${API.BASE}${API.aiAsk}`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              question,
              country,
              product,
              conversation: conversation.slice(-8),
            }),
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
        if (res.status === 402) {
          await appendMessage(
            "assistant",
            "Upgrade on Pricing for more queries and deeper green analysis.",
            { stream: true }
          );
        }
        return;
      }

      if (data.mode) setModeBadge(data.mode);
      await appendMessage("assistant", data.answer, { stream: true });
      conversation.push({ role: "assistant", content: data.answer });
      renderQuota(data.quota);
    } catch (err) {
      thinking.remove();
      console.error(err);
      const timedOut = err?.name === "AbortError";
      await appendMessage(
        "assistant",
        timedOut
          ? "Request timed out. The server was slow (common on first mobile request). Please try again."
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

  loadQuota();
})();
