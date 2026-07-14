const API = {
  // Local pages → local API. Live site → Render API.
  BASE:
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
      ? "http://localhost:5000/api"
      : "https://carbonaxis-exchange.onrender.com/api",

  login: "/login",
  register: "/register",
  profile: "/profile",
  dashboard: "/dashboard",
  projects: "/projects",
  watchlist: "/watchlist",
  plans: "/plans",
  aiAsk: "/ai/ask",
  aiQuota: "/ai/quota",
  deals: "/deals",
  billingCheckout: "/billing/checkout",
  projectAnalyze: (id) => `/projects/${id}/analyze`,
  subscriptionSet: "/subscription/set",
};
