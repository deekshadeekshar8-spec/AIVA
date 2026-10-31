// Verifies the price calculator reproduces the EXACT figures published in the live
// Omnidimension agent prompts. If these ever diverge, the AI would quote a customer
// a different number than the agent does on the phone.
import { describe, it, expect } from 'vitest';
import { computeSitePrice, buildBusinessBriefing, PROJECTS, SITE_SIZES_SQFT } from '../businessFacts.js';

// Transcribed verbatim from the live agent `context` field.
// [project, sqft, total, downPayment, installment, cornerTotal]
const PUBLISHED = [
  ['North Metro City', 1200, 1678800, 503640, 391720, 1846680],
  ['North Metro City', 1500, 2098500, 629550, 489650, 2308350],
  ['North Metro City', 2400, 3357600, 1007280, 783440, 3693360],
  ['North Metro City', 4000, 5596000, 1678800, 1305733, 6155600],
  ['Garden City', 1200, 1498800, 449640, 349720, 1648680],
  ['Garden City', 1500, 1873500, 562050, 437150, 2060850],
  ['Garden City', 2400, 2997600, 899280, 699440, 3297360],
  ['Garden City', 4000, 4996000, 1498800, 1165733, 5495600],
];

describe('computeSitePrice matches the published rate card', () => {
  it.each(PUBLISHED)('%s %i sqft', (project, sqft, total, down, installment, cornerTotal) => {
    const r = computeSitePrice(project, sqft);
    expect(r.total).toBe(total);
    expect(r.downPayment).toBe(down);
    expect(r.installmentAmount).toBe(installment);
    expect(computeSitePrice(project, sqft, true).total).toBe(cornerTotal);
  });

  it('down payment + remaining always reconciles to the total', () => {
    for (const [project, sqft] of PUBLISHED) {
      const r = computeSitePrice(project, sqft);
      expect(r.downPayment + r.remaining).toBe(r.total);
    }
  });
});

describe('computeSitePrice refuses to guess', () => {
  it('returns null for a project that does not exist', () => {
    expect(computeSitePrice('Metro Greens', 1200)).toBeNull();
    expect(computeSitePrice('', 1200)).toBeNull();
  });
  it('returns null for a site size not in the catalogue', () => {
    expect(computeSitePrice('Garden City', 999)).toBeNull();
    expect(computeSitePrice('Garden City', 1201)).toBeNull();
    expect(computeSitePrice('Garden City', null)).toBeNull();
  });
  it('only recognises the two real projects', () => {
    expect(Object.keys(PROJECTS).sort()).toEqual(['Garden City', 'North Metro City']);
    expect(SITE_SIZES_SQFT).toEqual([1200, 1500, 2400, 4000]);
  });
});

describe('business briefing carries the compliance guardrails', () => {
  const briefing = buildBusinessBriefing();
  it.each([
    ['discount ban', /discount/i],
    ['no exact registration date', /exact registration date/i],
    ['no guaranteed returns', /guarantee/i],
    ['no margin claims', /at cost|markup/i],
    ['approvals still under process', /under process/i],
  ])('states the %s', (_label, pattern) => expect(briefing).toMatch(pattern));

  it('names both real projects and neither of the stale template ones', () => {
    expect(briefing).toContain('North Metro City');
    expect(briefing).toContain('Garden City');
    expect(briefing).not.toMatch(/Metro Greens|Premium Serene/i);
  });
});
