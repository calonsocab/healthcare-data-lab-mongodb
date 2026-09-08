// src/lib/strategies/configAdapter.js
/**
 * Strategy Configuration Adapter
 *
 * This module adapts the Strategy Studio configuration schema to the formats
 * expected by various consumers (translators, generators, Python transforms).
 *
 * Strategy Studio Schema (source of truth):
 * - config.collections.compositions.name
 * - config.collections.search.enabled
 * - config.collections.search.name
 * - config.collections.search.atlas_index_name
 * - config.fields.composition.nodes (e.g., "cn")
 * - config.fields.search.nodes (e.g., "sn")
 * - config.coding.atcodes.strategy
 * - etc.
 *
 * Legacy Translator Schema (expected by 4-hybrid-nodes.js):
 * - strategyConfig.atlasSearch.index_name
 * - strategyConfig.atlasSearch.searchablePaths
 * - Hardcoded "comp_nodes", "search_nodes"
 */

/**
 * Adapt Strategy Studio blueprint/config to translator-compatible format
 * @param {object} strategy - Full strategy document from database
 * @returns {object} Translator-compatible config object
 */
export function adaptForTranslator(strategy) {
  if (!strategy) {
    return getDefaultTranslatorConfig();
  }

  const blueprint = strategy.blueprint || {};
  const config = strategy.config || {};
  const topologyMode = config.topology?.mode || blueprint.topology?.default || 'dual';
  const indexTemplates = mergeIndexTemplates(blueprint.index_templates, config.index_templates);

  // Merge blueprint defaults with user config overrides
  const collections = mergeCollections(blueprint.collections, config.collections);
  const fields = mergeFields(blueprint.fields, config.fields);
  const coding = mergeCoding(blueprint.coding, config.coding);
  const dictionaries = mergeDictionaries(blueprint.dictionaries, config.dictionaries);
  const archetypeIdsEnabled =
    coding.archetype_ids?.enabled ??
    dictionaries.arcodes?.enabled ??
    dictionaries.arcodes?.enabled_default !== false;
  const archetypeIdsDictionary =
    coding.archetype_ids?.dictionary ||
    dictionaries.arcodes?.doc_id ||
    'ar_code';
  const atcodesEnabled = coding.atcodes?.enabled ?? true;
  const atcodesStoreOriginal = coding.atcodes?.store_original;
  const shortcutsEnabled =
    dictionaries.shortcuts?.enabled ??
    dictionaries.shortcuts?.enabled_default !== false;
  const shortcutsDocId =
    dictionaries.shortcuts?.doc_id ||
    'shortcuts';

  return {
    // Strategy identification
    strategyId: blueprint.id || strategy._id?.toString(),
    strategyName: blueprint.display_name || strategy.name,

    // Collection configuration
    collections: {
      compositions: collections.compositions?.name || 'flatten_compositions',
      search: collections.search?.name || 'search_nodes',
      codes: collections.codes?.name || collections.dictionaries?.name || '_codes',
      shortcuts: collections.shortcuts?.name || collections.shortcut_dict?.name || '_shortcuts',
      dictionaries: collections.dictionaries?.name || collections.codes?.name || '_codes'
    },

    // Atlas Search configuration (what translators expect)
    atlasSearch: {
      enabled: collections.search?.enabled !== false,
      index_name: collections.search?.atlas_index_name || 'comp_search',
      searchablePaths: buildSearchablePaths(fields)
    },

    // Field names (actual field keys used in documents)
    fields: {
      // Composition document fields
      compositionNodes: fields.composition?.nodes || 'cn',
      compositionData: fields.composition?.data || 'data',
      compositionPath: fields.composition?.path || 'p',
      compositionAncestors: fields.composition?.ancestors || 'anc',
      compositionKeyPath: fields.composition?.key_path || 'kp',
      compositionListIndex: fields.composition?.list_index || 'li',
      compositionEhrId: fields.composition?.ehr_id || 'ehr_id',
      compositionCompId: fields.composition?.comp_id || 'comp_id',
      compositionTemplateId: fields.composition?.template_id || 'tid',
      compositionVersion: fields.composition?.version || 'v',

      // Search document fields
      searchNodes: fields.search?.nodes || 'sn',
      searchData: fields.search?.data || 'data',
      searchPath: fields.search?.path || 'p',
      searchAncestors: fields.search?.ancestors || 'anc',
      searchEhrId: fields.search?.ehr_id || 'ehr_id',
      searchTemplateId: fields.search?.template_id || 'tid',

      // Other fields
      enrichmentNamespace: fields.enrichment_namespace || 'enr',
      vectorField: fields.vector_field || 'emb'
    },

    // Coding configuration
    coding: {
      archetypeIdStorage: coding.archetype_ids?.store || 'int',
      archetypeIdsEnabled,
      archetypeIdsDictionary,
      atcodesEnabled,
      atcodeStrategy: coding.atcodes?.strategy || 'alpha_compact',
      atcodesStoreOriginal,
      dottedVariantsEnabled: coding.atcodes?.dotted_variants?.enabled !== false,
      dottedVariantsJoiner: coding.atcodes?.dotted_variants?.joiner || '_'
    },

    // Dictionary configuration
    dictionaries: {
      shortcutsEnabled,
      shortcutsDocId,
      arcodesEnabled: archetypeIdsEnabled,
      arcodesDocId: archetypeIdsDictionary
    },

    // Index templates
    indexTemplates,

    // Query focus (mixed, patient, population)
    queryFocus: blueprint.query_focus || 'mixed',

    // Topology mode (single, dual)
    topologyMode,

    // Enrichment flags
    enrichment: {
      enabled: config.enrichment?.enabled !== false,
      vectorEnabled: config.enrichment?.vector_enabled || false
    },

    // Raw blueprint for advanced use cases
    _blueprint: blueprint,
    _config: config
  };
}

