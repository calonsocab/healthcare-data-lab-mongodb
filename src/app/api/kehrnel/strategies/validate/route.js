// src/app/api/kehrnel/strategies/validate/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { requirePlatformAdmin } from '@/lib/security/admin';

/**
 * POST /api/kehrnel/strategies/validate
 *
 * Validate a strategy pack before deploying.
 * Checks the manifest structure and returns a preview.
 *
 * Body:
 * - path: string - Path to the strategy pack directory on Kehrnel server
 * - connectionId?: string - Optional Kehrnel connection ID
 *
 * Returns:
 * - valid: boolean
 * - manifest: object - The parsed manifest
 * - files: string[] - List of files found in the pack
 * - warnings: string[] - Any validation warnings
 */
export async function POST(req) {
  try {
    const admin = await requirePlatformAdmin();
    if (!admin.ok) return admin.response;

    const body = await req.json();
    const { path, connectionId } = body;

    if (!path) {
      return NextResponse.json(
        { error: 'path is required' },
        { status: 400 }
      );
    }

    const db = await getCoreDb();
    const service = createKehrnelService(db);

    // Validate the strategy pack
    const result = await service.validateStrategyPack(path, { connectionId });

    return NextResponse.json({
      valid: true,
      manifest: result.manifest,
      files: result.files || [],
      warnings: result.warnings || [],
    });

  } catch (error) {
    console.error('POST /api/kehrnel/strategies/validate error:', error);

    // Handle specific error types
    if (error.status) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to validate strategy pack' },
      { status: 500 }
    );
  }
}
