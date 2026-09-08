import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/teams/join-demo/route.js
// Auto-join users to the demo team (MongoDB Healthcare Data Lab) with viewer role

import { getCoreDb } from '@/lib/db/coreDb';
import { NextResponse } from 'next/server';
import { buildTeamVisibilityPayload, getTeamViewerAccess } from '@/lib/teams/teamVisibility';

// Demo team name - this team must exist in the database
const DEMO_TEAM_NAME = 'MongoDB Healthcare Data Lab';

function sanitizeEnvironments(envs = []) {
  return envs.map(({ id, name, description, database, isActive, createdAt, updatedAt, strategyLinks, kehrnel }) => ({
    id,
    name,
    description,
    database,
    isActive: !!isActive,
    createdAt,
    updatedAt,
    strategyLinks: strategyLinks || [],
    kehrnel: kehrnel || { useDefault: true, apiUrl: '' },
  }));
}

export async function POST() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const db = await getCoreDb();

    // Find the demo team
    const demoTeam = await db.collection('teams').findOne({ name: DEMO_TEAM_NAME });

    if (!demoTeam) {
      return NextResponse.json(
        { error: 'Demo team not found. Please contact support.' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMember = demoTeam.members?.find(
      m => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );

    if (!existingMember) {
      // Add user as a viewer (read-only) member
      await db.collection('teams').updateOne(
        { _id: demoTeam._id },
        {
          $push: {
            members: {
              userId: session.user.id,
              email: session.user.email,
              name: session.user.name || '',
              role: 'viewer', // Read-only role - cannot change settings
              joinedAt: new Date(),
              isDemo: true // Flag to identify demo users
            }
          }
        }
      );
    }

    // Link user to the demo team
    await db.collection('users').updateOne(
      { email: session.user.email },
      {
        $set: {
          teamId: demoTeam._id,
          accountType: 'demo',
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date(),
          email: session.user.email,
          name: session.user.name || ''
        }
      },
      { upsert: true }
    );

    const updatedDemoTeam = await db.collection('teams').findOne({ _id: demoTeam._id });
    const viewerTeam = { ...updatedDemoTeam, userRole: 'viewer' };
    const visibility = buildTeamVisibilityPayload(viewerTeam, session.user.email);
    const access = getTeamViewerAccess(viewerTeam, session.user.email);
    const safeTeam = {
      _id: updatedDemoTeam._id,
      name: updatedDemoTeam.name,
      logo: updatedDemoTeam.logo || null,
      logoIcon: updatedDemoTeam.logoIcon || null,
      theme: updatedDemoTeam.theme || null,
      environments: sanitizeEnvironments(updatedDemoTeam.environments || []),
      inviteCode: visibility.inviteCode,
      members: visibility.members,
      pendingInvites: visibility.pendingInvites,
      currentUserRole: access.currentUserRole,
      memberCount: access.memberCount,
      adminContacts: access.adminContacts,
      membersVisible: visibility.membersVisible,
      createdAt: updatedDemoTeam.createdAt,
      updatedAt: updatedDemoTeam.updatedAt,
      isDemo: true, // Flag for frontend to know this is demo mode
      userRole: 'viewer' // Tell frontend the user's role
    };

    return NextResponse.json(safeTeam);

  } catch (error) {
    console.error('POST /api/teams/join-demo error:', error);
    return NextResponse.json(
      { error: 'Failed to join demo team' },
      { status: 500 }
    );
  }
}
