export function decideAccessGate(input = {}) {
  const {
    allowDuringMaintenance = false,
    allowPaused = false,
    allowBlocked = false,
    allowOnboardingBlocked = false,
    portalMode = 'normal',
    portalMessage = null,
    sessionAccessKey = null,
    liveAccessKey = null,
    userAccessStatus = 'active',
    userAccessReason = null,
    evaluationAccess = 'allowed',
    evaluationAllowlisted = true,
    evaluationEffectiveMode = null,
    evaluationLatestRequest = null
  } = input;

  if (!allowDuringMaintenance && portalMode === 'maintenance') {
    return {
      ok: false,
      status: 503,
      body: {
        error: 'Portal is under maintenance',
        code: 'MAINTENANCE_MODE',
        message: portalMessage
      }
    };
  }

  if (!sessionAccessKey || !liveAccessKey || sessionAccessKey !== liveAccessKey) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'Session access state is stale. Please sign in again.',
        code: 'SESSION_ACCESS_STALE'
      }
    };
  }

  if (!allowBlocked && userAccessStatus === 'blocked') {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'Access blocked',
        code: 'ACCESS_BLOCKED',
        reason: userAccessReason || null
      }
    };
  }

  if (!allowPaused && userAccessStatus === 'paused') {
    return {
      ok: false,
      status: 423,
      body: {
        error: 'Access paused',
        code: 'ACCESS_PAUSED',
        reason: userAccessReason || null
      }
    };
  }

  if (!allowOnboardingBlocked && (evaluationAccess === 'blocked' || evaluationAccess === 'pending')) {
    return {
      ok: false,
      status: 403,
      body: {
        error: evaluationAccess === 'pending' ? 'Access request pending' : 'Private preview access required',
        code: 'PREVIEW_ACCESS_REQUIRED',
        access: evaluationAccess,
        allowlisted: evaluationAllowlisted === true,
        effectiveMode: evaluationEffectiveMode || null,
        latestRequest: evaluationLatestRequest || null
      }
    };
  }

  return { ok: true };
}
