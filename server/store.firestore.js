// Firestore-backed persistence — used when running as a deployed Cloud Function
// (production). Same exported function surface as store.local.js so the rest of
// the backend doesn't need to know which one is active (see store.js).
//
// No service account key needed here: a deployed Cloud Function automatically
// runs with a service account that already has Firestore access in this project.
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { buildDefaultPropertyConfig } from './businessFacts.js';

if (!getApps().length) initializeApp();
const db = getFirestore();

const leadsCol = db.collection('leads');
const callEventsCol = db.collection('callEvents');
const settingsDoc = db.collection('settings').doc('omnidim');
const scriptVariantsCol = db.collection('scriptVariants');
const inboundMessagesCol = db.collection('inboundMessages');
const outboundMessagesCol = db.collection('outboundMessages');
const campaignsCol = db.collection('campaigns');
const usersCol = db.collection('users');
const auditLogCol = db.collection('auditLog');
const propertyConfigDoc = db.collection('settings').doc('propertyConfig');

// ---- Leads ----
export async function getLeads() {
  const snap = await leadsCol.get();
  return snap.docs.map(d => d.data());
}

export async function seedLeadsIfEmpty(initialLeads) {
  const existing = await getLeads();
  if (existing.length === 0 && Array.isArray(initialLeads) && initialLeads.length > 0) {
    const batch = db.batch();
    initialLeads.forEach(lead => batch.set(leadsCol.doc(lead.id), lead));
    await batch.commit();
    return initialLeads;
  }
  return existing;
}

export async function clearLeads() {
  const snap = await leadsCol.get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return [];
}

export async function upsertLeadsByPhone(newLeads) {
  const existing = await getLeads();
  const byPhone = new Map(existing.map(l => [l.phone, l]));
  let added = 0, updated = 0;
  const batch = db.batch();
  for (const nl of newLeads) {
    const match = byPhone.get(nl.phone);
    if (match) {
      const merged = { ...match, ...nl, id: match.id };
      batch.set(leadsCol.doc(match.id), merged);
      byPhone.set(nl.phone, merged);
      updated++;
    } else {
      batch.set(leadsCol.doc(nl.id), nl);
      byPhone.set(nl.phone, nl);
      added++;
    }
  }
  await batch.commit();
  const leads = [...byPhone.values()];
  return { added, updated, leads };
}

export async function updateLead(id, updates) {
  const ref = leadsCol.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const merged = { ...snap.data(), ...updates };
  await ref.set(merged);
  return merged;
}

export async function getLead(id) {
  const snap = await leadsCol.doc(id).get();
  return snap.exists ? snap.data() : null;
}

