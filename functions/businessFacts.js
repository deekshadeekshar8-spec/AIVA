// SINGLE SOURCE OF TRUTH about the real business AIVA sells for.
//
// Why this file exists: every AI touchpoint in this app (pre-call strategy,
// post-call extraction, script-variant suggestions, the voice assistants) was
// previously prompted with GENERIC real-estate language — "villas", "EMI plans",
// "discounts", "promotional offers". None of that matches this business, and
// because the pre-call strategy is injected into REAL customer calls via
// `call_negotiation_approach`, a generic directive like "offer a flexible payment
// plan" could push a live agent to promise terms the Society cannot honour.
//
// These facts mirror the agent prompts configured in Omnidimension (the `context`
// field on agents 215854/215858/215863/215865/215867). If the Society's real
// pricing or process changes, update BOTH places.

export const SOCIETY = {
  name: 'Bengaluru Metro City Infrastructure Housing Co-operative Society Ltd',
  legalBasis: 'Registered Housing Co-operative Society under the Karnataka Co-operative Societies Act, 1959 — NOT a private builder.',
  office: '1st Cross, 15th Main E Block, Beside Nandana Palace, 2nd floor, Sahakarnagar, Bengaluru-560092',
  officeMapsLink: 'https://maps.app.goo.gl/vxj7xN87Uy5hfUoX8?g_st=iw',
  officeLatitude: 13.0598736,
  officeLongitude: 77.5926819,
  siteVisitPhone: '+919108047286',
  // Real compliance line the client asks to appear on every client-facing WhatsApp
  // message — never edited/softened, this is a legal/anti-fraud disclaimer.
  commissionDisclaimer: "Don't pay any commission/cash/incentives through cash or kind to anyone with regard to plot booking / allotments.",
  languages: ['English', 'Hindi', 'Kannada'],
};

// Both projects sell residential SITES (plots), not built homes. Total price is
// exactly siteSizeSqft × ratePerSqft; a corner site adds 10% at allotment.
export const PROJECTS = {
  'North Metro City': {
    ratePerSqft: 1399,
    acres: 30,
    sites: '580+',
    location: 'Near Devanahalli, attached to Amity University back gate',
    highlights: 'North Bengaluru growth corridor, Devanahalli connectivity, near educational institutions, planned layout',
  },
  'Garden City': {
    ratePerSqft: 1249,
    acres: 25,
    sites: '450+',
    location: 'On NH-648 STRR, near Devanahalli, Chanakya University and Kempegowda International Airport',
    highlights: 'STRR connectivity, airport proximity, near educational institutions, planned layout',
  },
};

export const SITE_SIZES_SQFT = [1200, 1500, 2400, 4000];
export const CORNER_PREMIUM = 0.10;

// The payment structure is FIXED for every member — there is no negotiable plan,
// no discount, and no promotional pricing to offer.
export const PAYMENT_STRUCTURE = {
  membershipFee: 2500,
  bookingAdvance: 50000, // adjusted against the 30% down payment
  downPaymentPct: 0.30,
  installments: 3,
  installmentIntervalMonths: 8,
  modes: 'Cheque, NEFT, RTGS, IMPS, UPI',
  allotment: 'Strictly first come, first serve',
};

// Computes the REAL total for a project + site size straight from the rate card.
// Returns null for anything not in the real catalogue rather than guessing.
export function computeSitePrice(projectName, siteSizeSqft, isCorner = false) {
  const project = PROJECTS[projectName];
  if (!project) return null;
  const size = Number(siteSizeSqft);
  if (!SITE_SIZES_SQFT.includes(size)) return null;
  const base = size * project.ratePerSqft;
  const total = isCorner ? Math.round(base * (1 + CORNER_PREMIUM)) : base;
  const downPayment = Math.round(total * PAYMENT_STRUCTURE.downPaymentPct);
  const remaining = total - downPayment;
  return {
    total,
    downPayment,
    remaining,
    installmentAmount: Math.round(remaining / PAYMENT_STRUCTURE.installments),
    ratePerSqft: project.ratePerSqft,
  };
}

