document.addEventListener("DOMContentLoaded", async () => {

    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    try {

        const response = await fetch(`${API.BASE}${API.dashboard}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();
        console.log(data);

        if (!data.success) return;

        updateGreeting(data.user.name);

        updateProfile(data.user);

        updateStats(data.stats);

    } catch (error) {

        console.error(error);

    }

});

function updateGreeting(name){

    const greeting =
    document.getElementById("dashboardGreeting");

    if(!greeting) return;

    const hour =
    new Date().getHours();

    let message = "Welcome";

    if(hour < 12){

        message = "Good Morning";

    }else if(hour < 18){

        message = "Good Afternoon";

    }else{

        message = "Good Evening";

    }

    greeting.innerHTML =
    `${message}, ${name} 👋`;

}

function updateProfile(user){

    const avatar =
    document.querySelector(".profile-avatar");

    const account =
    document.querySelector(".profile-btn span:nth-child(2)");

    if(avatar){

        avatar.innerText =
        user.name
        .split(" ")
        .map(n => n[0])
        .join("")
        .substring(0,2)
        .toUpperCase();

    }

    if(account){

        account.innerText =
        user.name;

    }

}

function updateStats(stats){

    const portfolio =
    document.getElementById("portfolioValue");

    const watched =
    document.getElementById("creditsWatched");

    const verified =
    document.getElementById("verifiedProjects");

    const aiSearches =
    document.getElementById("aiSearches");

    if(portfolio){

        portfolio.innerText =
        "$" +
        Number(stats.portfolioValue).toLocaleString();

    }

    if(watched){

        watched.innerText =
        stats.creditsWatched;

    }

    if(verified){

        verified.innerText =
        stats.verifiedProjects;

    }

    if(aiSearches){
        const limit = stats.aiLimit != null ? ` / ${stats.aiLimit}` : "";
        aiSearches.innerText = `${stats.aiSearches || 0}${limit}`;
    }

}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPulseHtml(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\n/g, "<br>");
  return html;
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
1) Pakistan green-energy / carbon-market signal
2) Oman green-energy / carbon-market signal
3) One worldwide caution or opportunity

Use clear bullets. Research tone. No Verdict/PROCEED trading template. Not legal advice.`;

    const res = await fetch(`${API.BASE}${API.aiAsk}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question,
        country: "Pakistan",
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
    // keep cache for 24h
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
});
