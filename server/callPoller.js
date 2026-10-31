// Polls Omnidimension's call-logs API directly instead of relying on their webhook
// (the agents have no webhook configured, and there's no API to set one — see
// conversation history). This is what actually keeps leads in sync with real calls:
// runs on a timer locally, and can be triggered on-demand via POST /api/omnidim/poll-now.
import { listCallLogs } from './omnidim.js';
import { getLeads, getSettings, updateSettings, updateLead, addCallEvent, upsertLeadsByPhone, getPropertyConfig } from './store.js';
import { analyzeCallForLead } from './analyzeCall.js';
import { callLogToLead } from './importFromOmnidim.js';
import { isWhatsAppConfigured, sendBrochure } from './whatsappClient.js';
import { getContent } from './content.config.js';
import { computeEscalation } from './escalation.js';
import { mergeSalesBrain } from './salesBrain.js';
import { decideLeadUpdates, shouldSendAutoBrochure } from './callOutcomeRules.js';
import { runWhatsAppPropertySharing } from './propertySharing.js';
import { computeLeadScore, mergeBuyingSignals } from './leadScore.js';

const PAGE_SIZE = 50;
const MAX_PAGES = 5; // safety cap per run

// Same allowlist as importFromOmnidim.js — any bot NOT on this list must never
// touch a CRM lead (this Omnidimension account has other bots too). Vistara
// was added 2026-08-27 for a second real client (RK Developers) — confirmed
// with the user that Vistara is triggered ONLY through AIVA, never run
// independently elsewhere, so syncing its call activity here is safe. It is
// deliberately EXCLUDED from AGENT_ROSTER (server/app.js) so ordinary BMI
// Housing leads never get auto-assigned to it — only leads explicitly added
// with agentId 'agent_6' (RK Developers leads) go to Vistara.
const AGENT_NAME_TO_ID = [
  { match: 'kavya', agentId: 'agent_1' },
  { match: 'arjun', agentId: 'agent_2' },
  { match: 'ananya', agentId: 'agent_3' },
  { match: 'rohan', agentId: 'agent_4' },
  { match: 'priya', agentId: 'agent_5' },
  { match: 'vistara', agentId: 'agent_6' },
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
  const propertyConfigByProject = await getPropertyConfig();
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

      // All the do-not-call / retry / blacklist-protection rules live in one tested
      // module (server/callOutcomeRules.js) shared with app.js's webhook handler, so
      // the two paths can't drift apart. See its tests for the exact guarantees.
      analysis.suggestedUpdates = decideLeadUpdates({
        lead,
        callStatus: call.call_status,
        analysis,
      });
      const noAnswerStreak = analysis.suggestedUpdates.noAnswerStreak;

      // Auto-brochure workflow: only sends the SAME real brochure the manual WhatsApp
      // button sends — never a fabricated message. Guard conditions are tested.
      if (shouldSendAutoBrochure({
        lead,
        noAnswerStreak,
        threshold: settings.autoBrochureAfterNoAnswers || 0,
        whatsappConfigured: isWhatsAppConfigured(),
      })) {
        try {
          await sendBrochure(lead.phone, getContent());
          analysis.suggestedUpdates.brochureSent = true;
          log(`[AIVA workflow] Auto-sent brochure to ${lead.name} after ${noAnswerStreak} consecutive no-answers.`);
        } catch (e) {
          log(`[AIVA workflow] Auto-brochure failed for ${lead.name}: ${e.message}`);
        }
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
        // Evolution Engine attribution — snapshot which variant was actually
        // dispatched for THIS call, since the lead's state can change on later calls.
        scriptVariantId: lead.activeScriptVariantId || null,
        // Competitor Radar: real names the lead spoke this call, if any.
        competitorMentions: analysis.competitorMentions || [],
        analysis,
      });

      const mergedCompetitors = (analysis.competitorMentions || []).length
        ? [...new Set([...(lead.competitorMentions || []), ...analysis.competitorMentions])]
        : lead.competitorMentions;

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

      // Escalation (server/escalation.js): real post-call signals only — frustration
      // Gemini actually read off this transcript, and/or the lead's real budget
      // crossing the high-value threshold now that interest level may have changed.
      // Low-confidence handoff is NOT checked here — that's a pre-dial decision
      // (see scheduler.js), not something to apply after the call already happened.
      const escalation = computeEscalation({
        interestLevel: analysis.suggestedUpdates?.interestLevel ?? lead.interestLevel,
        budget: lead.budget,
        frustrationDetected: analysis.suggestedUpdates?.frustrationDetected,
        frustrationReason: analysis.frustrationReason,
        escalationSignals: analysis.escalationSignals,
        settings,
      });

      // AI Sales Brain (server/salesBrain.js): accumulate this call's real signals
      // (personality, buying style, family mentions, objections) onto the lead's
      // running memory instead of the generic suggestedUpdates spread overwriting
      // whatever a previous call already learned.
      const salesBrain = mergeSalesBrain(lead.salesBrain, analysis.salesBrainSignals);

      // Buying signals ACCUMULATE the same way (server/leadScore.js) — once a lead
      // has genuinely asked about EMI, that stays true across every future call.
      const buyingSignals = mergeBuyingSignals(lead.buyingSignals, analysis.buyingSignals);

      // Unified Lead Score (spec section 2) — computed on the prospective merged
      // state so it reflects what THIS call actually changed, not stale data.
      const leadScore = computeLeadScore({
        ...lead, ...(analysis.suggestedUpdates || {}), ...(escalation || {}), salesBrain, buyingSignals,
      });

      const updated = await updateLead(lead.id, {
        ...(analysis.suggestedUpdates || {}),
        lastContactTime: call.time_of_call,
        callDuration: `${call.call_duration_in_seconds || 0}s`,
        recordings: recordingUpdate,
        ...(mergedCompetitors ? { competitorMentions: mergedCompetitors } : {}),
        ...(escalation || {}),
        salesBrain,
        buyingSignals,
        leadScore,
        ...(analysis.siteVisitRequest ? { siteVisitRequest: analysis.siteVisitRequest } : {}),
      });
      if (escalation) log(`[AIVA escalation] ${lead.name} flagged (${escalation.escalationCategory}): ${escalation.escalationReason}`);

      // WhatsApp Property Sharing (server/propertySharing.js): real intent detected
      // on THIS transcript, sent with the freshly-merged lead (so it sees this
      // call's project/interest updates, and duplicate-prevention checks the
      // truly-current brochureSent/locationSent/imagesSent flags).
      let finalLead = updated;
      if (updated) {
        const waUpdates = await runWhatsAppPropertySharing({
          lead: updated, whatsappIntent: analysis.whatsappIntent, settings, propertyConfigByProject, log,
        });
        if (waUpdates) finalLead = await updateLead(updated.id, waUpdates);
      }
      if (finalLead) byPhone.set(normalizePhone(finalLead.phone), finalLead);

      processed.push({ callId: call.id, leadId: lead.id, leadName: lead.name, status: call.call_status });
      log(`[AIVA poller] synced call ${call.id} (${call.bot_name}) status=${call.call_status} -> lead ${lead.name}`);
  }

  if (maxIdThisRun > lastProcessedCallId) {
    await updateSettings({ lastProcessedCallId: maxIdThisRun });
  }
  return { checked: processed.length, processed, lastProcessedCallId: maxIdThisRun };
}
