// src/components/views/strategyStudio/StrategyManager/components/SpecVisualization/specTypes.js
/**
 * Universal Spec.json Type Definitions & Normalizer
 *
 * Supports the full strategy-pack/v1 format from Kehrnel:
 * - meta: Strategy metadata
 * - glossary: Term definitions
 * - logicalModel: Source types, concepts, destinations
 * - physicalProfiles: Encoding profiles
 * - storageModel: Store definitions with indexes
 * - transformModel: Pipeline steps and invariants
 * - queryModel: Query modes
 * - visualization: Canvas configuration with collectionModel, transformGraph, indexOverlay
 */

/**
 * Normalize spec from Kehrnel to visualization format
 *
 * Kehrnel returns:
 * {
 *   id, name, config_schema, default_config, ops, ...  // Top-level
 *   pack_spec: { meta, logicalModel, physicalProfiles, storageModel, transformModel, visualization }
 * }
 */
export function normalizeSpec(kehrnelSpec) {
  if (!kehrnelSpec) return null;

  // Check for pack_spec (nested structure from Kehrnel)
  const packSpec = kehrnelSpec.pack_spec;

  if (packSpec) {
    return normalizeFromPackSpec(kehrnelSpec, packSpec);
  }

  // Check if this IS a pack_spec (direct format)
  const isPackFormat = kehrnelSpec.meta?.strategyId || kehrnelSpec.logicalModel || kehrnelSpec.storageModel;
  if (isPackFormat) {
    return normalizePackFormat(kehrnelSpec);
  }

  // Legacy format - minimal extraction
  return normalizeLegacyFormat(kehrnelSpec);
}

/**
 * Normalize when pack_spec is nested inside the response
 * This is the typical Kehrnel API response format
 */
function normalizeFromPackSpec(topLevel, packSpec) {
  const meta = packSpec.meta || {};
  const viz = packSpec.visualization || {};

  // physicalProfiles is { encodingProfiles: [...] }
  const encodingProfiles = packSpec.physicalProfiles?.encodingProfiles || [];

  return {
    meta: {
      id: meta.strategyId || topLevel.id,
      name: meta.title || topLevel.name,
      version: meta.specVersion || topLevel.version || '1.0',
      domain: meta.domain || topLevel.domain || 'openEHR',
      summary: meta.summary || topLevel.summary || topLevel.description || '',
      tags: meta.tags || topLevel.ui?.tags || [],
      owners: meta.owners || [],
      compat: meta.compat
    },
    glossary: packSpec.glossary,
    logicalModel: normalizeLogicalModel(packSpec.logicalModel),
    physicalProfiles: normalizePhysicalProfiles(encodingProfiles),
    storageModel: normalizeStorageModel(packSpec.storageModel, packSpec.bundles, viz.collectionModel),
    transformModel: normalizeTransformModel(packSpec.transformModel, viz.transformGraph),
    queryModel: packSpec.queryModel,
    bundles: packSpec.bundles,
    samples: packSpec.samples,
    visualization: normalizeVisualization(viz),
    // Top-level config (for UI)
    config_schema: topLevel.config_schema,
    default_config: topLevel.default_config,
    ops: topLevel.ops,
    // Keep raw for reference
    _raw: { topLevel, packSpec }
  };
}

/**
 * Normalize the full strategy-pack/v1 format
 */
function normalizePackFormat(spec) {
  const meta = spec.meta || {};
  const viz = spec.visualization || {};

  return {
    meta: {
      id: meta.strategyId || meta.id,
      name: meta.title || meta.name,
      version: meta.specVersion || meta.version || '1.0',
      domain: meta.domain || 'openEHR',
      summary: meta.summary || meta.description || '',
      tags: meta.tags || [],
      owners: meta.owners || [],
      compat: meta.compat
    },
    glossary: spec.glossary,
    logicalModel: normalizeLogicalModel(spec.logicalModel),
    physicalProfiles: normalizePhysicalProfiles(spec.physicalProfiles),
    storageModel: normalizeStorageModel(spec.storageModel, spec.bundles, viz.collectionModel),
    transformModel: normalizeTransformModel(spec.transformModel, viz.transformGraph),
    queryModel: spec.queryModel,
    bundles: spec.bundles,
    samples: spec.samples,
    visualization: normalizeVisualization(viz),
    // Keep raw spec for reference
    _raw: spec
  };
}

