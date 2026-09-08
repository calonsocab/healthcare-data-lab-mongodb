// src/app/api/teams/update-themes/route.js
// One-time endpoint to update all team themes (excluding specific teams)

import { getCoreDb } from '@/lib/db/coreDb';
import { NextResponse } from 'next/server';
import { safeErrorResponse } from '@/lib/security/api';
import { requirePlatformAdmin } from '@/lib/security/admin';

const NEW_THEME = {
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

const EXCLUDED_TEAMS = [
  "Gustave Roussy Clinical Rep."
];

export async function POST(request) {
  try {
    const admin = await requirePlatformAdmin();
    if (!admin.ok) return admin.response;
    if (process.env.ENABLE_MAINTENANCE_ENDPOINTS !== 'true') {
      return NextResponse.json({ error: 'Endpoint disabled' }, { status: 403 });
    }

    const db = admin.db || await getCoreDb();
    const teamsCollection = db.collection('teams');

    // Find all teams that are NOT in the excluded list
    const filter = {
      name: { $nin: EXCLUDED_TEAMS }
    };

    // Count teams to be updated
    const countBefore = await teamsCollection.countDocuments(filter);

    if (countBefore === 0) {
      return NextResponse.json({
        success: true,
        message: 'No teams to update',
        modifiedCount: 0,
        updatedTeams: []
      });
    }

    // Update all matching teams
    const result = await teamsCollection.updateMany(
      filter,
      {
        $set: {
          theme: NEW_THEME,
          updatedAt: new Date()
        }
      }
    );

    // List updated teams
    const updatedTeams = await teamsCollection.find(filter, { projection: { name: 1 } }).toArray();
    const teamNames = updatedTeams.map(t => t.name);

    return NextResponse.json({
      success: true,
      message: `Updated ${result.modifiedCount} teams with new theme`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      excludedTeams: EXCLUDED_TEAMS,
      updatedTeams: teamNames
    });

  } catch (error) {
    console.error('Error updating team themes:', error);
    return safeErrorResponse(error, 'Failed to update team themes');
  }
}
