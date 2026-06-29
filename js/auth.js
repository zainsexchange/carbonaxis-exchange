window.logout = function () {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
};

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const loginBtn = document.querySelector(".login-open");
  const profileMenu = document.querySelector(".profile-menu");
  const notificationMenu = document.querySelector(".notification-menu");
  const navBtn = document.querySelector(".nav-btn");
  const profileAvatar = document.querySelector(".profile-avatar");

  const protectedPages = [
    "dashboard.html",
    "watchlist.html",
    "profile.html"
  ];

  const currentPage = window.location.pathname.split("/").pop();

  if (protectedPages.includes(currentPage) && !token) {
    window.location.href = "/login.html";
    return;
  }

  if (token) {
    if (loginBtn) loginBtn.style.setProperty("display", "none", "important");
    if (profileMenu) profileMenu.style.setProperty("display", "block", "important");
    if (notificationMenu) notificationMenu.style.setProperty("display", "block", "important");

    if (navBtn) {
      navBtn.textContent = "Dashboard";
      navBtn.href = "/dashboard.html";
    }

    if (profileAvatar && user.name) {
      const initials = user.name
        .split(" ")
        .map(word => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

      profileAvatar.textContent = initials;
    }
  } else {
    if (loginBtn) loginBtn.style.setProperty("display", "inline-flex", "important");
    if (profileMenu) profileMenu.style.setProperty("display", "none", "important");
    if (notificationMenu) notificationMenu.style.setProperty("display", "none", "important");

    if (navBtn) {
      navBtn.textContent = "Get Access";
      navBtn.href = "/index.html#early-access";
    }
  }
});