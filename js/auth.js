function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const userToken = localStorage.getItem("token");

  const loginBtn = document.querySelector(".login-open");
  const profileMenuBox = document.querySelector(".profile-menu");
  const notificationMenuBox = document.querySelector(".notification-menu");

  if (userToken) {
    if (loginBtn) loginBtn.style.display = "none";
    if (profileMenuBox) profileMenuBox.style.display = "block";
    if (notificationMenuBox) notificationMenuBox.style.display = "block";
  } else {
    if (loginBtn) loginBtn.style.display = "inline-flex";
    if (profileMenuBox) profileMenuBox.style.display = "none";
    if (notificationMenuBox) notificationMenuBox.style.display = "none";
  }
});