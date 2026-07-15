document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("passwordForm");
  const message = document.getElementById("passwordMessage");
  const userEl = document.getElementById("settingsUser");
  const token = (localStorage.getItem("token") || "").trim();

  let user = {};
  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  if (userEl) {
    const plan = (user.subscription || "free").toUpperCase();
    userEl.textContent = user.email
      ? `Signed in as ${user.email} · Plan: ${plan}`
      : "Signed in";
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword !== confirmPassword) {
      message.textContent = "New passwords do not match.";
      message.className = "profile-message error";
      return;
    }

    message.textContent = "Updating password...";
    message.className = "profile-message";

    try {
      const res = await fetch(`${API.BASE}${API.changePassword}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        message.textContent = data.message || "Password updated.";
        message.className = "profile-message success";
        form.reset();
      } else {
        message.textContent = data.message || "Could not update password.";
        message.className = "profile-message error";
      }
    } catch {
      message.textContent = "Unable to connect to server.";
      message.className = "profile-message error";
    }
  });
});
