document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  const form = document.getElementById("projectForm");
  const message = document.getElementById("projectMessage");
  new CarbonSmartSelect("country", COUNTRIES);
new CarbonSmartSelect("projectType", PROJECT_TYPES);

  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");

  if (projectId) {
    await loadProject(projectId);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    message.innerText = projectId ? "Updating project..." : "Saving draft...";

    const projectData = {
      projectName: document.getElementById("projectName").value.trim(),
      country: document.getElementById("country").value.trim(),
      organization: document.getElementById("organization").value.trim(),
      projectType: document.getElementById("projectType").value.trim(),
      status: "Draft"
    };

    const url = projectId
      ? `${API.BASE}${API.projects}/${projectId}`
      : `${API.BASE}${API.projects}`;

    const method = projectId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(projectData)
      });

      const data = await response.json();

      if (data.success) {
        message.innerText = projectId
          ? "Project updated successfully."
          : "Draft saved successfully.";

        setTimeout(() => {
          window.location.href = "/projects.html";
        }, 1000);
      } else {
        message.innerText = data.message || "Action failed.";
      }

    } catch (error) {
      console.error(error);
      message.innerText = "Unable to connect to server.";
    }
  });
});

async function loadProject(projectId) {
  const message = document.getElementById("projectMessage");

  try {
    const response = await fetch(`${API.BASE}${API.projects}/${projectId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    const data = await response.json();

    if (!data.success) {
      message.innerText = data.message || "Failed to load project.";
      return;
    }

    const project = data.project;

    document.getElementById("projectName").value = project.projectName || "";
    document.getElementById("country").value = project.country || "";
    document.getElementById("organization").value = project.organization || "";
    document.getElementById("projectType").value = project.projectType || "";

  } catch (error) {
    console.error(error);
    message.innerText = "Unable to load project.";
  }
}