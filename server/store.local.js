// Simple JSON-file persistence for leads, call events, and settings.
// Used for LOCAL DEV only (npm run server) — see store.js for the switch that
// picks this vs. store.firestore.js depending on where the process is running.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildDefaultPropertyConfig } from './businessFacts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const CALL_EVENTS_FILE = path.join(DATA_DIR, 'call-events.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const SCRIPT_VARIANTS_FILE = path.join(DATA_DIR, 'script-variants.json');
const INBOUND_MESSAGES_FILE = path.join(DATA_DIR, 'inbound-messages.json');
const OUTBOUND_MESSAGES_FILE = path.join(DATA_DIR, 'outbound-messages.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit-log.json');
const PROPERTY_CONFIG_FILE = path.join(DATA_DIR, 'property-config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDataDir();
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ---- Leads ----
export async function getLeads() {
  return readJson(LEADS_FILE, []);
}

export async function seedLeadsIfEmpty(initialLeads) {
  const existing = await getLeads();
  if (existing.length === 0 && Array.isArray(initialLeads) && initialLeads.length > 0) {
    writeJson(LEADS_FILE, initialLeads);
    return initialLeads;
  }
  return existing;
}

export async function clearLeads() {
  writeJson(LEADS_FILE, []);
  return [];
}

// Adds leads that don't already exist (matched by phone number), updates ones that do.
// Returns { added, updated } counts so callers can report what actually happened.
export async function upsertLeadsByPhone(newLeads) {
  const leads = await getLeads();
  const byPhone = new Map(leads.map(l => [l.phone, l]));
  let added = 0, updated = 0;
  for (const nl of newLeads) {
    const existing = byPhone.get(nl.phone);
    if (existing) {
      Object.assign(existing, nl, { id: existing.id }); // keep original id, refresh the rest
      updated++;
    } else {
      leads.push(nl);
      byPhone.set(nl.phone, nl);
      added++;
    }
  }
  writeJson(LEADS_FILE, leads);
  return { added, updated, leads };
}

export async function updateLead(id, updates) {
  const leads = await getLeads();
  const idx = leads.findIndex(l => l.id === id);
  if (idx === -1) return null;
  leads[idx] = { ...leads[idx], ...updates };
  writeJson(LEADS_FILE, leads);
  return leads[idx];
}

export async function getLead(id) {
  const leads = await getLeads();
  return leads.find(l => l.id === id) || null;
}

export async function deleteLead(id) {
  const leads = await getLeads();
  const next = leads.filter(l => l.id !== id);
  const deleted = next.length !== leads.length;
  if (deleted) writeJson(LEADS_FILE, next);
  return deleted;
}

// ---- Call events (Omnidimension call history + AI analysis) ----
export async function getCallEvents() {
  return readJson(CALL_EVENTS_FILE, []);
}

export async function addCallEvent(event) {
  const events = await getCallEvents();
  events.unshift(event); // newest first
  writeJson(CALL_EVENTS_FILE, events.slice(0, 200)); // cap growth
}

// ---- Settings (autonomous dialing toggle, default agent, dialed-today tracking) ----
const DEFAULT_SETTINGS = {
  autoDialEnabled: false, // SAFETY DEFAULT: never places real calls until an admin explicitly turns this on
  defaultAgentId: null, // fallback Omnidimension agent ID, used if a lead's assigned AIVA agent has no mapping below
  agentIdMap: { agent_1: null, agent_2: null, agent_3: null, agent_4: null, agent_5: null, agent_6: null }, // AIVA agent id -> Omnidimension agent id (Kavya/Arjun/Ananya/Rohan/Priya/Vistara — agent_6=Vistara is a second real client, RK Developers, never auto-assigned regular leads)
  fromNumberId: null,
  lastDialedByLead: {}, // leadId -> ISO date string, to avoid re-dialing the same lead multiple times a day
  lastProcessedCallId: 0, // highest Omnidimension call-log id already synced into leads (see callPoller.js)
  // Workflows: auto-send the real WhatsApp brochure after N consecutive no-answer
  // calls to the same lead. 0 = off (default — never sends anything on its own).
  autoBrochureAfterNoAnswers: 0,
  // Escalation / human handoff (server/escalation.js) — ON by default because it
  // only ever SKIPS an autonomous action in favor of flagging a human, never takes
  // a new real-world action on its own.
  humanHandoffEnabled: true,
  humanHandoffConfidenceThreshold: 40, // leadIntelligence.confidence below this -> skip auto-dial, flag for a human
  escalationHighValueBudget: 4000000, // budget (INR) at/above which a qualified lead is flagged high-value
  // WhatsApp Property Sharing (server/propertySharing.js) — SAFETY DEFAULT: never
  // auto-sends anything until an admin explicitly turns this on, same as autoDialEnabled.
  whatsappAutoShareEnabled: false,
  whatsappFollowUpDelayHours: 3, // "2-4 hours" per spec — real check-in text sent this long after property details went out
  whatsappFollowUpMaxAttempts: 1, // how many automated check-ins before AIVA stops nudging a non-responder
  // Calling-hours guard (server/callWindow.js) — explicit client rule, 2026-08-12:
  // real leads are never dialed outside this window. Always computed in real IST.
  callWindowStartHour: 11, // 11:00 AM
  callWindowEndHour: 19.5, // 7:30 PM
};

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_FILE, {}) };
}

