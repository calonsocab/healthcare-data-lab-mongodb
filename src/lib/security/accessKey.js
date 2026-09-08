import crypto from 'crypto';
import { evaluateOnboardingAccess } from '@/lib/security/onboardingAccess';

const ACCESS_KEY_VERSION = 'v1';

function sortValue(input) {
  if (Array.isArray(input)) {
    return input.map((item) => sortValue(item));
  }
  if (input && typeof input === 'object') {
    return Object.keys(input)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortValue(input[key]);
        return acc;
      }, {});
  }
  return input;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizePolicy(policy = null) {
  const source = policy && typeof policy === 'object' ? policy : {};
  const domainDefaultJoin = source.domainDefaultJoin && typeof source.domainDefaultJoin === 'object'
    ? source.domainDefaultJoin
    : {};
  return {
    mode: source.mode === 'allowlist_only' ? 'allowlist_only' : 'open',
    phaseLabel: normalizeString(source.phaseLabel || ''),
    defaultJoinTeamSlug: normalizeString(source.defaultJoinTeamSlug || '') || null,
    requestAccessEnabled: source.requestAccessEnabled !== false,
    ipAllowlistCidrs: Array.isArray(source.ipAllowlistCidrs)
      ? source.ipAllowlistCidrs.map((item) => normalizeString(item)).filter(Boolean)
      : [],
    domainDefaultJoin: Object.keys(domainDefaultJoin)
      .sort()
      .reduce((acc, key) => {
        const normalizedKey = normalizeString(key).toLowerCase();
        const normalizedValue = normalizeString(domainDefaultJoin[key]).toLowerCase();
        if (normalizedKey && normalizedValue) acc[normalizedKey] = normalizedValue;
        return acc;
      }, {})
  };
}

function normalizePortalState(state = null) {
  const source = state && typeof state === 'object' ? state : {};
  return {
    mode: source.mode === 'maintenance' ? 'maintenance' : 'normal',
    message: normalizeString(source.message || '')
  };
}

export function buildAccessKeyPayload(email, evaluation = null) {
  const ctx = evaluation && typeof evaluation === 'object' ? evaluation : {};
  return sortValue({
    version: ACCESS_KEY_VERSION,
    email: normalizeString(email).toLowerCase(),
    deploymentMode: normalizeString(ctx.deploymentMode || 'internal'),
    effectiveMode: normalizeString(ctx.effectiveMode || 'open'),
    policy: normalizePolicy(ctx.policy),
    portalState: normalizePortalState(ctx.portalState),
    emailAllowlisted: ctx.emailAllowlisted === true,
    userAccessStatus: normalizeString(ctx.userAccessStatus || 'active'),
    userAccessReason: normalizeString(ctx.userAccessReason || '') || null,
    latestRequestStatus: normalizeString(ctx.latestRequest?.status || '') || null
  });
}

export function hashAccessKeyPayload(payload) {
  const serialized = JSON.stringify(sortValue(payload));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

export async function getCurrentAccessKey(db, email, requestedTeamSlug = null, clientIp = null) {
  const normalizedEmail = normalizeString(email).toLowerCase();
  const evaluation = await evaluateOnboardingAccess(db, normalizedEmail, requestedTeamSlug, clientIp);
  const payload = buildAccessKeyPayload(normalizedEmail, evaluation);
  const hash = hashAccessKeyPayload(payload);
  return {
    key: `${ACCESS_KEY_VERSION}:${hash}`,
    payload,
    evaluation
  };
}