/**
 * Adapt Strategy Studio blueprint/config to synthetic data generator format
 * @param {object} strategy - Full strategy document from database
 * @returns {object} Generator-compatible config object
 */
export function adaptForGenerator(strategy) {
  const adapted = adaptForTranslator(strategy);
  const indexPlan = deriveIndexPlan(adapted.indexTemplates, adapted.collections);

  return {
    // Full collection names for downstream consumers
    collections: adapted.collections,

    // Target collections for data insertion
    targetCollections: {
      compositions: adapted.collections.compositions,
      search: adapted.atlasSearch.enabled ? adapted.collections.search : null,
      codes: adapted.collections.codes,
      shortcuts: adapted.collections.shortcuts,
      dictionaries: adapted.collections.dictionaries,
      metaIndex: 'metaIndex' // Standard meta collection
    },

    // Field mappings for document structure
    fieldMappings: {
      nodesField: adapted.fields.compositionNodes,
      dataField: adapted.fields.compositionData,
      pathField: adapted.fields.compositionPath,
      ancestorsField: adapted.fields.compositionAncestors,
      ehrIdField: adapted.fields.compositionEhrId,
      compositionIdField: adapted.fields.compositionCompId,
      templateIdField: adapted.fields.compositionTemplateId,
      versionField: adapted.fields.compositionVersion
    },

    // Search collection settings
    searchSettings: {
      enabled: adapted.atlasSearch.enabled,
      nodesField: adapted.fields.searchNodes,
      dataField: adapted.fields.searchData,
      pathField: adapted.fields.searchPath
    },

    // Dictionary settings
    dictionarySettings: {
      shortcutsEnabled: adapted.dictionaries.shortcutsEnabled,
      shortcutsDocId: adapted.dictionaries.shortcutsDocId,
      arcodesEnabled: adapted.dictionaries.arcodesEnabled,
      arcodesDocId: adapted.dictionaries.arcodesDocId
    },

    // Enrichment settings
    enrichmentSettings: {
      enabled: adapted.enrichment.enabled,
      namespace: adapted.fields.enrichmentNamespace,
      vectorField: adapted.fields.vectorField,
      vectorEnabled: adapted.enrichment.vectorEnabled
    },

    // Coding strategy
    codingStrategy: adapted.coding,

    // Strategy metadata
    strategyId: adapted.strategyId,
    strategyName: adapted.strategyName,

    // Index plan derived from strategy
    indexPlan,

    // Raw config for downstream consumers (e.g., denormalizer)
    strategyConfig: adapted._config || {}
  };
}

