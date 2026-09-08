import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { loadEnvironmentScope } from '@/lib/environments/access';
import { getStrategyLinkId, normalizeSearchRefresh } from '@/lib/environments/searchRefresh';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import {
  resolveSyntheticBinding,
  normalizeSyntheticDomain,
  hydrateSyntheticBindingConfig
} from '@/lib/synthetic-data/kehrnelRuntime';
import {
  consumeTeamRateLimit,
  enforceApiRateLimit,
  enforceNumericLimit,
  resolvePolicyContext
} from '@/lib/security/teamPolicy';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';

const LEGACY_UNSUPPORTED_PAYLOAD_KEYS = new Set([
  'write_batch_size',
  'validate_generated_docs',
  'validation_sample_size',
  'fail_on_validation_error',
  'skip_invalid_documents'
]);

function stripUnsupportedPayloadKeys(payload = {}) {
  if (!payload || typeof payload !== 'object') return {};
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !LEGACY_UNSUPPORTED_PAYLOAD_KEYS.has(key))
  );
}

function enforceTenantDatabasePolicy(payload = {}, tenantDatabase = '', strategyConfig = {}) {
  const clean = { ...(payload || {}) };
  delete clean.database_name;
  delete clean.target_database;
  delete clean.targetDatabase;
  delete clean.source_database;
  delete clean.sourceDatabase;

  const strategyModelSource =
    strategyConfig?.model_source && typeof strategyConfig.model_source === 'object'
      ? strategyConfig.model_source
      : {};
  const modelSource = (clean.model_source && typeof clean.model_source === 'object')
    ? { ...clean.model_source }
    : {};
  modelSource.database_name = tenantDatabase || null;
  if (strategyModelSource.catalog_collection) {
    modelSource.catalog_collection = strategyModelSource.catalog_collection;
  } else if (!modelSource.catalog_collection) {
    modelSource.catalog_collection = 'user-data-models';
  }
  if (strategyModelSource.links_collection !== undefined) {
    modelSource.links_collection = strategyModelSource.links_collection;
  }
  clean.model_source = modelSource;

  return clean;
}

function isActivationMissingError(error) {
  const code = (error?.code || '').toString().toUpperCase();
  const message = (error?.message || '').toString();
  return (
    code === 'ACTIVATION_NOT_FOUND' ||
    code === 'ACTIVATION_MISSING' ||
    /ACTIVATION_NOT_FOUND|ACTIVATION_MISSING/i.test(message)
  );
}

function isActivationStrategyMismatchError(error) {
  const code = (error?.code || '').toString().toUpperCase();
  const message = (error?.message || '').toString();
  return code === 'ACTIVATION_STRATEGY_MISMATCH' || /strategy differs from current manifest/i.test(message);
}

const SEARCH_REFRESH_OPS = new Set(['rebuild_slim_search_collection']);

function normalizeJobOp(job = null) {
  return String(job?.op || job?.operation || '').trim().toLowerCase();
}

function isSearchRefreshJob(job = null) {
  return SEARCH_REFRESH_OPS.has(normalizeJobOp(job));
}

function resolveJobId(job = null) {
  return String(job?.id || job?._id || job?.jobId || '').trim();
}

function isCompletedJob(job = null) {
  const status = String(job?.status || '').trim().toLowerCase();
  return status === 'completed' || status === 'done';
}

function isFailedJob(job = null) {
  const status = String(job?.status || '').trim().toLowerCase();
  return status === 'failed' || status === 'error' || status === 'canceled' || status === 'cancelled';
}

