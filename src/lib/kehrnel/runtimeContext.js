import { resolveDomainTargetDatabase } from '../environments/domainDatabases.js';
import { createKehrnelService } from './KehrnelService.js';
import {
  buildKehrnelActivationConfig,
  deepMerge,
  stableSerialize,
  withTargetDatabaseConfig
} from '../strategies/kehrnelManifestAdapter.js';

export function normalizeDomain(domain) {
  return typeof domain === 'string' ? domain.trim().toLowerCase() : '';
}

async function loadScope(coreDb, email) {
  const user = await coreDb.collection('users').findOne({ email });
  if (!user) return { mode: null, user: null, team: null };
  if (user.teamId && (user.accountType === 'team' || user.accountType === 'demo')) {
    const team = await coreDb.collection('teams').findOne({ _id: user.teamId });
    return { mode: 'team', user, team };
  }
  return { mode: 'individual', user, team: null };
}

export async function resolveRuntimeContext({
  coreDb,
  userEmail,
  envId,
  requestedDomain,
  strategyId,
  requestedConnectionId,
  hydrateStrategyConfig = true
}) {
  const fallbackDomain = normalizeDomain(requestedDomain);
  const fallback = {
    envKey: envId,
    domain: fallbackDomain || null,
    connectionId: requestedConnectionId || null,
    strategyLink: null,
    autoActivate: null,
    envKehrnel: null
  };

  if (!coreDb || !userEmail || !envId) return fallback;

  const { mode, user, team } = await loadScope(coreDb, userEmail);
  if (!mode) return fallback;

  const holder = mode === 'team' ? (team || {}) : (user || {});
  const environments = Array.isArray(holder.environments) ? holder.environments : [];
  const env = environments.find((item) => item.id === envId);
  if (!env) return fallback;

  const links = Array.isArray(env.strategyLinks) ? env.strategyLinks : [];
  let strategyLink = null;

  if (strategyId) {
    strategyLink = links.find((link) =>
      link?.strategyId === strategyId || link?.kehrnel?.strategyId === strategyId
    ) || null;
  }

  if (!strategyLink && fallbackDomain) {
    strategyLink = links.find((link) => normalizeDomain(link?.domain) === fallbackDomain) || null;
  }

  if (!strategyLink && links.length === 1) {
    strategyLink = links[0];
  }

  const resolvedDomain = normalizeDomain(strategyLink?.domain) || fallbackDomain || null;
  const resolvedConnectionId =
    requestedConnectionId ||
    strategyLink?.kehrnel?.connectionId ||
    env?.kehrnel?.connectionId ||
    null;
  const envKey = env?.kehrnel?.envKey || envId;

  const resolvedStrategyId =
    strategyLink?.kehrnel?.strategyId ||
    strategyLink?.strategyId ||
    strategyId ||
    null;
  const linkDomain = normalizeDomain(strategyLink?.domain);
  const linkTargetDatabase = linkDomain && linkDomain === resolvedDomain
    ? strategyLink?.targetDatabase
    : null;
  const { targetDatabase } = resolveDomainTargetDatabase(
    env,
    resolvedDomain,
    linkTargetDatabase
  );
  let resolvedConfig = withTargetDatabaseConfig(
    strategyLink?.mergedConfig ||
      deepMerge(strategyLink?.kehrnel?.config || {}, strategyLink?.configOverrides || {}),
    targetDatabase
  );
  let requiresRefresh = false;

  if (
    hydrateStrategyConfig &&
    coreDb &&
    resolvedStrategyId
  ) {
    try {
      const service = createKehrnelService(coreDb);
      const manifest = await service.getStrategy(resolvedStrategyId, {
        connectionId: resolvedConnectionId,
        envKehrnel: env?.kehrnel || {}
      });
      if (manifest) {
        const manifestInput = deepMerge(
          resolvedConfig || {},
          strategyLink?.configOverrides || {}
        );
        const hydratedConfig = buildKehrnelActivationConfig(
          manifest,
          manifestInput,
          targetDatabase
        );
        if (stableSerialize(resolvedConfig || {}) !== stableSerialize(hydratedConfig || {})) {
          resolvedConfig = hydratedConfig;
          requiresRefresh = true;
        }
      }
    } catch (err) {
      console.warn('Could not hydrate Kehrnel runtime config from manifest:', err.message);
    }
  }

  return {
    envKey,
    domain: resolvedDomain,
    targetDatabase,
    connectionId: resolvedConnectionId,
    envKehrnel: env?.kehrnel || {},
    strategyLink,
    autoActivate: resolvedStrategyId
      ? {
          strategyId: resolvedStrategyId,
          config: resolvedConfig || {},
          configHash:
            strategyLink?.kehrnel?.configHash ||
            strategyLink?.configHash ||
            null,
          manifestDigest:
            strategyLink?.kehrnel?.manifestDigest ||
            strategyLink?.manifestDigest ||
            null,
          requiresRefresh,
          configSignature: stableSerialize(resolvedConfig || {}),
          reason: 'auto-activate-on-missing-activation'
        }
      : null
  };
}
