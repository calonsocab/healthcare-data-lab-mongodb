import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/environments/strategy/route.js
// Endpoints for activating strategies and updating config overrides per environment
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { resolveDomainTargetDatabase, sanitizeDomainDatabases } from '@/lib/environments/domainDatabases';
import {
  buildActivationWorkflow,
  mergeCoherenceValidationsIntoStrategyLinks,
  mergeValidationIntoWorkflow,
  validateStrategyLinkCoherence,
} from '@/lib/environments/strategyActivationStatus';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';
import {
  buildKehrnelActivationConfig,
  deepMerge,
  normalizeKehrnelConfigInput,
  withTargetDatabaseConfig,
  wrapKehrnelManifest
} from '@/lib/strategies/kehrnelManifestAdapter';

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

function requestIdFrom(req) {
  return req.headers.get('x-request-id') || req.headers.get('request-id') || null;
}

/**
 * PUT - Activate a strategy for a domain on an environment
 * Body: { envId, strategyId, domain, configOverrides? }
 */
export async function PUT(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const service = createKehrnelService(coreDb);
    const { mode, user, team } = await loadScope(coreDb, session.user.email);
    const data = await req.json();
    const requestId = requestIdFrom(req);

    const { envId, strategyId, domain = 'openEHR', configOverrides = {} } = data;

    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }

    const envGate = await enforceEnvironmentControl(coreDb, envId, ENV_CONTROL_CAPABILITY.OPS);
    if (envGate) return envGate;

    if (!strategyId) {
      return NextResponse.json({ error: 'strategyId is required' }, { status: 400 });
    }
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 });
    }

    // Strategy definitions come from Kehrnel only
    let strategyName = strategyId;
    let kehrnelId = strategyId;
    let defaults = {};
    let manifest = null;

    // Fetch strategy manifest from Kehrnel to get defaults
    try {
      manifest = await service.getStrategy(strategyId);
      if (manifest) {
        strategyName = manifest.name || manifest.display_name || strategyId;
        kehrnelId = manifest.id || manifest.strategy_id || strategyId;
        defaults = manifest.default_config || {};
      }
    } catch (err) {
      // Strategy may not exist in catalog or Kehrnel may be unavailable
      // Continue with provided strategyId as kehrnelId
      console.warn('Could not fetch strategy manifest from Kehrnel:', err.message);
    }

    // Get current environments
    const targetCol = mode === 'team' ? coreDb.collection('teams') : coreDb.collection('users');
    const filter = mode === 'team' ? { _id: user.teamId } : { _id: user._id };
    const holder = mode === 'team' ? (team || {}) : (user || {});
    const environments = Array.isArray(holder.environments) ? [...holder.environments] : [];

    // Find the target environment
    const envIdx = environments.findIndex(e => e.id === envId);
    if (envIdx < 0) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const env = environments[envIdx];
    const strategyLinks = Array.isArray(env.strategyLinks) ? [...env.strategyLinks] : [];

    const existingLinkIdx = strategyLinks.findIndex(
      l => normalizeDomain(l.domain) === normalizedDomain
    );
    const replacingLink = existingLinkIdx >= 0 ? strategyLinks[existingLinkIdx] : null;

    // Merge config (default + overrides) for use in downstream activation (Kehrnel)
    const { targetDatabase, domainDatabases } = resolveDomainTargetDatabase(
      env,
      normalizedDomain,
      replacingLink?.targetDatabase
    );
    const normalizedOverrides = manifest
      ? normalizeKehrnelConfigInput(manifest, configOverrides || {})
      : (configOverrides || {});
    const mergedConfig = manifest
      ? buildKehrnelActivationConfig(manifest, normalizedOverrides, targetDatabase)
      : withTargetDatabaseConfig(
          deepMerge(defaults || {}, normalizedOverrides),
          targetDatabase
        );

    // Get environment's kehrnel config for connection resolution
    const envKehrnel = env.kehrnel || {};
    const envKey = envKehrnel.envKey || envId;

    // If strategy maps to Kehrnel, activate there first using new KehrnelService
    let kehrnelLink = null;
    if (kehrnelId) {
      try {
        const kehrnelResult = await service.activateEnvironment(
          envKey,
          kehrnelId,
          mergedConfig,
          {
            connectionId: envKehrnel.connectionId,
            envKehrnel,
            domain: normalizedDomain,
            force: !!replacingLink,
            reason: replacingLink ? `replace ${replacingLink.strategyId || 'previous'} -> ${kehrnelId}` : undefined,
            requestId,
          }
        );

        const confirmedAt =
          typeof data.configurationConfirmedAt === 'string' && data.configurationConfirmedAt.trim()
            ? data.configurationConfirmedAt
            : new Date().toISOString();
        const activationMeta = toActivationMetadata(kehrnelResult, confirmedAt);

        const draftKehrnelLink = {
          connectionId: kehrnelResult.connection?.connectionId || null,
          runtimeUrl: kehrnelResult.connection?.url || null,
          strategyId: kehrnelId,
          activatedAt: activationMeta.activatedAt,
          lastStatus: activationMeta.lastStatus,
          config: mergedConfig,
          activationId: activationMeta.activationId,
          manifestDigest: activationMeta.manifestDigest,
          configHash: activationMeta.configHash,
          strategyVersion: activationMeta.strategyVersion,
          replaced: activationMeta.replaced,
          previousActivationId: activationMeta.previousActivationId,
          runtimeStatus: activationMeta.lastStatus,
          initialization: kehrnelResult.initialization || null,
          alreadyActive: !!kehrnelResult.alreadyActive,
          engine: kehrnelResult.engine || null,
          bundleId: kehrnelResult.bundle_id || kehrnelResult.bundleId || null,
          bundleDigest: kehrnelResult.bundle_digest || kehrnelResult.bundleDigest || null,
          targetDatabase,
          // Legacy fields for backward compatibility
          endpoint: kehrnelResult.connection?.url,
          endpointName: kehrnelResult.connection?.name,
        };

        const provisionalLink = {
          ...(replacingLink || {}),
          domain: replacingLink?.domain || domain || normalizedDomain,
          strategyId: kehrnelId || strategyId,
          strategyName: strategyName || strategyId,
          activationId: draftKehrnelLink.activationId || null,
          manifestDigest: draftKehrnelLink.manifestDigest || null,
          configHash: draftKehrnelLink.configHash || null,
          strategyVersion: draftKehrnelLink.strategyVersion || null,
          targetDatabase: targetDatabase || null,
          configOverrides: normalizedOverrides,
          mergedConfig,
          contexts: replacingLink?.contexts || {
            synthetic: true,
            query: true,
            api: true,
          },
          notes: replacingLink?.notes || '',
          searchRefresh:
            replacingLink &&
            (replacingLink?.strategyId === (kehrnelId || strategyId) ||
              replacingLink?.kehrnel?.strategyId === (kehrnelId || strategyId))
              ? replacingLink.searchRefresh || null
              : null,
          kehrnel: draftKehrnelLink,
        };

        const coherence = await validateStrategyLinkCoherence({
          service,
          env: {
            ...env,
            domainDatabases: sanitizeDomainDatabases(domainDatabases),
          },
          envId,
          link: provisionalLink,
          requestId,
        });
        const activationWorkflow = buildActivationWorkflow({
          confirmedAt,
          activation: kehrnelResult,
          initialization: kehrnelResult.initialization || null,
          validation: coherence,
        });

        kehrnelLink = {
          ...draftKehrnelLink,
          lastStatus: coherence.status || activationMeta.lastStatus,
          endpoints: coherence.endpoints || kehrnelResult.endpoints || null,
          endpointsSnapshot: coherence.endpoints || kehrnelResult.endpoints || null,
          coherence,
          activationWorkflow,
        };
      } catch (err) {
        console.error('Kehrnel activation error:', err.message);
        kehrnelLink = {
          strategyId: kehrnelId,
          lastStatus: 'error',
          error: err.message,
          code: err.code,
          details: err.details,
          status: err.status || 500,
          activatedAt: new Date().toISOString(),
        };
        return NextResponse.json(
          { error: { code: err.code || 'KEHRNEL_ACTIVATION_FAILED', message: err.message || 'Activation failed', details: err.details } },
          { status: err.status || 502 }
        );
      }
    }

    // Create the new link
    const newLink = {
      id: `link-${normalizedDomain}-${Date.now()}`,
      domain: replacingLink?.domain || domain || normalizedDomain,
      strategyId: kehrnelId || strategyId,
      strategyName: strategyName || strategyId,
      activationId: kehrnelLink?.activationId || null,
      manifestDigest: kehrnelLink?.manifestDigest || null,
      configHash: kehrnelLink?.configHash || null,
      strategyVersion: kehrnelLink?.strategyVersion || null,
      targetDatabase: targetDatabase || null,
      configOverrides: normalizedOverrides,
      mergedConfig,
      contexts: {
        synthetic: true,
        query: true,
        api: true,
      },
      notes: '',
      searchRefresh:
        replacingLink &&
        (replacingLink?.strategyId === (kehrnelId || strategyId) ||
          replacingLink?.kehrnel?.strategyId === (kehrnelId || strategyId))
          ? replacingLink.searchRefresh || null
          : null,
      kehrnel: kehrnelLink,
    };

    // Replace or add link for this domain (always one per domain)
    if (existingLinkIdx >= 0) {
      strategyLinks[existingLinkIdx] = newLink;
    } else {
      strategyLinks.push(newLink);
    }

    // Update environment
    env.domainDatabases = sanitizeDomainDatabases(domainDatabases);
    env.strategyLinks = strategyLinks;
    env.updatedAt = new Date().toISOString();
    environments[envIdx] = env;

    await targetCol.updateOne(filter, { $set: { environments } });

    return NextResponse.json({
      success: true,
      environment: env,
      strategyLink: newLink,
    });
  } catch (error) {
    console.error('PUT /api/environments/strategy error:', error);
    return NextResponse.json({ error: error.message || 'Failed to activate strategy' }, { status: 500 });
  }
}

