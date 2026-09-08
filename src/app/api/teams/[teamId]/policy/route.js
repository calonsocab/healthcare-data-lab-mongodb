import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ObjectId } from 'mongodb';
import { normalizeTeamPolicy } from '@/lib/security/teamPolicy';

function isAdminRole(role) {
  return role === 'owner' || role === 'admin';
}

function toTeamQuery(teamId) {
  if (ObjectId.isValid(teamId)) {
    return { _id: new ObjectId(teamId) };
  }
  return { _id: teamId };
}

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

    const requester = (team.members || []).find(
      (m) => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!requester) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      teamId: team._id,
      role: requester.role || 'member',
      policy: normalizeTeamPolicy(team.policy)
    });
  } catch (error) {
    console.error('GET /api/teams/[teamId]/policy error:', error);
    return NextResponse.json({ error: 'Failed to fetch team policy' }, { status: 500 });
  }
}

export async function PUT(request, props) {
  const params = await props.params;

  const {
    teamId
  } = params;

  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const coreDb = await getCoreDb();
    const team = await coreDb.collection('teams').findOne(toTeamQuery(teamId));
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const requester = (team.members || []).find(
      (m) => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!requester || !isAdminRole(requester.role)) {
      return NextResponse.json({ error: 'Only admins can update team policy' }, { status: 403 });
    }

    const nowIso = new Date().toISOString();
    const normalized = normalizeTeamPolicy(body?.policy);
    await coreDb.collection('teams').updateOne(
      { _id: team._id },
      {
        $set: {
          policy: {
            ...normalized,
            updatedAt: nowIso,
            updatedBy: session.user.email
          },
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      policy: {
        ...normalized,
        updatedAt: nowIso,
        updatedBy: session.user.email
      }
    });
  } catch (error) {
    console.error('PUT /api/teams/[teamId]/policy error:', error);
    return NextResponse.json({ error: 'Failed to update team policy' }, { status: 500 });
  }
}
