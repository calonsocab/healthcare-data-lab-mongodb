import { resolveDomainTargetDatabase } from '../environments/domainDatabases.js';
import { buildKehrnelActivationConfig } from '../strategies/kehrnelManifestAdapter.js';

function deepMerge(target = {}, source = {}) {
  const result = { ...(target || {}) };
  if (!source || typeof source !== 'object') return result;
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge(result[key] || {}, val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function withTargetDatabaseConfig(config = {}, targetDatabase = null) {
  const merged = deepMerge({}, config || {});
  if (!targetDatabase) return merged;

  const setIfPathExists = (obj, path, value) => {
    let cursor = obj;
    for (let i = 0; i < path.length - 1; i += 1) {
      const key = path[i];
      if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return false;
      if (!Object.prototype.hasOwnProperty.call(cursor, key)) return false;
      cursor = cursor[key];
    }
    const leaf = path[path.length - 1];
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return false;
    if (!Object.prototype.hasOwnProperty.call(cursor, leaf)) return false;
    cursor[leaf] = value;
    return true;
  };

  const candidatePaths = [
    ['database_name'],
    ['target_database'],
    ['targetDatabase'],
    ['database'],
    ['model_source', 'database_name'],
    ['source_database', 'database_name'],
  ];

  for (const path of candidatePaths) {
    setIfPathExists(merged, path, targetDatabase);
  }

  return merged;
}

export function normalizeSyntheticDomain(domain) {
  if (!domain || typeof domain !== 'string') return '';
  return domain.trim().toLowerCase();
}

export function getSyntheticStrategyLinks(environment) {
  const links = Array.isArray(environment?.strategyLinks) ? environment.strategyLinks : [];
  return links.filter((link) => link?.contexts?.synthetic);
}

export function resolveSyntheticBinding(environment, { domain, strategyId } = {}) {
  const syntheticLinks = getSyntheticStrategyLinks(environment);
  const requestedDomain = normalizeSyntheticDomain(domain);
  const requestedStrategyId = strategyId ? String(strategyId) : '';

  let strategyLink = null;
  if (requestedDomain) {
    strategyLink = syntheticLinks.find((link) => normalizeSyntheticDomain(link?.domain) === requestedDomain) || null;
  }
  if (!strategyLink && requestedStrategyId) {
    strategyLink = syntheticLinks.find((link) => {
      const linkStrategyId = String(link?.kehrnel?.strategyId || link?.strategyId || '');
      return linkStrategyId === requestedStrategyId;
    }) || null;
  }
  if (!strategyLink && syntheticLinks.length === 1) {
    strategyLink = syntheticLinks[0];
  }
  if (!strategyLink && syntheticLinks.length > 0) {
    strategyLink = syntheticLinks[0];
  }

  const resolvedDomain = normalizeSyntheticDomain(strategyLink?.domain || requestedDomain);
  const resolvedStrategyId = String(
    strategyLink?.kehrnel?.strategyId ||
    strategyLink?.strategyId ||
    requestedStrategyId ||
    ''
  );
  const linkDomain = normalizeSyntheticDomain(strategyLink?.domain);
  const linkTargetDatabase = linkDomain && linkDomain === resolvedDomain
    ? strategyLink?.targetDatabase
    : null;
  const { targetDatabase } = resolveDomainTargetDatabase(
    environment,
    resolvedDomain,
    linkTargetDatabase
  );
  const mergedConfig = withTargetDatabaseConfig(
    strategyLink?.mergedConfig ||
      deepMerge(strategyLink?.kehrnel?.config || {}, strategyLink?.configOverrides || {}),
    targetDatabase
  );

  return {
    envKey: environment?.kehrnel?.envKey || environment?.id || null,
    domain: resolvedDomain,
    targetDatabase,
    strategyId: resolvedStrategyId || null,
    strategyLink: strategyLink || null,
    mergedConfig: mergedConfig || {},
    connectionId:
      strategyLink?.kehrnel?.connectionId ||
      environment?.kehrnel?.connectionId ||
      null,
    availableDomains: Array.from(
      new Set(
        syntheticLinks
          .map((link) => normalizeSyntheticDomain(link?.domain))
          .filter(Boolean)
      )
    ),
    syntheticLinks
  };
}

export async function hydrateSyntheticBindingConfig(
  environment,
  binding,
  { service } = {}
) {
  if (!binding?.strategyId || !service?.getStrategy) {
    return binding;
  }

  try {
    const manifest = await service.getStrategy(binding.strategyId, {
      connectionId: binding.connectionId,
      envKehrnel: environment?.kehrnel || {}
    });
    if (!manifest) {
      return binding;
    }

    const manifestInput = deepMerge(
      binding?.mergedConfig || {},
      binding?.strategyLink?.configOverrides || {}
    );

    return {
      ...binding,
      mergedConfig: buildKehrnelActivationConfig(
        manifest,
        manifestInput,
        binding?.targetDatabase || null
      )
    };
  } catch (err) {
    console.warn('Could not hydrate synthetic Kehrnel config from manifest:', err.message);
    return binding;
  }
}
