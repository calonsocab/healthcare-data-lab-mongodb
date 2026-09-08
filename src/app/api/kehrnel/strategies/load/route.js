// src/app/api/kehrnel/strategies/load/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { requirePlatformAdmin } from '@/lib/security/admin';

/**
 * POST /api/kehrnel/strategies/load
 *
 * Load a strategy pack from a path on the Kehrnel server.
 * This registers the strategy in the Kehrnel catalog.
 *
 * Body:
 * - path: string - Path to the strategy pack directory on Kehrnel server
 * - strategyId?: string - Optional strategy ID to verify against manifest
 * - connectionId?: string - Optional Kehrnel connection ID
 *
 * Returns:
 * - ok: boolean
 * - strategy: object - The loaded strategy manifest
 */
export async function POST(req) {
  try {
    const admin = await requirePlatformAdmin();
    if (!admin.ok) return admin.response;
    const session = admin.session;

    const body = await req.json();
    const { path, strategyId, connectionId } = body;

    if (!path) {
      return NextResponse.json(
        { error: 'path is required' },
        { status: 400 }
      );
    }

    const db = await getCoreDb();
    const service = createKehrnelService(db);

    // Load the strategy pack
    const result = await service.loadStrategyPack(path, strategyId, { connectionId });

    return NextResponse.json({
      ok: true,
      strategy: result.strategy || result,
      message: `Strategy loaded successfully`,
    });

  } catch (error) {
    console.error('POST /api/kehrnel/strategies/load error:', error);

    // Handle specific error types
    if (error.status) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to load strategy pack' },
      { status: 500 }
    );
  }
}
