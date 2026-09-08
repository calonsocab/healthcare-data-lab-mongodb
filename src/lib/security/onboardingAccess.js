import { ObjectId } from 'mongodb';

export const DEFAULT_ACCESS_POLICY = Object.freeze({
  mode: 'open', // open | allowlist_only
  phaseLabel: 'Internal users',
  defaultJoinTeamSlug: null,
  domainDefaultJoin: {
    'mongodb.com': 'mongodb'
  },
  ipAllowlistCidrs: [],
  requestAccessEnabled: true
});

export const DEFAULT_PORTAL_STATE = Object.freeze({
  mode: 'normal', // normal | maintenance
  message: 'Healthcare Data Lab is temporarily under maintenance. Please try again shortly.'
});

export function getDeploymentMode() {
  const raw = String(process.env.ACCESS_MODE || 'internal').toLowerCase().trim();
  return raw === 'external' ? 'external' : 'internal';
}

function normalizePolicy(input = null) {
  const source = input && typeof input === 'object' ? input : {};
  const domainDefaultJoin =
    source.domainDefaultJoin && typeof source.domainDefaultJoin === 'object'
      ? source.domainDefaultJoin
      : DEFAULT_ACCESS_POLICY.domainDefaultJoin;
  const ipAllowlistCidrs = Array.isArray(source.ipAllowlistCidrs)
    ? source.ipAllowlistCidrs.map((v) => String(v || '').trim()).filter(Boolean)
    : DEFAULT_ACCESS_POLICY.ipAllowlistCidrs;
  return {
    mode: source.mode === 'allowlist_only' ? 'allowlist_only' : 'open',
    phaseLabel: source.phaseLabel || DEFAULT_ACCESS_POLICY.phaseLabel,
    defaultJoinTeamSlug: source.defaultJoinTeamSlug || null,
    domainDefaultJoin,
    ipAllowlistCidrs,
    requestAccessEnabled: source.requestAccessEnabled !== false
  };
}

function parseIp(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const value = raw.split('%')[0]; // strip zone id (IPv6)

  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    const parts = value.split('.').map((x) => Number(x));
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const int =
      (BigInt(parts[0]) << 24n) |
      (BigInt(parts[1]) << 16n) |
      (BigInt(parts[2]) << 8n) |
      BigInt(parts[3]);
    return { bits: 32, int };
  }

  // IPv6 (supports :: compression and IPv4-mapped tail)
  const lower = value.toLowerCase();
  if (!/^[0-9a-f:.]+$/.test(lower)) return null;

  const parts = lower.split('::');
  if (parts.length > 2) return null;
  const leftRaw = parts[0];
  const rightRaw = parts.length === 2 ? parts[1] : null;

  const parseHextets = (segment) => {
    if (!segment) return [];
    const segParts = segment.split(':').filter((p) => p.length > 0);
    const out = [];
    for (const p of segParts) {
      if (p.includes('.')) {
        const v4 = parseIp(p);
        if (!v4 || v4.bits !== 32) return null;
        out.push(Number((v4.int >> 16n) & 0xffffn));
        out.push(Number(v4.int & 0xffffn));
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(p)) return null;
      out.push(parseInt(p, 16));
    }
    return out;
  };

  const left = parseHextets(leftRaw);
  if (left === null) return null;
  const right = rightRaw === null ? [] : parseHextets(rightRaw);
  if (right === null) return null;

  const total = left.length + right.length;
  if (rightRaw === null) {
    if (total !== 8) return null;
  } else {
    if (total > 8) return null;
  }
  const missing = rightRaw === null ? 0 : 8 - total;
  const groups = [...left, ...Array.from({ length: missing }, () => 0), ...right];
  if (groups.length !== 8) return null;

  let int = 0n;
  for (const g of groups) {
    if (!Number.isInteger(g) || g < 0 || g > 0xffff) return null;
    int = (int << 16n) | BigInt(g);
  }
  return { bits: 128, int };
}

function parseCidr(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const [ipPart, prefixRaw] = raw.split('/');
  const ip = parseIp(ipPart);
  if (!ip) return null;
  const prefix = prefixRaw === undefined ? ip.bits : Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > ip.bits) return null;
  return { ...ip, prefix };
}

function matchesCidr(ipStr, cidrStr) {
  const ip = parseIp(ipStr);
  const cidr = parseCidr(cidrStr);
  if (!ip || !cidr) return false;
  if (ip.bits !== cidr.bits) return false;
  const shift = BigInt(ip.bits - cidr.prefix);
  return (ip.int >> shift) === (cidr.int >> shift);
}

function stripCidrComment(value) {
  // Allow storing CIDR lines with comments (ex: "203.0.113.0/24 # office")
  // and disabling entries by prefixing with "#".
  const raw = String(value || "");
  const noComment = raw.split("#")[0];
  return String(noComment || "").trim();
}

