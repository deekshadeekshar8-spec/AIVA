// Keeps functions/ byte-identical to server/ for the shared backend modules.
//
// Why this exists: the deployed Cloud Function runs functions/*.js, while local dev
// runs server/*.js. These were kept in sync by hand-typed `cp` commands before every
// deploy. Forgetting one file ships a Cloud Function running different logic than the
// code that was reviewed and tested — silently, with no error. For a system that
// autonomously phones real people, that is not an acceptable failure mode.
//
//   node scripts/sync-functions.mjs          copy server/ -> functions/
//   node scripts/sync-functions.mjs --check  verify only, non-zero exit on drift (CI)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(root, 'server');
const FUNCTIONS = path.join(root, 'functions');

// Files that are genuinely shared. Anything server-only (index.js, its local
// scheduler bootstrap) is deliberately excluded — functions/index.js is its own
// Cloud Functions entrypoint and must not be overwritten.
const SHARED = [
  'app.js',
  'analyzeCall.js',
  'auth.js',
  'businessFacts.js',
  'callOutcomeRules.js',
  'callPoller.js',
  'callWindow.js',
  'content.config.js',
  'dailyBriefing.js',
  'escalation.js',
  'geminiClient.js',
  'importFromOmnidim.js',
  'leadAssignment.js',
  'leadIntelligence.js',
  'leadScore.js',
  'liveFeed.js',
  'lostLeadIntelligence.js',
  'omnidim.js',
  'propertySharing.js',
  'recommendation.js',
  'salesBrain.js',
  'salesFunnel.js',
  'scheduler.js',
  'scriptVariants.js',
  'store.firestore.js',
  'store.js',
  'store.local.js',
  'whatsappClient.js',
  'whatsappCompose.js',
  'withTimeout.js',
];

const checkOnly = process.argv.includes('--check');
const drifted = [];
const missing = [];
let copied = 0;

for (const file of SHARED) {
  const src = path.join(SERVER, file);
  const dest = path.join(FUNCTIONS, file);

  if (!fs.existsSync(src)) {
    missing.push(`server/${file} does not exist but is listed as shared`);
    continue;
  }
  const srcContent = fs.readFileSync(src);
  const destExists = fs.existsSync(dest);
  const same = destExists && Buffer.compare(srcContent, fs.readFileSync(dest)) === 0;

  if (same) continue;

  if (checkOnly) {
    drifted.push(destExists ? `functions/${file} differs from server/${file}` : `functions/${file} is missing`);
  } else {
    fs.writeFileSync(dest, srcContent);
    copied++;
    console.log(`  synced ${file}`);
  }
}

// A shared module that exists in server/ but was never added to SHARED would be
// silently left un-synced, which is the exact bug this script prevents. Catch it.
const serverJs = fs.readdirSync(SERVER).filter(f => f.endsWith('.js') && f !== 'index.js');
const untracked = serverJs.filter(f => !SHARED.includes(f));
if (untracked.length) {
  missing.push(`server/ has files not listed in SHARED (add them or exclude deliberately): ${untracked.join(', ')}`);
}

if (missing.length) {
  console.error('\nsync-functions: configuration problem');
  missing.forEach(m => console.error('  - ' + m));
  process.exit(1);
}

if (checkOnly) {
  if (drifted.length) {
    console.error('\nsync-functions: functions/ is OUT OF SYNC with server/');
    drifted.forEach(d => console.error('  - ' + d));
    console.error('\nRun: npm run sync:functions');
    process.exit(1);
  }
  console.log(`sync-functions: OK — all ${SHARED.length} shared modules identical`);
} else {
  console.log(copied === 0
    ? `sync-functions: already up to date (${SHARED.length} modules)`
    : `sync-functions: synced ${copied} file(s)`);
}
