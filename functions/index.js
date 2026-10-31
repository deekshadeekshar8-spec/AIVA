// Cloud Functions (2nd gen) entrypoint — wraps the exact same Express app used
// for local dev (npm run server). Firebase automatically loads functions/.env
// into process.env before this module runs, so app.js's own dotenv bootstrap
// (guarded to skip when K_SERVICE/FUNCTION_TARGET are set) is a no-op here.
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import app from './app.js';
import { runFollowUpSweep } from './scheduler.js';
import { pollOmnidimCallsOnce } from './callPoller.js';

// maxInstances caps runaway cost if this ever gets hammered; memory/timeout are
// generous enough for a Gemini TTS call or an Omnidimension call-log page fetch.
// timeoutSeconds is 300 (not the default 60) because POST /api/campaigns/:id/launch
// dispatches real calls to every lead in a campaign SEQUENTIALLY (see server/app.js)
// — up to MAX_CAMPAIGN_SIZE leads, each an external Omnidimension API round-trip.
export const api = onRequest(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 300, maxInstances: 10 },
  app
);

// Cloud Functions has no long-running process, so the local setInterval scheduler
// (server/scheduler.js's startScheduler) never runs in production. This scheduled
// function is what replaces it there: every 5 minutes it (1) pulls new Omnidimension
// call results into leads — including the no-answer/"call later" 2-hour retry logic —
// and (2) dials any lead whose follow-up is due, but ONLY when autoDialEnabled is on
// (see server/store.js DEFAULT_SETTINGS; off by default, must be explicitly enabled).
export const scheduledSweep = onSchedule(
  { schedule: 'every 5 minutes', region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async () => {
    await pollOmnidimCallsOnce(console.log);
    await runFollowUpSweep(console.log);
  }
);
