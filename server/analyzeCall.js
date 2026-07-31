// Turns an Omnidimension call-completion webhook payload into structured CRM lead
// updates, using Gemini to read the transcript/summary the same way a human sales
// manager would. Falls back to Omnidimension's own extracted_variables/sentiment
// if no server-side Gemini key is configured, so the pipeline still works either way.
//
// Business rules this file enforces (set explicitly by the client, 2026-07-24):
//   1. Call not picked up (no-answer/busy/failed) -> retry in 2 hours (handled by the
//      caller — callPoller.js / app.js webhook — not here, since those calls have no
//      transcript to analyze).
//   2. Call connects but the lead is silent / hangs up without engaging -> "Not
//      Interested", never call again.
//   3. Lead explicitly asks for a callback at a specific time ("in 3 hours",
//      "tomorrow evening", "next week") -> schedule the retry for THAT actual time,
//      not a fixed default. Gemini is given the real current timestamp so it can
//      compute the requested time correctly instead of guessing.
import { GoogleGenAI } from '@google/genai';

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || '';
}

const VALID_INTEREST_LEVELS = ['Hot Lead', 'Warm Lead', 'Cold Lead', 'Interested', 'Not Interested', 'Call Later', 'Wrong Number', 'Not Reachable'];
const VALID_STATUSES = ['Pending', 'Call Scheduled', 'In Call', 'Contacted', 'Outgoing Retry', 'Completed', 'Handed Over'];

// Best-effort JSON extraction from a model response that might include stray text/markdown fences.
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

