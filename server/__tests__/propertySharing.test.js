// decideWhatsAppActions is the routing table behind WhatsApp Property Sharing
// (spec section 6: different content for different detected intent). Pure
// function, no network/storage — same testing pattern as callOutcomeRules.js.
import { describe, it, expect } from 'vitest';
import { decideWhatsAppActions } from '../propertySharing.js';

const intent = (overrides = {}) => ({
  wantsBrochure: false, wantsLocation: false, wantsImages: false, wantsPrice: false,
  generalInterest: false, requestedOnWhatsApp: false,
  ...overrides,
});

describe('decideWhatsAppActions', () => {
  it('returns null when there is no real signal', () => {
    expect(decideWhatsAppActions(intent())).toBeNull();
    expect(decideWhatsAppActions(null)).toBeNull();
  });

  it('brochure-only ask sends only the brochure', () => {
    const actions = decideWhatsAppActions(intent({ wantsBrochure: true }));
    expect(actions.sendBrochure).toBe(true);
    expect(actions.sendLocation).toBe(false);
    expect(actions.sendImages).toBe(false);
    expect(actions.offerSiteVisit).toBe(false);
  });

  it('location-only ask sends only the location', () => {
    const actions = decideWhatsAppActions(intent({ wantsLocation: true }));
    expect(actions.sendLocation).toBe(true);
    expect(actions.sendBrochure).toBe(false);
    expect(actions.sendImages).toBe(false);
  });

  it('images-only ask sends only images', () => {
    const actions = decideWhatsAppActions(intent({ wantsImages: true }));
    expect(actions.sendImages).toBe(true);
    expect(actions.sendBrochure).toBe(false);
    expect(actions.sendLocation).toBe(false);
  });

  it('price ask sends brochure + pricing, not location/images', () => {
    const actions = decideWhatsAppActions(intent({ wantsPrice: true }));
    expect(actions.sendBrochure).toBe(true);
    expect(actions.includePricing).toBe(true);
    expect(actions.sendLocation).toBe(false);
    expect(actions.sendImages).toBe(false);
  });

  it('"I\'m interested" sends the full bundle and offers a site visit', () => {
    const actions = decideWhatsAppActions(intent({ generalInterest: true }));
    expect(actions.sendBrochure).toBe(true);
    expect(actions.sendLocation).toBe(true);
    expect(actions.sendImages).toBe(true);
    expect(actions.offerSiteVisit).toBe(true);
  });

  it('explicit "send it on WhatsApp" with no specific ask also sends the full bundle', () => {
    const actions = decideWhatsAppActions(intent({ requestedOnWhatsApp: true }));
    expect(actions.sendBrochure).toBe(true);
    expect(actions.sendLocation).toBe(true);
    expect(actions.sendImages).toBe(true);
  });

  it('the generic "interested" bundle does not re-send content already sent', () => {
    const actions = decideWhatsAppActions(intent({ generalInterest: true }), { brochure: true, location: true, images: false });
    expect(actions.sendBrochure).toBe(false);
    expect(actions.sendLocation).toBe(false);
    expect(actions.sendImages).toBe(true);
  });

  it('an explicit per-type ask ALWAYS honours the request, even if already sent (re-ask/updated info)', () => {
    const actions = decideWhatsAppActions(intent({ wantsBrochure: true }), { brochure: true });
    expect(actions.sendBrochure).toBe(true);
  });

  it('an explicit ask for one thing does not imply the others, even with prior history', () => {
    const actions = decideWhatsAppActions(intent({ wantsLocation: true }), { brochure: false, location: false, images: false });
    expect(actions.sendBrochure).toBe(false);
    expect(actions.sendImages).toBe(false);
  });
});