export async function deleteLead(id) {
  const ref = leadsCol.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

// ---- Call events ----
export async function getCallEvents() {
  const snap = await callEventsCol.orderBy('receivedAt', 'desc').limit(200).get();
  return snap.docs.map(d => d.data());
}

export async function addCallEvent(event) {
  await callEventsCol.doc(event.id).set(event);
}

// ---- Settings ----
const DEFAULT_SETTINGS = {
  autoDialEnabled: false, // SAFETY DEFAULT: never places real calls until an admin explicitly turns this on
  defaultAgentId: null,
  agentIdMap: { agent_1: null, agent_2: null, agent_3: null, agent_4: null, agent_5: null, agent_6: null }, // agent_6=Vistara, a second real client (RK Developers) — see server/callPoller.js
  fromNumberId: null,
  lastDialedByLead: {},
  lastProcessedCallId: 0, // highest Omnidimension call-log id already synced into leads (see callPoller.js)
  autoBrochureAfterNoAnswers: 0, // Workflows: 0 = off (default)
  // Escalation / human handoff (server/escalation.js)
  humanHandoffEnabled: true,
  humanHandoffConfidenceThreshold: 40,
  escalationHighValueBudget: 4000000,
  // WhatsApp Property Sharing (server/propertySharing.js)
  whatsappAutoShareEnabled: false,
  whatsappFollowUpDelayHours: 3,
  whatsappFollowUpMaxAttempts: 1,
  // Calling-hours guard (server/callWindow.js)
  callWindowStartHour: 11,
  callWindowEndHour: 19.5,
};

export async function getSettings() {
  const snap = await settingsDoc.get();
  return { ...DEFAULT_SETTINGS, ...(snap.exists ? snap.data() : {}) };
}

export async function updateSettings(updates) {
  const current = await getSettings();
  const next = {
    ...current,
    ...updates,
    agentIdMap: { ...current.agentIdMap, ...(updates.agentIdMap || {}) },
  };
  await settingsDoc.set(next);
  return next;
}

export async function markDialedToday(leadId) {
  const today = new Date().toISOString().split('T')[0];
  await settingsDoc.set({ lastDialedByLead: { [leadId]: today } }, { merge: true });
}

export async function wasDialedToday(leadId) {
  const settings = await getSettings();
  const today = new Date().toISOString().split('T')[0];
  return settings.lastDialedByLead[leadId] === today;
}

// ---- WhatsApp Property Sharing config — per real project ----
export async function getPropertyConfig() {
  const defaults = buildDefaultPropertyConfig();
  const snap = await propertyConfigDoc.get();
  const stored = snap.exists ? snap.data() : {};
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
  await propertyConfigDoc.set(next);
  return next[project];
}

// ---- Script variants (Evolution Engine — A/B tested call strategies) ----
export async function getScriptVariants() {
  const snap = await scriptVariantsCol.get();
  return snap.docs.map(d => d.data());
}

export async function upsertScriptVariant(variant) {
  const ref = scriptVariantsCol.doc(variant.id);
  const snap = await ref.get();
  const merged = snap.exists ? { ...snap.data(), ...variant } : variant;
  await ref.set(merged);
  return merged;
}

export async function deleteScriptVariant(id) {
  const ref = scriptVariantsCol.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

// ---- Inbound WhatsApp messages (from leads replying) ----
export async function getInboundMessages() {
  const snap = await inboundMessagesCol.orderBy('receivedAt', 'desc').limit(500).get();
  return snap.docs.map(d => d.data());
}

export async function addInboundMessage(msg) {
  await inboundMessagesCol.doc(msg.id).set(msg);
}

// ---- Outbound WhatsApp messages — real Meta message-id index, so a later
// delivery/read/failed status webhook can find which lead + activity-log entry
// to update (server/app.js webhook handler). Keyed by the real Meta message id.
export async function addOutboundMessage(msg) {
  await outboundMessagesCol.doc(msg.id).set(msg);
}

export async function getOutboundMessage(messageId) {
  const snap = await outboundMessagesCol.doc(messageId).get();
  return snap.exists ? snap.data() : null;
}

// ---- Bulk calling campaigns ----
export async function getCampaigns() {
  const snap = await campaignsCol.orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => d.data());
}

export async function upsertCampaign(campaign) {
  const ref = campaignsCol.doc(campaign.id);
  const snap = await ref.get();
  const merged = snap.exists ? { ...snap.data(), ...campaign } : campaign;
  await ref.set(merged);
  return merged;
}

export async function getCampaign(id) {
  const snap = await campaignsCol.doc(id).get();
  return snap.exists ? snap.data() : null;
}

export async function deleteCampaign(id) {
  const ref = campaignsCol.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

// ---- Team & Roles ----
export async function getUsers() {
  const snap = await usersCol.get();
  return snap.docs.map(d => d.data());
}

export async function getUserById(id) {
  const snap = await usersCol.doc(id).get();
  return snap.exists ? snap.data() : null;
}

export async function getUserByUsername(username) {
  const snap = await usersCol.where('username', '==', username).limit(1).get();
  if (!snap.empty) return snap.docs[0].data();
  // Fall back to a case-insensitive scan (Firestore has no native case-insensitive query).
  const all = await getUsers();
  return all.find(u => u.username.toLowerCase() === String(username || '').toLowerCase()) || null;
}

export async function createUser(user) {
  await usersCol.doc(user.id).set(user);
  return user;
}

export async function updateUser(id, updates) {
  const ref = usersCol.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const merged = { ...snap.data(), ...updates };
  await ref.set(merged);
  return merged;
}

export async function deleteUser(id) {
  const ref = usersCol.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

// ---- Audit log (Security page) ----
export async function getAuditEvents() {
  const snap = await auditLogCol.orderBy('timestamp', 'desc').limit(1000).get();
  return snap.docs.map(d => d.data());
}

export async function addAuditEvent(event) {
  await auditLogCol.doc(event.id).set(event);
}
