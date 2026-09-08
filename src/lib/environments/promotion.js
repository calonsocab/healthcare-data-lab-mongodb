import { normalizeStrategyLinks } from './normalizeStrategyLinks.js';

export const PROMOTABLE_ENVIRONMENT_ASSETS = [
  {
    collection: 'user-data-models',
    label: 'Data Models & Analytical Templates',
  },
  {
    collection: 'metadata',
    label: 'Folders & Tags',
  },
  {
    collection: 'aql-queries',
    label: 'Query Library',
  },
  {
    collection: 'type_template_associations',
    label: 'Document Type Associations',
  },
  {
    collection: 'jsonld-mappings',
    label: 'JSON-LD Mappings',
  },
  {
    collection: 'mapping_definitions',
    label: 'Mapping Definitions',
  },
];

const SOURCE_KEHRNEL_FIELDS = ['useDefault', 'apiUrl', 'connectionId'];

function cloneJsonValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return JSON.parse(JSON.stringify(value));
}

function pick(object, keys) {
  const out = {};
  for (const key of keys) {
    if (object?.[key] !== undefined) {
      out[key] = object[key];
    }
  }
  return out;
}

export function sanitizeStrategyLinksForPromotion(strategyLinks = []) {
  const strippedLinks = (Array.isArray(strategyLinks) ? strategyLinks : []).map((link, index) => ({
    id: link?.id || `promoted-link-${index + 1}`,
    domain: link?.domain || 'openEHR',
    strategyId: link?.strategyId || link?.kehrnel?.strategyId || null,
    strategyName: link?.strategyName || '',
    targetDatabase: link?.targetDatabase || null,
    configOverrides: cloneJsonValue(link?.configOverrides || {}),
    mergedConfig: cloneJsonValue(link?.mergedConfig || null),
    contexts: {
      synthetic: link?.contexts?.synthetic !== false,
      query: link?.contexts?.query !== false,
      api: !!link?.contexts?.api,
    },
    notes: link?.notes || '',
    searchRefresh: null,
    strategyVersion: null,
    activationId: null,
    manifestDigest: null,
    configHash: null,
    kehrnel: null,
  }));

  return normalizeStrategyLinks(strippedLinks);
}

export function extractPromotableRuntimeConfig(sourceEnvironment = {}) {
  return {
    domainDatabases: cloneJsonValue(sourceEnvironment?.domainDatabases || {}),
    strategyLinks: sanitizeStrategyLinksForPromotion(sourceEnvironment?.strategyLinks || []),
    kehrnel: pick(sourceEnvironment?.kehrnel || {}, SOURCE_KEHRNEL_FIELDS),
  };
}

export function buildTargetEnvironmentFromRuntimeConfig(
  runtimeConfig = {},
  targetEnvironment = {},
  { nowIso = new Date().toISOString() } = {}
) {
  return {
    ...targetEnvironment,
    domainDatabases: cloneJsonValue(runtimeConfig?.domainDatabases || {}),
    strategyLinks: sanitizeStrategyLinksForPromotion(runtimeConfig?.strategyLinks || []),
    kehrnel: {
      ...(targetEnvironment?.kehrnel || {}),
      ...pick(runtimeConfig?.kehrnel || {}, SOURCE_KEHRNEL_FIELDS),
      envKey: targetEnvironment?.kehrnel?.envKey || null,
      lastHealth: targetEnvironment?.kehrnel?.lastHealth || null,
    },
    updatedAt: nowIso,
  };
}

export function buildTargetEnvironmentAfterPromotion(
  sourceEnvironment = {},
  targetEnvironment = {},
  { includeRuntimeConfig = false, nowIso = new Date().toISOString() } = {}
) {
  const promotedEnvironment = {
    ...targetEnvironment,
  };

  if (!includeRuntimeConfig) {
    return promotedEnvironment;
  }

  return buildTargetEnvironmentFromRuntimeConfig(
    extractPromotableRuntimeConfig(sourceEnvironment),
    promotedEnvironment,
    { nowIso }
  );
}

export function prepareDocumentsForPromotion(
  collectionName,
  documents = [],
  { targetEnvironment = {} } = {}
) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  if (collectionName === 'jsonld-mappings') {
    return documents.map((document) => ({
      ...document,
      environmentId: targetEnvironment?.id || document?.environmentId || null,
    }));
  }

  return documents.map((document) => ({ ...document }));
}
