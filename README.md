# AIVA — AI Voice Sales Agent & Lead CRM

AIVA places outbound sales calls with AI voice agents, analyses every finished call with Gemini, and updates the CRM automatically: lead status, score, next follow-up, and WhatsApp property details. It was built for a real-estate housing society selling residential plots near Bengaluru, and it removes the manual work of dialing, logging outcomes and scheduling follow-ups.

## What it does

- **Autonomous follow-up dialer** (`server/scheduler.js`). Off by default. When an admin enables it, it checks every few minutes for leads whose follow-up is due and dispatches a call through the Omnidimension voice platform.
- **AI call analysis** (`server/analyzeCall.js`, `geminiClient.js`). Each transcript is classified with Gemini into an interest level (Hot Lead, Interested, Call Later, Not Interested, Wrong Number), a summary and buying signals.
- **Single source of truth for call outcomes** (`server/callOutcomeRules.js`). A pure, fully tested function decides what changes on a lead after a call: no-answer retries every 4 hours, daily follow-ups for engaged leads, and "sticky" Not Interested / Wrong Number leads that are never dialed again.
- **Lead scoring** (`server/leadScore.js`). A 0-100 score built from real signals (asked about EMI, requested a site visit, confirmed a budget), not a guess.
- **Sales brain, escalation, daily briefing and lost-lead analysis** to help the sales team prioritise.
- **WhatsApp property sharing** (`server/propertySharing.js`, `whatsappCompose.js`): brochure, location and links sent to the lead after a call.
- **Call window enforcement** (`server/callWindow.js`): calls only go out inside the allowed hours.
- **React dashboard** with live call feed, lead list, and six named voice agents.

## Architecture

```
React + Vite dashboard  ->  Express API (server/)  ->  Omnidimension (voice calls)
                                   |                         |
                                   |<---- call poller <------+
                                   v
                          Gemini (call analysis)
                                   |
                         callOutcomeRules (pure)
                                   |
                  Firestore (production) / local store (dev)
                                   |
                           WhatsApp Cloud API
```

`functions/` holds the same server code packaged for Firebase Cloud Functions; `scripts/sync-functions.mjs` keeps the two copies identical, and `npm run verify:functions` fails if they drift.

## Tech stack

Node.js, Express, React 19, TypeScript, Vite, Tailwind CSS, Firebase (Firestore, Cloud Functions), Google Gemini (`@google/genai`), Omnidimension voice API, WhatsApp Cloud API, Vitest.

## Quality and testing

- 18 test files in `server/__tests__/` cover call outcome rules, lead scoring, call window, escalation, lead assignment, WhatsApp composition, concurrency limits and more. Run them with `npm test`.
- `npm run predeploy` syncs the functions, runs the tests and builds before any deploy.
- Real-call review: a batch of 21 production calls was reviewed by hand against the transcripts. It found a voice agent pitching the wrong project, a lead wrongly closed after a positive answer, and very short calls that permanently closed leads. The agent prompt was corrected and the outcome rules tightened.

### Bugs found and fixed

| Problem | Fix |
|---|---|
| Call-outcome logic existed as two hand-kept copies (poller and webhook), so a fix to one silently changed who got called | Merged into one pure function with tests |
| Voicemail calls with a failed analysis stayed on "In Call" forever and never retried | Voicemail statuses are now treated as no-answer and re-enter the retry cadence |
| Voice agent used another project's prompt, so analysis judged calls against the wrong business | Prompt corrected; original kept as a backup |

## Getting started

Prerequisites: Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # dashboard on http://localhost:3000
npm run server               # API server
npm test
```

Environment variables (never commit real values):

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Gemini API key for call analysis |
| `OMNIDIM_API_KEY` | Omnidimension voice platform key |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Dashboard admin login |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | WhatsApp Cloud API |
| `WHATSAPP_BROCHURE_URL`, `WHATSAPP_LOCATION_*`, `WHATSAPP_WEBSITE_URL` | Content sent to leads |

## Results

- Reviewed batch: 21 calls placed, 8 connected (38%), 13 no-answers queued for automatic retry, 8 of 8 transcripts analysed with no failures.

## Notes

Lead data, call reports and API keys are intentionally not in this repository.
