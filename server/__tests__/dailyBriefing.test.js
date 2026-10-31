import { describe, it, expect } from 'vitest';
import { buildDailyBriefingStats, buildTopActions } from '../dailyBriefing.js';

const AGENTS = [{ id: 'agent_1', name: 'Kavya' }, { id: 'agent_2', name: 'Arjun' }];

describe('buildDailyBriefingStats', () => {
  it('counts real hot leads, follow-ups due, and high-value-cold leads', () => {
    const leads = [
      { id: 'l1', agentId: 'agent_1', leadScore: { temperature: 'Hot' }, status: 'Pending', interestLevel: 'Hot Lead', nextFollowUpDate: '2020-01-01T00:00:00.000Z' },
      { id: 'l2', agentId: 'agent_1', escalated: true, escalationCategory: 'high_value', status: 'Pending', interestLevel: 'Interested', budget: 5000000 },
      { id: 'l3', agentId: 'agent_2', interestLevel: 'Call Later', status: 'Outgoing Retry' },
    ];
    const stats = buildDailyBriefingStats({ leads, agents: AGENTS, callEvents: [] });
    expect(stats.hotLeadsCount).toBe(1);
    expect(stats.needsFollowUpCount).toBe(1);
    expect(stats.highValueGoingColdCount).toBe(1);
    expect(stats.callbackRequestsCount).toBe(1);
  });

  it('never counts an escalated lead as needing a routine follow-up (it needs a human, not another auto-nudge)', () => {
    const leads = [{ id: 'l1', agentId: 'agent_1', escalated: true, status: 'Pending', nextFollowUpDate: '2020-01-01T00:00:00.000Z' }];
    const stats = buildDailyBriefingStats({ leads, agents: AGENTS, callEvents: [] });
    expect(stats.needsFollowUpCount).toBe(0);
  });
});

describe('buildTopActions', () => {
  it('prioritizes high-value-going-cold leads above everything else', () => {
    const stats = {
      _highValueGoingCold: [{ id: 'l1', name: 'Rahul', budget: 7500000 }],
      _needsFollowUp: [],
      _callbackRequests: [],
    };
    const actions = buildTopActions({ stats, rebalancing: [], objectionTrend: null });
    expect(actions[0].type).toBe('call_now');
    expect(actions[0].text).toContain('Rahul');
    expect(actions[0].text).toContain('75L');
  });

  it('never returns more than 5 actions even with many real signals', () => {
    const stats = {
      _highValueGoingCold: Array.from({ length: 3 }, (_, i) => ({ id: `hv${i}`, name: `HV${i}`, budget: 5000000 })),
      _needsFollowUp: Array.from({ length: 3 }, (_, i) => ({ id: `f${i}`, name: `F${i}`, leadScore: { temperature: 'Hot' } })),
      _callbackRequests: [{ id: 'c1', name: 'Caller1' }],
    };
    const rebalancing = [{ fromAgentName: 'Kavya', toAgentName: 'Arjun', count: 3 }];
    const actions = buildTopActions({ stats, rebalancing, objectionTrend: { risingCategory: 'price', deltaPct: 17 } });
    expect(actions.length).toBeLessThanOrEqual(5);
  });

  it('returns an empty list when there is genuinely nothing to flag', () => {
    const stats = { _highValueGoingCold: [], _needsFollowUp: [], _callbackRequests: [] };
    expect(buildTopActions({ stats, rebalancing: [], objectionTrend: null })).toEqual([]);
  });
});
