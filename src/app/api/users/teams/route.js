import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/users/teams/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { escapeRegex } from '@/lib/utils';

// GET /api/users/teams - Get all teams the user belongs to
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();

    // Find all teams where the user is a member (escaped for regex safety)
    const escapedEmail = escapeRegex(session.user.email);
    const teams = await coreDb.collection('teams').find({
      'members.email': { $regex: new RegExp(`^${escapedEmail}$`, 'i') }
    }).toArray();

    // Get user's current active team
    const user = await coreDb.collection('users').findOne({ email: session.user.email });
    const activeTeamId = user?.teamId?.toString() || null;

    // Sanitize team data (don't expose connection strings)
    const sanitizedTeams = teams.map(team => {
      const userMember = team.members.find(
        m => m.email?.toLowerCase() === session.user.email.toLowerCase()
      );
      const userRole = String(userMember?.role || 'member').trim().toLowerCase();
      const isAdmin = userRole === 'owner' || userRole === 'admin';

      return {
        _id: team._id,
        name: team.name,
        logo: team.logo || null,
        logoIcon: team.logoIcon || null,
        inviteCode: isAdmin ? team.inviteCode : '',
        memberCount: team.members?.length || 0,
        userRole,
        isActive: team._id.toString() === activeTeamId,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      };
    });

    return NextResponse.json({
      teams: sanitizedTeams,
      activeTeamId,
      accountType: user?.accountType || 'individual'
    });
  } catch (err) {
    console.error('GET /api/users/teams error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch teams', details: err.message },
      { status: 500 }
    );
  }
}

// POST /api/users/teams/switch - Switch active team
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { teamId } = await request.json();
    const coreDb = await getCoreDb();

    if (teamId === null || teamId === 'individual') {
      // Switch to individual mode
      await coreDb.collection('users').updateOne(
        { email: session.user.email },
        {
          $unset: { teamId: '' },
          $set: { accountType: 'individual', updatedAt: new Date() }
        }
      );

      return NextResponse.json({ ok: true, accountType: 'individual', teamId: null });
    }

    // Switch to a specific team
    const { ObjectId } = await import('mongodb');
    const team = await coreDb.collection('teams').findOne({ _id: new ObjectId(teamId) });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Verify user is a member of this team
    const isMember = (team.members || []).some(
      m => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }

    // Update user's active team
    await coreDb.collection('users').updateOne(
      { email: session.user.email },
      {
        $set: {
          teamId: team._id,
          accountType: 'team',
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      ok: true,
      accountType: 'team',
      teamId: team._id.toString(),
      teamName: team.name
    });
  } catch (err) {
    console.error('POST /api/users/teams error:', err);
    return NextResponse.json(
      { error: 'Failed to switch team', details: err.message },
      { status: 500 }
    );
  }
}