/**
 * Adapt Strategy Studio blueprint/config to Kehrnel Python format
 *
 * The returned config includes a "strategy" field which determines
 * which Kehrnel Docker instance to route to.
 *
 * @param {object} strategy - Full strategy document from database
 * @returns {object} Python-compatible strategy object
 */
export function adaptForKehrnel(strategy) {
  const adapted = adaptForTranslator(strategy);
  const blueprint = strategy?.blueprint || {};
  const config = strategy?.config || {};
  const pathMode = config.node_representation?.path?.mode || 'reversed';
  const compositionFields = {
    nodes: adapted.fields.compositionNodes,
    data: adapted.fields.compositionData,
    path: adapted.fields.compositionPath,
    ancestors: adapted.fields.compositionAncestors,
    key_path: adapted.fields.compositionKeyPath,
    list_index: adapted.fields.compositionListIndex,
    ehr_id: adapted.fields.compositionEhrId,
    comp_id: adapted.fields.compositionCompId,
    template_id: adapted.fields.compositionTemplateId,
    version: adapted.fields.compositionVersion
  };
  const searchFields = adapted.atlasSearch.enabled ? {
    nodes: adapted.fields.searchNodes,
    data: adapted.fields.searchData,
    path: adapted.fields.searchPath,
    ancestors: adapted.fields.searchAncestors,
    ehr_id: adapted.fields.searchEhrId,
    comp_id: adapted.fields.compositionCompId,
    template_id: adapted.fields.searchTemplateId
  } : null;

  // Strategy name for routing to correct Kehrnel Docker instance
  // Priority: config.strategy > kehrnelId > blueprint.id > adapted.strategyId > 'openehr_rps_dual'
  const strategyName = config.strategy || strategy?.kehrnelId || blueprint.id || adapted.strategyId || 'openehr_rps_dual';

  return {
    // CRITICAL: Strategy name for Docker routing
    strategy: strategyName,

    // Legacy fields for compatibility
    id: adapted.strategyId,
    name: adapted.strategyName,

    // Database (from strategy config or environment)
    database: config.database || blueprint.database || null,

    // Collections
    collections: {
      compositions: {
        name: adapted.collections.compositions,
        store_canonical: config.collections?.compositions?.store_canonical ?? true,
        nodes_field: adapted.fields.compositionNodes,
        reverse_paths: pathMode === 'reversed',
        store_nodes: true
      },
      search: adapted.atlasSearch.enabled ? {
        name: adapted.collections.search,
        enabled: true,
        nodes_field: adapted.fields.searchNodes,
        atlas_index_name: adapted.atlasSearch.index_name
      } : { enabled: false },
      codes: {
        name: adapted.collections.codes
      },
      shortcuts: {
        name: adapted.collections.shortcuts
      },
      dictionaries: {
        name: adapted.collections.dictionaries
      }
    },

    // Field names (what Python transformer expects)
    fields: {
      ...compositionFields,
      composition: compositionFields,
      search: searchFields
    },

    // Search fields
    search_fields: searchFields,

    // Coding - RPS format
    coding: {
      archetype_ids: {
        enabled: adapted.coding.archetypeIdsEnabled,
        dictionary: adapted.coding.archetypeIdsDictionary,
        sequential: adapted.coding.archetypeIdStorage === 'int'
      },
      atcodes: {
        enabled: adapted.coding.atcodesEnabled,
        strategy: adapted.coding.atcodeStrategy === 'alpha_compact' ? 'negative_int' : adapted.coding.atcodeStrategy,
        store_original: adapted.coding.atcodesStoreOriginal ?? true
      }
    },

    dictionaries: {
      shortcuts: {
        enabled: adapted.dictionaries.shortcutsEnabled,
        doc_id: adapted.dictionaries.shortcutsDocId
      },
      arcodes: {
        enabled: adapted.dictionaries.arcodesEnabled,
        doc_id: adapted.dictionaries.arcodesDocId
      }
    },

    // Node representation - path reversal etc
    node_representation: {
      path: {
        mode: pathMode,
        token_joiner: config.node_representation?.path?.token_joiner || '.'
      }
    },

    // Query engine configuration
    query_engine: {
      mode: adapted.atlasSearch.enabled ? 'atlas_search_dual' : 'btree',
      search_first: adapted.atlasSearch.enabled,
      lookup_full_composition: true,
      supports_multi_predicate: true
    },

    // Topology
    topology_mode: adapted.topologyMode,

    // Enrichment
    enrichment: {
      enabled: adapted.enrichment.enabled,
      namespace: adapted.fields.enrichmentNamespace,
      vector_field: adapted.fields.vectorField,
      vector_enabled: adapted.enrichment.vectorEnabled
    }
  };
}

