const SOURCE_COLLECTION = 'semantic_objects';
export const KEHRNEL_CONTEXT_CATALOG_COLLECTION = 'kehrnel_context_catalog';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toTitle(value, fallback = null) {
  const text = `${value || ''}`.trim();
  return text || fallback;
}

function tokenSet(...values) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => `${value || ''}`.trim())
        .filter(Boolean)
    )
  );
}

function summarizeNodes(nodes = []) {
  const roleCounts = {};
  for (const node of safeArray(nodes)) {
    const role = node?.role || 'unknown';
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  }
  return roleCounts;
}

function inferAssertionTypes(semanticObject) {
  const contract = semanticObject?.metadata?.contextContract || {};
  return tokenSet(contract.assertionModel, contract.outputFamilies).filter(Boolean);
}

function inferSubjectKinds(semanticObject) {
  const contract = semanticObject?.metadata?.contextContract || {};
  const primaryAnchor = contract.primaryAnchor;
  const contextType = contract.contextType;
  const supportsCrossSubject = Boolean(contract?.retrievalPolicy?.supportsCrossSubject);
  return tokenSet(primaryAnchor, contextType === 'population' || supportsCrossSubject ? 'population' : null);
}

function normalizeTerminologyBindings(bindings = []) {
  return safeArray(bindings).map((binding, index) => ({
    system: binding?.system || binding?.terminology || 'local',
    code: binding?.code || binding?.value || binding?.id || null,
    display: toTitle(binding?.display || binding?.name || binding?.label, `binding_${index + 1}`),
    synonyms: tokenSet(binding?.synonyms, binding?.aliases),
  }));
}

function normalizeRelations(semanticObject) {
  const contract = semanticObject?.metadata?.contextContract || {};
  const policy = contract?.relationPolicy || {};
  const relations = [];
  if (policy.parentChildAware) {
    relations.push({ predicate: 'parent_child', target: semanticObject?.id || 'root', direction: 'parent', weight: 1.0 });
  }
  if (policy.siblingAware) {
    relations.push({ predicate: 'sibling', target: semanticObject?.id || 'root', direction: 'sibling', weight: 0.8 });
  }
  if (policy.temporalReasoning) {
    relations.push({ predicate: 'temporal', target: semanticObject?.id || 'timeline', direction: 'temporal', weight: 0.9 });
  }
  for (const predicate of safeArray(policy.causalPredicates)) {
    relations.push({ predicate, target: semanticObject?.id || 'context', direction: 'causal', weight: 0.7 });
  }
  return relations;
}

function normalizeBlocks(semanticObject) {
  const nodes = safeArray(semanticObject?.nodes);
  const explicitBlocks = nodes.filter((node) => node?.role === 'block');
  if (explicitBlocks.length) {
    return explicitBlocks.map((node) => ({
      id: node.blockId || node.attribute || node.name || node.nodeId,
      title: node.name || node.attribute || node.blockId || node.nodeId,
      role: node.role || null,
      aliases: tokenSet(node.attribute, node.dataPath),
    }));
  }

  const contract = semanticObject?.metadata?.contextContract || {};
  return safeArray(contract.contains).map((item) => ({
    id: item,
    title: toTitle(item, item),
    role: 'contains',
    aliases: [],
  }));
}

