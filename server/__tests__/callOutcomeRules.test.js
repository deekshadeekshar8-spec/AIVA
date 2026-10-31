// Safety-critical regression suite. Every test here corresponds to a rule that,
// if broken, causes real-world harm: calling someone who asked us to stop, or
// silently blacklisting a customer who wanted to buy.
//
// Two of these are regressions for bugs that actually shipped and were caught
// by hand — they exist so those bugs can never return unnoticed.
import { describe, it, expect } from 'vitest';
import {
  decideLeadUpdates,
  shouldSendAutoBrochure,
  isNoAnswer,
  isStickyLead,
  NO_ANSWER_RETRY_MS,
  DAILY_FOLLOWUP_MS,
} from '../callOutcomeRules.js';

const NOW = Date.parse('2026-08-05T10:00:00.000Z');
const ok = (suggestedUpdates = {}) => ({ analyzed: true, suggestedUpdates });
const failed = (reason = 'quota exhausted') => ({ analyzed: false, reason, suggestedUpdates: {} });

describe('isNoAnswer', () => {
  it.each(['no-answer', 'no_answer', 'BUSY', 'failed', 'missed', 'unanswered', 'Not-Answered'])(
    'treats %s as a no-answer', (status) => expect(isNoAnswer(status)).toBe(true)
  );
  it.each(['completed', 'answered', '', null, undefined])(
    'does not treat %s as a no-answer', (status) => expect(isNoAnswer(status)).toBe(false)
  );
});

describe('isStickyLead', () => {
  it('marks explicit refusals sticky', () => {
    expect(isStickyLead({ interestLevel: 'Not Interested' })).toBe(true);
    expect(isStickyLead({ interestLevel: 'Wrong Number' })).toBe(true);
  });
  it('leaves everyone else callable', () => {
    expect(isStickyLead({ interestLevel: 'Hot Lead' })).toBe(false);
    expect(isStickyLead({})).toBe(false);
    expect(isStickyLead(undefined)).toBe(false);
  });
});

describe('REGRESSION: a lead who said "do not call me again" must never be re-dialed', () => {
  // Real incident: a lead explicitly refused (in escalating language across 9 calls).
  // A LATER unrelated no-answer overwrote their status back to "Outgoing Retry",
  // putting them straight back in the autonomous dialer's queue.
  it('does not resurrect a Not Interested lead on a later no-answer', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Not Interested', status: 'Completed' },
      callStatus: 'no-answer',
      analysis: failed(),
      now: NOW,
    });
    expect(updates.interestLevel).toBe('Not Interested');
    expect(updates.status).toBe('Completed');
    expect(updates.nextFollowUpDate).toBeNull(); // actively cleared, not just left alone
  });

  it('does not resurrect a Wrong Number lead either', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Wrong Number', status: 'Completed' },
      callStatus: 'busy',
      analysis: failed(),
      now: NOW,
    });
    expect(updates.interestLevel).toBe('Wrong Number');
    expect(updates.nextFollowUpDate).toBeNull();
  });

  it('keeps them closed even if a later analysis suggests otherwise', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Not Interested', status: 'Completed' },
      callStatus: 'completed',
      analysis: ok({ interestLevel: 'Hot Lead', status: 'Contacted' }),
      now: NOW,
    });
    expect(updates.interestLevel).toBe('Not Interested');
    expect(updates.status).toBe('Completed');
  });
});

describe('REGRESSION: a failed AI analysis must never blacklist a real customer', () => {
  // Real bug found this session: when Gemini failed (quota exhausted), a CONNECTED
  // call produced no interestLevel, so the "no engagement" rule fired and marked an
  // actively-interested customer "Not Interested" + "Completed" — which is sticky,
  // meaning they'd never be called again.
  it('leaves interest untouched when analysis failed on a connected call', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead', status: 'Pending' },
      callStatus: 'completed',
      analysis: failed('429 quota exhausted'),
      now: NOW,
    });
    expect(updates.interestLevel).toBeUndefined(); // no verdict invented
    expect(updates.status).not.toBe('Completed');
  });

  it('still applies the no-engagement rule when analysis genuinely succeeded', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead', status: 'Pending' },
      callStatus: 'completed',
      analysis: ok({}), // ran fine, found no engagement
      now: NOW,
    });
    expect(updates.interestLevel).toBe('Not Interested');
    expect(updates.status).toBe('Completed');
  });
});

describe('no-answer retry cadence', () => {
  it('schedules the retry exactly 4 hours out', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead' },
      callStatus: 'no-answer',
      analysis: failed(),
      now: NOW,
    });
    expect(updates.status).toBe('Outgoing Retry');
    expect(updates.interestLevel).toBe('Not Reachable');
    expect(Date.parse(updates.nextFollowUpDate) - NOW).toBe(NO_ANSWER_RETRY_MS);
    expect(NO_ANSWER_RETRY_MS).toBe(4 * 60 * 60 * 1000);
  });
});

describe('Not Interested is always closed out', () => {
  it('forces Completed and clears any follow-up the model suggested', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Hot Lead' },
      callStatus: 'completed',
      analysis: ok({ interestLevel: 'Not Interested', status: 'Contacted', nextFollowUpDate: '2026-09-01T10:00:00.000Z' }),
      now: NOW,
    });
    expect(updates.status).toBe('Completed');
    expect(updates.nextFollowUpDate).toBeNull();
  });
});

describe('genuine outcomes are preserved', () => {
  it('keeps an interested verdict and its callback time', () => {
    const followUp = '2026-08-06T05:30:00.000Z';
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead' },
      callStatus: 'completed',
      analysis: ok({ interestLevel: 'Hot Lead', status: 'Contacted', nextFollowUpDate: followUp }),
      now: NOW,
    });
    expect(updates.interestLevel).toBe('Hot Lead');
    expect(updates.nextFollowUpDate).toBe(followUp);
  });
});

