import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/environments/[envId]/activate/route.js
/**
 * Activate Strategy for Environment
 *
 * Activates a Kehrnel strategy for a specific HDL environment.
 * Stores activation metadata in the environment's strategyLink.
 */
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '../../../../../../lib/db/coreDb.js';
import { requireAccessibleEnvironment } from '../../../../../../lib/environments/requireEnvironmentAccess.js';
import { createKehrnelService } from '../../../../../../lib/kehrnel/KehrnelService.js';
import {
  resolveDomainTargetDatabase,
  sanitizeDomainDatabases
} from '../../../../../../lib/environments/domainDatabases.js';
import { safeUpstreamError } from '../../../../../../lib/security/api.js';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '../../../../../../lib/security/environmentControls.js';
import {
  buildKehrnelActivationConfig,
  deepMerge,
  normalizeKehrnelConfigInput,
  withTargetDatabaseConfig
} from '../../../../../../lib/strategies/kehrnelManifestAdapter.js';

async function loadScope(coreDb, email) {
  const user = await coreDb.collection('users').findOne({ email });
  if (!user) throw new Error('User not found');
  if (user.teamId && (user.accountType === 'team' || user.accountType === 'demo')) {
    const team = await coreDb.collection('teams').findOne({ _id: user.teamId });
    return { mode: 'team', user, team };
  }
  return { mode: 'individual', user, team: null };
}

function normalizeDomain(domain) {
  return typeof domain === 'string' ? domain.trim().toLowerCase() : '';
}

function toActivationMetadata(result, fallbackActivatedAt) {
  return {
    activationId: result.activationId || null,
    manifestDigest: result.manifestDigest || null,
    configHash: result.configHash || null,
    strategyVersion: result.strategyVersion || null,
    activatedAt: result.activatedAt || fallbackActivatedAt || new Date().toISOString(),
    replaced: !!result.replaced,
    previousActivationId: result.previousActivationId || null,
    lastStatus: result.status || 'ok',
  };
}

