// AIVA backend Express app — shared between local dev (server/index.js, via
// `npm run server`) and the deployed Cloud Function (functions/index.js).
// The ONLY place that ever sees the WhatsApp/Omnidimension/Gemini API keys.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// K_SERVICE / FUNCTION_TARGET are set automatically by Google Cloud on a deployed
// Cloud Function — never present on a plain local `node` process. In production,
// env vars come from the platform (functions/.env at deploy time), so dotenv is
// skipped entirely; locally, we load .env then .env.local (which wins on conflicts).
const isDeployed = !!(process.env.K_SERVICE || process.env.FUNCTION_TARGET);
if (!isDeployed) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.join(__dirname, '..');
  dotenv.config({ path: path.join(projectRoot, '.env') });
  dotenv.config({ path: path.join(projectRoot, '.env.local'), override: true });
}

import express from 'express';
import { getContent } from './content.config.js';
import { dispatchCall, listCallLogs } from './omnidim.js';
import { analyzeCallForLead } from './analyzeCall.js';
import { pollOmnidimCallsOnce } from './callPoller.js';
import {
  getLeads, seedLeadsIfEmpty, clearLeads, upsertLeadsByPhone, updateLead, getLead, deleteLead,
  getCallEvents, addCallEvent, getSettings, updateSettings, resolveOmnidimAgentId,
} from './store.js';
import { callLogsToLeads } from './importFromOmnidim.js';
import { runFollowUpSweep } from './scheduler.js';

const app = express();
app.use(express.json());

// CORS — X-Aiva-Auth included so our custom admin credential survives the preflight
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Aiva-Auth');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============================================================
//   ADMIN AUTH — this backend can trigger REAL phone calls, REAL
//   WhatsApp messages, and expose real lead data. Every route below
//   requires HTTP Basic Auth. Set ADMIN_USERNAME/ADMIN_PASSWORD in
//   .env.local (local) or functions/.env (deployed) before this is
//   reachable off your own machine. With no password set, every
//   request is REJECTED (fail closed) — deliberate: an unconfigured
//   deploy must not be silently open.
// ============================================================
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next(); // preflight never carries credentials
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({
      ok: false,
      error: 'This server has no ADMIN_PASSWORD configured, so all requests are refused for safety. Set ADMIN_USERNAME and ADMIN_PASSWORD and restart/redeploy.',
    });
  }
  // Deliberately NOT the standard `Authorization` header: when this app runs behind
  // Firebase Hosting -> Cloud Functions (gen 2 / Cloud Run), Google's own infrastructure
  // intercepts `Authorization` and tries to validate it as ITS OWN IAM credential,
  // rejecting the request before our code ever runs. A custom header sidesteps that
  // entirely. Falls back to ?auth=<value> for requests that can't set custom headers,
  // like an <audio src> element playing a recording.
  const header = req.headers['x-aiva-auth'] || (typeof req.query.auth === 'string' ? req.query.auth : '') || '';
  const [scheme, encoded] = header.split(' ');
  const decoded = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString('utf-8') : '';
  const [user, pass] = decoded.split(':');
  if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) return next();
  return res.status(401).json({ ok: false, error: 'Authentication required.' });
});

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';

function normalizePhone(raw) {
  // Meta wants digits only, no "+", no spaces/dashes.
  return String(raw || '').replace(/[^\d]/g, '');
}

async function callWhatsAppApi(payload) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    const err = new Error(
      'WhatsApp is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID — see .env.example and the setup guide.'
    );
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
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

