import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/teams/[teamId]/team/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ObjectId } from 'mongodb';
import { normalizeTeamPolicy } from '@/lib/security/teamPolicy';
import { buildTeamVisibilityPayload, getTeamViewerAccess } from '@/lib/teams/teamVisibility';

function toTeamQuery(teamId) {
  if (ObjectId.isValid(teamId)) {
    return { _id: new ObjectId(teamId) };
  }
  return { _id: teamId };
}

// GET /api/teams/[teamId]/team - Get team details (for team management UI)
export async function GET(_request, props) {
  const params = await props.params;

  const {
    teamId
  } = params;

  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const team = await coreDb.collection('teams').findOne(toTeamQuery(teamId));

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Verify user is a member
    const isMember = (team.members || []).some(
      m => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const access = getTeamViewerAccess(team, session.user.email);
    const visibility = buildTeamVisibilityPayload(team, session.user.email);

    // Return team data without sensitive info (connection strings)
    return NextResponse.json({
      _id: team._id,
      name: team.name,
      policy: normalizeTeamPolicy(team.policy),
      inviteCode: visibility.inviteCode,
      members: visibility.members,
      pendingInvites: visibility.pendingInvites,
      currentUserRole: access.currentUserRole,
      memberCount: access.memberCount,
      adminContacts: access.adminContacts,
      membersVisible: visibility.membersVisible,
      ownerUserId: team.ownerUserId,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    });
  } catch (err) {
    console.error('GET /api/teams/[teamId]/team error:', err);
    return NextResponse.json(
      { error: 'GET /api/teams/[teamId]/team failed', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();

    // Find team by invite code
    const team = await coreDb.collection('teams').findOne({ inviteCode: code.toUpperCase() });
    if (!team) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Already a member?
    const normalizedEmail = session.user.email?.toLowerCase();
    const already = (team.members || []).some(
      m => m.email?.toLowerCase() === normalizedEmail
    );
    if (already) {
      return NextResponse.json({ error: 'You are already a member of this team' }, { status: 400 });
    }

    // Valid pending invite (15 days)
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const invite = (team.pendingInvites || []).find(
      inv =>
        inv.email?.toLowerCase() === normalizedEmail &&
        inv.status === 'pending' &&
        new Date(inv.createdAt) > fifteenDaysAgo
    );

    if (!invite) {
      return NextResponse.json(
        { error: 'No valid invite found for your email address' },
        { status: 403 }
      );
    }

    // Add user to team
    const newMember = {
      userId: session.user.id || session.user.email, // fallback if no id
      email: session.user.email,
      name: session.user.name || '',
      role: 'member',
      joinedAt: new Date(),
    };

    // Update team (accept invite + add member)
    await coreDb.collection('teams').updateOne(
      { _id: team._id, 'pendingInvites._id': invite._id },
      {
        $push: { members: newMember },
        $set: {
          'pendingInvites.$.status': 'accepted',
          'pendingInvites.$.acceptedAt': new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Update/Upsert user profile
    // Note: We no longer delete individual settings so users can switch back
    await coreDb.collection('users').updateOne(
      { email: session.user.email },
      {
        $set: {
          teamId: team._id,
          accountType: 'team',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          email: session.user.email,
          name: session.user.name || '',
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    const updatedTeam = await coreDb.collection('teams').findOne({ _id: team._id });
    const access = getTeamViewerAccess(updatedTeam, session.user.email);
    const visibility = buildTeamVisibilityPayload(updatedTeam, session.user.email);
    return NextResponse.json({
      _id: updatedTeam._id,
      name: updatedTeam.name,
      policy: normalizeTeamPolicy(updatedTeam.policy),
      inviteCode: visibility.inviteCode,
      members: visibility.members,
      pendingInvites: visibility.pendingInvites,
      currentUserRole: access.currentUserRole,
      memberCount: access.memberCount,
      adminContacts: access.adminContacts,
      membersVisible: visibility.membersVisible,
      ownerUserId: updatedTeam.ownerUserId,
      createdAt: updatedTeam.createdAt,
      updatedAt: updatedTeam.updatedAt
    });
  } catch (err) {
    console.error('POST /api/teams/join error:', err);
    return NextResponse.json(
      { error: 'POST /api/teams/join failed', details: err.message },
      { status: 500 }
    );
  }
}
