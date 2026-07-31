// Picks the storage backend based on where this process is actually running:
//   - Deployed Cloud Function (production) → Firestore (persistent, correct)
//   - Local dev (npm run server)           → JSON files on disk (simple, fast)
// K_SERVICE / FUNCTION_TARGET are standard env vars Google Cloud sets automatically
// on deployed Cloud Functions / Cloud Run — never set on a plain local `node` process.
const isDeployed = !!(process.env.K_SERVICE || process.env.FUNCTION_TARGET);

const impl = isDeployed
  ? await import('./store.firestore.js')
  : await import('./store.local.js');

export const {
  getLeads,
  seedLeadsIfEmpty,
  clearLeads,
  upsertLeadsByPhone,
  updateLead,
  getLead,
  deleteLead,
  getCallEvents,
  addCallEvent,
  getSettings,
  updateSettings,
  markDialedToday,
  wasDialedToday,
} = impl;

// Resolve the correct Omnidimension agent ID for a given lead, using the lead's
// assigned AIVA agent first, falling back to the shared default agent.
// Pure/synchronous — doesn't touch storage, so it's the same regardless of backend.
export function resolveOmnidimAgentId(lead, settings) {
  const mapped = lead?.agentId ? settings.agentIdMap?.[lead.agentId] : null;
  return mapped || settings.defaultAgentId || null;
}
