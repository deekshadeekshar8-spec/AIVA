import { describe, it, expect } from 'vitest';
import { computeLeadScore, mergeBuyingSignals } from '../leadScore.js';

describe('computeLeadScore', () => {
  it('scores a brand-new lead with no signal as Cold', () => {
    const { value, temperature } = computeLeadScore({ interestLevel: 'Warm Lead', budget: 0 });
    expect(temperature).toBe('Cold');
    expect(value).toBeLessThan(12);
  });

  it('a sticky refusal is always Cold with score 0, regardless of prior signal', () => {
    const lead = {
      interestLevel: 'Not Interested', budget: 5000000, projectInterest: 'Garden City',
      buyingSignals: { askedToBook: true, requestedSiteVisit: true },
    };
    const { value, temperature } = computeLeadScore(lead);
    expect(value).toBe(0);
    expect(temperature).toBe('Cold');
  });

  it('asking to book a plot is the single strongest signal and pushes toward Hot', () => {
    const lead = { interestLevel: 'Interested', budget: 3000000, buyingSignals: { askedToBook: true } };
    const { value, temperature } = computeLeadScore(lead);
    expect(value).toBeGreaterThanOrEqual(20);
    expect(temperature).not.toBe('Cold');
  });

  it('stacking real signals crosses into Hot territory', () => {
    const lead = {
      interestLevel: 'Hot Lead', budget: 4500000, locationPreference: 'Near airport',
      projectInterest: 'Garden City', qualified: true, siteVisitScheduled: '2026-08-20',
      salesBrain: { urgencyLevel: 'High' },
      buyingSignals: { askedFinalPrice: true, askedBookingAmount: true, requestedSiteVisit: true, askedToBook: true },
    };
    const { value, temperature } = computeLeadScore(lead);
    expect(temperature).toBe('Hot');
    expect(value).toBeGreaterThanOrEqual(65);
  });

  it('frustration on the last call pulls the score down', () => {
    const withoutFrustration = computeLeadScore({ interestLevel: 'Warm Lead', budget: 3000000 });
    const withFrustration = computeLeadScore({ interestLevel: 'Warm Lead', budget: 3000000, frustrationDetected: true });
    expect(withFrustration.value).toBeLessThan(withoutFrustration.value);
  });

  it('score is always clamped to [0, 100]', () => {
    const lead = {
      interestLevel: 'Hot Lead', budget: 5000000, locationPreference: 'x', projectInterest: 'Garden City',
      qualified: true, siteVisitScheduled: '2026-08-20', salesBrain: { urgencyLevel: 'High' },
      buyingSignals: {
        askedFinalPrice: true, askedBookingAmount: true, askedAvailability: true, askedEMI: true,
        askedNegotiation: true, askedApprovals: true, askedDocuments: true, comparedCompetitor: true,
        requestedSiteVisit: true, askedToBook: true,
      },
    };
    const { value } = computeLeadScore(lead);
    expect(value).toBeLessThanOrEqual(100);
  });
});

describe('mergeBuyingSignals', () => {
  it('accumulates signals across calls (OR, never un-set)', () => {
    const afterCall1 = mergeBuyingSignals(undefined, { askedEMI: true, askedFinalPrice: false });
    const afterCall2 = mergeBuyingSignals(afterCall1, { askedFinalPrice: true, askedEMI: false });
    expect(afterCall2.askedEMI).toBe(true); // still true even though call 2 didn't re-trigger it
    expect(afterCall2.askedFinalPrice).toBe(true);
  });
});
