// analyzeCallForLead must judge each call against the business that agent actually
// sells. Gemini is mocked so we can inspect the prompt and drive the parser directly.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('../geminiClient.js', () => ({ callGemini: vi.fn() }));
import { callGemini } from '../geminiClient.js';
import { analyzeCallForLead } from '../analyzeCall.js';

let lastPrompt = '';

function modelReplies(reply) {
  callGemini.mockImplementation(async (fn) =>
    fn({
      models: {
        generateContent: async ({ contents }) => {
          lastPrompt = contents;
          return { text: JSON.stringify(reply) };
        },
      },
    }, 'test-model'));
}

const payload = {
  call_status: 'completed',
  call_report: { full_conversation: 'Customer: yes, I want a plot.', summary: '', sentiment: '' },
};
const base = {
  interestLevel: 'Interested', status: 'Contacted', remarks: 'ok',
  qualified: true, qualificationReason: 'asked for a plot',
};

beforeAll(() => { process.env.GEMINI_API_KEY = 'test-key-not-used-for-network'; });
beforeEach(() => { lastPrompt = ''; callGemini.mockReset(); });

describe('Vistara (agent_6) is judged against RK Avenue', () => {
  const vistaraLead = { id: 'l1', name: 'Ajay', agentId: 'agent_6' };

  it('briefs the model on RK Avenue and not as the Society', async () => {
    modelReplies({ ...base, projectInterest: 'RK Avenue' });
    await analyzeCallForLead(payload, vistaraLead);
    expect(lastPrompt).toContain('RK Avenue');
    expect(lastPrompt).toContain('Alkapura Village');
    expect(lastPrompt).toMatch(/NOT the Co-operative Society/i);
    expect(lastPrompt).not.toMatch(/membership fee|booking advance|down payment/i);
  });

  it('records RK Avenue as the project', async () => {
    modelReplies({ ...base, projectInterest: 'RK Avenue' });
    const r = await analyzeCallForLead(payload, vistaraLead);
    expect(r.suggestedUpdates.projectInterest).toBe('RK Avenue');
    expect(r.suggestedUpdates.project).toBe('RK Avenue');
  });

  it('rejects a Society project name, which Vistara never sells', async () => {
    modelReplies({ ...base, projectInterest: 'Garden City' });
    const r = await analyzeCallForLead(payload, vistaraLead);
    expect(r.suggestedUpdates.projectInterest).toBeUndefined();
  });

  it('never records a plot size or corner interest, since RK Avenue has none defined', async () => {
    modelReplies({ ...base, projectInterest: 'RK Avenue', siteSizeSqft: 1200, cornerSiteInterest: true });
    const r = await analyzeCallForLead(payload, vistaraLead);
    expect(r.suggestedUpdates.siteSizeSqft).toBeUndefined();
    expect(r.suggestedUpdates.cornerSiteInterest).toBeUndefined();
  });
});

describe('Society agents are unchanged', () => {
  const societyLead = { id: 'l2', name: 'Suresh', agentId: 'agent_1' };

  it('briefs the model on the Society projects', async () => {
    modelReplies({ ...base, projectInterest: 'Garden City' });
    await analyzeCallForLead(payload, societyLead);
    expect(lastPrompt).toContain('North Metro City');
    expect(lastPrompt).toContain('Garden City');
    expect(lastPrompt).not.toContain('Alkapura Village');
  });

  it('still records Society project and size', async () => {
    modelReplies({ ...base, projectInterest: 'Garden City', siteSizeSqft: 1500, cornerSiteInterest: true });
    const r = await analyzeCallForLead(payload, societyLead);
    expect(r.suggestedUpdates.projectInterest).toBe('Garden City');
    expect(r.suggestedUpdates.siteSizeSqft).toBe(1500);
    expect(r.suggestedUpdates.cornerSiteInterest).toBe(true);
  });

  it('rejects RK Avenue, which Society agents never sell', async () => {
    modelReplies({ ...base, projectInterest: 'RK Avenue' });
    const r = await analyzeCallForLead(payload, societyLead);
    expect(r.suggestedUpdates.projectInterest).toBeUndefined();
  });
});