async function reconcileSearchRefreshJobs({
  coreDb,
  userEmail,
  environment,
  binding,
  jobs = []
}) {
  const refreshJobs = (Array.isArray(jobs) ? jobs : []).filter(isSearchRefreshJob);
  if (!coreDb || !userEmail || !environment?.id || refreshJobs.length === 0) return;

  const refreshJobsById = new Map();
  for (const job of refreshJobs) {
    const jobId = resolveJobId(job);
    if (jobId) refreshJobsById.set(jobId, job);
  }
  if (refreshJobsById.size === 0) return;

  const scope = await loadEnvironmentScope(coreDb, userEmail);
  const holder = scope.mode === 'team' ? (scope.team || {}) : (scope.user || {});
  const environments = Array.isArray(holder.environments) ? [...holder.environments] : [];
  const envIdx = environments.findIndex((item) => item.id === environment.id);
  if (envIdx < 0) return;

  const env = { ...environments[envIdx] };
  const strategyLinks = Array.isArray(env.strategyLinks) ? [...env.strategyLinks] : [];
  const bindingDomain = normalizeSyntheticDomain(binding?.domain || '');
  const bindingStrategyId = String(binding?.strategyId || '');
  let changed = false;

  const nextLinks = strategyLinks.map((link) => {
    const linkDomain = normalizeSyntheticDomain(link?.domain || '');
    const linkStrategyId = String(getStrategyLinkId(link) || '');
    if (bindingDomain && linkDomain !== bindingDomain) return link;
    if (bindingStrategyId && linkStrategyId && linkStrategyId !== bindingStrategyId) return link;

    const refreshState = normalizeSearchRefresh(link?.searchRefresh);
    const refreshJobId = String(refreshState?.jobId || '').trim();
    if (!refreshState || !refreshJobId) return link;

    const job = refreshJobsById.get(refreshJobId);
    if (!job) return link;

    if (isCompletedJob(job)) {
      changed = true;
      return {
        ...link,
        searchRefresh: null,
      };
    }

    const nextStatus = String(job.status || refreshState.jobStatus || '').trim() || null;
    const nextError = isFailedJob(job)
      ? (job.error || refreshState.lastError || 'Search refresh job did not complete')
      : refreshState.lastError;

    if (refreshState.jobStatus === nextStatus && refreshState.lastError === nextError) {
      return link;
    }

    changed = true;
    return {
      ...link,
      searchRefresh: {
        ...(link.searchRefresh || {}),
        ...refreshState,
        jobStatus: nextStatus,
        lastError: nextError,
        resolvedAt: null,
      },
    };
  });

  if (!changed) return;

  env.strategyLinks = nextLinks;
  env.updatedAt = new Date().toISOString();
  environments[envIdx] = env;

  const targetCol = scope.mode === 'team' ? coreDb.collection('teams') : coreDb.collection('users');
  const filter = scope.mode === 'team' ? { _id: scope.user.teamId } : { _id: scope.user._id };
  await targetCol.updateOne(filter, { $set: { environments } });
}

async function resolveSyntheticPreviewOnly(coreDb, userEmail) {
  if (!userEmail) return false;
  const user = await coreDb.collection('users').findOne(
    { email: userEmail },
    { projection: { teamId: 1, accountType: 1 } }
  );
  if (!user?.teamId || user?.accountType !== 'team') return false;

  const { ObjectId } = await import('mongodb');
  const teamQuery =
    (typeof user.teamId === 'string' && ObjectId.isValid(user.teamId))
      ? { _id: new ObjectId(user.teamId) }
      : { _id: user.teamId };

  const team = await coreDb.collection('teams').findOne(
    teamQuery,
    { projection: { syntheticDataPreviewOnly: 1 } }
  );
  return team?.syntheticDataPreviewOnly === true || team?.syntheticDataPreviewOnly === 'true';
}

