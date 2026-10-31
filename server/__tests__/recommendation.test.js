import { describe, it, expect } from 'vitest';
import { recommendProject } from '../recommendation.js';

describe('recommendProject', () => {
  it('returns null when there is no real signal to work from', () => {
    expect(recommendProject({ budget: 0, locationPreference: '' })).toBeNull();
  });

  it('recommends Garden City for an airport-proximity preference', () => {
    const result = recommendProject({ budget: 0, locationPreference: 'Somewhere close to the airport' });
    expect(result.recommendedProject).toBe('Garden City');
    expect(result.reason).toMatch(/airport|STRR|Kempegowda/i);
  });

  it('recommends North Metro City for a university-area preference', () => {
    const result = recommendProject({ budget: 0, locationPreference: 'Near Amity University' });
    expect(result.recommendedProject).toBe('North Metro City');
  });

  it('only ever recommends a real catalogue project', () => {
    const result = recommendProject({ budget: 2000000, locationPreference: '' });
    expect(['Garden City', 'North Metro City']).toContain(result.recommendedProject);
  });

  it('flags when even the cheapest real site exceeds the stated budget, rather than pretending it fits', () => {
    const result = recommendProject({ budget: 100000, locationPreference: '' });
    expect(result.affordableSizeSqft).toBeNull();
    expect(result.reason).toMatch(/above the stated budget/i);
  });

  it('reasoning always cites a real number (rate or price), never a vague claim', () => {
    const result = recommendProject({ budget: 3000000, locationPreference: 'airport' });
    expect(result.reason).toMatch(/₹/);
  });
});
