// Autonomous follow-up dialer. OFF by default (see store.js DEFAULT_SETTINGS) —
// an admin must explicitly enable this from the app before it will place any real
// calls on its own. When enabled, it checks every few minutes for leads whose
// next follow-up date has arrived and dispatches a real Omnidimension call.
import { getLeads, getSettings, markDialedToday, updateLead, resolveOmnidimAgentId, getScriptVariants } from './store.js';
import { dispatchCall } from './omnidim.js';
import { pollOmnidimCallsOnce } from './callPoller.js';
import { generateLeadIntelligence } from './leadIntelligence.js';
import { pickVariantForAgent } from './scriptVariants.js';
import { computeEscalation } from './escalation.js';
import { buildSalesBrainBriefing } from './salesBrain.js';
import { sendFollowUpCheckIn } from './propertySharing.js';
import { isWithinCallWindow, formatCallWindow } from './callWindow.js';
import { AUTODIAL_ELIGIBLE_INTEREST_LEVELS } from './callOutcomeRules.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const POLL_INTERVAL_MS = 3 * 60 * 1000; // every 3 minutes — syncing call results is not a dialing action, always on

function isFollowUpDue(lead) {
  if (!lead.nextFollowUpDate) return false;
  const due = Date.parse(lead.nextFollowUpDate);
  if (Number.isNaN(due)) return false;
  return due <= Date.now();
}

// Statuses that should never be auto-dialed again (already closed out one way or another,
// or a call to this lead is already in flight — 'In Call' is cleared by the webhook once
// that call finishes, so this also acts as the re-dial debounce instead of a once-a-day gate).
const SKIP_STATUSES = new Set(['Handed Over', 'Completed', 'In Call']);
const SKIP_INTEREST = new Set(['Not Interested', 'Wrong Number']);

// Detects Omnidimension's "too many simultaneous calls" rejection. Matched on the
// error body rather than a status code because their API returns it as a JSON
// error payload, not a distinct HTTP status.
export function isConcurrencyLimit(err) {
  return /concurrency_limit_exceeded|concurrency limit/i.test(String(err?.message || '') + String(err?.code || ''));
}

