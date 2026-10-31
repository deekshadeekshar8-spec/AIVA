// Converts real Omnidimension call log entries into CRM Lead records.
// Only calls from today, and only from the 5 mapped AIVA agents, are considered —
// per explicit scope agreed with the user (this account has 15k+ historical records).

// Vistara added 2026-08-27 for RK Developers — see server/callPoller.js for
// the full rationale (confirmed used only through AIVA, never independently).
const AGENT_NAME_TO_ID = [
  { match: 'kavya', agentId: 'agent_1' },
  { match: 'arjun', agentId: 'agent_2' },
  { match: 'ananya', agentId: 'agent_3' },
  { match: 'rohan', agentId: 'agent_4' },
  { match: 'priya', agentId: 'agent_5' },
  { match: 'vistara', agentId: 'agent_6' },
];

function resolveAgentIdFromBotName(botName) {
  const lower = (botName || '').toLowerCase();
  const hit = AGENT_NAME_TO_ID.find(a => lower.includes(a.match));
  return hit ? hit.agentId : null;
}

function isToday(timeOfCall) {
  // Omnidimension format: "MM/DD/YYYY HH:mm:ss"
  if (!timeOfCall) return false;
  const [datePart] = timeOfCall.split(' ');
  const [mm, dd, yyyy] = (datePart || '').split('/');
  if (!mm || !dd || !yyyy) return false;
  const now = new Date();
  return parseInt(mm, 10) === now.getMonth() + 1 && parseInt(dd, 10) === now.getDate() && parseInt(yyyy, 10) === now.getFullYear();
}

function statusFromCallStatus(callStatus) {
  switch (callStatus) {
    case 'completed': return 'Contacted';
    case 'busy': return 'Outgoing Retry';
    case 'no-answer': return 'Pending';
    case 'failed': return 'Pending';
    default: return 'Pending';
  }
}

function interestFromSentiment(sentiment) {
  switch (sentiment) {
    case 'Positive': return 'Interested';
    case 'Negative': return 'Not Interested';
    case 'Neutral': return 'Warm Lead';
    default: return 'Cold Lead'; // no sentiment usually means no-answer/failed
  }
}

function formatDuration(seconds) {
  const s = seconds || 0;
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

// Convert an Omnidimension call-log row into a Lead. Returns null if it should be skipped
// (wrong day, or not one of the 5 mapped agents).
export function callLogToLead(call) {
  if (!isToday(call.time_of_call)) return null;
  const agentId = resolveAgentIdFromBotName(call.bot_name);
  if (!agentId) return null;

  const extracted = call.extracted_variables || {};
  const projectInterest = extracted.project_interest && extracted.project_interest !== 'Not provided'
    ? extracted.project_interest
    : 'Unspecified (from Omnidimension call)';

  // NOTE: call.user_name is Omnidimension account/org-level metadata (e.g. "rk developers"),
  // NOT the customer's name — never use it here. The real lead name, if captured at all,
  // lives in extracted_variables (varies by agent's configured variable key).
  const extractedName = extracted.lead_name || extracted.customer_name || extracted.name;
  const leadName = (extractedName && !/^(na|not provided|unknown)$/i.test(String(extractedName).trim()))
    ? extractedName
    : `Lead ${call.to_number}`;

  return {
    id: `omnidim_call_${call.id}`,
    name: leadName,
    phone: call.to_number,
    source: 'API',
    project: projectInterest,
    dateTime: call.time_of_call,
    agentId,
    status: statusFromCallStatus(call.call_status),
    interestLevel: interestFromSentiment(call.sentiment_score),
    budget: 0,
    location: '',
    remarks: call.sentiment_analysis_details || call.call_report?.summary || `Omnidimension call — status: ${call.call_status}.`,
    nextFollowUpDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
    timeline: 'Immediate',
    whatsappSent: false,
    brochureSent: false,
    priceSheetSent: false,
    siteVisitScheduled: '',
    callDuration: formatDuration(call.call_duration_in_seconds),
    lastContactTime: call.time_of_call,
    recordings: call.recording_url ? [{
      id: String(call.id),
      date: call.time_of_call,
      duration: formatDuration(call.call_duration_in_seconds),
      summary: call.sentiment_analysis_details || call.call_report?.summary || '',
      // Full absolute URL straight from Omnidimension — kept server-side in the lead
      // record; the frontend never fetches this directly, it goes through our proxy
      // endpoint (/api/omnidim/recording-proxy) so playback stays consistent with
      // how every other third-party credential in this app is handled.
      url: call.internal_recording_url || call.recording_url || undefined,
      transcript: (call.call_conversation || '').replace(/<br\s*\/?>/gi, '\n').trim(),
    }] : [],
  };
}

export function callLogsToLeads(calls) {
  const leads = [];
  for (const call of calls) {
    const lead = callLogToLead(call);
    if (lead) leads.push(lead);
  }
  return leads;
}
