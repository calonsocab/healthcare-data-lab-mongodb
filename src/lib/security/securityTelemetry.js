import { getCoreDb } from '@/lib/db/coreDb';

let indexesReady = false;

function toNullableString(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

async function ensureIndexes(db) {
  if (indexesReady || !db) return;
  try {
    const ttlDaysRaw = Number.parseInt(String(process.env.SECURITY_EVENTS_TTL_DAYS || '90'), 10);
    const ttlDays = Number.isFinite(ttlDaysRaw) && ttlDaysRaw > 0 ? ttlDaysRaw : 90;
    await db.collection('security_events').createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: ttlDays * 24 * 60 * 60, name: 'ttl_timestamp' }
    );
    await db.collection('security_events').createIndex(
      { category: 1, code: 1, status: 1, timestamp: -1 },
      { name: 'category_code_status_timestamp' }
    );
    indexesReady = true;
  } catch (error) {
    console.warn('securityTelemetry: unable to ensure indexes:', error?.message || error);
  }
}

export async function recordSecurityEvent(event = {}) {
  if (process.env.SECURITY_EVENTS_DISABLED === 'true') return null;
  try {
    const db = await getCoreDb();
    await ensureIndexes(db);

    const payload = {
      category: toNullableString(event.category) || 'security',
      action: toNullableString(event.action) || null,
      code: toNullableString(event.code) || null,
      status: Number.isInteger(event.status) ? event.status : null,
      email: toNullableString(event.email)?.toLowerCase() || null,
      userId: toNullableString(event.userId) || null,
      teamId: toNullableString(event.teamId) || null,
      ip: toNullableString(event.ip) || null,
      userAgent: toNullableString(event.userAgent) || null,
      details: event.details && typeof event.details === 'object' ? event.details : {},
      timestamp: new Date(),
      date: new Date().toISOString().split('T')[0]
    };

    await db.collection('security_events').insertOne(payload);
    return payload;
  } catch (error) {
    console.warn('securityTelemetry: failed to record security event:', error?.message || error);
    return null;
  }
}

