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
  const sendBtn = document.getElementById("aiSendBtn");

  const conversation = [];

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
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

  function appendMessage(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `ai-bubble ai-bubble-${role}`;
    bubble.innerHTML = `<div class="ai-bubble-label">${role === "user" ? "You" : "CarbonAxis Engine"}</div><div class="ai-bubble-body"></div>`;
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

  document.querySelectorAll("[data-ai-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      questionInput.value = btn.getAttribute("data-ai-example");
      const country = btn.getAttribute("data-ai-country");
      const product = btn.getAttribute("data-ai-product");
      if (country) countryInput.value = country;
      if (product) productInput.value = product;
      questionInput.focus();
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = questionInput.value.trim();
    const country = countryInput.value.trim();
    const product = productInput.value.trim();
    if (question.length < 5) return;

    appendMessage("user", question);
    conversation.push({ role: "user", content: question });
    questionInput.value = "";
    sendBtn.disabled = true;
    sendBtn.textContent = "Analyzing...";

    const thinking = document.createElement("div");
    thinking.className = "ai-bubble ai-bubble-assistant ai-thinking";
    thinking.textContent = "Running green-energy regulatory analysis...";
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
            "Upgrade your plan on Pricing to unlock more AI queries and deeper analysis."
          );
        }
        return;
      }

      appendMessage("assistant", data.answer);
      conversation.push({ role: "assistant", content: data.answer });
      renderQuota(data.quota);
    } catch (err) {
      thinking.remove();
      console.error(err);
      appendMessage("assistant", "Network error. Please try again.");
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "Ask Engine";
    }
  });

  loadQuota();
})();
