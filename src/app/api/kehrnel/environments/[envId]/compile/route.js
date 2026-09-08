import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/environments/[envId]/compile/route.js
/**
 * Compile AQL Query
 *
 * Compiles an AQL query via Kehrnel for debugging and preview.
 * Returns the MongoDB pipeline and optional explain/debug info.
 */
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '../../../../../../lib/db/coreDb.js';
import { requireAccessibleEnvironment } from '../../../../../../lib/environments/requireEnvironmentAccess.js';
import { createKehrnelService } from '../../../../../../lib/kehrnel/KehrnelService.js';
import { resolveRuntimeContext, normalizeDomain } from '../../../../../../lib/kehrnel/runtimeContext.js';
import { safeUpstreamError } from '../../../../../../lib/security/api.js';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '../../../../../../lib/security/environmentControls.js';

/**
 * POST /api/kehrnel/environments/[envId]/compile
 *
 * Compile an AQL query for debugging/preview.
 *
 * Query params:
 *   - debug: Include debug info (default: true)
 *
 * Body:
 *   - aql: AQL query string (required)
 *   - domain: Domain identifier (required)
 *   - strategyId: Kehrnel strategy ID to use (optional; selects env strategyLink)
 *   - options: Additional query options (optional)
 *   - connectionId: Specific Kehrnel connection (optional)
 *
 * Returns:
 *   - pipeline: MongoDB aggregation pipeline
 *   - explain: Debug/explain information (if debug=true)
 *   - _meta: Request metadata
 */
export async function POST(req, props) {
  const params = await props.params;
  try {
    let session = { user: { email: 'test@example.com' } };
    if (!isTestModeBypassEnabled()) {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
      session = auth.session;
    }

    const { envId } = params;
    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const debug = searchParams.get('debug') !== 'false';
    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;

    const body = await req.json();
    const { aql, options, connectionId, domain, strategyId } = body;

    if (!aql) {
      return NextResponse.json({ error: 'aql is required' }, { status: 400 });
    }
    const db = await getCoreDb();
    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(db, session?.user?.email, envId);
      if (!access.ok) return access.response;
    }
    const envGate = await enforceEnvironmentControl(db, envId, ENV_CONTROL_CAPABILITY.READ, {
      route: 'api/kehrnel/environments/compile'
    });
    if (envGate) return envGate;

    const service = createKehrnelService(db);
    const runtime = await resolveRuntimeContext({
      coreDb: db,
      userEmail: session?.user?.email,
      envId,
      requestedDomain: domain,
      strategyId,
      requestedConnectionId: connectionId,
      hydrateStrategyConfig: false
    });
    const resolvedDomain = runtime.domain || normalizeDomain(domain);
    if (!resolvedDomain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 });
    }
    const envKey = runtime.envKey || envId;

    const result = await service.compileQuery(envKey, aql, {
      debug,
      queryOptions: options,
      strategyId: runtime.autoActivate?.strategyId || null,
      connectionId: runtime.connectionId || connectionId,
      envKehrnel: runtime.envKehrnel || {},
      domain: resolvedDomain,
      requestId,
      autoActivate: runtime.autoActivate || null
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(`POST /api/kehrnel/environments/${params?.envId}/compile error:`, error);
    return safeUpstreamError(error, 'Compilation failed');
  }
}
