// Local dev entrypoint (npm run server) — runs the shared Express app (server/app.js)
// as a plain Node HTTP server, plus the autonomous follow-up scheduler (which only
// makes sense as a long-lived process; the deployed Cloud Function does not run this —
// see DEPLOY.md for the production equivalent using Cloud Scheduler).
import app, { WHATSAPP_TOKEN, PHONE_NUMBER_ID } from './app.js';
import { startScheduler } from './scheduler.js';

const PORT = process.env.WHATSAPP_SERVER_PORT || 8787;

app.listen(PORT, () => {
  console.log(`[AIVA backend] listening on http://localhost:${PORT}`);
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.log('[AIVA backend] WhatsApp NOT CONFIGURED — set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.local');
  }
  if (!process.env.OMNIDIM_API_KEY) {
    console.log('[AIVA backend] Omnidimension NOT CONFIGURED — set OMNIDIM_API_KEY in .env.local');
  }
  startScheduler(console.log);
});
