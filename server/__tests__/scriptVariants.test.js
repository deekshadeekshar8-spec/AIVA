// Evolution Engine: variant selection decides which script a REAL customer call
// uses, and the stats decide which script a manager promotes. Both must never
// silently include a draft/archived variant or overstate a small sample.
import { describe, it, expect } from 'vitest';
import { pickVariantForAgent, computeVariantStats } from '../scriptVariants.js';

const v = (id, status, agentId = null) => ({ id, status, agentId, name: id });

describe('pickVariantForAgent', () => {
  it('never selects a draft or archived variant', () => {
    const variants = [v('d', 'draft'), v('a', 'archived')];
    expect(pickVariantForAgent(variants, 'agent_1')).toBeNull();
  });

  it('returns null when nothing is active, so callers fall back to per-lead strategy', () => {
    expect(pickVariantForAgent([], 'agent_1')).toBeNull();
    expect(pickVariantForAgent(undefined, 'agent_1')).toBeNull();
  });

  it('selects a global active variant for any agent', () => {
    expect(pickVariantForAgent([v('g', 'active')], 'agent_3').id).toBe('g');
  });

  it('selects an agent-scoped variant for that agent', () => {
    expect(pickVariantForAgent([v('s', 'active', 'agent_2')], 'agent_2').id).toBe('s');
  });

  it('does not leak another agent-scoped variant to the wrong agent', () => {
    expect(pickVariantForAgent([v('s', 'active', 'agent_2')], 'agent_5')).toBeNull();
  });

  it('only ever returns something active', () => {
    const variants = [v('d', 'draft', 'agent_1'), v('x', 'active', 'agent_1'), v('a', 'archived', 'agent_1')];
    for (let i = 0; i < 25; i++) {
      expect(pickVariantForAgent(variants, 'agent_1').id).toBe('x');
    }
  });
});

describe('computeVariantStats', () => {
  const ev = (variantId, interestLevel) => ({ scriptVariantId: variantId, analysis: { suggestedUpdates: { interestLevel } } });

  it('reports null rate (not 0%) when there is no data, so an untested script is not read as failing', () => {
    const [s] = computeVariantStats([v('a', 'active')], []);
    expect(s.calls).toBe(0);
    expect(s.qualifiedRate).toBeNull();
  });

  it('counts only calls attributed to that variant', () => {
    const events = [ev('a', 'Hot Lead'), ev('b', 'Hot Lead'), ev('a', 'Not Interested')];
    const [s] = computeVariantStats([v('a', 'active')], events);
    expect(s.calls).toBe(2);
    expect(s.qualified).toBe(1);
    expect(s.notInterested).toBe(1);
    expect(s.qualifiedRate).toBe(50);
  });

  it('treats Hot Lead and Interested as qualified, nothing else', () => {
    const events = [ev('a', 'Hot Lead'), ev('a', 'Interested'), ev('a', 'Warm Lead'), ev('a', 'Not Reachable')];
    const [s] = computeVariantStats([v('a', 'active')], events);
    expect(s.qualified).toBe(2);
    expect(s.qualifiedRate).toBe(50);
  });

  it('ignores untagged events entirely', () => {
    const [s] = computeVariantStats([v('a', 'active')], [{ analysis: {} }, ev(null, 'Hot Lead')]);
    expect(s.calls).toBe(0);
  });
});
