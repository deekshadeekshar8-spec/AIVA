// Polls Omnidimension's call-logs API directly instead of relying on their webhook
// (the agents have no webhook configured, and there's no API to set one — see
// conversation history). This is what actually keeps leads in sync with real calls:
// runs on a timer locally, and can be triggered on-demand via POST /api/omnidim/poll-now.
import { listCallLogs } from './omnidim.js';
import { getLeads, getSettings, updateSettings, updateLead, addCallEvent, upsertLeadsByPhone } from './store.js';
import { analyzeCallForLead } from './analyzeCall.js';
import { callLogToLead } from './importFromOmnidim.js';

const NO_ANSWER_STATUSES = new Set(['no-answer', 'no_answer', 'not-answered', 'not_answered', 'busy', 'failed', 'missed', 'unanswered']);
const PAGE_SIZE = 50;
const MAX_PAGES = 5; // safety cap per run

// Same 5-agent allowlist as importFromOmnidim.js — Vistara and any other bot on this
// account must NEVER touch a CRM lead, per explicit scope agreed with the user.
const AGENT_NAME_TO_ID = [
  { match: 'kavya', agentId: 'agent_1' },
  { match: 'arjun', agentId: 'agent_2' },
  { match: 'ananya', agentId: 'agent_3' },
  { match: 'rohan', agentId: 'agent_4' },
  { match: 'priya', agentId: 'agent_5' },
];
function isMappedAgentBot(botName) {
  const lower = (botName || '').toLowerCase();
  return AGENT_NAME_TO_ID.some(a => lower.includes(a.match));
}

function normalizePhone(p) {
  return String(p || '').replace(/\D/g, '').slice(-10);
}

function callToWebhookShape(call) {
  return {
    call_status: call.call_status,
    call_context: {},
    call_duration: call.call_duration_in_seconds || 0,
    recording_url: call.internal_recording_url || call.recording_url || null,
    call_report: {
      full_conversation: (call.call_conversation || '').replace(/<br\s*\/?>/gi, '\n'),
      summary: call.sentiment_analysis_details || '',
      sentiment: call.sentiment_score || '',
      extracted_variables: call.extracted_variables || {},
    },
  };
}

export async function pollOmnidimCallsOnce(log = console.log) {
  const settings = await getSettings();
  const lastProcessedCallId = settings.lastProcessedCallId || 0;
  const leads = await getLeads();
  const byPhone = new Map(leads.map(l => [normalizePhone(l.phone), l]));

  // Omnidimension returns calls newest-first. Collect everything new across pages
  // first, THEN sort ascending by id before applying updates — otherwise, when a
  // lead was called more than once today, an OLDER attempt (processed later in a
  // newest-first loop) would overwrite the outcome of a MORE RECENT, correct one.
  // That bug previously left leads with real completed conversations mislabeled
  // "Not Reachable" because a stale earlier no-answer got applied last.
  const newRows = [];
  let maxIdThisRun = lastProcessedCallId;
  let pageno = 1;
  let stop = false;

  while (!stop && pageno <= MAX_PAGES) {
    const res = await listCallLogs({ pageno, pagesize: PAGE_SIZE });
    const rows = res.call_log_data || [];
    if (rows.length === 0) break;

    for (const call of rows) {
      if (call.id <= lastProcessedCallId) { stop = true; break; } // newest-first list; hit already-seen calls
      if (call.id > maxIdThisRun) maxIdThisRun = call.id; // track cursor even for skipped calls, so we don't re-scan them forever
      if (!isMappedAgentBot(call.bot_name)) continue; // Vistara etc. must never touch a lead
      newRows.push(call);
    }
    pageno++;
  }

  newRows.sort((a, b) => a.id - b.id); // oldest first, so the most recent call per lead wins

  const processed = [];
  for (const call of newRows) {
      const webhookPayload = callToWebhookShape(call);
      let lead = byPhone.get(normalizePhone(call.to_number));

      if (!lead) {
        // Not an existing lead — create one the same way the initial import did
        // (skips calls outside today; agent check above already covers Vistara).
        const newLead = callLogToLead(call);
        if (!newLead) continue;
        lead = newLead;
        byPhone.set(normalizePhone(lead.phone), lead);
        await upsertLeadsByPhone([lead]);
      }

      const analysis = await analyzeCallForLead(webhookPayload, lead);

      // The call actually connected but the transcript was too ambiguous for Gemini to
      // extract a confident interest level — per the client's explicit rule, "picked up
      // but no real engagement" means Not Interested and we stop calling them, not a
      // vague "Warm Lead" that would keep them in the retry pool.
      if (!NO_ANSWER_STATUSES.has(String(call.call_status || '').toLowerCase())
        && !analysis.suggestedUpdates?.interestLevel) {
        analysis.suggestedUpdates = { ...analysis.suggestedUpdates, interestLevel: 'Not Interested', status: 'Completed' };
      }

      // "Not Interested" / "Wrong Number" are sticky — once a lead has explicitly said
      // don't contact them again (or the number is wrong), a LATER unrelated no-answer
      // attempt must never overwrite that back to a re-dialable state. Without this
      // guard, a lead who said "stop calling me" could get auto-retried forever the
      // next time a call to them happened to go unanswered.
      const isSticky = lead.interestLevel === 'Not Interested' || lead.interestLevel === 'Wrong Number';
      if (NO_ANSWER_STATUSES.has(String(call.call_status || '').toLowerCase()) && !isSticky) {
        analysis.suggestedUpdates = {
          ...analysis.suggestedUpdates,
          interestLevel: 'Not Reachable',
          status: 'Outgoing Retry',
          nextFollowUpDate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          remarks: 'Call not picked up — auto-retry scheduled in 4 hours.',
        };
      }

      await addCallEvent({
        id: `call_${call.id}`,
        receivedAt: new Date().toISOString(),
        leadId: lead.id,
        leadName: lead.name,
        callStatus: call.call_status,
        recordingUrl: webhookPayload.recording_url,
        durationSeconds: call.call_duration_in_seconds || 0,
        summary: webhookPayload.call_report.summary,
        sentiment: webhookPayload.call_report.sentiment,
        analysis,
      });

      const recordingUpdate = webhookPayload.recording_url
        ? [
            ...(lead.recordings || []).filter(r => r.id !== String(call.id)),
            {
              id: String(call.id),
              date: call.time_of_call,
              duration: `${call.call_duration_in_seconds || 0}s`,
              summary: webhookPayload.call_report.summary,
              url: webhookPayload.recording_url,
              transcript: webhookPayload.call_report.full_conversation,
            },
          ]
        : lead.recordings || [];

      const updated = await updateLead(lead.id, {
        ...(analysis.suggestedUpdates || {}),
        lastContactTime: call.time_of_call,
        callDuration: `${call.call_duration_in_seconds || 0}s`,
        recordings: recordingUpdate,
      });
      if (updated) byPhone.set(normalizePhone(updated.phone), updated);

      processed.push({ callId: call.id, leadId: lead.id, leadName: lead.name, status: call.call_status });
      log(`[AIVA poller] synced call ${call.id} (${call.bot_name}) status=${call.call_status} -> lead ${lead.name}`);
  }

  if (maxIdThisRun > lastProcessedCallId) {
    await updateSettings({ lastProcessedCallId: maxIdThisRun });
  }
  return { checked: processed.length, processed, lastProcessedCallId: maxIdThisRun };
}
