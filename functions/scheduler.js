// Autonomous follow-up dialer. OFF by default (see store.js DEFAULT_SETTINGS) —
// an admin must explicitly enable this from the app before it will place any real
// calls on its own. When enabled, it checks every few minutes for leads whose
// next follow-up date has arrived and dispatches a real Omnidimension call.
import { getLeads, getSettings, markDialedToday, updateLead, resolveOmnidimAgentId } from './store.js';
import { dispatchCall } from './omnidim.js';
import { pollOmnidimCallsOnce } from './callPoller.js';

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

export async function runFollowUpSweep(log = console.log) {
  const settings = await getSettings();
  if (!settings.autoDialEnabled) return { skipped: true, reason: 'autoDialEnabled is false' };
  const hasAnyAgent = settings.defaultAgentId || Object.values(settings.agentIdMap || {}).some(Boolean);
  if (!hasAnyAgent) return { skipped: true, reason: 'No Omnidimension agent IDs configured (default or per-agent)' };

  const leads = await getLeads();
  const due = leads.filter(l =>
    isFollowUpDue(l) &&
    !SKIP_STATUSES.has(l.status) &&
    !SKIP_INTEREST.has(l.interestLevel)
  );

  const results = [];
  for (const lead of due) {
    const agentId = resolveOmnidimAgentId(lead, settings);
    if (!agentId) {
      results.push({ leadId: lead.id, leadName: lead.name, ok: false, error: `No Omnidimension agent mapped for AIVA agent ${lead.agentId}` });
      log(`[AIVA scheduler] SKIPPED ${lead.name}: no Omnidimension agent mapped for ${lead.agentId}`);
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
        },
      });
      await markDialedToday(lead.id);
      await updateLead(lead.id, { status: 'In Call' });
      results.push({ leadId: lead.id, leadName: lead.name, ok: true, requestId: res.requestId });
      log(`[AIVA scheduler] Auto-dialed follow-up for ${lead.name} (${lead.phone}) — requestId ${res.requestId}`);
    } catch (e) {
      results.push({ leadId: lead.id, leadName: lead.name, ok: false, error: e.message });
      log(`[AIVA scheduler] FAILED to auto-dial ${lead.name}: ${e.message}`);
    }
  }
  return { skipped: false, checked: leads.length, due: due.length, results };
}

export function startScheduler(log = console.log) {
  log(`[AIVA scheduler] started — checking for due follow-ups every ${CHECK_INTERVAL_MS / 60000} minutes (autonomous dialing is OFF until enabled in Settings).`);
  log(`[AIVA scheduler] polling Omnidimension call logs every ${POLL_INTERVAL_MS / 60000} minutes to sync leads (no webhook is configured on the agents).`);
  const interval = setInterval(() => {
    runFollowUpSweep(log).catch(e => log('[AIVA scheduler] sweep error:', e.message));
  }, CHECK_INTERVAL_MS);
  const pollInterval = setInterval(() => {
    pollOmnidimCallsOnce(log).catch(e => log('[AIVA poller] poll error:', e.message));
  }, POLL_INTERVAL_MS);
  // Run one poll immediately on startup so recent calls sync without waiting for the first tick.
  pollOmnidimCallsOnce(log).catch(e => log('[AIVA poller] initial poll error:', e.message));
  return () => { clearInterval(interval); clearInterval(pollInterval); };
}
