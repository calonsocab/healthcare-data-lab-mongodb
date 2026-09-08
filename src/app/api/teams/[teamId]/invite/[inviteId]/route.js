import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/teams/[orgId]/invite/[inviteId]/route.js
// src/app/api/teams/[orgId]/invite/[inviteId]/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ObjectId } from 'mongodb';

export async function DELETE(_req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { orgId, inviteId } = params || {};
    if (!orgId || !inviteId) {
      return NextResponse.json(
        { error: 'orgId and inviteId are required' },
        { status: 400 }
      );
    }

    const coreDb = await getCoreDb();

    const team = await coreDb.collection('teams').findOne({ _id: new ObjectId(orgId) });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    // Check if requester is admin or owner
    const requester = (team.members || []).find(
      (m) => (m.email || '').toLowerCase() === session.user.email.toLowerCase()
    );
    if (!requester) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const isAdmin = requester.role === 'owner' || requester.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can revoke invites' }, { status: 403 });
    }

    const res = await coreDb.collection('teams').updateOne(
      { _id: team._id, 'pendingInvites._id': new ObjectId(inviteId) },
      { $set: { 'pendingInvites.$.status': 'revoked', updatedAt: new Date() } }
    );

    if (!res.matchedCount) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/teams/[orgId]/invite/[inviteId] error:', err);
    return NextResponse.json(
      {
        error: 'DELETE /api/teams/[orgId]/invite/[inviteId] failed',
        details: err.message,
      },
      { status: 500 }
    );
  }
}