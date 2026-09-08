import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/environments/[envId]/ops/[strategyId]/[op]/route.js
/**
 * Run Strategy Operation
 *
 * Executes a strategy-specific operation (op) from the manifest.ops array.
 * Examples: ensure_dictionaries, rebuild_search, etc.
 */
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '../../../../../../../../lib/db/coreDb.js';
import { requireAccessibleEnvironment } from '../../../../../../../../lib/environments/requireEnvironmentAccess.js';
import { createKehrnelService } from '../../../../../../../../lib/kehrnel/KehrnelService.js';
import { resolveRuntimeContext, normalizeDomain } from '../../../../../../../../lib/kehrnel/runtimeContext.js';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '../../../../../../../../lib/security/environmentControls.js';

/**
 * POST /api/kehrnel/environments/[envId]/ops/[strategyId]/[op]
 *
 * Run a strategy-specific operation via Kehrnel.
 *
 * Path params:
 *   - envId: Environment ID
 *   - strategyId: Kehrnel strategy ID
 *   - op: Operation name from manifest.ops
 *
 * Body:
 *   - payload: Operation input (schema from manifest.ops[].input_schema)
 *   - connectionId: Specific Kehrnel connection (optional)
 *
 * Returns:
 *   - Operation result (varies by op)
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

    const { envId, strategyId, op } = params;

    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }
    if (!strategyId) {
      return NextResponse.json({ error: 'strategyId is required' }, { status: 400 });
    }
    if (!op) {
      return NextResponse.json({ error: 'op is required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { payload, connectionId, domain } = body;
    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;

    const db = await getCoreDb();
    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(db, session?.user?.email, envId);
      if (!access.ok) return access.response;
    }
    const envGate = await enforceEnvironmentControl(db, envId, ENV_CONTROL_CAPABILITY.OPS, {
      route: 'api/kehrnel/environments/ops'
    });
    if (envGate) return envGate;

    const service = createKehrnelService(db);
    const runtime = await resolveRuntimeContext({
      coreDb: db,
      userEmail: session?.user?.email,
      envId,
      requestedDomain: domain,
      strategyId,
      requestedConnectionId: connectionId
    });
    const resolvedDomain = runtime.domain || normalizeDomain(domain);
    if (!resolvedDomain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 });
    }
    const envKey = runtime.envKey || envId;

    const result = await service.runOp(
      envKey,
      strategyId,
      op,
      payload || {},
      {
        connectionId: runtime.connectionId || connectionId,
        envKehrnel: runtime.envKehrnel || {},
        requestId,
        domain: resolvedDomain,
        autoActivate: runtime.autoActivate || null
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      `POST /api/kehrnel/environments/${params?.envId}/ops/${params?.strategyId}/${params?.op} error:`,
      error
    );

    return NextResponse.json(
      { error: error.message || 'Operation failed' },
      { status: error.status || 500 }
    );
  }
}

/**
 * GET /api/kehrnel/environments/[envId]/ops/[strategyId]/[op]
 *
 * Get operation metadata (for UI form generation).
 * Returns the operation definition from the strategy manifest.
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

    const { strategyId, op } = params;
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connectionId');

    const { envId } = params;
    const db = await getCoreDb();
    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(db, session?.user?.email, envId);
      if (!access.ok) return access.response;
    }
    const envGate = await enforceEnvironmentControl(db, envId, ENV_CONTROL_CAPABILITY.READ, {
      route: 'api/kehrnel/environments/ops'
    });
    if (envGate) return envGate;

    const service = createKehrnelService(db);

    // Fetch the strategy to get its ops
    const strategy = await service.getStrategy(strategyId, { connectionId });

    const ops = strategy?.ops || strategy?.manifest?.ops || [];
    const opDef = ops.find(o => o.name === op || o.id === op);

    if (!opDef) {
      return NextResponse.json(
        { error: `Operation '${op}' not found in strategy '${strategyId}'` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      op: opDef,
      strategyId,
      strategyName: strategy.name
    });
  } catch (error) {
    console.error(
      `GET /api/kehrnel/environments/${params?.envId}/ops/${params?.strategyId}/${params?.op} error:`,
      error
    );

    return NextResponse.json(
      { error: error.message || 'Failed to fetch operation' },
      { status: error.status || 500 }
    );
  }
}
