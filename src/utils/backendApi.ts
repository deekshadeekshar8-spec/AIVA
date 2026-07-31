// Frontend client for the AIVA backend (server/index.js) — leads persistence
// and Omnidimension real-call integration. The frontend never talks to
// Omnidimension directly; the backend holds that API key.
import { Lead } from '../types';
import { ensureAuthHeader, clearStoredAuth } from './backendAuth';

// IMPORTANT: use `!== undefined`, not `||` — an intentionally EMPTY string in
// production (same-origin relative /api/** paths, routed by firebase.json) is
// falsy, so `||` would wrongly override it back to the localhost dev default.
const _rawBackendUrl = (import.meta as any).env?.VITE_WHATSAPP_BACKEND_URL;
const BACKEND_URL = _rawBackendUrl !== undefined ? _rawBackendUrl : 'http://localhost:8787';

async function jsonFetch(path: string, options?: RequestInit) {
  const doFetch = async () => {
    const auth = ensureAuthHeader();
    return fetch(`${BACKEND_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        // Custom header, NOT `Authorization` — Firebase Hosting -> Cloud Functions
        // intercepts the standard Authorization header as a Google IAM credential.
        ...(auth ? { 'X-Aiva-Auth': auth } : {}),
      },
      ...options,
    });
  };

  try {
    let res = await doFetch();
    if (res.status === 401) {
      // Stored credentials were wrong/stale — drop them and prompt again once.
      clearStoredAuth();
      res = await doFetch();
    }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false, status: res.status, data };
  } catch (e: any) {
    // Network failure, CORS block, dialog prompt failure, etc. — never let this
    // throw uncaught; callers all handle a clean {ok:false} shape instead.
    return { ok: false, status: 0, data: { error: e?.message || 'Network error' } };
  }
}

// Builds a playable URL for an Omnidimension call recording, routed through our
// backend proxy so the frontend never talks to omnidim.io directly. Includes the
// admin credential as a query param since <audio src> can't send custom headers.
export function getRecordingProxyUrl(omnidimRecordingUrl: string): string {
  const auth = ensureAuthHeader();
  const authQS = auth ? `&auth=${encodeURIComponent(auth)}` : '';
  return `${BACKEND_URL}/api/omnidim/recording-proxy?src=${encodeURIComponent(omnidimRecordingUrl)}${authQS}`;
}

// ---- Leads persistence ----
export async function fetchBackendLeads(): Promise<Lead[] | null> {
  const { ok, data } = await jsonFetch('/api/leads');
  return ok ? data.leads : null;
}

export async function seedBackendLeads(leads: Lead[]): Promise<Lead[] | null> {
  const { ok, data } = await jsonFetch('/api/leads/seed', { method: 'POST', body: JSON.stringify({ leads }) });
  return ok ? data.leads : null;
}

// Manually add ONE real lead — persists to the backend immediately, unlike the old
// local-only "Add Lead" flow which vanished on refresh and never actually existed
// anywhere but the browser tab.
export async function createBackendLead(lead: Partial<Lead>): Promise<Lead | null> {
  const { ok, data } = await jsonFetch('/api/leads', { method: 'POST', body: JSON.stringify(lead) });
  return ok ? data.lead : null;
}

export async function patchBackendLead(id: string, updates: Partial<Lead>): Promise<boolean> {
  const { ok } = await jsonFetch(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  return ok;
}

export async function deleteBackendLead(id: string): Promise<boolean> {
  const { ok } = await jsonFetch(`/api/leads/${id}`, { method: 'DELETE' });
  return ok;
}

export async function clearBackendLeads(): Promise<boolean> {
  const { ok } = await jsonFetch('/api/leads', { method: 'DELETE' });
  return ok;
}

// ---- Omnidimension ----
export interface OmnidimSettings {
  autoDialEnabled: boolean;
  defaultAgentId: number | null;
  agentIdMap: Record<string, number | null>; // AIVA agent id (agent_1..agent_5) -> Omnidimension agent id
  fromNumberId: number | null;
}

export interface CallEvent {
  id: string;
  receivedAt: string;
  leadId: string | null;
  leadName: string;
  callStatus: string;
  recordingUrl: string | null;
  durationSeconds: number;
  summary: string;
  sentiment: string;
  analysis: { analyzed: boolean; reason?: string; suggestedUpdates?: Record<string, any> };
}

export async function getOmnidimHealth(): Promise<{ configured: boolean; geminiAnalysisConfigured: boolean } | null> {
  const { ok, data } = await jsonFetch('/api/omnidim/health');
  return ok ? { configured: data.configured, geminiAnalysisConfigured: data.geminiAnalysisConfigured } : null;
}

export async function getOmnidimSettings(): Promise<OmnidimSettings | null> {
  const { ok, data } = await jsonFetch('/api/omnidim/settings');
  return ok ? data.settings : null;
}

export async function updateOmnidimSettings(updates: Partial<OmnidimSettings>): Promise<OmnidimSettings | null> {
  const { ok, data } = await jsonFetch('/api/omnidim/settings', { method: 'POST', body: JSON.stringify(updates) });
  return ok ? data.settings : null;
}

export async function getCallEvents(): Promise<CallEvent[]> {
  const { ok, data } = await jsonFetch('/api/omnidim/call-events');
  return ok ? data.events : [];
}

export async function callLeadViaOmnidim(leadId: string): Promise<{ ok: boolean; error?: string; requestId?: number }> {
  const { ok, data } = await jsonFetch('/api/omnidim/call', { method: 'POST', body: JSON.stringify({ leadId }) });
  return ok ? { ok: true, requestId: data.requestId } : { ok: false, error: data.error || 'Request failed' };
}
