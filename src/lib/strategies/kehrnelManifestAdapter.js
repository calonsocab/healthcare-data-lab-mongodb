export function deepMerge(target = {}, source = {}) {
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

export function withTargetDatabaseConfig(config = {}, targetDatabase = null) {
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

export function wrapKehrnelManifest(manifest, configOverrides = {}) {
  const id = manifest?.id || manifest?.strategy_id || manifest?.name || 'unknown';
  const defaultConfig = deepMerge(manifest?.default_config || {}, configOverrides || {});

  return {
    _id: id,
    name: manifest?.name || manifest?.display_name || id,
    kehrnelId: id,
    blueprint: {
      id,
      display_name: manifest?.display_name || manifest?.name || id,
      domain: manifest?.domain || [],
      summary: manifest?.summary || manifest?.description || '',
      topology: manifest?.topology || { modes: ['single'], default: 'single' },
      query_focus: manifest?.query_focus || 'mixed',
      complexity: manifest?.complexity || 'medium',
      collections: manifest?.collections || {},
      fields: manifest?.fields || {},
      coding: manifest?.coding || {},
      dictionaries: manifest?.dictionaries || {},
      index_templates: manifest?.index_templates || {},
      kehrnel_library: {
        package: 'kehrnel',
        capabilities: manifest?.capabilities || []
      }
    },
    config: {
      ...defaultConfig,
      strategy: id
    }
  };
}

function setNestedValue(target, path, value) {
  if (value === undefined || value === null || value === '') return;
  let cursor = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = value;
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function extractCollectionName(entry) {
  if (!entry) return undefined;
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object') {
    return entry.name || entry.collection || undefined;
  }
  return undefined;
}

function mapLegacyArcodesStrategy(config = {}) {
  const direct = config?.transform?.coding?.arcodes?.strategy;
  if (typeof direct === 'string' && direct.trim()) return direct;

  const store = config?.coding?.archetype_ids?.store;
  if (typeof store === 'string') {
    const normalized = store.trim().toLowerCase();
    if (normalized === 'int' || normalized === 'sequential') return 'sequential';
    if (normalized === 'string' || normalized === 'literal') return 'literal';
  }

  if (config?.coding?.archetype_ids?.sequential === true) return 'sequential';
  return undefined;
}

function mapLegacyAtcodesStrategy(config = {}) {
  const direct = config?.transform?.coding?.atcodes?.strategy || config?.coding?.atcodes?.strategy;
  if (typeof direct !== 'string') return undefined;
  const normalized = direct.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'alpha_compact') return 'negative_int';
  return normalized;
}

function matchesEnumConstraint(value, schema = {}) {
  if (!Array.isArray(schema?.enum) || schema.enum.length === 0) {
    return true;
  }

  const serializedValue = stableSerialize(value);
  return schema.enum.some((candidate) => stableSerialize(candidate) === serializedValue);
}

function pruneEmptyObjects(value) {
  if (Array.isArray(value)) {
    return value.map((item) => pruneEmptyObjects(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const entries = Object.entries(value)
    .map(([key, child]) => [key, pruneEmptyObjects(child)])
    .filter(([, child]) => child !== undefined);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function projectConfigToSchema(value, schema) {
  if (!matchesEnumConstraint(value, schema)) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return [...value];
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const properties = schema?.properties;
  if (!properties || typeof properties !== 'object') {
    return deepMerge({}, value);
  }

  const projected = {};
  for (const [key, childSchema] of Object.entries(properties)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const childValue = value[key];
    if (childValue === undefined) continue;
    const projectedChild = projectConfigToSchema(childValue, childSchema);
    if (projectedChild !== undefined) {
      projected[key] = projectedChild;
    }
  }

  return projected;
}

function extractLegacyManifestConfig(config = {}) {
  if (!config || typeof config !== 'object') return {};

  const legacy = {};
  const collections = config?.collections || {};
  const fields = config?.fields || {};
  const compositionFields = fields?.composition || {};
  const searchFields = fields?.search || {};
  const documentFields = fields?.document || {};
  const nodeFields = fields?.node || {};

  setNestedValue(
    legacy,
    ['collections', 'compositions', 'name'],
    extractCollectionName(collections?.compositions)
  );
  setNestedValue(
    legacy,
    ['collections', 'search', 'name'],
    extractCollectionName(collections?.search || collections?.search_nodes)
  );
  setNestedValue(
    legacy,
    ['collections', 'search', 'enabled'],
    pickFirstDefined(collections?.search?.enabled, collections?.search_nodes?.enabled)
  );
  setNestedValue(
    legacy,
    ['collections', 'search', 'atlasIndex', 'name'],
    pickFirstDefined(
      collections?.search?.atlasIndex?.name,
      collections?.search?.atlas_index_name,
      config?.search_fields?.atlas_index_name
    )
  );
  setNestedValue(
    legacy,
    ['collections', 'codes', 'name'],
    extractCollectionName(collections?.codes || collections?.dictionaries)
  );
  setNestedValue(
    legacy,
    ['collections', 'shortcuts', 'name'],
    extractCollectionName(collections?.shortcuts || collections?.shortcut_dict)
  );

  setNestedValue(
    legacy,
    ['paths', 'separator'],
    pickFirstDefined(config?.paths?.separator, config?.node_representation?.path?.token_joiner)
  );

  setNestedValue(
    legacy,
    ['fields', 'document', 'ehr_id'],
    pickFirstDefined(documentFields?.ehr_id, compositionFields?.ehr_id, fields?.ehr_id)
  );
  setNestedValue(
    legacy,
    ['fields', 'document', 'comp_id'],
    pickFirstDefined(documentFields?.comp_id, compositionFields?.comp_id, fields?.comp_id)
  );
  setNestedValue(
    legacy,
    ['fields', 'document', 'tid'],
    pickFirstDefined(documentFields?.tid, compositionFields?.template_id, fields?.template_id)
  );
  setNestedValue(
    legacy,
    ['fields', 'document', 'v'],
    pickFirstDefined(documentFields?.v, compositionFields?.version, fields?.version)
  );
  setNestedValue(
    legacy,
    ['fields', 'document', 'time_committed'],
    pickFirstDefined(documentFields?.time_committed, fields?.time_committed)
  );
  setNestedValue(
    legacy,
    ['fields', 'document', 'sort_time'],
    pickFirstDefined(documentFields?.sort_time, fields?.sort_time)
  );
  setNestedValue(
    legacy,
    ['fields', 'document', 'cn'],
    pickFirstDefined(documentFields?.cn, compositionFields?.nodes, fields?.nodes)
  );
  setNestedValue(
    legacy,
    ['fields', 'document', 'sn'],
    pickFirstDefined(documentFields?.sn, searchFields?.nodes, fields?.search_nodes)
  );
  setNestedValue(
    legacy,
    ['fields', 'node', 'p'],
    pickFirstDefined(nodeFields?.p, compositionFields?.path, fields?.path)
  );
  setNestedValue(
    legacy,
    ['fields', 'node', 'pi'],
    nodeFields?.pi
  );
  setNestedValue(
    legacy,
    ['fields', 'node', 'data'],
    pickFirstDefined(nodeFields?.data, compositionFields?.data, fields?.data)
  );

  setNestedValue(
    legacy,
    ['transform', 'coding', 'arcodes', 'strategy'],
    mapLegacyArcodesStrategy(config)
  );
  setNestedValue(
    legacy,
    ['transform', 'coding', 'atcodes', 'strategy'],
    mapLegacyAtcodesStrategy(config)
  );
  setNestedValue(
    legacy,
    ['transform', 'coding', 'atcodes', 'store_original'],
    pickFirstDefined(config?.transform?.coding?.atcodes?.store_original, config?.coding?.atcodes?.store_original)
  );
  setNestedValue(
    legacy,
    ['transform', 'apply_shortcuts'],
    pickFirstDefined(
      config?.transform?.apply_shortcuts,
      config?.dictionaries?.shortcuts?.enabled === false ? false : undefined
    )
  );

  if (config?.coding?.archetype_ids?.enabled === false || config?.dictionaries?.arcodes?.enabled === false) {
    setNestedValue(legacy, ['bootstrap', 'dictionariesOnActivate', 'codes'], 'none');
  }
  if (config?.dictionaries?.shortcuts?.enabled === false) {
    setNestedValue(legacy, ['bootstrap', 'dictionariesOnActivate', 'shortcuts'], 'none');
  }

  return legacy;
}

export function normalizeKehrnelConfigInput(manifest, inputConfig = {}) {
  const schema = manifest?.config_schema || {};
  const schemaCompatible = projectConfigToSchema(inputConfig || {}, schema);
  const legacyCompatible = extractLegacyManifestConfig(inputConfig || {});
  return pruneEmptyObjects(projectConfigToSchema(deepMerge(legacyCompatible, schemaCompatible), schema)) || {};
}

function usesCatalogBackedRpsDualMappings(strategyId = '') {
  return new Set([
    'openehr.rps_dual',
    'openehr.rps_dual_ibm',
  ]).has(String(strategyId || '').trim().toLowerCase());
}

export function buildKehrnelActivationConfig(manifest, configOverrides = {}, targetDatabase = null) {
  const defaults = deepMerge({}, manifest?.default_config || {});
  const normalizedConfig = normalizeKehrnelConfigInput(manifest, configOverrides || {});
  const mergedConfig = withTargetDatabaseConfig(deepMerge(defaults, normalizedConfig), targetDatabase);
  const strategyId = String(manifest?.id || manifest?.strategy_id || '').trim().toLowerCase();

  if (usesCatalogBackedRpsDualMappings(strategyId) && mergedConfig?.transform?.mappings === undefined) {
    mergedConfig.transform = deepMerge(mergedConfig.transform || {}, {
      mappings: {
        source: 'catalog',
        catalog_collection: 'user-data-models',
        domain: 'openehr',
      },
    });
  }

  return mergedConfig;
}

export function hasPhysicalKehrnelConfig(config = {}) {
  const compositionFields = config?.fields?.composition || {};
  return Boolean(
    config?.collections?.compositions?.name &&
    compositionFields?.nodes &&
    compositionFields?.path &&
    (compositionFields?.data || config?.fields?.data) &&
    (compositionFields?.template_id || config?.fields?.template_id) &&
    (config?.query_engine?.mode || config?.node_representation?.path?.mode) &&
    (!config?.coding?.archetype_ids?.enabled || config?.coding?.archetype_ids?.dictionary) &&
    (!config?.dictionaries?.shortcuts?.enabled || config?.dictionaries?.shortcuts?.doc_id)
  );
}

export function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
