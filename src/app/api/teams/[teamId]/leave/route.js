import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/teams/[teamId]/leave/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ObjectId } from 'mongodb';

// POST /api/teams/[teamId]/leave - Leave a team
export async function POST(_request, props) {
  const params = await props.params;

  const {
    teamId
  } = params;

  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const team = await coreDb.collection('teams').findOne({ _id: new ObjectId(teamId) });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is a member
    const member = (team.members || []).find(
      m => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!member) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 400 });
    }

    // Owner cannot leave their own team
    if (member.role === 'owner') {
      return NextResponse.json(
        { error: 'Team owner cannot leave. Transfer ownership first or delete the team.' },
        { status: 400 }
      );
    }

    // Remove member from team
    const storedEmail = member.email;
    await coreDb.collection('teams').updateOne(
      { _id: team._id },
      {
        $pull: { members: { email: storedEmail } },
        $set: { updatedAt: new Date() }
      }
    );

    // Update user to individual account
    await coreDb.collection('users').updateOne(
      { email: storedEmail },
      {
        $unset: { teamId: '' },
        $set: { accountType: 'individual', updatedAt: new Date() }
      }
    );

    return NextResponse.json({ ok: true, message: 'Successfully left the team' });
  } catch (err) {
    console.error('POST /api/teams/[teamId]/leave error:', err);
    return NextResponse.json(
      { error: 'Failed to leave team', details: err.message },
      { status: 500 }
    );
  }
}
