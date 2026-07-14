(() => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

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
    if (quotaEl) {
      quotaEl.textContent = `${quota.remaining}/${quota.limit} left`;
    }
    if (planEl) {
      planEl.textContent = quota.planName || "Free";
    }
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
        if (i < fullText.length) {
          setTimeout(tick, speed);
        } else {
          el.classList.remove("typing");
          resolve(el);
        }
      }
      tick();
    });
  }

  async function loadQuota() {
    try {
      if (!API.aiQuota) return;
      const res = await fetch(`${API.BASE}${API.aiQuota}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) renderQuota(data.quota);
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
    thinking.textContent = green ? "Analyzing…" : "Thinking…";
    chatLog.appendChild(thinking);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
      if (!API.aiAsk) {
        throw new Error("Missing api.js AI routes — re-upload js/api.js");
      }
      const res = await fetch(`${API.BASE}${API.aiAsk}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ question, country, product, conversation }),
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Bad server response (${res.status})`);
      }
      thinking.remove();

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
      await appendMessage(
        "assistant",
        err?.message ? `Connection issue: ${err.message}` : "Network error. Try again.",
        { stream: true }
      );
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send";
    }
  });

  loadQuota();
})();
