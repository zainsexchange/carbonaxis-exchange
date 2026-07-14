/**
 * CarbonAxis subscription plans.
 * Everyone can access the Green Energy AI engine;
 * limits and depth change by plan.
 */
export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    aiQueriesPerMonth: 5,
    maxWatchlist: 5,
    deepAnalysis: false,
    projectAiInsights: false,
    marketsPriority: ["Pakistan", "Oman"],
    features: [
      "5 Green Energy AI queries / month",
      "Basic feasibility answers",
      "Pakistan & Oman priority coverage",
      "Marketplace browse + watchlist (5)",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "$49/mo",
    aiQueriesPerMonth: 100,
    maxWatchlist: 50,
    deepAnalysis: true,
    projectAiInsights: true,
    marketsPriority: ["Pakistan", "Oman", "UAE", "Global"],
    features: [
      "100 AI queries / month",
      "Deep regulatory & horizon analysis",
      "Go / no-go decision briefs",
      "Project AI risk & opportunity scores",
      "Expanded watchlist (50)",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "Custom",
    aiQueriesPerMonth: 1000,
    maxWatchlist: 500,
    deepAnalysis: true,
    projectAiInsights: true,
    marketsPriority: ["Pakistan", "Oman", "UAE", "Global"],
    features: [
      "1000 AI queries / month",
      "Full green-energy regulatory depth",
      "Multi-market trading feasibility",
      "Team-ready decision reports",
      "Priority support",
    ],
  },
};

export function getPlan(subscription) {
  return PLANS[subscription] || PLANS.free;
}
