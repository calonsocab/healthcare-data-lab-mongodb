const LAB_AQL_DRAFT_KEY = 'hdl:lab:aql-draft';
const LAB_AQL_LAUNCH_KEY = 'hdl:lab:aql-launch';

export function stashLabAqlDraft(aqlText = '') {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  try {
    window.sessionStorage.setItem(
      LAB_AQL_DRAFT_KEY,
      JSON.stringify({
        aqlText: String(aqlText || ''),
        updatedAt: new Date().toISOString()
      })
    );
    return true;
  } catch (error) {
    console.warn('Could not store Query Lab AQL draft:', error);
    return false;
  }
}

export function readLabAqlDraft() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return '';
  }

  try {
    const raw = window.sessionStorage.getItem(LAB_AQL_DRAFT_KEY);
    if (!raw) return '';

    const parsed = JSON.parse(raw);
    return typeof parsed?.aqlText === 'string' ? parsed.aqlText : '';
  } catch (error) {
    console.warn('Could not read Query Lab AQL draft:', error);
    return '';
  }
}

export function stashLabAqlLaunch(payload = {}) {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  try {
    window.sessionStorage.setItem(
      LAB_AQL_LAUNCH_KEY,
      JSON.stringify({
        source: typeof payload?.source === 'string' ? payload.source : 'contextObjects',
        contractId: typeof payload?.contractId === 'string' ? payload.contractId : '',
        queryShapeId: typeof payload?.queryShapeId === 'string' ? payload.queryShapeId : '',
        definitionId: typeof payload?.definitionId === 'string' ? payload.definitionId : '',
        updatedAt: new Date().toISOString()
      })
    );
    return true;
  } catch (error) {
    console.warn('Could not store Query Lab launch context:', error);
    return false;
  }
}

export function consumeLabAqlLaunch() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(LAB_AQL_LAUNCH_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    window.sessionStorage.removeItem(LAB_AQL_LAUNCH_KEY);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('Could not read Query Lab launch context:', error);
    return null;
  }
}

export { LAB_AQL_DRAFT_KEY, LAB_AQL_LAUNCH_KEY };