async function resolveRuntime(req, bodyOrQuery = {}) {
  const coreDb = await getCoreDb();
  const service = createKehrnelService(coreDb);
  const { environment } = await getActiveTenantDb(req);
  const requestedDomain = normalizeSyntheticDomain(bodyOrQuery.domain || '');
  const requestedStrategyId = bodyOrQuery.strategyId || '';
  const resolvedBinding = resolveSyntheticBinding(environment, {
    domain: requestedDomain,
    strategyId: requestedStrategyId
  });
  const binding = await hydrateSyntheticBindingConfig(environment, resolvedBinding, { service });

  if (!binding.envKey) {
    const err = new Error('No active environment selected');
    err.status = 400;
    throw err;
  }
  if (!binding.domain) {
    const err = new Error('No synthetic-enabled domain found for this environment');
    err.status = 400;
    err.details = { availableDomains: binding.availableDomains || [] };
    throw err;
  }
  if (!binding.strategyId) {
    const err = new Error(`No strategy linked for domain "${binding.domain}"`);
    err.status = 400;
    throw err;
  }

  return { coreDb, service, environment, binding };
}


export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || '';
    const limit = searchParams.get('limit') || '';
    const cursor = searchParams.get('cursor') || '';
    const queryDomain = searchParams.get('domain') || '';
    const queryStrategyId = searchParams.get('strategyId') || '';
    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;

    const { coreDb, service, environment, binding } = await resolveRuntime(req, {
      domain: queryDomain,
      strategyId: queryStrategyId
    });

    const result = await service.listSyntheticJobs(binding.envKey, {
      domain: binding.domain,
      status: status || undefined,
      limit: limit ? Number(limit) : undefined,
      cursor: cursor || undefined,
      connectionId: binding.connectionId,
      envKehrnel: environment?.kehrnel || {},
      requestId
    });

    try {
      await reconcileSearchRefreshJobs({
        coreDb,
        userEmail: session.user.email || null,
        environment,
        binding,
        jobs: result.items
      });
    } catch (reconcileError) {
      console.warn('Could not reconcile search refresh job state:', reconcileError.message);
    }

    return NextResponse.json({
      environment: {
        id: environment?.id || null,
        name: environment?.name || null,
        envKey: binding.envKey
      },
      domain: binding.domain,
      targetDatabase: binding.targetDatabase || null,
      strategyId: binding.strategyId,
      count: result.items.length,
      items: result.items
    });
  } catch (error) {
    console.error('GET /api/synthetic-data/kehrnel/jobs error:', error);
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;
    return NextResponse.json(
      {
        code: error.code || null,
        error: error.message || 'Failed to list synthetic jobs',
        details: error.details || null
      },
      { status }
    );
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await req.json();
    const { payload = {}, strategyId = '', domain = '', op = 'synthetic_generate_batch' } = body || {};
    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;

    const { coreDb, service, environment, binding } = await resolveRuntime(req, {
      domain,
      strategyId
    });

    const envGate = await enforceEnvironmentControl(coreDb, environment?.id, ENV_CONTROL_CAPABILITY.JOB);
    if (envGate) return envGate;

    const policyContext = await resolvePolicyContext(coreDb, session.user.email);
    await enforceApiRateLimit(coreDb, policyContext, 'synthetic-jobs:post');
    const isPreviewOnlyMode = await resolveSyntheticPreviewOnly(coreDb, session.user.email);

    // Kehrnel schema for current strategy rejects several legacy payload keys.
    // Strip them server-side to stay compatible with older UI builds.
    const payloadWithoutUnsupportedKeys = stripUnsupportedPayloadKeys(payload);
    const normalizedPayload = {
      ...enforceTenantDatabasePolicy(
        payloadWithoutUnsupportedKeys,
        environment?.database || '',
        binding?.mergedConfig || {}
      ),
      ...(isPreviewOnlyMode ? { plan_only: true, dry_run: true } : {})
    };

    const syntheticPayloadBytes = Buffer.byteLength(JSON.stringify(normalizedPayload || {}), 'utf8');
    enforceNumericLimit(
      policyContext?.policy?.limits?.maxSyntheticPayloadBytes,
      syntheticPayloadBytes,
      {
        code: 'TEAM_SYNTHETIC_PAYLOAD_TOO_LARGE',
        status: 413,
        message: 'Synthetic payload exceeds team policy limit',
        details: {
          bytes: syntheticPayloadBytes,
          maxSyntheticPayloadBytes: policyContext?.policy?.limits?.maxSyntheticPayloadBytes
        }
      }
    );

    const patientCount = Number.parseInt(String(normalizedPayload?.patient_count ?? 0), 10) || 0;
    enforceNumericLimit(
      policyContext?.policy?.limits?.maxSyntheticPatientsPerJob,
      patientCount,
      {
        code: 'TEAM_SYNTHETIC_PATIENT_LIMIT_EXCEEDED',
        status: 429,
        message: 'Synthetic patient count exceeds team policy limit',
        details: {
          patientCount,
          maxSyntheticPatientsPerJob: policyContext?.policy?.limits?.maxSyntheticPatientsPerJob
        }
      }
    );
    await consumeTeamRateLimit(
      coreDb,
      policyContext?.teamId,
      'synthetic:jobs_per_hour',
      policyContext?.policy?.limits?.maxSyntheticJobsPerHour,
      3600,
      1
    );
    if (!(normalizedPayload?.dry_run || normalizedPayload?.plan_only) && patientCount > 0) {
      await consumeTeamRateLimit(
        coreDb,
        policyContext?.teamId,
        'synthetic:patients_per_day',
        policyContext?.policy?.limits?.maxSyntheticPatientsPerDay,
        86400,
        patientCount
      );
    }

    // Proactive activation: jobs execute asynchronously, so we must ensure
    // activation exists before enqueueing (not only on submit-time errors).
    if (binding.strategyId) {
      try {
        await service.activateEnvironment(
          binding.envKey,
          binding.strategyId,
          binding.mergedConfig || {},
          {
            domain: binding.domain,
            connectionId: binding.connectionId,
            envKehrnel: environment?.kehrnel || {},
            // Force refresh so runtime picks updated domain target DB config
            // (e.g. openehr -> hdl-team-openehr) instead of stale activation state.
            force: true,
            reason: 'activate-before-synthetic-job-enqueue',
            requestId
          }
        );
      } catch (activationError) {
        if (isActivationStrategyMismatchError(activationError)) {
          await service.upgradeActivation(binding.envKey, binding.domain, {
            connectionId: binding.connectionId,
            envKehrnel: environment?.kehrnel || {},
            requestId,
            reason: 'upgrade-before-synthetic-job-enqueue'
          });
        } else {
          throw activationError;
        }
      }
    }

    const submit = async () =>
      service.submitSyntheticJob(binding.envKey, binding.domain, normalizedPayload, {
        op,
        connectionId: binding.connectionId,
        envKehrnel: environment?.kehrnel || {},
        requestId
      });

    let created;
    try {
      created = await submit();
    } catch (error) {
      if (isActivationMissingError(error)) {
        // Recovery: activate and retry once
        await service.activateEnvironment(
          binding.envKey,
          binding.strategyId,
          binding.mergedConfig || {},
          {
            domain: binding.domain,
            connectionId: binding.connectionId,
            envKehrnel: environment?.kehrnel || {},
            force: true,
            reason: 'activate-before-synthetic-job',
            requestId
          }
        );
        created = await submit();
      } else if (isActivationStrategyMismatchError(error)) {
        // Recovery: upgrade activation and retry once
        await service.upgradeActivation(binding.envKey, binding.domain, {
          connectionId: binding.connectionId,
          envKehrnel: environment?.kehrnel || {},
          requestId,
          reason: 'upgrade-before-synthetic-job'
        });
        created = await submit();
      } else {
        throw error;
      }
    }

    return NextResponse.json(
      {
        environment: {
          id: environment?.id || null,
          name: environment?.name || null,
          envKey: binding.envKey
        },
        domain: binding.domain,
        targetDatabase: binding.targetDatabase || null,
        strategyId: binding.strategyId,
        job: created.job
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('POST /api/synthetic-data/kehrnel/jobs error:', error);
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;
    return NextResponse.json(
      {
        code: error.code || null,
        error: error.message || 'Failed to create synthetic job',
        details: error.details || null
      },
      { status }
    );
  }
}
