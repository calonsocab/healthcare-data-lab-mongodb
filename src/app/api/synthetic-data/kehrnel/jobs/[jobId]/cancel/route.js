import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { resolveSyntheticBinding, normalizeSyntheticDomain } from '@/lib/synthetic-data/kehrnelRuntime';

async function resolveRuntime(req, params, queryDomain = '') {
  const coreDb = await getCoreDb();
  const service = createKehrnelService(coreDb);
  const { environment } = await getActiveTenantDb(req);
  const binding = resolveSyntheticBinding(environment, {
    domain: normalizeSyntheticDomain(queryDomain)
  });

  if (!binding.envKey) {
    const err = new Error('No active environment selected');
    err.status = 400;
    throw err;
  }
  if (!params?.jobId) {
    const err = new Error('jobId is required');
    err.status = 400;
    throw err;
  }

  return { service, environment, binding };
}

export async function POST(req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;
    const { service, environment, binding } = await resolveRuntime(req, params, searchParams.get('domain') || '');

    const result = await service.cancelSyntheticJob(binding.envKey, params.jobId, {
      connectionId: binding.connectionId,
      envKehrnel: environment?.kehrnel || {},
      requestId
    });

    return NextResponse.json({
      success: true,
      environment: {
        id: environment?.id || null,
        name: environment?.name || null,
        envKey: binding.envKey
      },
      domain: binding.domain,
      strategyId: binding.strategyId || null,
      job: result.job
    });
  } catch (error) {
    console.error(`POST /api/synthetic-data/kehrnel/jobs/${params?.jobId}/cancel error:`, error);
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;
    return NextResponse.json(
      { code: error.code || null, error: error.message || 'Failed to cancel synthetic job', details: error.details || null },
      { status }
    );
  }
}