/**
 * Normalize physical profiles (encoding profiles)
 *
 * Each profile has:
 * - paths: { mode, separator, order, dictRef }
 * - keys: { mode, dictRef }
 * - payload: { mode }
 * - dictionaries: { at_codes, archetype_ids }
 * - ids: { ehr_id, composition_id }
 */
function normalizePhysicalProfiles(profiles) {
  if (!profiles || !Array.isArray(profiles)) return [];

  return profiles.map(p => ({
    id: p.id,
    name: p.title || p.id,
    description: p.description,
    // Path encoding config
    paths: p.paths,
    // Key encoding (verbatim or shortcuts)
    keys: p.keys,
    // Payload mode (full or minimized)
    payload: p.payload,
    // Dictionary requirements
    dictionaries: p.dictionaries,
    // ID formats
    ids: p.ids,
    // Is this the default profile?
    isDefault: p.id?.includes('codedpath')
  }));
}

/**
 * Normalize visualization section for rendering
 */
function normalizeVisualization(viz) {
  if (!viz) return null;

  return {
    layout: viz.layout || 'LR',
    collectionModel: normalizeCollectionModel(viz.collectionModel),
    transformGraph: normalizeTransformGraph(viz.transformGraph),
    indexOverlay: viz.indexOverlay || null,
    legends: viz.legends || {},
    colors: viz.colors || {
      source: '#3b82f6',
      intermediate: '#8b5cf6',
      sink: '#10b981',
      dictionary: '#f59e0b'
    },
    grouping: viz.grouping || {
      Transform: { label: 'Transform', color: '#3b82f6' },
      Encoding: { label: 'Encoding', color: '#8b5cf6' },
      Materialize: { label: 'Materialize', color: '#10b981' }
    }
  };
}

/**
 * Normalize collection model from visualization
 *
 * Actual structure from spec:
 * {
 *   id: "coll.compositions",
 *   kind: "collection",
 *   store: "store:compositions",
 *   label: "compositions",
 *   fields: ["_id", "ehr_id", "comp_id", "tid", "v", "cn"],
 *   expand: { "cn": ["p", "kp", "li", "data"] },
 *   badges: ["canonical", "patient", "hydration"],
 *   links: [{ type: "joinsTo", target: "coll.search", on: "_id" }]
 * }
 */
function normalizeCollectionModel(collectionModel) {
  if (!collectionModel) return null;

  const entities = (collectionModel.entities || []).map(entity => ({
    id: entity.id,
    kind: entity.kind,
    storeRef: entity.store, // Note: spec uses 'store', we normalize to 'storeRef'
    label: entity.label,
    // Fields are just strings in the spec
    fields: (entity.fields || []).map(fieldName => ({
      name: fieldName,
      // Check if this field has expansion
      expandable: entity.expand && entity.expand[fieldName],
      nestedFields: entity.expand?.[fieldName] || null
    })),
    expand: entity.expand,
    badges: entity.badges || [],
    links: entity.links || []
  }));

  // Extract joins from entity links
  const joins = [];
  entities.forEach(entity => {
    (entity.links || []).forEach(link => {
      if (link.type === 'joinsTo') {
        joins.push({
          from: entity.id,
          to: link.target,
          key: link.on,
          cardinality: link.cardinality || '1:1'
        });
      }
    });
  });

  return { entities, joins };
}

/**
 * Normalize nested field definitions recursively
 */
function normalizeNestedFields(nested) {
  if (!nested) return undefined;

  const result = {};
  Object.entries(nested).forEach(([key, field]) => {
    result[key] = {
      name: field.name || key,
      type: field.type,
      logicalKey: field.logicalKey,
      indexed: field.indexed,
      indexType: field.indexType,
      description: field.description,
      badge: field.badge,
      nested: field.nested ? normalizeNestedFields(field.nested) : undefined
    };
  });
  return result;
}