export async function analyzeCallForLead(webhookPayload, lead) {
  const transcript = webhookPayload?.call_report?.full_conversation || webhookPayload?.call_conversation || '';
  const summary = webhookPayload?.call_report?.summary || '';
  const sentiment = webhookPayload?.call_report?.sentiment || '';
  const extractedVars = webhookPayload?.call_report?.extracted_variables || {};
  const callStatus = webhookPayload?.call_status || 'completed';

  const key = getGeminiKey();
  if (!key || !transcript.trim()) {
    // Honest fallback: no key, or nothing to analyze — use whatever Omnidimension already gave us.
    return {
      analyzed: false,
      reason: !key ? 'No server-side GEMINI_API_KEY configured.' : 'No transcript available to analyze.',
      suggestedUpdates: {
        remarks: summary || lead?.remarks || '',
        status: callStatus === 'completed' ? 'Contacted' : lead?.status,
      },
      raw: { summary, sentiment, extractedVars },
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const nowIso = new Date().toISOString();
    const prompt = `You are a real-estate sales CRM analyst. Read this call transcript between an AI sales agent and a lead named "${lead?.name || 'the lead'}", and extract structured updates for the CRM record.

The current real date/time is: ${nowIso} (use this as "now" for any relative time math below — e.g. "call me in 3 hours" means exactly 3 hours after this timestamp; "tomorrow morning" means the next calendar day around 9am; "next week" means 7 days from now).

Current lead record: ${JSON.stringify({
      interestLevel: lead?.interestLevel, budget: lead?.budget, project: lead?.project,
      status: lead?.status, remarks: lead?.remarks, nextFollowUpDate: lead?.nextFollowUpDate,
    })}

Call summary (from telephony platform): ${summary}
Call sentiment (from telephony platform): ${sentiment}
Full transcript:
${transcript}

Classification rules — follow these exactly, they are business requirements, not suggestions:
- If the lead picked up but stayed silent, gave no real response, or hung up without engaging with the agent at all: interestLevel MUST be "Not Interested" and status MUST be "Completed" (we do not call these leads again).
- If the lead explicitly asked to be called back at a specific time (a number of hours/days, "tomorrow", a day of the week, "next week", etc.): interestLevel is "Call Later", status is "Outgoing Retry", and nextFollowUpDate MUST be the ACTUAL date/time they asked for, computed from the current real date/time given above — not a generic placeholder.
- If the lead clearly declined / said not interested / asked not to be contacted again: interestLevel MUST be "Not Interested" and status MUST be "Completed".
- If the lead engaged and showed genuine interest: use "Interested" or "Hot Lead" as appropriate, status "Contacted".

Reply with ONLY a JSON object, no markdown, no commentary, in this exact shape:
{
  "interestLevel": one of ["Hot Lead","Warm Lead","Cold Lead","Interested","Not Interested","Call Later","Wrong Number","Not Reachable"],
  "status": one of ["Pending","Call Scheduled","In Call","Contacted","Outgoing Retry","Completed","Handed Over"],
  "budget": number or null (only if the lead stated a new/updated budget, else null),
  "remarks": "one to two sentence summary of what the lead actually said and wants",
  "nextFollowUpDate": full ISO 8601 datetime string (e.g. "2026-07-24T15:30:00.000Z") — the ACTUAL time to call back, computed from the current real date/time above and whatever the lead asked for; if nothing specific was requested, use a sensible default a few days out,
  "siteVisitScheduled": "YYYY-MM-DD" or "" (only if a site visit was explicitly agreed),
  "callBackReason": "short phrase for why we're calling back, or empty string if no follow-up is needed"
}`;

    const res = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
    });
    const text = (res?.text || '').trim();
    const parsed = extractJson(text);
    if (!parsed) throw new Error('Model did not return parseable JSON');

    const suggestedUpdates = {};
    if (VALID_INTEREST_LEVELS.includes(parsed.interestLevel)) suggestedUpdates.interestLevel = parsed.interestLevel;
    if (VALID_STATUSES.includes(parsed.status)) suggestedUpdates.status = parsed.status;
    if (typeof parsed.budget === 'number' && parsed.budget > 0) suggestedUpdates.budget = parsed.budget;
    if (typeof parsed.remarks === 'string' && parsed.remarks.trim()) suggestedUpdates.remarks = parsed.remarks.trim();
    if (typeof parsed.siteVisitScheduled === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.siteVisitScheduled)) suggestedUpdates.siteVisitScheduled = parsed.siteVisitScheduled;

    // Accept either a full ISO datetime or a plain YYYY-MM-DD from the model, and only
    // trust it if it actually parses to a real, future-ish moment — a hallucinated or
    // malformed date must never silently corrupt the follow-up schedule.
    const parsedFollowUp = typeof parsed.nextFollowUpDate === 'string' ? Date.parse(parsed.nextFollowUpDate) : NaN;
    if (!Number.isNaN(parsedFollowUp) && parsedFollowUp > Date.now() - 60 * 60 * 1000) {
      suggestedUpdates.nextFollowUpDate = new Date(parsedFollowUp).toISOString();
    }

    // Rule 2 (picked up, no engagement / hung up) and the "explicitly declined" case:
    // enforce the sticky "Not Interested" + closed status regardless of what the model
    // put in `status`, so this can never be miscategorized as still-callable.
    if (suggestedUpdates.interestLevel === 'Not Interested') {
      suggestedUpdates.status = 'Completed';
    }

    // Rule 3 safety net: if the lead asked for a callback but the model didn't give us
    // a usable future date, default to 2 hours out rather than leaving it unset.
    if (suggestedUpdates.interestLevel === 'Call Later' && !suggestedUpdates.nextFollowUpDate) {
      suggestedUpdates.nextFollowUpDate = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      suggestedUpdates.status = 'Outgoing Retry';
    }

    return {
      analyzed: true,
      suggestedUpdates,
      callBackReason: parsed.callBackReason || '',
      raw: { summary, sentiment, extractedVars },
    };
  } catch (e) {
    return {
      analyzed: false,
      reason: `Gemini analysis failed: ${e.message}`,
      suggestedUpdates: {
        remarks: summary || lead?.remarks || '',
        status: callStatus === 'completed' ? 'Contacted' : lead?.status,
      },
      raw: { summary, sentiment, extractedVars },
    };
  }
}
