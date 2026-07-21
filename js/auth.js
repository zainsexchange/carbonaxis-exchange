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
    "settings.html",
    "deals.html",
    "projects.html",
  ];

  const currentPage = window.location.pathname.split("/").pop();

  if (protectedPages.includes(currentPage) && !token) {
    window.location.href = "/login.html";
    return;
  }

  // Use body classes — never force inline display:block (breaks mobile CSS)
  document.body.classList.remove("user-logged-in", "user-guest");
  document.body.classList.add(token ? "user-logged-in" : "user-guest");

  if (token && mobileMenu && !mobileMenu.querySelector(".mobile-account-block")) {
    const block = document.createElement("div");
    block.className = "mobile-account-block";
    block.innerHTML = `
      <p class="mobile-account-label">Account</p>
      <a href="/dashboard.html">Dashboard</a>
      <a href="/profile.html">Profile</a>
      <a href="/watchlist.html">Watchlist</a>
      <a href="/deals.html">My Deals</a>
      <a href="/settings.html">Settings</a>
      <a href="#" onclick="logout(); return false;">Logout</a>
    `;
    mobileMenu.appendChild(block);
  }

  if (!token && mobileMenu && !mobileMenu.querySelector(".mobile-guest-block")) {
    const block = document.createElement("div");
    block.className = "mobile-guest-block";
    block.innerHTML = `
      <p class="mobile-account-label">Account</p>
      <a href="/login.html">Login</a>
      <a href="/register.html">Get Access</a>
    `;
    mobileMenu.appendChild(block);
  }

  if (token) {
    if (navBtn) {
      navBtn.textContent = "Dashboard";
      navBtn.href = "/dashboard.html";
    }

    if (user.name) {
      const initials = user.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

      if (profileAvatar) {
        profileAvatar.textContent = initials;
      }

      const nameLabel = document.querySelector(
        ".profile-btn span:nth-child(2)"
      );
      if (nameLabel) {
        nameLabel.textContent = user.name.split(" ")[0];
      }
    }
  } else if (navBtn) {
    navBtn.textContent = "Get Access";
    navBtn.href = "/register.html";
  }
});
