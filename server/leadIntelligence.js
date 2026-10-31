// Pre-call AI research + strategy — turns raw lead fields (source, project,
// location, past remarks/call history) into a profile and a call plan, the same way
// a human SDR would review a lead before dialing. Both are Gemini reasoning over data
// we actually have — no invented data, no external lookups we don't have access to.
import { callGemini } from './geminiClient.js';
import { buildBriefingForAgent, isRkAvenueAgent } from './businessFacts.js';
import { recommendProject } from './recommendation.js';

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || '';
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

// Builds { leadIntelligence, callStrategy } from the real lead record. Both are
// clearly-labeled AI inference, not measured fact — confidence reflects how much
// real signal (source, remarks, past calls) was actually available.
export async function generateLeadIntelligence(lead) {
  const key = getGeminiKey();
  if (!key) {
    return { ok: false, reason: 'No server-side GEMINI_API_KEY configured.' };
  }

  const pastCalls = (lead?.recordings || []).map(r => ({ date: r.date, summary: r.summary })).slice(-5);

  // Vistara (agent_6) sells RK Avenue, not the Society's plots. The strategy built
  // here is injected into that agent's real call context, so it must be briefed on
  // RK Avenue — advice about installments or Society site sizes would be wrong.
  const rk = isRkAvenueAgent(lead?.agentId);

  const prompt = `You are a senior sales development rep (SDR) preparing to call a lead. Base your analysis ONLY on the data given below — never invent a company, job title, or fact that isn't present or reasonably inferable from it.

${buildBriefingForAgent(lead?.agentId)}

Lead record:
${JSON.stringify({
  name: lead?.name,
  source: lead?.source,
  project: lead?.project,
  propertyType: lead?.propertyType,
  siteSizeSqft: lead?.siteSizeSqft,
  locationPreference: lead?.locationPreference,
  location: lead?.location,
  timeline: lead?.timeline,
  interestLevel: lead?.interestLevel,
  status: lead?.status,
  remarks: lead?.remarks,
  note: lead?.note,
  tags: lead?.tags,
  pastCalls,
  // AI Sales Brain (server/salesBrain.js) — real accumulated memory from past
  // calls with this specific lead, not a generic guess.
  salesBrain: lead?.salesBrain || null,
}, null, 2)}

Produce a lead profile and a call strategy. "confidence" must honestly reflect how much real signal exists — a brand new lead with only a name/phone/source should get LOW confidence (below 50), not a fabricated high number. The same honesty rule applies to "buyingProbability" below — a brand new lead with no call history should land around 30-40, not a fabricated high number just because they exist in the system.

Reply with ONLY a JSON object, no markdown, no commentary, in this exact shape:
{
  "leadIntelligence": {
    "interestSummary": "${rk ? "one short phrase naming the project if known — the only real project is 'RK Avenue' — or empty string if unknown" : "one short phrase naming the real project and/or site size if known, e.g. 'Garden City 1200 sqft' — or empty string if unknown. Only ever use the two real project names."}",
    "sitePreference": "${rk ? "one short phrase for any location preference they've shown — empty string if unknown (plot sizes are not defined for this project)" : "one short phrase for any size/location/direction leaning they've shown, e.g. '1200 sqft, corner site' — empty string if unknown"}",
    "likelyDecisionMaker": "Yes" | "No" | "Unclear",
    "bestCallTime": "short phrase, e.g. '6 PM' or 'Not enough data yet' if no call-time signal exists",
    "confidence": integer 0-100,
    "confidenceReason": "one short sentence explaining why this confidence level",
    "buyingProbability": integer 0-100 — honest estimate of how likely this lead is to actually buy, grounded in real signal (source, remarks, sales brain, past call outcomes). Low signal MUST mean a low/mid number, never a fabricated high one.,
    "emotionalType": "one to three words describing their dominant emotional/communication style, e.g. 'Analytical', 'Warm and trusting', 'Skeptical' — or 'Not enough data yet' if unknown",
    "likelyObjections": ["array of 1-3 objections this lead will PROBABLY raise on the next call, grounded in their real profile/sales-brain history — e.g. 'Budget/pricing', 'Wants to consult spouse first' — empty array if there's no real signal to predict from"]
  },
  "callStrategy": {
    "openingStyle": "one to three words, e.g. 'Friendly', 'Direct', 'Consultative'",
    "mainFocus": "short phrase describing what to lead with",
    "avoid": "short phrase describing what to avoid early in the call",
    "goal": "short phrase for the call's objective — must be one of the real call goals listed above",
    "negotiationApproach": "${rk
      ? "one concrete, COMPLIANT move for if this lead objects on price or hesitates. The rate is fixed and the agent cannot negotiate, so the only real levers are: restating the fixed rate and what is included (gated community, services, ready for registration), offering an easy site visit, or offering a callback from the sales team for plot sizes, legal details and payment plans. MUST NOT suggest any discount, negotiated price, payment plan, plot size, legal claim, limited-time offer, or urgency built on a fake deadline."
      : "one concrete, COMPLIANT move for if this lead objects on price or hesitates. The payment structure is fixed and there are no discounts or promotions, so the only real levers are: walking them through the exact installment breakdown for their site size, stepping down to a smaller site size that fits their budget, comparing Garden City's lower rate against North Metro City, or inviting them to the office to verify documents if the objection is really about trust. MUST NOT suggest any discount, negotiated price, flexible/custom payment plan, limited-time offer, or urgency built on a fake deadline."}"
  }
}`;

  try {
    const res = await callGemini((ai, model) => ai.models.generateContent({ model, contents: prompt }), 'leadIntelligence');
    const parsed = extractJson((res?.text || '').trim());
    if (!parsed?.leadIntelligence || !parsed?.callStrategy) throw new Error('Model did not return the expected JSON shape');

    const li = parsed.leadIntelligence;
    const cs = parsed.callStrategy;
    const confidence = Number.isFinite(li.confidence) ? Math.max(0, Math.min(100, Math.round(li.confidence))) : 30;
    // Customer Digital Twin fields — same honesty rule as confidence: low real
    // signal must produce a low/mid number, never a fabricated high one.
    const buyingProbability = Number.isFinite(li.buyingProbability) ? Math.max(0, Math.min(100, Math.round(li.buyingProbability))) : 30;
    const likelyObjections = Array.isArray(li.likelyObjections)
      ? li.likelyObjections.filter(o => typeof o === 'string' && o.trim()).map(o => o.trim()).slice(0, 3)
      : [];

    // Property Recommendation Engine (server/recommendation.js) — deterministic
    // real-catalogue matching on actual budget/location, NOT another Gemini guess.
    // Doing the arithmetic in code means it can never hallucinate a price.
    const recommendation = recommendProject({ budget: lead?.budget, locationPreference: lead?.locationPreference });

    return {
      ok: true,
      recommendation,
      leadIntelligence: {
        interestSummary: String(li.interestSummary || ''),
        sitePreference: String(li.sitePreference || ''),
        likelyDecisionMaker: ['Yes', 'No', 'Unclear'].includes(li.likelyDecisionMaker) ? li.likelyDecisionMaker : 'Unclear',
        bestCallTime: String(li.bestCallTime || 'Not enough data yet'),
        confidence,
        confidenceReason: String(li.confidenceReason || ''),
        buyingProbability,
        emotionalType: String(li.emotionalType || 'Not enough data yet'),
        likelyObjections,
        generatedAt: new Date().toISOString(),
      },
      callStrategy: {
        openingStyle: String(cs.openingStyle || ''),
        mainFocus: String(cs.mainFocus || ''),
        avoid: String(cs.avoid || ''),
        goal: String(cs.goal || ''),
        negotiationApproach: String(cs.negotiationApproach || ''),
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (e) {
    return { ok: false, reason: `Gemini analysis failed: ${e.message}` };
  }
}
