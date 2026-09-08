// src/app/api/kehrnel/engines/route.js
/**
 * Data Model Engines API
 *
 * Provides access to the registry of available data model engines
 * and validation capabilities for strategy-engine compatibility.
 */
import { NextResponse } from 'next/server';
import {
  getAllDataModelEngines,
  getDataModelEngine,
  getEnginesForStrategy,
  getEnginesByDomain,
  validateEngineForStrategy,
  getEngineDictionaries,
  getRecommendedEngine
} from '@/lib/kehrnel/engines';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kehrnel/engines
 *
 * Returns all available data model engines or filtered by domain/strategy
 *
 * Query params:
 * - domain: Filter by domain (e.g., 'openEHR', 'FHIR')
 * - strategyId: Filter by compatible strategy blueprint ID
 */
export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');
    const strategyId = searchParams.get('strategyId');

    let engines;

    if (strategyId) {
      engines = getEnginesForStrategy(strategyId);
    } else if (domain) {
      engines = getEnginesByDomain(domain);
    } else {
      engines = getAllDataModelEngines();
    }

    // Group by domain for easier UI consumption
    const byDomain = engines.reduce((acc, engine) => {
      const dom = engine.domain?.[0] || 'Other';
      if (!acc[dom]) acc[dom] = [];
      acc[dom].push(engine);
      return acc;
    }, {});

    return NextResponse.json({
      engines,
      byDomain,
      total: engines.length
    });
  } catch (error) {
    console.error('GET /api/kehrnel/engines error:', error);
    return safeErrorResponse(error, 'Failed to fetch engines');
  }
}

/**
 * POST /api/kehrnel/engines/validate
 *
 * Validate if a specific engine is compatible with a strategy configuration
 *
 * Body:
 * - engineId: Engine identifier (e.g., 'transform.rps')
 * - strategy: Full strategy document or just blueprint/config portions
 */
export async function POST(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { engineId, strategy, action } = body;

    // Handle different actions
    switch (action) {
      case 'validate': {
        if (!engineId) {
          return NextResponse.json(
            { error: 'engineId is required for validation' },
            { status: 400 }
          );
        }
        if (!strategy) {
          return NextResponse.json(
            { error: 'strategy is required for validation' },
            { status: 400 }
          );
        }

        const validation = validateEngineForStrategy(engineId, strategy);

        return NextResponse.json({
          ...validation,
          engineId,
          strategyId: strategy.blueprint?.id || strategy._id?.toString()
        });
      }

      case 'recommend': {
        if (!strategy) {
          return NextResponse.json(
            { error: 'strategy is required for recommendation' },
            { status: 400 }
          );
        }

        const recommended = getRecommendedEngine(strategy);

        if (!recommended) {
          return NextResponse.json({
            recommended: null,
            message: 'No compatible engine found for this strategy'
          });
        }

        // Also validate the recommended engine
        const validation = validateEngineForStrategy(recommended.id, strategy);

        return NextResponse.json({
          recommended: {
            id: recommended.id,
            name: recommended.name,
            module: recommended.module,
            description: recommended.description,
            capabilities: recommended.capabilities
          },
          validation,
          strategyId: strategy.blueprint?.id || strategy._id?.toString()
        });
      }

      case 'dictionaries': {
        if (!engineId) {
          return NextResponse.json(
            { error: 'engineId is required for dictionaries lookup' },
            { status: 400 }
          );
        }

        const dictionaries = getEngineDictionaries(engineId);
        const engine = getDataModelEngine(engineId);

        return NextResponse.json({
          engineId,
          engineName: engine?.name,
          dictionaries,
          hasShortcuts: !!dictionaries.shortcuts,
          hasArcodes: !!dictionaries.arcodes
        });
      }

      case 'details': {
        if (!engineId) {
          return NextResponse.json(
            { error: 'engineId is required for details' },
            { status: 400 }
          );
        }

        const engine = getDataModelEngine(engineId);

        if (!engine) {
          return NextResponse.json(
            { error: `Engine '${engineId}' not found` },
            { status: 404 }
          );
        }

        return NextResponse.json({
          engine,
          operations: Object.entries(engine.operations || {}).map(([key, op]) => ({
            id: key,
            ...op
          })),
          dictionaries: engine.dictionaries || {},
          indexing: engine.indexing || null,
          supportedStrategies: engine.supported_strategies || []
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: validate, recommend, dictionaries, details` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('POST /api/kehrnel/engines error:', error);
    return safeErrorResponse(error, 'Engine operation failed');
  }
}
