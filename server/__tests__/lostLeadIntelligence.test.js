import { describe, it, expect } from 'vitest';
import { categorizeLostReason, summarizeLostReasons } from '../lostLeadIntelligence.js';

describe('categorizeLostReason', () => {
  it('a named competitor mention is the strongest signal, checked first', () => {
    const result = categorizeLostReason({ competitorMentions: ['Prestige Group'], objections: ['price too high'] });
    expect(result.category).toBe('competitor');
    expect(result.detail).toContain('Prestige Group');
  });

  it('a real no-answer streak means unreachable, without needing any text', () => {
    expect(categorizeLostReason({ noAnswerStreak: 4 }).category).toBe('unreachable');
  });

  it('matches price objections from real stored text', () => {
    expect(categorizeLostReason({ objections: ['Felt the price per sqft was too high'] }).category).toBe('price');
  });

  it('matches approval/legal concerns', () => {
    expect(categorizeLostReason({ qualificationReason: 'Worried about BIAAPA approval status' }).category).toBe('approval');
  });

  it('falls back to no_follow_up when there is genuinely no reason on record', () => {
    expect(categorizeLostReason({}).category).toBe('no_follow_up');
  });

  it('falls back to other when there is unrecognized real text, never invents a specific category', () => {
    const result = categorizeLostReason({ remarks: 'Said something unrelated to any known objection type' });
    expect(result.category).toBe('other');
  });
});

describe('summarizeLostReasons', () => {
  it('only counts genuinely lost leads (Not Interested)', () => {
    const leads = [
      { interestLevel: 'Not Interested', objections: ['too expensive'] },
      { interestLevel: 'Hot Lead', objections: ['too expensive'] }, // still active — must not count
    ];
    const { totalLost } = summarizeLostReasons(leads);
    expect(totalLost).toBe(1);
  });

  it('percentages sum to roughly 100 across categories', () => {
    const leads = [
      { interestLevel: 'Not Interested', objections: ['price too high'] },
      { interestLevel: 'Not Interested', competitorMentions: ['XYZ Builders'] },
    ];
    const { breakdown } = summarizeLostReasons(leads);
    const totalPct = breakdown.reduce((s, b) => s + b.pct, 0);
    expect(totalPct).toBe(100);
  });
});
