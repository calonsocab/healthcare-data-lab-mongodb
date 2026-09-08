import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/environments/[envId]/activations/route.js
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '../../../../../../lib/db/coreDb.js';
import { requireAccessibleEnvironment } from '../../../../../../lib/environments/requireEnvironmentAccess.js';
import { createKehrnelService } from '../../../../../../lib/kehrnel/KehrnelService.js';
import { safeUpstreamError } from '../../../../../../lib/security/api.js';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '../../../../../../lib/security/environmentControls.js';

export const dynamic = 'force-dynamic';

/**
 * Load user/team scope to find the right collection and document
 */
async function loadScope(coreDb, email) {
  const user = await coreDb.collection('users').findOne({ email });
  if (!user) throw new Error('User not found');
  if (user.teamId && (user.accountType === 'team' || user.accountType === 'demo')) {
    const team = await coreDb.collection('teams').findOne({ _id: user.teamId });
    return { mode: 'team', user, team };
  }
  return { mode: 'individual', user, team: null };
}

export async function GET(req, props) {
  const params = await props.params;
  try {
    let session = { user: { email: 'test@example.com' } };
    if (!isTestModeBypassEnabled()) {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
      session = auth.session;
    }

    const { envId } = params;
    if (!envId) return NextResponse.json({ error: 'envId is required' }, { status: 400 });

    const db = await getCoreDb();
    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(db, session?.user?.email, envId);
      if (!access.ok) return access.response;
    }
    const envGate = await enforceEnvironmentControl(db, envId, ENV_CONTROL_CAPABILITY.READ, {
      route: 'api/kehrnel/environments/activations'
    });
    if (envGate) return envGate;

    const service = createKehrnelService(db);
    const result = await service.listActivations(envId);
    // Handle both { activations: [...] } and direct array responses
    const activations = Array.isArray(result) ? result
      : Array.isArray(result?.activations) ? result.activations
      : [];

    return NextResponse.json({ activations });
  } catch (error) {
    return safeUpstreamError(error, 'Failed to list activations');
  }
}

/**
 * HDL-KHR-017: Sync activation metadata from Kehrnel
 * POST /api/kehrnel/environments/:envId/activations
 * Body: { action: 'sync' }
 *
 * Refreshes the environment's strategyLinks with the latest state from Kehrnel:
 * - Fetches current activations from Kehrnel for all domains
 * - Fetches current endpoints
 * - Updates the environment document with fresh activation metadata
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
    if (!envId) return NextResponse.json({ error: 'envId is required' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action !== 'sync') {
      return NextResponse.json({ error: 'Invalid action. Use { action: "sync" }' }, { status: 400 });
    }

    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;

    const db = await getCoreDb();
    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(db, session?.user?.email, envId);
      if (!access.ok) return access.response;
    }
    const envGate = await enforceEnvironmentControl(db, envId, ENV_CONTROL_CAPABILITY.OPS, {
      route: 'api/kehrnel/environments/activations'
    });
    if (envGate) return envGate;

    // Load user/team scope to find environments
    const { mode, user, team } = await loadScope(db, session.user.email);
    const targetCol = mode === 'team' ? db.collection('teams') : db.collection('users');
    const filter = mode === 'team' ? { _id: user.teamId } : { _id: user._id };
    const holder = mode === 'team' ? (team || {}) : (user || {});
    const environments = Array.isArray(holder.environments) ? [...holder.environments] : [];

    // Find the target environment
    const envIdx = environments.findIndex(e => e.id === envId);
    if (envIdx < 0) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const env = environments[envIdx];
    const service = createKehrnelService(db);
    const conn = await service.resolveConnection({ connectionId: env.kehrnel?.connectionId, envKehrnel: env.kehrnel });

    if (!conn) {
      return NextResponse.json({ error: 'No Kehrnel connection available' }, { status: 400 });
    }

    // 1. List all activations from Kehrnel
    let kehrnelActivations = [];
    try {
      const result = await service.listActivations(envId, { connectionId: env.kehrnel?.connectionId });
      // Handle both { activations: [...] } and direct array responses
      kehrnelActivations = Array.isArray(result) ? result
        : Array.isArray(result?.activations) ? result.activations
        : [];
    } catch (err) {
      // Environment may not exist in Kehrnel yet - that's OK
      if (err.status !== 404) {
        console.warn('Failed to fetch activations from Kehrnel:', err.message);
      }
    }

    // 2. Update strategyLinks with fresh Kehrnel data
    const domainsUpdated = [];
    const updatedLinks = [...(env.strategyLinks || [])];

    for (const activation of kehrnelActivations) {
      const domain = activation.domain;
      if (!domain) continue;

      // Find existing link or create new one
      let linkIndex = updatedLinks.findIndex(l => l.domain?.toLowerCase() === domain.toLowerCase());
      if (linkIndex === -1) {
        linkIndex = updatedLinks.length;
        updatedLinks.push({ id: `link-${domain.toLowerCase()}-${Date.now()}`, domain });
      }

      // Fetch endpoints for this domain
      let endpoints = null;
      try {
        const endpointsRes = await service.getEndpoints(envId, { domain, connectionId: env.kehrnel?.connectionId });
        endpoints = endpointsRes.endpoints || endpointsRes || null;
      } catch (err) {
        // OK if endpoints not available
      }

      // Update the link with fresh metadata
      updatedLinks[linkIndex] = {
        ...updatedLinks[linkIndex],
        domain,
        strategyId: activation.strategy_id || activation.strategyId,
        strategyName: activation.strategy_name || activation.name || activation.strategy_id,
        kehrnel: {
          ...updatedLinks[linkIndex].kehrnel,
          strategyId: activation.strategy_id || activation.strategyId,
          activationId: activation.activation_id || activation.id,
          manifestDigest: activation.manifest_digest || activation.manifestDigest,
          configHash: activation.config_hash || activation.configHash,
          activatedAt: activation.activated_at || activation.activatedAt || new Date().toISOString(),
          endpoints: endpoints,
          syncedAt: new Date().toISOString()
        }
      };
      domainsUpdated.push(domain);
    }

    // 3. Update environment in user/team document
    environments[envIdx] = {
      ...env,
      strategyLinks: updatedLinks,
      updatedAt: new Date().toISOString()
    };

    await targetCol.updateOne(filter, { $set: { environments, updatedAt: new Date() } });

    // Audit log
    try {
      const collection = db?.collection ? db.collection('audit_events') : null;
      if (collection?.insertOne) {
        await collection.insertOne({
          type: 'activation',
          action: 'sync',
          envId,
          user: session.user?.email || 'system',
          createdAt: new Date().toISOString(),
          requestId,
          result: { domainsUpdated, success: true }
        });
      }
    } catch (err) {
      console.warn('audit log failed (sync)', err.message);
    }

    return NextResponse.json({
      success: true,
      domainsUpdated,
      environment: environments[envIdx]
    });
  } catch (error) {
    console.error('POST /api/kehrnel/environments/[envId]/activations error:', error);
    return safeUpstreamError(error, 'Sync failed');
  }
}
