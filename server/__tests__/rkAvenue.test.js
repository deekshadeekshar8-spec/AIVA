// RK Avenue / Vistara (agent_6).
//
// Real incident 2026-10-08: Vistara's 21 calls were analysed against the Society's
// projects only. RK Avenue was called "an external project", and Ajay kumar J, who
// answered "yes" to Vistara's own opening question, was permanently closed.
import { describe, it, expect } from 'vitest';
import {
  isRkAvenueAgent, projectNamesFor, buildBriefingForAgent, buildRkAvenueBriefing,
  buildBusinessBriefing, RK_AVENUE, VISTARA_AGENT_ID,
} from '../businessFacts.js';

describe('agent routing', () => {
  it('treats only Vistara (agent_6) as the RK Avenue agent', () => {
    expect(VISTARA_AGENT_ID).toBe('agent_6');
    expect(isRkAvenueAgent('agent_6')).toBe(true);
    for (const a of ['agent_1', 'agent_2', 'agent_3', 'agent_4', 'agent_5', undefined, null, '']) {
      expect(isRkAvenueAgent(a)).toBe(false);
    }
  });

  it('only lets Vistara record RK Avenue, and Society agents record Society projects', () => {
    expect(projectNamesFor('agent_6')).toEqual(['RK Avenue']);
    expect(projectNamesFor('agent_1').sort()).toEqual(['Garden City', 'North Metro City']);
    expect(projectNamesFor('agent_1')).not.toContain('RK Avenue');
  });

  it('hands each agent its own briefing', () => {
    expect(buildBriefingForAgent('agent_6')).toBe(buildRkAvenueBriefing());
    expect(buildBriefingForAgent('agent_1')).toBe(buildBusinessBriefing());
    expect(buildBriefingForAgent(undefined)).toBe(buildBusinessBriefing());
  });
});

describe("RK Avenue briefing matches Vistara's own prompt", () => {
  const b = buildRkAvenueBriefing();

  it('carries the real facts', () => {
    expect(RK_AVENUE.plots).toBe(36);
    expect(RK_AVENUE.ratePerSqft).toBe(2299);
    expect(b).toContain('RK Avenue');
    expect(b).toContain('Alkapura Village');
    expect(b).toContain('Gauribidanur');
    expect(b).toContain('Rs.2299');
    expect(b).toContain('36');
  });

  it('says plainly this is not the Society, so Society projects never judge a call', () => {
    expect(b).toMatch(/NOT the Co-operative Society/i);
    expect(b).toMatch(/does NOT sell North Metro City or Garden City/i);
  });

  it('treats a yes to the opening question as engagement (the Ajay bug)', () => {
    expect(b).toMatch(/Doddaballapur Highway/);
    expect(b).toMatch(/"yes".*genuine engagement/i);
  });

  it('does not invent what Vistara itself says is unavailable', () => {
    expect(b).toMatch(/NOT AVAILABLE/);
    expect(b).toMatch(/do not extract or guess a plot size/i);
  });

  it("keeps Vistara's own compliance rules", () => {
    expect(b).toMatch(/NEVER quote a discount/i);
    expect(b).toMatch(/NEVER discuss other projects/i);
    expect(b).toMatch(/NEVER promise booking confirmation/i);
  });

  it("does not leak the Society's payment structure into RK Avenue calls", () => {
    expect(b).not.toMatch(/membership fee|booking advance|down payment|installment/i);
  });
});
