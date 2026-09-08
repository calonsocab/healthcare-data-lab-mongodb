import { requireRelaxedAuthenticatedUser } from '@/lib/security/api';
// src/app/api/auth/logout/route.js
/**
 * POST /api/auth/logout
 *
 * Invalidates user's session by recording logout timestamp.
 * NextAuth JWT validation will reject tokens issued before this timestamp.
 */
import { getCoreDb } from '@/lib/db/coreDb';
import { logLogout } from '@/lib/db/activityLog';

export async function POST(request) {
  try {
    const auth = await requireRelaxedAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const db = await getCoreDb();

    // Get user's lastLoginAt to calculate session duration
    const user = await db.collection('users').findOne(
      { email: session.user.email },
      { projection: { lastLoginAt: 1 } }
    );
    const sessionDurationMs = user?.lastLoginAt
      ? Date.now() - new Date(user.lastLoginAt).getTime()
      : null;

    await db.collection('users').updateOne(
      { email: session.user.email },
      {
        $set: { lastLogoutAt: new Date() },
        $inc: { logoutCount: 1 }  // Optional: for audit trail
      }
    );

    // Log the logout event for tracking
    await logLogout({
      userId: session.user.id || session.user.email,
      email: session.user.email,
      name: session.user.name,
      sessionDurationMs,
    });

    return Response.json({
      success: true,
      message: 'Session invalidated successfully'
    });
  } catch (error) {
    console.error('POST /api/auth/logout error:', error);
    return Response.json(
      { error: 'Failed to invalidate session' },
      { status: 500 }
    );
  }
}