/**
 * Normalize transform graph from visualization
 *
 * Actual structure from spec:
 * {
 *   nodes: [
 *     { id: "src.envelope", kind: "source", label: "Composition Envelope", typeRef: "..." },
 *     { id: "op.flatten", kind: "transform", label: "Flatten → nodes_full", stepRef: "step.flatten" },
 *     { id: "op.materialize.cn", kind: "sink", label: "Write compositions (cn)", stepRef: "...", entityRef: "coll.compositions" }
 *   ],
 *   edges: [
 *     { from: "src.envelope", to: "op.flatten" },
 *     { from: "op.flatten", to: "op.materialize.cn" },
 *   ]
 * }
 */
function normalizeTransformGraph(transformGraph) {
  if (!transformGraph) return null;

  const nodes = (transformGraph.nodes || []).map(node => ({
    id: node.id,
    kind: node.kind, // source, transform, sink
    label: node.label,
    // References
    typeRef: node.typeRef, // For source nodes
    stepRef: node.stepRef, // For transform/sink nodes
    entityRef: node.entityRef, // For sink nodes (which collection)
    // Computed
    nodeType: mapKindToNodeType(node.kind)
  }));

  const edges = (transformGraph.edges || []).map(edge => ({
    from: edge.from,
    to: edge.to
  }));

  return { nodes, edges, layout: transformGraph.layout || 'LR' };
}

function mapKindToNodeType(kind) {
  switch (kind) {
    case 'source': return 'source';
    case 'transform': return 'transform';
    case 'sink': return 'store';
    default: return 'transform';
  }
}

/**
 * Normalize logical model
 */
function normalizeLogicalModel(logicalModel) {
  if (!logicalModel) return null;

  return {
    source: {
      types: (logicalModel.source?.types || []).map(t => ({
        id: t.id,
        name: t.title || t.name,
        kind: t.kind,
        description: t.description,
        fields: t.fields,
        icon: t.kind === 'document' ? 'FileJson' : 'Box'
      })),
      identity: extractIdentityFields(logicalModel.source?.types)
    },
    concepts: (logicalModel.concepts || []).map(c => ({
      id: c.id,
      name: c.title || c.name,
      kind: c.kind,
      meaning: c.meaning,
      description: c.meaning || c.description,
      fields: c.fields,
      icon: getConceptIcon(c.id)
    })),
    destinations: logicalModel.destinations
  };
}

/**
 * Normalize storage model with stores and joins
 * Uses visualization.collectionModel for rich field definitions if available
 */
function normalizeStorageModel(storageModel, bundles, collectionModel) {
  if (!storageModel) return { stores: [], joins: [], encodingProfiles: [] };

  // Build entity lookup from collectionModel
  const entityLookup = {};
  if (collectionModel?.entities) {
    collectionModel.entities.forEach(entity => {
      entityLookup[entity.storeRef] = entity;
    });
  }

  const stores = (storageModel.stores || []).map(store => {
    // Use visualization entity if available for rich field definitions
    const vizEntity = entityLookup[store.id];

    return {
      id: store.id,
      name: vizEntity?.title || store.title || store.id.replace('store:', ''),
      role: vizEntity?.role || inferStoreRole(store),
      engine: store.engine,
      destinationType: store.destinationType,
      collectionNameConfig: store.collectionNameFromConfig,
      encodingProfileConfig: store.encodingProfileFromConfig,
      badgeFromConfig: vizEntity?.badgeFromConfig,
      description: store.purpose || '',
      // Use visualization fields if available, otherwise extract from store
      fields: vizEntity?.fields || extractStoreFieldsFromDestination(store, storageModel),
      indexes: (store.indexes || []).map(idx => ({
        id: idx.id,
        name: idx.id,
        type: idx.type,
        fields: idx.fields,
        purpose: idx.purpose
      })),
      search: store.search,
      atlasSearch: store.search?.kind === 'atlas_search' ? {
        indexNameConfig: store.search.indexNameFromConfig,
        definitionRef: store.search.definitionRef,
        purpose: store.search.purpose
      } : null,
      contains: store.contains,
      joinKeys: ['_id', 'ehr_id'] // Default join keys
    };
  });

  // Use visualization joins if available, otherwise infer
  const joins = collectionModel?.joins || extractJoins(stores, storageModel);

  return {
    stores,
    joins,
    encodingProfiles: [] // Will be populated from physicalProfiles
  };
}