// POST /api/whatsapp/send  { to: "+919876543210", kind: "brochure" | "location" | "link" }
app.post('/api/whatsapp/send', async (req, res) => {
  const { to, kind } = req.body || {};
  const toNumber = normalizePhone(to);

  if (!toNumber) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid "to" phone number.' });
  }
  if (!['brochure', 'location', 'link'].includes(kind)) {
    return res.status(400).json({ ok: false, error: 'kind must be "brochure", "location", or "link".' });
  }

  const content = getContent();
  let payload;

  if (kind === 'brochure') {
    if (!content.brochure.url) {
      return res.status(422).json({ ok: false, error: 'No brochure URL configured. Set WHATSAPP_BROCHURE_URL.' });
    }
    payload = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'document',
      document: { link: content.brochure.url, filename: content.brochure.filename, caption: content.brochure.caption },
    };
  } else if (kind === 'location') {
    if (!content.location.latitude || !content.location.longitude) {
      return res.status(422).json({ ok: false, error: 'No location configured. Set WHATSAPP_LOCATION_LAT/LNG.' });
    }
    payload = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'location',
      location: {
        latitude: content.location.latitude,
        longitude: content.location.longitude,
        name: content.location.name,
        address: content.location.address,
      },
    };
  } else {
    if (!content.link.url) {
      return res.status(422).json({ ok: false, error: 'No link configured. Set WHATSAPP_WEBSITE_URL.' });
    }
    payload = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'text',
      text: { body: `${content.link.message} ${content.link.url}` },
    };
  }

  try {
    const result = await callWhatsAppApi(payload);
    res.json({ ok: true, messageId: result?.messages?.[0]?.id, raw: result });
  } catch (e) {
    // Surface the REAL Meta error — including the common "outside 24h window, needs a template" case.
    res.status(502).json({ ok: false, error: e.message, code: e.code, details: e.details });
  }
});

app.get('/api/whatsapp/health', (req, res) => {
  res.json({ ok: true, configured: !!(WHATSAPP_TOKEN && PHONE_NUMBER_ID) });
});

// ============================================================
//   LEADS — persistent store (source of truth once seeded).
// ============================================================
app.get('/api/leads', async (req, res) => {
  res.json({ ok: true, leads: await getLeads() });
});

app.post('/api/leads/seed', async (req, res) => {
  const { leads } = req.body || {};
  if (!Array.isArray(leads)) return res.status(400).json({ ok: false, error: 'leads array required' });
  const result = await seedLeadsIfEmpty(leads);
  res.json({ ok: true, leads: result, seeded: result === leads });
});

// POST /api/leads — manually add ONE real lead. Never auto-dials; the lead just
// enters the pipeline like any other and gets called when the admin turns on
// autonomous dialing (or dials it manually) — same as every other lead.
app.post('/api/leads', async (req, res) => {
  const lead = req.body || {};
  if (!lead.name || !lead.phone) {
    return res.status(400).json({ ok: false, error: 'name and phone are required' });
  }
  const newLead = {
    id: `manual_${Date.now()}`,
    name: lead.name,
    phone: lead.phone,
    source: lead.source || 'Manual Entry',
    project: lead.project || '',
    dateTime: new Date().toLocaleString(),
    agentId: lead.agentId || 'agent_1',
    status: 'Pending',
    interestLevel: 'Warm Lead',
    budget: lead.budget || 0,
    location: lead.location || '',
    remarks: lead.remarks || '',
    nextFollowUpDate: new Date().toISOString().split('T')[0],
    timeline: lead.timeline || 'Immediate',
    whatsappSent: false,
    brochureSent: false,
    priceSheetSent: false,
    siteVisitScheduled: '',
    callDuration: '0s',
    lastContactTime: 'Never',
    recordings: [],
  };
  const result = await upsertLeadsByPhone([newLead]);
  res.json({ ok: true, lead: newLead, added: result.added > 0, leads: result.leads });
});

app.delete('/api/leads', async (req, res) => {
  await clearLeads();
  res.json({ ok: true, leads: [] });
});

app.patch('/api/leads/:id', async (req, res) => {
  const updated = await updateLead(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ ok: false, error: 'Lead not found' });
  res.json({ ok: true, lead: updated });
});

app.delete('/api/leads/:id', async (req, res) => {
  const deleted = await deleteLead(req.params.id);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Lead not found' });
  res.json({ ok: true });
});

// ============================================================
//   OMNIDIMENSION — real outbound AI voice calls
// ============================================================

