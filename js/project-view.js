document.addEventListener("DOMContentLoaded", async () => {

    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("id");

    if (!projectId) {
        alert("Project not found.");
        window.location.href = "/projects.html";
        return;
    }

    loadProject(projectId);

    document.getElementById("editProjectBtn").href =
        `/project-editor.html?id=${projectId}`;

});
async function loadProject(projectId) {

    try {

        const response = await fetch(
            `${API.BASE}${API.projects}/${projectId}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const data = await response.json();

        if (!data.success) {
            return;
        }

        const project = data.project;

        document.getElementById("projectName").value =
            project.projectName || "";

        document.getElementById("country").value =
            project.country || "";

        document.getElementById("organization").value =
            project.organization || "";

        document.getElementById("projectType").value =
            project.projectType || "";

        document.getElementById("registry").value =
            project.registry || "";

        document.getElementById("methodology").value =
            project.methodology || "";

        document.getElementById("vintageYear").value =
            project.vintageYear || "";

        document.getElementById("estimatedCredits").value =
            project.estimatedCredits || "";

        document.getElementById("askingPrice").value =
            project.askingPrice || "";

        document.getElementById("currency").value =
            project.currency || "";

    }
    catch (err) {

        console.error(err);

    }

}
const submitBtn =
    document.getElementById("submitProject");

if (submitBtn) {

    submitBtn.addEventListener("click", () => {

        alert(
            "Submit for Review will be implemented next."
        );

    });

}