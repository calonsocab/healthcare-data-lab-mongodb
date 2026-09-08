// src/lib/kehrnel/engines.js
/**
 * Kehrnel Strategy Registry (UI Reference)
 *
 * This is a UI-side reference of available Kehrnel strategies.
 * The actual strategy implementation lives in Kehrnel Python (strategies/{name}/).
 *
 * Key architecture:
 * - Config JSON contains "strategy" field (e.g., "openehr.rps_dual")
 * - Kehrnel loads the corresponding strategy manifest + runtime plugin
 * - A strategy can own plan/apply/transform/ingest/query/compile_query
 * - ContextObjects, Context Maps, and Con2L are runtime contracts that can be executed by Kehrnel
 * - Users can deploy custom strategies to Kehrnel
 *
 * This registry is for:
 * - UI display (strategy selector, capabilities info)
 * - Validation hints
 * - Documentation
 *
 * The source of truth is Kehrnel - this is just metadata for the UI.
 */

/**
 * Known strategies (UI reference)
 * Maps to Kehrnel strategies/{id}/ folders
 */
export const DATA_MODEL_ENGINES = {
  // Core openEHR data model transformers
  'transform.openehr': {
    id: 'transform.openehr',
    name: 'openEHR Core Model',
    module: 'transform',
    description: 'Core data model engine for openEHR compositions',
    version: '>=0.8.0',
    domain: ['openEHR'],
    capabilities: [
      'flatten',
      'unflatten',
      'validate',
      'canonical_json',
      'node_extraction'
    ],
    operations: {
      flatten: {
        name: 'Flatten Composition',
        description: 'Extract nodes from canonical composition into semi-flattened format',
        input: 'composition',
        output: 'flattened_document'
      },
      unflatten: {
        name: 'Unflatten to Canonical',
        description: 'Reconstruct canonical composition from flattened nodes',
        input: 'flattened_document',
        output: 'composition'
      },
      validate: {
        name: 'Validate Composition',
        description: 'Validate composition against template constraints',
        input: 'composition',
        output: 'validation_result'
      }
    },
    collections: {
      required: ['compositions'],
      optional: ['search', 'dictionaries']
    },
    dictionaries: {
      shortcuts: {
        description: 'Path shortcut mappings for compressed storage',
        required: false
      },
      arcodes: {
        description: 'Archetype code dictionary for integer encoding',
        required: false
      }
    },
    supported_strategies: [
      'openehr_ccq',
      'openehr_aai',
      'openehr_rpb',
      'openehr_rps_single',
      'openehr_rps_dual'
    ]
  },

  // Semi-flattened RPS (Reversed Path Search) data model
  'transform.rps': {
    id: 'transform.rps',
    name: 'RPS Data Model',
    module: 'transform.rps',
    description: 'Reversed Path Search data model with dual-indexing support',
    version: '>=0.9.0',
    domain: ['openEHR'],
    capabilities: [
      'flatten',
      'unflatten',
      'validate',
      'reverse_paths',
      'search_nodes',
      'dual_collection',
      'shortcuts_generation',
      'arcodes_encoding'
    ],
    operations: {
      flatten: {
        name: 'RPS Flatten',
        description: 'Flatten composition with reversed AQL paths',
        input: 'composition',
        output: 'rps_document'
      },
      generate_search_doc: {
        name: 'Generate Search Document',
        description: 'Create slim search document for dual-collection mode',
        input: 'rps_document',
        output: 'search_document'
      },
      generate_shortcuts: {
        name: 'Generate Shortcuts',
        description: 'Build path shortcuts dictionary from templates',
        input: 'template_set',
        output: 'shortcuts_dictionary'
      }
    },
    collections: {
      required: ['compositions'],
      optional: ['search', 'dictionaries']
    },
    dictionaries: {
      shortcuts: {
        description: 'Reversed path shortcuts for efficient B-tree queries',
        required: true,
        doc_id: 'shortcuts',
        fields: ['path_map', 'reverse_map', 'template_paths']
      },
      arcodes: {
        description: 'Archetype node ID to integer encoding',
        required: false,
        doc_id: 'ar_code'
      }
    },
    indexing: {
      btree: {
        patient_scope: ['ehr_id', 'cn.p'],
        description: 'B-tree index for patient-scoped queries with reversed paths'
      },
      atlas_search: {
        enabled_modes: ['single', 'dual'],
        description: 'Atlas Search for cross-patient queries'
      }
    },
    supported_strategies: [
      'openehr_rpb',
      'openehr_rps_single',
      'openehr_rps_dual'
    ]
  },

  // FHIR data model (future)
  'mapper.fhir': {
    id: 'mapper.fhir',
    name: 'FHIR Data Model',
    module: 'mapper.fhir',
    description: 'FHIR resource data model with search mirror',
    version: '>=0.9.0',
    domain: ['FHIR'],
    status: 'planned',
    capabilities: [
      'validate',
      'mapping',
      'resource_extraction',
      'search_mirror'
    ],
    operations: {
      transform: {
        name: 'Transform Resource',
        description: 'Transform FHIR resource for MongoDB storage',
        input: 'fhir_resource',
        output: 'stored_document'
      },
      extract_search: {
        name: 'Extract Search Fields',
        description: 'Mirror searchable fields into search array',
        input: 'fhir_resource',
        output: 'search_fields'
      }
    },
    collections: {
      required: ['resources'],
      optional: []
    },
    supported_strategies: ['fhir_resource_first']
  },

  // Genomics data model (future)
  'mapper.genomics': {
    id: 'mapper.genomics',
    name: 'Genomics Data Model',
    module: 'mapper.genomics',
    description: 'Genomic variant data model with annotations',
    version: '>=0.9.0',
    domain: ['Genomics'],
    status: 'planned',
    capabilities: [
      'validate',
      'mapping',
      'vcf_parsing',
      'annotation_embedding'
    ],
    operations: {
      transform: {
        name: 'Transform Variant',
        description: 'Transform variant for MongoDB storage',
        input: 'vcf_record',
        output: 'variant_document'
      }
    },
    collections: {
      required: ['variants'],
      optional: []
    },
    supported_strategies: ['genomics_variant_first']
  },

  // ContextObjects runtime contracts
  'contextobjects.runtime': {
    id: 'contextobjects.runtime',
    name: 'ContextObjects Runtime',
    module: 'contextobjects',
    description: 'Shared runtime contract layer for ContextObjects, Context Maps, and Con2L execution inside Kehrnel',
    version: '>=0.10.0',
    domain: ['ContextObjects', 'openEHR', 'FHIR', 'X12', 'generic'],
    status: 'preview',
    capabilities: [
      'context_contract_resolution',
      'con2l_draft',
      'con2l_resolved',
      'con2l_executable',
      'compile_query',
      'objectmap_execution',
      'scenario_pack_materialization'
    ],
    operations: {
      resolve_contract: {
        name: 'Resolve Context Contract',
        description: 'Rank ContextObject definitions, bindings, and relations against a request',
        input: 'request_ir + contextobject_catalog',
        output: 'resolved_context_contract'
      },
      compile_con2l: {
        name: 'Compile Con2L',
        description: 'Compile executable Con2L into a deterministic query plan',
        input: 'con2l_executable',
        output: 'query_plan'
      },
      execute_objectmap: {
        name: 'Execute Context Map',
        description: 'Apply mapping rules to source data and emit ContextObject instances',
        input: 'objectmap_asset + source_documents',
        output: 'contextobject_instances'
      }
    },
    collections: {
      required: ['contextobjects'],
      optional: ['context_blocks', 'context_instances']
    },
    supported_strategies: [
      'fhir.contextobjects.vitals_window',
      'x12.co_single'
    ],
    docs: {
      hdlContract: 'kehrnel/docs/hdl-contract.md',
      contextobjectsContract: 'kehrnel/docs/hdl-kehrnel-contextobjects-contract.md'
    }
  }
};

