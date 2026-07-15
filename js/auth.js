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
