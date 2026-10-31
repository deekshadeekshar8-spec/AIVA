import { describe, it, expect } from 'vitest';
import { computeAgentWorkloads, recommendAgentForNewLead, recommendRebalancing } from '../leadAssignment.js';

const AGENTS = [{ id: 'agent_1', name: 'Kavya' }, { id: 'agent_2', name: 'Arjun' }];

const openLead = (agentId, overrides = {}) => ({
  agentId, status: 'Pending', interestLevel: 'Warm Lead', nextFollowUpDate: '', lastContactTime: 'Never', ...overrides,
});

describe('computeAgentWorkloads', () => {
  it('counts only genuinely open leads as active', () => {
    const leads = [
      openLead('agent_1'),
      openLead('agent_1', { status: 'Completed' }), // closed — not active
      openLead('agent_1', { interestLevel: 'Not Interested' }), // refused — not active
    ];
    const workloads = computeAgentWorkloads(leads, AGENTS);
    const kavya = workloads.find(w => w.agentId === 'agent_1');
    expect(kavya.activeLeads).toBe(1);
  });

  it('flags overdue leads based on a real elapsed nextFollowUpDate', () => {
    const leads = [openLead('agent_1', { nextFollowUpDate: '2020-01-01T00:00:00.000Z' })];
    const workloads = computeAgentWorkloads(leads, AGENTS);
    expect(workloads.find(w => w.agentId === 'agent_1').overdueLeads).toBe(1);
  });
});

describe('recommendAgentForNewLead', () => {
  it('assigns to whichever real agent currently has the fewest active leads', () => {
    const leads = [openLead('agent_1'), openLead('agent_1'), openLead('agent_2')];
    expect(recommendAgentForNewLead(leads, AGENTS)).toBe('agent_2');
  });

  it('returns null when there are no agents to assign to', () => {
    expect(recommendAgentForNewLead([], [])).toBeNull();
  });
});

describe('recommendRebalancing', () => {
  it('does nothing for a trivial workload gap', () => {
    const leads = [openLead('agent_1'), openLead('agent_1'), openLead('agent_2')];
    expect(recommendRebalancing(leads, AGENTS)).toEqual([]);
  });

  it('recommends moving uncontacted leads when the gap is genuinely large', () => {
    const leads = [
      ...Array.from({ length: 10 }, () => openLead('agent_1')),
      openLead('agent_2'),
    ];
    const result = recommendRebalancing(leads, AGENTS, { minGap: 5, moveCount: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].fromAgentId).toBe('agent_1');
    expect(result[0].toAgentId).toBe('agent_2');
    expect(result[0].count).toBe(3);
  });

  it('only ever moves uncontacted (never-called) leads, not ones already in progress', () => {
    const leads = [
      ...Array.from({ length: 8 }, () => openLead('agent_1', { lastContactTime: '8/9/2026' })), // already contacted
      openLead('agent_2'),
    ];
    const result = recommendRebalancing(leads, AGENTS, { minGap: 5 });
    expect(result).toEqual([]); // nothing movable even though the gap is real
  });
});
