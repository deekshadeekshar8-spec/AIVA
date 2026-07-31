// Shared admin credentials for talking to the AIVA backend, which now requires
// HTTP Basic Auth on every route (see server/index.js). Prompts once, caches for
// the tab session, and clears itself automatically on a 401 so a wrong/stale
// password doesn't get stuck retrying forever.
const SESSION_KEY = 'aiva_admin_basic_auth';

export function getStoredAuthHeader(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearStoredAuth(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* no-op */ }
}

export function promptForAuth(): string | null {
  // window.prompt can throw in some embedded/automated contexts instead of
  // just returning null — never let that become an uncaught exception that
  // silently kills a data-loading effect further up the call chain.
  try {
    const username = window.prompt('AIVA Admin — username:', 'admin');
    if (username === null) return null;
    const password = window.prompt('AIVA Admin — password:');
    if (password === null) return null;
    const header = `Basic ${btoa(`${username}:${password}`)}`;
    try { sessionStorage.setItem(SESSION_KEY, header); } catch { /* no-op */ }
    return header;
  } catch {
    return null;
  }
}

// Ensures a stored credential exists (prompting if needed) and returns it.
export function ensureAuthHeader(): string | null {
  return getStoredAuthHeader() || promptForAuth();
}
