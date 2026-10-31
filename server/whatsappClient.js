// Shared real WhatsApp Cloud API sender — factored out of server/app.js so that
// server-side automation (scheduler.js/callPoller.js workflow triggers) can send
// REAL WhatsApp messages the same way the manual /api/whatsapp/send route does,
// instead of duplicating the Meta Graph API call in two places.
//
// Switched back to Meta's direct Cloud API 2026-08-26 (after a brief detour
// through Twilio while the Meta Business Account was mid-setup) specifically
// because Meta supports a native interactive location-pin message type that
// Twilio's WhatsApp API does not — the client wants all 4 of photos, location,
// PDF, and free text, and only Meta's direct API covers all four natively.
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';

export function isWhatsAppConfigured() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/[^\d]/g, '');
  // Every real lead in this CRM is an Indian number; a bare 10-digit number
  // (no "91" already present) is assumed Indian rather than sent malformed —
  // real incident: a manually-typed test number without "+91" silently failed.
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

export async function callWhatsAppApi(payload) {
  const token = process.env.WHATSAPP_TOKEN || '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  if (!token || !phoneNumberId) {
    const err = new Error('WhatsApp is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const metaMsg = data?.error?.message || `WhatsApp API returned ${res.status}`;
    const err = new Error(metaMsg);
    err.code = data?.error?.code;
    err.details = data;
    throw err;
  }
  return data;
}

// Sends the real configured brochure document to a real phone number. Used both
// by manual sends and by the auto-brochure-after-N-no-answers workflow. Accepts
// EITHER a real Meta media id (content.brochure.mediaId — the file was uploaded
// once via sendBrochure's sibling uploadMedia()/the Media API, and is referenced
// by id from then on, no public hosting needed) OR a publicly-hosted URL
// (content.brochure.url) — id is preferred when both are present.
export async function sendBrochure(toRaw, content) {
  const to = normalizePhone(toRaw);
  if (!to) throw new Error('Invalid phone number.');
  const mediaId = content?.brochure?.mediaId;
  const url = content?.brochure?.url;
  if (!mediaId && !url) {
    const err = new Error('No brochure configured. Set a brochure URL or upload a document (mediaId).');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  return callWhatsAppApi({
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: mediaId
      ? { id: mediaId, filename: content.brochure.filename, caption: content.brochure.caption }
      : { link: url, filename: content.brochure.filename, caption: content.brochure.caption },
  });
}

// Sends one additional real document by its already-uploaded Meta media id —
// used for a project's secondary attachments (e.g. a shared amenities PDF)
// beyond the single primary "brochure" slot.
export async function sendDocumentByMediaId(toRaw, mediaId, filename, caption) {
  const to = normalizePhone(toRaw);
  if (!to) throw new Error('Invalid phone number.');
  if (!mediaId) throw new Error('No media id provided.');
  return callWhatsAppApi({
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: { id: mediaId, filename, caption: caption || '' },
  });
}

// Native WhatsApp location message (a real map pin the recipient can tap to open
// in Maps) — not a plain-text address. Used by WhatsApp Property Sharing
// (server/propertySharing.js) and the manual "Send WhatsApp" flow.
export async function sendLocationMessage(toRaw, location) {
  const to = normalizePhone(toRaw);
  if (!to) throw new Error('Invalid phone number.');
  if (!location?.latitude || !location?.longitude) {
    const err = new Error('No location coordinates configured.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  return callWhatsAppApi({
    messaging_product: 'whatsapp',
    to,
    type: 'location',
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name || '',
      address: location.address || '',
    },
  });
}

// Sends one real, publicly-hosted project image. WhatsApp Cloud API sends images
// one message at a time (no native multi-image album) — callers cap how many are
// sent per burst (server/propertySharing.js caps at 6) so a lead isn't flooded.
export async function sendImageMessage(toRaw, imageUrl, caption) {
  const to = normalizePhone(toRaw);
  if (!to) throw new Error('Invalid phone number.');
  if (!imageUrl) {
    const err = new Error('No image URL provided.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  return callWhatsAppApi({
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, caption: caption || '' },
  });
}

// Plain text message — used for the smart follow-up check-in and any other
// free-form real text AIVA sends (never used to invent pricing/promises; the
// text itself is built in server/propertySharing.js from real configured data).
export async function sendTextMessage(toRaw, text) {
  const to = normalizePhone(toRaw);
  if (!to) throw new Error('Invalid phone number.');
  if (!text) throw new Error('No text provided.');
  return callWhatsAppApi({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });
}
