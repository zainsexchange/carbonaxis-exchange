window.logout = function () {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
};

document.addEventListener("DOMContentLoaded", () => {
  const token = (localStorage.getItem("token") || "").trim();
  if (token && token !== localStorage.getItem("token")) {
    localStorage.setItem("token", token);
  }

  let user = {};
  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  const loginBtn = document.querySelector(".login-open");
  const profileMenu = document.querySelector(".profile-menu");
  const notificationMenu = document.querySelector(".notification-menu");
  const navBtn = document.querySelector(".nav-btn");
  const profileAvatar = document.querySelector(".profile-avatar");
  const mobileMenu = document.querySelector(".mobile-menu");

  const protectedPages = [
    "dashboard.html",
    "watchlist.html",
    "profile.html",
    "ai-intelligence.html",
    "deals.html",
  ];

  const currentPage = window.location.pathname.split("/").pop();

  if (protectedPages.includes(currentPage) && !token) {
    window.location.href = "/login.html";
    return;
  }

  // Use body classes — never force inline display:block (breaks mobile CSS)
  document.body.classList.remove("user-logged-in", "user-guest");
  document.body.classList.add(token ? "user-logged-in" : "user-guest");

  if (token) {
    if (navBtn) {
      navBtn.textContent = "Dashboard";
      navBtn.href = "/dashboard.html";
    }

    if (profileAvatar && user.name) {
      const initials = user.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
      profileAvatar.textContent = initials;
    }

    if (mobileMenu && !mobileMenu.querySelector("[data-mobile-account]")) {
      const extra = document.createElement("div");
      extra.setAttribute("data-mobile-account", "1");
      extra.innerHTML = `
        <a href="/dashboard.html">Dashboard</a>
        <a href="/profile.html">Profile</a>
        <a href="/ai-intelligence.html">AI Intelligence</a>
        <a href="#" onclick="logout(); return false;">Logout</a>
      `;
      mobileMenu.appendChild(extra);
    }
  } else if (navBtn) {
    navBtn.textContent = "Get Access";
    navBtn.href = "/index.html#early-access";
  }
});
