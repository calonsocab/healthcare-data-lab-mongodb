import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/teams/[teamId]/members/[memberId]/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ObjectId } from 'mongodb';

// DELETE - Remove a member from the team (memberId is actually the email, URL encoded)
export async function DELETE(_req, props) {
  const params = await props.params;

  const {
    teamId,
    memberId
  } = params;

  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const memberEmailParam = decodeURIComponent(memberId);
    const memberEmail = memberEmailParam.toLowerCase();
    const coreDb = await getCoreDb();
    const team = await coreDb.collection('teams').findOne({ _id: new ObjectId(teamId) });
    if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Check if requester is admin/owner
    const requester = (team.members || []).find(
      m => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!requester) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isAdmin = requester.role === 'owner' || requester.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 });
    }

    // Find the member to remove
    const memberToRemove = (team.members || []).find(
      m => m.email?.toLowerCase() === memberEmail
    );
    if (!memberToRemove) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent removing owner
    if (memberToRemove.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the team owner' }, { status: 400 });
    }

    const storedEmail = memberToRemove.email;
    // Remove member from team
    await coreDb.collection('teams').updateOne(
      { _id: team._id },
      {
        $pull: { members: { email: storedEmail } },
        $set: { updatedAt: new Date() }
      }
    );

    // Clear user's teamId and revert to individual account
    await coreDb.collection('users').updateOne(
      { email: storedEmail },
      {
        $unset: { teamId: '' },
        $set: { accountType: 'individual', updatedAt: new Date() }
      }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/teams/[teamId]/members/[memberId] error:', err);
    return NextResponse.json(
      { error: 'DELETE /api/teams/[teamId]/members/[memberId] failed', details: err.message },
      { status: 500 }
    );
  }
}

// PUT - Update member role (memberId is the email, URL encoded)
export async function PUT(request, props) {
  const params = await props.params;

  const {
    teamId,
    memberId
  } = params;

  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const memberEmailParam = decodeURIComponent(memberId);
    const memberEmail = memberEmailParam.toLowerCase();
    const { role } = await request.json();

    if (!role || !['member', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const team = await coreDb.collection('teams').findOne({ _id: new ObjectId(teamId) });
    if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Check if requester is admin/owner
    const requester = (team.members || []).find(
      m => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!requester) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isAdmin = requester.role === 'owner' || requester.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can change roles' }, { status: 403 });
    }

    // Find the member to update
    const memberToUpdate = (team.members || []).find(
      m => m.email?.toLowerCase() === memberEmail
    );
    if (!memberToUpdate) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot change owner's role
    if (memberToUpdate.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
    }

    // Update member role
    await coreDb.collection('teams').updateOne(
      { _id: team._id, 'members.email': memberToUpdate.email },
      {
        $set: {
          'members.$.role': role,
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({ ok: true, role });
  } catch (err) {
    console.error('PUT /api/teams/[teamId]/members/[memberId] error:', err);
    return NextResponse.json(
      { error: 'PUT /api/teams/[teamId]/members/[memberId] failed', details: err.message },
      { status: 500 }
    );
  }
}
