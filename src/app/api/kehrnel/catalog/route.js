import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/catalog/route.js
/**
 * Kehrnel Strategy Catalog Proxy
 *
 * Fetches strategy catalog from Kehrnel without exposing API keys to clients.
 * Returns strategy manifests with ops, capabilities, and version info.
 */
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '../../../../lib/db/coreDb.js';
import { createKehrnelService } from '../../../../lib/kehrnel/KehrnelService.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kehrnel/catalog
 *
 * Fetch strategy catalog from Kehrnel.
 *
 * Query params:
 *   - connectionId: specific Kehrnel instance (optional)
 *
 * Returns:
 *   - strategies: Array of strategy manifests
 *   - source: Connection name
 *   - connectionId: Connection used
 *   - fetchedAt: Timestamp
 */
export async function GET(req) {
  try {
    let session = { user: { email: 'test@example.com' } };
    if (!isTestModeBypassEnabled()) {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
      session = auth.session;
    }

    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connectionId');
    const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('forceRefresh') === 'true';

    const db = await getCoreDb();
    const service = createKehrnelService(db);

    const result = await service.listStrategies({ connectionId, forceRefresh });

    return NextResponse.json({
      strategies: result.strategies,
      source: result.source,
      connectionId: result.connectionId,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET /api/kehrnel/catalog error:', error);

    // Don't expose internal Kehrnel URL in error messages
    const message = error.message?.includes('Kehrnel')
      ? 'Failed to fetch strategy catalog from Kehrnel'
      : (error.message || 'Failed to fetch catalog');

    return NextResponse.json(
      { error: message },
      { status: error.status || 500 }
    );
  }
}
