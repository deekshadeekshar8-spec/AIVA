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
import { callGemini } from './geminiClient.js';
import { buildBriefingForAgent, isRkAvenueAgent, projectNamesFor, SITE_SIZES_SQFT } from './businessFacts.js';

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
    const nowIso = new Date().toISOString();
    // Vistara (agent_6) sells RK Avenue, not the Society's plots. Its calls must be
    // judged against RK Avenue's own facts and rules — see businessFacts.js.
    const rk = isRkAvenueAgent(lead?.agentId);
    const projectChoice = rk ? 'RK Avenue (the only project this agent sells)' : 'North Metro City or Garden City';
    const prompt = `You are a sales CRM analyst. Read this call transcript between an AI sales agent and a lead named "${lead?.name || 'the lead'}", and extract structured updates for the CRM record.

${buildBriefingForAgent(lead?.agentId)}

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

YOUR MAIN JOB — this is a QUALIFICATION call, not a sale. Read it the way an experienced human sales manager would when reviewing their agent's call, and answer the three questions that actually matter:
  1. Is this person genuinely interested, or not?
  2. WHICH PROJECT are they interested in — ${projectChoice}?
  3. ${rk ? 'Any location or plot preference they mentioned (plot sizes are not defined for this project, so do not record a size).' : 'WHICH SITE are they leaning toward — what size, and any location/direction preference they mentioned (corner site, east/north facing, near the main road, a particular block, etc.)?'}

Then write the kind of summary a human would actually find useful — what the person actually said in their own words, what they asked about, what worried them, and where it was left. Do NOT write a generic recap like "the lead was contacted and showed interest". Be specific and concrete. If the call was short, empty, or went nowhere, say that plainly instead of padding it.

Do NOT extract or estimate money, budget, or pricing — that is not what this call is for.

Leave any field null/empty if it genuinely wasn't mentioned. Never invent details to look thorough.

Reply with ONLY a JSON object, no markdown, no commentary, in this exact shape:
{
  "interestLevel": one of ["Hot Lead","Warm Lead","Cold Lead","Interested","Not Interested","Call Later","Wrong Number","Not Reachable"],
  "status": one of ["Pending","Call Scheduled","In Call","Contacted","Outgoing Retry","Completed","Handed Over"],
  "remarks": "one to two sentence plain-language summary of what this lead actually said and wants — specific, not generic",
  "callSummary": "3-5 sentences, written like a human sales manager's file note: how the person responded, what they actually said they wanted, what they asked about, any hesitation, and how the call ended. Concrete specifics only — no filler.",
  "keyPoints": ["array of short factual bullets of what the lead actually said this call — empty array if they said nothing substantive"],
  "customerQuestions": ["array of the actual questions the lead asked, in short form — empty array if none"],
  "objections": ["array of concerns/hesitations the lead raised (price, legal/approvals, location, timing, trust...) — empty array if none"],
  "locationPreference": "string or null — any site location/direction preference they mentioned, e.g. 'corner site', 'east facing', 'near main road', 'closer to the airport side'",
  "qualified": true if this person is genuinely interested and worth pursuing, false if not — judge honestly from what they actually said,
  "qualificationReason": "one short sentence explaining that yes/no judgement, grounded in what they actually said",
  "nextFollowUpDate": full ISO 8601 datetime string (e.g. "2026-07-24T15:30:00.000Z") — ONLY if the lead explicitly asked for a specific callback time (a number of hours/days, "tomorrow", a day of the week, "next week", etc.), computed from the current real date/time above. If nothing specific was requested, leave this null — the system applies its own real follow-up cadence rules; never guess a "few days out" placeholder yourself,
  "siteVisitScheduled": "YYYY-MM-DD" or "" (only if a site visit was explicitly agreed),
  "callBackReason": "short phrase for why we're calling back, or empty string if no follow-up is needed",
  "projectInterest": ${rk ? '"exactly \\"RK Avenue\\" if the lead expressed interest in it this call, else null. Never any other project name."' : '"exactly \\"North Metro City\\" or \\"Garden City\\" if the lead expressed interest in one of them this call, else null. Never any other project name."'},
  "siteSizeSqft": ${rk ? 'null (plot sizes are not defined for this project — always null)' : 'one of [1200, 1500, 2400, 4000] if the lead named a site size this call, else null'},
  "cornerSiteInterest": ${rk ? 'false (not applicable to this project)' : 'true if the lead specifically asked about a corner site, else false'},
  "propertyType": "string or null — only if stated this call",
  "location": "string or null — only if stated this call",
  "decisionMaker": "string or null — who decides, e.g. 'Husband and wife', only if stated this call",
  "loanRequired": "Yes" | "No" | null (null if not discussed),
  "nextBestAction": {
    "action": "short phrase, e.g. 'Send WhatsApp brochure', 'Call tomorrow morning', 'Book site visit', 'Assign human salesperson' — the ONE recommended next step",
    "reason": "one short sentence grounded in what actually happened on this specific call"
  },
  "competitorMentions": ["array of competitor builder/project names the lead ACTUALLY said by name in this call, e.g. if they said 'we're also looking at Prestige Group' include 'Prestige Group' — empty array if none were mentioned by name. Never infer or guess a competitor that wasn't explicitly named."],
  "frustrationDetected": true if the lead showed CLEAR frustration, annoyance, or anger during this call (e.g. "stop calling me", raised voice/complaints, complaining about repeated calls) — NOT just mild hesitation or a simple "not interested". Else false.,
  "frustrationReason": "one short phrase describing what caused it, e.g. 'annoyed about repeated calls', 'felt pressured about a decision' — empty string if frustrationDetected is false",
  "personalityRead": "one short phrase describing this lead's personality/communication style as shown THIS call, e.g. 'Detail-oriented, asks a lot of questions' or 'Blunt, wants quick answers' — empty string if there wasn't enough signal this call",
  "buyingStyle": "one short phrase about how they seem to make decisions, e.g. 'Wants family consensus before deciding', 'Fast, decisive' — empty string if not shown this call",
  "urgencyLevel": one of ["Low","Medium","High"] based on how urgently they indicated they want to decide/move, or null if not discussed,
  "familyMentions": ["array of short factual family/personal details the lead actually mentioned that are relevant to the buying decision, e.g. 'wife will co-decide', 'has a school-age daughter' — empty array if none were mentioned"],
  "preferredCallTimeMentioned": "string or null — only if they explicitly said a preferred day/time to be called back, e.g. 'evenings after 7pm'",
  "whatsappIntent": {
    "wantsBrochure": true if the lead asked for the brochure/PDF/project details document, else false,
    "wantsLocation": true if the lead asked for the location, address, or map, else false,
    "wantsImages": true if the lead asked for photos/images of the project, else false,
    "wantsPrice": true if the lead asked about price, cost, rate, plot sizes, or availability, else false,
    "generalInterest": true if the lead said something like "I'm interested" without asking for a specific item, else false,
    "requestedOnWhatsApp": true ONLY if the lead explicitly said to send something on WhatsApp (e.g. "send it on WhatsApp", "WhatsApp me the details"), else false
  },
  "buyingSignals": {
    "askedFinalPrice": true if they asked for the final/best/total price this call, else false,
    "askedBookingAmount": true if they asked about the booking amount/advance payment, else false,
    "askedAvailability": true if they asked which specific plots/sites are currently available, else false,
    "askedEMI": true if they asked about installments, EMI, or the payment schedule, else false,
    "askedNegotiation": true if they asked whether the price can be negotiated or reduced, else false,
    "askedApprovals": true if they asked whether the project/land is approved or legally clear, else false,
    "askedDocuments": true if they asked what documents they would receive, else false,
    "comparedCompetitor": true if they directly compared this project against a specific named competitor, else false,
    "requestedSiteVisit": true if they asked to see/visit the site or said they want to visit, else false,
    "askedToBook": true if they explicitly asked to book or reserve a specific plot right now, else false
  },
  "siteVisitRequest": {
    "requested": true ONLY if a site visit was actually agreed/arranged THIS call (not just asked about in the abstract), else false,
    "preferredDate": "YYYY-MM-DD or null — only if an actual date was agreed",
    "preferredTime": "string or null, e.g. 'Saturday morning' — only if mentioned",
    "attendees": integer or null — only if they said how many people are coming,
    "pickupRequired": true if they asked about being picked up/transport, false if they said they'll come themselves, null if not discussed,
    "specialRequirements": "string or null — anything specific they asked for about the visit"
  },
  "escalationSignals": {
    "explicitHumanRequest": true if the lead explicitly asked to speak to a person, manager, or human salesperson, else false,
    "legalOrDocumentationConcern": true if their concern is specifically about legal status, title, or documentation that needs human verification (beyond the standard approval-status answer), else false,
    "complaintRaised": true if the lead raised a genuine complaint about the company or service (not just a normal objection), else false
  }
}`;

    const res = await callGemini((ai, model) => ai.models.generateContent({
      model,
      contents: prompt,
    }), 'analyzeCall');
    const text = (res?.text || '').trim();
    const parsed = extractJson(text);
    if (!parsed) throw new Error('Model did not return parseable JSON');

    const suggestedUpdates = {};
    if (VALID_INTEREST_LEVELS.includes(parsed.interestLevel)) suggestedUpdates.interestLevel = parsed.interestLevel;
    if (VALID_STATUSES.includes(parsed.status)) suggestedUpdates.status = parsed.status;
    // NOTE: budget/pricing is deliberately NOT extracted. The purpose of these calls
    // is qualification — is this person interested, in which project, and in which
    // location/size — not building a monetary pipeline. Pricing is quoted live on the
    // call by the agent from the Society's fixed rate card; it isn't CRM data.
    if (typeof parsed.remarks === 'string' && parsed.remarks.trim()) suggestedUpdates.remarks = parsed.remarks.trim();
    if (typeof parsed.siteVisitScheduled === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.siteVisitScheduled)) suggestedUpdates.siteVisitScheduled = parsed.siteVisitScheduled;
    // Real business dimensions — only accepted if they match the actual catalogue,
    // so a hallucinated project name or site size can never enter the CRM.
    if (typeof parsed.projectInterest === 'string' && projectNamesFor(lead?.agentId).includes(parsed.projectInterest)) {
      suggestedUpdates.projectInterest = parsed.projectInterest;
      suggestedUpdates.project = parsed.projectInterest;
    }
    // Plot sizes only exist for the Society's projects — RK Avenue has no size catalogue.
    if (!rk && SITE_SIZES_SQFT.includes(Number(parsed.siteSizeSqft))) {
      suggestedUpdates.siteSizeSqft = Number(parsed.siteSizeSqft);
    }
    if (!rk && typeof parsed.cornerSiteInterest === 'boolean') suggestedUpdates.cornerSiteInterest = parsed.cornerSiteInterest;
    if (typeof parsed.locationPreference === 'string' && parsed.locationPreference.trim()) {
      suggestedUpdates.locationPreference = parsed.locationPreference.trim();
    }

    // The human-style call read: a proper file note plus the specifics a manager
    // would want at a glance. Arrays are normalised to plain trimmed strings so a
    // malformed model response can't put objects into the CRM.
    const cleanList = (v) => (Array.isArray(v)
      ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, 8)
      : []);
    if (typeof parsed.callSummary === 'string' && parsed.callSummary.trim()) {
      suggestedUpdates.callSummary = parsed.callSummary.trim();
    }
    suggestedUpdates.keyPoints = cleanList(parsed.keyPoints);
    suggestedUpdates.customerQuestions = cleanList(parsed.customerQuestions);
    suggestedUpdates.objections = cleanList(parsed.objections);
    if (typeof parsed.qualified === 'boolean') {
      suggestedUpdates.qualified = parsed.qualified;
      suggestedUpdates.qualificationReason = typeof parsed.qualificationReason === 'string'
        ? parsed.qualificationReason.trim() : '';
    }

    if (typeof parsed.propertyType === 'string' && parsed.propertyType.trim()) suggestedUpdates.propertyType = parsed.propertyType.trim();
    if (typeof parsed.location === 'string' && parsed.location.trim()) suggestedUpdates.location = parsed.location.trim();
    if (typeof parsed.decisionMaker === 'string' && parsed.decisionMaker.trim()) suggestedUpdates.decisionMaker = parsed.decisionMaker.trim();
    if (parsed.loanRequired === 'Yes' || parsed.loanRequired === 'No') suggestedUpdates.loanRequired = parsed.loanRequired;
    if (parsed.nextBestAction && typeof parsed.nextBestAction.action === 'string' && parsed.nextBestAction.action.trim()) {
      suggestedUpdates.nextBestAction = {
        action: parsed.nextBestAction.action.trim(),
        reason: typeof parsed.nextBestAction.reason === 'string' ? parsed.nextBestAction.reason.trim() : '',
        generatedAt: new Date().toISOString(),
      };
    }

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

    // Competitor mentions: only names Gemini says the lead actually spoke, deduped
    // and trimmed. Never fabricated — an empty array means none were mentioned.
    const competitorMentions = Array.isArray(parsed.competitorMentions)
      ? [...new Set(parsed.competitorMentions.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim()))]
      : [];

    // Escalation signal (server/escalation.js) — only ever true when Gemini's read
    // of THIS transcript found clear frustration, never inferred elsewhere.
    const frustrationDetected = parsed.frustrationDetected === true;
    const frustrationReason = frustrationDetected && typeof parsed.frustrationReason === 'string' ? parsed.frustrationReason.trim() : '';
    suggestedUpdates.frustrationDetected = frustrationDetected;

    // AI Sales Brain (server/salesBrain.js) — returned separately from
    // suggestedUpdates because these need to ACCUMULATE across calls (merged by
    // the caller via mergeSalesBrain), not overwrite what a previous call learned.
    const salesBrainSignals = {
      personality: typeof parsed.personalityRead === 'string' ? parsed.personalityRead.trim() : '',
      buyingStyle: typeof parsed.buyingStyle === 'string' ? parsed.buyingStyle.trim() : '',
      urgencyLevel: ['Low', 'Medium', 'High'].includes(parsed.urgencyLevel) ? parsed.urgencyLevel : null,
      familyDetails: Array.isArray(parsed.familyMentions)
        ? parsed.familyMentions.filter(f => typeof f === 'string' && f.trim()).map(f => f.trim())
        : [],
      preferredCallTime: typeof parsed.preferredCallTimeMentioned === 'string' ? parsed.preferredCallTimeMentioned.trim() : '',
      objections: suggestedUpdates.objections || [],
    };

    // WhatsApp Property Sharing (server/propertySharing.js) — real intent signals
    // only, each independently booleaned so the caller can decide exactly what to
    // send (brochure vs location vs images vs the full "interested" bundle).
    const wi = parsed.whatsappIntent || {};
    const whatsappIntent = {
      wantsBrochure: wi.wantsBrochure === true,
      wantsLocation: wi.wantsLocation === true,
      wantsImages: wi.wantsImages === true,
      wantsPrice: wi.wantsPrice === true,
      generalInterest: wi.generalInterest === true,
      requestedOnWhatsApp: wi.requestedOnWhatsApp === true,
    };

    // Buying signals (server/leadScore.js) — real, independently-booleaned signals
    // this specific call surfaced. Accumulated (OR'd, never un-set) onto the lead
    // by the caller, same accumulation philosophy as AI Sales Brain — once a lead
    // has genuinely asked about EMI, that fact stays true forever.
    const bs = parsed.buyingSignals || {};
    const buyingSignals = {
      askedFinalPrice: bs.askedFinalPrice === true,
      askedBookingAmount: bs.askedBookingAmount === true,
      askedAvailability: bs.askedAvailability === true,
      askedEMI: bs.askedEMI === true,
      askedNegotiation: bs.askedNegotiation === true,
      askedApprovals: bs.askedApprovals === true,
      askedDocuments: bs.askedDocuments === true,
      comparedCompetitor: bs.comparedCompetitor === true,
      requestedSiteVisit: bs.requestedSiteVisit === true,
      askedToBook: bs.askedToBook === true,
    };

    // Site Visit Conversion (spec section 8) — only trusted when a real date/time
    // was actually agreed this call, not just discussed in the abstract.
    const svr = parsed.siteVisitRequest || {};
    let siteVisitRequest = null;
    if (svr.requested === true) {
      siteVisitRequest = {
        preferredDate: typeof svr.preferredDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(svr.preferredDate) ? svr.preferredDate : null,
        preferredTime: typeof svr.preferredTime === 'string' && svr.preferredTime.trim() ? svr.preferredTime.trim() : null,
        attendees: Number.isFinite(svr.attendees) ? Math.max(1, Math.round(svr.attendees)) : null,
        pickupRequired: typeof svr.pickupRequired === 'boolean' ? svr.pickupRequired : null,
        specialRequirements: typeof svr.specialRequirements === 'string' && svr.specialRequirements.trim() ? svr.specialRequirements.trim() : null,
        requestedAt: new Date().toISOString(),
      };
      // Keep the existing simple date field in sync for the UI/scheduling code that
      // already reads it, when we actually have a real date.
      if (siteVisitRequest.preferredDate) suggestedUpdates.siteVisitScheduled = siteVisitRequest.preferredDate;
    }

    // Human handoff triggers (server/escalation.js) — real signals only, each
    // independently booleaned so escalation.js can build an accurate reason.
    const es = parsed.escalationSignals || {};
    const escalationSignals = {
      explicitHumanRequest: es.explicitHumanRequest === true,
      legalOrDocumentationConcern: es.legalOrDocumentationConcern === true,
      complaintRaised: es.complaintRaised === true,
    };

    return {
      analyzed: true,
      suggestedUpdates,
      callBackReason: parsed.callBackReason || '',
      competitorMentions,
      frustrationReason,
      salesBrainSignals,
      whatsappIntent,
      buyingSignals,
      siteVisitRequest,
      escalationSignals,
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
