// Single entry point for every Gemini call, with two jobs the raw SDK doesn't do:
//
// 1. RETRY transient failures. Free-tier hits per-minute limits constantly; a bare
//    call fails permanently on a 429 that would have succeeded 30s later.
// 2. RECORD what happened. AIVA ran at a 99% analysis-failure rate (198/200 stored
//    call events) without surfacing it anywhere — the dashboard looked fine while
//    the AI layer was almost entirely dead. Silent degradation is the failure mode
//    to design against, so every call is counted and exposed via /api/ai/health.
import { GoogleGenAI } from '@google/genai';

const RETRYABLE_STATUS = [429, 500, 502, 503, 504];
const MAX_ATTEMPTS = 3;

// Model fallback chain. A single Gemini model can be transiently overloaded (503
// "experiencing high demand") while others are fine — real incident: every call
// analysis failed on 503 while the key itself was healthy. Rather than lose the
// analysis, we walk down this chain. Order is best-quality-first.
// Re-verified against the live API 2026-10-08: gemini-2.5-flash had been retired
// (404 "no longer available"), so it was a dead entry that also masked the real
// cause of earlier failures. Free-tier quota is 20 requests/day PER MODEL, so a
// longer chain is also more total daily capacity. Lite models sit last on purpose.
export const MODEL_CHAIN = [
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

// Rolling in-process counters. Reset when the function instance recycles, which is
// fine — this answers "is the AI working right now", not long-term analytics.
const stats = {
  total: 0,
  ok: 0,
  failed: 0,
  quotaExhausted: 0,
  retried: 0,
  lastError: null,
  lastErrorAt: null,
  lastSuccessAt: null,
  lastModel: null,
};

export function getGeminiStats() {
  const failureRate = stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : null;
  return {
    ...stats,
    failureRate,
    // A high failure rate on a meaningful sample is an outage, not noise.
    degraded: stats.total >= 5 && failureRate !== null && failureRate >= 50,
  };
}

function classify(err) {
  const msg = String(err?.message || '');
  const status = Number((msg.match(/"code"\s*:\s*(\d+)/) || [])[1]) || err?.status || 0;
  // A per-DAY quota won't recover from a retry; a per-minute one will.
  const isDailyQuota = /PerDay|per day|quota_metric.*per_day/i.test(msg)
    || (/RESOURCE_EXHAUSTED/i.test(msg) && /GenerateRequestsPerDay/i.test(msg));
  const retryDelaySec = Number((msg.match(/"retryDelay"\s*:\s*"(\d+)s"/) || [])[1]) || null;
  return { status, isDailyQuota, retryDelaySec, isQuota: status === 429 || /RESOURCE_EXHAUSTED/i.test(msg) };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Runs a Gemini request with retry/backoff and outcome recording.
 * @param {(ai: GoogleGenAI) => Promise<any>} fn  receives a configured client
 * @param {string} label  short name for logging, e.g. 'analyzeCall'
 */
export async function callGemini(fn, label = 'gemini', { models = MODEL_CHAIN } = {}) {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) {
    const err = new Error('No server-side GEMINI_API_KEY configured.');
    err.code = 'NO_KEY';
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey: key });
  stats.total++;
  let lastErr;

  // Outer loop: fall back to the next model when this one is unavailable.
  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    let advanceModel = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await fn(ai, model);
        stats.ok++;
        stats.lastSuccessAt = new Date().toISOString();
        stats.lastModel = model;
        if (m > 0) console.log(`[gemini:${label}] succeeded on fallback model ${model}`);
        return result;
      } catch (err) {
        lastErr = err;
        const { status, isDailyQuota, retryDelaySec, isQuota } = classify(err);

        // A daily quota won't clear mid-request, and it applies per-model — so
        // move to the next model rather than burning time retrying this one.
        if (isDailyQuota) { stats.quotaExhausted++; advanceModel = true; break; }
        // Model retired/unknown, or overloaded after our retries — try the next.
        if (status === 404) { advanceModel = true; break; }
        if (!RETRYABLE_STATUS.includes(status)) break;
        if (attempt === MAX_ATTEMPTS) { advanceModel = true; break; }

        // 503 overload needs a real pause, not a 500ms tap. Honour the server's
        // own hint when given, capped so a request can't hang the function.
        const base = status === 503 ? 2000 : 500;
        const waitMs = retryDelaySec ? Math.min(retryDelaySec * 1000, 15000) : Math.min(base * 2 ** (attempt - 1), 8000);
        stats.retried++;
        console.log(`[gemini:${label}] ${model} attempt ${attempt} failed (${status}${isQuota ? ' quota' : ''}) — retrying in ${waitMs}ms`);
        await sleep(waitMs);
      }
    }
    if (!advanceModel) break; // non-retryable error: further models won't help
    if (m < models.length - 1) console.log(`[gemini:${label}] falling back from ${model} to ${models[m + 1]}`);
  }

  stats.failed++;
  stats.lastError = String(lastErr?.message || 'unknown').slice(0, 300);
  stats.lastErrorAt = new Date().toISOString();
  console.error(`[gemini:${label}] FAILED on all models: ${stats.lastError}`);
  throw lastErr;
}
