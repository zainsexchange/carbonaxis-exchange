document.addEventListener("DOMContentLoaded", () => {
  const profileMenu = document.querySelector(".profile-menu");
  const profileBtn = document.querySelector(".profile-btn");

  const notificationMenu = document.querySelector(".notification-menu");
  const notificationBtn = document.querySelector(".notification-btn");

  const mobileMenuBtn = document.querySelector(".mobile-menu-btn");
  const mobileMenu = document.querySelector(".mobile-menu");
  const mobileOverlay = document.querySelector(".mobile-overlay");

  let lockedScrollY = 0;

  function isAnyOverlayOpen() {
    return (
      profileMenu?.classList.contains("active") ||
      notificationMenu?.classList.contains("active") ||
      mobileMenu?.classList.contains("active")
    );
  }

  function lockPageScroll() {
    if (document.body.classList.contains("page-scroll-locked")) return;

    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add("page-scroll-locked");
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockPageScroll() {
    if (!document.body.classList.contains("page-scroll-locked")) return;

    document.body.classList.remove("page-scroll-locked");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, lockedScrollY);
  }

  function syncPageScrollLock() {
    if (isAnyOverlayOpen()) {
      lockPageScroll();
    } else {
      unlockPageScroll();
    }
  }

  function closeMobileMenu() {
    toggleMobileMenu(false);
  }

  function closeHeaderDropdowns() {
    profileMenu?.classList.remove("active");
    notificationMenu?.classList.remove("active");
  }

  function toggleMobileMenu(forceOpen) {
    if (!mobileMenu || !mobileMenuBtn) return;

    const shouldOpen =
      typeof forceOpen === "boolean"
        ? forceOpen
        : !mobileMenu.classList.contains("active");

    closeHeaderDropdowns();

    mobileMenu.classList.toggle("active", shouldOpen);
    mobileOverlay?.classList.toggle("active", shouldOpen);
    mobileMenuBtn.classList.toggle("active", shouldOpen);
    document.body.classList.toggle("menu-open", shouldOpen);

    requestAnimationFrame(() => {
      syncPageScrollLock();
    });
  }

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
      closeMobileMenu();

      if (notificationMenu) {
        notificationMenu.classList.remove("active");
      }

      profileMenu.classList.toggle("active");
      syncPageScrollLock();
    });
  }

  if (notificationBtn && notificationMenu) {
    notificationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMobileMenu();

      if (profileMenu) {
        profileMenu.classList.remove("active");
      }

      notificationMenu.classList.toggle("active");
      syncPageScrollLock();
    });
  }

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMobileMenu();
    });

    mobileOverlay?.addEventListener("click", closeMobileMenu);

    mobileMenu.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        closeMobileMenu();
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (mobileMenuBtn?.contains(e.target) || mobileMenu?.contains(e.target)) {
      return;
    }

    if (mobileMenu?.classList.contains("active")) {
      closeMobileMenu();
    }

    if (profileMenu && !profileMenu.contains(e.target)) {
      profileMenu.classList.remove("active");
    }

    if (notificationMenu && !notificationMenu.contains(e.target)) {
      notificationMenu.classList.remove("active");
    }

    syncPageScrollLock();
  });

  document.querySelectorAll(".profile-dropdown a").forEach((link) => {
    link.addEventListener("click", () => {
      if (profileMenu) {
        profileMenu.classList.remove("active");
      }
      syncPageScrollLock();
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMobileMenu();
      closeHeaderDropdowns();
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

  if (token) {
    const noteScript = document.createElement("script");
    noteScript.src = "/js/notifications.js?v=2";
    noteScript.defer = true;
    document.body.appendChild(noteScript);
  }
});