export async function updateSettings(updates) {
  const current = await getSettings();
  const next = {
    ...current,
    ...updates,
    // Deep-merge agentIdMap so saving one agent's ID doesn't wipe the others.
    agentIdMap: { ...current.agentIdMap, ...(updates.agentIdMap || {}) },
  };
  writeJson(SETTINGS_FILE, next);
  return next;
}

export async function markDialedToday(leadId) {
  const settings = await getSettings();
  settings.lastDialedByLead[leadId] = new Date().toISOString().split('T')[0];
  writeJson(SETTINGS_FILE, settings);
}

export async function wasDialedToday(leadId) {
  const settings = await getSettings();
  const today = new Date().toISOString().split('T')[0];
  return settings.lastDialedByLead[leadId] === today;
}

// ---- WhatsApp Property Sharing config — per real project (server/businessFacts.js
// PROJECTS), admin-editable via Settings. Defaults seeded once from real catalogue
// facts (see buildDefaultPropertyConfig) with asset/coordinate fields left empty
// until an admin actually supplies them — never a fabricated brochure/map pin.
export async function getPropertyConfig() {
  const defaults = buildDefaultPropertyConfig();
  const stored = readJson(PROPERTY_CONFIG_FILE, {});
  const merged = {};
  for (const project of Object.keys(defaults)) {
    merged[project] = { ...defaults[project], ...(stored[project] || {}) };
  }
  return merged;
}

export async function updatePropertyConfigForProject(project, updates) {
  const current = await getPropertyConfig();
  if (!current[project]) throw new Error(`Unknown project "${project}".`);
  const next = { ...current, [project]: { ...current[project], ...updates, updatedAt: new Date().toISOString() } };
  writeJson(PROPERTY_CONFIG_FILE, next);
  return next[project];
}

// ---- Script variants (Evolution Engine — A/B tested call strategies) ----
export async function getScriptVariants() {
  return readJson(SCRIPT_VARIANTS_FILE, []);
}

export async function upsertScriptVariant(variant) {
  const variants = await getScriptVariants();
  const idx = variants.findIndex(v => v.id === variant.id);
  if (idx === -1) {
    variants.push(variant);
  } else {
    variants[idx] = { ...variants[idx], ...variant };
  }
  writeJson(SCRIPT_VARIANTS_FILE, variants);
  return idx === -1 ? variant : variants[idx];
}

