// AI Sales Brain — persistent, ACCUMULATING memory about a lead across every call,
// as opposed to leadIntelligence/callStrategy which are just the latest snapshot.
// Every field here traces back to something a lead actually said on a real call
// (extracted by server/analyzeCall.js) — nothing invented, and nothing overwritten:
// objections and family details accumulate call over call instead of the last call
// silently erasing what was learned on a previous one.

// Merges freshly-extracted signals from ONE call into the lead's running Sales
// Brain. `existing` may be undefined (first call ever analyzed for this lead).
export function mergeSalesBrain(existing, signals) {
  const brain = existing || {};
  const next = { ...brain };

  if (signals?.personality) next.personality = signals.personality;
  if (signals?.buyingStyle) next.buyingStyle = signals.buyingStyle;
  if (signals?.urgencyLevel) next.urgencyLevel = signals.urgencyLevel;
  if (signals?.preferredCallTime) next.preferredCallTime = signals.preferredCallTime;

  if (Array.isArray(signals?.familyDetails) && signals.familyDetails.length) {
    next.familyDetails = [...new Set([...(brain.familyDetails || []), ...signals.familyDetails])].slice(0, 10);
  }
  if (Array.isArray(signals?.objections) && signals.objections.length) {
    next.objectionHistory = [...new Set([...(brain.objectionHistory || []), ...signals.objections])].slice(0, 15);
  }

  next.callCount = (brain.callCount || 0) + 1;
  next.lastUpdated = new Date().toISOString();
  return next;
}

// Renders the accumulated memory as a compact briefing string, sent to Omnidimension
// as part of call_context (same mechanism already used for call_opening_style etc.)
// so the agent can reference real history instead of treating every call as the first.
export function buildSalesBrainBriefing(lead) {
  const b = lead?.salesBrain;
  if (!b || !b.callCount) return '';
  const parts = [`This lead has been called ${b.callCount} time(s) before — reference real history naturally instead of re-asking what's already known.`];
  if (b.personality) parts.push(`Personality: ${b.personality}.`);
  if (b.buyingStyle) parts.push(`Buying style: ${b.buyingStyle}.`);
  if (b.urgencyLevel) parts.push(`Urgency level: ${b.urgencyLevel}.`);
  if (b.familyDetails?.length) parts.push(`Family/personal context mentioned: ${b.familyDetails.join('; ')}.`);
  if (b.objectionHistory?.length) parts.push(`Objections raised on past calls: ${b.objectionHistory.join('; ')}.`);
  if (b.preferredCallTime) parts.push(`Prefers being called around: ${b.preferredCallTime}.`);
  if (lead.remarks) parts.push(`Most recent note on file: "${lead.remarks}"`);
  return parts.join(' ');
}
