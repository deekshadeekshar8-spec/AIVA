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
import { GoogleGenAI } from '@google/genai';
import { getContent } from './content.config.js';
import { dispatchCall, listCallLogs } from './omnidim.js';
import { analyzeCallForLead } from './analyzeCall.js';
import { generateLeadIntelligence } from './leadIntelligence.js';
import { withTimeout } from './withTimeout.js';
import { pickVariantForAgent, computeVariantStats, suggestVariant } from './scriptVariants.js';
import { buildBusinessBriefing, PROJECTS } from './businessFacts.js';
import { pollOmnidimCallsOnce } from './callPoller.js';
import { callWhatsAppApi, normalizePhone, isWhatsAppConfigured, sendBrochure, sendLocationMessage, sendImageMessage, sendTextMessage, sendDocumentByMediaId } from './whatsappClient.js';
import { isValidWhatsAppNumber, buildMapsLink, decideComposeAvailability, buildComposedMessage } from './whatsappCompose.js';
import {
  getLeads, seedLeadsIfEmpty, clearLeads, upsertLeadsByPhone, updateLead, getLead, deleteLead,
  getCallEvents, addCallEvent, getSettings, updateSettings, resolveOmnidimAgentId,
  getScriptVariants, upsertScriptVariant, deleteScriptVariant, getInboundMessages, addInboundMessage,
  getOutboundMessage, addOutboundMessage,
  getCampaigns, upsertCampaign, getCampaign, deleteCampaign,
  getUsers, getUserById, getUserByUsername, createUser, updateUser, deleteUser,
  getAuditEvents, addAuditEvent,
  getPropertyConfig, updatePropertyConfigForProject,
} from './store.js';
import { hashPassword, verifyPassword } from './auth.js';
import { computeEscalation, buildHandoffSummary } from './escalation.js';
import { mergeSalesBrain, buildSalesBrainBriefing } from './salesBrain.js';
import { computeLeadScore, mergeBuyingSignals } from './leadScore.js';
import { computeAgentWorkloads, recommendAgentForNewLead, recommendRebalancing } from './leadAssignment.js';
import { buildDailyBriefingStats, buildTopActions } from './dailyBriefing.js';
import { summarizeLostReasons, categorizeLostReason } from './lostLeadIntelligence.js';
import { computeSalesFunnel } from './salesFunnel.js';
import { isWithinCallWindow, formatCallWindow } from './callWindow.js';
import { buildLiveFeed } from './liveFeed.js';

// Real AI agent roster — id/name pairs only (no PII, no fabricated bios), used
// server-side purely to label workload/assignment output. Mirrors the frontend's
// hardcoded 5-agent list (src/App.tsx) and the bot-name mapping already used by
// server/callPoller.js / server/importFromOmnidim.js.
const AGENT_ROSTER = [
  { id: 'agent_1', name: 'Kavya' },
  { id: 'agent_2', name: 'Arjun' },
  { id: 'agent_3', name: 'Ananya' },
  { id: 'agent_4', name: 'Rohan' },
  { id: 'agent_5', name: 'Priya' },
];
import { runWhatsAppPropertySharing } from './propertySharing.js';
import { decideLeadUpdates, shouldSendAutoBrochure } from './callOutcomeRules.js';
import { getGeminiStats } from './geminiClient.js';
import { callLogsToLeads } from './importFromOmnidim.js';
import { runFollowUpSweep, runWhatsAppFollowUpSweep } from './scheduler.js';

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
//
//   Beyond that one env-configured superadmin (which always works, so the
//   deploy can never be locked out), real named accounts can be created via
//   /api/users (Team & Roles) — each with their own username/password and a
//   role of 'admin' or 'member'. Every authenticated, non-GET request (plus
//   failed login attempts) is appended to a real audit log (Security page) —
//   see afterAuth() below.
// ============================================================
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// Meta calls the WhatsApp webhook directly — it can't send our custom X-Aiva-Auth
// header, so it authenticates itself differently: GET verification uses a shared
// WHATSAPP_VERIFY_TOKEN (checked inside the route below), and POST deliveries are
// Meta's own infrastructure hitting a URL only we know. Every OTHER route still
// requires admin auth.
const PUBLIC_PATHS = new Set(['/api/whatsapp/webhook']);

app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') return next(); // preflight never carries credentials
  if (PUBLIC_PATHS.has(req.path)) return next();
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
  const splitAt = decoded.indexOf(':');
  const user = splitAt === -1 ? decoded : decoded.slice(0, splitAt);
  const pass = splitAt === -1 ? '' : decoded.slice(splitAt + 1);

  const grant = (authedUser) => {
    req.aivaUser = authedUser;
    if (req.method !== 'GET') {
      res.on('finish', () => {
        addAuditEvent({
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          actor: authedUser.username,
          role: authedUser.role,
          action: `${req.method} ${req.path}`,
          statusCode: res.statusCode,
          ip: req.ip,
        }).catch(() => {});
      });
    }
    next();
  };

  // 1) The env-configured superadmin always works — this is what a deploy
  //    bootstraps with, and it can never be locked out by deleting accounts.
  if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
    return grant({ username: ADMIN_USERNAME, role: 'admin', source: 'env' });
  }

  // 2) Real named accounts created via Team & Roles.
  if (user && pass) {
    const record = await getUserByUsername(user);
    if (record && record.active !== false && verifyPassword(pass, record.passwordSalt, record.passwordHash)) {
      return grant({ id: record.id, username: record.username, role: record.role, source: 'stored' });
    }
  }

  await addAuditEvent({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    actor: user || '(no username)',
    role: null,
    action: `FAILED LOGIN ${req.method} ${req.path}`,
    statusCode: 401,
    ip: req.ip,
  }).catch(() => {});
  return res.status(401).json({ ok: false, error: 'Authentication required.' });
});

// Team & Roles routes below require the caller to actually be an admin —
// either the env superadmin or a stored account with role 'admin'.
function requireAdmin(req, res, next) {
  if (req.aivaUser?.role === 'admin') return next();
  return res.status(403).json({ ok: false, error: 'Admin role required.' });
}

// Strips password fields before a user record ever leaves the server, and
// tags the env superadmin (env: true) so the UI can show it as non-deletable.
function toPublicUser(u) {
  return { id: u.id, username: u.username, role: u.role, active: u.active !== false, createdAt: u.createdAt };
}

// ============================================================
//   AUTH / SESSION — lets the frontend know who's actually logged in right now.
// ============================================================
app.get('/api/auth/me', (req, res) => {
  res.json({ ok: true, user: { id: req.aivaUser.id || null, username: req.aivaUser.username, role: req.aivaUser.role, source: req.aivaUser.source } });
});

// ============================================================
//   TEAM & ROLES — real named accounts, each with their own password (hashed,
//   never stored/returned in plain text — see server/auth.js). The env admin
//   is always listed as a non-deletable "env" superadmin alongside them.
// ============================================================
app.get('/api/users', requireAdmin, async (req, res) => {
  const users = await getUsers();
  const envUser = { id: 'env-admin', username: ADMIN_USERNAME, role: 'admin', active: true, createdAt: null, env: true };
  res.json({ ok: true, users: [envUser, ...users.map(toPublicUser)] });
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !username.trim()) return res.status(400).json({ ok: false, error: 'username is required' });
  if (!password || password.length < 8) return res.status(400).json({ ok: false, error: 'password must be at least 8 characters' });
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ ok: false, error: 'role must be "admin" or "member"' });
  if (username.trim().toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
    return res.status(409).json({ ok: false, error: `"${username}" is reserved for the env superadmin.` });
  }
  const existing = await getUserByUsername(username.trim());
  if (existing) return res.status(409).json({ ok: false, error: 'A user with that username already exists.' });

  const { passwordSalt, passwordHash } = hashPassword(password);
  const user = {
    id: `user_${Date.now()}`,
    username: username.trim(),
    role,
    active: true,
    passwordSalt,
    passwordHash,
    createdAt: new Date().toISOString(),
    createdBy: req.aivaUser.username,
  };
  await createUser(user);
  res.json({ ok: true, user: toPublicUser(user) });
});

// PATCH /api/users/:id — admins can change anyone's role/active/password; a
// non-admin can only change their OWN password (must supply currentPassword).
app.patch('/api/users/:id', async (req, res) => {
  const target = await getUserById(req.params.id);
  if (!target) return res.status(404).json({ ok: false, error: 'User not found' });

  const isAdmin = req.aivaUser.role === 'admin';
  const isSelf = req.aivaUser.id === target.id;
  if (!isAdmin && !isSelf) return res.status(403).json({ ok: false, error: 'Not authorized to modify this user.' });

  const { password, currentPassword, role, active } = req.body || {};
  const updates = {};

  if (role !== undefined) {
    if (!isAdmin) return res.status(403).json({ ok: false, error: 'Only an admin can change roles.' });
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ ok: false, error: 'role must be "admin" or "member"' });
    updates.role = role;
  }
  if (active !== undefined) {
    if (!isAdmin) return res.status(403).json({ ok: false, error: 'Only an admin can activate/deactivate a user.' });
    updates.active = !!active;
  }
  if (password !== undefined) {
    if (!isAdmin) {
      if (!currentPassword || !verifyPassword(currentPassword, target.passwordSalt, target.passwordHash)) {
        return res.status(401).json({ ok: false, error: 'Current password is incorrect.' });
      }
    }
    if (!password || password.length < 8) return res.status(400).json({ ok: false, error: 'password must be at least 8 characters' });
    Object.assign(updates, hashPassword(password));
  }

  // Guard against locking the app out of admin entirely: refuse to demote/deactivate
  // the last remaining active admin account (the env superadmin always still works,
  // but this keeps at least one real named admin account usable too).
  if ((updates.role === 'member' || updates.active === false) && target.role === 'admin') {
    const users = await getUsers();
    const otherActiveAdmins = users.filter(u => u.id !== target.id && u.role === 'admin' && u.active !== false);
    if (otherActiveAdmins.length === 0) {
      return res.status(409).json({ ok: false, error: 'Cannot remove the last remaining admin account. Promote another user first.' });
    }
  }

  const updated = await updateUser(target.id, updates);
  res.json({ ok: true, user: toPublicUser(updated) });
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const target = await getUserById(req.params.id);
  if (!target) return res.status(404).json({ ok: false, error: 'User not found' });
  if (target.role === 'admin') {
    const users = await getUsers();
    const otherActiveAdmins = users.filter(u => u.id !== target.id && u.role === 'admin' && u.active !== false);
    if (otherActiveAdmins.length === 0) {
      return res.status(409).json({ ok: false, error: 'Cannot delete the last remaining admin account.' });
    }
  }
  const deleted = await deleteUser(target.id);
  res.json({ ok: deleted });
});