function isIpAllowlisted(policy, clientIp) {
  const cidrs = Array.isArray(policy?.ipAllowlistCidrs) ? policy.ipAllowlistCidrs : [];
  const ip = String(clientIp || '').trim();
  if (!ip || cidrs.length === 0) return false;
  return cidrs.some((c) => {
    const cidr = stripCidrComment(c);
    if (!cidr) return false; // blank or commented-out entry
    return matchesCidr(ip, cidr);
  });
}

export async function getAccessPolicy(db) {
  const doc = await db.collection('platform_settings').findOne({ _id: 'access_policy' });
  return normalizePolicy(doc?.value);
}

export async function setAccessPolicy(db, value, updatedBy = null) {
  const normalized = normalizePolicy(value);
  await db.collection('platform_settings').updateOne(
    { _id: 'access_policy' },
    {
      $set: {
        value: normalized,
        updatedAt: new Date(),
        ...(updatedBy ? { updatedBy } : {})
      }
    },
    { upsert: true }
  );
  return normalized;
}

function normalizePortalState(input = null) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    mode: source.mode === 'maintenance' ? 'maintenance' : 'normal',
    message: source.message ? String(source.message).slice(0, 500) : DEFAULT_PORTAL_STATE.message
  };
}

export async function getPortalState(db) {
  const doc = await db.collection('platform_settings').findOne({ _id: 'portal_state' });
  return normalizePortalState(doc?.value);
}

export async function setPortalState(db, value, updatedBy = null) {
  const normalized = normalizePortalState(value);
  await db.collection('platform_settings').updateOne(
    { _id: 'portal_state' },
    {
      $set: {
        value: normalized,
        updatedAt: new Date(),
        ...(updatedBy ? { updatedBy } : {})
      }
    },
    { upsert: true }
  );
  return normalized;
}

export async function isAllowlisted(db, email) {
  if (!email) return false;
  const item = await db.collection('preview_allowlist').findOne(
    { email: email.toLowerCase() },
    { projection: { status: 1 } }
  );
  return item?.status === 'approved';
}

export async function getLatestAccessRequest(db, email) {
  if (!email) return null;
  return db.collection('access_requests').findOne(
    { email: email.toLowerCase() },
    { sort: { createdAt: -1 } }
  );
}

function resolveTeamSlug(policy, email, requestedTeamSlug) {
  if (requestedTeamSlug) return requestedTeamSlug;
  const domain = String(email || '').toLowerCase().split('@')[1] || '';
  if (domain && policy.domainDefaultJoin?.[domain]) {
    return policy.domainDefaultJoin[domain];
  }
  return policy.defaultJoinTeamSlug || null;
}

export async function evaluateOnboardingAccess(db, email, requestedTeamSlug = null, clientIp = null) {
  const lowerEmail = String(email || '').toLowerCase();
  const policy = await getAccessPolicy(db);
  const portalState = await getPortalState(db);
  const deploymentMode = getDeploymentMode();

  const emailAllowlisted = await isAllowlisted(db, lowerEmail);
  const ipAllowlisted = isIpAllowlisted(policy, clientIp);
  const allowlisted = emailAllowlisted || ipAllowlisted;
  const latestRequest = await getLatestAccessRequest(db, lowerEmail);
  const teamSlug = resolveTeamSlug(policy, lowerEmail, requestedTeamSlug);

  const effectiveMode =
    deploymentMode === 'external' && policy.mode !== 'allowlist_only'
      ? 'allowlist_only'
      : policy.mode;

  let access = 'allowed';
  if (effectiveMode === 'allowlist_only' && !allowlisted) {
    access = 'blocked';
  }

  const user = await db.collection('users').findOne(
    { email: lowerEmail },
    { projection: { accessStatus: 1, accessStatusReason: 1 } }
  );
  const userAccessStatus = user?.accessStatus || 'active';
  if (userAccessStatus === 'paused' || userAccessStatus === 'blocked') {
    access = userAccessStatus;
  }

  const result = {
    policy,
    portalState,
    deploymentMode,
    effectiveMode,
    access,
    allowlisted,
    emailAllowlisted,
    ipAllowlisted,
    clientIp: clientIp || null,
    userAccessStatus,
    userAccessReason: user?.accessStatusReason || null,
    teamSlug,
    latestRequest: latestRequest
      ? {
          _id: latestRequest._id?.toString?.() || null,
          status: latestRequest.status || 'pending',
          reason: latestRequest.reason || '',
          createdAt: latestRequest.createdAt || null,
          reviewedAt: latestRequest.reviewedAt || null
        }
      : null
  };

  if (access === 'blocked' && latestRequest?.status === 'pending') {
    result.access = 'pending';
  }

  return result;
}

export function toObjectIdIfValid(id) {
  if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
  return id;
}
