import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/workspace/health/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';

const HISTORY_COLLECTION = 'workspace_health_runs';
const INDEX_SIG = `${HISTORY_COLLECTION}|v1`;
const indexStoreKey = '__hdlEnsuredIndexes__';
const ensuredIndexes = globalThis[indexStoreKey] || new Set();
if (!globalThis[indexStoreKey]) globalThis[indexStoreKey] = ensuredIndexes;

/**
 * Workspace Health API
 *
 * Returns a comprehensive health status for the workspace, used by:
 * - Guided Journey checklist on the Overview page
 * - Quick stats widgets
 * - Environment status indicators
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

function getActiveEnvironment(envs = []) {
  if (!envs.length) return null;
  return envs.find(e => e.isActive) || envs[0];
}

function getActiveStrategy(env) {
  if (!env?.strategyLinks?.length) return null;
  // Find the first active strategy link (openEHR by default)
  const link = env.strategyLinks.find(l => l.strategyId) || env.strategyLinks[0];
  if (!link?.strategyId) return null;
  return {
    activeId: link.strategyId,
    name: link.strategyName || link.strategyId,
    protocol: link.domain || 'openEHR'
  };
}

function normalizeCheckResult({ id, title, description, status, details = null, metrics = null }) {
  return {
    id,
    title,
    description,
    status, // pass | fail | warn
    details,
    metrics,
    completed: status === 'pass'
  };
}

async function probeKehrnelEndpoint(url, apiKey, expectedMethod = 'GET') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const startedAt = Date.now();
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    // Non-invasive probe: HEAD should not mutate server state.
    const res = await fetch(url, {
      method: 'HEAD',
      headers,
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startedAt;
    return { ok: true, status: res.status, latencyMs, expectedMethod };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: null,
      latencyMs: Date.now() - startedAt,
      expectedMethod,
      error: err?.name === 'AbortError' ? 'timeout' : (err?.message || 'network error')
    };
  }
}

async function runOperationalChecks({ coreDb, request, activeEnv, activeStrategy }) {
  const checks = [];
  let tenantDb = null;
  let tenantDbError = null;
  let kehrnelConn = null;
  let kehrnelService = null;

  // Core DB ping/read/write
  try {
    await coreDb.command({ ping: 1 });
    checks.push(normalizeCheckResult({
      id: 'core-db-ping',
      title: 'Core DB connectivity',
      description: 'Core database accepts ping/read operations.',
      status: 'pass'
    }));
  } catch (err) {
    checks.push(normalizeCheckResult({
      id: 'core-db-ping',
      title: 'Core DB connectivity',
      description: 'Core database accepts ping/read operations.',
      status: 'fail',
      details: err?.message || 'Ping failed'
    }));
  }

  try {
    await coreDb.collection('_workspace_health_probe').updateOne(
      { _id: 'core' },
      { $set: { updatedAt: new Date() } },
      { upsert: true }
    );
    checks.push(normalizeCheckResult({
      id: 'core-db-write',
      title: 'Core DB write access',
      description: 'Core database permits write operations.',
      status: 'pass'
    }));
  } catch (err) {
    checks.push(normalizeCheckResult({
      id: 'core-db-write',
      title: 'Core DB write access',
      description: 'Core database permits write operations.',
      status: 'fail',
      details: err?.message || 'Write failed'
    }));
  }

  // Core DB stats (best effort)
  try {
    const stats = await coreDb.command({ dbStats: 1 });
    const sizeMB = Number(stats?.dataSize || 0) / (1024 * 1024);
    checks.push(normalizeCheckResult({
      id: 'core-db-stats',
      title: 'Core DB capacity stats',
      description: 'Core database statistics are available.',
      status: 'pass',
      metrics: {
        dataSizeMB: Number.isFinite(sizeMB) ? Number(sizeMB.toFixed(2)) : 0,
        collections: stats?.collections ?? null
      }
    }));
  } catch (err) {
    checks.push(normalizeCheckResult({
      id: 'core-db-stats',
      title: 'Core DB capacity stats',
      description: 'Core database statistics are available.',
      status: 'warn',
      details: err?.message || 'dbStats not available'
    }));
  }

  // Tenant DB checks (only when an active environment is present)
  if (activeEnv?.id) {
    try {
      const tenantCtx = await getActiveTenantDb(request);
      tenantDb = tenantCtx.db;
    } catch (err) {
      tenantDbError = err;
    }

    if (tenantDb) {
      try {
        await tenantDb.command({ ping: 1 });
        checks.push(normalizeCheckResult({
          id: 'tenant-db-ping',
          title: 'Tenant DB connectivity',
          description: 'Selected tenant database accepts ping/read operations.',
          status: 'pass'
        }));
      } catch (err) {
        checks.push(normalizeCheckResult({
          id: 'tenant-db-ping',
          title: 'Tenant DB connectivity',
          description: 'Selected tenant database accepts ping/read operations.',
          status: 'fail',
          details: err?.message || 'Ping failed'
        }));
      }

      try {
        await tenantDb.collection('_workspace_health_probe').updateOne(
          { _id: `env:${activeEnv.id}` },
          { $set: { updatedAt: new Date() } },
          { upsert: true }
        );
        checks.push(normalizeCheckResult({
          id: 'tenant-db-write',
          title: 'Tenant DB write access',
          description: 'Selected tenant database permits write operations.',
          status: 'pass'
        }));
      } catch (err) {
        checks.push(normalizeCheckResult({
          id: 'tenant-db-write',
          title: 'Tenant DB write access',
          description: 'Selected tenant database permits write operations.',
          status: 'fail',
          details: err?.message || 'Write failed'
        }));
      }

      try {
        const tStats = await tenantDb.command({ dbStats: 1 });
        const tSizeMB = Number(tStats?.dataSize || 0) / (1024 * 1024);
        checks.push(normalizeCheckResult({
          id: 'tenant-db-stats',
          title: 'Tenant DB capacity stats',
          description: 'Selected tenant database statistics are available.',
          status: 'pass',
          metrics: {
            dataSizeMB: Number.isFinite(tSizeMB) ? Number(tSizeMB.toFixed(2)) : 0,
            collections: tStats?.collections ?? null
          }
        }));
      } catch (err) {
        checks.push(normalizeCheckResult({
          id: 'tenant-db-stats',
          title: 'Tenant DB capacity stats',
          description: 'Selected tenant database statistics are available.',
          status: 'warn',
          details: err?.message || 'dbStats not available'
        }));
      }
    } else {
      checks.push(normalizeCheckResult({
        id: 'tenant-db-unavailable',
        title: 'Tenant DB access',
        description: 'Tenant DB context resolution for the active environment.',
        status: 'fail',
        details: tenantDbError?.message || 'Tenant DB not available'
      }));
    }
  } else {
    checks.push(normalizeCheckResult({
      id: 'tenant-db-skip',
      title: 'Tenant DB checks',
      description: 'Tenant DB checks run only when an active environment is selected.',
      status: 'warn',
      details: 'No active environment selected'
    }));
  }

  // Kehrnel checks
  try {
    kehrnelService = createKehrnelService(coreDb);
    kehrnelConn = await kehrnelService.resolveConnection({
      envKehrnel: activeEnv?.kehrnel || undefined
    });
  } catch (err) {
    kehrnelConn = null;
  }

  if (!kehrnelConn) {
    checks.push(normalizeCheckResult({
      id: 'kehrnel-config',
      title: 'Kehrnel connection configured',
      description: 'A Kehrnel runtime URL is configured and resolvable.',
      status: 'fail',
      details: 'No Kehrnel connection could be resolved'
    }));
  } else {
    checks.push(normalizeCheckResult({
      id: 'kehrnel-config',
      title: 'Kehrnel connection configured',
      description: 'A Kehrnel runtime URL is configured and resolvable.',
      status: 'pass',
      metrics: { url: kehrnelConn.url }
    }));

    try {
      const health = await kehrnelService.checkHealth({
        envKehrnel: activeEnv?.kehrnel || undefined
      });
      checks.push(normalizeCheckResult({
        id: 'kehrnel-health',
        title: 'Kehrnel health endpoint',
        description: 'Kehrnel runtime responds to /health.',
        status: 'pass',
        metrics: { version: health?.version || null, status: health?.status || 'ok' }
      }));
    } catch (err) {
      checks.push(normalizeCheckResult({
        id: 'kehrnel-health',
        title: 'Kehrnel health endpoint',
        description: 'Kehrnel runtime responds to /health.',
        status: 'fail',
        details: err?.message || 'Health check failed'
      }));
    }

    // Authenticated catalog probe
    try {
      const catalog = await kehrnelService.listStrategies({
        envKehrnel: activeEnv?.kehrnel || undefined
      });
      checks.push(normalizeCheckResult({
        id: 'kehrnel-auth-catalog',
        title: 'Kehrnel auth: strategies catalog',
        description: 'Authenticated call to Kehrnel strategies catalog succeeds.',
        status: 'pass',
        metrics: { strategies: Array.isArray(catalog?.strategies) ? catalog.strategies.length : 0 }
      }));
    } catch (err) {
      checks.push(normalizeCheckResult({
        id: 'kehrnel-auth-catalog',
        title: 'Kehrnel auth: strategies catalog',
        description: 'Authenticated call to Kehrnel strategies catalog succeeds.',
        status: 'fail',
        details: err?.message || 'Catalog call failed'
      }));
    }

    // Environment endpoint probe (auth + activation wiring)
    if (activeEnv?.id && activeStrategy?.protocol) {
      try {
        const endpoints = await kehrnelService.getEndpoints(activeEnv.id, {
          domain: String(activeStrategy.protocol).toLowerCase(),
          envKehrnel: activeEnv?.kehrnel || undefined
        });
        const endpointEntries = endpoints?.endpoints && typeof endpoints.endpoints === 'object'
          ? Object.entries(endpoints.endpoints)
          : [];
        const epCount = endpointEntries.length;
        checks.push(normalizeCheckResult({
          id: 'kehrnel-auth-endpoints',
          title: 'Kehrnel auth: environment endpoints',
          description: 'Authenticated environment endpoint discovery succeeds.',
          status: epCount > 0 ? 'pass' : 'warn',
          metrics: { endpointCount: epCount }
        }));

        // Probe each discovered endpoint (non-invasive HEAD + auth)
        for (const [endpointName, descriptor] of endpointEntries) {
          const endpointUrl = descriptor?.url || null;
          const expectedMethod = String(descriptor?.method || 'GET').toUpperCase();
          if (!endpointUrl || typeof endpointUrl !== 'string') {
            checks.push(normalizeCheckResult({
              id: `kehrnel-endpoint-${endpointName}`,
              title: `Endpoint probe: ${endpointName}`,
              description: 'Endpoint descriptor includes a valid URL.',
              status: 'fail',
              details: 'Missing URL in endpoint descriptor'
            }));
            continue;
          }

          const probe = await probeKehrnelEndpoint(endpointUrl, kehrnelConn.apiKey, expectedMethod);
          let status = 'fail';
          let details = null;

          if (probe.ok) {
            if (probe.status >= 200 && probe.status < 400) {
              status = 'pass';
            } else if (probe.status === 405) {
              // HEAD is disallowed, but endpoint is reachable.
              status = 'pass';
              details = 'HEAD not allowed (expected for some endpoints)';
            } else if (probe.status === 401 || probe.status === 403) {
              status = 'fail';
              details = `Auth failure (${probe.status})`;
            } else if (probe.status === 404) {
              status = 'fail';
              details = 'Endpoint not found (404)';
            } else if (probe.status >= 400 && probe.status < 500) {
              status = 'warn';
              details = `Client response ${probe.status}`;
            } else if (probe.status >= 500) {
              status = 'fail';
              details = `Server response ${probe.status}`;
            } else {
              status = 'warn';
              details = `Unexpected status ${probe.status}`;
            }
          } else {
            status = 'fail';
            details = probe.error || 'Probe failed';
          }

          checks.push(normalizeCheckResult({
            id: `kehrnel-endpoint-${endpointName}`,
            title: `Endpoint probe: ${endpointName}`,
            description: `Auth + reachability probe for ${endpointName} endpoint.`,
            status,
            details,
            metrics: {
              statusCode: probe.status,
              latencyMs: probe.latencyMs,
              method: expectedMethod,
              url: endpointUrl
            }
          }));
        }
      } catch (err) {
        checks.push(normalizeCheckResult({
          id: 'kehrnel-auth-endpoints',
          title: 'Kehrnel auth: environment endpoints',
          description: 'Authenticated environment endpoint discovery succeeds.',
          status: 'fail',
          details: err?.message || 'Endpoint probe failed'
        }));
      }
    } else {
      checks.push(normalizeCheckResult({
        id: 'kehrnel-auth-endpoints',
        title: 'Kehrnel auth: environment endpoints',
        description: 'Authenticated environment endpoint discovery succeeds.',
        status: 'warn',
        details: 'Requires active environment and domain strategy'
      }));
    }
  }

  return checks;
}

async function ensureWorkspaceHealthIndexes(coreDb) {
  if (ensuredIndexes.has(INDEX_SIG)) return;
  const col = coreDb.collection(HISTORY_COLLECTION);
  const indexes = [
    { key: { teamId: 1, createdAt: -1 }, name: 'teamId_createdAt_desc' },
    { key: { userEmail: 1, createdAt: -1 }, name: 'userEmail_createdAt_desc' },
    { key: { workspaceType: 1, createdAt: -1 }, name: 'workspaceType_createdAt_desc' }
  ];

  for (const idx of indexes) {
    try {
      await col.createIndex(idx.key, { name: idx.name, background: true });
    } catch (err) {
      if (err?.code !== 85 && err?.code !== 86) {
        console.warn(`Index creation warning for ${idx.name}:`, err?.message || err);
      }
    }
  }

  ensuredIndexes.add(INDEX_SIG);
}

async function getHealthRunsForScope(coreDb, { mode, team, session, limit = 5 }) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 5, 25));
  const query = mode === 'team'
    ? { workspaceType: 'team', teamId: team?._id?.toString() || null }
    : { workspaceType: 'individual', userEmail: session.user.email?.toLowerCase() };

  const rows = await coreDb.collection(HISTORY_COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .project({
      _id: 1,
      createdAt: 1,
      generatedAt: 1,
      workspaceType: 1,
      workspaceName: 1,
      environmentId: 1,
      environmentName: 1,
      journey: 1
    })
    .toArray()
    .catch(() => []);

  return rows.map((row) => ({
    id: row._id?.toString?.() || null,
    createdAt: row.createdAt || row.generatedAt || null,
    generatedAt: row.generatedAt || null,
    workspaceType: row.workspaceType || null,
    workspaceName: row.workspaceName || null,
    environmentId: row.environmentId || null,
    environmentName: row.environmentName || null,
    journey: row.journey || null
  }));
}

async function buildWorkspaceHealth({ request, session, persistRun = false, historyLimit = 5 }) {
  const coreDb = await getCoreDb();
  await ensureWorkspaceHealthIndexes(coreDb);
  const { mode, user, team } = await loadScope(coreDb, session.user.email);

  const envs = mode === 'team' ? (team?.environments || []) : (user?.environments || []);
  const activeEnv = getActiveEnvironment(envs);
  const activeStrategy = getActiveStrategy(activeEnv);

  // Base response structure
  const health = {
    environment: {
      activeId: activeEnv?.id || null,
      name: activeEnv?.name || null,
      connected: !!activeEnv?.id,
      count: envs.length,
      lastPingAt: new Date().toISOString()
    },
    strategy: {
      activeId: activeStrategy?.activeId || null,
      name: activeStrategy?.name || null,
      protocol: activeStrategy?.protocol || null
    },
    models: {
      importedCount: 0,
      contextDefinitionsCount: 0,
      lastUpdatedAt: null
    },
    data: {
      syntheticPatients: 0,
      lastSuccessfulRunAt: null,
      hasSuccessfulMappingRun: false
    },
    queries: {
      savedCount: 0,
      lastExecutedAt: null,
      lastExecutionStatus: null
    },
    translations: {
      count: 0,
      lastGeneratedAt: null
    },
    api: {
      configured: false,
      kehrnelAvailable: false,
      kehrnelVersion: null
    },
    apps: {
      installed: [],
      availableCount: 3 // Initial apps in catalog
    }
  };

  // If we have an active environment, try to get tenant-specific data
  if (activeEnv?.id) {
    try {
      const { db } = await getActiveTenantDb(request);

      // Fetch data in parallel
      const [
        templatesCount,
        contextObjectsCount,
        queriesData,
        syntheticMetadata,
        recentTemplate,
        recentQuery
      ] = await Promise.all([
        // Templates count
        db.collection('user-data-models').countDocuments({}),

        // Context objects count
        db.collection('definitions').countDocuments({ type: 'context-object' }).catch(() => 0),

        // Queries data
        db.collection('aql-queries').find({}).toArray(),

        // Synthetic data metadata - get patient count
        db.collection('sample_compositions').aggregate([
          { $group: { _id: '$patient_id' } },
          { $count: 'total' }
        ]).toArray().catch(() => []),

        // Most recent template
        db.collection('user-data-models')
          .find({})
          .sort({ updatedAt: -1 })
          .limit(1)
          .toArray(),

        // Most recent query with execution
        db.collection('aql-queries')
          .find({ strategyValidations: { $exists: true } })
          .sort({ updatedAt: -1 })
          .limit(1)
          .toArray()
      ]);

      // Update models count
      health.models.importedCount = templatesCount;
      health.models.contextDefinitionsCount = contextObjectsCount;
      if (recentTemplate?.[0]?.updatedAt) {
        health.models.lastUpdatedAt = recentTemplate[0].updatedAt;
      }

      // Update queries stats
      health.queries.savedCount = queriesData.length;

      // Count translations (queries with done status)
      const translatedQueries = queriesData.filter(q =>
        q.status === 'done' || q.status === 'needs_improvement'
      );
      health.translations.count = translatedQueries.length;

      if (recentQuery?.[0]) {
        health.queries.lastExecutedAt = recentQuery[0].updatedAt;
        health.queries.lastExecutionStatus = recentQuery[0].status === 'done' ? 'success' : 'pending';
        health.translations.lastGeneratedAt = recentQuery[0].updatedAt;
      }

      // Update synthetic data stats
      if (syntheticMetadata?.[0]?.total) {
        health.data.syntheticPatients = syntheticMetadata[0].total;
      }

      // Check for successful synthetic runs (Kehrnel-backed jobs in core DB)
      const successfulSyntheticJob = await coreDb.collection('synthetic_data_jobs')
        .find({
          env_id: activeEnv.id,
          type: 'synthetic',
          status: 'completed'
        })
        .sort({ completed_at: -1, updated_at: -1, created_at: -1 })
        .limit(1)
        .toArray()
        .catch(() => []);

      if (successfulSyntheticJob?.[0]) {
        health.data.lastSuccessfulRunAt =
          successfulSyntheticJob[0].completed_at ||
          successfulSyntheticJob[0].updated_at ||
          successfulSyntheticJob[0].created_at ||
          null;
      }

    } catch (tenantError) {
      // If tenant DB fails, we still return what we have from core DB
      console.warn('Could not fetch tenant data:', tenantError.message);
    }

    // Check Kehrnel config
    if (activeEnv.kehrnel) {
      health.api.configured = !activeEnv.kehrnel.useDefault || !!activeEnv.kehrnel.apiUrl;
      health.api.kehrnelAvailable = true;
    }
  }

  // Calculate journey completion with explicit step descriptions
  const journeySteps = await runOperationalChecks({
    coreDb,
    request,
    activeEnv,
    activeStrategy
  });
  const completedSteps = journeySteps.filter((step) => step.status === 'pass').length;
  const totalSteps = journeySteps.length;
  const generatedAt = new Date();

  const responsePayload = {
    workspace: {
      type: mode,
      name: mode === 'team' ? team?.name : 'Personal Workspace'
    },
    ...health,
    journey: {
      completedSteps,
      totalSteps,
      percentage: Math.round((completedSteps / totalSteps) * 100),
      steps: journeySteps
    },
    generatedAt: generatedAt.toISOString()
  };

  if (persistRun) {
    await coreDb.collection(HISTORY_COLLECTION).insertOne({
      createdAt: generatedAt,
      generatedAt: generatedAt.toISOString(),
      userEmail: session.user.email?.toLowerCase(),
      userId: user?._id?.toString?.() || null,
      workspaceType: mode,
      workspaceName: responsePayload.workspace.name,
      teamId: team?._id?.toString?.() || null,
      environmentId: health.environment.activeId || null,
      environmentName: health.environment.name || null,
      journey: responsePayload.journey,
      snapshot: health
    });
  }

  const healthRuns = await getHealthRunsForScope(coreDb, { mode, team, session, limit: historyLimit });
  return {
    ...responsePayload,
    healthRuns
  };
}

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const healthPayload = await buildWorkspaceHealth({
      request,
      session,
      persistRun: false,
      historyLimit: 5
    });

    return NextResponse.json(healthPayload);
  } catch (error) {
    console.error('GET /api/workspace/health error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace health' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const healthPayload = await buildWorkspaceHealth({
      request,
      session,
      persistRun: true,
      historyLimit: 10
    });

    return NextResponse.json(healthPayload, { status: 201 });
  } catch (error) {
    console.error('POST /api/workspace/health error:', error);
    return NextResponse.json(
      { error: 'Failed to run workspace health check' },
      { status: 500 }
    );
  }
}
