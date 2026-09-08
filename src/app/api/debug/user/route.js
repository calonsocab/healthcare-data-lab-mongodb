import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/debug/user/route.js
export const dynamic = 'force-dynamic';

import { getCoreDb } from '@/lib/db/coreDb';

const DEFAULT_THEME = {
  name: "Dark Mode",
  primary: "#01ec63",
  primaryHover: "#01694a",
  background: "#011e2b",
  surface: "#053e3a",
  surfaceHover: "#011e2b",
  border: "#334155",
  text: "#F1F5F9",
  textSecondary: "#9CA3AF", // Improved contrast ratio on dark surfaces
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444"
};

export async function GET() {
  try {
    if (process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') {
      return Response.json({ error: 'Endpoint disabled' }, { status: 403 });
    }
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const db = await getCoreDb();
    const user = await db.collection('users').findOne({ email: session.user.email });

    let team = null;
    if (user?.teamId) {
      team = await db.collection('teams').findOne({ _id: user.teamId });
    }

    // Analysis of user state
    const analysis = {
      accountType: user?.accountType || null,
      hasTheme: !!user?.theme?.primary,
      hasEnvironments: (user?.environments?.length || 0) > 0,
      hasTeam: !!user?.teamId,
      needsSetup: user?.accountType === 'individual' && !user?.theme?.primary && !(user?.environments?.length > 0),
      willSeeSetupScreen: !user?.accountType || (user?.accountType === 'individual' && !user?.theme?.primary && !(user?.environments?.length > 0))
    };

    return Response.json({
      session: {
        email: session.user.email,
        name: session.user.name,
        id: session.user.id,
      },
      user: user || 'No user document found',
      team: team || 'No team found',
      analysis,
      activeEnvironment:
        team?.environments?.find(e => e.isActive) ??
        user?.environments?.find(e => e.isActive) ??
        null,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST to force user through setup or apply default theme
export async function POST(request) {
  try {
    if (process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') {
      return Response.json({ error: 'Endpoint disabled' }, { status: 403 });
    }
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const { action } = body;
    const db = await getCoreDb();

    if (action === 'force-setup') {
      // Remove accountType so user goes through full setup
      const result = await db.collection('users').updateOne(
        { email: session.user.email },
        {
          $unset: { accountType: '', theme: '', environments: '' },
          $set: { updatedAt: new Date() }
        }
      );
      return Response.json({
        success: true,
        action: 'force-setup',
        message: 'User will see account type selection on next login',
        modifiedCount: result.modifiedCount
      });
    }

    if (action === 'apply-default-theme') {
      // Apply default dark theme
      const result = await db.collection('users').updateOne(
        { email: session.user.email },
        {
          $set: {
            theme: DEFAULT_THEME,
            updatedAt: new Date()
          }
        }
      );
      return Response.json({
        success: true,
        action: 'apply-default-theme',
        message: 'Dark theme applied. Refresh the page.',
        modifiedCount: result.modifiedCount
      });
    }

    return Response.json({
      error: 'Invalid action',
      validActions: ['force-setup', 'apply-default-theme']
    }, { status: 400 });

  } catch (error) {
    console.error('Debug POST error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
