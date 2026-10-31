// Escalation — flags a lead for a human rep to take over instead of AIVA
// continuing to handle it autonomously. Every trigger here is a real signal
// already present elsewhere in the pipeline:
//   - low_confidence: leadIntelligence.confidence (server/leadIntelligence.js)
//     was too low to keep auto-dialing this lead blind (checked pre-dial only —
//     see scheduler.js — never fabricated after the fact).
//   - frustration: Gemini's own post-call read of the transcript
//     (server/analyzeCall.js frustrationDetected/frustrationReason).
//   - high_value: the lead's actual budget crossing an admin-set threshold while
//     genuinely qualified (Hot Lead/Interested) — no invented scoring.
//   - explicit_human_request / legal_concern / complaint: real per-call signals
//     Gemini read off the transcript (server/analyzeCall.js escalationSignals) —
//     a senior salesperson knows these are NOT theirs to handle alone (spec
//     section 12).
// Nothing here is simulated; if none of these real conditions hold, no escalation happens.
const QUALIFIED_FOR_HIGH_VALUE = new Set(['Hot Lead', 'Interested']);

export function computeEscalation({ interestLevel, budget, frustrationDetected, frustrationReason, confidence, settings, escalationSignals }) {
  const categories = [];
  const reasons = [];

  if (escalationSignals?.explicitHumanRequest) {
    categories.push('explicit_human_request');
    reasons.push('Lead explicitly asked to speak with a human salesperson.');
  }
  if (escalationSignals?.legalOrDocumentationConcern) {
    categories.push('legal_concern');
    reasons.push('Lead raised a legal/documentation concern that needs human verification.');
  }
  if (escalationSignals?.complaintRaised) {
    categories.push('complaint');
    reasons.push('Lead raised a genuine complaint about the company or service.');
  }

  if (frustrationDetected) {
    categories.push('frustration');
    reasons.push(frustrationReason ? `Frustration detected: ${frustrationReason}` : 'Frustration detected on the last call.');
  }

  const highValueThreshold = settings?.escalationHighValueBudget ?? 4000000;
  if (typeof budget === 'number' && budget >= highValueThreshold && QUALIFIED_FOR_HIGH_VALUE.has(interestLevel)) {
    categories.push('high_value');
    reasons.push(`High-value qualified lead — budget ~₹${budget.toLocaleString('en-IN')}, interest "${interestLevel}".`);
  }

  // Only ever evaluated when a caller explicitly passes a real confidence number
  // (scheduler.js, right before it would otherwise auto-dial) — never inferred here.
  if (settings?.humanHandoffEnabled !== false && typeof confidence === 'number') {
    const threshold = settings?.humanHandoffConfidenceThreshold ?? 40;
    if (confidence < threshold) {
      categories.push('low_confidence');
      reasons.push(`AI confidence too low to keep dialing autonomously (${confidence}/100).`);
    }
  }

  if (categories.length === 0) return null;
  return {
    escalated: true,
    escalationCategory: categories[0],
    escalationReason: reasons.join(' '),
    escalatedAt: new Date().toISOString(),
  };
}

// Human Handoff summary card (spec section 12 example) — every field traces back
// to a real, already-stored value on the lead. Never invented to fill a gap;
// missing information is shown honestly as "Not stated"/"None recorded".
export function buildHandoffSummary(lead) {
  const temperature = lead?.leadScore?.temperature || null;
  const TEMP_EMOJI = { Hot: '🔥', Warm: '🟡', Nurture: '🔵', Cold: '⚪' };
  const requirement = [
    lead?.siteSizeSqft ? `${lead.siteSizeSqft} sqft plot` : null,
    lead?.projectInterest || lead?.project || null,
  ].filter(Boolean).join(' — ') || 'Not yet specified';
  const topObjection = lead?.objections?.[0] || lead?.salesBrain?.objectionHistory?.[0] || null;
  const competitor = lead?.competitorMentions?.[0] || null;
  const siteVisitInterest = lead?.siteVisitScheduled
    ? `Scheduled (${lead.siteVisitScheduled})`
    : lead?.buyingSignals?.requestedSiteVisit ? 'Interested' : 'Not discussed';

  return {
    headline: `${TEMP_EMOJI[temperature] || '⚪'} ${(temperature || 'UNSCORED').toUpperCase()} LEAD`,
    customer: lead?.name || 'Unknown',
    budget: lead?.budget ? `₹${lead.budget.toLocaleString('en-IN')}` : 'Not stated',
    requirement,
    preferredLocation: lead?.locationPreference || lead?.location || 'Not stated',
    concern: topObjection || 'None recorded',
    competitor: competitor || 'None mentioned',
    siteVisitInterest,
    recommendedAction: lead?.nextBestAction?.action || 'Review and contact directly.',
  };
}
