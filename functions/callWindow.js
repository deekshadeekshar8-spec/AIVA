// Calling-hours guard — real leads must never be dialed outside the business's
// permitted window (explicit client rule, 2026-08-12: 11:00 AM–7:30 PM, no calls
// outside that). Always computed in India Standard Time (Asia/Kolkata) regardless
// of what timezone the server process itself is running in — the deployed Cloud
// Function runs in UTC, so relying on server-local time would silently place
// calls at the wrong real-world hour in production. Pure function, no I/O, same
// testing pattern as callOutcomeRules.js.
const TIMEZONE = 'Asia/Kolkata';

function istHoursDecimal(date) {
  // en-US + hour12:false + Asia/Kolkata gives us the real IST wall-clock time
  // regardless of the host machine/process's own timezone.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find(p => p.type === 'hour').value);
  const minute = Number(parts.find(p => p.type === 'minute').value);
  return hour + minute / 60;
}

export function isWithinCallWindow(date, settings) {
  const startHour = settings?.callWindowStartHour ?? 11;
  const endHour = settings?.callWindowEndHour ?? 19.5;
  const hours = istHoursDecimal(date);
  return hours >= startHour && hours < endHour;
}

function formatHour(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const period = hh >= 12 ? 'PM' : 'AM';
  const displayHour = hh % 12 === 0 ? 12 : hh % 12;
  return mm === 0 ? `${displayHour} ${period}` : `${displayHour}:${String(mm).padStart(2, '0')} ${period}`;
}

export function formatCallWindow(settings) {
  const startHour = settings?.callWindowStartHour ?? 11;
  const endHour = settings?.callWindowEndHour ?? 19.5;
  return `${formatHour(startHour)}–${formatHour(endHour)} IST`;
}
