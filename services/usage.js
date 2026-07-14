import { getPlan } from "../config/plans.js";
import { isUnlimitedAiTester } from "../config/testers.js";

function currentPeriodKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Ensures monthly AI usage counter resets when the calendar month changes.
 * Mutates and saves the user document when needed.
 */
export async function ensureAiUsagePeriod(user) {
  const period = currentPeriodKey();
  if (!user.aiUsage) {
    user.aiUsage = { period, count: 0 };
    await user.save();
    return user.aiUsage;
  }
  if (user.aiUsage.period !== period) {
    user.aiUsage.period = period;
    user.aiUsage.count = 0;
    await user.save();
  }
  return user.aiUsage;
}

/** Plan features used for AI (testers get enterprise depth without billing). */
export function getEffectiveAiPlan(user) {
  if (isUnlimitedAiTester(user?.email)) {
    return getPlan("enterprise");
  }
  return getPlan(user?.subscription);
}

export function getAiQuota(user) {
  const plan = getEffectiveAiPlan(user);
  const used = user.aiUsage?.count || 0;
  const unlimited = isUnlimitedAiTester(user?.email);

  if (unlimited) {
    return {
      plan: "tester",
      planName: "Tester (unlimited)",
      used,
      limit: null,
      remaining: null,
      unlimited: true,
      deepAnalysis: true,
      projectAiInsights: true,
      maxWatchlist: getPlan(user.subscription).maxWatchlist,
    };
  }

  const limit = plan.aiQueriesPerMonth;
  return {
    plan: plan.id,
    planName: plan.name,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    unlimited: false,
    deepAnalysis: plan.deepAnalysis,
    projectAiInsights: plan.projectAiInsights,
    maxWatchlist: plan.maxWatchlist,
  };
}

export async function consumeAiQuery(user) {
  await ensureAiUsagePeriod(user);

  if (isUnlimitedAiTester(user.email)) {
    user.aiUsage.count += 1;
    await user.save();
    return {
      allowed: true,
      quota: getAiQuota(user),
    };
  }

  const plan = getPlan(user.subscription);
  if (user.aiUsage.count >= plan.aiQueriesPerMonth) {
    return {
      allowed: false,
      quota: getAiQuota(user),
      message: `Monthly AI limit reached for ${plan.name} plan (${plan.aiQueriesPerMonth}/month). Upgrade to continue.`,
    };
  }
  user.aiUsage.count += 1;
  await user.save();
  return {
    allowed: true,
    quota: getAiQuota(user),
  };
}