// ============================================================
//   SECURITY — real audit log of authenticated admin actions (every non-GET
//   request, plus failed logins), appended by the auth middleware above.
//   Admin-only: this is who-did-what across the whole team.
// ============================================================
app.get('/api/audit-log', requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const events = await getAuditEvents();
  res.json({ ok: true, events: events.slice(0, limit) });
});

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

  try {
    let result;
    if (kind === 'brochure') {
      if (!content.brochure.url) {
        return res.status(422).json({ ok: false, error: 'No brochure URL configured. Set WHATSAPP_BROCHURE_URL.' });
      }
      result = await sendBrochure(toNumber, content);
    } else if (kind === 'location') {
      if (!content.location.latitude || !content.location.longitude) {
        return res.status(422).json({ ok: false, error: 'No location configured. Set WHATSAPP_LOCATION_LAT/LNG.' });
      }
      result = await sendLocationMessage(toNumber, content.location);
    } else {
      if (!content.link.url) {
        return res.status(422).json({ ok: false, error: 'No link configured. Set WHATSAPP_WEBSITE_URL.' });
      }
      result = await sendTextMessage(toNumber, `${content.link.message} ${content.link.url}`);
    }
    res.json({ ok: true, messageId: result?.messages?.[0]?.id, raw: result });
  } catch (e) {
    // Surface the REAL Twilio/WhatsApp error — including common not-configured/invalid-number cases.
    res.status(502).json({ ok: false, error: e.message, code: e.code, details: e.details });
  }
});

app.get('/api/whatsapp/health', (req, res) => {
  res.json({ ok: true, configured: isWhatsAppConfigured(), inboundConfigured: !!process.env.WHATSAPP_VERIFY_TOKEN });
});

// ============================================================
//   WHATSAPP INBOUND — closes the loop on the "autonomous follow-up" behavior:
//   when a lead actually replies on WhatsApp, we see it and record it against
//   their real record instead of only ever sending one-way messages. Configure
//   this URL (https://<your-domain>/api/whatsapp/webhook) + WHATSAPP_VERIFY_TOKEN
//   in the Meta App dashboard's WhatsApp > Configuration > Webhook section.
// ============================================================
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.WHATSAPP_VERIFY_TOKEN || '';
  if (mode === 'subscribe' && expected && token === expected) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  // Always 200 immediately — Meta retries aggressively on non-2xx, and we'd
  // rather log a malformed payload than get stuck in a retry loop over it.
  res.sendStatus(200);
  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contactName = value.contacts?.[0]?.profile?.name || '';
        for (const message of value.messages || []) {
          const fromPhone = message.from; // digits only, no "+"
          const text = message.text?.body || (message.type ? `[${message.type} message]` : '');
          const receivedAt = new Date().toISOString();

          await addInboundMessage({
            id: `wa_${message.id || Date.now()}`,
            from: fromPhone,
            contactName,
            text,
            receivedAt,
          });

          // Real reaction: find the lead by phone and record that they actually
          // replied — this is what lets a manager (or a future automated rule)
          // see engagement instead of a one-way message with no visibility.
          const leads = await getLeads();
          const digits = String(fromPhone || '').replace(/\D/g, '');
          const lead = leads.find(l => String(l.phone || '').replace(/\D/g, '').endsWith(digits.slice(-10)));
          if (lead) {
            // A real reply means the smart follow-up (server/propertySharing.js) did
            // its job — clear the pending automated check-in so scheduler.js doesn't
            // nag someone who already responded, and log it on the real activity
            // timeline (Lead Details page) so a manager sees the whole real thread.
            const priorActivity = Array.isArray(lead.whatsappActivity) ? lead.whatsappActivity : [];
            const replyEntry = { id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: 'reply', detail: `Client replied: "${text}"`, timestamp: receivedAt, success: true };
            await updateLead(lead.id, {
              lastContactAttemptedByLead: receivedAt,
              lastContactByLead: text,
              remarks: `${lead.remarks ? lead.remarks + ' | ' : ''}WhatsApp reply: "${text}"`,
              whatsappFollowUpDueAt: null,
              whatsappActivity: [...priorActivity, replyEntry].slice(-30),
            });
            console.log(`[AIVA WhatsApp inbound] ${lead.name} replied: "${text}"`);
          } else {
            console.log(`[AIVA WhatsApp inbound] Message from unrecognized number ${fromPhone}: "${text}"`);
          }
        }

        // Delivery/read/failed status updates for OUR outbound sends (server/app.js
        // /api/leads/:id/whatsapp/send + retry). Meta sends these in the same
        // webhook payload type as inbound messages, keyed by the real message id we
        // stored in the outboundMessages index at send time — that's how we find
        // which lead + which exact activity-log entry to update.
        for (const status of value.statuses || []) {
          const messageId = status.id;
          const newStatus = status.status; // 'sent' | 'delivered' | 'read' | 'failed'
          if (!messageId || !newStatus) continue;
          const outbound = await getOutboundMessage(messageId);
          if (!outbound) continue; // not one of ours (or sent before this index existed)
          const lead = await getLead(outbound.leadId);
          if (!lead) continue;
          const activity = Array.isArray(lead.whatsappActivity) ? lead.whatsappActivity : [];
          const idx = activity.findIndex(a => a.id === outbound.activityId);
          if (idx === -1) continue;
          const updatedEntry = { ...activity[idx], status: newStatus };
          if (newStatus === 'failed' && status.errors?.[0]?.title) {
            updatedEntry.detail = `${updatedEntry.detail} (delivery failed: ${status.errors[0].title})`;
            updatedEntry.success = false;
          }
          const nextActivity = [...activity];
          nextActivity[idx] = updatedEntry;
          await updateLead(lead.id, { whatsappActivity: nextActivity });
          console.log(`[AIVA WhatsApp status] ${lead.name}: message ${messageId} -> ${newStatus}`);
        }
      }
    }
  } catch (e) {
    console.error('[AIVA WhatsApp inbound] processing error:', e.message);
  }
});

app.get('/api/whatsapp/messages', async (req, res) => {
  res.json({ ok: true, messages: await getInboundMessages() });
});

// ============================================================
//   WHATSAPP PROPERTY SETTINGS — admin config per REAL project (see
//   server/businessFacts.js PROJECTS). Asset/coordinate fields (brochure URL,
//   images, exact GPS lat/lng, nearby landmarks) are never pre-filled with
//   invented values — they stay empty until an admin actually supplies them
//   (server/businessFacts.js buildDefaultPropertyConfig).
// ============================================================
app.get('/api/property-config', async (req, res) => {
  res.json({ ok: true, config: await getPropertyConfig() });
});

app.patch('/api/property-config/:project', async (req, res) => {
  const project = decodeURIComponent(req.params.project);
  const body = req.body || {};
  const updates = {};
  if (typeof body.description === 'string') updates.description = body.description.trim();
  if (typeof body.websiteUrl === 'string') updates.websiteUrl = body.websiteUrl.trim();
  if (typeof body.brochureUrl === 'string') updates.brochureUrl = body.brochureUrl.trim();
  if (typeof body.brochureMediaId === 'string') updates.brochureMediaId = body.brochureMediaId.trim();
  if (typeof body.brochureFilename === 'string') updates.brochureFilename = body.brochureFilename.trim();
  if (Array.isArray(body.additionalDocuments)) {
    updates.additionalDocuments = body.additionalDocuments
      .filter(d => d && typeof d.mediaId === 'string' && d.mediaId.trim())
      .map(d => ({ mediaId: d.mediaId.trim(), filename: String(d.filename || '').trim(), caption: String(d.caption || '').trim() }))
      .slice(0, 6);
  }
  if (Array.isArray(body.images)) {
    updates.images = body.images
      .filter(i => i && typeof i.url === 'string' && i.url.trim())
      .map(i => ({ url: i.url.trim(), caption: String(i.caption || '').trim(), category: String(i.category || '').trim() }))
      .slice(0, 12);
  }
  if (body.location && typeof body.location === 'object') {
    updates.location = {
      name: String(body.location.name || project),
      address: String(body.location.address || ''),
      latitude: Number(body.location.latitude) || 0,
      longitude: Number(body.location.longitude) || 0,
    };
  }
  if (Array.isArray(body.highlights)) {
    updates.highlights = body.highlights.filter(h => typeof h === 'string' && h.trim()).map(h => h.trim()).slice(0, 10);
  }
  if (typeof body.approvalInfo === 'string') updates.approvalInfo = body.approvalInfo.trim();
  if (Array.isArray(body.nearbyLandmarks)) {
    updates.nearbyLandmarks = body.nearbyLandmarks.filter(l => typeof l === 'string' && l.trim()).map(l => l.trim()).slice(0, 10);
  }
  if (typeof body.siteVisitCtaText === 'string') updates.siteVisitCtaText = body.siteVisitCtaText.trim();

  try {
    const updated = await updatePropertyConfigForProject(project, updates);
    res.json({ ok: true, config: updated });
  } catch (e) {
    res.status(404).json({ ok: false, error: e.message });
  }
});