export async function runFollowUpSweep(log = console.log) {
  const settings = await getSettings();
  if (!settings.autoDialEnabled) return { skipped: true, reason: 'autoDialEnabled is false' };
  // Calling-hours guard (server/callWindow.js) — real leads are never dialed
  // outside the configured window (default 11:00 AM–7:30 PM IST), computed in
  // real IST regardless of what timezone this process itself runs in.
  if (!isWithinCallWindow(new Date(), settings)) {
    return { skipped: true, reason: `outside calling hours (${formatCallWindow(settings)})` };
  }
  const hasAnyAgent = settings.defaultAgentId || Object.values(settings.agentIdMap || {}).some(Boolean);
  if (!hasAnyAgent) return { skipped: true, reason: 'No Omnidimension agent IDs configured (default or per-agent)' };

  const leads = await getLeads();
  // Autonomous dialing is scoped to genuinely engaged leads only, per explicit
  // client rule (2026-08-17, widened 2026-08-20): a large stale "Not Reachable"
  // backlog exists from an old campaign, and it must never get mass-auto-dialed
  // just because autoDial is on. Interested/Hot Lead/Call Later leads (see
  // AUTODIAL_ELIGIBLE_INTEREST_LEVELS in callOutcomeRules.js — anyone who showed
  // real engagement or explicitly asked for a callback) are eligible; cold
  // no-answer retries and anything sticky still require a human or an explicit
  // manual dial to re-attempt.
  const due = leads.filter(l =>
    isFollowUpDue(l) &&
    !SKIP_STATUSES.has(l.status) &&
    !SKIP_INTEREST.has(l.interestLevel) &&
    AUTODIAL_ELIGIBLE_INTEREST_LEVELS.has(l.interestLevel) &&
    !l.escalated // flagged for a human — never auto-dialed until a rep resolves it
  );

  const allVariants = await getScriptVariants();
  const results = [];
  for (const lead of due) {
    const agentId = resolveOmnidimAgentId(lead, settings);
    if (!agentId) {
      results.push({ leadId: lead.id, leadName: lead.name, ok: false, error: `No Omnidimension agent mapped for AIVA agent ${lead.agentId}` });
      log(`[AIVA scheduler] SKIPPED ${lead.name}: no Omnidimension agent mapped for ${lead.agentId}`);
      continue;
    }
    const variant = pickVariantForAgent(allVariants, lead.agentId);
    let strategy = variant || lead.callStrategy;
    let confidence = lead.leadIntelligence?.confidence;
    if (!strategy) {
      const research = await generateLeadIntelligence(lead);
      if (research.ok) {
        strategy = research.callStrategy;
        confidence = research.leadIntelligence.confidence;
        await updateLead(lead.id, { leadIntelligence: research.leadIntelligence, callStrategy: research.callStrategy, recommendation: research.recommendation });
      }
    }

    // Fallback-to-human handoff (server/escalation.js): if AIVA doesn't actually
    // know enough about this lead to dial them well, don't dial blind — flag for
    // a human and move on. This is the one place confidence is checked pre-dial.
    const escalation = computeEscalation({ interestLevel: lead.interestLevel, budget: lead.budget, confidence, settings });
    if (escalation) {
      await updateLead(lead.id, escalation);
      results.push({ leadId: lead.id, leadName: lead.name, ok: false, error: `Skipped — escalated for human review (${escalation.escalationCategory})` });
      log(`[AIVA scheduler] Escalated ${lead.name} instead of auto-dialing: ${escalation.escalationReason}`);
      continue;
    }

    try {
      const res = await dispatchCall({
        agentId,
        toNumber: lead.phone,
        fromNumberId: settings.fromNumberId,
        callContext: {
          lead_id: lead.id,
          lead_name: lead.name,
          project: lead.project,
          budget: lead.budget,
          interest_level: lead.interestLevel,
          reason: 'scheduled_follow_up',
          ...(strategy ? {
            call_opening_style: strategy.openingStyle,
            call_main_focus: strategy.mainFocus,
            call_avoid: strategy.avoid,
            call_goal: strategy.goal,
            ...(strategy.negotiationApproach ? { call_negotiation_approach: strategy.negotiationApproach } : {}),
          } : {}),
          ...(variant ? { script_variant_id: variant.id } : {}),
          ...(lead.salesBrain?.callCount ? { sales_brain_briefing: buildSalesBrainBriefing(lead) } : {}),
          ...(lead.recommendation ? { call_recommended_project: lead.recommendation.recommendedProject, call_recommendation_reason: lead.recommendation.reason } : {}),
        },
      });
      await markDialedToday(lead.id);
      await updateLead(lead.id, { status: 'In Call', activeScriptVariantId: variant?.id || null });
      results.push({ leadId: lead.id, leadName: lead.name, ok: true, requestId: res.requestId });
      log(`[AIVA scheduler] Auto-dialed follow-up for ${lead.name} (${lead.phone}) — requestId ${res.requestId}`);
    } catch (e) {
      results.push({ leadId: lead.id, leadName: lead.name, ok: false, error: e.message });
      log(`[AIVA scheduler] FAILED to auto-dial ${lead.name}: ${e.message}`);

      // Omnidimension allows only a limited number of simultaneous calls. Once that
      // ceiling is hit, EVERY remaining lead in this sweep will fail the same way —
      // continuing would fire hundreds of doomed requests at their API every 5
      // minutes (real incident 2026-10-08: a 5-lead batch returned 1 success and 4
      // `concurrency_limit_exceeded`). Stop here; the next sweep picks up where we
      // left off, and the leads are untouched so nothing is lost.
      if (isConcurrencyLimit(e)) {
        log(`[AIVA scheduler] Concurrency limit reached — pausing this sweep after ${results.filter(r => r.ok).length} call(s). Remaining leads retry next sweep.`);
        return { skipped: false, checked: leads.length, due: due.length, results, stoppedEarly: 'concurrency_limit' };
      }
    }
  }
  return { skipped: false, checked: leads.length, due: due.length, results };
}

