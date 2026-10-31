// Cloud Functions v2 runs on Cloud Run without "CPU always allocated" here, so
// work left running after a response is sent is not guaranteed to ever finish
// (the instance's CPU can be frozen the moment the HTTP response completes).
// Any best-effort AI call that a request wants to benefit from — but must not
// be blocked by — has to be capped with a real timeout and awaited within the
// request lifecycle, not fired-and-forgotten.
export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve({ ok: false, reason: 'timeout' }), ms)),
  ]);
}
