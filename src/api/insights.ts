// Real "manager command center" data layer — every field here comes straight
// from server/app.js's insights/settings/campaign routes, which themselves
// compute real aggregates over stored leads/call-events. Nothing here is
// invented or simulated.
import { api } from './client';

export interface InsightsSummary {
  todaysCalls: number;
  connected: number;
  qualified: number;
  siteVisits: number;
  projectSplit: Record<string, number>;
  highestIntentLead: { id: string; name: string; interestLevel: string; projectInterest: string | null } | null;
  needsImmediateFollowUpCount: number;
  needsImmediateFollowUp: { id: string; name: string; nextFollowUpDate: string }[];
  silentMomentumCount: number;
  silentMomentum: { id: string; name: string; interestLevel: string; timeline: string; daysSinceContact: number }[];
  totalLeads: number;
}

export async function getInsightsSummary(): Promise<InsightsSummary> {
  const res = await api.get<{ ok: boolean; summary: InsightsSummary }>('/api/insights/summary');
  return res.summary;
}

export interface FunnelStage {
  id: string;
  label: string;
  count: number;
}
export interface Funnel {
  stages: FunnelStage[];
  bottleneck: FunnelStage | null;
}
export async function getFunnel(): Promise<Funnel> {
  const res = await api.get<{ ok: boolean; funnel: Funnel }>('/api/insights/funnel');
  return res.funnel;
}

export interface SalesDashboard {
  totalLeads: number;
  byTemperature: Record<string, number>;
  siteVisits: number;
  highIntentLeads: number;
  followUpsDue: number;
  leadsRequiringHumanAttention: number;
  lostLeads: { id: string; name: string; reason: string }[];
  lostLeadsCount: number;
  topObjections: { objection: string; count: number }[];
  topPerformingProjects: { project: string; total: number; qualified: number; hot: number; siteVisits: number; converted: number; qualifiedRate: number | null }[];
  averageLeadScore: number;
}
export async function getSalesDashboard(): Promise<SalesDashboard> {
  const res = await api.get<{ ok: boolean; dashboard: SalesDashboard }>('/api/insights/sales-dashboard');
  return res.dashboard;
}

export interface CompetitorRadarEntry {
  competitor: string;
  mentions: number;
  distinctLeads: number;
  locations: string[];
}
export async function getCompetitorRadar(): Promise<{ radar: CompetitorRadarEntry[]; totalMentions: number }> {
  return api.get('/api/insights/competitor-radar');
}

export interface CeoBriefStats {
  sourceStats: { source: string; total: number; qualified: number; qualifiedRate: number | null }[];
  agentStats: { agentId: string; total: number; qualified: number; qualifiedRate: number | null }[];
  timeOfDayStats: { bucket: string; total: number; qualified: number; qualifiedRate: number | null }[];
  topObjections: { objection: string; count: number; pctOfLeads: number }[];
  staleLeadsCount: number;
  staleLeadsThresholdDays: number;
  totalLeads: number;
}
export interface CeoBrief {
  stats: CeoBriefStats;
  narrative: string | null;
  narrativeSkippedReason?: string;
}
export async function getCeoBrief(): Promise<CeoBrief> {
  const res = await api.get<{ ok: boolean } & CeoBrief>('/api/insights/ceo-brief');
  return { stats: res.stats, narrative: res.narrative, narrativeSkippedReason: res.narrativeSkippedReason };
}

export interface DailyBriefing {
  hotLeadsCount: number;
  needsFollowUpCount: number;
  callbackRequestsCount: number;
  siteVisitsTodayCount: number;
  highValueGoingColdCount: number;
  overloadedAgentsCount: number;
  aiCallsToday: number;
  workloads: { agentId: string; activeLeads: number; overdueLeads: number }[];
  rebalancing: unknown;
  objectionTrend: { risingCategory: string; deltaPct: number } | null;
  topActions: { id?: string; title?: string; detail?: string; [key: string]: unknown }[];
  lostReasons: unknown;
  totalLeads: number;
}
export async function getDailyBriefing(): Promise<DailyBriefing> {
  const res = await api.get<{ ok: boolean; briefing: DailyBriefing }>('/api/insights/daily-briefing');
  return res.briefing;
}

export async function searchTranscripts(q: string): Promise<{ leadId: string; leadName: string; phone: string; recordingId: string; date: string; url: string | null; snippet: string }[]> {
  if (!q.trim()) return [];
  const res = await api.get<{ ok: boolean; results: any[] }>(`/api/leads/transcript-search?q=${encodeURIComponent(q)}`);
  return res.results;
}

export interface Escalation {
  id: string;
  name: string;
  phone: string;
  project?: string;
  budget?: number;
  interestLevel: string;
  status: string;
  agentId: string;
  escalationCategory?: string;
  escalationReason?: string;
  escalatedAt?: string;
  handoffSummary?: string;
}
export async function getEscalations(): Promise<Escalation[]> {
  const res = await api.get<{ ok: boolean; escalations: Escalation[] }>('/api/escalations');
  return res.escalations;
}
export async function resolveEscalation(leadId: string): Promise<boolean> {
  try {
    await api.post(`/api/leads/${leadId}/resolve-escalation`);
    return true;
  } catch {
    return false;
  }
}

