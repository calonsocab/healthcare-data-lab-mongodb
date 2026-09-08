import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/users/tos-acceptance/route.js
import { getCoreDb } from '@/lib/db/coreDb';

/**
 * POST /api/users/tos-acceptance
 * Records user's acceptance of Terms of Service
 *
 * Body: { version: string, acceptedAt: ISO string }
 */
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const { version, acceptedAt } = body;

    if (!version || !acceptedAt) {
      return Response.json(
        { error: 'Missing required fields: version, acceptedAt' },
        { status: 400 }
      );
    }

    const db = await getCoreDb();

    // Get client info from headers
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

    // Update user with ToS acceptance record
    const result = await db.collection('users').updateOne(
      { email: session.user.email },
      {
        $set: {
          tosAcceptance: {
            version,
            acceptedAt: new Date(acceptedAt),
            recordedAt: new Date(),
            ipAddress,
            userAgent
          },
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      message: 'Terms of Service acceptance recorded',
      data: {
        version,
        acceptedAt,
        recordedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('ToS acceptance error:', error);
    return Response.json(
      { error: 'Failed to record ToS acceptance' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/tos-acceptance
 * Returns current user's ToS acceptance status
 */
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const db = await getCoreDb();
    const user = await db.collection('users').findOne(
      { email: session.user.email },
      { projection: { tosAcceptance: 1 } }
    );

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({
      hasAccepted: !!user.tosAcceptance,
      tosAcceptance: user.tosAcceptance || null
    });

  } catch (error) {
    console.error('ToS acceptance check error:', error);
    return Response.json(
      { error: 'Failed to check ToS acceptance' },
      { status: 500 }
    );
  }
}