/**
 * PATCH - Update config overrides for an existing strategy link
 * Body: { envId, domain, configOverrides }
 */
export async function PATCH(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const service = createKehrnelService(coreDb);
    const { mode, user, team } = await loadScope(coreDb, session.user.email);
    const data = await req.json();
    const requestId = requestIdFrom(req);

    const { envId, domain = 'openEHR', configOverrides, strategyId = null } = data;

    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }

    const envGate = await enforceEnvironmentControl(coreDb, envId, ENV_CONTROL_CAPABILITY.OPS);
    if (envGate) return envGate;

    if (configOverrides === undefined) {
      return NextResponse.json({ error: 'configOverrides is required' }, { status: 400 });
    }
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 });
    }

    // Get current environments
    const targetCol = mode === 'team' ? coreDb.collection('teams') : coreDb.collection('users');
    const filter = mode === 'team' ? { _id: user.teamId } : { _id: user._id };
    const holder = mode === 'team' ? (team || {}) : (user || {});
    const environments = Array.isArray(holder.environments) ? [...holder.environments] : [];

    // Find the target environment
    const envIdx = environments.findIndex(e => e.id === envId);
    if (envIdx < 0) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const env = environments[envIdx];
    const strategyLinks = Array.isArray(env.strategyLinks) ? [...env.strategyLinks] : [];

    // Find the strategy link for this domain (fallback to first if only one exists or matching strategyId)
    let linkIdx = strategyLinks.findIndex(
      l => normalizeDomain(l.domain) === normalizedDomain
    );
    if (linkIdx < 0 && strategyLinks.length === 1) {
      linkIdx = 0;
    }
    if (linkIdx < 0 && strategyId) {
      linkIdx = strategyLinks.findIndex(l => l.strategyId?.toString() === strategyId.toString());
    }
    if (linkIdx < 0) {
      return NextResponse.json({ error: `No strategy active for ${normalizedDomain}` }, { status: 404 });
    }

    const link = strategyLinks[linkIdx];
    const envKehrnel = env.kehrnel || {};
    const envKey = envKehrnel.envKey || envId;
    const resolvedStrategyId = link?.kehrnel?.strategyId || link?.strategyId || strategyId;
    if (!resolvedStrategyId) {
      return NextResponse.json({ error: 'strategyId could not be resolved for this domain' }, { status: 400 });
    }

    // Fetch defaults and reactivate so overrides are actually applied at runtime.
    let defaults = {};
    let manifest = null;
    try {
      manifest = await service.getStrategy(resolvedStrategyId, {
        connectionId: envKehrnel.connectionId,
        envKehrnel
      });
      defaults = manifest?.default_config || {};
    } catch (err) {
      console.warn('Could not fetch strategy defaults during PATCH activation:', err.message);
    }
    const { targetDatabase, domainDatabases } = resolveDomainTargetDatabase(
      env,
      normalizedDomain,
      link?.targetDatabase
    );
    const normalizedOverrides = manifest
      ? normalizeKehrnelConfigInput(manifest, configOverrides || {})
      : (configOverrides || {});
    const sourceConfig = deepMerge(
      link?.mergedConfig || link?.kehrnel?.config || {},
      normalizedOverrides
    );
    const mergedConfig = manifest
      ? buildKehrnelActivationConfig(manifest, sourceConfig, targetDatabase)
      : withTargetDatabaseConfig(
          deepMerge(defaults || {}, sourceConfig),
          targetDatabase
        );

    let activationMeta = null;
    try {
      const activationResult = await service.activateEnvironment(
        envKey,
        resolvedStrategyId,
        mergedConfig,
        {
          connectionId: envKehrnel.connectionId || link?.kehrnel?.connectionId,
          envKehrnel,
          domain: normalizeDomain(link?.domain || normalizedDomain),
          force: true,
          reason: 'update-config-overrides',
          requestId,
        }
      );
      activationMeta = toActivationMetadata(activationResult, new Date().toISOString());

      const draftLink = {
        ...link,
        targetDatabase: targetDatabase || link?.targetDatabase || null,
        configOverrides: normalizedOverrides,
        mergedConfig,
        activationId: activationMeta.activationId,
        manifestDigest: activationMeta.manifestDigest,
        configHash: activationMeta.configHash,
        strategyVersion: activationMeta.strategyVersion,
        kehrnel: {
          ...(link.kehrnel || {}),
          strategyId: resolvedStrategyId,
          targetDatabase: targetDatabase || link?.kehrnel?.targetDatabase || null,
          config: mergedConfig,
          initialization: activationResult.initialization || link?.kehrnel?.initialization || null,
          runtimeStatus: activationMeta.lastStatus,
          alreadyActive: !!activationResult.alreadyActive,
          ...activationMeta
        }
      };

      const coherence = await validateStrategyLinkCoherence({
        service,
        env: {
          ...env,
          domainDatabases: sanitizeDomainDatabases(domainDatabases),
        },
        envId,
        link: draftLink,
        requestId,
      });
      const activationWorkflow = buildActivationWorkflow({
        confirmedAt:
          link?.kehrnel?.activationWorkflow?.confirmedAt ||
          data.configurationConfirmedAt ||
          new Date().toISOString(),
        activation: activationResult,
        initialization: activationResult.initialization || null,
        validation: coherence,
      });

      strategyLinks[linkIdx] = {
        ...draftLink,
        kehrnel: {
          ...(draftLink.kehrnel || {}),
          endpoints: coherence.endpoints || link?.kehrnel?.endpoints || null,
          endpointsSnapshot: coherence.endpoints || link?.kehrnel?.endpointsSnapshot || null,
          coherence,
          activationWorkflow,
          lastStatus: coherence.status || activationMeta.lastStatus,
        }
      };
    } catch (err) {
      console.error('Kehrnel activation error during PATCH:', err.message);
      return NextResponse.json(
        { error: { code: err.code || 'KEHRNEL_ACTIVATION_FAILED', message: err.message || 'Activation failed', details: err.details } },
        { status: err.status || 502 }
      );
    }

    // Update environment
    env.domainDatabases = sanitizeDomainDatabases(domainDatabases);
    env.strategyLinks = strategyLinks;
    env.updatedAt = new Date().toISOString();
    environments[envIdx] = env;

    await targetCol.updateOne(filter, { $set: { environments } });

    return NextResponse.json({
      success: true,
      environment: env,
      strategyLink: strategyLinks[linkIdx],
    });
  } catch (error) {
    console.error('PATCH /api/environments/strategy error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update config' }, { status: 500 });
  }
}

