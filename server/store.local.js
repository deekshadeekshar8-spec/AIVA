// Simple JSON-file persistence for leads, call events, and settings.
// Used for LOCAL DEV only (npm run server) — see store.js for the switch that
// picks this vs. store.firestore.js depending on where the process is running.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const CALL_EVENTS_FILE = path.join(DATA_DIR, 'call-events.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

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
  agentIdMap: { agent_1: null, agent_2: null, agent_3: null, agent_4: null, agent_5: null }, // AIVA agent id -> Omnidimension agent id (Kavya/Arjun/Ananya/Rohan/Priya)
  fromNumberId: null,
  lastDialedByLead: {}, // leadId -> ISO date string, to avoid re-dialing the same lead multiple times a day
  lastProcessedCallId: 0, // highest Omnidimension call-log id already synced into leads (see callPoller.js)
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
