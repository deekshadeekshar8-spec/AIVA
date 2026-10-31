// WhatsApp Property Sharing — decides WHAT to send a lead based on the real
// intent Gemini detected on a call transcript (server/analyzeCall.js
// whatsappIntent extraction), then actually sends it via the real WhatsApp Cloud
// API (server/whatsappClient.js) using ONLY admin-configured project data
// (server/store.js getPropertyConfig — see server/businessFacts.js
// buildDefaultPropertyConfig for why fields start empty rather than invented).
//
// Pure decision logic lives in decideWhatsAppActions() so it's independently
// testable, same pattern as server/callOutcomeRules.js.
import {
  sendBrochure, sendLocationMessage, sendImageMessage, sendTextMessage, sendDocumentByMediaId, isWhatsAppConfigured,
} from './whatsappClient.js';
import { PROJECTS } from './businessFacts.js';

// Given this call's detected intent and what's ALREADY been sent to this lead,
// decide which content types to send now.
//
// Explicit per-type asks ("send me the location") always honour the request, even
// if that type was sent before — a lead re-asking for something, or asking for an
// update, is a real request, not a duplicate to suppress. The generic "I'm
// interested" / "send everything" bundle, by contrast, only fills in what hasn't
// been sent yet, so repeating "yes I'm interested" across calls doesn't re-blast
// the same brochure/images/location every time.
export function decideWhatsAppActions(intent, alreadySent = {}) {
  if (!intent) return null;
  const {
    wantsBrochure = false, wantsLocation = false, wantsImages = false, wantsPrice = false,
    generalInterest = false, requestedOnWhatsApp = false,
  } = intent;

  const anySignal = wantsBrochure || wantsLocation || wantsImages || wantsPrice || generalInterest || requestedOnWhatsApp;
  if (!anySignal) return null;

  // "I'm interested" or an explicit-but-unspecific "send it on WhatsApp" means the
  // full bundle (spec section 6: "Client says 'I'm interested' -> brochure +
  // location + highlights + offer a site visit").
  const wantsBundle = generalInterest || requestedOnWhatsApp;

  return {
    sendBrochure: wantsBrochure || wantsPrice || (wantsBundle && !alreadySent.brochure),
    sendLocation: wantsLocation || (wantsBundle && !alreadySent.location),
    sendImages: wantsImages || (wantsBundle && !alreadySent.images),
    includePricing: wantsPrice || wantsBundle,
    offerSiteVisit: wantsBundle,
  };
}

const clean = (s) => String(s || '').trim();

// Builds the brochure caption text — project name, highlights, and (only when
// asked) pricing computed live from the real rate card, never a stored number
// that could go stale. offerSiteVisit adds the CTA line.
function buildBrochureCaption({ project, config, includePricing, offerSiteVisit, ratePerSqft }) {
  const lines = [`🏡 ${project}`, `Thank you for your interest! Here are the complete project details:`];
  if (config.highlights?.length) {
    lines.push('', '✨ Highlights:');
    for (const h of config.highlights.slice(0, 6)) lines.push(`• ${h}`);
  }
  if (includePricing && ratePerSqft) {
    lines.push('', `💰 Starting Price: ₹${ratePerSqft.toLocaleString('en-IN')} per sq. ft.`);
  }
  if (config.approvalInfo) lines.push('', `ℹ️ ${config.approvalInfo}`);
  if (offerSiteVisit && config.siteVisitCtaText) lines.push('', config.siteVisitCtaText);
  return lines.join('\n');
}

