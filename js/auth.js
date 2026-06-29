function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login.html";
}

document.addEventListener("DOMContentLoaded", () => {

    const token = localStorage.getItem("token");

    // Protected pages
    const protectedPages = [
        "dashboard.html",
        "projects.html",
        "watchlist.html",
        "profile.html"
    ];

    const currentPage = window.location.pathname.split("/").pop();

    if (protectedPages.includes(currentPage) && !token) {
        window.location.href = "/login.html";
        return;
    }

    // Navbar
    const loginBtn = document.querySelector(".login-open");
    const profileMenu = document.querySelector(".profile-menu");
    const notificationMenu = document.querySelector(".notification-menu");

    if (token) {

        if (loginBtn)
            loginBtn.style.display = "none";

        if (profileMenu)
            profileMenu.style.display = "block";

        if (notificationMenu)
            notificationMenu.style.display = "block";

    } else {

        if (loginBtn)
            loginBtn.style.display = "inline-flex";

        if (profileMenu)
            profileMenu.style.display = "none";

        if (notificationMenu)
            notificationMenu.style.display = "none";
    }

    // Profile Dropdown

    const profileBtn = document.querySelector(".profile-btn");

    if (profileBtn && profileMenu) {

        profileBtn.addEventListener("click", function(e){

            e.stopPropagation();

            profileMenu.classList.toggle("active");

        });

        document.addEventListener("click", function(){

            profileMenu.classList.remove("active");

        });

    }

    // Notification Dropdown

    const notificationBtn = document.querySelector(".notification-btn");

    if(notificationBtn && notificationMenu){

        notificationBtn.addEventListener("click", function(e){

            e.stopPropagation();

            notificationMenu.classList.toggle("active");

        });

        document.addEventListener("click", function(){

            notificationMenu.classList.remove("active");

        });

    }

});