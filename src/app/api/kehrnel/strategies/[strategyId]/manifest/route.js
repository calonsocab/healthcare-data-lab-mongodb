import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/strategies/[strategyId]/manifest/route.js
/**
 * Kehrnel Strategy Manifest Proxy
 *
 * Fetches the raw strategy manifest from Kehrnel so UI mappings can be verified.
 */
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '../../../../../../lib/db/coreDb.js';
import { createKehrnelService } from '../../../../../../lib/kehrnel/KehrnelService.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kehrnel/strategies/[strategyId]/manifest
 *
 * Query params:
 *   - connectionId: specific Kehrnel instance (optional)
 *
 * Returns:
 *   - strategy_id
 *   - manifest
 *   - docs_url (manifest.ui.links.docs)
 */
export async function GET(req, props) {
  const params = await props.params;
  try {
    let session = { user: { email: 'test@example.com' } };
    if (!isTestModeBypassEnabled()) {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
      session = auth.session;
    }

    const { strategyId } = await params;
    if (!strategyId) {
      return NextResponse.json({ error: 'strategyId is required' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connectionId');

    const db = await getCoreDb();
    const service = createKehrnelService(db);
    const manifest = await service.getStrategy(strategyId, { connectionId });

    return NextResponse.json({
      strategy_id: strategyId,
      manifest,
      docs_url: manifest?.ui?.links?.docs || null,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`GET /api/kehrnel/strategies/${params?.strategyId}/manifest error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch strategy manifest' },
      { status: error.status || 500 }
    );
  }
}

