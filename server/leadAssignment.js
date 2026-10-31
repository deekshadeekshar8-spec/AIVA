// Smart Lead Assignment & Workload Balancing — across AIVA's 5 real AI agent
// personas (Kavya/Arjun/Ananya/Rohan/Priya), NOT human salespeople (this app has
// no human-executive roster or human-call recording pipeline). Every number here
// is a real count over stored leads — no fabricated "specialization" matching,
// since the agents' role/tone flavor text doesn't correspond to real business
// categories (this Society sells two kinds of plots, not "luxury estates" or
// "townhouses" the way the persona bios imply).
//
// Pure functions — no I/O — same testing pattern as callOutcomeRules.js.

const OPEN_STATUSES = new Set(['Pending', 'Call Scheduled', 'Outgoing Retry', 'Contacted']);

// Real, current workload per agent — not lifetime lead count, which stays high
// forever even after leads close out. "Active" = still genuinely in play.
export function computeAgentWorkloads(leads, agents) {
  const today = new Date().toISOString().split('T')[0];
  const byAgent = new Map(agents.map(a => [a.id, {
    agentId: a.id, agentName: a.name, activeLeads: 0, hotLeads: 0, overdueLeads: 0, callsToday: 0,
  }]));

  const now = Date.now();
  for (const lead of leads) {
    const bucket = byAgent.get(lead.agentId);
    if (!bucket) continue; // lead assigned to an agent that no longer exists
    const isOpen = OPEN_STATUSES.has(lead.status) && !['Not Interested', 'Wrong Number'].includes(lead.interestLevel);
    if (isOpen) {
      bucket.activeLeads++;
      if (lead.leadScore?.temperature === 'Hot') bucket.hotLeads++;
      const due = Date.parse(lead.nextFollowUpDate);
      if (!Number.isNaN(due) && due < now) bucket.overdueLeads++;
    }
    if (lead.lastContactTime) {
      const contactDate = new Date(lead.lastContactTime);
      if (!Number.isNaN(contactDate.getTime()) && contactDate.toISOString().split('T')[0] === today) bucket.callsToday++;
    }
  }
  return [...byAgent.values()];
}

// Which agent a brand-new lead should go to right now — whichever real AI agent
// currently has the FEWEST active (still-open) leads, not lifetime count. This is
// what actually prevents one agent's queue from silently growing forever.
export function recommendAgentForNewLead(leads, agents) {
  if (agents.length === 0) return null;
  const workloads = computeAgentWorkloads(leads, agents);
  return workloads.sort((a, b) => a.activeLeads - b.activeLeads)[0].agentId;
}

// Real rebalancing suggestions — only fires when the gap between the busiest and
// the least-busy agent is genuinely large (spec section 9's "Employee A: 27
// active, Employee B: 9 active" example). Never suggests moving leads for a
// trivial 1-2 lead difference.
export function recommendRebalancing(leads, agents, { minGap = 5, moveCount = 3 } = {}) {
  const workloads = computeAgentWorkloads(leads, agents);
  if (workloads.length < 2) return [];

  const sorted = [...workloads].sort((a, b) => b.activeLeads - a.activeLeads);
  const busiest = sorted[0];
  const quietest = sorted[sorted.length - 1];
  const gap = busiest.activeLeads - quietest.activeLeads;
  if (gap < minGap) return [];

  // Prefer moving uncontacted (Pending, never called) leads — the least disruptive
  // to move, since no relationship/context has built up yet.
  const movable = leads
    .filter(l => l.agentId === busiest.agentId && l.status === 'Pending' && (l.lastContactTime === 'Never' || !l.lastContactTime))
    .slice(0, moveCount);
  if (movable.length === 0) return [];

  return [{
    fromAgentId: busiest.agentId,
    fromAgentName: busiest.agentName,
    toAgentId: quietest.agentId,
    toAgentName: quietest.agentName,
    leadIds: movable.map(l => l.id),
    count: movable.length,
    reason: `${busiest.agentName} has ${busiest.activeLeads} active leads vs ${quietest.agentName}'s ${quietest.activeLeads} — moving ${movable.length} uncontacted lead(s) to balance the load.`,
  }];
}
