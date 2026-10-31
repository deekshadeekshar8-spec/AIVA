// AIVA Vision — a merged, time-sorted feed of real events already stored
// elsewhere (call events, per-lead WhatsApp activity, inbound WhatsApp replies).
// Nothing here is generated for this feature; it's a real-time READ over data
// that already exists. Pure function, no I/O, same testing pattern as
// callOutcomeRules.js.

const CALL_STATUS_ICON = { completed: '📞', 'no-answer': '📵', busy: '📵', failed: '📵' };

export function buildLiveFeed({ leads = [], callEvents = [], inboundMessages = [] }, limit = 30) {
  const events = [];

  for (const e of callEvents) {
    events.push({
      id: `call_${e.id}`,
      timestamp: e.receivedAt,
      icon: CALL_STATUS_ICON[String(e.callStatus || '').toLowerCase()] || '📞',
      text: `${e.leadName || 'Unknown'}: call ${e.callStatus || 'completed'}${e.summary ? ` — ${e.summary}` : ''}`,
      leadId: e.leadId,
    });
  }

  for (const lead of leads) {
    for (const activity of lead.whatsappActivity || []) {
      const ICON = { brochure: '📄', location: '📍', images: '📸', followup: '📅', reply: '💬', config: '⚙️' };
      events.push({
        id: `wa_${activity.id}`,
        timestamp: activity.timestamp,
        icon: activity.success ? (ICON[activity.type] || '💬') : '⚠️',
        text: `${lead.name}: ${activity.detail}`,
        leadId: lead.id,
      });
    }
  }

  for (const msg of inboundMessages) {
    events.push({
      id: `inbound_${msg.id}`,
      timestamp: msg.receivedAt,
      icon: '💬',
      text: `${msg.contactName || msg.from}: "${msg.text}"`,
      leadId: null,
    });
  }

  return events
    .filter(e => e.timestamp && !Number.isNaN(Date.parse(e.timestamp)))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, limit);
}
