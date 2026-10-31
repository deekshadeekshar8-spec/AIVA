import { describe, it, expect } from 'vitest';
import { computeSalesFunnel } from '../salesFunnel.js';

const lead = (overrides = {}) => ({ status: 'Pending', interestLevel: 'Warm Lead', siteVisitScheduled: '', ...overrides });

describe('computeSalesFunnel', () => {
  it('excludes leads who explicitly refused, from every stage', () => {
    const leads = [lead({ interestLevel: 'Not Interested' }), lead({ interestLevel: 'Wrong Number' })];
    const funnel = computeSalesFunnel(leads);
    expect(funnel.totalOpen).toBe(0);
  });

  it('a lead with a real scheduled site visit sits in the site_visit stage regardless of raw status', () => {
    const leads = [lead({ status: 'Contacted', siteVisitScheduled: '2026-08-20' })];
    const funnel = computeSalesFunnel(leads);
    const siteVisitStage = funnel.stages.find(s => s.id === 'site_visit');
    expect(siteVisitStage.count).toBe(1);
  });

  it('flags the genuinely largest non-final stage as the bottleneck', () => {
    const leads = [
      ...Array.from({ length: 5 }, () => lead({ status: 'Contacted' })),
      lead({ status: 'Pending' }),
    ];
    const funnel = computeSalesFunnel(leads);
    expect(funnel.bottleneck.stageId).toBe('engaged');
    expect(funnel.bottleneck.count).toBe(5);
  });

  it('reports no bottleneck when every non-final stage is empty', () => {
    const leads = [lead({ status: 'Handed Over' })];
    const funnel = computeSalesFunnel(leads);
    expect(funnel.bottleneck).toBeNull();
  });
});
