document.addEventListener("DOMContentLoaded", async () => {

    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    try {

        const response = await fetch(`${API.BASE}${API.dashboard}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();
        console.log(data);

        if (!data.success) return;

        updateGreeting(data.user.name);

        updateProfile(data.user);

        updateStats(data.stats);

    } catch (error) {

        console.error(error);

    }

});

function updateGreeting(name){

    const greeting =
    document.getElementById("dashboardGreeting");

    if(!greeting) return;

    const hour =
    new Date().getHours();

    let message = "Welcome";

    if(hour < 12){

        message = "Good Morning";

    }else if(hour < 18){

        message = "Good Afternoon";

    }else{

        message = "Good Evening";

    }

    greeting.innerHTML =
    `${message}, ${name} 👋`;

}

function updateProfile(user){

    const avatar =
    document.querySelector(".profile-avatar");

    const account =
    document.querySelector(".profile-btn span:nth-child(2)");

    if(avatar){

        avatar.innerText =
        user.name
        .split(" ")
        .map(n => n[0])
        .join("")
        .substring(0,2)
        .toUpperCase();

    }

    if(account){

        account.innerText =
        user.name;

    }

}

function updateStats(stats){

    const portfolio =
    document.getElementById("portfolioValue");

    const watched =
    document.getElementById("creditsWatched");

    const verified =
    document.getElementById("verifiedProjects");

    const aiSearches =
    document.getElementById("aiSearches");

    if(portfolio){

        portfolio.innerText =
        "$" +
        Number(stats.portfolioValue).toLocaleString();

    }

    if(watched){

        watched.innerText =
        stats.creditsWatched;

    }

    if(verified){

        verified.innerText =
        stats.verifiedProjects;

    }

    if(aiSearches){
        const limit = stats.aiLimit != null ? ` / ${stats.aiLimit}` : "";
        aiSearches.innerText = `${stats.aiSearches || 0}${limit}`;
    }

}