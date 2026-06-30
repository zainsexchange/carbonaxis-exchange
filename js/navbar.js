document.addEventListener("DOMContentLoaded", () => {
  const profileMenu = document.querySelector(".profile-menu");
  const profileBtn = document.querySelector(".profile-btn");

  if (profileBtn && profileMenu) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle("active");
    });
  }

  const notificationMenu = document.querySelector(".notification-menu");
  const notificationBtn = document.querySelector(".notification-btn");

  if (notificationBtn && notificationMenu) {
    notificationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notificationMenu.classList.toggle("active");
    });
  }

  document.addEventListener("click", () => {
    if (profileMenu) profileMenu.classList.remove("active");
    if (notificationMenu) notificationMenu.classList.remove("active");
  });
});