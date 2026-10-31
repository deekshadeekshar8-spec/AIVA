// WhatsApp Client Communication composer — pure logic for building the
// personalized message a user previews/edits before sending, resolving the
// real Google Maps link from a project's saved coordinates/address, and
// validating a phone number before AIVA attempts to send anything real to it.
// Kept pure (no I/O) so it's independently testable, same pattern as
// server/callOutcomeRules.js and server/propertySharing.js.
import { SOCIETY } from './businessFacts.js';

// A real WhatsApp number, once digits-only, is realistically 10-15 digits
// (country code + national number, E.164). This is a sanity check, not a
// carrier-verified check — it only catches obviously malformed input before
// AIVA spends a real API call on it.
export function isValidWhatsAppNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

// Google Maps link built from whatever the admin actually saved for this
// project (server/businessFacts.js buildDefaultPropertyConfig) — real GPS
// coordinates when set, falling back to a text-search link from the saved
// address, and null (never a guessed link) if neither exists yet.
export function buildMapsLink(location) {
  if (!location) return null;
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  if (lat && lng) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  if (location.address && String(location.address).trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address.trim())}`;
  }
  return null;
}

// What content is actually available to send for this lead's project, given
// the admin-configured property data — the composer UI disables/greys out any
// checkbox for content that doesn't exist yet, rather than letting a user
// "send" something that silently fails.
export function decideComposeAvailability(config) {
  const mapsLink = buildMapsLink(config?.location);
  return {
    brochureAvailable: !!(config?.brochureMediaId || (config?.brochureUrl && config.brochureUrl.trim())),
    locationAvailable: !!(config?.location?.latitude && config?.location?.longitude),
    mapsLink,
    images: (config?.images || []).slice(0, 12),
    additionalDocuments: (config?.additionalDocuments || []).slice(0, 6),
  };
}

// The auto-generated, editable personalized message — matches the client's
// exact example format (greeting, brochure mention, location, maps link,
// site-visit CTA). Lines for content that isn't actually available (no
// brochure configured, no address) are simply omitted rather than left blank
// or referencing something that won't really be attached.
export function buildComposedMessage({ leadName, project, config }) {
  const name = String(leadName || '').trim() || 'there';
  const availability = decideComposeAvailability(config || {});
  const address = config?.location?.address ? String(config.location.address).trim() : '';

  const lines = [`Hi ${name}, 👋`, '', `Thank you for your interest in ${project ? `our ${project} project` : 'our property'}.`];

  const introBits = [];
  if (availability.brochureAvailable) introBits.push("please find the project brochure attached for your reference");
  if (address || availability.mapsLink) introBits.push("I've also shared the project location below");
  if (introBits.length) {
    lines.push(introBits.map((b, i) => (i === 0 ? b.charAt(0).toUpperCase() + b.slice(1) : b)).join('. ') + '.');
  }

  if (address || availability.mapsLink) {
    lines.push('');
    if (address) lines.push(`📍 Location: ${address}`);
    if (availability.mapsLink) lines.push(`🗺️ Google Maps: ${availability.mapsLink}`);
  }

  lines.push('', "Please let me know if you'd like more details or would like to schedule a site visit.");

  // Real office/contact block the client asks to appear on client-facing
  // messages — the office address (where documents get verified / where a
  // visit can be coordinated from), a direct call-for-site-visit number, and
  // the anti-fraud commission disclaimer. Never invented — pulled straight
  // from server/businessFacts.js SOCIETY.
  if (SOCIETY.office) {
    lines.push('', `*${SOCIETY.name}*`, '', SOCIETY.office);
    if (SOCIETY.officeMapsLink) lines.push('', `📌 Office location: ${SOCIETY.officeMapsLink}`);
    if (SOCIETY.siteVisitPhone) lines.push('', `📞 *Call for a free site visit: ${SOCIETY.siteVisitPhone}*`);
    if (SOCIETY.commissionDisclaimer) lines.push('', `*Note:* ${SOCIETY.commissionDisclaimer}`);
  }

  lines.push('', 'Thank you.');
  return lines.join('\n');
}
