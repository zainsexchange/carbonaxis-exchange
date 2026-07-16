document.addEventListener("DOMContentLoaded", () => {
  const profileMenu = document.querySelector(".profile-menu");
  const profileBtn = document.querySelector(".profile-btn");

  const notificationMenu = document.querySelector(".notification-menu");
  const notificationBtn = document.querySelector(".notification-btn");

  // Use cropped navbar logo so mark fills the brand plate
  document.querySelectorAll(".navbar .site-logo").forEach((img) => {
    const current = img.getAttribute("src") || "";
    if (!current.includes("logo-nav.png")) {
      img.setAttribute("src", "/logo-nav.png");
    }
    img.setAttribute("alt", "CarbonAxis Exchange");
  });

  // Account menu only — Marketplace / Intelligence stay in main nav
  const profileDropdown = document.querySelector(".profile-dropdown");
  if (profileDropdown) {
    profileDropdown.innerHTML = `
      <a href="/dashboard.html">Dashboard</a>
      <a href="/profile.html">Profile</a>
      <a href="/watchlist.html">Watchlist</a>
      <a href="/deals.html">My Deals</a>
      <a href="/settings.html">Settings</a>
      <a href="#" onclick="logout(); return false;">Logout</a>
    `;
  }

  if (profileBtn && profileMenu) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      if (notificationMenu) {
        notificationMenu.classList.remove("active");
      }

      profileMenu.classList.toggle("active");
    });
  }

  if (notificationBtn && notificationMenu) {
    notificationBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      if (profileMenu) {
        profileMenu.classList.remove("active");
      }

      notificationMenu.classList.toggle("active");
    });
  }

  document.addEventListener("click", (e) => {
    if (profileMenu && !profileMenu.contains(e.target)) {
      profileMenu.classList.remove("active");
    }

    if (notificationMenu && !notificationMenu.contains(e.target)) {
      notificationMenu.classList.remove("active");
    }
  });

  document.querySelectorAll(".profile-dropdown a").forEach((link) => {
    link.addEventListener("click", () => {
      if (profileMenu) {
        profileMenu.classList.remove("active");
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (profileMenu) {
        profileMenu.classList.remove("active");
      }

      if (notificationMenu) {
        notificationMenu.classList.remove("active");
      }
    }
  });

  const token = localStorage.getItem("token");

  if (token && typeof API !== "undefined") {
    fetch(`${API.BASE}${API.profile}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;

        const user = data.user;

        localStorage.setItem("user", JSON.stringify(user));

        const avatar = document.querySelector(".profile-avatar");
        const accountText = document.querySelector(".profile-btn span:nth-child(2)");

        if (avatar && user.name) {
          avatar.innerText = user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();
        }

        if (accountText && user.name) {
          accountText.innerText = user.name;
        }
      })
      .catch(() => {});
  }
});
