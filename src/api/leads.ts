// Real CRM data layer — talks to the actual AIVA backend (server/app.js).
// Unlike src/data/demo.ts, everything here is live: real leads, real calls,
// real WhatsApp sends. No fabricated numbers, no scripted responses.
import { api } from './client';
import type { Lead } from './types';

export async function getLeads(): Promise<Lead[]> {
  const res = await api.get<{ ok: boolean; leads: Lead[] }>('/api/leads');
  return res.leads;
}

/** The backend has no single-lead GET route — fetch the full list and find it there. */
export async function getLead(id: string): Promise<Lead | null> {
  const leads = await getLeads();
  return leads.find((l) => l.id === id) ?? null;
}

export interface NewLeadInput {
  name: string;
  phone: string;
  project?: string;
  agentId?: string;
  source?: string;
  budget?: number;
  location?: string;
  remarks?: string;
}

export async function createLead(lead: NewLeadInput): Promise<{ ok: boolean; lead?: Lead; added?: boolean; error?: string }> {
  try {
    const res = await api.post<{ ok: boolean; lead: Lead; added: boolean }>('/api/leads', lead);
    return { ok: true, lead: res.lead, added: res.added };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to add lead.' };
  }
}

export async function patchLead(id: string, updates: Partial<Lead>): Promise<boolean> {
  try {
    await api.patch(`/api/leads/${id}`, updates);
    return true;
  } catch {
    return false;
  }
}

export async function deleteLead(id: string): Promise<boolean> {
  try {
    await api.del(`/api/leads/${id}`);
    return true;
  } catch {
    return false;
  }
}

/** Dispatches a real outbound call via Omnidimension. Respects the server's calling-window check. */
export async function callLead(leadId: string): Promise<{ ok: boolean; requestId?: number; error?: string }> {
  try {
    const res = await api.post<{ ok: boolean; requestId: number }>('/api/omnidim/call', { leadId });
    return { ok: true, requestId: res.requestId };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Call request failed.' };
  }
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
}

export async function getCallEvents(): Promise<CallEvent[]> {
  const res = await api.get<{ ok: boolean; events: CallEvent[] }>('/api/omnidim/call-events');
  return res.events;
}

/** Sends the standard property-details message (text + brochure + maps link) to one lead over WhatsApp. */
export async function sendWhatsAppDetails(leadId: string, project?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.post(`/api/leads/${leadId}/whatsapp/send`, {
      project,
      sendMessage: true,
      sendBrochure: true,
      sendMapsLink: true,
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'WhatsApp send failed.' };
  }
}

/** Re-runs AI Sales Employee pre-call research (lead intelligence + call strategy) for one lead. */
export async function researchLead(id: string): Promise<Lead | null> {
  try {
    const res = await api.post<{ ok: boolean; lead: Lead }>(`/api/leads/${id}/research`);
    return res.lead;
  } catch {
    return null;
  }
}

export interface PropertyImage {
  url: string;
  caption: string;
  category: string;
}

export interface PropertyDocument {
  mediaId: string;
  filename: string;
  caption: string;
}

export interface WhatsAppComposePreview {
  lead: { id: string; name: string; phone: string };
  phoneValid: boolean;
  whatsappConfigured: boolean;
  project: string | null;
  availableProjects: string[];
  message: string;
  brochureAvailable: boolean;
  locationAvailable: boolean;
  mapsLink: string | null;
  images: PropertyImage[];
  additionalDocuments: PropertyDocument[];
}

export async function getWhatsAppComposePreview(leadId: string, project?: string): Promise<WhatsAppComposePreview | null> {
  try {
    const qs = project ? `?project=${encodeURIComponent(project)}` : '';
    return await api.get<WhatsAppComposePreview>(`/api/leads/${leadId}/whatsapp/compose${qs}`);
  } catch {
    return null;
  }
}

export interface WhatsAppSendOptions {
  project?: string;
  message?: string;
  sendMessage?: boolean;
  sendBrochure?: boolean;
  sendLocation?: boolean;
  sendMapsLink?: boolean;
  sendImages?: boolean;
}

export interface WhatsAppSendItemResult {
  type: string;
  ok: boolean;
  error?: string;
  messageId?: string;
  sentCount?: number;
  requested?: number;
}

export async function sendWhatsAppCompose(leadId: string, options: WhatsAppSendOptions): Promise<{ ok: boolean; results?: WhatsAppSendItemResult[]; lead?: Lead; error?: string }> {
  try {
    const res = await api.post<{ ok: boolean; results: WhatsAppSendItemResult[]; lead: Lead }>(`/api/leads/${leadId}/whatsapp/send`, options);
    return { ok: true, results: res.results, lead: res.lead };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'WhatsApp send failed.' };
  }
}

export async function retryWhatsAppSend(leadId: string, activityId: string): Promise<{ ok: boolean; lead?: Lead; error?: string }> {
  try {
    const res = await api.post<{ ok: boolean; lead: Lead }>(`/api/leads/${leadId}/whatsapp/retry`, { activityId });
    return { ok: true, lead: res.lead };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Retry failed.' };
  }
}

/** Builds a playable URL for an Omnidimension call recording, routed through the backend proxy (with auth attached as a query param since <audio src> can't send custom headers). */
export function getRecordingProxyUrl(omnidimRecordingUrl: string): string {
  const token = localStorage.getItem('aiva.auth') ?? sessionStorage.getItem('aiva.auth');
  const authQS = token ? `&auth=${encodeURIComponent(token)}` : '';
  return `${api.apiUrl}/api/omnidim/recording-proxy?src=${encodeURIComponent(omnidimRecordingUrl)}${authQS}`;
}
