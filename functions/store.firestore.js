// Firestore-backed persistence — used when running as a deployed Cloud Function
// (production). Same exported function surface as store.local.js so the rest of
// the backend doesn't need to know which one is active (see store.js).
//
// No service account key needed here: a deployed Cloud Function automatically
// runs with a service account that already has Firestore access in this project.
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp();
const db = getFirestore();

const leadsCol = db.collection('leads');
const callEventsCol = db.collection('callEvents');
const settingsDoc = db.collection('settings').doc('omnidim');

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
  agentIdMap: { agent_1: null, agent_2: null, agent_3: null, agent_4: null, agent_5: null },
  fromNumberId: null,
  lastDialedByLead: {},
  lastProcessedCallId: 0, // highest Omnidimension call-log id already synced into leads (see callPoller.js)
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
