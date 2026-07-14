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
  const advancedToggle = document.getElementById("aiAdvancedToggle");
  const advancedFields = document.getElementById("aiAdvancedFields");

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
      quotaEl.textContent = `${quota.remaining} / ${quota.limit} queries left this month`;
    }
    if (planEl) {
      planEl.textContent = `${quota.planName} plan`;
    }
  }

  function setModeBadge(mode) {
    if (!modeBadge) return;
    if (mode === "green") {
      modeBadge.textContent = "Green specialty mode";
      modeBadge.classList.add("is-green");
    } else if (mode === "general") {
      modeBadge.textContent = "General mode";
      modeBadge.classList.remove("is-green");
    } else {
      modeBadge.textContent = "Ready";
      modeBadge.classList.remove("is-green");
    }
  }

  function appendMessage(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `ai-bubble ai-bubble-${role}`;
    bubble.innerHTML = `<div class="ai-bubble-label">${
      role === "user" ? "You" : "CarbonAxis Engine"
    }</div><div class="ai-bubble-body"></div>`;
    bubble.querySelector(".ai-bubble-body").textContent = text;
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function loadQuota() {
    try {
      const res = await fetch(`${API.BASE}${API.aiQuota}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) renderQuota(data.quota);
    } catch (err) {
      console.error(err);
    }
  }

  if (advancedToggle && advancedFields) {
    advancedToggle.addEventListener("click", () => {
      const open = advancedFields.hasAttribute("hidden");
      if (open) advancedFields.removeAttribute("hidden");
      else advancedFields.setAttribute("hidden", "");
      advancedToggle.textContent = open
        ? "Hide country / product"
        : "Optional: country / product";
    });
  }

  document.querySelectorAll("[data-ai-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      questionInput.value = btn.getAttribute("data-ai-example");
      const country = btn.getAttribute("data-ai-country");
      const product = btn.getAttribute("data-ai-product");
      if (country || product) {
        advancedFields?.removeAttribute("hidden");
        if (advancedToggle) {
          advancedToggle.textContent = "Hide country / product";
        }
      }
      if (country && countryInput) countryInput.value = country;
      if (product && productInput) productInput.value = product;
      questionInput.focus();
      setModeBadge(looksGreen(questionInput.value) ? "green" : "general");
    });
  });

  questionInput.addEventListener("input", () => {
    const q = questionInput.value.trim();
    if (!q) return setModeBadge("ready");
    setModeBadge(looksGreen(`${q} ${countryInput?.value || ""} ${productInput?.value || ""}`) ? "green" : "general");
  });

  // Enter to send, Shift+Enter for newline
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
    sendBtn.textContent = "Thinking...";

    const thinking = document.createElement("div");
    thinking.className = "ai-bubble ai-bubble-assistant ai-thinking";
    thinking.textContent = green
      ? "Running premium green-energy analysis..."
      : "Thinking...";
    chatLog.appendChild(thinking);

    try {
      const res = await fetch(`${API.BASE}${API.aiAsk}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ question, country, product, conversation }),
      });
      const data = await res.json();
      thinking.remove();

      if (!data.success) {
        appendMessage(
          "assistant",
          data.message || "Unable to complete analysis."
        );
        if (data.quota) renderQuota(data.quota);
        if (res.status === 402) {
          appendMessage(
            "assistant",
            "Upgrade your plan on Pricing to unlock more AI queries and deeper green analysis."
          );
        }
        return;
      }

      if (data.mode) setModeBadge(data.mode);
      appendMessage("assistant", data.answer);
      conversation.push({ role: "assistant", content: data.answer });
      renderQuota(data.quota);
    } catch (err) {
      thinking.remove();
      console.error(err);
      appendMessage("assistant", "Network error. Please try again.");
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send";
    }
  });

  loadQuota();
})();