/**
 * POST /api/kehrnel/environments/[envId]/activate
 *
 * Activate a strategy for an environment in Kehrnel.
 *
 * Kehrnel API: POST /environments/{envId}/activate
 * Body: { strategy_id, domain, version, config, bindings_ref }
 *
 * HDL Body:
 *   - strategyId: Kehrnel strategy ID (required, e.g., 'openehr.rps_dual')
 *   - domain: Required domain identifier (e.g., 'openEHR', 'fhir')
 *   - config: Merged configuration object (optional)
 *   - tenant: Optional tenant identifier
 *   - connectionId: Specific Kehrnel connection (optional)
 *   - force: optional boolean
 *   - reason: optional string
 *
 * Returns:
 *   - success: boolean
 *   - activationId: Kehrnel activation ID
 *   - environment: Environment identifier used
 *   - strategyId: Strategy activated
 *   - status: Activation status
 *   - endpoints: Computed endpoint URLs
 *   - connection: Connection info (url, name)
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

    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;

    const body = await req.json();
    const {
      strategyId,
      config,
      configOverrides = null,
      tenant,
      connectionId,
      domain,
      force,
      reason,
      version
    } = body;

    if (!strategyId) {
      return NextResponse.json({ error: 'strategyId is required' }, { status: 400 });
    }
    if (!domain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 });
    }
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return NextResponse.json({ error: 'domain is invalid' }, { status: 400 });
    }

    const db = await getCoreDb();
    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(db, session?.user?.email, envId);
      if (!access.ok) return access.response;
    }
    const envGate = await enforceEnvironmentControl(db, envId, ENV_CONTROL_CAPABILITY.OPS);
    if (envGate) return envGate;

    const service = createKehrnelService(db);
    let mode = null;
    let user = null;
    let team = null;
    let targetCol = null;
    let scopeFilter = null;
    let environments = [];
    let envIdx = -1;
    let env = null;
    let envKehrnel = {};
    let envKey = envId;
    let strategyLinks = [];

    try {
      const scope = await loadScope(db, session.user.email);
      mode = scope.mode;
      user = scope.user;
      team = scope.team;
      targetCol = mode === 'team' ? db.collection('teams') : db.collection('users');
      scopeFilter = mode === 'team' ? { _id: user.teamId } : { _id: user._id };
      const holder = mode === 'team' ? (team || {}) : (user || {});
      environments = Array.isArray(holder.environments) ? [...holder.environments] : [];
      envIdx = environments.findIndex((e) => e.id === envId);
      if (envIdx < 0 && !isTestModeBypassEnabled()) {
        return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
      }
      env = envIdx >= 0 ? environments[envIdx] : null;
      envKehrnel = env?.kehrnel || {};
      envKey = envKehrnel.envKey || envId;
      strategyLinks = Array.isArray(env?.strategyLinks) ? [...env.strategyLinks] : [];
    } catch (err) {
      if (!isTestModeBypassEnabled()) {
        throw err;
      }
    }

    const linkIdx = strategyLinks.findIndex((link) => {
      const linkDomain = normalizeDomain(link?.domain);
      if (linkDomain && linkDomain === normalizedDomain) return true;
      return !!link?.strategyId && link.strategyId === strategyId;
    });
    const existingLink = linkIdx >= 0 ? strategyLinks[linkIdx] : null;
    const effectiveConnectionId =
      connectionId ||
      existingLink?.kehrnel?.connectionId ||
      envKehrnel.connectionId ||
      null;

    const { targetDatabase, domainDatabases } = resolveDomainTargetDatabase(
      env,
      normalizedDomain,
      existingLink?.targetDatabase
    );

    const overrides =
      (configOverrides && typeof configOverrides === 'object' && configOverrides) ||
      existingLink?.configOverrides ||
      {};
    const suppliedConfig =
      config && typeof config === 'object'
        ? config
        : {};

    let defaults = {};
    let manifest = null;
    try {
      manifest = await service.getStrategy(strategyId, {
        connectionId: effectiveConnectionId,
        envKehrnel,
      });
      defaults = manifest?.default_config || {};
    } catch (err) {
      console.warn('Could not fetch strategy defaults during activation:', err.message);
    }

    const normalizedOverrides = manifest
      ? normalizeKehrnelConfigInput(manifest, overrides)
      : overrides;

    const sourceConfig = deepMerge(
      deepMerge(existingLink?.mergedConfig || existingLink?.kehrnel?.config || {}, suppliedConfig),
      normalizedOverrides
    );

    let mergedConfig = manifest
      ? buildKehrnelActivationConfig(manifest, sourceConfig, targetDatabase)
      : withTargetDatabaseConfig(deepMerge(defaults, sourceConfig), targetDatabase);

    const result = await service.activateEnvironment(
      envKey,
      strategyId,
      mergedConfig,
      {
        connectionId: effectiveConnectionId,
        tenant,
        domain: normalizedDomain,
        force,
        reason,
        version,
        requestId,
        envKehrnel
      }
    );

    let endpoints = null;
    try {
      const ep = await service.getEndpoints(envKey, {
        connectionId: effectiveConnectionId,
        domain: normalizedDomain,
        envKehrnel
      });
      endpoints = ep.endpoints;
    } catch (err) {
      console.warn('Could not fetch endpoints after activation:', err.message);
    }

    const activationMeta = toActivationMetadata(result, new Date().toISOString());
    const updatedLink = {
      ...(existingLink || {
        id: `link-${normalizedDomain}-${Date.now()}`,
        domain: normalizedDomain
      }),
      domain: existingLink?.domain || domain,
      strategyId: existingLink?.strategyId || strategyId,
      strategyName: existingLink?.strategyName || strategyId,
      activationId: activationMeta.activationId,
      manifestDigest: activationMeta.manifestDigest,
      configHash: activationMeta.configHash,
      strategyVersion: activationMeta.strategyVersion,
      configOverrides: normalizedOverrides,
      targetDatabase: targetDatabase || existingLink?.targetDatabase || null,
      contexts: existingLink?.contexts || { synthetic: true, query: true, api: true },
      notes: existingLink?.notes || '',
      kehrnel: {
        ...(existingLink?.kehrnel || {}),
        connectionId: result.connection?.connectionId || effectiveConnectionId || null,
        runtimeUrl: result.connection?.url || null,
        strategyId,
        targetDatabase: targetDatabase || existingLink?.kehrnel?.targetDatabase || null,
        endpoints: endpoints || result.endpoints || null,
        endpointsSnapshot: endpoints || result.endpoints || null,
        config: mergedConfig || {},
        ...activationMeta,
      }
    };

    if (linkIdx >= 0) {
      strategyLinks[linkIdx] = updatedLink;
    } else {
      strategyLinks.push(updatedLink);
    }

    if (targetCol && scopeFilter && envIdx >= 0) {
      environments[envIdx] = {
        ...env,
        domainDatabases: sanitizeDomainDatabases(domainDatabases),
        strategyLinks,
        updatedAt: new Date().toISOString()
      };
      await targetCol.updateOne(scopeFilter, { $set: { environments, updatedAt: new Date() } });
    }

    try {
      const auditDb = await getCoreDb();
      const collection = auditDb?.collection ? auditDb.collection('audit_events') : null;
      if (collection?.insertOne) {
        await collection.insertOne({
          type: 'activation',
          action: 'activate',
          envId,
          domain: normalizedDomain,
          user: session.user?.email || 'system',
          createdAt: new Date().toISOString(),
          requestId,
          result: {
            activationId: activationMeta.activationId,
            strategyId,
            domain: normalizedDomain,
            targetDatabase: targetDatabase || null,
            strategyVersion: activationMeta.strategyVersion,
            configHash: activationMeta.configHash,
            manifestDigest: activationMeta.manifestDigest,
            replaced: activationMeta.replaced,
            previousActivationId: activationMeta.previousActivationId,
            lastStatus: activationMeta.lastStatus
          }
        });
      }
    } catch (err) {
      console.warn('audit log failed (activate)', err.message);
    }

    return NextResponse.json({
      success: true,
      activationId: result.activationId,
      environment: result.environment,
      strategyId: result.strategyId,
      domain: result.domain || normalizedDomain,
      strategyVersion: result.strategyVersion || null,
      targetDatabase: targetDatabase || null,
      configHash: result.configHash || null,
      manifestDigest: result.manifestDigest || null,
      replaced: !!result.replaced,
      previousActivationId: result.previousActivationId || null,
      status: result.status,
      endpoints: endpoints || result.endpoints || null,
      connection: {
        url: result.connection.url,
        name: result.connection.name,
        connectionId: result.connection.connectionId
      }
    });
  } catch (error) {
    console.error(`POST /api/kehrnel/environments/${params?.envId}/activate error:`, error);
    return safeUpstreamError(error, 'Activation failed');
  }
}