// Hard limits every AI touchpoint must respect. These mirror the guardrails in the
// live Omnidimension agent prompts — they exist because getting these wrong means
// an AI making a promise about someone's land purchase that the Society cannot keep.
export const GUARDRAILS = [
  'NEVER invent a discount, promotional offer, price negotiation, or "flexible payment plan" — the payment structure is fixed and identical for every member.',
  'NEVER promise an exact registration date. The only honest answer is approximately 2-3 years from project commencement, subject to approvals.',
  'NEVER quote an exact registration charge figure — those are separate, borne by the member, and require a callback with the team.',
  'NEVER guarantee appreciation, returns, or "zero risk", and never say the government guarantees the investment.',
  'NEVER cite missing approvals or pending registration as the reason pricing is low — frame it as members investing during the development phase.',
  'NEVER make claims about the Society\'s margins, costs or profit — do not say prices are "at cost", "zero markup", "no profit" or similar. The only sanctioned wording is that the Society aims to keep plots affordable for its members and pricing reflects the current development stage.',
  'NEVER mention or compare against other developers or competitors.',
  'BIAAPA Approval, DC Conversion and A Khata are all currently UNDER PROCESS, intended before handover — state this honestly, never claim they are already granted.',
  'RERA does not apply — the Society operates under the Karnataka Co-operative Societies Act, 1959.',
];

// The real objective of a call. "Close the sale on the phone" is not achievable
// here — land is allotted through a membership + booking process, so the genuine
// win condition is a booked site visit or a captured callback.
export const CALL_GOALS = [
  'Book a site visit (capture their preferred date and time)',
  'Capture a callback number and the best time to reach them',
  'Identify which project and site size they actually want',
];

// Compact briefing injected into AI prompts. Kept tight on purpose — this rides
// along with every strategy/analysis call, so verbosity here costs latency on
// every single call AIVA makes.
export function buildBusinessBriefing() {
  const projectLines = Object.entries(PROJECTS)
    .map(([name, p]) => `- ${name}: Rs.${p.ratePerSqft}/sqft, ${p.acres} acres, ${p.sites} sites. ${p.location}. ${p.highlights}.`)
    .join('\n');

  return `BUSINESS CONTEXT (ground everything in this — never generalise to typical real estate):
${SOCIETY.name} — ${SOCIETY.legalBasis}
Office: ${SOCIETY.office}. Calls happen in ${SOCIETY.languages.join(', ')}.

We sell residential SITES (plots of land), not built houses/villas/apartments. There are exactly two projects:
${projectLines}

Site sizes available (both projects): ${SITE_SIZES_SQFT.join(', ')} sqft. Corner sites cost +${CORNER_PREMIUM * 100}% at allotment.
Total price = site size x rate per sqft. Payment is FIXED for everyone: Rs.${PAYMENT_STRUCTURE.membershipFee} membership fee, Rs.${PAYMENT_STRUCTURE.bookingAdvance} booking advance (adjusted against the down payment), ${PAYMENT_STRUCTURE.downPaymentPct * 100}% down payment, then the remaining ${(1 - PAYMENT_STRUCTURE.downPaymentPct) * 100}% in ${PAYMENT_STRUCTURE.installments} equal installments every ${PAYMENT_STRUCTURE.installmentIntervalMonths} months. Allotment is ${PAYMENT_STRUCTURE.allotment.toLowerCase()}.

A successful call means: ${CALL_GOALS.join('; or ')}.

HARD RULES — these are compliance requirements, not style preferences:
${GUARDRAILS.map(g => `- ${g}`).join('\n')}`;
}

// Default WhatsApp Property Sharing config (server/store.js getPropertyConfig),
// seeded ONLY from real catalogue facts already in PROJECTS above — never invented.
// Fields that would require real assets/coordinates the admin hasn't supplied yet
// (brochure PDF, images, exact GPS lat/lng, nearby landmarks) start EMPTY rather
// than guessed, so AIVA never sends a fabricated brochure link or made-up map pin.
// Defined once here (not duplicated per storage backend) so store.local.js and
// store.firestore.js can never drift on what "default" means — same reasoning as
// server/callOutcomeRules.js consolidating the call-outcome logic.
export function buildDefaultPropertyConfig() {
  const config = {};
  for (const [name, p] of Object.entries(PROJECTS)) {
    config[name] = {
      description: '',
      websiteUrl: '',
      brochureUrl: '',
      brochureMediaId: '', // real Meta media id from uploading a document once (no public hosting needed) — preferred over brochureUrl when set
      brochureFilename: `${name.replace(/\s+/g, '_')}_Brochure.pdf`,
      additionalDocuments: [], // [{ mediaId, filename, caption }] — extra real docs (e.g. a shared amenities PDF) sent alongside the primary brochure
      images: [], // [{ url, caption, category }] — category: entrance|layout|plots|amenities|surroundings|progress
      location: { name, address: p.location, latitude: 0, longitude: 0 },
      highlights: p.highlights.split(',').map(h => h.trim()).filter(Boolean),
      approvalInfo: 'BIAAPA Approval, DC Conversion and A Khata are currently under process, intended before handover.',
      nearbyLandmarks: [],
      siteVisitCtaText: 'Would you like me to arrange a site visit for you?',
      updatedAt: null,
    };
  }
  return config;
}

