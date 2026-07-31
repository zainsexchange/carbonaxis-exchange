/**
 * Feedback engine scaffold (Carbon Brain v1.5).
 *
 * Captures operational feedback for planner /
 * inference / confidence tuning — not model training.
 */

const feedbackEvents = [];
const MAX_EVENTS = 500;

/**
 * @param {object} event
 * @returns {object}
 */
export function recordFeedback(event = {}) {
  const entry = {
    id: `fb_${Date.now()}_${feedbackEvents.length}`,
    queryId: event.queryId || null,
    question: event.question || null,
    truthStatus: event.truthStatus || null,
    plannerStrategy:
      event.plannerStrategy || null,
    rating: event.rating ?? null,
    useful: event.useful ?? null,
    notes: event.notes || null,
    createdAt: new Date().toISOString(),
  };

  feedbackEvents.unshift(entry);

  if (feedbackEvents.length > MAX_EVENTS) {
    feedbackEvents.length = MAX_EVENTS;
  }

  return entry;
}

/**
 * @returns {object}
 */
export function summarizeFeedback() {
  const byStrategy = {};
  let positive = 0;
  let negative = 0;

  for (const event of feedbackEvents) {
    const strategy =
      event.plannerStrategy || "UNKNOWN";

    if (!byStrategy[strategy]) {
      byStrategy[strategy] = {
        total: 0,
        positive: 0,
        negative: 0,
      };
    }

    byStrategy[strategy].total += 1;

    if (event.useful === true) {
      positive += 1;
      byStrategy[strategy].positive += 1;
    }

    if (event.useful === false) {
      negative += 1;
      byStrategy[strategy].negative += 1;
    }
  }

  return {
    total: feedbackEvents.length,
    positive,
    negative,
    byStrategy,
  };
}

export function listFeedback(limit = 50) {
  return feedbackEvents.slice(0, limit);
}

export function clearFeedback() {
  feedbackEvents.length = 0;
}
