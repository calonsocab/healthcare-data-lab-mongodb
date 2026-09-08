import { NextResponse } from 'next/server';
import { requireRelaxedAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';
import { getCoreDb } from '@/lib/db/coreDb';
import { getClientIpFromHeaders } from '@/lib/security/clientIp';
import { recordSecurityEvent } from '@/lib/security/securityTelemetry';

export async function POST(request) {
  try {
    const auth = await requireRelaxedAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const db = await getCoreDb();
    const email = auth.session.user.email.toLowerCase();
    const { reason = '', company = '' } = await request.json().catch(() => ({}));
    const clientIp = getClientIpFromHeaders(request.headers);
    const userAgent = request.headers.get('user-agent') || null;

    // Basic anti-spam rate limits (best-effort; depends on client IP headers).
    // - 1 request per 2 minutes per email
    // - max 5 requests per 24 hours per email
    // - max 20 requests per 24 hours per IP (if IP is available)
    const now = Date.now();
    const twoMinutesAgo = new Date(now - 2 * 60 * 1000);
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const [recentByEmail, countEmailDay, countIpDay] = await Promise.all([
      db.collection('access_requests').findOne(
        { email, createdAt: { $gte: twoMinutesAgo } },
        { projection: { _id: 1, createdAt: 1 } }
      ),
      db.collection('access_requests').countDocuments({ email, createdAt: { $gte: dayAgo } }).catch(() => 0),
      clientIp
        ? db.collection('access_requests').countDocuments({ clientIp, createdAt: { $gte: dayAgo } }).catch(() => 0)
        : Promise.resolve(0)
    ]);

    if (recentByEmail) {
      recordSecurityEvent({
        category: 'rate_limit',
        action: 'onboarding_request_access',
        code: 'ACCESS_REQUEST_RATE_LIMIT_SHORT',
        status: 429,
        email,
        userId: auth.session.user.id || email,
        ip: clientIp,
        userAgent,
        details: { limit: '1/2m' }
      }).catch(() => {});
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': '120' } }
      );
    }
    if (Number(countEmailDay || 0) >= 5) {
      recordSecurityEvent({
        category: 'rate_limit',
        action: 'onboarding_request_access',
        code: 'ACCESS_REQUEST_RATE_LIMIT_EMAIL_DAY',
        status: 429,
        email,
        userId: auth.session.user.id || email,
        ip: clientIp,
        userAgent,
        details: { limit: '5/day' }
      }).catch(() => {});
      return NextResponse.json(
        { error: 'Too many requests today. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '86400' } }
      );
    }
    if (clientIp && Number(countIpDay || 0) >= 20) {
      recordSecurityEvent({
        category: 'rate_limit',
        action: 'onboarding_request_access',
        code: 'ACCESS_REQUEST_RATE_LIMIT_IP_DAY',
        status: 429,
        email,
        userId: auth.session.user.id || email,
        ip: clientIp,
        userAgent,
        details: { limit: '20/day' }
      }).catch(() => {});
      return NextResponse.json(
        { error: 'Too many requests from this network. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '86400' } }
      );
    }

    const existingPending = await db.collection('access_requests').findOne(
      { email, status: 'pending' },
      { projection: { _id: 1 } }
    );
    if (existingPending) {
      return NextResponse.json({ ok: true, status: 'pending', alreadyPending: true });
    }

    await db.collection('access_requests').insertOne({
      email,
      name: auth.session.user.name || '',
      company: String(company || '').trim().slice(0, 120),
      reason: String(reason || '').trim(),
      status: 'pending',
      createdAt: new Date(),
      clientIp: clientIp || null,
      userAgent,
      reviewedAt: null,
      reviewedBy: null,
      decisionNote: null
    });

    return NextResponse.json({ ok: true, status: 'pending' });
  } catch (error) {
    console.error('POST /api/onboarding/request-access error:', error);
    return safeErrorResponse(error, 'Failed to submit access request');
  }
}