/**
 * POST - Validate the coherence of active strategy links against Kehrnel
 * Body: { envId, domain? }
 */
export async function POST(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const service = createKehrnelService(coreDb);
    const { mode, user, team } = await loadScope(coreDb, session.user.email);
    const data = await req.json().catch(() => ({}));
    const requestId = requestIdFrom(req);

    const { envId, domain = null } = data || {};
    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }

    const envGate = await enforceEnvironmentControl(coreDb, envId, ENV_CONTROL_CAPABILITY.OPS);
    if (envGate) return envGate;

    const normalizedDomain = domain ? normalizeDomain(domain) : null;
    if (domain && !normalizedDomain) {
      return NextResponse.json({ error: 'domain is invalid' }, { status: 400 });
    }

    const targetCol = mode === 'team' ? coreDb.collection('teams') : coreDb.collection('users');
    const filter = mode === 'team' ? { _id: user.teamId } : { _id: user._id };
    const holder = mode === 'team' ? (team || {}) : (user || {});
    const environments = Array.isArray(holder.environments) ? [...holder.environments] : [];
    const envIdx = environments.findIndex((item) => item.id === envId);
    if (envIdx < 0) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const env = environments[envIdx];
    const strategyLinks = Array.isArray(env.strategyLinks) ? [...env.strategyLinks] : [];
    const validations = [];

    for (const link of strategyLinks) {
      if (normalizedDomain && normalizeDomain(link?.domain) !== normalizedDomain) {
        continue;
      }

      const coherence = await validateStrategyLinkCoherence({
        service,
        env,
        envId,
        link,
        requestId,
      });

      validations.push({
        domain: normalizeDomain(link?.domain),
        expectedActivationId: link?.kehrnel?.activationId || link?.activationId || null,
        expectedStrategyId: link?.kehrnel?.strategyId || link?.strategyId || null,
        expectedConfigHash: link?.kehrnel?.configHash || link?.configHash || null,
        expectedManifestDigest: link?.kehrnel?.manifestDigest || link?.manifestDigest || null,
        coherence,
      });
    }

    const latestHolder = await targetCol.findOne(filter, { projection: { environments: 1 } });
    const latestEnvironments = Array.isArray(latestHolder?.environments) ? [...latestHolder.environments] : [];
    const latestEnvIdx = latestEnvironments.findIndex((item) => item.id === envId);
    if (latestEnvIdx < 0) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const latestEnv = latestEnvironments[latestEnvIdx];
    const mergeResult = mergeCoherenceValidationsIntoStrategyLinks(
      latestEnv?.strategyLinks || [],
      validations
    );

    let responseEnv = latestEnv;
    if (mergeResult.changed) {
      const updatedAt = new Date().toISOString();
      responseEnv = {
        ...latestEnv,
        strategyLinks: mergeResult.strategyLinks,
        updatedAt,
      };

      await targetCol.updateOne(
        {
          ...filter,
          'environments.id': envId,
        },
        {
          $set: {
            'environments.$.strategyLinks': mergeResult.strategyLinks,
            'environments.$.updatedAt': updatedAt,
          }
        }
      );
    }

    return NextResponse.json({
      success: true,
      environment: responseEnv,
      results: mergeResult.results,
    });
  } catch (error) {
    console.error('POST /api/environments/strategy error:', error);
    return NextResponse.json({ error: error.message || 'Failed to validate strategy coherence' }, { status: 500 });
  }
}

