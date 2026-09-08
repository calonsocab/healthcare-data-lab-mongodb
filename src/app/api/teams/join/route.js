import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/teams/join/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { logTeamJoin, logTeamJoinFailed, logTeamJoinAttempt } from '@/lib/db/activityLog';
import { buildTeamVisibilityPayload, getTeamViewerAccess } from '@/lib/teams/teamVisibility';

function sanitizeEnvironments(envs = []) {
  return envs.map(({ id, name, description, database, domainDatabases, isActive, createdAt, updatedAt, strategyLinks, kehrnel }) => ({
    id,
    name,
    description,
    database,
    domainDatabases: domainDatabases || {},
    isActive: !!isActive,
    createdAt,
    updatedAt,
    strategyLinks: strategyLinks || [],
    kehrnel: kehrnel || { useDefault: true, apiUrl: '' }
  }));
}

function teamAllowsDirectJoin(team) {
  return team?.onboarding?.allowDirectJoin === true || team?.joinPolicy === 'open';
}

// POST /api/teams/join - Join a team with invite code or open team slug
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const normalizedEmail = session.user.email?.toLowerCase();
    const { code, slug } = await request.json();
    const normalizedSlug = slug ? String(slug).trim().toLowerCase() : null;
    if (!code && !normalizedSlug) {
      return NextResponse.json({ error: 'Invite code or team slug is required' }, { status: 400 });
    }

    const isSlugJoin = !code && !!normalizedSlug;
    const joinToken = isSlugJoin ? normalizedSlug : code.toUpperCase();

    // Log the join attempt for tracking
    await logTeamJoinAttempt({
      userId: session.user.id || session.user.email,
      email: session.user.email,
      name: session.user.name,
      inviteCode: joinToken,
      source: isSlugJoin ? 'api-slug' : 'api',
    });

    const coreDb = await getCoreDb();

    // Find team by invite code or slug
    const team = isSlugJoin
      ? await coreDb.collection('teams').findOne({ slug: normalizedSlug })
      : await coreDb.collection('teams').findOne({ inviteCode: code.toUpperCase() });
    if (!team) {
      // Log failed attempt - invalid code
      await logTeamJoinFailed({
        userId: session.user.id || session.user.email,
        email: session.user.email,
        name: session.user.name,
        inviteCode: joinToken,
        reason: isSlugJoin ? 'Invalid team slug' : 'Invalid invite code',
      });
      return NextResponse.json({ error: isSlugJoin ? 'Invalid team slug' : 'Invalid invite code' }, { status: 404 });
    }

    if (isSlugJoin && !teamAllowsDirectJoin(team)) {
      await logTeamJoinFailed({
        userId: session.user.id || session.user.email,
        email: session.user.email,
        name: session.user.name,
        inviteCode: joinToken,
        teamName: team.name,
        reason: 'Team does not allow direct join',
      });
      return NextResponse.json({ error: 'Team does not allow direct join' }, { status: 403 });
    }

    // Already a member?
    const isAlreadyMember = (team.members || []).some(
      (m) => m.email?.toLowerCase() === normalizedEmail
    );
    if (isAlreadyMember) {
      // Log failed attempt - already member
      await logTeamJoinFailed({
        userId: session.user.id || session.user.email,
        email: session.user.email,
        name: session.user.name,
        inviteCode: joinToken,
        teamName: team.name,
        reason: 'Already a member of this team',
      });
      return NextResponse.json(
        { error: 'You are already a member of this team' },
        { status: 400 }
      );
    }

    // Check if there's a pending invite for this email
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const invite = (team.pendingInvites || []).find(
      (inv) =>
        inv.email?.toLowerCase() === normalizedEmail &&
        inv.status === 'pending' &&
        new Date(inv.createdAt) > fifteenDaysAgo
    );

    // Add user to team - anyone with a valid code can join
    const newMember = {
      userId: session.user.id || session.user.email, // fallback if id missing
      email: session.user.email,
      name: session.user.name || '',
      role: 'member',
      joinedAt: new Date(),
    };

    // Update team: add member (and accept invite if one exists)
    let teamUpdateResult;
    if (invite) {
      // Accept the pending invite
      teamUpdateResult = await coreDb.collection('teams').updateOne(
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
    } else {
      // No invite needed - just add as member with valid code
      teamUpdateResult = await coreDb.collection('teams').updateOne(
        { _id: team._id },
        {
          $push: { members: newMember },
          $set: { updatedAt: new Date() },
        }
      );
    }

    // CRITICAL: Verify the team update succeeded
    if (!teamUpdateResult.modifiedCount && !teamUpdateResult.matchedCount) {
      console.error('Team member add failed - no documents modified', {
        teamId: team._id,
        email: session.user.email,
        result: teamUpdateResult,
      });
      // Log the failure
      await logTeamJoinFailed({
        userId: session.user.id || session.user.email,
        email: session.user.email,
        name: session.user.name,
        inviteCode: joinToken,
        teamName: team.name,
        reason: 'Database update failed - team document not modified',
      });
      return NextResponse.json(
        { error: 'Failed to add member to team. Please try again.' },
        { status: 500 }
      );
    }

    // Update/Upsert user document
    // Note: We no longer delete individual settings (theme/environments)
    // so users can switch back to individual mode and retain their settings
    const userUpdateResult = await coreDb.collection('users').updateOne(
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

    // Verify user update succeeded
    if (!userUpdateResult.modifiedCount && !userUpdateResult.upsertedCount && !userUpdateResult.matchedCount) {
      console.error('User update failed after team join', {
        email: session.user.email,
        result: userUpdateResult,
      });
    }

    // Double-check: Verify the member is actually in the team now
    const verifyTeam = await coreDb.collection('teams').findOne(
      { _id: team._id },
      { projection: { members: 1 } }
    );
    const memberVerified = (verifyTeam?.members || []).some(
      m => m.email?.toLowerCase() === normalizedEmail
    );
    if (!memberVerified) {
      console.error('CRITICAL: Member not found in team after update!', {
        teamId: team._id,
        email: session.user.email,
      });
      await logTeamJoinFailed({
        userId: session.user.id || session.user.email,
        email: session.user.email,
        name: session.user.name,
        inviteCode: joinToken,
        teamName: team.name,
        reason: 'Member verification failed after update',
      });
      return NextResponse.json(
        { error: 'Join verification failed. Please try again.' },
        { status: 500 }
      );
    }

    // Log successful team join
    await logTeamJoin({
      userId: session.user.id || session.user.email,
      email: session.user.email,
      name: session.user.name,
      teamId: team._id.toString(),
      teamName: team.name,
      joinMethod: invite ? 'invite_accepted' : (isSlugJoin ? 'direct_slug' : 'direct_code'),
      inviteCode: joinToken,
    });

    // Return updated team
    const updatedTeam = await coreDb.collection('teams').findOne({ _id: team._id });
    const access = getTeamViewerAccess(updatedTeam, session.user.email);
    const visibility = buildTeamVisibilityPayload(updatedTeam, session.user.email);
    return NextResponse.json({
      _id: updatedTeam._id,
      name: updatedTeam.name,
      logo: updatedTeam.logo || null,
      logoIcon: updatedTeam.logoIcon || null,
      theme: updatedTeam.theme || null,
      environments: sanitizeEnvironments(updatedTeam.environments || []),
      inviteCode: visibility.inviteCode,
      members: visibility.members,
      pendingInvites: visibility.pendingInvites,
      currentUserRole: access.currentUserRole,
      memberCount: access.memberCount,
      adminContacts: access.adminContacts,
      membersVisible: visibility.membersVisible,
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
