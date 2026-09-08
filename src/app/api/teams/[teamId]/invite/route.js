import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/teams/[teamId]/invite/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ObjectId } from 'mongodb';
import { buildInviteEmailDraft } from '@/lib/email';

export async function POST(request, props) {
  const params = await props.params;

  const {
    teamId
  } = params;

  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const team = await coreDb.collection('teams').findOne({ _id: new ObjectId(teamId) });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // verify requester is a team admin or owner
    const requester = (team.members || []).find(
      m => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!requester) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isAdmin = requester.role === 'owner' || requester.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can send invites' }, { status: 403 });
    }

    const inviteEmail = email.toLowerCase();

    // ensure invite list exists
    const pendingInvites = Array.isArray(team.pendingInvites) ? team.pendingInvites : [];
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

    const alreadyMember = (team.members || []).some(m => m.email?.toLowerCase() === inviteEmail);
    if (alreadyMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
    }

    const hasValidPending = pendingInvites.some(
      inv => inv.email?.toLowerCase() === inviteEmail &&
             inv.status === 'pending' &&
             new Date(inv.createdAt) > fifteenDaysAgo
    );
    if (!hasValidPending) {
      const invite = {
        _id: new ObjectId(),
        email: inviteEmail,
        status: 'pending',
        createdAt: new Date()
      };
      await coreDb.collection('teams').updateOne(
        { _id: team._id },
        { $push: { pendingInvites: invite }, $set: { updatedAt: new Date() } }
      );
    }

    const inviteDraft = buildInviteEmailDraft({
      to: inviteEmail,
      teamName: team.name,
      inviteCode: team.inviteCode
    });

    // No outbound email sending. Admins copy-paste the invite draft themselves.
    return NextResponse.json({
      success: true,
      emailSent: false,
      inviteCode: team.inviteCode || null,
      inviteDraft
    });
  } catch (err) {
    console.error('POST /api/teams/[teamId]/invite error:', err);
    return NextResponse.json(
      { error: 'POST /api/teams/[teamId]/invite failed', details: err.message },
      { status: 500 }
    );
  }
}
