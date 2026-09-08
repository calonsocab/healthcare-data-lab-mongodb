import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { loadEnvironmentScope } from '@/lib/environments/access';
import {
  getStrategyLinkId,
  normalizeSearchRefresh,
  supportsSearchRefresh,
} from '@/lib/environments/searchRefresh';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { normalizeDomain, resolveRuntimeContext } from '@/lib/kehrnel/runtimeContext';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';

function resolveCollectionNames(link = null) {
  const config = link?.mergedConfig || link?.kehrnel?.config || {};
  return {
    compositions: config?.collections?.compositions?.name || 'compositions_rps',
    search: config?.collections?.search?.name || 'compositions_search',
  };
}

async function updateLinkSearchRefresh({
  coreDb,
  userEmail,
  envId,
  domain,
  strategyId,
  updater,
}) {
  const scope = await loadEnvironmentScope(coreDb, userEmail);
  if (!scope?.mode) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const holder = scope.mode === 'team' ? (scope.team || {}) : (scope.user || {});
  const environments = Array.isArray(holder.environments) ? [...holder.environments] : [];
  const envIdx = environments.findIndex((item) => item.id === envId);
  if (envIdx < 0) {
    throw Object.assign(new Error('Environment not found'), { status: 404 });
  }

  const env = { ...environments[envIdx] };
  const strategyLinks = Array.isArray(env.strategyLinks) ? [...env.strategyLinks] : [];
  const normalizedDomain = normalizeDomain(domain);

  let linkIdx = strategyLinks.findIndex((link) => normalizeDomain(link?.domain) === normalizedDomain);
  if (linkIdx < 0 && strategyId) {
    linkIdx = strategyLinks.findIndex((link) => getStrategyLinkId(link) === strategyId);
  }
  if (linkIdx < 0) {
    throw Object.assign(new Error(`No strategy active for ${normalizedDomain || domain}`), { status: 404 });
  }

  const current = strategyLinks[linkIdx];
  const next = updater(current);
  strategyLinks[linkIdx] = next;
  env.strategyLinks = strategyLinks;
  env.updatedAt = new Date().toISOString();
  environments[envIdx] = env;

  const targetCol = scope.mode === 'team' ? coreDb.collection('teams') : coreDb.collection('users');
  const filter = scope.mode === 'team' ? { _id: scope.user.teamId } : { _id: scope.user._id };
  await targetCol.updateOne(filter, { $set: { environments } });

  return next;
}

export async function POST(req) {
  let envId = null;
  let domain = 'openEHR';
  let strategyId = null;
  let userEmail = null;
  let userLabel = null;

  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;
    userEmail = session.user.email || null;
    userLabel = session.user.email || session.user.name || null;

    const body = await req.json().catch(() => ({}));
    envId = body.envId || null;
    domain = body.domain || 'openEHR';
    strategyId = body.strategyId || null;

    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const envGate = await enforceEnvironmentControl(coreDb, envId, ENV_CONTROL_CAPABILITY.OPS);
    if (envGate) return envGate;

    const tenant = await getActiveTenantDb(req, { session, coreDb, envId });
    const environment = tenant.environment;
    const tenantDb = tenant.db;
    const normalizedDomain = normalizeDomain(domain);

    const strategyLinks = Array.isArray(environment?.strategyLinks) ? environment.strategyLinks : [];
    let link = strategyLinks.find((item) => normalizeDomain(item?.domain) === normalizedDomain) || null;
    if (!link && strategyId) {
      link = strategyLinks.find((item) => getStrategyLinkId(item) === strategyId) || null;
    }

    if (!link) {
      return NextResponse.json({ error: `No strategy active for ${normalizedDomain || domain}` }, { status: 404 });
    }

    const resolvedStrategyId = getStrategyLinkId(link);
    if (!resolvedStrategyId || !supportsSearchRefresh(link)) {
      return NextResponse.json({ error: 'This strategy does not support search refresh' }, { status: 400 });
    }

    const refreshState = normalizeSearchRefresh(link.searchRefresh);
    if (!refreshState?.required) {
      return NextResponse.json({ error: 'No search refresh is currently required for this strategy' }, { status: 400 });
    }

    const { compositions: compositionsCollection, search: searchCollection } = resolveCollectionNames(link);
    const totalCompositions = await tenantDb.collection(compositionsCollection).countDocuments({});

    const runtime = await resolveRuntimeContext({
      coreDb,
      userEmail,
      envId,
      requestedDomain: normalizedDomain,
      strategyId: resolvedStrategyId,
      requestedConnectionId: body.connectionId || null,
    });
    const resolvedDomain = runtime.domain || normalizedDomain;
    const envKey = runtime.envKey || envId;
    const service = createKehrnelService(coreDb);
    const runtimeOptions = {
      connectionId: runtime.connectionId || body.connectionId || null,
      envKehrnel: runtime.envKehrnel || {},
      domain: resolvedDomain,
      autoActivate: runtime.autoActivate || null,
    };

    const created = await service.submitSyntheticJob(
      envKey,
      resolvedDomain,
      {
        batch_size: Math.max(totalCompositions, 1),
        clear_existing: true,
      },
      {
        ...runtimeOptions,
        op: 'rebuild_slim_search_collection',
      }
    );

    const queuedAt = new Date().toISOString();
    const job = created?.job || null;

    const updatedLink = await updateLinkSearchRefresh({
      coreDb,
      userEmail,
      envId,
      domain: normalizedDomain,
      strategyId: resolvedStrategyId,
      updater: (current) => ({
        ...current,
        searchRefresh: {
          ...(normalizeSearchRefresh(current?.searchRefresh) || refreshState),
          lastAttemptAt: queuedAt,
          lastAttemptBy: userLabel,
          lastError: null,
          jobId: job?.id || job?.jobId || job?._id || null,
          jobStatus: job?.status || 'queued',
          jobQueuedAt: queuedAt,
        },
      }),
    });

    return NextResponse.json({
      success: true,
      message: 'Search projection refresh job queued',
      counts: {
        compositions: totalCompositions,
      },
      collections: {
        compositions: compositionsCollection,
        search: searchCollection,
      },
      job,
      strategyLink: updatedLink,
    }, { status: 202 });
  } catch (error) {
    console.error('POST /api/environments/strategy/search-refresh error:', error);

    if (envId) {
      try {
        const coreDb = await getCoreDb();
        if (userEmail) {
          await updateLinkSearchRefresh({
            coreDb,
            userEmail,
            envId,
            domain: normalizeDomain(domain) || 'openehr',
            strategyId,
            updater: (current) => ({
              ...current,
              searchRefresh: {
                ...(normalizeSearchRefresh(current?.searchRefresh) || {
                  required: true,
                  reason: 'analytics-template-updated',
                }),
                lastAttemptAt: new Date().toISOString(),
                lastAttemptBy: userLabel,
                lastError: error.message || 'Search refresh failed',
              },
            }),
          });
        }
      } catch (refreshError) {
        console.warn('Could not persist search refresh failure state:', refreshError.message);
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to refresh strategy search projections' },
      { status: error.status || 500 }
    );
  }
}
