import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireRelaxedAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';
import { getCoreDb } from '@/lib/db/coreDb';
import { hashInviteCode, normalizeInviteCode } from '@/lib/security/inviteCodes';

export async function POST(request) {
  try {
    const auth = await requireRelaxedAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const db = await getCoreDb();
    const email = String(auth.session.user.email || '').toLowerCase();
    const userId = auth.session.user.id || null;
    const { code } = await request.json().catch(() => ({}));
    const normalizedCode = normalizeInviteCode(code);
    if (!normalizedCode) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const codeHash = hashInviteCode(normalizedCode);
    const now = new Date();

    const invite = await db.collection('preview_invites').findOne(
      { email, codeHash, status: 'active' },
      { projection: { _id: 1, expiresAt: 1 } }
    );
    if (!invite) {
      return NextResponse.json({ error: 'Invite code not found or already used' }, { status: 404 });
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < now) {
      await db.collection('preview_invites').updateOne(
        { _id: invite._id },
        { $set: { status: 'expired', updatedAt: now } }
      );
      return NextResponse.json({ error: 'Invite code expired' }, { status: 410 });
    }

    const claim = await db.collection('preview_invites').updateOne(
      { _id: new ObjectId(invite._id), status: 'active' },
      {
        $set: {
          status: 'redeemed',
          updatedAt: now,
          redeemedAt: now,
          redeemedByUserId: userId,
          redeemedByEmail: email
        }
      }
    );
    if (!claim.matchedCount) {
      return NextResponse.json({ error: 'Invite code already redeemed' }, { status: 409 });
    }

    await db.collection('preview_allowlist').updateOne(
      { email },
      {
        $set: {
          email,
          status: 'approved',
          source: 'invite_code',
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );

    await db.collection('users').updateOne(
      { email },
      {
        $set: {
          accessStatus: 'active',
          accessStatusReason: null,
          updatedAt: now
        }
      }
    );

    return NextResponse.json({ ok: true, status: 'approved' });
  } catch (error) {
    console.error('POST /api/onboarding/redeem-invite error:', error);
    return safeErrorResponse(error, 'Failed to redeem invite code');
  }
}