/**
 * Normalize transform model with pipeline and artifacts
 * Uses visualization.transformGraph for rich node/edge definitions if available
 */
function normalizeTransformModel(transformModel, transformGraph) {
  if (!transformModel) return { artifacts: [], pipeline: [], dictionaries: [], invariants: [], vizGraph: null };

  // Build vizNode lookup from transformGraph
  const vizNodeLookup = {};
  if (transformGraph?.nodes) {
    transformGraph.nodes.forEach(node => {
      if (node.ref) {
        vizNodeLookup[node.ref] = node;
      }
    });
  }

  // Extract artifacts from pipeline steps
  const artifactSet = new Set();
  const pipeline = (transformModel.pipeline || []).map(step => {
    // Track artifacts
    if (step.in) artifactSet.add(step.in);
    if (step.out) artifactSet.add(step.out);
    if (step.from) artifactSet.add(step.from);

    // Use visualization node data if available
    const vizNode = vizNodeLookup[step.id];

    return {
      id: step.id,
      name: vizNode?.label || step.title || step.op,
      type: mapOpToType(step.op),
      op: step.op,
      icon: vizNode?.icon || step.visual?.icon || mapOpToIcon(step.op),
      group: vizNode?.group || step.visual?.group || inferGroup(step.op),
      inputs: step.in ? [step.in] : (step.from ? [step.from] : []),
      outputs: step.out ? [step.out] : (step.toStore ? [step.toStore] : []),
      params: step.params || {},
      toStore: step.toStore,
      nodeArrayField: step.nodeArrayField,
      extraFields: step.extraFields,
      description: vizNode?.notes || step.visual?.notes || '',
      notes: vizNode?.notes || step.visual?.notes
    };
  });

  // Build artifacts list
  const artifacts = Array.from(artifactSet).map(id => {
    // Check if there's a viz node for this artifact
    const vizNode = transformGraph?.nodes?.find(n => n.ref === id);
    return {
      id,
      name: vizNode?.label || formatArtifactName(id),
      type: vizNode?.type || inferArtifactType(id, pipeline),
      icon: vizNode?.icon
    };
  });

  // Add store sinks
  pipeline.forEach(step => {
    if (step.toStore && !artifacts.find(a => a.id === step.toStore)) {
      const vizNode = transformGraph?.nodes?.find(n => n.ref === step.toStore);
      artifacts.push({
        id: step.toStore,
        name: vizNode?.label || step.toStore.replace('store:', ''),
        type: 'sink',
        store: step.toStore,
        icon: vizNode?.icon || 'Database'
      });
    }
  });

  return {
    artifacts,
    pipeline,
    dictionaries: extractDictionaries(transformModel),
    invariants: transformModel.invariants || [],
    // Include the visualization graph for direct rendering if available
    vizGraph: transformGraph || null
  };
}

/**
 * Legacy format normalizer - ONLY extracts what's actually in the spec
 * Does NOT invent placeholder data
 */
function normalizeLegacyFormat(spec) {
  if (!spec) return null;

  return {
    meta: {
      id: spec.id || spec.strategy_id,
      name: spec.name || spec.title || spec.id,
      version: spec.version,
      domain: spec.domain,
      summary: spec.summary || spec.description,
      tags: spec.ui?.tags || spec.tags,
      maturity: spec.maturity
    },
    // Only include logicalModel if it exists in the spec
    logicalModel: spec.logicalModel ? normalizeLogicalModel(spec.logicalModel) : null,
    // Only extract storage if explicitly defined
    storageModel: spec.storageModel
      ? normalizeStorageModel(spec.storageModel, spec.bundles, spec.visualization?.collectionModel)
      : { stores: [], joins: [], encodingProfiles: [] },
    // Only extract transform if explicitly defined
    transformModel: spec.transformModel
      ? normalizeTransformModel(spec.transformModel, spec.visualization?.transformGraph)
      : { artifacts: [], pipeline: [], dictionaries: [], invariants: [], vizGraph: null },
    physicalProfiles: spec.physicalProfiles ? normalizePhysicalProfiles(spec.physicalProfiles) : [],
    visualization: spec.visualization ? normalizeVisualization(spec.visualization) : null,
    config_schema: spec.config_schema,
    default_config: spec.default_config,
    ops: spec.ops,
    _raw: spec
  };
}

