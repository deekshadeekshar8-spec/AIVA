// Frontend client for the local WhatsApp backend (server/index.js).
// The app itself never holds the WhatsApp access token — only the backend does.
import { ensureAuthHeader, clearStoredAuth } from './backendAuth';

// IMPORTANT: use `!== undefined`, not `||` — see backendApi.ts for why.
const _rawBackendUrl = (import.meta as any).env?.VITE_WHATSAPP_BACKEND_URL;
const BACKEND_URL = _rawBackendUrl !== undefined ? _rawBackendUrl : 'http://localhost:8787';

export type WhatsAppSendKind = 'brochure' | 'location' | 'link';

export interface WhatsAppSendResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

export async function sendWhatsAppMessage(to: string, kind: WhatsAppSendKind): Promise<WhatsAppSendResult> {
  try {
    const doSend = () => {
      const auth = ensureAuthHeader();
      return fetch(`${BACKEND_URL}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(auth ? { 'X-Aiva-Auth': auth } : {}) },
        body: JSON.stringify({ to, kind }),
      });
    };
    let res = await doSend();
    if (res.status === 401) { clearStoredAuth(); res = await doSend(); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data?.error || `Request failed (${res.status})` };
    }
    return { ok: true, messageId: data.messageId };
  } catch (e: any) {
    // Most common cause: the backend (npm run server) isn't running.
    return { ok: false, error: `Could not reach WhatsApp backend at ${BACKEND_URL}. Is "npm run server" running? (${e?.message || e})` };
  }
}
