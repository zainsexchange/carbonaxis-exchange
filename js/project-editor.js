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
new CarbonSmartSelect("registry", REGISTRIES);
new CarbonSmartSelect("methodology", METHODOLOGIES);
new CarbonSmartSelect("currency", CURRENCIES, {
  display(item) {
    return `${item.flag} ${item.code} - ${item.name} (${item.symbol})`;
  }
});

  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");
  let currentStep = 1;
const totalSteps = 5;

const prevBtn = document.getElementById("prevStep");
const nextBtn = document.getElementById("nextStep");
const stepLabel = document.querySelector(".project-editor-head .section-label");
const sectionTitle = document.querySelector(".project-editor-head h2");
const progressFill = document.querySelector(".progress-fill");
const progressSteps = document.querySelectorAll(".progress-steps span");

const stepTitles = {
  1: "Basic Information",
  2: "Carbon Information",
  3: "Commercial Information",
  4: "Documents",
  5: "AI Review"
};

function showStep(step) {
  document.querySelectorAll(".wizard-step").forEach(section => {
    section.classList.remove("active");
  });

  const activeSection = document.querySelector(`.wizard-step[data-step="${step}"]`);

  if (activeSection) {
    activeSection.classList.add("active");
  }

  if (stepLabel) {
    stepLabel.innerText = `Step ${step} of ${totalSteps}`;
  }

  if (sectionTitle) {
    sectionTitle.innerText = stepTitles[step];
  }

  if (progressFill) {
    progressFill.style.width = `${(step / totalSteps) * 100}%`;
  }

  progressSteps.forEach((item, index) => {
    item.classList.toggle("active", index + 1 === step);
  });

  if (prevBtn) {
    prevBtn.style.display = step === 1 ? "none" : "inline-flex";
  }

  if (nextBtn) {
    nextBtn.innerText = step === totalSteps ? "Finish" : "Continue →";
  }
}

if (prevBtn) {
  prevBtn.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    }
  });
}

showStep(currentStep);

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

  registry: document.getElementById("registry").value.trim(),
  methodology: document.getElementById("methodology").value.trim(),
  vintageYear: document.getElementById("vintageYear").value.trim(),
  estimatedCredits: document.getElementById("estimatedCredits").value.trim(),
  askingPrice: document.getElementById("askingPrice").value.trim(),
currency: document.getElementById("currency").value.trim(),

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
    document.getElementById("registry").value = project.registry || "";
document.getElementById("methodology").value = project.methodology || "";
document.getElementById("vintageYear").value = project.vintageYear || "";
document.getElementById("estimatedCredits").value = project.estimatedCredits || "";
document.getElementById("askingPrice").value = project.askingPrice || "";
document.getElementById("currency").value = project.currency || "";

  } catch (error) {
    console.error(error);
    message.innerText = "Unable to load project.";
  }
}