describe('RULE 6: a scheduled site visit takes priority and anchors the follow-up to that date', () => {
  it('sets nextFollowUpDate to 11:00 AM IST on the visit date', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead' },
      callStatus: 'completed',
      analysis: ok({ interestLevel: 'Hot Lead', status: 'Contacted', siteVisitScheduled: '2026-08-20' }),
      now: NOW,
    });
    expect(updates.nextFollowUpDate).toBe('2026-08-20T05:30:00.000Z');
  });

  it('overrides any explicit nextFollowUpDate the model also suggested', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead' },
      callStatus: 'completed',
      analysis: ok({
        interestLevel: 'Hot Lead',
        status: 'Contacted',
        siteVisitScheduled: '2026-08-20',
        nextFollowUpDate: '2026-09-01T10:00:00.000Z',
      }),
      now: NOW,
    });
    expect(updates.nextFollowUpDate).toBe('2026-08-20T05:30:00.000Z');
  });

  it('is still overridden by the sticky-lead lockout (a booked visit never reopens a refusal)', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Not Interested' },
      callStatus: 'completed',
      analysis: ok({ interestLevel: 'Not Interested', siteVisitScheduled: '2026-08-20' }),
      now: NOW,
    });
    expect(updates.nextFollowUpDate).toBeNull();
  });

  it('does not fire on a no-answer even if a stale siteVisitScheduled is present', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead' },
      callStatus: 'no-answer',
      analysis: failed(),
      now: NOW,
    });
    expect(updates.nextFollowUpDate).not.toBe('2026-08-20T05:30:00.000Z');
  });
});

describe('RULE 7: Interested / Hot Lead leads get a daily follow-up cadence by default', () => {
  it('defaults to +24h when the lead is Interested and gave no explicit callback time', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead' },
      callStatus: 'completed',
      analysis: ok({ interestLevel: 'Interested', status: 'Contacted' }),
      now: NOW,
    });
    expect(Date.parse(updates.nextFollowUpDate) - NOW).toBe(DAILY_FOLLOWUP_MS);
    expect(DAILY_FOLLOWUP_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('defaults to +24h for Hot Lead too', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead' },
      callStatus: 'completed',
      analysis: ok({ interestLevel: 'Hot Lead', status: 'Contacted' }),
      now: NOW,
    });
    expect(Date.parse(updates.nextFollowUpDate) - NOW).toBe(DAILY_FOLLOWUP_MS);
  });

  it('does not override an explicit callback time the lead actually gave', () => {
    const followUp = '2026-08-10T09:00:00.000Z';
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead' },
      callStatus: 'completed',
      analysis: ok({ interestLevel: 'Hot Lead', status: 'Contacted', nextFollowUpDate: followUp }),
      now: NOW,
    });
    expect(updates.nextFollowUpDate).toBe(followUp);
  });

  it('does not apply the daily cadence to other interest levels', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Warm Lead' },
      callStatus: 'completed',
      analysis: ok({ interestLevel: 'Warm Lead', status: 'Contacted' }),
      now: NOW,
    });
    expect(updates.nextFollowUpDate).toBeUndefined();
  });

  it('does not fire when the call was not answered', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Interested' },
      callStatus: 'no-answer',
      analysis: failed(),
      now: NOW,
    });
    expect(updates.nextFollowUpDate).not.toBe(new Date(NOW + DAILY_FOLLOWUP_MS).toISOString());
  });

  it('does not fire when the analysis failed', () => {
    const updates = decideLeadUpdates({
      lead: { interestLevel: 'Interested' },
      callStatus: 'completed',
      analysis: failed(),
      now: NOW,
    });
    expect(updates.nextFollowUpDate).toBeUndefined();
  });
});

describe('no-answer streak', () => {
  it('increments on consecutive no-answers', () => {
    expect(decideLeadUpdates({ lead: { noAnswerStreak: 2 }, callStatus: 'no-answer', analysis: failed(), now: NOW }).noAnswerStreak).toBe(3);
  });
  it('resets to zero as soon as a call connects', () => {
    expect(decideLeadUpdates({ lead: { noAnswerStreak: 5 }, callStatus: 'completed', analysis: ok({ interestLevel: 'Hot Lead' }), now: NOW }).noAnswerStreak).toBe(0);
  });
  it('starts from zero for a brand new lead', () => {
    expect(decideLeadUpdates({ lead: {}, callStatus: 'no-answer', analysis: failed(), now: NOW }).noAnswerStreak).toBe(1);
  });
});

describe('auto-brochure workflow guards', () => {
  const base = { lead: {}, noAnswerStreak: 3, threshold: 3, whatsappConfigured: true };
  it('fires once the threshold is reached', () => expect(shouldSendAutoBrochure(base)).toBe(true));
  it('is off by default (threshold 0)', () => expect(shouldSendAutoBrochure({ ...base, threshold: 0 })).toBe(false));
  it('does not fire below the threshold', () => expect(shouldSendAutoBrochure({ ...base, noAnswerStreak: 2 })).toBe(false));
  it('never sends twice to the same lead', () => expect(shouldSendAutoBrochure({ ...base, lead: { brochureSent: true } })).toBe(false));
  it('does not message someone who asked us to stop', () =>
    expect(shouldSendAutoBrochure({ ...base, lead: { interestLevel: 'Not Interested' } })).toBe(false));
  it('does not pretend to send when WhatsApp is unconfigured', () =>
    expect(shouldSendAutoBrochure({ ...base, whatsappConfigured: false })).toBe(false));
});
