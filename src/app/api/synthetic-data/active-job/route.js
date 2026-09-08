// src/app/api/synthetic-data/active-job/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { getSyntheticStrategyLinks, normalizeSyntheticDomain } from '@/lib/synthetic-data/kehrnelRuntime';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isActiveKehrnelJob(job) {
  const status = (job?.status || '').toLowerCase();
  return status === 'queued' || status === 'running' || status === 'canceling';
}

function toActiveJobPayload(job, environmentName) {
  const rawStatus = (job?.status || '').toLowerCase();
  const modelCount =
    job.stats?.modelCount ||
    (Array.isArray(job.byModel) ? job.byModel.length : 0) ||
    0;
  return {
    id: job.id,
    status: 'running',
    rawStatus,
    progress: job.progress || 0,
    phase: job.phase || 'processing',
    patientsCreated: job.stats?.generatedPatients || 0,
    totalPatients: job.stats?.patientCount || 0,
    templatesProcessed: modelCount,
    totalTemplates: modelCount,
    currentBatch: 1,
    totalBatches: 1,
    startTime: job.startedAt || job.createdAt || null,
    environmentName,
    domain: job.domain || null
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { environment } = await getActiveTenantDb(req, { session: auth.session });
    const envKey = environment?.kehrnel?.envKey || environment?.id;
    if (!envKey) {
      return NextResponse.json({ job: null });
    }

    const links = getSyntheticStrategyLinks(environment);
    const domains = Array.from(
      new Set(
        links
          .map((link) => normalizeSyntheticDomain(link?.domain))
          .filter(Boolean)
      )
    );

    const coreDb = await getCoreDb();
    const service = createKehrnelService(coreDb);
    let activeJob = null;

    for (const domain of domains.length ? domains : ['']) {
      let result;
      try {
        result = await service.listSyntheticJobs(envKey, {
          domain: domain || undefined,
          limit: 25,
          connectionId: links[0]?.kehrnel?.connectionId || environment?.kehrnel?.connectionId || null,
          envKehrnel: environment?.kehrnel || {}
        });
      } catch (error) {
        // Some Kehrnel deployments may not expose synthetic jobs API.
        if (error?.status === 404) {
          continue;
        }
        throw error;
      }
      const match = result.items.find(isActiveKehrnelJob);
      if (match) {
        activeJob = match;
        break;
      }
    }

    if (!activeJob) {
      return NextResponse.json({ job: null });
    }

    return NextResponse.json({
      job: toActiveJobPayload(activeJob, environment?.name || null)
    });
  } catch (error) {
    console.error('Error getting active job:', error);
    return safeErrorResponse(error, 'Failed to fetch active job');
  }
}
