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
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  changePassword: "/change-password",
  profile: "/profile",
  dashboard: "/dashboard",
  projects: "/projects",
  watchlist: "/watchlist",
  plans: "/plans",
  aiAsk: "/ai/ask",
  aiCompare: "/ai/compare",
  aiQuota: "/ai/quota",
  aiThreads: "/ai/threads",
  calcCatalog: "/calc/catalog",
  calcRun: "/calc/run",
  contact: "/contact",
  deals: "/deals",
  notifications: "/notifications",
  billingCheckout: "/billing/checkout",
  billingStatus: "/billing/status",
  projectAnalyze: (id) => `/projects/${id}/analyze`,
  subscriptionSet: "/subscription/set",
};

// Expose for pages that check window.API (const is not on window by default)
if (typeof window !== "undefined") {
  window.API = API;
}