export async function deleteScriptVariant(id) {
  const variants = await getScriptVariants();
  const next = variants.filter(v => v.id !== id);
  const deleted = next.length !== variants.length;
  if (deleted) writeJson(SCRIPT_VARIANTS_FILE, next);
  return deleted;
}

// ---- Inbound WhatsApp messages (from leads replying) ----
export async function getInboundMessages() {
  return readJson(INBOUND_MESSAGES_FILE, []);
}

export async function addInboundMessage(msg) {
  const messages = await getInboundMessages();
  messages.unshift(msg);
  writeJson(INBOUND_MESSAGES_FILE, messages.slice(0, 500));
}

// ---- Outbound WhatsApp messages — real Meta message-id index, so a later
// delivery/read/failed status webhook can find which lead + activity-log entry
// to update (server/app.js webhook handler). Keyed by the real Meta message id.
export async function addOutboundMessage(msg) {
  const messages = readJson(OUTBOUND_MESSAGES_FILE, []);
  messages.unshift(msg);
  writeJson(OUTBOUND_MESSAGES_FILE, messages.slice(0, 2000));
}

export async function getOutboundMessage(messageId) {
  const messages = readJson(OUTBOUND_MESSAGES_FILE, []);
  return messages.find(m => m.id === messageId) || null;
}

// ---- Bulk calling campaigns ----
export async function getCampaigns() {
  return readJson(CAMPAIGNS_FILE, []);
}

export async function upsertCampaign(campaign) {
  const campaigns = await getCampaigns();
  const idx = campaigns.findIndex(c => c.id === campaign.id);
  if (idx === -1) {
    campaigns.unshift(campaign);
  } else {
    campaigns[idx] = { ...campaigns[idx], ...campaign };
  }
  writeJson(CAMPAIGNS_FILE, campaigns);
  return idx === -1 ? campaign : campaigns[idx];
}

export async function getCampaign(id) {
  const campaigns = await getCampaigns();
  return campaigns.find(c => c.id === id) || null;
}

export async function deleteCampaign(id) {
  const campaigns = await getCampaigns();
  const next = campaigns.filter(c => c.id !== id);
  const deleted = next.length !== campaigns.length;
  if (deleted) writeJson(CAMPAIGNS_FILE, next);
  return deleted;
}

// ---- Team & Roles — real named accounts stored alongside the single env admin
// (see server/app.js auth middleware — the env ADMIN_USERNAME/PASSWORD always
// works too, as an unlockable superadmin). Passwords are never stored in plain
// text (see server/auth.js).
export async function getUsers() {
  return readJson(USERS_FILE, []);
}

export async function getUserById(id) {
  const users = await getUsers();
  return users.find(u => u.id === id) || null;
}

export async function getUserByUsername(username) {
  const users = await getUsers();
  return users.find(u => u.username.toLowerCase() === String(username || '').toLowerCase()) || null;
}

export async function createUser(user) {
  const users = await getUsers();
  users.push(user);
  writeJson(USERS_FILE, users);
  return user;
}

export async function updateUser(id, updates) {
  const users = await getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  writeJson(USERS_FILE, users);
  return users[idx];
}

export async function deleteUser(id) {
  const users = await getUsers();
  const next = users.filter(u => u.id !== id);
  const deleted = next.length !== users.length;
  if (deleted) writeJson(USERS_FILE, next);
  return deleted;
}

// ---- Audit log (Security page) — real admin actions, appended by the auth
// middleware in server/app.js for every authenticated, non-GET request, plus
// failed-login attempts. Never fabricated entries.
export async function getAuditEvents() {
  return readJson(AUDIT_LOG_FILE, []);
}

export async function addAuditEvent(event) {
  const events = await getAuditEvents();
  events.unshift(event); // newest first
  writeJson(AUDIT_LOG_FILE, events.slice(0, 1000)); // cap growth
}
