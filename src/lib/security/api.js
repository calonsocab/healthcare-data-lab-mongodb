import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getCoreDb } from '@/lib/db/coreDb';
import { getPortalState } from '@/lib/security/onboardingAccess';
import { headers as nextHeaders } from 'next/headers';
import { getClientIpFromHeaders } from '@/lib/security/clientIp';
import { getCurrentAccessKey } from '@/lib/security/accessKey';
import { decideAccessGate } from '@/lib/security/accessPolicyDecision';
import { recordSecurityEvent } from '@/lib/security/securityTelemetry';

export const RELAXED_AUTH_OPTIONS = Object.freeze({
  allowDuringMaintenance: true,
  allowPaused: true,
  allowBlocked: true,
  allowOnboardingBlocked: true
});

export async function requireAuthenticatedUser(options = {}) {
  const requestHeaders = await nextHeaders();
  const clientIp = getClientIpFromHeaders(requestHeaders);
  const userAgent = requestHeaders.get('user-agent') || null;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    recordSecurityEvent({
      category: 'auth',
      action: 'require_authenticated_user',
      code: 'UNAUTHORIZED',
      status: 401,
      ip: clientIp,
      userAgent,
      details: { reason: 'missing_session_user' }
    }).catch(() => {});
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const normalizedSessionEmail = String(session.user.email || '').trim().toLowerCase();
  if (!normalizedSessionEmail) {
    recordSecurityEvent({
      category: 'auth',
      action: 'require_authenticated_user',
      code: 'UNAUTHORIZED',
      status: 401,
      ip: clientIp,
      userAgent,
      details: { reason: 'missing_session_email' }
    }).catch(() => {});
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  session.user.email = normalizedSessionEmail;

  const {
    allowDuringMaintenance = false,
    allowPaused = false,
    allowBlocked = false,
    // Allow non-allowlisted users to call specific onboarding endpoints (request access, redeem code, access status).
    // For normal app/API usage this should remain false so allowlist_only mode actually blocks access.
    allowOnboardingBlocked = false
  } = options;

  try {
    const db = await getCoreDb();
    const email = String(session.user.email || '').toLowerCase();
    const user = await db.collection('users').findOne(
      { email },
      { projection: { accessStatus: 1, accessStatusReason: 1 } }
    );

    const portalState = await getPortalState(db);

    // Enforce private preview gating (allowlist_only) + user-level access status.
    const accessState = await getCurrentAccessKey(db, email, null, clientIp);
    const evaluation = accessState?.evaluation || {};
    const liveAccessKey = accessState?.key || null;
    const sessionAccessKey = String(session?.access?.key || '').trim() || null;

    const userAccessStatus = evaluation?.userAccessStatus || user?.accessStatus || 'active';
    const decision = decideAccessGate({
      allowDuringMaintenance,
      allowPaused,
      allowBlocked,
      allowOnboardingBlocked,
      portalMode: portalState?.mode || 'normal',
      portalMessage: portalState?.message || null,
      sessionAccessKey,
      liveAccessKey,
      userAccessStatus,
      userAccessReason: evaluation?.userAccessReason || user?.accessStatusReason || null,
      evaluationAccess: evaluation?.access || 'allowed',
      evaluationAllowlisted: evaluation?.allowlisted === true,
      evaluationEffectiveMode: evaluation?.effectiveMode || null,
      evaluationLatestRequest: evaluation?.latestRequest || null
    });
    if (!decision.ok) {
      recordSecurityEvent({
        category: 'auth',
        action: 'require_authenticated_user',
        code: decision.body?.code || 'ACCESS_DENIED',
        status: decision.status || 403,
        email,
        userId: session.user.id || email,
        ip: clientIp,
        userAgent,
        details: {
          userAccessStatus,
          evaluationAccess: evaluation?.access || 'allowed'
        }
      }).catch(() => {});
      return {
        ok: false,
        response: NextResponse.json(decision.body, { status: decision.status })
      };
    }
  } catch (error) {
    recordSecurityEvent({
      category: 'auth',
      action: 'require_authenticated_user',
      code: 'ACCESS_POLICY_UNAVAILABLE',
      status: 503,
      email: normalizedSessionEmail,
      userId: session.user.id || normalizedSessionEmail,
      ip: clientIp,
      userAgent,
      details: {
        error: error?.message || 'Unknown error'
      }
    }).catch(() => {});
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Access policy verification failed',
          code: 'ACCESS_POLICY_UNAVAILABLE',
          details: process.env.NODE_ENV === 'development' ? (error?.message || 'Unknown error') : undefined
        },
        { status: 503 }
      )
    };
  }

  return { ok: true, session };
}

export async function requireRelaxedAuthenticatedUser() {
  return requireAuthenticatedUser(RELAXED_AUTH_OPTIONS);
}

export async function getOptionalAuthenticatedSession(options = {}) {
  const auth = await requireAuthenticatedUser(options);
  return auth.ok ? auth.session : null;
}

export async function getOptionalRelaxedAuthenticatedSession() {
  return getOptionalAuthenticatedSession(RELAXED_AUTH_OPTIONS);
}

export function safeErrorResponse(error, fallbackMessage = 'Request failed', status = 500) {
  const isClient = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500;
  const message = isClient ? (error?.message || fallbackMessage) : fallbackMessage;
  const responseStatus = Number.isInteger(error?.status) ? error.status : status;
  return NextResponse.json({ error: message }, { status: responseStatus });
}

export function safeUpstreamError(error, fallbackMessage = 'Upstream request failed', status = 502) {
  const responseStatus = Number.isInteger(error?.status) ? error.status : status;
  const includeDetails =
    process.env.NODE_ENV !== 'production' || process.env.EXPOSE_UPSTREAM_ERROR_DETAILS === 'true';

  if (includeDetails) {
    const payload = error?.code || error?.details
      ? { error: { code: error.code, message: error.message || fallbackMessage, details: error.details || null } }
      : { error: error?.message || fallbackMessage };
    return NextResponse.json(payload, { status: responseStatus });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: responseStatus });
}

export function clampPositiveInt(value, fallback, max = 1000) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}
