import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/transform/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getKehrnelEndpoint } from '@/lib/kehrnel/endpoints';
import { adaptForKehrnel } from '@/lib/strategies/configAdapter';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';

function resolveStrategyApiPrefix(strategyId, config = {}) {
  const raw = String(strategyId || '').trim();
  if (!raw) return '/api/strategies/openehr/rps_dual';

  if (raw.includes('/')) {
    const parts = raw.split('/').filter(Boolean);
    const domain = parts[0] || String(config.domain || 'openehr').toLowerCase();
    const name = parts[1] || 'rps_dual';
    return `/api/strategies/${domain}/${name}`;
  }

  if (raw.includes('.')) {
    const [domain, ...rest] = raw.split('.');
    const name = rest.join('_') || 'rps_dual';
    return `/api/strategies/${domain}/${name}`;
  }

  const domain = String(config.domain || 'openehr').trim().toLowerCase() || 'openehr';
  return `/api/strategies/${domain}/${raw}`;
}

/**
 * Kehrnel Transform API
 *
 * POST /api/kehrnel/transform
 *
 * Transforms canonical compositions into the storage format defined by the strategy.
 * Each strategy runs in its own Kehrnel Docker container with its own endpoint.
 *
 * Architecture:
 * - Each strategy = separate Kehrnel Docker instance
 * - Strategy endpoints are configured in the environment or database
 * - This API routes to the correct Kehrnel instance based on config.strategy
 *
 * Request body:
 * {
 *   "config": {
 *     "strategy": "rps_dual",        // Required - determines which Kehrnel instance to call
 *     "database": "...",             // Strategy-specific parameters
 *     "collections": { ... },
 *     ...
 *   },
 *   "data": { ... }                  // Composition(s) to transform
 * }
 */

export async function POST(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await req.json();
    const { config, data } = body;
    const activeEnvId = (
      req.headers.get('x-active-env')
      || req.headers.get('x-env-id')
      || req.headers.get('x-environment-id')
      || body?.environment
      || body?.envId
      || ''
    ).toString().trim();

    if (!config) {
      return NextResponse.json({ error: 'config is required' }, { status: 400 });
    }

    if (!config.strategy) {
      return NextResponse.json({
        error: 'config.strategy is required - determines which Kehrnel instance to use'
      }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'data is required' }, { status: 400 });
    }

    // Get the Kehrnel endpoint for this strategy
    const coreDb = await getCoreDb();
    if (activeEnvId) {
      const envGate = await enforceEnvironmentControl(coreDb, activeEnvId, ENV_CONTROL_CAPABILITY.WRITE);
      if (envGate) return envGate;
    }
    const endpoint = await getKehrnelEndpoint(coreDb, config.strategy);

    if (!endpoint) {
      return NextResponse.json({
        error: `No Kehrnel instance configured for strategy '${config.strategy}'`,
        hint: 'Configure strategy endpoints in Settings > Kehrnel Instances'
      }, { status: 400 });
    }

    console.log(`[Kehrnel Transform] Strategy: ${config.strategy} → ${endpoint.url}`);

    const strategyApiPrefix = resolveStrategyApiPrefix(config.strategy, config);

    // Call the strategy-scoped API (multi-strategy layout)
    const response = await fetch(`${endpoint.url}${strategyApiPrefix}/ingest/body`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(endpoint.apiKey && { 'X-API-Key': endpoint.apiKey }),
        ...(activeEnvId && { 'x-active-env': activeEnvId })
      },
      body: JSON.stringify({
        config,
        composition: data
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Kehrnel Transform] Error from ${endpoint.url}:`, errorText);
      return NextResponse.json({
        success: false,
        error: `Kehrnel error: ${response.status}`,
        details: errorText
      }, { status: response.status });
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      result,
      metadata: {
        strategy: config.strategy,
        kehrnelInstance: endpoint.name,
        kehrnelUrl: endpoint.url
      }
    });
  } catch (error) {
    console.error('POST /api/kehrnel/transform error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Transform failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * GET endpoint to retrieve the current Kehrnel and strategy configuration
 * Useful for diagnostics and debugging
 */
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();

    // Get user document
    const userDoc = await coreDb.collection('users').findOne({ email: session.user.email });
    if (!userDoc) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get active strategy config
    // Note: Strategy definitions now come from Kehrnel, not local DB
    // The user's environment strategyLinks contains the active strategy reference
    let strategyDoc = null;
    let kehrnelStrategyConfig = null;

    // Try to get strategy config from user's active environment
    const activeEnv = (userDoc.environments || []).find(e => e.isActive) || (userDoc.environments || [])[0];
    const activeLink = activeEnv?.strategyLinks?.[0];

    if (activeLink?.strategyId) {
      try {
        const { createKehrnelService } = await import('@/lib/kehrnel/KehrnelService');
        const service = createKehrnelService(coreDb);
        const manifest = await service.getStrategy(activeLink.strategyId);
        if (manifest) {
          // Wrap manifest in format expected by adaptForKehrnel
          strategyDoc = wrapKehrnelManifest(manifest, activeLink.configOverrides);
          kehrnelStrategyConfig = adaptForKehrnel(strategyDoc);
        }
      } catch (err) {
        console.warn('Could not fetch strategy from Kehrnel:', err.message);
      }
    }

    // Get Kehrnel endpoint for the strategy
    let kehrnelEndpoint = null;
    if (kehrnelStrategyConfig?.strategy) {
      kehrnelEndpoint = await getKehrnelEndpoint(coreDb, kehrnelStrategyConfig.strategy);
    }

    return NextResponse.json({
      hasActiveStrategy: !!strategyDoc,
      strategy: strategyDoc ? {
        id: strategyDoc._id.toString(),
        name: strategyDoc.name,
        blueprintId: strategyDoc.blueprint?.id,
        kehrnelLibrary: strategyDoc.blueprint?.kehrnel_library
      } : null,
      kehrnelEndpoint: kehrnelEndpoint ? {
        name: kehrnelEndpoint.name,
        url: kehrnelEndpoint.url,
        hasApiKey: !!kehrnelEndpoint.apiKey
      } : null,
      kehrnelStrategyConfig, // The Python-ready config
      ready: !!(strategyDoc && kehrnelEndpoint)
    });
  } catch (error) {
    console.error('GET /api/kehrnel/transform error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to get transform configuration'
    }, { status: 500 });
  }
}

/**
 * Wrap a Kehrnel manifest into the format expected by configAdapter
 */
function wrapKehrnelManifest(manifest, configOverrides = {}) {
  const id = manifest.id || manifest.strategy_id || manifest.name;
  return {
    _id: id,
    name: manifest.name || manifest.display_name || id,
    kehrnelId: id,
    blueprint: {
      id: id,
      display_name: manifest.display_name || manifest.name,
      domain: manifest.domain || [],
      summary: manifest.summary || manifest.description,
      topology: manifest.topology || { modes: ['single'], default: 'single' },
      query_focus: manifest.query_focus || 'mixed',
      complexity: manifest.complexity || 'medium',
      collections: manifest.collections || {},
      fields: manifest.fields || {},
      coding: manifest.coding || {},
      dictionaries: manifest.dictionaries || {},
      index_templates: manifest.index_templates || {},
      kehrnel_library: {
        package: 'kehrnel',
        capabilities: manifest.capabilities || []
      }
    },
    config: {
      ...(manifest.default_config || {}),
      ...configOverrides,
      strategy: id
    }
  };
}
