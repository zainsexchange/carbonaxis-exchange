document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  await loadMyProjects();
});

async function loadMyProjects() {
  const grid = document.getElementById("myProjectsGrid");
  const empty = document.getElementById("projectsEmpty");

  if (!grid) return;

  try {
    const response = await fetch(`${API.BASE}${API.projects}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    const data = await response.json();

    if (!data.success) {
      grid.innerHTML = "<p>Unable to load projects.</p>";
      return;
    }

    grid.innerHTML = "";

    if (!data.projects || data.projects.length === 0) {
      if (empty) empty.style.display = "block";
      return;
    }

    if (empty) empty.style.display = "none";

    data.projects.forEach(project => {
      grid.innerHTML += `
        <div class="dash-card">
          <span class="status-badge ${project.status?.toLowerCase() || "draft"}">
    ${project.status || "Draft"}
</span>
          <h3>${project.projectName || "Untitled Project"}</h3>
          <p>${project.country || "Global"} · ${project.projectType || "Carbon Project"}</p>

          <div class="project-meta">
            <span>Registry: ${project.registry || "Not selected"}</span>
            <span>Credits: ${project.estimatedCredits || "0"}</span>
            <span>Price: ${project.askingPrice || "Not set"} ${project.currency || ""}</span>
          </div>

          <div class="hero-actions" style="margin-top:18px;">
  <a href="#" class="btn btn-primary">View</a>

  <a href="/project-editor.html?id=${project._id}" class="btn btn-outline">
    Edit
  </a>

  <button
    type="button"
    class="btn btn-outline"
    onclick="deleteProject('${project._id}')">
    Delete
  </button>
</div>
            
          </div>
        </div>
      `;
    });

  } catch (error) {
    console.error(error);
    grid.innerHTML = "<p>Unable to connect to server.</p>";
  }
}
async function deleteProject(projectId){

  const confirmed = confirm(
    "Delete this project permanently?"
  );

  if(!confirmed) return;

  try{

    const response = await fetch(
      `${API.BASE}${API.projects}/${projectId}`,
      {
        method:"DELETE",
        headers:{
          Authorization:`Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const data = await response.json();

    if(data.success){
      await loadMyProjects();
    }else{
      alert(data.message || "Delete failed.");
    }

  }catch(error){
    console.error(error);
    alert("Unable to delete project.");
  }
}