// ============================================================
//   WHATSAPP CLIENT COMMUNICATION — the manual per-client composer: preview an
//   auto-generated message + what real content is available to attach for this
//   lead's project, let the user edit/select before sending, then actually send
//   it (real Meta WhatsApp Cloud API) and log every attempt to the lead's real
//   activity timeline (never silently sent, never silently dropped on failure).
// ============================================================

// GET /api/leads/:id/whatsapp/compose?project=<optional override>
// Read-only preview — never sends anything. Powers the composer UI: what can
// actually be attached (brochure/location/images configured?), the real Google
// Maps link resolved from the project's saved coordinates, and an editable
// auto-generated message the user can change before sending.
app.get('/api/leads/:id/whatsapp/compose', async (req, res) => {
  const lead = await getLead(req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found.' });

  const projectOverride = req.query.project ? decodeURIComponent(String(req.query.project)) : null;
  const project = (projectOverride && PROJECTS[projectOverride]) ? projectOverride
    : (PROJECTS[lead.project] ? lead.project : null);

  const propertyConfigByProject = await getPropertyConfig();
  const config = project ? propertyConfigByProject[project] : {};
  const availability = decideComposeAvailability(config || {});
  const message = buildComposedMessage({ leadName: lead.name, project, config: config || {} });

  res.json({
    ok: true,
    lead: { id: lead.id, name: lead.name, phone: lead.phone },
    phoneValid: isValidWhatsAppNumber(lead.phone),
    whatsappConfigured: isWhatsAppConfigured(),
    project,
    availableProjects: Object.keys(PROJECTS),
    message,
    brochureAvailable: availability.brochureAvailable,
    locationAvailable: availability.locationAvailable,
    mapsLink: availability.mapsLink,
    images: availability.images,
    additionalDocuments: availability.additionalDocuments,
  });
});

// POST /api/leads/:id/whatsapp/send
// { project?, message?, sendMessage?, sendBrochure?, sendLocation?, sendMapsLink?, sendImages? }
// The actual real send — never fired without this explicit user-driven call
// (no auto-send here; the automated property-sharing/follow-up sweeps live in
// server/propertySharing.js + server/scheduler.js, gated by their own settings).
app.post('/api/leads/:id/whatsapp/send', async (req, res) => {
  const lead = await getLead(req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found.' });
  if (!isWhatsAppConfigured()) {
    return res.status(422).json({ ok: false, error: 'WhatsApp is not configured (WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID missing).' });
  }
  if (!isValidWhatsAppNumber(lead.phone)) {
    return res.status(400).json({ ok: false, error: `"${lead.phone}" doesn't look like a valid WhatsApp number for ${lead.name}.` });
  }

  const body = req.body || {};
  const projectOverride = typeof body.project === 'string' && PROJECTS[body.project] ? body.project : null;
  const project = projectOverride || (PROJECTS[lead.project] ? lead.project : null);
  const propertyConfigByProject = await getPropertyConfig();
  const config = project ? propertyConfigByProject[project] : {};

  const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null;
  const wantMessage = body.sendMessage !== false && !!message;
  const wantBrochure = !!body.sendBrochure;
  const wantLocation = !!body.sendLocation;
  const wantMapsLink = !!body.sendMapsLink;
  const wantImages = !!body.sendImages;

  const now = () => new Date().toISOString();
  const results = [];
  const activityEntries = [];

  const record = async (type, successDetail, fn) => {
    try {
      const raw = await fn();
      const messageId = raw?.messages?.[0]?.id || null;
      const entry = { id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type, detail: successDetail, timestamp: now(), success: true, status: 'sent', messageId };
      activityEntries.push(entry);
      results.push({ type, ok: true, messageId });
      if (messageId) await addOutboundMessage({ id: messageId, leadId: lead.id, activityId: entry.id, type, sentAt: entry.timestamp });
    } catch (e) {
      const entry = { id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type, detail: e.message, timestamp: now(), success: false, status: 'failed' };
      activityEntries.push(entry);
      results.push({ type, ok: false, error: e.message });
    }
  };

  if (wantMessage) {
    await record('text', 'Custom WhatsApp message sent.', () => sendTextMessage(lead.phone, message));
  }
  if (wantBrochure) {
    if (!config?.brochureMediaId && !config?.brochureUrl) {
      results.push({ type: 'brochure', ok: false, error: `No brochure configured for ${project || "this lead's project"} yet — add one in WhatsApp Property Settings.` });
    } else {
      const caption = `${project ? project + ' — ' : ''}Project Brochure`;
      await record('brochure', `Brochure sent${project ? ` for ${project}` : ''}.`, () => sendBrochure(lead.phone, { brochure: { mediaId: config.brochureMediaId, url: config.brochureUrl, filename: config.brochureFilename, caption } }));
    }
    // Secondary real documents (e.g. a shared Project Amenities PDF) — same
    // checkbox, sent alongside the primary brochure.
    for (const doc of (config?.additionalDocuments || []).slice(0, 6)) {
      await record('brochure', `${doc.caption || doc.filename || 'Document'} sent${project ? ` for ${project}` : ''}.`, () => sendDocumentByMediaId(lead.phone, doc.mediaId, doc.filename, doc.caption));
    }
  }
  if (wantLocation) {
    if (!config?.location?.latitude || !config?.location?.longitude) {
      results.push({ type: 'location', ok: false, error: `No map location configured for ${project || "this lead's project"} yet — add coordinates in WhatsApp Property Settings.` });
    } else {
      await record('location', `Location shared${project ? ` for ${project}` : ''}.`, () => sendLocationMessage(lead.phone, config.location));
    }
  }
  if (wantMapsLink) {
    const mapsLink = buildMapsLink(config?.location);
    if (!mapsLink) {
      results.push({ type: 'maps_link', ok: false, error: 'No location configured yet to build a Google Maps link from.' });
    } else {
      await record('maps_link', 'Google Maps link sent.', () => sendTextMessage(lead.phone, `🗺️ Google Maps: ${mapsLink}`));
    }
  }
  if (wantImages) {
    const images = (config?.images || []).slice(0, 6); // never blast too many at once
    if (images.length === 0) {
      results.push({ type: 'images', ok: false, error: `No project images configured for ${project || "this lead's project"} yet.` });
    } else {
      let sentCount = 0;
      for (const img of images) {
        try {
          const raw = await sendImageMessage(lead.phone, img.url, img.caption || project || '');
          sentCount++;
          const messageId = raw?.messages?.[0]?.id || null;
          const entry = { id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: 'images', detail: `Project image sent (${img.category || 'project'}).`, timestamp: now(), success: true, status: 'sent', messageId };
          activityEntries.push(entry);
          if (messageId) await addOutboundMessage({ id: messageId, leadId: lead.id, activityId: entry.id, type: 'images', sentAt: entry.timestamp });
        } catch (e) {
          activityEntries.push({ id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: 'images', detail: `Image (${img.category || 'project'}) failed: ${e.message}`, timestamp: now(), success: false, status: 'failed' });
        }
      }
      results.push({ type: 'images', ok: sentCount > 0, sentCount, requested: images.length });
    }
  }

  if (activityEntries.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nothing selected to send.' });
  }

  const priorActivity = Array.isArray(lead.whatsappActivity) ? lead.whatsappActivity : [];
  const leadUpdates = { whatsappActivity: [...priorActivity, ...activityEntries].slice(-50) };
  if (activityEntries.some(e => e.type === 'text' && e.success)) leadUpdates.whatsappSent = true;
  if (activityEntries.some(e => e.type === 'brochure' && e.success)) leadUpdates.brochureSent = true;
  if (activityEntries.some(e => e.type === 'location' && e.success)) leadUpdates.locationSent = true;
  if (activityEntries.some(e => e.type === 'images' && e.success)) leadUpdates.imagesSent = true;

  const updatedLead = await updateLead(lead.id, leadUpdates);
  res.json({ ok: true, results, lead: updatedLead });
});

// POST /api/leads/:id/whatsapp/retry  { activityId }
// Re-sends exactly one previously-FAILED item from the activity timeline. The
// original custom text body isn't stored verbatim on failed entries (only the
// error), so a retried "text"/"maps_link" item is rebuilt fresh from current
// data rather than silently doing nothing.
app.post('/api/leads/:id/whatsapp/retry', async (req, res) => {
  const lead = await getLead(req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found.' });
  const { activityId } = req.body || {};
  const entry = (lead.whatsappActivity || []).find(a => a.id === activityId);
  if (!entry) return res.status(404).json({ ok: false, error: 'Activity entry not found.' });
  if (entry.success) return res.status(400).json({ ok: false, error: 'That message already sent successfully — nothing to retry.' });
  if (!isWhatsAppConfigured()) return res.status(422).json({ ok: false, error: 'WhatsApp is not configured.' });
  if (!isValidWhatsAppNumber(lead.phone)) return res.status(400).json({ ok: false, error: `"${lead.phone}" doesn't look like a valid WhatsApp number.` });

  const project = PROJECTS[lead.project] ? lead.project : null;
  const propertyConfigByProject = await getPropertyConfig();
  const config = project ? propertyConfigByProject[project] : {};

  let sendFn;
  if (entry.type === 'text' || entry.type === 'maps_link') {
    const mapsLink = buildMapsLink(config?.location);
    const text = entry.type === 'maps_link'
      ? (mapsLink ? `🗺️ Google Maps: ${mapsLink}` : null)
      : buildComposedMessage({ leadName: lead.name, project, config: config || {} });
    if (!text) return res.status(422).json({ ok: false, error: 'Nothing to retry — the required project data is still missing.' });
    sendFn = () => sendTextMessage(lead.phone, text);
  } else if (entry.type === 'brochure') {
    if (!config?.brochureMediaId && !config?.brochureUrl) return res.status(422).json({ ok: false, error: `No brochure configured for ${project || 'this project'} yet.` });
    sendFn = () => sendBrochure(lead.phone, { brochure: { mediaId: config.brochureMediaId, url: config.brochureUrl, filename: config.brochureFilename, caption: `${project ? project + ' — ' : ''}Project Brochure` } });
  } else if (entry.type === 'location') {
    if (!config?.location?.latitude || !config?.location?.longitude) return res.status(422).json({ ok: false, error: `No map location configured for ${project || 'this project'} yet.` });
    sendFn = () => sendLocationMessage(lead.phone, config.location);
  } else {
    return res.status(400).json({ ok: false, error: `Retry isn't supported for "${entry.type}" yet.` });
  }

  const now = new Date().toISOString();
  try {
    const raw = await sendFn();
    const messageId = raw?.messages?.[0]?.id || null;
    const newEntry = { id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: entry.type, detail: `Retry succeeded.`, timestamp: now, success: true, status: 'sent', messageId, retryOf: entry.id };
    if (messageId) await addOutboundMessage({ id: messageId, leadId: lead.id, activityId: newEntry.id, type: entry.type, sentAt: now });
    const updated = await updateLead(lead.id, { whatsappActivity: [...(lead.whatsappActivity || []), newEntry].slice(-50) });
    res.json({ ok: true, entry: newEntry, lead: updated });
  } catch (e) {
    const newEntry = { id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: entry.type, detail: e.message, timestamp: now, success: false, status: 'failed', retryOf: entry.id };
    const updated = await updateLead(lead.id, { whatsappActivity: [...(lead.whatsappActivity || []), newEntry].slice(-50) });
    res.status(502).json({ ok: false, error: e.message, lead: updated });
  }
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
  // Smart Lead Assignment (server/leadAssignment.js): if the caller didn't pick an
  // agent, assign to whichever real AI agent currently has the fewest active
  // leads — real workload balancing instead of always defaulting to agent_1.
  const assignedAgentId = lead.agentId || recommendAgentForNewLead(await getLeads(), AGENT_ROSTER) || 'agent_1';
  const newLead = {
    id: `manual_${Date.now()}`,
    name: lead.name,
    phone: lead.phone,
    source: lead.source || 'Manual Entry',
    project: lead.project || '',
    dateTime: new Date().toLocaleString(),
    agentId: assignedAgentId,
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

  // AI Sales Employee, step 1: research the lead the moment it enters the CRM,
  // same as a human SDR would before their first touch. Capped at 8s and
  // awaited (not fire-and-forget) — this Cloud Function isn't configured with
  // "CPU always allocated", so work left running past the response is not
  // guaranteed to ever complete. A real Gemini outage (503 "high demand",
  // 2026-08-27) previously made every lead-add hang for 30-40s per retry until
  // Firebase Hosting's ~60s rewrite-proxy timeout killed the request with a
  // 502, even though the lead itself had already been saved. Creating a lead
  // must never depend on an LLM being fast or even up, so a slow/down model
  // just means the lead is saved without enrichment (same as any other
  // best-effort AI feature in this app).
  let leadWithIntel = newLead;
  const research = await withTimeout(generateLeadIntelligence(newLead), 8000).catch(() => ({ ok: false }));
  if (research.ok) {
    await updateLead(newLead.id, { leadIntelligence: research.leadIntelligence, callStrategy: research.callStrategy, recommendation: research.recommendation });
    leadWithIntel = { ...newLead, leadIntelligence: research.leadIntelligence, callStrategy: research.callStrategy, recommendation: research.recommendation };
  }

  res.json({ ok: true, lead: leadWithIntel, added: result.added > 0, leads: result.leads });
});

// POST /api/leads/:id/research — (re)generate the AI lead-intelligence profile and
// call strategy on demand, e.g. after remarks/budget/location changed.
app.post('/api/leads/:id/research', async (req, res) => {
  const lead = await getLead(req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found' });
  const research = await generateLeadIntelligence(lead);
  if (!research.ok) return res.status(502).json({ ok: false, error: research.reason });
  const updated = await updateLead(lead.id, { leadIntelligence: research.leadIntelligence, callStrategy: research.callStrategy, recommendation: research.recommendation });
  res.json({ ok: true, lead: updated });
});

app.delete('/api/leads', async (req, res) => {
  await clearLeads();
  res.json({ ok: true, leads: [] });
});

app.patch('/api/leads/:id', async (req, res) => {
  const before = await getLead(req.params.id);
  if (!before) return res.status(404).json({ ok: false, error: 'Lead not found' });
  let updated = await updateLead(req.params.id, req.body || {});

  // A manual edit (e.g. a rep bumping interestLevel to "Hot Lead") can newly cross
  // the high-value threshold just like a call outcome can — re-check the same real
  // condition here so it isn't only ever caught after the next call.
  if (updated && (req.body?.interestLevel !== undefined || req.body?.budget !== undefined) && !updated.escalated) {
    const settings = await getSettings();
    const escalation = computeEscalation({ interestLevel: updated.interestLevel, budget: updated.budget, settings });
    if (escalation) updated = await updateLead(updated.id, escalation);
  }

  res.json({ ok: true, lead: updated });
});

app.delete('/api/leads/:id', async (req, res) => {
  const deleted = await deleteLead(req.params.id);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Lead not found' });
  res.json({ ok: true });
});

// ============================================================
//   ESCALATIONS — leads flagged for a human to take over (server/escalation.js):
//   low AI confidence before an auto-dial, frustration read off a real transcript,
//   or a genuinely high-value qualified lead. Any authenticated user can resolve
//   one (that's what "a human took over" means) — no special role needed.
// ============================================================
app.get('/api/escalations', async (req, res) => {
  const leads = await getLeads();
  const escalated = leads
    .filter(l => l.escalated)
    .sort((a, b) => (Date.parse(b.escalatedAt) || 0) - (Date.parse(a.escalatedAt) || 0));
  res.json({
    ok: true,
    escalations: escalated.map(l => ({
      id: l.id, name: l.name, phone: l.phone, project: l.project, budget: l.budget,
      interestLevel: l.interestLevel, status: l.status, agentId: l.agentId,
      escalationCategory: l.escalationCategory, escalationReason: l.escalationReason, escalatedAt: l.escalatedAt,
      // Human Handoff summary card (spec section 12) — every field traces back to
      // a real, already-stored value (server/escalation.js buildHandoffSummary).
      handoffSummary: buildHandoffSummary(l),
    })),
  });
});

app.post('/api/leads/:id/resolve-escalation', async (req, res) => {
  const lead = await getLead(req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found' });
  if (!lead.escalated) return res.status(409).json({ ok: false, error: 'Lead is not currently escalated.' });
  const updated = await updateLead(lead.id, {
    escalated: false,
    escalationResolvedBy: req.aivaUser.username,
    escalationResolvedAt: new Date().toISOString(),
  });
  res.json({ ok: true, lead: updated });
});

// ============================================================
//   TRANSCRIPT SEARCH — real, substring search across every stored call
//   transcript + summary (server/callPoller.js persists these onto
//   lead.recordings[].transcript). No indexing service — just what's actually
//   in the store, which is small enough for this to be instant.
// ============================================================
app.get('/api/leads/transcript-search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ ok: true, results: [] });
  const needle = q.toLowerCase();
  const leads = await getLeads();
  const results = [];
  for (const lead of leads) {
    for (const rec of lead.recordings || []) {
      const haystack = `${rec.transcript || ''} ${rec.summary || ''}`;
      const idx = haystack.toLowerCase().indexOf(needle);
      if (idx === -1) continue;
      const start = Math.max(0, idx - 80);
      const end = Math.min(haystack.length, idx + needle.length + 80);
      const snippet = `${start > 0 ? '…' : ''}${haystack.slice(start, end).trim()}${end < haystack.length ? '…' : ''}`;
      results.push({
        leadId: lead.id, leadName: lead.name, phone: lead.phone,
        recordingId: rec.id, date: rec.date, url: rec.url || null, snippet,
      });
    }
  }
  res.json({ ok: true, results: results.slice(0, 100) });
});

// ============================================================
//   MANAGER COMMAND CENTER — real aggregates computed from the leads/call-events
//   we actually store. No invented numbers: every field here is a count or sum
//   over real records, not a model prediction.
// ============================================================
const SKIP_INTEREST_FOR_INSIGHTS = new Set(['Not Interested', 'Wrong Number']);

app.get('/api/insights/summary', async (req, res) => {
  const [leads, events] = await Promise.all([getLeads(), getCallEvents()]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayEvents = events.filter(e => {
    const t = Date.parse(e.receivedAt);
    return !Number.isNaN(t) && t >= startOfToday.getTime();
  });

  const NO_ANSWER_STATUSES = new Set(['no-answer', 'no_answer', 'not-answered', 'not_answered', 'busy', 'failed', 'missed', 'unanswered']);
  const connectedToday = todayEvents.filter(e => !NO_ANSWER_STATUSES.has(String(e.callStatus || '').toLowerCase()));

  const QUALIFIED_INTEREST = new Set(['Hot Lead', 'Warm Lead', 'Interested']);
  const qualifiedLeads = leads.filter(l => QUALIFIED_INTEREST.has(l.interestLevel));

  const siteVisitLeads = leads.filter(l => !!l.siteVisitScheduled);

  // These are QUALIFICATION calls, not deal-value tracking — there is deliberately
  // no revenue/pipeline-value figure here. Ranking is by how interested the person
  // actually is, not by money.
  const highestIntentLead = [...qualifiedLeads].sort((a, b) => {
    const rank = { 'Hot Lead': 3, Interested: 2, 'Warm Lead': 1 };
    return (rank[b.interestLevel] || 0) - (rank[a.interestLevel] || 0);
  })[0] || null;

  // Which project real leads are actually leaning toward — the thing these calls exist to find out.
  const projectSplit = leads.reduce((acc, l) => {
    if (l.projectInterest) acc[l.projectInterest] = (acc[l.projectInterest] || 0) + 1;
    return acc;
  }, {});

  const now = Date.now();
  const NOT_DUE_STATUSES = new Set(['Completed', 'Handed Over', 'In Call']);
  const needsImmediateFollowUp = leads.filter(l => {
    if (NOT_DUE_STATUSES.has(l.status)) return false;
    if (SKIP_INTEREST_FOR_INSIGHTS.has(l.interestLevel)) return false;
    const due = Date.parse(l.nextFollowUpDate);
    return !Number.isNaN(due) && due <= now;
  });

  // Silent Momentum Alert: a lead who WAS engaged (Hot/Interested/Warm) is going
  // cold not because of anything they said, but because we stopped following the
  // pace THEY set. The decay window is derived from their own stated timeline —
  // an "Immediate" buyer going quiet for 2 days is a bigger problem than a
  // "6 Months+" browser going quiet for the same 2 days.
  const HOT_INTEREST = new Set(['Hot Lead', 'Interested', 'Warm Lead']);
  const TIMELINE_DECAY_DAYS = { Immediate: 2, '1 Month': 5, '3 Months': 10, '6 Months+': 20 };
  const silentMomentum = leads
    .filter(l => HOT_INTEREST.has(l.interestLevel) && !NOT_DUE_STATUSES.has(l.status))
    .map(l => {
      const lastContact = Date.parse(l.lastContactTime);
      if (Number.isNaN(lastContact)) return null;
      const daysSinceContact = Math.floor((now - lastContact) / 86400000);
      const threshold = TIMELINE_DECAY_DAYS[l.timeline] ?? 7;
      if (daysSinceContact <= threshold) return null;
      return { id: l.id, name: l.name, interestLevel: l.interestLevel, timeline: l.timeline, daysSinceContact };
    })
    .filter(Boolean)
    .sort((a, b) => (b.daysSinceContact - (TIMELINE_DECAY_DAYS[b.timeline] ?? 7)) - (a.daysSinceContact - (TIMELINE_DECAY_DAYS[a.timeline] ?? 7)));

  res.json({
    ok: true,
    summary: {
      todaysCalls: todayEvents.length,
      connected: connectedToday.length,
      qualified: qualifiedLeads.length,
      siteVisits: siteVisitLeads.length,
      projectSplit,
      highestIntentLead: highestIntentLead ? { id: highestIntentLead.id, name: highestIntentLead.name, interestLevel: highestIntentLead.interestLevel, projectInterest: highestIntentLead.projectInterest || null } : null,
      needsImmediateFollowUpCount: needsImmediateFollowUp.length,
      needsImmediateFollowUp: needsImmediateFollowUp.slice(0, 10).map(l => ({ id: l.id, name: l.name, nextFollowUpDate: l.nextFollowUpDate })),
      silentMomentumCount: silentMomentum.length,
      silentMomentum: silentMomentum.slice(0, 10),
      totalLeads: leads.length,
    },
  });
});

// GET /api/insights/competitor-radar — real counts of competitor/builder names
// leads have actually spoken during calls (see analyzeCall.js competitorMentions
// extraction). Every count here traces back to an actual transcript mention —
// nothing inferred or estimated.
app.get('/api/insights/competitor-radar', async (req, res) => {
  const events = await getCallEvents();
  const counts = {}; // competitor name -> { count, locations: Set, leadNames: Set }
  for (const e of events) {
    for (const name of e.competitorMentions || []) {
      if (!counts[name]) counts[name] = { count: 0, locations: new Set(), leadNames: new Set() };
      counts[name].count++;
      if (e.leadName) counts[name].leadNames.add(e.leadName);
    }
  }
  const leads = await getLeads();
  const leadByName = new Map(leads.map(l => [l.name, l]));
  const radar = Object.entries(counts).map(([competitor, v]) => {
    const locations = new Set();
    v.leadNames.forEach(n => { const l = leadByName.get(n); if (l?.location) locations.add(l.location); });
    return { competitor, mentions: v.count, distinctLeads: v.leadNames.size, locations: [...locations] };
  }).sort((a, b) => b.mentions - a.mentions);

  res.json({ ok: true, radar, totalMentions: radar.reduce((s, r) => s + r.mentions, 0) });
});

// Real week-over-week objection trend, from actual call-event timestamps — the
// same categorization used by Lost Lead Intelligence, applied to every call
// event's objections (not just lost ones), so a rising objection is caught
// before it costs a sale, not just explained after the fact.
function computeObjectionTrend(events) {
  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = { start: now - WEEK_MS, end: now };
  const lastWeek = { start: now - 2 * WEEK_MS, end: now - WEEK_MS };

  const countByCategory = (from, to) => {
    const counts = {};
    for (const e of events) {
      const t = Date.parse(e.receivedAt);
      if (Number.isNaN(t) || t < from || t > to) continue;
      const objections = e.analysis?.suggestedUpdates?.objections || [];
      for (const obj of objections) {
        const { category } = categorizeLostReason({ objections: [obj] });
        counts[category] = (counts[category] || 0) + 1;
      }
    }
    return counts;
  };

  const current = countByCategory(thisWeek.start, thisWeek.end);
  const previous = countByCategory(lastWeek.start, lastWeek.end);

  let risingCategory = null, deltaPct = 0;
  for (const [category, count] of Object.entries(current)) {
    const prevCount = previous[category] || 0;
    if (prevCount === 0 || count <= prevCount) continue;
    const pct = Math.round(((count - prevCount) / prevCount) * 100);
    if (pct > deltaPct) { deltaPct = pct; risingCategory = category; }
  }
  return risingCategory ? { risingCategory, deltaPct } : null;
}

// ============================================================
//   AIVA DAILY BRIEFING ("War Room") — the manager's morning summary. Every
//   number is real; the top-5 actions are deterministically computed
//   (server/dailyBriefing.js), never an LLM-invented list. "The team" is AIVA's
//   5 real AI agent personas — this app has no human-salesperson data model.
//   No revenue/pipeline-value figure, per explicit decision.
// ============================================================
app.get('/api/insights/daily-briefing', async (req, res) => {
  const [leads, callEvents] = await Promise.all([getLeads(), getCallEvents()]);
  const stats = buildDailyBriefingStats({ leads, agents: AGENT_ROSTER, callEvents });
  const rebalancing = recommendRebalancing(leads, AGENT_ROSTER);
  const objectionTrend = computeObjectionTrend(callEvents);
  const topActions = buildTopActions({ stats, rebalancing, objectionTrend });
  const lostReasons = summarizeLostReasons(leads);

  const { _highValueGoingCold, _needsFollowUp, _callbackRequests, ...publicStats } = stats;
  res.json({
    ok: true,
    briefing: {
      ...publicStats,
      rebalancing,
      objectionTrend,
      topActions,
      lostReasons,
      totalLeads: leads.length,
    },
  });
});

// GET /api/insights/assignment-recommendation — which real AI agent a new lead
// should go to right now, based on genuinely current (not lifetime) workload.
app.get('/api/insights/assignment-recommendation', async (req, res) => {
  const leads = await getLeads();
  const agentId = recommendAgentForNewLead(leads, AGENT_ROSTER);
  res.json({ ok: true, agentId });
});

// GET /api/insights/funnel — Sales Traffic Control (server/salesFunnel.js): real
// pipeline-stage counts with a genuine bottleneck flag, not a guess.
app.get('/api/insights/funnel', async (req, res) => {
  const leads = await getLeads();
  res.json({ ok: true, funnel: computeSalesFunnel(leads) });
});

// GET /api/insights/live-feed — AIVA Vision (server/liveFeed.js): a merged,
// time-sorted feed of real events already stored elsewhere — nothing generated
// for this route specifically.
app.get('/api/insights/live-feed', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const [leads, callEvents, inboundMessages] = await Promise.all([getLeads(), getCallEvents(), getInboundMessages()]);
  res.json({ ok: true, feed: buildLiveFeed({ leads, callEvents, inboundMessages }, limit) });
});

// ============================================================
//   SENIOR SALES DASHBOARD (spec section 16) — every tile is a real count/sum
//   over stored leads, computed fresh on each request. Deliberately NO revenue/
//   pipeline-value figure — these are qualification calls, not deal-value
//   tracking (same reasoning as /api/insights/summary above). "Average lead
//   score" is the honest stand-in for "conversion probability": a real computed
//   number, not a fabricated forecast.
// ============================================================
app.get('/api/insights/sales-dashboard', async (req, res) => {
  const leads = await getLeads();
  const now = Date.now();

  const withScore = leads.map(l => ({ lead: l, score: l.leadScore || computeLeadScore(l) }));
  const byTemperature = { Hot: 0, Warm: 0, Nurture: 0, Cold: 0 };
  for (const { score } of withScore) byTemperature[score.temperature] = (byTemperature[score.temperature] || 0) + 1;

  const siteVisits = leads.filter(l => !!l.siteVisitScheduled).length;
  const highIntentLeads = withScore.filter(({ score }) => score.temperature === 'Hot').length;
  const NOT_DUE_STATUSES = new Set(['Completed', 'Handed Over', 'In Call']);
  const followUpsDue = leads.filter(l => {
    if (NOT_DUE_STATUSES.has(l.status) || l.escalated) return false;
    const due = Date.parse(l.nextFollowUpDate);
    return !Number.isNaN(due) && due <= now;
  }).length;
  const leadsRequiringHumanAttention = leads.filter(l => l.escalated).length;

  const lostLeads = leads
    .filter(l => l.interestLevel === 'Not Interested')
    .map(l => ({ id: l.id, name: l.name, reason: l.qualificationReason || l.remarks || 'No reason recorded.' }));

  const objectionCounts = {};
  for (const l of leads) {
    const objs = new Set([...(l.objections || []), ...(l.salesBrain?.objectionHistory || [])]);
    for (const raw of objs) {
      const o = String(raw || '').trim();
      if (o) objectionCounts[o] = (objectionCounts[o] || 0) + 1;
    }
  }
  const topObjections = Object.entries(objectionCounts).map(([objection, count]) => ({ objection, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  const byProject = {};
  for (const l of leads) {
    const key = l.project || 'Unassigned';
    if (!byProject[key]) byProject[key] = { total: 0, qualified: 0, hot: 0, siteVisits: 0, converted: 0 };
    byProject[key].total++;
    if (l.qualified === true) byProject[key].qualified++;
    if (l.leadScore?.temperature === 'Hot') byProject[key].hot++;
    if (l.siteVisitScheduled) byProject[key].siteVisits++;
    if (l.status === 'Handed Over') byProject[key].converted++;
  }
  const topPerformingProjects = Object.entries(byProject)
    .map(([project, v]) => ({
      project, total: v.total, qualified: v.qualified, hot: v.hot, siteVisits: v.siteVisits, converted: v.converted,
      qualifiedRate: v.total > 0 ? Math.round((v.qualified / v.total) * 100) : null,
    }))
    .sort((a, b) => b.qualified - a.qualified || b.total - a.total)
    .slice(0, 5);

  const averageLeadScore = withScore.length > 0
    ? Math.round(withScore.reduce((s, { score }) => s + score.value, 0) / withScore.length)
    : 0;

  res.json({
    ok: true,
    dashboard: {
      totalLeads: leads.length,
      byTemperature,
      siteVisits,
      highIntentLeads,
      followUpsDue,
      leadsRequiringHumanAttention,
      lostLeads: lostLeads.slice(0, 20),
      lostLeadsCount: lostLeads.length,
      topObjections,
      topPerformingProjects,
      averageLeadScore,
    },
  });
});

// GET /api/insights/ceo-brief — real breakdowns (conversion by source, by agent,
// by time-of-day, stale-lead count) with a Gemini narration ON TOP of those exact
// numbers. Gemini is only ever narrating what's given, never estimating anything
// itself — every number in the prose traces back to a number in `stats`. Sample
// sizes are always included and small ones are explicitly flagged so an early-
// stage account isn't shown false confidence.
app.get('/api/insights/ceo-brief', async (req, res) => {
  const [leads, events] = await Promise.all([getLeads(), getCallEvents()]);
  const QUALIFIED = new Set(['Hot Lead', 'Interested', 'Handed Over']);

  const bySource = {};
  for (const l of leads) {
    const key = l.source || 'Unknown';
    if (!bySource[key]) bySource[key] = { total: 0, qualified: 0 };
    bySource[key].total++;
    if (QUALIFIED.has(l.interestLevel) || l.status === 'Handed Over') bySource[key].qualified++;
  }
  const sourceStats = Object.entries(bySource).map(([source, v]) => ({
    source, total: v.total, qualified: v.qualified,
    qualifiedRate: v.total > 0 ? Math.round((v.qualified / v.total) * 100) : null,
  })).sort((a, b) => b.total - a.total);

  const byAgent = {};
  for (const l of leads) {
    const key = l.agentId || 'unassigned';
    if (!byAgent[key]) byAgent[key] = { total: 0, qualified: 0 };
    byAgent[key].total++;
    if (QUALIFIED.has(l.interestLevel) || l.status === 'Handed Over') byAgent[key].qualified++;
  }
  const agentStats = Object.entries(byAgent).map(([agentId, v]) => ({
    agentId, total: v.total, qualified: v.qualified,
    qualifiedRate: v.total > 0 ? Math.round((v.qualified / v.total) * 100) : null,
  })).sort((a, b) => b.total - a.total);

  // Time-of-day buckets, from real call event timestamps + that call's own outcome.
  const bucketOf = (hour) => (hour < 12 ? 'Morning (before 12pm)' : hour < 18 ? 'Afternoon (12–6pm)' : 'Evening (after 6pm)');
  const byTimeOfDay = {};
  for (const e of events) {
    const t = new Date(e.receivedAt);
    if (Number.isNaN(t.getTime())) continue;
    const bucket = bucketOf(t.getHours());
    if (!byTimeOfDay[bucket]) byTimeOfDay[bucket] = { total: 0, qualified: 0 };
    byTimeOfDay[bucket].total++;
    if (QUALIFIED.has(e.analysis?.suggestedUpdates?.interestLevel)) byTimeOfDay[bucket].qualified++;
  }
  const timeOfDayStats = Object.entries(byTimeOfDay).map(([bucket, v]) => ({
    bucket, total: v.total, qualified: v.qualified,
    qualifiedRate: v.total > 0 ? Math.round((v.qualified / v.total) * 100) : null,
  }));

  const now = Date.now();
  const STALE_DAYS = 60;
  const staleLeads = leads.filter(l => {
    if (['Completed', 'Handed Over'].includes(l.status)) return false;
    const t = Date.parse(l.dateTime);
    return !Number.isNaN(t) && (now - t) / 86400000 > STALE_DAYS;
  });

  // Executive "Why" ingredient: real objection themes across the whole pipeline —
  // both the last call's objections AND the AI Sales Brain's accumulated history
  // (server/salesBrain.js) so a lead who raised the same objection on call 1 and
  // call 3 is counted once, not twice. Every entry traces back to something a real
  // lead actually said (server/analyzeCall.js extraction) — never inferred here.
  const objectionCounts = {};
  for (const l of leads) {
    const objs = new Set([...(l.objections || []), ...(l.salesBrain?.objectionHistory || [])]);
    for (const raw of objs) {
      const o = String(raw || '').trim();
      if (!o) continue;
      objectionCounts[o] = (objectionCounts[o] || 0) + 1;
    }
  }
  const topObjections = Object.entries(objectionCounts)
    .map(([objection, count]) => ({ objection, count, pctOfLeads: leads.length > 0 ? Math.round((count / leads.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const stats = { sourceStats, agentStats, timeOfDayStats, topObjections, staleLeadsCount: staleLeads.length, staleLeadsThresholdDays: STALE_DAYS, totalLeads: leads.length };

  const key = process.env.GEMINI_API_KEY || '';
  const MIN_SAMPLE_FOR_NARRATION = 5;
  if (!key || leads.length < MIN_SAMPLE_FOR_NARRATION) {
    return res.json({ ok: true, stats, narrative: null, narrativeSkippedReason: !key ? 'No GEMINI_API_KEY configured.' : `Only ${leads.length} leads on record — too little data for a reliable narrative yet.` });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = `You are briefing a CEO on their real-estate sales operation. Use ONLY the numbers below — never estimate, round dramatically, or state anything not directly supported by them. If a breakdown has a small sample (under 10), say so explicitly rather than presenting it as a solid trend.

${JSON.stringify(stats, null, 2)}

Write 3-5 short, direct bullet-style sentences of executive advice (no markdown bullets, just short sentences on separate lines) — what to double down on, what to stop, and what's under-sampled and needs more data before acting on it. Plain text only.`;
    const result = await ai.models.generateContent({ model: 'gemini-flash-latest', contents: prompt });
    res.json({ ok: true, stats, narrative: (result?.text || '').trim() || null });
  } catch (e) {
    res.json({ ok: true, stats, narrative: null, narrativeSkippedReason: `Gemini narration failed: ${e.message}` });
  }
});

// ============================================================
//   EVOLUTION ENGINE — A/B tested call-strategy variants. Every call that goes
//   out while variants are active gets randomly assigned one (see call dispatch
//   below); outcomes are attributed back so real conversion stats accumulate.
//   New variants always start as drafts — a manager must explicitly PATCH a
//   variant's status to "active" before it's ever used on a real call.
// ============================================================
app.get('/api/script-variants', async (req, res) => {
  res.json({ ok: true, variants: await getScriptVariants() });
});

app.post('/api/script-variants', async (req, res) => {
  const body = req.body || {};
  if (!body.name) return res.status(400).json({ ok: false, error: 'name is required' });
  const variant = {
    id: `variant_${Date.now()}`,
    name: body.name,
    agentId: body.agentId || null, // null = applies to all agents
    openingStyle: body.openingStyle || '',
    mainFocus: body.mainFocus || '',
    avoid: body.avoid || '',
    goal: body.goal || '',
    negotiationApproach: body.negotiationApproach || '',
    status: 'draft', // draft -> active -> archived; only a manager PATCH can promote/archive
    source: body.source || 'manual',
    rationale: body.rationale || '',
    createdAt: new Date().toISOString(),
  };
  const saved = await upsertScriptVariant(variant);
  res.json({ ok: true, variant: saved });
});

app.patch('/api/script-variants/:id', async (req, res) => {
  const variants = await getScriptVariants();
  const existing = variants.find(v => v.id === req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Variant not found' });
  const updates = req.body || {};
  if (updates.status && !['draft', 'active', 'archived'].includes(updates.status)) {
    return res.status(400).json({ ok: false, error: 'status must be draft, active, or archived' });
  }
  const saved = await upsertScriptVariant({ ...existing, ...updates, id: existing.id });
  res.json({ ok: true, variant: saved });
});

app.delete('/api/script-variants/:id', async (req, res) => {
  const deleted = await deleteScriptVariant(req.params.id);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Variant not found' });
  res.json({ ok: true });
});

// GET /api/script-variants/stats — real per-variant call counts + qualified rate,
// computed from call events actually tagged with that variant. N is always shown
// so a manager never mistakes a 2-call sample for a proven result.
app.get('/api/script-variants/stats', async (req, res) => {
  const [variants, events] = await Promise.all([getScriptVariants(), getCallEvents()]);
  res.json({ ok: true, stats: computeVariantStats(variants, events) });
});

// POST /api/script-variants/:id/suggest — Gemini proposes an improved DRAFT
// variant, grounded only in real call summaries from calls that used this
// variant and actually qualified. Never auto-activates.
app.post('/api/script-variants/:id/suggest', async (req, res) => {
  const variants = await getScriptVariants();
  const source = variants.find(v => v.id === req.params.id);
  if (!source) return res.status(404).json({ ok: false, error: 'Variant not found' });

  const events = await getCallEvents();
  const QUALIFIED = new Set(['Hot Lead', 'Interested']);
  const summaries = events
    .filter(e => e.scriptVariantId === source.id && QUALIFIED.has(e.analysis?.suggestedUpdates?.interestLevel))
    .map(e => e.summary || e.analysis?.suggestedUpdates?.remarks)
    .filter(Boolean)
    .slice(0, 20);

  const result = await suggestVariant(source, summaries);
  if (!result.ok) return res.status(502).json({ ok: false, error: result.reason });

  const draft = {
    id: `variant_${Date.now()}`,
    name: result.suggestion.name,
    agentId: source.agentId,
    openingStyle: result.suggestion.openingStyle,
    mainFocus: result.suggestion.mainFocus,
    avoid: result.suggestion.avoid,
    goal: result.suggestion.goal,
    negotiationApproach: result.suggestion.negotiationApproach || '',
    status: 'draft',
    source: 'ai_suggested',
    rationale: result.suggestion.rationale,
    basedOnVariantId: source.id,
    createdAt: new Date().toISOString(),
  };
  const saved = await upsertScriptVariant(draft);
  res.json({ ok: true, variant: saved });
});

// ============================================================
//   CAMPAIGNS — real bulk outbound calling. Creating a campaign snapshots the
//   leads that match a filter RIGHT NOW (so the target list never silently
//   drifts between review and launch); launching places REAL Omnidimension
//   calls to each one, sequentially, using the exact same agent-resolution and
//   strategy logic as a single manual dial. Nothing here is simulated — a
//   launched campaign places real phone calls to real people.
// ============================================================
// Safety cap on how many real calls one campaign can queue — bounded by both risk
// (bulk real-calling should never be a single unbounded blast) and the deployed
// function's 300s timeout for the sequential dispatch loop in the launch route below.
const MAX_CAMPAIGN_SIZE = 80;

function matchesCampaignFilters(lead, filters) {
  if (filters.interestLevel && lead.interestLevel !== filters.interestLevel) return false;
  if (filters.source && lead.source !== filters.source) return false;
  if (filters.status && lead.status !== filters.status) return false;
  if (filters.agentId && lead.agentId !== filters.agentId) return false;
  return true;
}

// Leads that should never be included in a bulk campaign, regardless of filter —
// same "don't call again" / "already in flight" rules the autonomous scheduler respects.
const CAMPAIGN_EXCLUDED_STATUSES = new Set(['Handed Over', 'Completed', 'In Call']);
const CAMPAIGN_EXCLUDED_INTEREST = new Set(['Not Interested', 'Wrong Number']);

app.get('/api/campaigns', async (req, res) => {
  res.json({ ok: true, campaigns: await getCampaigns() });
});

// POST /api/campaigns  { name, filters: { interestLevel?, source?, status?, agentId? } }
// Resolves the filter against real leads NOW and stores that exact list — review
// this list before launching, since new leads created afterward are NOT included.
app.post('/api/campaigns', async (req, res) => {
  const { name, filters } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'name is required' });

  const leads = await getLeads();
  const matched = leads.filter(l =>
    matchesCampaignFilters(l, filters || {}) &&
    !CAMPAIGN_EXCLUDED_STATUSES.has(l.status) &&
    !CAMPAIGN_EXCLUDED_INTEREST.has(l.interestLevel) &&
    !l.escalated // flagged for a human — a bulk campaign must never blast-call them
  );
  if (matched.length === 0) return res.status(422).json({ ok: false, error: 'No callable leads match these filters.' });
  if (matched.length > MAX_CAMPAIGN_SIZE) {
    return res.status(422).json({ ok: false, error: `${matched.length} leads match — narrow your filters. Campaigns are capped at ${MAX_CAMPAIGN_SIZE} real calls at a time for safety.` });
  }

  const campaign = {
    id: `campaign_${Date.now()}`,
    name: name.trim(),
    filters: filters || {},
    leadIds: matched.map(l => l.id),
    leadNames: matched.map(l => l.name),
    status: 'draft',
    createdAt: new Date().toISOString(),
    launchedAt: null,
    results: [],
    dispatchedCount: 0,
    failedCount: 0,
  };
  const saved = await upsertCampaign(campaign);
  res.json({ ok: true, campaign: saved });
});

app.delete('/api/campaigns/:id', async (req, res) => {
  const deleted = await deleteCampaign(req.params.id);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Campaign not found' });
  res.json({ ok: true });
});

// POST /api/campaigns/:id/launch — places REAL calls to every lead in the
// campaign's snapshot, one at a time (not parallel, so we don't hammer
// Omnidimension's API), skipping anyone whose status changed to no-longer-
// callable since the campaign was created (e.g. they were already contacted).
app.post('/api/campaigns/:id/launch', async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ ok: false, error: 'Campaign not found' });
  if (campaign.status !== 'draft') return res.status(409).json({ ok: false, error: `Campaign already ${campaign.status}.` });

  const settings = await getSettings();
  // Calling-hours guard (server/callWindow.js) — a bulk campaign is real calls to
  // real people too; never let it launch outside the configured window.
  if (!isWithinCallWindow(new Date(), settings)) {
    return res.status(422).json({ ok: false, error: `Outside calling hours (${formatCallWindow(settings)}). Real leads are never dialed outside this window.` });
  }

  await upsertCampaign({ ...campaign, status: 'launching' });

  const activeVariants = await getScriptVariants();
  const results = [];

  for (const leadId of campaign.leadIds) {
    const lead = await getLead(leadId);
    if (!lead) { results.push({ leadId, leadName: '(deleted)', ok: false, error: 'Lead no longer exists' }); continue; }
    if (CAMPAIGN_EXCLUDED_STATUSES.has(lead.status) || CAMPAIGN_EXCLUDED_INTEREST.has(lead.interestLevel)) {
      results.push({ leadId, leadName: lead.name, ok: false, error: `Skipped — lead is now ${lead.status}/${lead.interestLevel}` });
      continue;
    }
    if (lead.escalated) {
      results.push({ leadId, leadName: lead.name, ok: false, error: 'Skipped — lead is flagged for human review' });
      continue;
    }
    const resolvedAgentId = resolveOmnidimAgentId(lead, settings);
    if (!resolvedAgentId) {
      results.push({ leadId, leadName: lead.name, ok: false, error: 'No Omnidimension agent mapped for this lead' });
      continue;
    }
    const variant = pickVariantForAgent(activeVariants, lead.agentId);
    let strategy = variant || lead.callStrategy;
    if (!strategy) {
      const research = await withTimeout(generateLeadIntelligence(lead), 8000).catch(() => ({ ok: false }));
      if (research.ok) {
        strategy = research.callStrategy;
        await updateLead(lead.id, { leadIntelligence: research.leadIntelligence, callStrategy: research.callStrategy, recommendation: research.recommendation });
      }
    }
    try {
      const dispatchResult = await dispatchCall({
        agentId: resolvedAgentId,
        toNumber: lead.phone,
        fromNumberId: settings.fromNumberId,
        callContext: {
          lead_id: lead.id,
          lead_name: lead.name,
          project: lead.project,
          budget: lead.budget,
          interest_level: lead.interestLevel,
          reason: 'campaign',
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          ...(strategy ? {
            call_opening_style: strategy.openingStyle,
            call_main_focus: strategy.mainFocus,
            call_avoid: strategy.avoid,
            call_goal: strategy.goal,
            ...(strategy.negotiationApproach ? { call_negotiation_approach: strategy.negotiationApproach } : {}),
          } : {}),
          ...(variant ? { script_variant_id: variant.id } : {}),
          ...(lead.salesBrain?.callCount ? { sales_brain_briefing: buildSalesBrainBriefing(lead) } : {}),
          // Property Recommendation Engine (server/recommendation.js) — real
          // budget/location matching against the actual catalogue, computed once
          // during pre-call research and reused here.
          ...(lead.recommendation ? { call_recommended_project: lead.recommendation.recommendedProject, call_recommendation_reason: lead.recommendation.reason } : {}),
        },
      });
      await updateLead(lead.id, { status: 'In Call', activeScriptVariantId: variant?.id || null });
      results.push({ leadId, leadName: lead.name, ok: true, requestId: dispatchResult.requestId });
    } catch (e) {
      results.push({ leadId, leadName: lead.name, ok: false, error: e.message });
    }
  }

  const dispatchedCount = results.filter(r => r.ok).length;
  const failedCount = results.length - dispatchedCount;
  const finished = await upsertCampaign({
    ...campaign, status: 'completed', launchedAt: new Date().toISOString(), results, dispatchedCount, failedCount,
  });
  res.json({ ok: true, campaign: finished });
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
  // Calling-hours guard (server/callWindow.js) — applies to manual dials too, not
  // just autonomous ones; the explicit rule was "no calls to leads" outside the
  // window, not "no automated calls".
  if (!isWithinCallWindow(new Date(), settings)) {
    return res.status(422).json({ ok: false, error: `Outside calling hours (${formatCallWindow(settings)}). Real leads are never dialed outside this window.` });
  }
  const resolvedAgentId = resolveOmnidimAgentId(lead, settings);
  if (!resolvedAgentId) {
    return res.status(422).json({
      ok: false,
      error: `No Omnidimension agent configured for ${lead.agentId ? `this lead's assigned agent (${lead.agentId})` : 'this lead'}, and no default agent set. Configure agent IDs in Settings.`,
    });
  }

  // Evolution Engine: if a manager has activated an A/B test variant for this
  // agent, that takes priority over the per-lead strategy — the whole point is
  // to test a standardized script against real outcomes, not vary it per-lead.
  const activeVariants = await getScriptVariants();
  const variant = pickVariantForAgent(activeVariants, lead.agentId);

  // AI Sales Employee, step 2: give the agent a per-lead strategy instead of one
  // fixed script for everyone. Generate on first dial if we don't have one yet;
  // best-effort — a missing/failed strategy never blocks the call itself.
  let strategy = variant || lead.callStrategy;
  if (!strategy) {
    const research = await withTimeout(generateLeadIntelligence(lead), 8000).catch(() => ({ ok: false }));
    if (research.ok) {
      strategy = research.callStrategy;
      await updateLead(lead.id, { leadIntelligence: research.leadIntelligence, callStrategy: research.callStrategy, recommendation: research.recommendation });
    }
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
        ...(strategy ? {
          call_opening_style: strategy.openingStyle,
          call_main_focus: strategy.mainFocus,
          call_avoid: strategy.avoid,
          call_goal: strategy.goal,
          ...(strategy.negotiationApproach ? { call_negotiation_approach: strategy.negotiationApproach } : {}),
        } : {}),
        ...(variant ? { script_variant_id: variant.id } : {}),
        // AI Sales Brain (server/salesBrain.js): real accumulated memory from past
        // calls with THIS lead — personality, objections, family context — so the
        // agent can reference actual history instead of starting cold every time.
        ...(lead.salesBrain?.callCount ? { sales_brain_briefing: buildSalesBrainBriefing(lead) } : {}),
      },
    });
    await updateLead(lead.id, { status: 'In Call', activeScriptVariantId: variant?.id || null });
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

  // All do-not-call / retry / blacklist-protection rules come from the single tested
  // module shared with callPoller.js (the primary production sync path), so the two
  // paths cannot drift. See server/__tests__/callOutcomeRules.test.js.
  if (lead) {
    analysis.suggestedUpdates = decideLeadUpdates({
      lead,
      callStatus: payload?.call_status,
      analysis,
    });

    const settingsForWorkflow = await getSettings();
    if (shouldSendAutoBrochure({
      lead,
      noAnswerStreak: analysis.suggestedUpdates.noAnswerStreak,
      threshold: settingsForWorkflow.autoBrochureAfterNoAnswers || 0,
      whatsappConfigured: isWhatsAppConfigured(),
    })) {
      try {
        await sendBrochure(lead.phone, getContent());
        analysis.suggestedUpdates.brochureSent = true;
        console.log(`[AIVA workflow] Auto-sent brochure to ${lead.name} after ${analysis.suggestedUpdates.noAnswerStreak} consecutive no-answers.`);
      } catch (e) {
        console.log(`[AIVA workflow] Auto-brochure failed for ${lead.name}: ${e.message}`);
      }
    }
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
    // Evolution Engine attribution: snapshot which variant was actually dispatched
    // for THIS call (not the lead's current state, which may change on later calls).
    scriptVariantId: lead?.activeScriptVariantId || payload?.call_context?.script_variant_id || null,
    // Competitor Radar: real names the lead spoke this call, if any.
    competitorMentions: analysis.competitorMentions || [],
    analysis,
  };
  await addCallEvent(event);

  if (lead && analysis.suggestedUpdates && Object.keys(analysis.suggestedUpdates).length > 0) {
    const mergedCompetitors = event.competitorMentions.length
      ? [...new Set([...(lead.competitorMentions || []), ...event.competitorMentions])]
      : lead.competitorMentions;
    // Escalation (server/escalation.js) — same real post-call signals as the
    // primary poller path (see callPoller.js), kept for parity in case a webhook
    // ever does get configured on the agents.
    const webhookSettings = await getSettings();
    const escalation = computeEscalation({
      interestLevel: analysis.suggestedUpdates?.interestLevel ?? lead.interestLevel,
      budget: lead.budget,
      frustrationDetected: analysis.suggestedUpdates?.frustrationDetected,
      frustrationReason: analysis.frustrationReason,
      escalationSignals: analysis.escalationSignals,
      settings: webhookSettings,
    });
    const salesBrain = mergeSalesBrain(lead.salesBrain, analysis.salesBrainSignals);
    const buyingSignals = mergeBuyingSignals(lead.buyingSignals, analysis.buyingSignals);
    const leadScore = computeLeadScore({
      ...lead, ...(analysis.suggestedUpdates || {}), ...(escalation || {}), salesBrain, buyingSignals,
    });
    let updatedLead = await updateLead(lead.id, {
      ...analysis.suggestedUpdates,
      lastContactTime: new Date().toLocaleString(),
      callDuration: `${payload?.call_duration || 0}s`,
      ...(mergedCompetitors ? { competitorMentions: mergedCompetitors } : {}),
      ...(escalation || {}),
      salesBrain,
      buyingSignals,
      leadScore,
      ...(analysis.siteVisitRequest ? { siteVisitRequest: analysis.siteVisitRequest } : {}),
    });

    // WhatsApp Property Sharing (server/propertySharing.js) — same real-intent
    // trigger as the primary poller path (see callPoller.js), for parity.
    if (updatedLead) {
      const propertyConfigByProject = await getPropertyConfig();
      const waUpdates = await runWhatsAppPropertySharing({
        lead: updatedLead, whatsappIntent: analysis.whatsappIntent, settings: webhookSettings, propertyConfigByProject,
      });
      if (waUpdates) updatedLead = await updateLead(updatedLead.id, waUpdates);
    }
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

// ============================================================
//   AI PROXY — the voice widget (AIVA + per-agent chat) used to call
//   Gemini directly from the browser using a key typed into Settings and
//   stored in localStorage. That key only existed on whichever single
//   browser it was entered into, so any new device/browser/cleared cache
//   silently fell back to a dumb canned-response "basic mode" with no
//   clear error — this is what caused the "AIVA isn't working" reports.
//   These routes let the frontend use the server's own GEMINI_API_KEY
//   instead, so voice/chat works everywhere without per-browser setup.
// ============================================================
// The voice assistants ask for the business briefing by flag rather than sending it
// themselves — that keeps server/businessFacts.js the single source of truth and
// avoids shipping ~2KB of prompt text into the browser bundle on every page load.
function withBusinessContext(systemInstruction, includeBusinessContext) {
  if (!includeBusinessContext) return systemInstruction;
  const briefing = buildBusinessBriefing();
  return systemInstruction ? `${systemInstruction}\n\n${briefing}` : briefing;
}

// GET /api/ai/health — is the AI layer actually working right now?
// AIVA previously ran at a 99% analysis-failure rate with nothing surfacing it;
// the dashboard looked healthy while almost every call went unanalyzed. This
// endpoint makes that state observable instead of silent.
app.get('/api/ai/health', async (req, res) => {
  const events = await getCallEvents();
  const analyzable = events.filter(e => e.analysis?.reason !== 'No transcript available to analyze.');
  const failed = analyzable.filter(e => e.analysis?.analyzed === false).length;
  res.json({
    ok: true,
    keyConfigured: !!process.env.GEMINI_API_KEY,
    runtime: getGeminiStats(), // this process's live call outcomes
    stored: {
      totalEvents: events.length,
      // Calls with no transcript at all (usually genuine no-answers) are excluded —
      // counting them as "AI failures" would overstate the problem.
      analyzableEvents: analyzable.length,
      failedAnalyses: failed,
      failureRate: analyzable.length ? Math.round((failed / analyzable.length) * 100) : null,
    },
  });
});

function requireGeminiKey(res) {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) {
    res.status(503).json({ ok: false, error: 'Server has no GEMINI_API_KEY configured.' });
    return null;
  }
  return key;
}

// POST /api/ai/chat  { contents, systemInstruction } -> { text }
app.post('/api/ai/chat', async (req, res) => {
  const key = requireGeminiKey(res);
  if (!key) return;
  try {
    const { contents, systemInstruction, includeBusinessContext } = req.body || {};
    if (!contents) return res.status(400).json({ ok: false, error: 'contents is required' });
    const finalInstruction = withBusinessContext(systemInstruction, includeBusinessContext);
    const ai = new GoogleGenAI({ apiKey: key });
    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents,
      config: finalInstruction ? { systemInstruction: finalInstruction } : undefined,
    });
    res.json({ ok: true, text: result?.text || '' });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// POST /api/ai/chat-stream  { contents, systemInstruction } -> text/event-stream of {text} chunks
app.post('/api/ai/chat-stream', async (req, res) => {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) {
    res.status(503).json({ ok: false, error: 'Server has no GEMINI_API_KEY configured.' });
    return;
  }
  const { contents, systemInstruction, includeBusinessContext } = req.body || {};
  if (!contents) { res.status(400).json({ ok: false, error: 'contents is required' }); return; }
  const finalInstruction = withBusinessContext(systemInstruction, includeBusinessContext);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const stream = await ai.models.generateContentStream({
      model: 'gemini-flash-latest',
      contents,
      config: finalInstruction ? { systemInstruction: finalInstruction } : undefined,
    });
    for await (const chunk of stream) {
      const t = chunk?.text || '';
      if (t) res.write(`data: ${JSON.stringify({ text: t })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
  }
  res.end();
});

// POST /api/ai/tts  { text, voiceName } -> { audioBase64, mimeType } (raw PCM, base64-encoded)
app.post('/api/ai/tts', async (req, res) => {
  const key = requireGeminiKey(res);
  if (!key) return;
  try {
    const { text, voiceName } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: 'text is required' });
    const ai = new GoogleGenAI({ apiKey: key });
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' } } },
      },
    });
    const part = result?.candidates?.[0]?.content?.parts?.[0];
    const inline = part?.inlineData;
    if (!inline?.data) return res.status(502).json({ ok: false, error: 'Gemini TTS returned no audio data' });
    res.json({ ok: true, audioBase64: inline.data, mimeType: inline.mimeType || 'audio/pcm;rate=24000' });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Manually trigger a follow-up sweep (useful for testing without waiting for the interval)
app.post('/api/omnidim/run-sweep-now', async (req, res) => {
  const result = await runFollowUpSweep(console.log);
  res.json({ ok: true, result });
});

// Manually trigger the WhatsApp smart-follow-up sweep (server/propertySharing.js)
app.post('/api/whatsapp/run-followup-sweep-now', async (req, res) => {
  const result = await runWhatsAppFollowUpSweep(console.log);
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

export default app;
