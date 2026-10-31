// Evolution Engine — script variants are call strategies (same shape as
// leadIntelligence.js's callStrategy) that get A/B tested across real calls.
// Every call dispatched while variants are active gets randomly assigned one;
// outcomes are attributed back to the variant via server/app.js + callPoller.js
// so real conversion stats accumulate per variant. Nothing here is simulated —
// a variant with 3 calls just has an N of 3, shown honestly, not projected.
import { callGemini } from './geminiClient.js';
import { buildBusinessBriefing } from './businessFacts.js';

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || '';
}

// Picks a random ACTIVE variant scoped to this agent (falls back to a global
// variant with no agentId). Returns null if no active variant applies, in which
// case callers fall back to the per-lead strategy from leadIntelligence.js.
export function pickVariantForAgent(variants, agentId) {
  const candidates = (variants || []).filter(v => v.status === 'active' && (!v.agentId || v.agentId === agentId));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Real per-variant stats computed from call events that were tagged with a
// scriptVariantId at dispatch time (see app.js/scheduler.js) and whose outcome
// was later analyzed (see app.js webhook / callPoller.js).
export function computeVariantStats(variants, callEvents) {
  return (variants || []).map(variant => {
    const events = (callEvents || []).filter(e => e.scriptVariantId === variant.id);
    const QUALIFIED = new Set(['Hot Lead', 'Interested']);
    const qualified = events.filter(e => QUALIFIED.has(e.analysis?.suggestedUpdates?.interestLevel)).length;
    const notInterested = events.filter(e => e.analysis?.suggestedUpdates?.interestLevel === 'Not Interested').length;
    return {
      variantId: variant.id,
      calls: events.length,
      qualified,
      notInterested,
      qualifiedRate: events.length > 0 ? Math.round((qualified / events.length) * 100) : null,
    };
  });
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Proposes a NEW draft variant by having Gemini read real remarks/summaries from
// calls that used `sourceVariant` and actually qualified — i.e. it learns from
// what really worked, not a hypothetical. Returned as a DRAFT; a manager must
// explicitly activate it before it ever reaches a real call.
export async function suggestVariant(sourceVariant, qualifiedCallSummaries) {
  const key = getGeminiKey();
  if (!key) return { ok: false, reason: 'No server-side GEMINI_API_KEY configured.' };
  if (!qualifiedCallSummaries.length) {
    return { ok: false, reason: 'No qualified call outcomes yet for this variant — nothing real to learn from.' };
  }

  const prompt = `You are a sales operations analyst improving a cold-call script based on what has actually worked.

${buildBusinessBriefing()}

Current script variant:
${JSON.stringify({ name: sourceVariant.name, openingStyle: sourceVariant.openingStyle, mainFocus: sourceVariant.mainFocus, avoid: sourceVariant.avoid, goal: sourceVariant.goal })}

Real summaries from calls using this variant that resulted in a qualified/interested lead (these are ACTUAL outcomes, not hypothetical):
${qualifiedCallSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Based on real patterns in what worked above, propose ONE improved variant. Keep it grounded in the actual summaries — do not invent generic sales advice unrelated to what's shown.

Reply with ONLY a JSON object, no markdown, no commentary:
{
  "name": "short name for this variant, e.g. 'Financing-first v2'",
  "openingStyle": "one to three words",
  "mainFocus": "short phrase",
  "avoid": "short phrase",
  "goal": "short phrase",
  "negotiationApproach": "one concrete COMPLIANT move for price objections/hesitation, grounded in the real patterns above. The payment structure is fixed — never suggest a discount, negotiated price, custom payment plan, or limited-time offer. Legitimate levers only: exact installment breakdown, a smaller site size, the lower-rate project, or an office visit to verify documents.",
  "rationale": "one to two sentences explaining what pattern in the real data motivated this change"
}`;

  try {
    const res = await callGemini((ai, model) => ai.models.generateContent({ model, contents: prompt }), 'suggestVariant');
    const parsed = extractJson((res?.text || '').trim());
    if (!parsed) throw new Error('Model did not return parseable JSON');
    return {
      ok: true,
      suggestion: {
        name: String(parsed.name || 'AI-suggested variant'),
        openingStyle: String(parsed.openingStyle || ''),
        mainFocus: String(parsed.mainFocus || ''),
        avoid: String(parsed.avoid || ''),
        goal: String(parsed.goal || ''),
        negotiationApproach: String(parsed.negotiationApproach || ''),
        rationale: String(parsed.rationale || ''),
      },
    };
  } catch (e) {
    return { ok: false, reason: `Gemini suggestion failed: ${e.message}` };
  }
}
