// Unified Lead Score — a real 0-100 number computed from actual buying signals
// (spec section 2), not a vibe. Every point traces back to something the lead
// genuinely did: asked about EMI, requested a site visit, confirmed a budget,
// etc. (server/analyzeCall.js buyingSignals extraction, accumulated across calls
// the same way AI Sales Brain accumulates objections — server/salesBrain.js).
//
// Pure function — no I/O — so it's independently testable like
// server/callOutcomeRules.js and server/propertySharing.js.

const STICKY_INTEREST = new Set(['Not Interested', 'Wrong Number']);

// Weight of each real signal toward the 0-100 score. Kept in one place so the
// scoring model is auditable, not scattered logic.
const WEIGHTS = {
  budgetConfirmed: 8,        // lead.budget > 0
  locationPreferenceSet: 8,  // lead.locationPreference set
  projectInterestSet: 8,     // lead.projectInterest matches the real catalogue
  highUrgency: 10,           // salesBrain.urgencyLevel === 'High'
  mediumUrgency: 5,
  qualified: 12,             // last call's qualified === true
  askedFinalPrice: 8,
  askedBookingAmount: 10,
  askedAvailability: 6,
  askedEMI: 8,
  askedNegotiation: 8,
  askedApprovals: 5,
  askedDocuments: 6,
  comparedCompetitor: 4,     // engaged enough to compare, mildly positive
  requestedSiteVisit: 15,
  askedToBook: 20,           // the single strongest real buying signal
  siteVisitScheduled: 10,    // a real visit is actually on the calendar
};

const PENALTIES = {
  frustrationDetected: -15,
  escalatedLowConfidence: -5, // AIVA itself doesn't understand this lead well yet
};

export function computeLeadScore(lead) {
  if (!lead) return { value: 0, temperature: 'Cold', breakdown: [] };

  // Sticky refusals are always Cold regardless of any signal — they said stop.
  if (STICKY_INTEREST.has(lead.interestLevel)) {
    return { value: 0, temperature: 'Cold', breakdown: [{ signal: 'Explicit refusal / wrong number', points: 0 }] };
  }

  const signals = lead.buyingSignals || {};
  const breakdown = [];
  let value = 0;

  const add = (label, points) => {
    if (!points) return;
    value += points;
    breakdown.push({ signal: label, points });
  };

  if (lead.budget > 0) add('Budget confirmed', WEIGHTS.budgetConfirmed);
  if (lead.locationPreference) add('Location preference confirmed', WEIGHTS.locationPreferenceSet);
  if (lead.projectInterest) add('Project preference confirmed', WEIGHTS.projectInterestSet);

  const urgency = lead.salesBrain?.urgencyLevel;
  if (urgency === 'High') add('High urgency (Sales Brain)', WEIGHTS.highUrgency);
  else if (urgency === 'Medium') add('Medium urgency (Sales Brain)', WEIGHTS.mediumUrgency);

  if (lead.qualified === true) add('Qualified on last call', WEIGHTS.qualified);

  if (signals.askedFinalPrice) add('Asked final price', WEIGHTS.askedFinalPrice);
  if (signals.askedBookingAmount) add('Asked booking amount', WEIGHTS.askedBookingAmount);
  if (signals.askedAvailability) add('Asked plot availability', WEIGHTS.askedAvailability);
  if (signals.askedEMI) add('Asked about EMI/installments', WEIGHTS.askedEMI);
  if (signals.askedNegotiation) add('Asked about negotiation', WEIGHTS.askedNegotiation);
  if (signals.askedApprovals) add('Asked about approvals', WEIGHTS.askedApprovals);
  if (signals.askedDocuments) add('Asked what documents they get', WEIGHTS.askedDocuments);
  if (signals.comparedCompetitor) add('Compared a named competitor', WEIGHTS.comparedCompetitor);
  if (signals.requestedSiteVisit) add('Requested a site visit', WEIGHTS.requestedSiteVisit);
  if (signals.askedToBook) add('Asked to book a plot', WEIGHTS.askedToBook);
  if (lead.siteVisitScheduled) add('Site visit actually scheduled', WEIGHTS.siteVisitScheduled);

  if (lead.frustrationDetected) add('Frustration detected on last call', PENALTIES.frustrationDetected);
  if (lead.escalated && lead.escalationCategory === 'low_confidence') add('AI confidence still low', PENALTIES.escalatedLowConfidence);

  value = Math.max(0, Math.min(100, value));

  let temperature;
  if (value >= 65) temperature = 'Hot';
  else if (value >= 35) temperature = 'Warm';
  else if (value >= 12) temperature = 'Nurture';
  else temperature = 'Cold';

  return { value, temperature, breakdown };
}

export const TEMPERATURE_EMOJI = { Hot: '🟢', Warm: '🟡', Nurture: '🔵', Cold: '⚪' };

// Buying signals ACCUMULATE — once a lead has genuinely asked about EMI on any
// call, that fact stays true forever (OR, never un-set), same accumulation
// philosophy as server/salesBrain.js.
export function mergeBuyingSignals(existing, fresh) {
  const merged = { ...(existing || {}) };
  for (const [key, val] of Object.entries(fresh || {})) {
    if (val === true) merged[key] = true;
  }
  return merged;
}
