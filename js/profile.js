document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const form = document.getElementById("profileForm");
  const message = document.getElementById("profileMessage");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  form.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  setupCountryPhoneCode();
  new CarbonSmartSelect("country", COUNTRIES, {
  onSelect(country) {
    const phone = document.getElementById("phone");
    phone.value = country.code + " ";
  }
});

new CarbonSmartSelect("industry", INDUSTRIES);

new CarbonSmartSelect("jobTitle", JOB_TITLES);
  loadProfile();

  async function loadProfile() {
    try {
      const response = await fetch(`${API.BASE}${API.profile}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!data.success) {
        message.innerText = data.message || "Failed to load profile.";
        return;
      }

      const user = data.user;

      document.getElementById("name").value = user.name || "";
      document.getElementById("email").value = user.email || "";
      document.getElementById("company").value = user.company || "";
      document.getElementById("country").value = user.country || "";
      document.getElementById("phone").value = user.phone || "";
      document.getElementById("jobTitle").value = user.jobTitle || "";
      document.getElementById("industry").value = user.industry || "";
      document.getElementById("website").value = user.website || "";
      document.getElementById("linkedin").value = user.linkedin || "";
      document.getElementById("bio").value = user.bio || "";

      updateLargeAvatar(user.name);

    } catch (error) {
      console.error(error);
      message.innerText = "Unable to load profile.";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    message.innerText = "Saving profile...";

    const profileData = {
      name: document.getElementById("name").value.trim(),
      company: document.getElementById("company").value.trim(),
      country: document.getElementById("country").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      jobTitle: document.getElementById("jobTitle").value.trim(),
      industry: document.getElementById("industry").value.trim(),
      website: document.getElementById("website").value.trim(),
      linkedin: document.getElementById("linkedin").value.trim(),
      bio: document.getElementById("bio").value.trim()
    };

    try {
      const response = await fetch(`${API.BASE}${API.profile}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.user));
        updateLargeAvatar(data.user.name);
        message.innerText = "Profile updated successfully.";
      } else {
        message.innerText = data.message || "Profile update failed.";
      }

    } catch (error) {
      console.error(error);
      message.innerText = "Unable to update profile.";
    }
  });
});

function updateLargeAvatar(name) {
  const avatar = document.getElementById("profileAvatarLarge");

  if (!avatar || !name) return;

  const initials = name
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  avatar.innerText = initials;
}

function setupCountryPhoneCode() {
  const countryInput = document.getElementById("country");
  const phoneInput = document.getElementById("phone");

  if (!countryInput || !phoneInput) return;

  function applyCountryCode() {
    const selectedCountry = COUNTRIES.find(
      country => country.name.toLowerCase() === countryInput.value.toLowerCase()
    );

    if (!selectedCountry) return;

    const currentPhone = phoneInput.value.trim();

    const hasAnyCode = COUNTRIES.some(country =>
      currentPhone.startsWith(country.code)
    );

    if (!currentPhone) {
      phoneInput.value = selectedCountry.code + " ";
    } else if (!hasAnyCode) {
      phoneInput.value = selectedCountry.code + " " + currentPhone;
    }
  }

  countryInput.addEventListener("change", applyCountryCode);
  countryInput.addEventListener("blur", applyCountryCode);
}