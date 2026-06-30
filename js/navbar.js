document.addEventListener("DOMContentLoaded", () => {
  const profileMenu = document.querySelector(".profile-menu");
  const profileBtn = document.querySelector(".profile-btn");

  const notificationMenu = document.querySelector(".notification-menu");
  const notificationBtn = document.querySelector(".notification-btn");

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

  document.addEventListener("click", () => {
    if (profileMenu) {
      profileMenu.classList.remove("active");
    }

    if (notificationMenu) {
      notificationMenu.classList.remove("active");
    }
  });
});