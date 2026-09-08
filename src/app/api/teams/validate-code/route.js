// src/app/api/teams/validate-code/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';
import { logActivity, ActivityType } from '@/lib/db/activityLog';

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { code, email } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();

    // Find team by invite code
    const team = await coreDb.collection('teams').findOne({ inviteCode: code.toUpperCase() });
    if (!team) {
      return NextResponse.json({ valid: false, error: 'Invalid code' });
    }

    // If email provided, check for pending invite within 15 days
    let hasPendingInvite = false;
    if (email) {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      hasPendingInvite = (team.pendingInvites || []).some(
        inv =>
          inv.email?.toLowerCase() === email.toLowerCase() &&
          inv.status === 'pending' &&
          new Date(inv.createdAt) > fifteenDaysAgo
      );
    }

    // Log successful validation (helps track users who validate but don't complete join)
    await logActivity({
      type: 'team_code_validated',
      userId: auth.user?.id || auth.user?.email,
      email: auth.user?.email,
      name: auth.user?.name,
      teamId: team._id.toString(),
      teamName: team.name,
      metadata: {
        inviteCode: code.toUpperCase(),
        hasPendingInvite,
      },
    });

    return NextResponse.json({
      valid: true,
      teamName: team.name,
      hasPendingInvite
    });
  } catch (err) {
    console.error('POST /api/teams/validate-code error:', err);
    return safeErrorResponse(err, 'POST /api/teams/validate-code failed');
  }
}