/**
 * Get default translator config when no strategy is selected
 */
function getDefaultTranslatorConfig() {
  return {
    strategyId: 'default',
    strategyName: 'Default',
    collections: {
      compositions: 'flatten_compositions',
      search: 'search_nodes',
      codes: '_codes',
      shortcuts: '_shortcuts',
      dictionaries: 'dictionaries'
    },
    atlasSearch: {
      enabled: false,
      index_name: '',
      searchablePaths: []
    },
    fields: {
      compositionNodes: 'cn',
      compositionData: 'data',
      compositionPath: 'p',
      compositionAncestors: 'anc',
      compositionKeyPath: 'kp',
      compositionListIndex: 'li',
      compositionEhrId: 'ehr_id',
      compositionCompId: 'comp_id',
      compositionTemplateId: 'tid',
      compositionVersion: 'v',
      searchNodes: 'sn',
      searchData: 'data',
      searchPath: 'p',
      searchAncestors: 'anc',
      searchEhrId: 'ehr_id',
      searchTemplateId: 'tid',
      enrichmentNamespace: 'enr',
      vectorField: 'emb'
    },
    coding: {
      archetypeIdStorage: 'int',
      archetypeIdsEnabled: true,
      archetypeIdsDictionary: 'ar_code',
      atcodesEnabled: true,
      atcodeStrategy: 'alpha_compact',
      atcodesStoreOriginal: true,
      dottedVariantsEnabled: true,
      dottedVariantsJoiner: '_'
    },
    dictionaries: {
      shortcutsEnabled: true,
      shortcutsDocId: 'shortcuts',
      arcodesEnabled: true,
      arcodesDocId: 'ar_code'
    },
    indexTemplates: {},
    queryFocus: 'mixed',
    topologyMode: 'dual',
    enrichment: {
      enabled: false,
      vectorEnabled: false
    },
    _blueprint: {},
    _config: {}
  };
}

/**
 * Merge blueprint collection defaults with user config overrides
 */
function mergeCollections(blueprintCollections = {}, configCollections = {}) {
  const result = {};
  const keys = new Set([
    ...Object.keys(blueprintCollections || {}),
    ...Object.keys(configCollections || {}),
  ]);

  for (const key of keys) {
    const blueprintValue = blueprintCollections[key] || {};
    const configValue = configCollections[key] || {};
    result[key] = {
      name: configValue.name || blueprintValue.name_default || blueprintValue.name || key,
      enabled: configValue.enabled !== undefined ? configValue.enabled : blueprintValue.enabled_default !== false,
      atlas_index_name: configValue.atlas_index_name || blueprintValue.atlas_index_name_default || blueprintValue.atlas_index_name
    };
  }

  return result;
}

