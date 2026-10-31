import { describe, it, expect } from 'vitest';
import { computeEscalation, buildHandoffSummary } from '../escalation.js';

describe('computeEscalation — new human-handoff triggers', () => {
  it('flags an explicit human request', () => {
    const result = computeEscalation({ escalationSignals: { explicitHumanRequest: true } });
    expect(result.escalationCategory).toBe('explicit_human_request');
  });

  it('flags a legal/documentation concern', () => {
    const result = computeEscalation({ escalationSignals: { legalOrDocumentationConcern: true } });
    expect(result.escalationCategory).toBe('legal_concern');
  });

  it('flags a genuine complaint', () => {
    const result = computeEscalation({ escalationSignals: { complaintRaised: true } });
    expect(result.escalationCategory).toBe('complaint');
  });

  it('returns null when nothing real triggers escalation', () => {
    expect(computeEscalation({ escalationSignals: { explicitHumanRequest: false } })).toBeNull();
  });
});

describe('buildHandoffSummary', () => {
  it('builds a real summary card from actual lead fields', () => {
    const lead = {
      name: 'Rahul', budget: 4500000, siteSizeSqft: 1200, projectInterest: 'Garden City',
      locationPreference: 'Airport side', objections: ['Price'], competitorMentions: ['Prestige Group'],
      leadScore: { temperature: 'Hot' }, nextBestAction: { action: 'Call customer for negotiation.' },
    };
    const card = buildHandoffSummary(lead);
    expect(card.headline).toContain('HOT');
    expect(card.customer).toBe('Rahul');
    expect(card.budget).toBe('₹45,00,000');
    expect(card.requirement).toContain('1200 sqft');
    expect(card.concern).toBe('Price');
    expect(card.competitor).toBe('Prestige Group');
    expect(card.recommendedAction).toBe('Call customer for negotiation.');
  });

  it('never invents missing data — shows honest placeholders', () => {
    const card = buildHandoffSummary({ name: 'New Lead' });
    expect(card.budget).toBe('Not stated');
    expect(card.concern).toBe('None recorded');
    expect(card.competitor).toBe('None mentioned');
  });
});
