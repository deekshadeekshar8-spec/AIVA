import { useEffect, useState } from 'react';
import { getLeads, getCallEvents, type CallEvent } from '../api/leads';
import type { Lead } from '../api/types';
import type { AgentId } from '../types/agent';

/** Maps the six on-stage persona ids to the real backend agent ids they represent. */
export const PERSONA_TO_REAL_AGENT: Record<AgentId, string> = {
  ava: 'agent_1',
  aria: 'agent_2',
  mira: 'agent_3',
  zara: 'agent_4',
  nia: 'agent_5',
  nova: 'agent_6',
};
export const REAL_AGENT_TO_PERSONA: Record<string, AgentId> = Object.fromEntries(
  Object.entries(PERSONA_TO_REAL_AGENT).map(([persona, real]) => [real, persona as AgentId])
);

const HOT_LEVELS = new Set(['Hot Lead', 'Interested']);
const CONTACTED_STATUSES = new Set(['Contacted', 'Completed', 'Handed Over']);

export interface AgentStat {
  assigned: number;
  contacted: number;
  hot: number;
  completed: number;
}

export interface RealCrmStats {
  loading: boolean;
  error: string | null;
  leads: Lead[];
  callEvents: CallEvent[];
  totalLeads: number;
  hotLeads: number;
  contactedLeads: number;
  completedLeads: number;
  notReachableLeads: number;
  siteVisitsScheduled: number;
  pipelineValue: number;
  inCallLeads: Lead[];
  statusBreakdown: Array<{ label: string; count: number }>;
  byPersona: Record<AgentId, AgentStat>;
  reload: () => void;
}

export function useRealCrmStats(): RealCrmStats {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [callEvents, setCallEvents] = useState<CallEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getLeads(), getCallEvents()]).
    then(([l, c]) => {
      if (cancelled) return;
      setLeads(l);
      setCallEvents(c);
      setError(null);
    }).
    catch((err) => {
      if (!cancelled) setError(err?.message || 'Could not load real CRM data.');
    }).
    finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => HOT_LEVELS.has(l.interestLevel)).length;
  const contactedLeads = leads.filter((l) => CONTACTED_STATUSES.has(l.status)).length;
  const completedLeads = leads.filter((l) => l.status === 'Completed').length;
  const notReachableLeads = leads.filter((l) => l.interestLevel === 'Not Reachable').length;
  const siteVisitsScheduled = leads.filter((l) => !!l.siteVisitScheduled).length;
  const pipelineValue = leads.
  filter((l) => l.interestLevel !== 'Not Interested' && l.interestLevel !== 'Wrong Number').
  reduce((sum, l) => sum + (l.budget || 0), 0);
  const inCallLeads = leads.filter((l) => l.status === 'In Call');

  const statusCounts = new Map<string, number>();
  for (const l of leads) statusCounts.set(l.status, (statusCounts.get(l.status) || 0) + 1);
  const statusBreakdown = Array.from(statusCounts.entries()).
  sort((a, b) => b[1] - a[1]).
  map(([label, count]) => ({ label, count }));

  const byPersona = {} as Record<AgentId, AgentStat>;
  for (const persona of Object.keys(PERSONA_TO_REAL_AGENT) as AgentId[]) {
    const realId = PERSONA_TO_REAL_AGENT[persona];
    const mine = leads.filter((l) => l.agentId === realId);
    byPersona[persona] = {
      assigned: mine.length,
      contacted: mine.filter((l) => CONTACTED_STATUSES.has(l.status)).length,
      hot: mine.filter((l) => HOT_LEVELS.has(l.interestLevel)).length,
      completed: mine.filter((l) => l.status === 'Completed').length,
    };
  }

  return {
    loading,
    error,
    leads,
    callEvents,
    totalLeads,
    hotLeads,
    contactedLeads,
    completedLeads,
    notReachableLeads,
    siteVisitsScheduled,
    pipelineValue,
    inCallLeads,
    statusBreakdown,
    byPersona,
    reload: () => setTick((t) => t + 1),
  };
}
