// src/lib/security/rateLimit.js
// Generic rate limiting backed by MongoDB with TTL counters.

let rateLimitIndexesReady = false;

async function ensureRateLimitIndexes(coreDb) {
  if (rateLimitIndexesReady || !coreDb) return;
  try {
    await coreDb.collection('rate_limit_counters').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'ttl_expiresAt' }
    );
    rateLimitIndexesReady = true;
  } catch (error) {
    console.warn('rateLimit: unable to ensure TTL index on rate_limit_counters:', error?.message || error);
  }
}

function rateLimitError(code, message, status, details = null) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  if (details) err.details = details;
  return err;
}

export async function consumeRateLimit(coreDb, {
  subjectType,
  subjectId,
  key,
  limit,
  windowSeconds,
  increment = 1
}) {
  if (!coreDb) return;
  if (!subjectType || !subjectId || !key) return;
  if (!Number.isFinite(limit) || limit <= 0) return;
  if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) return;
  await ensureRateLimitIndexes(coreDb);

  const now = Date.now();
  const bucketStartMs = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const bucketId = `${subjectType}:${subjectId}:${key}:${bucketStartMs}`;
  const expiresAt = new Date(bucketStartMs + (windowSeconds * 1000 * 3));

  const result = await coreDb.collection('rate_limit_counters').findOneAndUpdate(
    { _id: bucketId },
    {
      $inc: { count: increment },
      $setOnInsert: {
        subjectType,
        subjectId,
        key,
        bucketStart: new Date(bucketStartMs),
        expiresAt
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const used = result?.count ?? result?.value?.count ?? 0;
  if (used > limit) {
    throw rateLimitError(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded for ${key}`,
      429,
      { subjectType, key, limit, used, windowSeconds }
    );
  }
}

export async function enforceUserRateLimit(coreDb, email, key, limitPerMinute) {
  const subjectId = String(email || '').trim().toLowerCase();
  if (!subjectId) return;
  await consumeRateLimit(coreDb, {
    subjectType: 'user',
    subjectId,
    key,
    limit: limitPerMinute,
    windowSeconds: 60,
    increment: 1
  });
}

