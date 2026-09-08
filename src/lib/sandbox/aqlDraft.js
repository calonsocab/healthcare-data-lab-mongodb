const SANDBOX_AQL_DRAFT_KEY = 'hdl:sandbox:aql-draft';
const SANDBOX_AQL_LAUNCH_KEY = 'hdl:sandbox:aql-launch';

export function stashSandboxAqlDraft(aqlText = '') {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  try {
    window.sessionStorage.setItem(
      SANDBOX_AQL_DRAFT_KEY,
      JSON.stringify({
        aqlText: String(aqlText || ''),
        updatedAt: new Date().toISOString()
      })
    );
    return true;
  } catch (error) {
    console.warn('Could not store sandbox AQL draft:', error);
    return false;
  }
}

export function readSandboxAqlDraft() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return '';
  }

  try {
    const raw = window.sessionStorage.getItem(SANDBOX_AQL_DRAFT_KEY);
    if (!raw) return '';

    const parsed = JSON.parse(raw);
    return typeof parsed?.aqlText === 'string' ? parsed.aqlText : '';
  } catch (error) {
    console.warn('Could not read sandbox AQL draft:', error);
    return '';
  }
}

export function stashSandboxAqlLaunch(payload = {}) {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  try {
    window.sessionStorage.setItem(
      SANDBOX_AQL_LAUNCH_KEY,
      JSON.stringify({
        explore: typeof payload?.explore === 'string' ? payload.explore : 'aql',
        source: typeof payload?.source === 'string' ? payload.source : 'lab',
        updatedAt: new Date().toISOString()
      })
    );
    return true;
  } catch (error) {
    console.warn('Could not store sandbox launch context:', error);
    return false;
  }
}

export function consumeSandboxAqlLaunch() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(SANDBOX_AQL_LAUNCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      window.sessionStorage.removeItem(SANDBOX_AQL_LAUNCH_KEY);
      return null;
    }

    const now = Date.now();
    const consumedAt = parsed._consumedAt ? Date.parse(parsed._consumedAt) : NaN;
    if (Number.isFinite(consumedAt)) {
      if (now - consumedAt > 2000) {
        window.sessionStorage.removeItem(SANDBOX_AQL_LAUNCH_KEY);
        return null;
      }
      return parsed;
    }

    window.sessionStorage.setItem(
      SANDBOX_AQL_LAUNCH_KEY,
      JSON.stringify({
        ...parsed,
        _consumedAt: new Date(now).toISOString()
      })
    );
    return parsed;
  } catch (error) {
    console.warn('Could not read sandbox launch context:', error);
    return null;
  }
}

export { SANDBOX_AQL_DRAFT_KEY, SANDBOX_AQL_LAUNCH_KEY };