/**
 * GET - Get merged config for active strategy (default + overrides)
 * Query: ?envId=xxx&domain=openEHR
 */
export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const envId = searchParams.get('envId');
    const domain = searchParams.get('domain') || 'openEHR';
    const normalizedDomain = normalizeDomain(domain);

    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const { mode, user, team } = await loadScope(coreDb, session.user.email);
    const holder = mode === 'team' ? (team || {}) : (user || {});
    const environments = Array.isArray(holder.environments) ? holder.environments : [];

    // Find environment
    const env = environments.find(e => e.id === envId);
    if (!env) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    // Find strategy link
    const link = (env.strategyLinks || []).find(l => normalizeDomain(l.domain) === normalizedDomain);
    if (!link) {
      return NextResponse.json({ error: `No strategy active for ${domain}` }, { status: 404 });
    }

    // Fetch strategy from Kehrnel to get defaults
    let defaultConfig = {};
    let blueprint = null;
    let strategyName = link.strategyName;
    const sourceConfig = deepMerge(
      link?.mergedConfig || link?.kehrnel?.config || {},
      link.configOverrides || {}
    );
    let mergedConfig = deepMerge(defaultConfig || {}, sourceConfig);
    const targetDatabase = link.targetDatabase || env?.domainDatabases?.[normalizedDomain] || env?.database || null;

    try {
      const service = createKehrnelService(coreDb);
      const manifest = await service.getStrategy(link.strategyId);
      if (manifest) {
        defaultConfig = manifest.default_config || {};
        blueprint = wrapKehrnelManifest(manifest, link.configOverrides || {}).blueprint;
        mergedConfig = buildKehrnelActivationConfig(
          manifest,
          sourceConfig,
          targetDatabase
        );
        strategyName = manifest.name || manifest.display_name || link.strategyName;
      }
    } catch (err) {
      console.warn('Could not fetch strategy from Kehrnel for config:', err.message);
      // Continue with defaults from link
    }

    return NextResponse.json({
      strategyId: link.strategyId,
      strategyName: strategyName || link.strategyId,
      domain: link.domain,
      targetDatabase,
      defaultConfig,
      configOverrides: link.configOverrides || {},
      mergedConfig,
      blueprint,
    });
  } catch (error) {
    console.error('GET /api/environments/strategy error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get config' }, { status: 500 });
  }
}