// ============================================================
//   RK AVENUE — the second business line, sold by the Vistara agent (agent_6).
//
// Vistara is NOT a Society agent. Its Omnidimension prompt pitches RK Avenue, a
// separate plotted development by RK Developers. Until 2026-10-08 every AI
// touchpoint here was briefed with the Society's two projects only, so Vistara's
// calls were analysed against the wrong business: RK Avenue was called "an
// external project" and an interested lead (Ajay kumar J) was permanently closed
// because his reply was judged against projects Vistara never mentions.
//
// Every fact below is copied from Vistara's own live prompt (agent 220214) and
// nothing is added. Notably the prompt says exact plot sizes, legal details and
// payment plans are NOT AVAILABLE — so we deliberately do not model plot sizes or
// a payment structure for this project.
// ============================================================
export const VISTARA_AGENT_ID = 'agent_6';

export const RK_AVENUE = {
  name: 'RK Avenue',
  developer: 'RK Developers',
  location: 'Alkapura Village, near Gauribidanur',
  totalArea: '2.5 acres',
  plots: 36,
  ratePerSqft: 2299,
  distances: 'About 2 km from Gauribidanur town; 80 km from Bangalore city',
  amenities: 'Gated entry, internal roads, street lighting, water and electricity connections, drainage',
  readiness: 'Plots are ready for immediate registration and construction',
};

export const RK_AVENUE_GUARDRAILS = [
  'NEVER quote a discount or negotiate on price — the rate is fixed.',
  'NEVER promise booking confirmation, and never share or promise legal documents.',
  'Exact plot sizes, legal details and payment plans are NOT AVAILABLE to the agent — the honest answer is that the sales team will call back with them. Never invent any of these.',
  'NEVER discuss other projects or other developers.',
  'The agent cannot take payments or confirm bookings.',
];

export const RK_AVENUE_CALL_GOALS = [
  'Book a site visit (capture their preferred date)',
  'Capture the visitor name and WhatsApp number for the sales team callback',
  'Find out whether they are interested in buying a residential plot in this area',
];

export function isRkAvenueAgent(agentId) {
  return agentId === VISTARA_AGENT_ID;
}

// The only project names an agent may ever record for a lead.
export function projectNamesFor(agentId) {
  return isRkAvenueAgent(agentId) ? [RK_AVENUE.name] : Object.keys(PROJECTS);
}

export function buildRkAvenueBriefing() {
  const r = RK_AVENUE;
  return `BUSINESS CONTEXT (ground everything in this — never generalise to typical real estate):
This agent is Vistara, calling for ${r.developer} on behalf of ONE project: ${r.name}. It is NOT the Co-operative Society and does NOT sell North Metro City or Garden City — never mention or judge anything against those.

${r.name}: a premium gated plotted development by ${r.developer}. Location: ${r.location}. ${r.totalArea}, only ${r.plots} premium plots. Rs.${r.ratePerSqft} per sq ft. ${r.readiness}. Amenities: ${r.amenities}. ${r.distances}.
Plot sizes, legal details and payment plans are NOT AVAILABLE to the agent — they are always a callback from the sales team. Because of that, do not extract or guess a plot size.

The opening question on every call is whether the person is looking for a residential plot near Doddaballapur Highway. A "yes" to that is genuine engagement, not silence.

A successful call means: ${RK_AVENUE_CALL_GOALS.join('; or ')}.

HARD RULES — these are compliance requirements, not style preferences:
${RK_AVENUE_GUARDRAILS.map(g => `- ${g}`).join('\n')}`;
}

// The briefing an AI prompt should use for a given agent's leads. Anything that
// is not Vistara is a Society agent.
export function buildBriefingForAgent(agentId) {
  return isRkAvenueAgent(agentId) ? buildRkAvenueBriefing() : buildBusinessBriefing();
}