export function normalizeSemanticObjectToKehrnelDefinition(semanticObject = {}, environment = null) {
  const contract = semanticObject?.metadata?.contextContract || {};
  const status = semanticObject?.status || 'draft';
  const retrieval = contract.retrievalPolicy || {};
  const terminology = contract.terminologyPolicy || {};
  const enrichment = contract.enrichmentPolicy || {};
  const relation = contract.relationPolicy || {};
  const resolution = contract.resolutionPolicy || {};

  return {
    _id: semanticObject.id,
    _catalogType: 'definition',
    sourceId: semanticObject.id,
    title: semanticObject.name || semanticObject.id || 'Untitled ContextObject',
    id: semanticObject.id,
    kind: semanticObject.kind || 'context_object',
    domain: environment?.domain || 'contextobjects',
    summary: semanticObject.description || '',
    tags: tokenSet(semanticObject?.metadata?.tags),
    status,
    subject_kinds: inferSubjectKinds(semanticObject),
    assertion_types: inferAssertionTypes(semanticObject),
    blocks: normalizeBlocks(semanticObject),
    terminology: normalizeTerminologyBindings(semanticObject?.terminologyBindings),
    relations: normalizeRelations(semanticObject),
    output_families: tokenSet(contract.outputFamilies, contract.viewFamilies),
    retrieval: {
      defaultMode: retrieval.defaultMode || 'context_lookup',
      allowedModes: tokenSet(retrieval.allowedModes),
      materialization: retrieval.materialization || 'on_read',
      deterministicCompilation: retrieval.deterministicCompilation || 'guided',
      supportsCrossSubject: Boolean(retrieval.supportsCrossSubject),
    },
    resolution: {
      terminology_match_mode: terminology.matchMode || 'hybrid',
      descriptions_enabled: Boolean(enrichment.useDescriptions ?? true),
      embeddings_enabled: Boolean(enrichment.useEmbeddings),
      relation_scoring_enabled: Boolean(enrichment.relationAwareScoring ?? true),
      parent_child_reasoning: Boolean(relation.parentChildAware ?? true),
      temporal_reasoning: Boolean(relation.temporalReasoning ?? true),
      causal_predicates_enabled: safeArray(relation.causalPredicates).length > 0,
      minimum_signal_count: Number(resolution.minimumSignalCount ?? 1),
      clarification_threshold: Number(resolution.confidenceThreshold ?? 0.65),
      deterministic_threshold: retrieval.deterministicCompilation === 'strict' ? 0.9 : 0.84,
    },
    source: {
      collection: SOURCE_COLLECTION,
      version: semanticObject.version || semanticObject.versionString || '1.0.0',
      scope: semanticObject.scope || null,
      roleCounts: summarizeNodes(semanticObject.nodes),
      environmentId: environment?.id || null,
      database: environment?.database || null,
      updatedAt: semanticObject?.metadata?.updatedAt || null,
    },
    raw: semanticObject,
  };
}

export async function buildKehrnelContextCatalog(db, environment, options = {}) {
  const includeDraft = options.includeDraft !== false;
  const statuses = includeDraft ? ['active', 'draft'] : ['active'];
  const filter = {
    $or: [
      { kind: 'context_object' },
      { scope: 'business_object' },
      { kind: 'block' },
      { scope: 'building_block' },
    ],
    status: { $in: statuses },
  };
  const semanticObjects = await db.collection(SOURCE_COLLECTION).find(filter).sort({ 'metadata.updatedAt': -1 }).toArray();
  const definitions = semanticObjects.map((semanticObject) =>
    normalizeSemanticObjectToKehrnelDefinition(semanticObject, environment)
  );
  return {
    environment: {
      id: environment?.id || null,
      name: environment?.name || null,
      database: environment?.database || null,
    },
    summary: {
      totalDefinitions: definitions.length,
      activeDefinitions: definitions.filter((item) => item.status === 'active').length,
      draftDefinitions: definitions.filter((item) => item.status === 'draft').length,
    },
    definitions,
  };
}

export async function publishKehrnelContextCatalog(db, environment, actorEmail = 'unknown', options = {}) {
  const catalog = await buildKehrnelContextCatalog(db, environment, options);
  const collection = db.collection(KEHRNEL_CONTEXT_CATALOG_COLLECTION);
  const publishedAt = new Date().toISOString();

  await collection.deleteMany({ _catalogType: 'definition' });
  if (catalog.definitions.length) {
    await collection.insertMany(
      catalog.definitions.map((definition) => ({
        ...definition,
        publishedAt,
        publishedBy: actorEmail,
      }))
    );
  }

  await collection.updateOne(
    { _id: '_catalog_meta' },
    {
      $set: {
        _catalogType: 'meta',
        environment: catalog.environment,
        summary: catalog.summary,
        publishedAt,
        publishedBy: actorEmail,
      },
    },
    { upsert: true }
  );

  return {
    ...catalog,
    publishedAt,
    publishedBy: actorEmail,
    collection: KEHRNEL_CONTEXT_CATALOG_COLLECTION,
  };
}
