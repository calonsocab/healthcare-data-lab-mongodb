import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/session/heartbeat/route.js
/**
 * POST /api/session/heartbeat
 *
 * Records a session heartbeat for tracking active user sessions.
 * Should be called periodically (e.g., every 5 minutes) from the frontend.
 * This enables accurate session duration tracking and real-time active user counts.
 */
import { NextResponse } from 'next/server';
import { logSessionHeartbeat, logActivity, ActivityType } from '@/lib/db/activityLog';
import { getCoreDb } from '@/lib/db/coreDb';

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json().catch(() => ({}));
    const { currentView, sessionId } = body;

    // Get user's current team
    const db = await getCoreDb();
    const user = await db.collection('users').findOne(
      { email: session.user.email },
      { projection: { teamId: 1 } }
    );

    // Log the heartbeat
    await logSessionHeartbeat({
      userId: session.user.id || session.user.email,
      email: session.user.email,
      sessionId,
      currentView,
      teamId: user?.teamId?.toString(),
    });

    // Update last activity timestamp on user document
    await db.collection('users').updateOne(
      { email: session.user.email },
      {
        $set: {
          lastActivityAt: new Date(),
          lastView: currentView,
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/session/heartbeat error:', error);
    return NextResponse.json(
      { error: 'Failed to record heartbeat' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/session/heartbeat
 *
 * Returns current active users count for the team (users with activity in last 10 minutes)
 */
export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const db = await getCoreDb();

    // Get user's current team
    const user = await db.collection('users').findOne(
      { email: session.user.email },
      { projection: { teamId: 1 } }
    );

    if (!user?.teamId) {
      return NextResponse.json({ activeUsers: 0, isTeamMember: false });
    }

    // Count users active in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const activeCount = await db.collection('users').countDocuments({
      teamId: user.teamId,
      lastActivityAt: { $gte: tenMinutesAgo },
    });

    return NextResponse.json({
      activeUsers: activeCount,
      isTeamMember: true,
    });
  } catch (error) {
    console.error('GET /api/session/heartbeat error:', error);
    return NextResponse.json(
      { error: 'Failed to get active users' },
      { status: 500 }
    );
  }
}