// Helper functions

function extractIdentityFields(types) {
  if (!types || !types[0]?.fields) return { primary: '_id' };

  const fields = types[0].fields;
  const result = {};

  Object.entries(fields).forEach(([key, def]) => {
    if (def.role?.includes('identity')) {
      if (def.role.includes('document')) result.primary = key;
      if (def.role.includes('patient')) result.ehr = key;
      if (def.role.includes('template')) result.template = key;
    }
  });

  return result;
}

function getConceptIcon(id) {
  if (id.includes('node')) return 'Box';
  if (id.includes('path')) return 'Route';
  if (id.includes('archetype')) return 'Fingerprint';
  return 'Database';
}

function inferStoreRole(store) {
  const id = store.id?.toLowerCase() || '';
  if (id.includes('search')) return 'projection';
  if (id.includes('dict') || id.includes('code')) return 'dictionary';
  if (id.includes('shortcut')) return 'dictionary';
  return 'canonical';
}

function extractStoreFieldsFromDestination(store, storageModel) {
  // Return placeholder - actual fields come from visualization.collectionModel
  return [];
}

function extractJoins(stores, storageModel) {
  const joins = [];
  const storeIds = stores.map(s => s.id);

  // Find canonical and projection stores
  const canonical = stores.find(s => s.role === 'canonical');
  const projection = stores.find(s => s.role === 'projection');

  if (canonical && projection) {
    joins.push({
      from: canonical.id,
      to: projection.id,
      key: '_id',
      type: 'one-to-one',
      description: 'Composition to search node join for hydration'
    });
  }

  return joins;
}

function mapOpToType(op) {
  if (!op) return 'transform';
  if (op.includes('flatten')) return 'flatten';
  if (op.includes('materialize')) return 'materialize';
  if (op.includes('project')) return 'project';
  if (op.includes('normalize') || op.includes('encode')) return 'normalize';
  if (op.includes('validate')) return 'validate';
  return 'transform';
}

function mapOpToIcon(op) {
  if (!op) return 'Box';
  if (op.includes('flatten')) return 'Layers';
  if (op.includes('materialize')) return 'Database';
  if (op.includes('project') || op.includes('filter')) return 'Filter';
  if (op.includes('encode') || op.includes('normalize')) return 'Hash';
  return 'Box';
}

function inferGroup(op) {
  if (!op) return 'Transform';
  if (op.includes('flatten')) return 'Transform';
  if (op.includes('materialize')) return 'Materialize';
  if (op.includes('project')) return 'Transform';
  if (op.includes('encode')) return 'Encoding';
  return 'Transform';
}

function formatArtifactName(id) {
  if (!id) return 'Unknown';
  // Clean up path-like references
  const name = id.split('.').pop().replace(/_/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function inferArtifactType(id, pipeline) {
  // Check if it's an output of any step
  const isOutput = pipeline.some(s => s.outputs?.includes(id));
  const isInput = pipeline.some(s => s.inputs?.includes(id));

  if (!isInput && isOutput) return 'intermediate';
  if (isInput && !isOutput) return 'source';
  if (id.includes('store:')) return 'sink';
  return 'intermediate';
}

function extractDictionaries(transformModel) {
  const dicts = [];
  // Check pipeline for dictionary references
  (transformModel.pipeline || []).forEach(step => {
    if (step.params?.dictRef) {
      dicts.push({ id: step.params.dictRef, name: step.params.dictRef });
    }
  });
  return dicts;
}

// Legacy format helpers removed - we no longer invent placeholder data

export default {
  normalizeSpec
};