/**
 * Get data model engine by ID
 * @param {string} engineId - Engine identifier (e.g., 'transform.openehr')
 * @returns {object|null} Engine definition or null
 */
export function getDataModelEngine(engineId) {
  return DATA_MODEL_ENGINES[engineId] || null;
}

// Alias for backward compatibility
export const getEngine = getDataModelEngine;

/**
 * Get all data model engines for a specific domain
 * @param {string} domain - Domain filter (e.g., 'openEHR', 'FHIR')
 * @returns {object[]} Array of matching engines
 */
export function getEnginesByDomain(domain) {
  return Object.values(DATA_MODEL_ENGINES).filter(
    engine => engine.domain.includes(domain)
  );
}

/**
 * Get data model engines that support a specific strategy
 * @param {string} strategyId - Blueprint strategy ID (e.g., 'openehr_rps_dual')
 * @returns {object[]} Array of compatible engines
 */
export function getEnginesForStrategy(strategyId) {
  return Object.values(DATA_MODEL_ENGINES).filter(
    engine => engine.supported_strategies?.includes(strategyId)
  );
}

/**
 * Validate if an engine supports all required capabilities for a strategy
 * @param {string} engineId - Engine identifier
 * @param {object} strategy - Strategy document with blueprint
 * @returns {object} Validation result with compatible flag and issues
 */