// ---- Settings: Team & Roles, Audit Log, Property Config, Omnidimension ----

export interface AivaUser {
  id: string;
  username: string;
  role: 'admin' | 'member';
  active: boolean;
  createdAt: string | null;
  env?: boolean;
}
export async function getUsers(): Promise<AivaUser[]> {
  const res = await api.get<{ ok: boolean; users: AivaUser[] }>('/api/users');
  return res.users;
}
export async function createUser(input: { username: string; password: string; role: 'admin' | 'member' }): Promise<{ ok: boolean; user?: AivaUser; error?: string }> {
  try {
    const res = await api.post<{ ok: boolean; user: AivaUser }>('/api/users', input);
    return { ok: true, user: res.user };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to create user.' };
  }
}
export async function updateUser(id: string, updates: { role?: 'admin' | 'member'; active?: boolean }): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.patch(`/api/users/${id}`, updates);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to update user.' };
  }
}
export async function deleteUser(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.del(`/api/users/${id}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to delete user.' };
  }
}

export interface AuditEvent {
  id?: string;
  time?: string;
  username?: string;
  method?: string;
  path?: string;
  status?: number;
  [key: string]: unknown;
}
export async function getAuditLog(limit = 200): Promise<AuditEvent[]> {
  const res = await api.get<{ ok: boolean; events: AuditEvent[] }>(`/api/audit-log?limit=${limit}`);
  return res.events;
}

export interface PropertyConfigEntry {
  description?: string;
  websiteUrl?: string;
  brochureUrl?: string;
  highlights?: string[];
  approvalInfo?: string;
  nearbyLandmarks?: string[];
  location?: { name: string; address: string; latitude: number; longitude: number };
  [key: string]: unknown;
}
export async function getPropertyConfig(): Promise<Record<string, PropertyConfigEntry>> {
  const res = await api.get<{ ok: boolean; config: Record<string, PropertyConfigEntry> }>('/api/property-config');
  return res.config;
}

export interface OmnidimSettings {
  [key: string]: unknown;
}
export async function getOmnidimSettings(): Promise<{ settings: OmnidimSettings; configured: boolean }> {
  const res = await api.get<{ ok: boolean; settings: OmnidimSettings; configured: boolean }>('/api/omnidim/settings');
  return { settings: res.settings, configured: res.configured };
}

export async function getWhatsappHealth(): Promise<{ ok: boolean; [key: string]: unknown }> {
  return api.get('/api/whatsapp/health');
}

// ---- Automation: Script Variants & Campaigns (read/create only — launching a
// campaign or running a sweep places REAL outbound calls, so those actions are
// deliberately not exposed here until calling is explicitly enabled) ----

export interface ScriptVariant {
  id: string;
  name: string;
  agentId: string | null;
  openingStyle: string;
  mainFocus: string;
  avoid: string;
  goal: string;
  status: 'draft' | 'active' | 'archived';
  source: string;
  rationale?: string;
  createdAt: string;
}
export async function getScriptVariants(): Promise<ScriptVariant[]> {
  const res = await api.get<{ ok: boolean; variants: ScriptVariant[] }>('/api/script-variants');
  return res.variants;
}
export async function getScriptVariantStats(): Promise<Record<string, { calls: number; qualified: number; qualifiedRate: number | null }>> {
  const res = await api.get<{ ok: boolean; stats: Record<string, any> }>('/api/script-variants/stats');
  return res.stats;
}
export async function setScriptVariantStatus(id: string, status: 'draft' | 'active' | 'archived'): Promise<boolean> {
  try {
    await api.patch(`/api/script-variants/${id}`, { status });
    return true;
  } catch {
    return false;
  }
}

export interface Campaign {
  id: string;
  name: string;
  filters: Record<string, string>;
  leadIds: string[];
  leadNames: string[];
  status: 'draft' | 'launched' | 'completed';
  createdAt: string;
  launchedAt: string | null;
  dispatchedCount: number;
  failedCount: number;
}
export async function getCampaigns(): Promise<Campaign[]> {
  const res = await api.get<{ ok: boolean; campaigns: Campaign[] }>('/api/campaigns');
  return res.campaigns;
}
export async function createCampaign(name: string, filters: Record<string, string>): Promise<{ ok: boolean; campaign?: Campaign; error?: string }> {
  try {
    const res = await api.post<{ ok: boolean; campaign: Campaign }>('/api/campaigns', { name, filters });
    return { ok: true, campaign: res.campaign };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to create campaign.' };
  }
}
export async function deleteCampaign(id: string): Promise<boolean> {
  try {
    await api.del(`/api/campaigns/${id}`);
    return true;
  } catch {
    return false;
  }
}
