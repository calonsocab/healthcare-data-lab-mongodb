// src/app/api/users/fix-incomplete/route.js
// One-time endpoint to fix incomplete individual users (missing theme/environments)

import { getCoreDb } from '@/lib/db/coreDb';
import { NextResponse } from 'next/server';
import { safeErrorResponse } from '@/lib/security/api';
import { requirePlatformAdmin } from '@/lib/security/admin';

const DEFAULT_THEME = {
  name: "Dark Mode",
  primary: "#01ec63",
  primaryHover: "#01694a",
  background: "#011e2b",
  surface: "#053e3a",
  surfaceHover: "#011e2b",
  border: "#334155",
  text: "#F1F5F9",
  textSecondary: "#e7ff98",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444"
};

export async function POST(request) {
  try {
    const admin = await requirePlatformAdmin();
    if (!admin.ok) return admin.response;
    if (process.env.ENABLE_MAINTENANCE_ENDPOINTS !== 'true') {
      return NextResponse.json({ error: 'Endpoint disabled' }, { status: 403 });
    }

    const db = admin.db || await getCoreDb();
    const usersCollection = db.collection('users');

    // Find individual users with incomplete setup
    // (accountType is 'individual' but missing theme.primary or has no environments)
    const incompleteFilter = {
      accountType: 'individual',
      $or: [
        { theme: { $exists: false } },
        { 'theme.primary': { $exists: false } },
        { environments: { $exists: false } },
        { environments: { $size: 0 } }
      ]
    };

    // Count incomplete users
    const incompleteCount = await usersCollection.countDocuments(incompleteFilter);

    if (incompleteCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No incomplete individual users found',
        fixed: 0
      });
    }

    // Get list of incomplete users for reporting
    const incompleteUsers = await usersCollection.find(incompleteFilter, {
      projection: { email: 1, name: 1, accountType: 1, theme: 1, environments: 1 }
    }).toArray();

    // Option 1: Reset them to need setup (remove accountType so they go through setup again)
    // Option 2: Give them default theme but still require environment setup

    // We'll use Option 1: Clear accountType so they go through full setup
    const result = await usersCollection.updateMany(
      incompleteFilter,
      {
        $unset: { accountType: '' },
        $set: {
          updatedAt: new Date(),
          needsSetup: true  // Flag for tracking
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: `Reset ${result.modifiedCount} incomplete individual users to require setup`,
      modifiedCount: result.modifiedCount,
      usersReset: incompleteUsers.map(u => ({
        email: u.email,
        name: u.name,
        hadTheme: !!u.theme?.primary,
        hadEnvironments: u.environments?.length > 0
      }))
    });

  } catch (error) {
    console.error('Error fixing incomplete users:', error);
    return safeErrorResponse(error, 'Failed to fix incomplete users');
  }
}

// GET to check status without modifying
export async function GET() {
  try {
    const admin = await requirePlatformAdmin();
    if (!admin.ok) return admin.response;
    if (process.env.ENABLE_MAINTENANCE_ENDPOINTS !== 'true') {
      return NextResponse.json({ error: 'Endpoint disabled' }, { status: 403 });
    }

    const db = admin.db || await getCoreDb();
    const usersCollection = db.collection('users');

    // Find individual users with incomplete setup
    const incompleteFilter = {
      accountType: 'individual',
      $or: [
        { theme: { $exists: false } },
        { 'theme.primary': { $exists: false } },
        { environments: { $exists: false } },
        { environments: { $size: 0 } }
      ]
    };

    const incompleteUsers = await usersCollection.find(incompleteFilter, {
      projection: { email: 1, name: 1, accountType: 1, theme: 1, environments: 1 }
    }).toArray();

    return NextResponse.json({
      incompleteCount: incompleteUsers.length,
      users: incompleteUsers.map(u => ({
        email: u.email,
        name: u.name,
        hasTheme: !!u.theme?.primary,
        hasEnvironments: u.environments?.length > 0
      }))
    });

  } catch (error) {
    console.error('Error checking incomplete users:', error);
    return safeErrorResponse(error, 'Failed to check incomplete users');
  }
}