// POST /api/omnidim/call  { leadId }
app.post('/api/omnidim/call', async (req, res) => {
  const { leadId } = req.body || {};
  const lead = await getLead(leadId);
  if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found in backend store. Seed leads first via POST /api/leads/seed.' });

  const settings = await getSettings();
  const resolvedAgentId = resolveOmnidimAgentId(lead, settings);
  if (!resolvedAgentId) {
    return res.status(422).json({
      ok: false,
      error: `No Omnidimension agent configured for ${lead.agentId ? `this lead's assigned agent (${lead.agentId})` : 'this lead'}, and no default agent set. Configure agent IDs in Settings.`,
    });
  }

  try {
    const result = await dispatchCall({
      agentId: resolvedAgentId,
      toNumber: lead.phone,
      fromNumberId: settings.fromNumberId,
      callContext: {
        lead_id: lead.id,
        lead_name: lead.name,
        project: lead.project,
        budget: lead.budget,
        interest_level: lead.interestLevel,
        reason: 'manual_dial',
      },
    });
    await updateLead(lead.id, { status: 'In Call' });
    res.json({ ok: true, requestId: result.requestId, status: result.status });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message, code: e.code });
  }
});

// POST /api/omnidim/webhook — configure this URL as the agent's post_call_actions.webhook.url
app.post('/api/omnidim/webhook', async (req, res) => {
  const payload = req.body || {};
  const leadId = payload?.call_context?.lead_id || payload?.extracted_variables?.lead_id;
  const lead = leadId ? await getLead(leadId) : null;

  const analysis = await analyzeCallForLead(payload, lead);

  // Call rang out / wasn't picked up — retry in 2 hours regardless of what the
  // transcript analysis produced (there's usually no transcript at all in this case).
  const NO_ANSWER_STATUSES = new Set(['no-answer', 'no_answer', 'not-answered', 'not_answered', 'busy', 'failed', 'missed', 'unanswered']);

  // Call connected but the transcript was too ambiguous for a confident interest level
  // — per the client's explicit rule, "picked up but no real engagement" means Not
  // Interested and we stop calling them (see callPoller.js for the twin fix).
  if (lead && !NO_ANSWER_STATUSES.has(String(payload?.call_status || '').toLowerCase())
    && !analysis.suggestedUpdates?.interestLevel) {
    analysis.suggestedUpdates = { ...analysis.suggestedUpdates, interestLevel: 'Not Interested', status: 'Completed' };
  }

  // "Not Interested" / "Wrong Number" are sticky — see callPoller.js for why a later
  // no-answer must never overwrite a lead's explicit "don't contact me" signal.
  const isSticky = lead && (lead.interestLevel === 'Not Interested' || lead.interestLevel === 'Wrong Number');
  if (NO_ANSWER_STATUSES.has(String(payload?.call_status || '').toLowerCase()) && !isSticky) {
    analysis.suggestedUpdates = {
      ...analysis.suggestedUpdates,
      interestLevel: 'Not Reachable',
      status: 'Outgoing Retry',
      nextFollowUpDate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      remarks: 'Call not picked up — auto-retry scheduled in 4 hours.',
    };
  }

  const event = {
    id: `call_${Date.now()}`,
    receivedAt: new Date().toISOString(),
    leadId: lead?.id || null,
    leadName: lead?.name || payload?.to_number || 'Unknown',
    callStatus: payload?.call_status,
    recordingUrl: payload?.recording_url || null,
    durationSeconds: payload?.call_duration || 0,
    summary: payload?.call_report?.summary || '',
    sentiment: payload?.call_report?.sentiment || '',
    analysis,
  };
  await addCallEvent(event);

  if (lead && analysis.suggestedUpdates && Object.keys(analysis.suggestedUpdates).length > 0) {
    await updateLead(lead.id, {
      ...analysis.suggestedUpdates,
      lastContactTime: new Date().toLocaleString(),
      callDuration: `${payload?.call_duration || 0}s`,
    });
  }

  console.log(`[AIVA Omnidimension webhook] Call ${payload?.call_status || 'unknown'} for ${event.leadName} — analyzed: ${analysis.analyzed}`);
  res.json({ ok: true });
});

app.get('/api/omnidim/call-events', async (req, res) => {
  res.json({ ok: true, events: await getCallEvents() });
});

