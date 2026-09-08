import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/strategies/[strategyId]/spec/route.js
/**
 * Kehrnel Strategy Spec Proxy
 *
 * Fetches the full spec.json for a specific strategy from Kehrnel.
 * This endpoint returns the complete strategy specification including
 * all configuration options, schema definitions, and operational details.
 */
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '../../../../../../lib/db/coreDb.js';
import { createKehrnelService } from '../../../../../../lib/kehrnel/KehrnelService.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kehrnel/strategies/[strategyId]/spec
 *
 * Fetch the full spec.json for a strategy from Kehrnel.
 *
 * Path params:
 *   - strategyId: Kehrnel strategy ID (e.g., 'openehr.rps_dual')
 *
 * Query params:
 *   - connectionId: specific Kehrnel instance (optional)
 *
 * Returns:
 *   - strategy_id: The strategy ID
 *   - spec: Full spec.json content
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

    // First try the /spec endpoint, if it fails, fall back to /strategies/{id}
    let result;
    try {
      result = await service.getStrategySpec(strategyId, { connectionId });
    } catch (specError) {
      // Fall back to getting the full strategy (which may include spec data)
      console.log(`/spec endpoint not available, falling back to /strategies/${strategyId}`);
      const strategy = await service.getStrategy(strategyId, { connectionId });

      // The strategy response IS the spec - return it as-is
      result = {
        strategy_id: strategyId,
        spec: strategy
      };
    }

    return NextResponse.json({
      strategy_id: result.strategy_id || strategyId,
      spec: result.spec,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`GET /api/kehrnel/strategies/${params?.strategyId}/spec error:`, error);

    const message = error.message?.includes('Kehrnel')
      ? `Failed to fetch spec for strategy from Kehrnel`
      : (error.message || 'Failed to fetch strategy spec');

    return NextResponse.json(
      { error: message },
      { status: error.status || 500 }
    );
  }
}
