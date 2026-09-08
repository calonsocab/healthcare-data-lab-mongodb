import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { resolveSyntheticBinding, normalizeSyntheticDomain } from '@/lib/synthetic-data/kehrnelRuntime';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';

async function resolveRuntime(req, body = {}) {
  const coreDb = await getCoreDb();
  const service = createKehrnelService(coreDb);
  const { environment } = await getActiveTenantDb(req);
  const binding = resolveSyntheticBinding(environment, {
    domain: normalizeSyntheticDomain(body.domain || ''),
    strategyId: body.strategyId || ''
  });

  if (!binding.envKey) {
    const err = new Error('No active environment selected');
    err.status = 400;
    throw err;
  }
  if (!binding.domain) {
    const err = new Error('No synthetic-enabled domain found for this environment');
    err.status = 400;
    throw err;
  }
  if (!binding.strategyId) {
    const err = new Error(`No strategy linked for domain "${binding.domain}"`);
    err.status = 400;
    throw err;
  }

  return { coreDb, service, environment, binding };
}

export async function POST(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await req.json().catch(() => ({}));
    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;
    const { coreDb, service, environment, binding } = await resolveRuntime(req, body || {});

    const envGate = await enforceEnvironmentControl(coreDb, environment?.id, ENV_CONTROL_CAPABILITY.OPS);
    if (envGate) return envGate;

    const upgrade = await service.upgradeActivation(binding.envKey, binding.domain, {
      connectionId: binding.connectionId,
      envKehrnel: environment?.kehrnel || {},
      requestId,
      reason: body?.reason || 'upgrade-before-synthetic-retry'
    });

    return NextResponse.json({
      success: true,
      environment: {
        id: environment?.id || null,
        name: environment?.name || null,
        envKey: binding.envKey
      },
      domain: binding.domain,
      strategyId: binding.strategyId,
      upgrade: {
        activationId: upgrade?.activation_id || upgrade?.activationId || null,
        strategyVersion: upgrade?.strategy_version || upgrade?.strategyVersion || null,
        configHash: upgrade?.config_hash || upgrade?.configHash || null,
        manifestDigest: upgrade?.manifest_digest || upgrade?.manifestDigest || null,
        replaced: upgrade?.replaced ?? null,
        previousActivationId: upgrade?.previous_activation_id || upgrade?.previousActivationId || null,
        status: upgrade?.status || 'ok'
      }
    });
  } catch (error) {
    console.error('POST /api/synthetic-data/kehrnel/activations/upgrade error:', error);
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;
    return NextResponse.json(
      {
        code: error.code || null,
        error: error.message || 'Failed to upgrade synthetic activation',
        details: error.details || null
      },
      { status }
    );
  }
}
