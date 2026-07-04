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
  const user = JSON.parse(localStorage.getItem("user"));

if (user && user.name) {
  const avatar = document.querySelector(".profile-avatar");
  const accountText = document.querySelector(".profile-btn span:nth-child(2)");

  if (avatar) {
    avatar.innerText = user.name
      .split(" ")
      .map(n => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }

  if (accountText) {
    accountText.innerText = user.name;
  }
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