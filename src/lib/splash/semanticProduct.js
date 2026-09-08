import { createDefaultContextContract } from '@/lib/contextObjects/contextContract';

export const SPLASH_SEMANTIC_PRODUCT_SCHEMA = 'splash-semantic-product/1';

function isObjectRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function slugify(value, fallback = 'artifact') {
  const normalized = `${value || ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function toAttribute(value, fallback = 'field') {
  const source = `${value || fallback}`.trim();
  if (!source) return fallback;
  const cleaned = source
    .replace(/[^A-Za-z0-9 _-]/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallback;
  const [first, ...rest] = cleaned.split(' ');
  return [
    first.toLowerCase(),
    ...rest.map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()),
  ].join('');
}

function normalizeRole(role, hasChildren = false) {
  switch (`${role || ''}`.trim()) {
    case 'section':
      return 'section';
    case 'cluster':
      return 'group';
    case 'slot':
      return 'block';
    case 'element':
      return 'field';
    case 'root':
      return 'section';
    default:
      return hasChildren ? 'group' : 'field';
  }
}

function normalizeDataType(datatype, role) {
  const candidate = `${datatype || ''}`.trim();
  if (role === 'section' || role === 'group' || role === 'block') {
    return 'object';
  }

  switch (candidate) {
    case 'coded_text':
      return 'coded_text';
    case 'quantity':
      return 'quantity';
    case 'date_time':
      return 'datetime';
    case 'date':
      return 'date';
    case 'boolean':
      return 'boolean';
    case 'ordinal':
      return 'number';
    case 'count':
      return 'integer';
    case 'duration':
      return 'duration';
    case 'identifier':
      return 'identifier';
    case 'uri':
      return 'uri';
    case 'multimedia':
      return 'reference';
    case 'proportion':
      return 'number';
    case 'interval':
      return 'interval';
    case 'json':
      return 'object';
    case 'any':
      return 'string';
    case 'text':
    default:
      return 'string';
  }
}

function normalizeOccurrences(cardinality) {
  if (!isObjectRecord(cardinality)) {
    return { min: 0, max: 1 };
  }

  const min = Number.isFinite(cardinality.min)
    ? Math.max(0, Math.trunc(cardinality.min))
    : 0;
  const maxRaw = cardinality.max;

  if (maxRaw === '*') {
    return { min, max: '*' };
  }

  if (Number.isFinite(maxRaw)) {
    return { min, max: Math.max(min, Math.trunc(maxRaw)) };
  }

  return { min, max: 1 };
}

function normalizeHierarchicalNode(node, lineage = [1]) {
  const childNodes = safeArray(node?.children);
  const role = normalizeRole(node?.role, childNodes.length > 0);
  const fallbackName = role === 'field'
    ? `Field ${lineage.join('.')}`
    : `Node ${lineage.join('.')}`;
  const name = `${node?.label || node?.name || fallbackName}`.trim();

  return {
    nodeId: `${node?.nodeId || slugify(name, `node-${lineage.join('-')}`)}`.trim(),
    name,
    attribute: toAttribute(node?.nodeId || name, `field${lineage[lineage.length - 1] || 1}`),
    description: typeof node?.description === 'string' ? node.description : '',
    role,
    dataType: normalizeDataType(node?.datatype || node?.dataType, role),
    occurrences: normalizeOccurrences(node?.cardinality || node?.occurrences),
    annotations: isObjectRecord(node?.annotations) ? node.annotations : {},
    ontologyRef: typeof node?.ontologyRef === 'string' && node.ontologyRef.trim()
      ? node.ontologyRef.trim()
      : undefined,
    modelElementId: typeof node?.modelElementId === 'string' && node.modelElementId.trim()
      ? node.modelElementId.trim()
      : undefined,
    aliases: safeArray(node?.aliases).filter((value) => typeof value === 'string' && value.trim()),
    provenanceMarkers: safeArray(node?.provenanceMarkers).filter(
      (value) => typeof value === 'string' && value.trim(),
    ),
    children: childNodes.map((childNode, index) =>
      normalizeHierarchicalNode(childNode, [...lineage, index + 1]),
    ),
  };
}

function baseSplashMetadata(product, artifact, artifactType) {
  return {
    sourceOrigin: 'splash',
    semanticAssurance: 'governed',
    artifactType,
    artifactId: artifact.id,
    artifactVersion: artifact.version,
    governanceLayer: artifact.governanceLayer || null,
    productId: product.productId || null,
    productVersion: product.productVersion || null,
    contentHash: product.contentHash || null,
    referenceCatalogVersion: product.referenceCatalogVersion || null,
    ontologyRefs: safeArray(product.includedOntologyRefs),
    productGovernanceLayers: safeArray(product.governanceLayers),
  };
}

function createBaseDefinition({
  id,
  name,
  description,
  scope,
  kind,
  version,
  externalId,
  rmType,
  hierarchicalRoot,
  metadata,
}) {
  const contextContract = createDefaultContextContract(kind);

  return {
    id,
    externalId,
    name,
    description: description || '',
    scope,
    kind,
    origin: 'standard',
    status: 'active',
    version: version || '1.0.0',
    versionString: version || '1.0.0',
    rmType: rmType || null,
    definitionFormat: 'SPLASH-HIERARCHICAL',
    definition: {
      definitionType: 'SPLASH-HIERARCHICAL',
      name,
      rmEntity: rmType || null,
      root: hierarchicalRoot,
    },
    terminologyBindings: [],
    structuralBindings: [],
    relationships: [],
    metadata: {
      tags: ['splash', 'governed', scope],
      contextContract,
      temporalMode: contextContract.temporalMode,
      ...metadata,
    },
  };
}

function createDomainModelDefinition(product, domainModel, importSource = {}) {
  const hierarchicalRoot = normalizeHierarchicalNode(domainModel.rootNode, [1]);
  const artifactMetadata = baseSplashMetadata(product, domainModel, 'domain_model');

  return createBaseDefinition({
    id: `splash-domain-model-${slugify(domainModel.id, 'domain-model')}`,
    externalId: domainModel.id,
    name: domainModel.label || domainModel.id,
    description: domainModel.description || '',
    scope: 'building_block',
    kind: 'block',
    version: domainModel.version,
    rmType: domainModel.baseClassRef || null,
    hierarchicalRoot,
    metadata: {
      splash: {
        ...artifactMetadata,
        importSource,
        ontologyScope: domainModel.ontologyScope || null,
        baseClassRef: domainModel.baseClassRef || null,
        terminologyBindings: safeArray(domainModel.terminologyBindings),
        structuralBindings: safeArray(domainModel.structuralBindings),
        semanticRelationships: safeArray(domainModel.semanticRelationships),
      },
    },
  });
}

function createTemplateDefinition(product, templateArtifact, operationalTemplate, importSource = {}) {
  const hierarchicalRoot = normalizeHierarchicalNode(templateArtifact.rootTree, [1]);
  const artifactMetadata = baseSplashMetadata(product, templateArtifact, 'template');
  const semanticDescriptorRegistry = isObjectRecord(operationalTemplate?.semanticDescriptorRegistry)
    ? operationalTemplate.semanticDescriptorRegistry
    : {};

  return createBaseDefinition({
    id: `splash-template-${slugify(templateArtifact.id, 'template')}`,
    externalId: templateArtifact.id,
    name: templateArtifact.label || templateArtifact.id,
    description: templateArtifact.description || '',
    scope: 'business_object',
    kind: 'context_object',
    version: templateArtifact.version,
    rmType: templateArtifact.templateKind || null,
    hierarchicalRoot,
    metadata: {
      splash: {
        ...artifactMetadata,
        importSource,
        templateKind: templateArtifact.templateKind || null,
        sourceDomainModelRefs: safeArray(templateArtifact.sourceDomainModelRefs),
        validationStatus: templateArtifact.validationStatus || null,
        terminologyBindings: safeArray(templateArtifact.terminologyBindings),
        structuralBindings: safeArray(templateArtifact.structuralBindings),
        semanticRelationships: safeArray(templateArtifact.semanticRelationships),
        operationalTemplateId: operationalTemplate?.id || null,
        operationalTemplateVersion: operationalTemplate?.sourceVersion || null,
        canonicalPathRegistry: operationalTemplate?.canonicalPathRegistry || {},
        datatypeMetadata: operationalTemplate?.datatypeMetadata || {},
        semanticMarkerProjection: operationalTemplate?.semanticMarkerProjection || {},
        semanticDescriptorRegistry,
        semanticDescriptorCount: Object.keys(semanticDescriptorRegistry).length,
      },
      copilot: {
        semanticProducts: [product.productId].filter(Boolean),
      },
    },
  });
}

function toUploadItem(definition) {
  return {
    name: definition.name,
    domain: 'contextobject',
    uploadTarget: 'definitions',
    definitionId: definition.id,
    payload: definition,
  };
}

export function isSplashSemanticProduct(payload) {
  return isObjectRecord(payload) && payload.schemaVersion === SPLASH_SEMANTIC_PRODUCT_SCHEMA;
}

export function extractDefinitionsFromSplashProduct(product, options = {}) {
  if (!isSplashSemanticProduct(product)) {
    return [];
  }

  const importSource = {
    fileName: typeof options.fileName === 'string' ? options.fileName : null,
    size: Number.isFinite(options.size) ? options.size : null,
  };

  const domainModels = safeArray(product.includedDomainModels || product.includedBlocks);
  const templates = safeArray(product.includedTemplates || product.includedDefinitions);
  const operationalTemplates = safeArray(
    product.includedOperationalTemplates || product.includedOperationalDefinitions,
  );
  const operationalBySourceDefinitionId = new Map(
    operationalTemplates
      .filter((item) => isObjectRecord(item) && typeof item.sourceDefinitionId === 'string')
      .map((item) => [item.sourceDefinitionId, item]),
  );

  return [
    ...domainModels.map((domainModel) =>
      createDomainModelDefinition(product, domainModel, importSource),
    ),
    ...templates.map((templateArtifact) =>
      createTemplateDefinition(
        product,
        templateArtifact,
        operationalBySourceDefinitionId.get(templateArtifact.id) || null,
        importSource,
      ),
    ),
  ];
}

export function createDefinitionUploadsFromSplashProduct(product, options = {}) {
  return extractDefinitionsFromSplashProduct(product, options).map(toUploadItem);
}
