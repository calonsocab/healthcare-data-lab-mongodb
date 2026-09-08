import { ObjectId } from 'mongodb';
import { recordSecurityEvent } from '@/lib/security/securityTelemetry';

export const DEFAULT_TEAM_POLICY = Object.freeze({
  version: 1,
  limits: {
    maxDataModels: null,
    maxSyntheticPatientsPerJob: null,
    maxSyntheticPatientsPerDay: null,
    maxSyntheticJobsPerHour: null,
    maxApiRequestsPerMinute: null,
    maxUploadFileBytes: null,
    maxIngestDocumentBytes: null,
    maxIngestDocumentsPerRequest: null,
    maxSyntheticPayloadBytes: null
  }
});

function toNullablePositiveInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

let teamPolicyCounterIndexesReady = false;

async function ensureTeamPolicyCounterIndexes(coreDb) {
  if (teamPolicyCounterIndexesReady || !coreDb) return;
  try {
    await coreDb.collection('team_policy_counters').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'ttl_expiresAt' }
    );
    teamPolicyCounterIndexesReady = true;
  } catch (error) {
    console.warn('teamPolicy: unable to ensure TTL index on team_policy_counters:', error?.message || error);
  }
}

export function normalizeTeamPolicy(policy = null) {
  const input = policy && typeof policy === 'object' ? policy : {};
  const limits = input.limits && typeof input.limits === 'object' ? input.limits : {};
  const normalized = {
    version: 1,
    limits: {
      maxDataModels: toNullablePositiveInt(limits.maxDataModels),
      maxSyntheticPatientsPerJob: toNullablePositiveInt(limits.maxSyntheticPatientsPerJob),
      maxSyntheticPatientsPerDay: toNullablePositiveInt(limits.maxSyntheticPatientsPerDay),
      maxSyntheticJobsPerHour: toNullablePositiveInt(limits.maxSyntheticJobsPerHour),
      maxApiRequestsPerMinute: toNullablePositiveInt(limits.maxApiRequestsPerMinute),
      maxUploadFileBytes: toNullablePositiveInt(limits.maxUploadFileBytes),
      maxIngestDocumentBytes: toNullablePositiveInt(limits.maxIngestDocumentBytes),
      maxIngestDocumentsPerRequest: toNullablePositiveInt(limits.maxIngestDocumentsPerRequest),
      maxSyntheticPayloadBytes: toNullablePositiveInt(limits.maxSyntheticPayloadBytes)
    }
  };
  if (input.updatedAt) normalized.updatedAt = input.updatedAt;
  if (input.updatedBy) normalized.updatedBy = input.updatedBy;
  return normalized;
}

function parseRole(team, email) {
  const member = (team?.members || []).find(
    (m) => m?.email?.toLowerCase() === String(email || '').toLowerCase()
  );
  return member?.role || null;
}

export async function resolvePolicyContext(coreDb, email) {
  if (!coreDb || !email) {
    return {
      mode: 'anonymous',
      isTeam: false,
      teamId: null,
      role: null,
      policy: normalizeTeamPolicy()
    };
  }

  const user = await coreDb.collection('users').findOne(
    { email },
    { projection: { teamId: 1, accountType: 1, email: 1 } }
  );

  if (!user?.teamId || (user.accountType !== 'team' && user.accountType !== 'demo')) {
    return {
      mode: 'individual',
      isTeam: false,
      teamId: null,
      role: 'owner',
      policy: normalizeTeamPolicy()
    };
  }

  const teamQuery =
    typeof user.teamId === 'string' && ObjectId.isValid(user.teamId)
      ? { _id: new ObjectId(user.teamId) }
      : { _id: user.teamId };
  const team = await coreDb.collection('teams').findOne(teamQuery, {
    projection: { _id: 1, members: 1, policy: 1 }
  });

  return {
    mode: 'team',
    isTeam: true,
    teamId: team?._id?.toString?.() || String(user.teamId),
    role: parseRole(team, email),
    policy: normalizeTeamPolicy(team?.policy)
  };
}

function policyError(code, message, status, details = null) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  if (details) err.details = details;
  return err;
}

export function enforceNumericLimit(limit, value, { code, message, details, status = 429 }) {
  if (!Number.isFinite(limit) || limit <= 0) return;
  if (!Number.isFinite(value) || value <= limit) return;
  throw policyError(code, message, status, details);
}

export async function consumeTeamRateLimit(coreDb, teamId, key, limit, windowSeconds, increment = 1) {
  if (!coreDb || !teamId) return;
  if (!Number.isFinite(limit) || limit <= 0) return;
  if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) return;
  await ensureTeamPolicyCounterIndexes(coreDb);

  const now = Date.now();
  const bucketStartMs = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const bucketId = `${teamId}:${key}:${bucketStartMs}`;
  const expiresAt = new Date(bucketStartMs + (windowSeconds * 1000 * 3));

  const result = await coreDb.collection('team_policy_counters').findOneAndUpdate(
    { _id: bucketId },
    {
      $inc: { count: increment },
      $setOnInsert: {
        teamId,
        key,
        bucketStart: new Date(bucketStartMs),
        expiresAt
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  );

  const used = result?.count ?? result?.value?.count ?? 0;
  if (used > limit) {
    recordSecurityEvent({
      category: 'rate_limit',
      action: 'team_policy_counter',
      code: 'TEAM_RATE_LIMIT_EXCEEDED',
      status: 429,
      teamId,
      details: { key, limit, used, windowSeconds }
    }).catch(() => {});
    throw policyError(
      'TEAM_RATE_LIMIT_EXCEEDED',
      `Team policy rate limit exceeded for ${key}`,
      429,
      { key, limit, used, windowSeconds }
    );
  }
}

export async function enforceApiRateLimit(coreDb, policyContext, routeKey) {
  if (!policyContext?.isTeam) return;
  const limit = policyContext?.policy?.limits?.maxApiRequestsPerMinute;
  await consumeTeamRateLimit(coreDb, policyContext.teamId, `api:${routeKey}`, limit, 60, 1);
}
