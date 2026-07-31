// Omnidimension (omnidim.io) API client — real endpoints, per their published OpenAPI spec.
// Docs: https://docs.omnidim.io  |  Base URL: https://omnidim.io/api/v1

const BASE_URL = 'https://omnidim.io/api/v1';

function getApiKey() {
  return process.env.OMNIDIM_API_KEY || '';
}

async function omnidimFetch(path, options = {}) {
  const key = getApiKey();
  if (!key) {
    const err = new Error('Omnidimension is not configured. Set OMNIDIM_API_KEY in .env.local.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `Omnidimension API returned ${res.status}`;
    const err = new Error(msg);
    err.code = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

// POST /calls/dispatch
export async function dispatchCall({ agentId, toNumber, fromNumberId, callContext }) {
  if (!agentId) throw new Error('agentId is required to dispatch a call.');
  if (!toNumber) throw new Error('toNumber is required to dispatch a call.');
  const body = {
    agent_id: Number(agentId),
    to_number: toNumber,
    ...(fromNumberId ? { from_number_id: Number(fromNumberId) } : {}),
    ...(callContext ? { call_context: callContext } : {}),
  };
  return omnidimFetch('/calls/dispatch', { method: 'POST', body: JSON.stringify(body) });
}

// GET /calls/logs
export async function listCallLogs({ pageno = 1, pagesize = 30, agentid, call_status, bulk_call_id } = {}) {
  const params = new URLSearchParams({ pageno: String(pageno), pagesize: String(pagesize) });
  if (agentid) params.set('agentid', String(agentid));
  if (call_status) params.set('call_status', call_status);
  if (bulk_call_id) params.set('bulk_call_id', String(bulk_call_id));
  return omnidimFetch(`/calls/logs?${params.toString()}`, { method: 'GET' });
}

export async function listAgents() {
  return omnidimFetch('/agents', { method: 'GET' });
}