// Actually sends the decided content to a real lead over WhatsApp, using ONLY
// admin-configured data. Returns { sent: [...activity entries...], errors: [...] }
// so the caller can merge both into the lead's real activity timeline — a failed
// send is recorded as a failure, never silently dropped or reported as sent.
export async function sharePropertyDetails({ lead, project, config, actions, ratePerSqft }) {
  const sent = [];
  const errors = [];
  if (!isWhatsAppConfigured()) {
    return { sent, errors: [{ type: 'config', detail: 'WhatsApp is not configured (WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID missing).' }] };
  }
  const now = () => new Date().toISOString();

  if (actions.sendBrochure) {
    if (!config.brochureMediaId && !config.brochureUrl) {
      errors.push({ type: 'brochure', detail: `No brochure configured for ${project} yet — add one in WhatsApp Property Settings.` });
    } else {
      try {
        const caption = buildBrochureCaption({ project, config, includePricing: actions.includePricing, offerSiteVisit: actions.offerSiteVisit, ratePerSqft });
        await sendBrochure(lead.phone, { brochure: { mediaId: config.brochureMediaId, url: config.brochureUrl, filename: config.brochureFilename, caption } });
        sent.push({ type: 'brochure', detail: `Brochure sent for ${project}.`, timestamp: now() });
      } catch (e) {
        errors.push({ type: 'brochure', detail: e.message });
      }
    }

    // Secondary real documents (e.g. a shared Project Amenities PDF) sent
    // alongside the primary brochure — same "Brochure PDF" checkbox/intent,
    // never sent on their own.
    for (const doc of (config.additionalDocuments || []).slice(0, 6)) {
      try {
        await sendDocumentByMediaId(lead.phone, doc.mediaId, doc.filename, doc.caption);
        sent.push({ type: 'brochure', detail: `${doc.caption || doc.filename || 'Document'} sent for ${project}.`, timestamp: now() });
      } catch (e) {
        errors.push({ type: 'brochure', detail: `${doc.filename || 'Additional document'} failed: ${e.message}` });
      }
    }
  }

  if (actions.sendLocation) {
    const loc = config.location;
    if (!loc?.latitude || !loc?.longitude) {
      errors.push({ type: 'location', detail: `No map location configured for ${project} yet — add coordinates in WhatsApp Property Settings.` });
    } else {
      try {
        await sendLocationMessage(lead.phone, loc);
        sent.push({ type: 'location', detail: `Location shared for ${project}.`, timestamp: now() });
      } catch (e) {
        errors.push({ type: 'location', detail: e.message });
      }
    }
  }

  if (actions.sendImages) {
    const images = (config.images || []).slice(0, 6); // never blast too many at once
    if (images.length === 0) {
      errors.push({ type: 'images', detail: `No project images configured for ${project} yet — add some in WhatsApp Property Settings.` });
    } else {
      let imagesSent = 0;
      for (const img of images) {
        try {
          await sendImageMessage(lead.phone, img.url, img.caption || project);
          imagesSent++;
        } catch (e) {
          errors.push({ type: 'images', detail: `Image (${img.category || 'project'}) failed: ${e.message}` });
        }
      }
      if (imagesSent > 0) sent.push({ type: 'images', detail: `${imagesSent} project image${imagesSent === 1 ? '' : 's'} sent.`, timestamp: now() });
    }
  }

  return { sent, errors };
}

// Intelligent Follow-Up (spec section 9) — references the SPECIFIC thing this
// lead actually said, not a generic "just checking in". Picks the single most
// concrete real detail available, in order of specificity: exact site size they
// asked for, then their stated location preference, then the last objection on
// file, then their most recent remark. Falls back to a generic check-in ONLY
// when literally nothing specific is on record yet.
function buildFollowUpText(lead) {
  const name = clean(lead.name) || 'there';
  if (lead.siteSizeSqft) {
    return `Hi ${name}, when we spoke earlier, you were looking specifically for a ${lead.siteSizeSqft} sqft plot. I wanted to check if you'd like me to share the currently available options.`;
  }
  if (lead.locationPreference) {
    return `Hi ${name}, you'd mentioned looking for something near ${lead.locationPreference}. Just checking if you'd like me to share the options that match that.`;
  }
  const lastObjection = lead.salesBrain?.objectionHistory?.[lead.salesBrain.objectionHistory.length - 1];
  if (lastObjection) {
    return `Hi ${name}, last time we spoke you mentioned ${lastObjection.toLowerCase()}. Wanted to check if that's still on your mind, or if I can help clarify anything.`;
  }
  if (lead.remarks) {
    return `Hi ${name}, following up on what we discussed — ${lead.remarks} Would you like me to share the pricing and available plots?`;
  }
  return `Hi ${name}, just checking if you were able to go through the project details I shared. Would you like me to explain the pricing and available plots?`;
}

