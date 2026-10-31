// Pure logic behind the manual WhatsApp composer (server/whatsappCompose.js):
// phone validation, real-Maps-link resolution, content availability, and the
// auto-generated editable message. No network/storage — same testing pattern
// as callOutcomeRules.js / propertySharing.js.
import { describe, it, expect } from 'vitest';
import {
  isValidWhatsAppNumber, buildMapsLink, decideComposeAvailability, buildComposedMessage,
} from '../whatsappCompose.js';

describe('isValidWhatsAppNumber', () => {
  it('accepts a real 10-digit Indian number with country code', () => {
    expect(isValidWhatsAppNumber('+919876543210')).toBe(true);
  });
  it('rejects too-short input', () => {
    expect(isValidWhatsAppNumber('12345')).toBe(false);
  });
  it('rejects empty/missing input', () => {
    expect(isValidWhatsAppNumber('')).toBe(false);
    expect(isValidWhatsAppNumber(undefined)).toBe(false);
  });
  it('rejects absurdly long input', () => {
    expect(isValidWhatsAppNumber('1'.repeat(20))).toBe(false);
  });
});

describe('buildMapsLink', () => {
  it('prefers real GPS coordinates when set', () => {
    const link = buildMapsLink({ latitude: 13.198, longitude: 77.708, address: 'Devanahalli' });
    expect(link).toBe('https://www.google.com/maps?q=13.198,77.708');
  });
  it('falls back to an address search link when no coordinates are set', () => {
    const link = buildMapsLink({ latitude: 0, longitude: 0, address: 'Devanahalli, Bengaluru' });
    expect(link).toBe('https://www.google.com/maps/search/?api=1&query=Devanahalli%2C%20Bengaluru');
  });
  it('returns null when neither coordinates nor address exist yet', () => {
    expect(buildMapsLink({ latitude: 0, longitude: 0, address: '' })).toBeNull();
    expect(buildMapsLink(null)).toBeNull();
  });
});

describe('decideComposeAvailability', () => {
  it('reports nothing available for a brand-new empty config', () => {
    const availability = decideComposeAvailability({ brochureUrl: '', location: { latitude: 0, longitude: 0 }, images: [] });
    expect(availability.brochureAvailable).toBe(false);
    expect(availability.locationAvailable).toBe(false);
    expect(availability.mapsLink).toBeNull();
    expect(availability.images).toEqual([]);
  });
  it('reports what is genuinely configured', () => {
    const availability = decideComposeAvailability({
      brochureUrl: 'https://example.com/brochure.pdf',
      location: { latitude: 13.1, longitude: 77.7, address: 'Devanahalli' },
      images: [{ url: 'https://example.com/1.jpg' }],
    });
    expect(availability.brochureAvailable).toBe(true);
    expect(availability.locationAvailable).toBe(true);
    expect(availability.mapsLink).toContain('13.1,77.7');
    expect(availability.images).toHaveLength(1);
  });
});

describe('buildComposedMessage', () => {
  it('produces the full template when brochure + location are configured', () => {
    const msg = buildComposedMessage({
      leadName: 'Rahul',
      project: 'Garden City',
      config: { brochureUrl: 'https://x.com/b.pdf', location: { latitude: 13.1, longitude: 77.7, address: 'Near airport' } },
    });
    expect(msg).toContain('Hi Rahul, 👋');
    expect(msg).toContain('brochure attached');
    expect(msg).toContain('📍 Location: Near airport');
    expect(msg).toContain('🗺️ Google Maps: https://www.google.com/maps?q=13.1,77.7');
    expect(msg).toContain('schedule a site visit');
  });

  it('always appends the real office/contact block (address, maps link, site-visit phone, disclaimer)', () => {
    const msg = buildComposedMessage({ leadName: 'Rahul', project: 'Garden City', config: {} });
    expect(msg).toContain('Bengaluru Metro City Infrastructure Housing Co-operative Society Ltd');
    expect(msg).toContain('Sahakarnagar');
    expect(msg).toContain('9108047286');
    expect(msg).toContain("Don't pay any commission");
  });

  it('omits brochure/location lines when nothing is configured yet, without inventing anything', () => {
    const msg = buildComposedMessage({ leadName: 'Priya', project: 'North Metro City', config: {} });
    expect(msg).toContain('Hi Priya, 👋');
    expect(msg).not.toContain('brochure attached');
    expect(msg).not.toContain('📍 Location:');
    expect(msg).not.toContain('🗺️ Google Maps:');
  });

  it('falls back to a generic name when the lead has none', () => {
    const msg = buildComposedMessage({ leadName: '', project: 'Garden City', config: {} });
    expect(msg).toContain('Hi there, 👋');
  });
});
