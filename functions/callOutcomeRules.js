// SAFETY-CRITICAL: the single source of truth for "given a finished call and the
// lead's current state, what should change on that lead?"
//
// This logic previously existed as two hand-maintained copies — one in
// callPoller.js (the real production path, since the Omnidimension agents have no
// webhook) and one in app.js's /api/omnidim/webhook. Keeping them in sync by hand
// was a live drift risk: a fix applied to one and forgotten in the other silently
// changes who gets called. It is now one pure function, used by both and covered
// by tests in server/__tests__/callOutcomeRules.test.js.
//
// Pure on purpose: no I/O, no clock reads except the injected `now`, so every rule
// below is exhaustively testable.

export const NO_ANSWER_STATUSES = new Set([
  'no-answer', 'no_answer', 'not-answered', 'not_answered',
  'busy', 'failed', 'missed', 'unanswered',
  // A voicemail is a real, finished call attempt where nobody actually engaged —
  // functionally a no-answer for retry/status purposes. Without this, a lead
  // whose call goes to voicemail while Gemini analysis also fails (quota/API
  // error) never has ANY rule fire, so it stays stuck on the pre-call "In Call"
  // marker forever instead of re-entering the retry cadence.
  'voicemail_detected', 'voicemail-detected', 'voicemail',
]);

// A lead who explicitly refused, or whose number is wrong, must never be dragged
// back into the calling pool by a later unrelated event.
export const STICKY_INTEREST_LEVELS = new Set(['Not Interested', 'Wrong Number']);

export const NO_ANSWER_RETRY_MS = 4 * 60 * 60 * 1000; // 4 hours, per explicit client rule
export const DAILY_FOLLOWUP_MS = 24 * 60 * 60 * 1000; // real daily cadence for genuinely engaged leads

// Genuinely engaged leads that should be followed up daily by default, per
// explicit client rule (2026-08-14) — never left on whatever vague "few days
// out" guess a model might otherwise produce.
export const DAILY_FOLLOWUP_INTEREST_LEVELS = new Set(['Interested', 'Hot Lead']);

// Interest levels eligible for AUTONOMOUS dialing (server/scheduler.js), per
// explicit client rule (2026-08-20): a lead who explicitly asked for a callback
// ("Call Later") must not silently fall through the cracks the way Aman did —
// but this deliberately stays a short allowlist. It excludes stale "Not
// Reachable" no-answer retries (a large old campaign backlog must never get
// mass-auto-dialed just because autoDial is on) and obviously excludes
// "Not Interested"/"Wrong Number" (STICKY_INTEREST_LEVELS, never called again).
export const AUTODIAL_ELIGIBLE_INTEREST_LEVELS = new Set(['Interested', 'Hot Lead', 'Call Later']);

export function isNoAnswer(callStatus) {
  return NO_ANSWER_STATUSES.has(String(callStatus || '').toLowerCase());
}

export function isStickyLead(lead) {
  return STICKY_INTEREST_LEVELS.has(lead?.interestLevel);
}

/**
 * Decides the CRM updates for one completed call.
 *
 * @param {object}  params.lead      current lead record (may be partial)
 * @param {string}  params.callStatus raw status from the telephony platform
 * @param {object}  params.analysis  result of analyzeCallForLead (must carry `analyzed`)
 * @param {number}  params.now       epoch ms, injected so retry scheduling is testable
 * @returns {object} updates to merge onto the lead
 */
export function decideLeadUpdates({ lead, callStatus, analysis, now = Date.now() }) {
  const updates = { ...(analysis?.suggestedUpdates || {}) };
  const noAnswer = isNoAnswer(callStatus);
  const analyzed = analysis?.analyzed === true;

  // RULE 1 — "picked up but no real engagement" means Not Interested, and we stop.
  //
  // Gated on `analyzed`. If the analysis itself failed (no API key, exhausted
  // quota, network error) we know NOTHING about what was said, and defaulting to
  // "Not Interested" would permanently blacklist a real customer who may have been
  // actively booking a site visit. On failure we leave interest untouched.
  if (analyzed && !noAnswer && !updates.interestLevel) {
    updates.interestLevel = 'Not Interested';
    updates.status = 'Completed';
  }

  // RULE 2 — no-answer schedules a retry, but must never overwrite a sticky refusal.
  if (noAnswer && !isStickyLead(lead)) {
    updates.interestLevel = 'Not Reachable';
    updates.status = 'Outgoing Retry';
    updates.nextFollowUpDate = new Date(now + NO_ANSWER_RETRY_MS).toISOString();
    updates.remarks = 'Call not picked up — auto-retry scheduled in 4 hours.';
  }

  // RULE 6 — a real site visit set THIS call takes priority over every other
  // follow-up signal: AIVA calls back around the actual scheduled visit (a real
  // reminder/confirmation call) instead of a generic cadence. Scheduled for
  // 11:00 AM IST — the start of the calling window — so it's always inside it.
  // (Overridden below by RULE 3/4 if this lead is sticky or landed on "Not
  // Interested" — a booked visit never re-opens a lead who explicitly refused.)
  if (analyzed && !noAnswer && updates.siteVisitScheduled) {
    updates.nextFollowUpDate = `${updates.siteVisitScheduled}T05:30:00.000Z`;
  } else if (analyzed && !noAnswer && DAILY_FOLLOWUP_INTEREST_LEVELS.has(updates.interestLevel) && !updates.nextFollowUpDate) {
    // RULE 7 — engaged leads (Interested / Hot Lead) get a real daily follow-up
    // cadence when the lead didn't ask for a specific later callback time.
    updates.nextFollowUpDate = new Date(now + DAILY_FOLLOWUP_MS).toISOString();
  }

  // RULE 3 — a sticky lead stays closed no matter what this call produced.
  // nextFollowUpDate is set to null (not just omitted) so an existing date on the
  // record is actively CLEARED. Omitting it would leave a stale future follow-up
  // showing on a do-not-call lead — harmless to the dialer, which skips them, but
  // misleading to a human reading the CRM.
  if (isStickyLead(lead)) {
    updates.interestLevel = lead.interestLevel;
    updates.status = 'Completed';
    updates.nextFollowUpDate = null;
  }

  // RULE 4 — any lead landing on "Not Interested" is closed out, never left callable.
  if (updates.interestLevel === 'Not Interested') {
    updates.status = 'Completed';
    updates.nextFollowUpDate = null;
  }

  // RULE 5 — consecutive no-answer streak, reset the moment a call connects.
  updates.noAnswerStreak = noAnswer ? (lead?.noAnswerStreak || 0) + 1 : 0;

  return updates;
}

/**
 * Whether the auto-brochure workflow should fire for this call.
 * Separated from decideLeadUpdates because it triggers a real outbound WhatsApp
 * message — a side effect that must be an explicit, independently testable decision.
 */
export function shouldSendAutoBrochure({ lead, noAnswerStreak, threshold, whatsappConfigured }) {
  if (!threshold || threshold <= 0) return false;   // disabled by default
  if (!whatsappConfigured) return false;            // can't send, don't pretend
  if (lead?.brochureSent) return false;             // never send twice
  if (isStickyLead(lead)) return false;             // respect do-not-contact
  return noAnswerStreak >= threshold;
}
