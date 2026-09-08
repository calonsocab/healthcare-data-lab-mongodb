import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/teams/[teamId]/diagnostics/route.js
/**
 * GET /api/teams/[teamId]/diagnostics
 *
 * Diagnostic endpoint to find users who:
 * 1. Have this team's teamId in their user document
 * 2. But are NOT in the team.members array
 *
 * This helps identify the discrepancy between users who "joined" the team
 * but weren't properly added to the members array.
 *
 * POST /api/teams/[teamId]/diagnostics
 *
 * Reconcile missing members - add users who have teamId but aren't in members array
 */
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ObjectId } from 'mongodb';
import { logActivity } from '@/lib/db/activityLog';

export async function GET(_request, { params }) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { teamId } = await params;
    const coreDb = await getCoreDb();

    // Get the team
    const team = await coreDb.collection('teams').findOne({ _id: new ObjectId(teamId) });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is admin/owner
    const currentMember = (team.members || []).find(
      m => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all team member emails (normalized)
    const memberEmails = new Set(
      (team.members || []).map(m => m.email?.toLowerCase()).filter(Boolean)
    );

    // Find users who have this teamId but aren't in members array
    const missingUsers = await coreDb.collection('users').find({
      teamId: team._id,
      email: { $nin: Array.from(memberEmails) }
    }).toArray();

    // Find users who logged in recently (last 30 days) but have no teamId
    // These might be users who started the join flow but didn't complete it
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentUnassignedUsers = await coreDb.collection('users').find({
      teamId: { $exists: false },
      lastLoginAt: { $gte: thirtyDaysAgo }
    }).project({
      email: 1,
      name: 1,
      lastLoginAt: 1,
      createdAt: 1,
      accountType: 1
    }).limit(100).toArray();

    // Get activity log stats for join attempts
    const joinAttemptStats = await coreDb.collection('activity_logs').aggregate([
      {
        $match: {
          teamId: teamId,
          type: { $in: ['team_join_attempt', 'team_join', 'team_join_failed', 'team_code_validated'] },
          timestamp: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          emails: { $addToSet: '$email' }
        }
      }
    ]).toArray();

    // Find users who validated code but never completed join
    const validatedEmails = joinAttemptStats.find(s => s._id === 'team_code_validated')?.emails || [];
    const joinedEmails = new Set(joinAttemptStats.find(s => s._id === 'team_join')?.emails || []);
    const validatedButNotJoined = validatedEmails.filter(email => !joinedEmails.has(email));

    return NextResponse.json({
      team: {
        id: team._id,
        name: team.name,
        memberCount: team.members?.length || 0,
      },
      diagnostics: {
        // Users who have teamId set but aren't in members array (BUG!)
        missingFromMembersArray: missingUsers.map(u => ({
          email: u.email,
          name: u.name,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
        })),
        missingCount: missingUsers.length,

        // Users who validated the code but never completed join
        validatedButNotJoined: validatedButNotJoined,
        validatedButNotJoinedCount: validatedButNotJoined.length,

        // Recent users with no team assignment
        recentUnassignedUsers: recentUnassignedUsers,
        recentUnassignedCount: recentUnassignedUsers.length,

        // Join funnel stats
        joinFunnel: {
          codeValidations: joinAttemptStats.find(s => s._id === 'team_code_validated')?.count || 0,
          joinAttempts: joinAttemptStats.find(s => s._id === 'team_join_attempt')?.count || 0,
          successfulJoins: joinAttemptStats.find(s => s._id === 'team_join')?.count || 0,
          failedJoins: joinAttemptStats.find(s => s._id === 'team_join_failed')?.count || 0,
        },
      },
      actions: {
        reconcileUrl: `/api/teams/${teamId}/diagnostics`,
        reconcileMethod: 'POST',
        description: 'POST to this endpoint to add missing users to the members array',
      }
    });
  } catch (err) {
    console.error('GET /api/teams/[teamId]/diagnostics error:', err);
    return NextResponse.json(
      { error: 'Diagnostics failed', details: err.message },
      { status: 500 }
    );
  }
}

// POST - Reconcile missing members
export async function POST(request, { params }) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { teamId } = await params;
    const coreDb = await getCoreDb();

    // Get the team
    const team = await coreDb.collection('teams').findOne({ _id: new ObjectId(teamId) });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is admin/owner
    const currentMember = (team.members || []).find(
      m => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all team member emails (normalized)
    const memberEmails = new Set(
      (team.members || []).map(m => m.email?.toLowerCase()).filter(Boolean)
    );

    // Find users who have this teamId but aren't in members array
    const missingUsers = await coreDb.collection('users').find({
      teamId: team._id,
      email: { $nin: Array.from(memberEmails) }
    }).toArray();

    if (missingUsers.length === 0) {
      return NextResponse.json({
        message: 'No missing members to reconcile',
        reconciled: 0,
      });
    }

    // Add missing users to the members array
    const newMembers = missingUsers.map(user => ({
      userId: user._id?.toString() || user.email,
      email: user.email,
      name: user.name || '',
      role: 'member',
      joinedAt: user.createdAt || new Date(),
      reconciledAt: new Date(), // Mark as reconciled
    }));

    await coreDb.collection('teams').updateOne(
      { _id: team._id },
      {
        $push: { members: { $each: newMembers } },
        $set: { updatedAt: new Date() },
      }
    );

    // Log the reconciliation
    await logActivity({
      type: 'team_members_reconciled',
      userId: session.user.id || session.user.email,
      email: session.user.email,
      name: session.user.name,
      teamId: team._id.toString(),
      teamName: team.name,
      metadata: {
        reconciledCount: newMembers.length,
        reconciledEmails: newMembers.map(m => m.email),
        performedBy: session.user.email,
      },
    });

    return NextResponse.json({
      message: `Successfully reconciled ${newMembers.length} missing members`,
      reconciled: newMembers.length,
      members: newMembers.map(m => ({ email: m.email, name: m.name })),
    });
  } catch (err) {
    console.error('POST /api/teams/[teamId]/diagnostics error:', err);
    return NextResponse.json(
      { error: 'Reconciliation failed', details: err.message },
      { status: 500 }
    );
  }
}
