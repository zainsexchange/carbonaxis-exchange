document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");

  const submitBtn = document.getElementById("submitProject");
  const message = document.getElementById("projectMessage");
  const editBtn = document.getElementById("editProjectBtn");

  if (!projectId) {
    alert("Project not found.");
    window.location.href = "/projects.html";
    return;
  }

  if (editBtn) {
    editBtn.href = `/project-editor.html?id=${encodeURIComponent(projectId)}`;
  }

  await loadProject(projectId);

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const confirmed = confirm(
        "Submit this project for review? You will not be able to edit it while it is under review."
      );

      if (!confirmed) return;

      submitBtn.disabled = true;
      submitBtn.innerText = "Submitting...";

      if (message) {
        message.innerText = "";
      }

      try {
        const response = await fetch(
          `${API.BASE}${API.projects}/${projectId}/submit`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          }
        );

        const data = await response.json();

        console.log("Submit response:", data);

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Submission failed.");
        }

        if (message) {
          message.innerText = "Project submitted successfully.";
        }

        submitBtn.innerText = "Submitted";

        setTimeout(() => {
          window.location.href = "/projects.html";
        }, 1000);

      } catch (error) {
        console.error("Submit error:", error);

        if (message) {
          message.innerText =
            error.message || "Unable to submit project.";
        }

        submitBtn.disabled = false;
        submitBtn.innerText = "Submit for Review";
      }
    });
  }
});

async function loadProject(projectId) {
  const message = document.getElementById("projectMessage");

  try {
    const response = await fetch(
      `${API.BASE}${API.projects}/${projectId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load project.");
    }

    const project = data.project;

    setFieldValue("projectName", project.projectName);
    setFieldValue("country", project.country);
    setFieldValue("organization", project.organization);
    setFieldValue("projectType", project.projectType);
    setFieldValue("registry", project.registry);
    setFieldValue("methodology", project.methodology);
    setFieldValue("vintageYear", project.vintageYear);
    setFieldValue("estimatedCredits", project.estimatedCredits);
    setFieldValue("askingPrice", project.askingPrice);
    setFieldValue("currency", project.currency);

    const submitBtn = document.getElementById("submitProject");
    const editBtn = document.getElementById("editProjectBtn");

    if (project.status && project.status !== "Draft") {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = project.status;
      }

      if (editBtn) {
        editBtn.style.display = "none";
      }
    }

  } catch (error) {
    console.error("Load project error:", error);

    if (message) {
      message.innerText =
        error.message || "Unable to load project.";
    }
  }
}

function setFieldValue(id, value) {
  const field = document.getElementById(id);

  if (field) {
    field.value = value ?? "";
  }
}