app.get('/api/omnidim/call-logs', async (req, res) => {
  try {
    const pageno = parseInt(req.query.pageno, 10) || 1;
    const pagesize = parseInt(req.query.pagesize, 10) || 30;
    const result = await listCallLogs({ pageno, pagesize, call_status: req.query.call_status });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message, code: e.code });
  }
});

app.get('/api/omnidim/settings', async (req, res) => {
  const s = await getSettings();
  res.json({ ok: true, settings: s, configured: !!process.env.OMNIDIM_API_KEY });
});

// POST /api/omnidim/import-todays-leads — pulls today's calls from the 5 mapped AIVA
// agents (Kavya/Arjun/Ananya/Rohan/Priya) and upserts them into the leads store.
app.post('/api/omnidim/import-todays-leads', async (req, res) => {
  try {
    const allTodayCalls = [];
    const PAGE_SIZE = 150;
    const MAX_PAGES = 20;
    let pageno = 1;
    let keepGoing = true;

    while (keepGoing && pageno <= MAX_PAGES) {
      const page = await listCallLogs({ pageno, pagesize: PAGE_SIZE });
      const rows = page.call_log_data || [];
      if (rows.length === 0) break;

      const todayRows = rows.filter(r => {
        const [datePart] = (r.time_of_call || '').split(' ');
        const [mm, dd, yyyy] = (datePart || '').split('/');
        const now = new Date();
        return parseInt(mm, 10) === now.getMonth() + 1 && parseInt(dd, 10) === now.getDate() && parseInt(yyyy, 10) === now.getFullYear();
      });
      allTodayCalls.push(...todayRows);

      if (todayRows.length === 0) keepGoing = false;
      pageno++;
    }

    const leads = callLogsToLeads(allTodayCalls);
    const result = await upsertLeadsByPhone(leads);

    res.json({
      ok: true,
      scannedCalls: allTodayCalls.length,
      pagesFetched: pageno - 1,
      added: result.added,
      updated: result.updated,
      totalLeadsNow: result.leads.length,
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message, code: e.code });
  }
});

app.post('/api/omnidim/settings', async (req, res) => {
  const updated = await updateSettings(req.body || {});
  res.json({ ok: true, settings: updated });
});

// GET /api/omnidim/recording-proxy?src=<omnidimension recording URL>
app.get('/api/omnidim/recording-proxy', async (req, res) => {
  const src = req.query.src;
  if (!src || typeof src !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing "src" query param.' });
  }
  let parsed;
  try { parsed = new URL(src); } catch { return res.status(400).json({ ok: false, error: 'Invalid URL.' }); }
  if (!/(^|\.)omnidim\.io$/i.test(parsed.hostname)) {
    return res.status(400).json({ ok: false, error: 'Only omnidim.io recording URLs are allowed through this proxy.' });
  }
  try {
    const upstream = await fetch(src, {
      headers: process.env.OMNIDIM_API_KEY ? { Authorization: `Bearer ${process.env.OMNIDIM_API_KEY}` } : {},
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ ok: false, error: `Omnidimension returned ${upstream.status} for this recording.` });
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.get('/api/omnidim/health', (req, res) => {
  res.json({ ok: true, configured: !!process.env.OMNIDIM_API_KEY, geminiAnalysisConfigured: !!process.env.GEMINI_API_KEY });
});

// Manually trigger a follow-up sweep (useful for testing without waiting for the interval)
app.post('/api/omnidim/run-sweep-now', async (req, res) => {
  const result = await runFollowUpSweep(console.log);
  res.json({ ok: true, result });
});

// Pull new call results from Omnidimension's call-logs API and sync them into leads.
// Needed because the Omnidimension agents have no webhook configured (and there's no
// API to set one) — this polling endpoint is what actually keeps leads up to date.
// Safe to call repeatedly: only processes calls newer than the last one it saw.
app.post('/api/omnidim/poll-now', async (req, res) => {
  try {
    const result = await pollOmnidimCallsOnce(console.log);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

export { WHATSAPP_TOKEN, PHONE_NUMBER_ID };
export default app;
