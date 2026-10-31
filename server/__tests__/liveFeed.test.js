import { describe, it, expect } from 'vitest';
import { buildLiveFeed } from '../liveFeed.js';

describe('buildLiveFeed', () => {
  it('merges call events, WhatsApp activity, and inbound messages sorted newest-first', () => {
    const feed = buildLiveFeed({
      callEvents: [{ id: 'c1', receivedAt: '2026-08-09T10:00:00.000Z', leadName: 'Rahul', callStatus: 'completed' }],
      leads: [{ id: 'l1', name: 'Priya', whatsappActivity: [{ id: 'w1', timestamp: '2026-08-09T12:00:00.000Z', type: 'brochure', detail: 'Brochure sent.', success: true }] }],
      inboundMessages: [{ id: 'm1', receivedAt: '2026-08-09T11:00:00.000Z', from: '911234', text: 'Looks good' }],
    });
    expect(feed.map(e => e.id)).toEqual(['wa_w1', 'inbound_m1', 'call_c1']); // newest first
  });

  it('marks a failed WhatsApp activity with a warning icon, not the success icon', () => {
    const feed = buildLiveFeed({
      leads: [{ id: 'l1', name: 'Test', whatsappActivity: [{ id: 'w1', timestamp: '2026-08-09T10:00:00.000Z', type: 'brochure', detail: 'Failed.', success: false }] }],
    });
    expect(feed[0].icon).toBe('⚠️');
  });

  it('drops entries with no usable timestamp instead of crashing', () => {
    const feed = buildLiveFeed({ callEvents: [{ id: 'c1', receivedAt: null, leadName: 'X' }] });
    expect(feed).toEqual([]);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, receivedAt: new Date(Date.now() - i * 1000).toISOString(), leadName: 'X' }));
    const feed = buildLiveFeed({ callEvents: many }, 10);
    expect(feed).toHaveLength(10);
  });
});