function isWhatsAppFollowUpDue(lead) {
  if (!lead.whatsappFollowUpDueAt) return false;
  const due = Date.parse(lead.whatsappFollowUpDueAt);
  if (Number.isNaN(due)) return false;
  return due <= Date.now();
}

// Smart follow-up (spec section 5): a real WhatsApp check-in text sent to leads
// who received property details but never replied. Gated on the SAME
// whatsappAutoShareEnabled toggle as the initial auto-share — this only ever
// SKIPS if disabled, never sends without the admin having opted in.
export async function runWhatsAppFollowUpSweep(log = console.log) {
  const settings = await getSettings();
  if (!settings.whatsappAutoShareEnabled) return { skipped: true, reason: 'whatsappAutoShareEnabled is false' };

  const leads = await getLeads();
  const due = leads.filter(l =>
    isWhatsAppFollowUpDue(l) &&
    !SKIP_STATUSES.has(l.status) &&
    !SKIP_INTEREST.has(l.interestLevel) &&
    !l.escalated
  );

  const maxAttempts = settings.whatsappFollowUpMaxAttempts ?? 1;
  const delayMs = (settings.whatsappFollowUpDelayHours ?? 3) * 60 * 60 * 1000;
  const results = [];
  for (const lead of due) {
    const attempts = lead.whatsappFollowUpAttempts || 0;
    if (attempts >= maxAttempts) {
      // Attempts exhausted — stop nudging a non-responder rather than looping forever.
      await updateLead(lead.id, { whatsappFollowUpDueAt: null });
      continue;
    }
    try {
      const text = await sendFollowUpCheckIn(lead);
      const priorActivity = Array.isArray(lead.whatsappActivity) ? lead.whatsappActivity : [];
      const entry = {
        id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'followup', detail: `Follow-up check-in sent: "${text}"`, timestamp: new Date().toISOString(), success: true,
      };
      const nextAttempts = attempts + 1;
      await updateLead(lead.id, {
        whatsappFollowUpAttempts: nextAttempts,
        whatsappFollowUpDueAt: nextAttempts < maxAttempts ? new Date(Date.now() + delayMs).toISOString() : null,
        whatsappActivity: [...priorActivity, entry].slice(-30),
      });
      results.push({ leadId: lead.id, leadName: lead.name, ok: true });
      log(`[AIVA WhatsApp follow-up] Sent check-in to ${lead.name}.`);
    } catch (e) {
      results.push({ leadId: lead.id, leadName: lead.name, ok: false, error: e.message });
      log(`[AIVA WhatsApp follow-up] FAILED for ${lead.name}: ${e.message}`);
    }
  }
  return { skipped: false, checked: leads.length, due: due.length, results };
}

export function startScheduler(log = console.log) {
  log(`[AIVA scheduler] started — checking for due follow-ups every ${CHECK_INTERVAL_MS / 60000} minutes (autonomous dialing only fires within the configured calling window, default ${formatCallWindow({})}).`);
  log(`[AIVA scheduler] polling Omnidimension call logs every ${POLL_INTERVAL_MS / 60000} minutes to sync leads (no webhook is configured on the agents).`);
  const interval = setInterval(() => {
    runFollowUpSweep(log).catch(e => log('[AIVA scheduler] sweep error:', e.message));
    runWhatsAppFollowUpSweep(log).catch(e => log('[AIVA WhatsApp follow-up] sweep error:', e.message));
  }, CHECK_INTERVAL_MS);
  const pollInterval = setInterval(() => {
    pollOmnidimCallsOnce(log).catch(e => log('[AIVA poller] poll error:', e.message));
  }, POLL_INTERVAL_MS);
  // Run one poll immediately on startup so recent calls sync without waiting for the first tick.
  pollOmnidimCallsOnce(log).catch(e => log('[AIVA poller] initial poll error:', e.message));
  return () => { clearInterval(interval); clearInterval(pollInterval); };
}