export function validateEngineForStrategy(engineId, strategy) {
  const engine = getEngine(engineId);
  if (!engine) {
    return {
      compatible: false,
      engine: null,
      issues: [`Engine '${engineId}' not found`]
    };
  }

  const issues = [];
  const warnings = [];

  // Get strategy blueprint
  const blueprint = strategy.blueprint || {};
  const config = strategy.config || {};

  // Check domain compatibility
  const strategyDomain = blueprint.domain?.[0] || 'openEHR';
  if (!engine.domain.includes(strategyDomain)) {
    issues.push(`Engine does not support domain '${strategyDomain}'`);
  }

  // Check if engine explicitly supports this strategy
  const strategyId = blueprint.id;
  if (strategyId && !engine.supported_strategies?.includes(strategyId)) {
    warnings.push(`Engine does not explicitly list '${strategyId}' as supported`);
  }

  // Check required capabilities from strategy
  const requiredCapabilities = blueprint.kehrnel_library?.capabilities || [];
  const engineCapabilities = new Set(engine.capabilities || []);

  for (const cap of requiredCapabilities) {
    if (!engineCapabilities.has(cap)) {
      issues.push(`Missing required capability: '${cap}'`);
    }
  }

  // Check collection requirements
  const strategyCollections = Object.keys(config.collections || blueprint.collections || {});
  const engineRequiredCollections = engine.collections?.required || [];

  for (const col of engineRequiredCollections) {
    if (!strategyCollections.some(sc => sc.toLowerCase().includes(col.toLowerCase()))) {
      warnings.push(`Strategy may need collection type: '${col}'`);
    }
  }

  // Check dictionary requirements
  const dictConfig = blueprint.dictionaries || {};
  const engineDicts = engine.dictionaries || {};

  for (const [dictName, dictDef] of Object.entries(engineDicts)) {
    if (dictDef.required && !dictConfig[dictName]?.enabled_default) {
      warnings.push(`Engine recommends enabling dictionary: '${dictName}'`);
    }
  }

  // Check topology compatibility (single vs dual collection)
  const topologyMode = config.topology?.mode || blueprint.topology?.default || 'single';
  if (topologyMode === 'dual' && !engine.capabilities?.includes('dual_collection')) {
    issues.push('Engine does not support dual-collection topology');
  }

  return {
    compatible: issues.length === 0,
    engine,
    issues,
    warnings,
    capabilities: {
      required: requiredCapabilities,
      available: Array.from(engineCapabilities),
      missing: requiredCapabilities.filter(c => !engineCapabilities.has(c))
    }
  };
}

/**
 * Get dictionary schema for an engine
 * @param {string} engineId - Engine identifier
 * @returns {object} Dictionary definitions with structure info
 */
export function getEngineDictionaries(engineId) {
  const engine = getEngine(engineId);
  if (!engine) return {};
  return engine.dictionaries || {};
}

/**
 * Get recommended engine for a strategy
 * @param {object} strategy - Strategy document
 * @returns {object|null} Recommended engine or null
 */
export function getRecommendedEngine(strategy) {
  const blueprint = strategy.blueprint || {};
  const strategyId = blueprint.id;
  const domain = blueprint.domain?.[0] || 'openEHR';

  // First try to find engine explicitly linked in strategy
  const linkedModule = blueprint.kehrnel_library?.transform_module;
  if (linkedModule) {
    const engine = getEngine(linkedModule);
    if (engine) return engine;
  }

  // Find engines that support this strategy
  const compatibleEngines = getEnginesForStrategy(strategyId);
  if (compatibleEngines.length > 0) {
    // Prefer engine with most capabilities
    return compatibleEngines.sort((a, b) =>
      (b.capabilities?.length || 0) - (a.capabilities?.length || 0)
    )[0];
  }

  // Fall back to domain-based selection
  const domainEngines = getEnginesByDomain(domain);
  return domainEngines[0] || null;
}

/**
 * Get all available data model engines as array for UI selection
 * @returns {object[]} Array of engine summaries
 */
export function getAllDataModelEngines() {
  return Object.values(DATA_MODEL_ENGINES).map(engine => ({
    id: engine.id,
    name: engine.name,
    module: engine.module,
    description: engine.description,
    version: engine.version,
    domain: engine.domain,
    status: engine.status || 'available',
    capabilities: engine.capabilities,
    supportedStrategies: engine.supported_strategies
  }));
}