// Smart follow-up (spec section 5): a real WhatsApp text check-in sent a
// configurable delay after property details were shared, so a lead who never
// replied gets one genuine nudge instead of being silently forgotten.
export async function sendFollowUpCheckIn(lead) {
  const text = buildFollowUpText(lead);
  await sendTextMessage(lead.phone, text);
  return text;
}

// Full post-call orchestration: decide + send + build the CRM activity/follow-up
// updates. ONE implementation shared by server/callPoller.js (the primary sync
// path) and server/app.js's webhook handler, so they can't drift apart — same
// reasoning as server/callOutcomeRules.js. Returns a partial lead-updates object
// to merge via updateLead(), or null if nothing should happen this call.
export async function runWhatsAppPropertySharing({ lead, whatsappIntent, settings, propertyConfigByProject, log = () => {} }) {
  if (!settings?.whatsappAutoShareEnabled) return null;
  if (!whatsappIntent) return null;
  if (!isWhatsAppConfigured()) return null;

  // Only ever a REAL catalogue project (server/businessFacts.js PROJECTS) — a lead
  // whose project field doesn't match one of the two real projects is skipped
  // rather than guessing which brochure/location to send.
  const project = lead.project;
  if (!project || !PROJECTS[project]) return null;
  const config = propertyConfigByProject?.[project];
  if (!config) return null;

  const alreadySent = { brochure: !!lead.brochureSent, location: !!lead.locationSent, images: !!lead.imagesSent };
  const actions = decideWhatsAppActions(whatsappIntent, alreadySent);
  if (!actions || (!actions.sendBrochure && !actions.sendLocation && !actions.sendImages)) return null;

  const ratePerSqft = PROJECTS[project].ratePerSqft;
  const { sent, errors } = await sharePropertyDetails({ lead, project, config, actions, ratePerSqft });

  const activityEntries = [
    ...sent.map(s => ({ id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: s.type, detail: s.detail, timestamp: s.timestamp, success: true })),
    ...errors.map(e => ({ id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: e.type, detail: e.detail, timestamp: new Date().toISOString(), success: false })),
  ];
  for (const s of sent) log(`[AIVA WhatsApp property sharing] ${lead.name}: ${s.detail}`);
  for (const e of errors) log(`[AIVA WhatsApp property sharing] ${lead.name} FAILED ${e.type}: ${e.detail}`);
  if (activityEntries.length === 0) return null;

  const updates = {};
  if (sent.some(s => s.type === 'brochure')) updates.brochureSent = true;
  if (sent.some(s => s.type === 'location')) updates.locationSent = true;
  if (sent.some(s => s.type === 'images')) updates.imagesSent = true;
  if (sent.length > 0) {
    updates.whatsappSent = true;
    // Smart follow-up (spec section 5): schedule the real check-in text, picked up
    // by scheduler.js's WhatsApp follow-up sweep.
    updates.whatsappFollowUpDueAt = new Date(Date.now() + (settings.whatsappFollowUpDelayHours ?? 3) * 60 * 60 * 1000).toISOString();
    updates.whatsappFollowUpAttempts = 0;
  }
  const priorActivity = Array.isArray(lead.whatsappActivity) ? lead.whatsappActivity : [];
  updates.whatsappActivity = [...priorActivity, ...activityEntries].slice(-30); // cap growth, newest kept

  return updates;
}

export { clean as cleanWhatsAppText, buildBrochureCaption };
