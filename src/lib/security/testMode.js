export function isTestModeBypassEnabled() {
  if (process.env.TEST_MODE !== 'true') return false;

  // Hardening: test-mode bypass is only for automated tests.
  // Never allow bypass in dev/prod via env toggles.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Invalid configuration: TEST_MODE must not be enabled in production.');
  }

  return process.env.NODE_ENV === 'test';
}