// Alias for backward compatibility
export const getAllEngines = getAllDataModelEngines;

/**
 * Detect the transform module from a configuration object
 *
 * The config itself describes the data model, so we can infer which
 * Kehrnel module should be used for transformation.
 *
 * Detection rules:
 * 1. If config has reverse_paths=true or node_representation.path.mode='reversed' → transform.rps
 * 2. If config has query_engine.mode containing 'atlas_search' → transform.rps
 * 3. If config has coding.archetype_ids with sequential encoding → transform.rps
 * 4. If config collections use 'cn' nodes field → transform.rps
 * 5. Default → transform.openehr (or transform for generic)
 *
 * @param {object} config - The persistence configuration JSON
 * @returns {object} Module detection result with id, confidence, and reasons
 */
export function detectModuleFromConfig(config) {
  if (!config || typeof config !== 'object') {
    return {
      module: 'transform',
      confidence: 'low',
      reasons: ['No config provided, using default']
    };
  }

  const reasons = [];
  let score = { rps: 0, openehr: 0 };

  // Check for reversed paths
  const pathMode = config.node_representation?.path?.mode;
  if (pathMode === 'reversed') {
    score.rps += 3;
    reasons.push('Reversed path mode detected');
  }

  // Check for reverse_paths flag in collections
  if (config.collections?.compositions?.reverse_paths === true) {
    score.rps += 3;
    reasons.push('reverse_paths enabled in compositions');
  }

  // Check for cn/sn node fields (RPS convention)
  const compNodesField = config.collections?.compositions?.nodes_field || config.fields?.composition?.nodes;
  const searchNodesField = config.collections?.search?.nodes_field || config.fields?.search?.nodes;

  if (compNodesField === 'cn' || searchNodesField === 'sn') {
    score.rps += 2;
    reasons.push(`RPS node field convention (cn/sn)`);
  }

  // Check for dual collection mode (search collection enabled)
  if (config.collections?.search?.enabled === true) {
    score.rps += 1;
    reasons.push('Dual collection mode (search enabled)');
  }

  // Check query engine mode
  const queryMode = config.query_engine?.mode;
  if (queryMode && queryMode.includes('atlas_search')) {
    score.rps += 2;
    reasons.push(`Atlas Search query mode: ${queryMode}`);
  }
  if (queryMode === 'atlas_search_dual') {
    score.rps += 1;
    reasons.push('Dual-collection Atlas Search');
  }

  // Check for arcodes/shortcuts dictionaries
  if (config.coding?.archetype_ids?.enabled && config.coding?.archetype_ids?.sequential) {
    score.rps += 2;
    reasons.push('Sequential archetype ID encoding');
  }
  if (config.coding?.atcodes?.enabled && config.coding?.atcodes?.strategy === 'negative_int') {
    score.rps += 1;
    reasons.push('Negative integer AT-code strategy');
  }

  // Check for path token joiner (RPS uses '.')
  if (config.node_representation?.path?.token_joiner === '.') {
    score.rps += 1;
    reasons.push('Dot token joiner for paths');
  }

  // Determine module based on scores
  const totalRps = score.rps;
  const totalOpenehr = score.openehr;

  let module, confidence;

  if (totalRps >= 5) {
    module = 'transform.rps';
    confidence = 'high';
  } else if (totalRps >= 3) {
    module = 'transform.rps';
    confidence = 'medium';
  } else if (totalRps >= 1) {
    module = 'transform.openehr';
    confidence = 'medium';
    reasons.push('Some RPS features but not enough for full RPS mode');
  } else {
    module = 'transform.openehr';
    confidence = 'low';
    if (reasons.length === 0) {
      reasons.push('No specific data model indicators found, using default');
    }
  }

  return {
    module,
    confidence,
    scores: { rps: totalRps, openehr: totalOpenehr },
    reasons,
    detectedFeatures: {
      reversedPaths: pathMode === 'reversed' || config.collections?.compositions?.reverse_paths,
      dualCollection: config.collections?.search?.enabled,
      atlasSearch: queryMode?.includes('atlas_search'),
      arcodes: config.coding?.archetype_ids?.enabled,
      atcodes: config.coding?.atcodes?.enabled
    }
  };
}

export default {
  DATA_MODEL_ENGINES,
  getDataModelEngine,
  getEngine,
  getEnginesByDomain,
  getEnginesForStrategy,
  validateEngineForStrategy,
  getEngineDictionaries,
  getRecommendedEngine,
  getAllDataModelEngines,
  getAllEngines,
  detectModuleFromConfig
};
