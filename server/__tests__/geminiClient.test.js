// Model fallback + retry. Real incident (2026-10-08): every call analysis failed
// with 503 "model experiencing high demand" while the API key was perfectly
// healthy, because retries were too fast and there was no alternative model.
// These tests lock in the recovery behaviour.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { callGemini, MODEL_CHAIN } from '../geminiClient.js';

beforeAll(() => { process.env.GEMINI_API_KEY = 'test-key-not-used-for-network'; });

const err = (code, message = 'x') => new Error(JSON.stringify({ error: { code, message } }));

describe('model fallback chain', () => {
  it('has a primary plus at least one alternative', () => {
    expect(MODEL_CHAIN.length).toBeGreaterThanOrEqual(2);
    expect(MODEL_CHAIN[0]).toBe('gemini-flash-latest');
  });

  it('falls back to the next model when one is retired (404)', async () => {
    const seen = [];
    const out = await callGemini(async (_ai, model) => {
      seen.push(model);
      if (model === 'A') throw err(404, 'model not found');
      return 'ok';
    }, 'test', { models: ['A', 'B'] });
    expect(out).toBe('ok');
    expect(seen).toEqual(['A', 'B']);
  });

  it('retries a 503 on the same model before giving up on it', async () => {
    let calls = 0;
    const out = await callGemini(async () => {
      calls++;
      if (calls < 3) throw err(503, 'high demand');
      return 'recovered';
    }, 'test', { models: ['only'] });
    expect(out).toBe('recovered');
    expect(calls).toBe(3);
  }, 30000);

  it('moves to the next model when one stays overloaded', async () => {
    const seen = [];
    const out = await callGemini(async (_ai, model) => {
      seen.push(model);
      if (model === 'busy') throw err(503, 'high demand');
      return 'ok';
    }, 'test', { models: ['busy', 'free'] });
    expect(out).toBe('ok');
    expect(seen.filter(m => m === 'busy').length).toBe(3); // exhausted retries first
    expect(seen[seen.length - 1]).toBe('free');
  }, 30000);

  it('does not retry a non-retryable error (403) or try other models', async () => {
    const seen = [];
    await expect(callGemini(async (_ai, model) => {
      seen.push(model);
      throw err(403, 'project denied');
    }, 'test', { models: ['A', 'B'] })).rejects.toThrow();
    expect(seen).toEqual(['A']); // 403 is an account problem; other models won't help
  });

  it('throws when no API key is configured', async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    await expect(callGemini(async () => 'x', 'test')).rejects.toThrow(/GEMINI_API_KEY/);
    process.env.GEMINI_API_KEY = saved;
  });
});

describe('model chain hygiene', () => {
  it('contains no retired model (gemini-2.5-flash returned 404 on 2026-10-08)', () => {
    expect(MODEL_CHAIN).not.toContain('gemini-2.5-flash');
    expect(MODEL_CHAIN).not.toContain('gemini-2.0-flash');
  });

  it('has no duplicates, which would waste a retry round on the same dead model', () => {
    expect(new Set(MODEL_CHAIN).size).toBe(MODEL_CHAIN.length);
  });

  it('has enough depth to survive several models hitting their daily quota', () => {
    expect(MODEL_CHAIN.length).toBeGreaterThanOrEqual(5);
  });
});
