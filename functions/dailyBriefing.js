// AIVA Daily Briefing ("War Room") — the manager's morning summary and top-5
// recommended actions. Every number and every recommended action is computed
// from real stored data; there is no revenue/pipeline-value figure (deliberately
// excluded — see server/app.js sales-dashboard route for why), and "the team"
// here is AIVA's 5 real AI agent personas, not a human sales roster this app has
// no data model for.
//
// buildTopActions() is a PURE, deterministic priority list — never LLM-invented.
// A Gemini narration may sit on top of this exact list (same pattern as the CEO
// Brief), but the actions themselves always trace back to a real lead/agent.
import { computeAgentWorkloads, recommendRebalancing } from './leadAssignment.js';

const HIGH_VALUE_CATEGORY = 'high_value';

export function buildDailyBriefingStats({ leads, agents, callEvents }) {
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();

  const hotLeads = leads.filter(l => l.leadScore?.temperature === 'Hot');
  const NOT_DUE_STATUSES = new Set(['Completed', 'Handed Over', 'In Call']);
  const needsFollowUp = leads.filter(l => {
    if (NOT_DUE_STATUSES.has(l.status) || l.escalated) return false;
    const due = Date.parse(l.nextFollowUpDate);
    return !Number.isNaN(due) && due <= now;
  });
  const callbackRequests = leads.filter(l => l.interestLevel === 'Call Later');
  const siteVisitsToday = leads.filter(l => l.siteVisitScheduled === today);
  const highValueGoingCold = leads.filter(l => l.escalated && l.escalationCategory === HIGH_VALUE_CATEGORY);
  const workloads = computeAgentWorkloads(leads, agents);
  const overloadedAgents = workloads.filter(w => w.activeLeads > 0 && w.overdueLeads >= 3);

  const todayEvents = (callEvents || []).filter(e => {
    const t = Date.parse(e.receivedAt);
    return !Number.isNaN(t) && new Date(t).toISOString().split('T')[0] === today;
  });

  return {
    hotLeadsCount: hotLeads.length,
    needsFollowUpCount: needsFollowUp.length,
    callbackRequestsCount: callbackRequests.length,
    siteVisitsTodayCount: siteVisitsToday.length,
    highValueGoingColdCount: highValueGoingCold.length,
    overloadedAgentsCount: overloadedAgents.length,
    aiCallsToday: todayEvents.length,
    workloads,
    // Raw lists for the "top actions" builder below — kept small and specific.
    _highValueGoingCold: highValueGoingCold,
    _needsFollowUp: needsFollowUp,
    _callbackRequests: callbackRequests,
  };
}

// The deterministic "here are the 5 things you should do first" list (spec
// section 1 / the War Room feature). Priority order: money-at-risk first, then
// overdue hot leads, then callbacks, then team workload, then process signals.
export function buildTopActions({ stats, rebalancing, objectionTrend }) {
  const actions = [];

  for (const lead of stats._highValueGoingCold.slice(0, 2)) {
    actions.push({
      priority: 100, type: 'call_now', leadId: lead.id,
      text: `Call ${lead.name}'s ₹${lead.budget ? (lead.budget / 100000).toFixed(0) : '?'}L lead immediately — flagged high-value and going cold.`,
    });
  }

  const overdueHot = stats._needsFollowUp.filter(l => l.leadScore?.temperature === 'Hot').slice(0, 2);
  for (const lead of overdueHot) {
    actions.push({ priority: 90, type: 'follow_up', leadId: lead.id, text: `Follow up with ${lead.name} — a Hot lead whose follow-up is now overdue.` });
  }

  if (stats._callbackRequests.length > 0) {
    actions.push({
      priority: 70, type: 'callback', leadId: stats._callbackRequests[0].id,
      text: `${stats._callbackRequests.length} customer${stats._callbackRequests.length === 1 ? '' : 's'} requested a callback — ${stats._callbackRequests[0].name}${stats._callbackRequests.length > 1 ? ' and others' : ''}.`,
    });
  }

  for (const move of rebalancing) {
    actions.push({ priority: 60, type: 'rebalance', text: `Move ${move.count} uncontacted lead(s) from ${move.fromAgentName} to ${move.toAgentName} — workload imbalance.` });
  }

  if (objectionTrend?.risingCategory) {
    actions.push({
      priority: 50, type: 'review_messaging',
      text: `"${objectionTrend.risingCategory}" objections are up ${objectionTrend.deltaPct}% this week — worth reviewing the current messaging.`,
    });
  }

  return actions.sort((a, b) => b.priority - a.priority).slice(0, 5);
}