/**
 * Merge blueprint field defaults with user config overrides
 */
function mergeFields(blueprintFields = {}, configFields = {}) {
  const result = { ...blueprintFields };

  // Override composition fields
  if (configFields.composition) {
    result.composition = { ...blueprintFields.composition, ...configFields.composition };
  }

  // Override search fields
  if (configFields.search) {
    result.search = { ...blueprintFields.search, ...configFields.search };
  }

  // Override other fields
  if (configFields.enrichment_namespace) {
    result.enrichment_namespace = configFields.enrichment_namespace;
  }
  if (configFields.vector_field) {
    result.vector_field = configFields.vector_field;
  }

  return result;
}

function mergeCoding(blueprintCoding = {}, configCoding = {}) {
  return {
    ...(blueprintCoding || {}),
    ...(configCoding || {}),
    archetype_ids: {
      ...(blueprintCoding?.archetype_ids || {}),
      ...(configCoding?.archetype_ids || {})
    },
    atcodes: {
      ...(blueprintCoding?.atcodes || {}),
      ...(configCoding?.atcodes || {}),
      dotted_variants: {
        ...(blueprintCoding?.atcodes?.dotted_variants || {}),
        ...(configCoding?.atcodes?.dotted_variants || {})
      }
    }
  };
}

function mergeDictionaries(blueprintDictionaries = {}, configDictionaries = {}) {
  return {
    ...(blueprintDictionaries || {}),
    ...(configDictionaries || {}),
    shortcuts: {
      ...(blueprintDictionaries?.shortcuts || {}),
      ...(configDictionaries?.shortcuts || {})
    },
    arcodes: {
      ...(blueprintDictionaries?.arcodes || {}),
      ...(configDictionaries?.arcodes || {})
    }
  };
}

/**
 * Merge blueprint and user-provided index templates
 */
function mergeIndexTemplates(blueprintTemplates = {}, configTemplates = {}) {
  const merged = { ...(blueprintTemplates || {}) };
  if (configTemplates && typeof configTemplates === 'object') {
    Object.assign(merged, configTemplates);
  }

  merged.btree = configTemplates?.btree !== undefined
    ? configTemplates.btree
    : blueprintTemplates?.btree || [];

  merged.atlas_search = configTemplates?.atlas_search !== undefined
    ? configTemplates.atlas_search
    : blueprintTemplates?.atlas_search || null;

  return merged;
}

/**
 * Derive index plan (recommended + auto-create set) from index templates
 */
function deriveIndexPlan(indexTemplates = {}, collections = {}) {
  const btree = Array.isArray(indexTemplates.btree) ? indexTemplates.btree : [];
  const recommendedIndexes = btree.map(def => ({
    name: def.name || '',
    collection: def.collection || collections.compositions || 'flatten_compositions',
    fields: Array.isArray(def.fields)
      ? def.fields
      : def.field
        ? [def.field]
        : [],
    type: def.type || 'btree',
    notes: def.notes || ''
  }));

  const autoIndexes = []; // auto-creation is disabled; guide only

  const atlasSearch = indexTemplates.atlas_search
    ? {
        ...indexTemplates.atlas_search,
        collection: indexTemplates.atlas_search.collection || collections.search || collections.compositions || null
      }
    : null;

  return { recommendedIndexes, autoIndexes, atlasSearch };
}

/**
 * Build searchable paths array from field configuration
 */
function buildSearchablePaths(fields) {
  const searchNodes = fields.search?.nodes || 'sn';
  const dataField = fields.search?.data || 'data';
  const pathField = fields.search?.path || 'p';

  return [
    `${searchNodes}.${dataField}`,
    `${searchNodes}.${pathField}`
  ];
}

const configAdapter = {
  adaptForTranslator,
  adaptForGenerator,
  adaptForKehrnel
};

export default configAdapter;
