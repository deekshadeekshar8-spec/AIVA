// Lost Lead Intelligence — categorizes WHY a lead was actually lost, instead of
// a flat "Not Interested". Every category is derived from real, already-stored
// text (objections, qualificationReason, remarks, competitorMentions,
// noAnswerStreak) — never a guess invented for this feature. Pure function, no
// I/O, same testing pattern as callOutcomeRules.js.

const CATEGORY_KEYWORDS = {
  price: ['price', 'expensive', 'costly', 'budget', 'afford', 'rate per', 'sqft rate'],
  approval: ['approval', 'legal', 'khata', 'biaapa', 'dc conversion', 'documentation', 'title', 'registration'],
  payment: ['emi', 'installment', 'payment plan', 'loan', 'financing', 'down payment'],
  location: ['location', 'far', 'distance', 'connectivity', 'commute'],
  timing: ['not now', 'not ready', 'later', 'timing', 'next year', 'wait'],
};

// Returns { category, detail } — category is one of: price, approval, payment,
// location, timing, competitor, no_follow_up, unreachable, other.
export function categorizeLostReason(lead) {
  const detailSource = lead?.qualificationReason || lead?.remarks || '';

  // A real named competitor mention is the strongest, most explicit signal —
  // check it before falling back to keyword matching on free text.
  if (lead?.competitorMentions?.length) {
    return { category: 'competitor', detail: `Compared against ${lead.competitorMentions[0]}.` };
  }

  // Real operational signals that explain a loss without needing any text at all.
  if ((lead?.noAnswerStreak || 0) >= 3) {
    return { category: 'unreachable', detail: `${lead.noAnswerStreak} consecutive no-answers.` };
  }

  const text = [
    lead?.qualificationReason, lead?.remarks, lead?.frustrationReason,
    ...(lead?.objections || []), ...(lead?.salesBrain?.objectionHistory || []),
  ].filter(Boolean).join(' ').toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return { category, detail: detailSource || `Objection matched "${category}".` };
    }
  }

  if (text.trim()) return { category: 'other', detail: detailSource };
  return { category: 'no_follow_up', detail: 'No objection or reason on record — likely lost to lack of timely follow-up.' };
}

// Aggregate real counts + percentages across every genuinely lost lead
// (interestLevel === 'Not Interested'). Never fabricates a category that has
// zero real leads in it.
export function summarizeLostReasons(leads) {
  const lost = (leads || []).filter(l => l.interestLevel === 'Not Interested');
  const counts = {};
  for (const lead of lost) {
    const { category } = categorizeLostReason(lead);
    counts[category] = (counts[category] || 0) + 1;
  }
  return {
    totalLost: lost.length,
    breakdown: Object.entries(counts)
      .map(([category, count]) => ({ category, count, pct: lost.length > 0 ? Math.round((count / lost.length) * 100) : 0 }))
      .sort((a, b) => b.count - a.count),
  };
}
