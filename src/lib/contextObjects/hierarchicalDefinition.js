import {
  coerceDataTypeForRole,
  syncChildrenNodeIds
} from '@/lib/definitions/types';

export const HIERARCHICAL_DEFINITION_FORMAT = 'SPLASH-HIERARCHICAL';

export const DEFINITION_CANONICAL_SOURCES = {
  NATIVE: 'native_definition',
  NODE_PROJECTION: 'node_projection'
};

const HIERARCHICAL_OPTIONAL_FIELDS = [
  'description',
  'constraints',
  'timeRole',
  'terminologyBindings',
  'structuralBindings',
  'blockId',
  'versionRange',
  'referencedObjectId',
  'itemSpec',
  'inputs',
  'blockKind',
  'headerState',
  'headerProfileId',
  'centricity',
  'aqlPath',
  'rmType',
  'sourceNodeId',
  'sourceNodePath',
  'sourceId',
  'localizedName',
  'localizedDescriptions',
  'annotations',
  'dependsOn',
  'binding',
  'fhirType',
  'fhirTypes',
  'isValueLeaf',
  'min',
  'max'
];

const OPENEHR_FIELD_DATA_TYPES = {
  DV_BOOLEAN: 'boolean',
  DV_CODED_TEXT: 'coded_text',
  DV_COUNT: 'integer',
  DV_DATE: 'date',
  DV_DATE_TIME: 'datetime',
  DV_DURATION: 'duration',
  DV_IDENTIFIER: 'identifier',
  DV_MULTIMEDIA: 'string',
  DV_ORDINAL: 'integer',
  DV_PARSABLE: 'string',
  DV_PROPORTION: 'number',
  DV_QUANTITY: 'quantity',
  DV_TEXT: 'string',
  DV_TIME: 'time',
  DV_URI: 'uri'
};

const FHIR_FIELD_DATA_TYPES = {
  boolean: 'boolean',
  canonical: 'uri',
  code: 'code',
  date: 'date',
  dateTime: 'datetime',
  decimal: 'number',
  id: 'identifier',
  instant: 'datetime',
  integer: 'integer',
  integer64: 'integer',
  markdown: 'string',
  oid: 'identifier',
  positiveInt: 'integer',
  string: 'string',
  time: 'time',
  unsignedInt: 'integer',
  uri: 'uri',
  url: 'uri',
  uuid: 'identifier',
  Coding: 'coded_text',
  CodeableConcept: 'coded_text',
  Identifier: 'identifier',
  Quantity: 'quantity',
  Reference: 'reference'
};

const OPENEHR_EVENT_SERIES_TYPES = new Set(['HISTORY']);
const OPENEHR_EVENT_TYPES = new Set(['POINT_EVENT', 'INTERVAL_EVENT']);

function isObjectRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function cloneStructured(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
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
  return [first.toLowerCase(), ...rest.map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())].join('');
}

function normalizeMaxValue(value) {
  if (value === '*' || value === -1 || value === '-1') return '*';
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Math.max(0, Math.trunc(Number(value.trim())));
  }
  if (Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  return null;
}

function normalizeOccurrences(input) {
  const source = isObjectRecord(input?.occurrences)
    ? input.occurrences
    : (isObjectRecord(input) ? input : null);
  if (!source) return { min: 0, max: 1 };

  const min = Number.isFinite(source.min) ? Math.max(0, Math.trunc(source.min)) : 0;
  const maxRaw = normalizeMaxValue(source.max);
  if (maxRaw === '*') return { min, max: '*' };
  if (Number.isFinite(maxRaw)) {
    const max = Math.max(min, Math.trunc(maxRaw));
    return { min, max };
  }
  return { min, max: 1 };
}

function getLastAqlSegment(aqlPath) {
  const raw = asNonEmptyString(aqlPath);
  if (!raw) return '';
  const segments = raw.split('/').filter(Boolean);
  if (segments.length === 0) return '';
  return segments[segments.length - 1].replace(/\[.*?\]/g, '').trim();
}

function inferRole(rawNode, hasChildren, parentNodeId = null) {
  const candidate = `${rawNode?.role || ''}`.trim();
  if (candidate) return candidate;

  const rmType = asNonEmptyString(rawNode?.rmType).toUpperCase();
  if (!parentNodeId && rmType === 'COMPOSITION') return 'section';
  if (OPENEHR_EVENT_SERIES_TYPES.has(rmType)) return 'event_series';
  if (OPENEHR_EVENT_TYPES.has(rmType)) return 'event';

  return hasChildren ? 'group' : 'field';
}

function inferDataType(rawNode, role) {
  const rmType = asNonEmptyString(rawNode?.rmType).toUpperCase();
  const explicit = asNonEmptyString(rawNode?.dataType || rawNode?.type);
  const fhirType = asNonEmptyString(rawNode?.fhirType || (Array.isArray(rawNode?.fhirTypes) ? rawNode.fhirTypes[0] : ''));
  const candidate = explicit || OPENEHR_FIELD_DATA_TYPES[rmType] || FHIR_FIELD_DATA_TYPES[fhirType];
  const fallback = role === 'event_series' ? 'array' : role === 'field' ? 'string' : 'object';
  return coerceDataTypeForRole(role, candidate || fallback);
}

function getChildArray(rawNode) {
  if (!isObjectRecord(rawNode)) return [];
  if (Array.isArray(rawNode.children)) return rawNode.children;
  if (Array.isArray(rawNode.nodes)) return rawNode.nodes;
  if (Array.isArray(rawNode.items)) return rawNode.items;
  return [];
}

function looksLikeHierarchicalNode(node) {
  if (!isObjectRecord(node)) return false;
  const hasIdentityShape = ['name', 'attribute', 'role', 'nodeId', 'id'].some((key) => typeof node[key] === 'string' && node[key].trim());
  const hasChildren = getChildArray(node).length > 0;
  return hasIdentityShape || hasChildren;
}

function resolveRoot(definition) {
  if (!isObjectRecord(definition)) return null;

  const candidates = [
    definition.root,
    definition.definition?.root,
    definition.archetype?.definition?.root,
    definition.archetype?.root,
    definition.definition,
    definition.archetype?.definition,
    definition
  ];

  for (const candidate of candidates) {
    if (looksLikeHierarchicalNode(candidate)) {
      return candidate;
    }
  }

  return null;
}

function allocateNodeId(rawNode, lineage, usedIds) {
  const rawId = `${rawNode?.nodeId || rawNode?.id || rawNode?.sourceId || ''}`.trim();
  let candidate = rawId || `n-${lineage.join('-')}`;
  if (!candidate) candidate = `n-${Math.random().toString(36).slice(2, 10)}`;

  let unique = candidate;
  let counter = 1;
  while (usedIds.has(unique)) {
    unique = `${candidate}-${counter}`;
    counter += 1;
  }
  usedIds.add(unique);
  return unique;
}

function copyOptionalFields(source, target) {
  HIERARCHICAL_OPTIONAL_FIELDS.forEach((field) => {
    if (source?.[field] !== undefined) {
      target[field] = source[field];
    }
  });
}

function buildNode(rawNode, parentNodeId, lineage, usedIds) {
  const childRawNodes = getChildArray(rawNode);
  const role = inferRole(rawNode, childRawNodes.length > 0, parentNodeId);
  const dataType = inferDataType(rawNode, role);
  const nodeId = allocateNodeId(rawNode, lineage, usedIds);
  const fallbackName = role === 'field' ? `Field ${lineage.join('.')}` : `Node ${lineage.join('.')}`;
  const name = `${rawNode?.name || rawNode?.localizedName || rawNode?.label || fallbackName}`.trim();
  const attributeSeed = rawNode?.attribute || getLastAqlSegment(rawNode?.aqlPath) || rawNode?.name || rawNode?.localizedName || rawNode?.label;
  const attribute = toAttribute(attributeSeed, `field${lineage[lineage.length - 1] || 1}`);

  const nextNode = {
    nodeId,
    parentNodeId,
    role,
    name,
    attribute,
    dataType,
    occurrences: normalizeOccurrences(rawNode),
    childrenNodeIds: []
  };

  copyOptionalFields(rawNode, nextNode);

  const nodes = [nextNode];
  childRawNodes.forEach((childNode, index) => {
    const childNodes = buildNode(childNode, nodeId, [...lineage, index + 1], usedIds);
    if (childNodes.length > 0) {
      nextNode.childrenNodeIds.push(childNodes[0].nodeId);
      nodes.push(...childNodes);
    }
  });

  return nodes;
}

function projectOpenEhrNode(rawNode, lineage = [1], usedIds = new Set(), parentNodeId = null) {
  const childRawNodes = getChildArray(rawNode);
  const role = inferRole(rawNode, childRawNodes.length > 0, parentNodeId);
  const dataType = inferDataType(rawNode, role);
  const fallbackName = role === 'field' ? `Field ${lineage.join('.')}` : `Node ${lineage.join('.')}`;
  const name = asNonEmptyString(rawNode?.localizedName)
    || asNonEmptyString(rawNode?.name)
    || asNonEmptyString(rawNode?.label)
    || fallbackName;
  const attributeSeed = rawNode?.attribute
    || (() => {
      const lastSegment = getLastAqlSegment(rawNode?.aqlPath);
      return lastSegment && lastSegment !== 'value' ? lastSegment : name;
    })();
  const projected = {
    nodeId: allocateNodeId(
      {
        nodeId: asNonEmptyString(rawNode?.id) || asNonEmptyString(rawNode?.aqlPath) || asNonEmptyString(rawNode?.nodeId)
      },
      lineage,
      usedIds
    ),
    role,
    name,
    attribute: toAttribute(attributeSeed, `field${lineage[lineage.length - 1] || 1}`),
    dataType,
    occurrences: normalizeOccurrences({
      min: rawNode?.min,
      max: rawNode?.max
    })
  };

  const description = asNonEmptyString(rawNode?.description)
    || asNonEmptyString(rawNode?.localizedDescriptions?.en)
    || '';
  if (description) projected.description = description;
  if (rawNode?.nodeId !== undefined) projected.sourceNodeId = rawNode.nodeId;
  if (rawNode?.id !== undefined) projected.sourceId = rawNode.id;

  copyOptionalFields(
    {
      ...rawNode,
      localizedName: rawNode?.localizedName || undefined,
      localizedDescriptions: rawNode?.localizedDescriptions || undefined
    },
    projected
  );

  const children = childRawNodes.map((childNode, index) => (
    projectOpenEhrNode(childNode, [...lineage, index + 1], usedIds, projected.nodeId)
  ));

  if (children.length > 0) {
    projected.children = children;
  }

  return projected;
}

function normalizeFhirPathSegment(segment) {
  return `${segment || ''}`.replace(/:.*$/, '').replace(/\[x\]$/, '').trim();
}

function toFhirNodeId(path) {
  const cleaned = `${path || ''}`.replace(/[^A-Za-z0-9_.-]/g, '-').replace(/\.+/g, '.').trim();
  return cleaned || `fhir-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFhirOccurrences(element) {
  return normalizeOccurrences({
    min: element?.min,
    max: element?.max
  });
}

function resolveFhirLeafDataType(element) {
  const firstType = Array.isArray(element?.type) && element.type.length > 0
    ? asNonEmptyString(element.type[0]?.code)
    : '';
  return FHIR_FIELD_DATA_TYPES[firstType] || 'string';
}

function ensureFhirChild(parent, childKey, childName, nodeMap) {
  if (parent.children?.some((child) => child.attribute === childKey)) {
    return parent.children.find((child) => child.attribute === childKey) || null;
  }

  const node = {
    nodeId: toFhirNodeId(`${parent.nodeId}.${childKey}`),
    role: 'group',
    name: childName,
    attribute: toAttribute(childKey, childKey || 'field'),
    dataType: 'object',
    occurrences: { min: 0, max: 1 }
  };

  if (!Array.isArray(parent.children)) parent.children = [];
  parent.children.push(node);
  nodeMap.set(node.nodeId, node);
  return node;
}

function projectFhirStructureDefinition(resource = {}) {
  const elements = Array.isArray(resource?.snapshot?.element)
    ? resource.snapshot.element
    : (Array.isArray(resource?.differential?.element) ? resource.differential.element : []);
  const rootName = asNonEmptyString(resource?.title)
    || asNonEmptyString(resource?.name)
    || asNonEmptyString(resource?.type)
    || 'FHIR StructureDefinition';
  const rootType = asNonEmptyString(resource?.type) || 'Resource';
  const root = {
    nodeId: toFhirNodeId(asNonEmptyString(resource?.url) || rootType),
    role: 'section',
    name: rootName,
    attribute: 'root',
    dataType: 'object',
    occurrences: { min: 1, max: 1 }
  };

  if (asNonEmptyString(resource?.description)) {
    root.description = resource.description.trim();
  }

  if (elements.length === 0) {
    return root;
  }

  const rootPath = asNonEmptyString(elements[0]?.path) || rootType;
  const nodeBySyntheticPath = new Map([[rootPath, root]]);

  elements.slice(1).forEach((element) => {
    const rawPath = asNonEmptyString(element?.path);
    if (!rawPath.startsWith(`${rootPath}.`)) return;

    const pathParts = rawPath.split('.');
    let parentSyntheticPath = rootPath;
    let parentNode = root;

    for (let index = 1; index < pathParts.length; index += 1) {
      const segment = normalizeFhirPathSegment(pathParts[index]);
      if (!segment) continue;

      const syntheticPath = `${parentSyntheticPath}.${segment}`;
      let currentNode = nodeBySyntheticPath.get(syntheticPath);
      const isLeaf = index === pathParts.length - 1;

      if (!currentNode) {
        currentNode = ensureFhirChild(parentNode, segment, segment, nodeBySyntheticPath);
        nodeBySyntheticPath.set(syntheticPath, currentNode);
      }

      if (isLeaf) {
        currentNode.role = 'field';
        currentNode.dataType = resolveFhirLeafDataType(element);
        currentNode.occurrences = normalizeFhirOccurrences(element);
        currentNode.name = asNonEmptyString(element?.short)
          || asNonEmptyString(element?.label)
          || segment;
        if (asNonEmptyString(element?.definition)) {
          currentNode.description = element.definition.trim();
        }
        currentNode.sourceNodePath = rawPath;
        currentNode.sourceId = asNonEmptyString(element?.id) || syntheticPath;
        currentNode.fhirTypes = Array.isArray(element?.type)
          ? element.type.map((item) => asNonEmptyString(item?.code)).filter(Boolean)
          : [];
        currentNode.fhirType = currentNode.fhirTypes[0] || undefined;
        if (isObjectRecord(element?.binding)) {
          currentNode.binding = cloneStructured(element.binding);
        }
      }

      parentSyntheticPath = syntheticPath;
      parentNode = currentNode;
    }
  });

  return root;
}

function buildPreservedDefinition({
  root,
  name,
  rmEntity,
  archetypeId,
  sourceModel
}) {
  const definition = {
    definitionType: HIERARCHICAL_DEFINITION_FORMAT,
    canonicalSource: DEFINITION_CANONICAL_SOURCES.NATIVE,
    root
  };

  if (asNonEmptyString(name)) {
    definition.name = name.trim();
  }
  if (asNonEmptyString(rmEntity)) {
    definition.rmEntity = rmEntity.trim();
  }
  if (asNonEmptyString(archetypeId)) {
    definition.archetypeId = archetypeId.trim();
  }
  if (isObjectRecord(sourceModel)) {
    definition.sourceModel = sourceModel;
  }

  return definition;
}

export function createPreservedOpenEHRDefinition(template, options = {}) {
  const nativeTemplate = cloneStructured(template);
  const nativeTree = isObjectRecord(nativeTemplate?.tree) ? nativeTemplate.tree : nativeTemplate;
  const projectedRoot = projectOpenEhrNode(nativeTree || {}, [1], new Set(), null);
  const templateId = asNonEmptyString(options?.templateId)
    || asNonEmptyString(nativeTemplate?.templateId)
    || asNonEmptyString(nativeTree?.templateId)
    || asNonEmptyString(nativeTree?.nodeId)
    || asNonEmptyString(options?.name)
    || 'openEHR Template';
  const rmType = asNonEmptyString(options?.rmType)
    || asNonEmptyString(nativeTemplate?.rmType)
    || asNonEmptyString(nativeTree?.rmType)
    || 'COMPOSITION';

  return buildPreservedDefinition({
    root: projectedRoot,
    name: asNonEmptyString(options?.name) || templateId,
    rmEntity: rmType,
    archetypeId: asNonEmptyString(options?.archetypeId) || asNonEmptyString(nativeTree?.nodeId) || templateId,
    sourceModel: {
      family: 'openEHR',
      sourceFormat: 'openEHR-WEB-TEMPLATE',
      artifactType: 'template',
      templateId,
      rmType,
      nativeDefinition: nativeTemplate
    }
  });
}

export function createPreservedFHIRDefinition(resource, options = {}) {
  const nativeResource = cloneStructured(resource);
  const projectedRoot = projectFhirStructureDefinition(nativeResource || {});
  const resourceType = asNonEmptyString(nativeResource?.resourceType) || 'StructureDefinition';
  const rmEntity = asNonEmptyString(options?.rmType)
    || asNonEmptyString(nativeResource?.type)
    || resourceType;

  return buildPreservedDefinition({
    root: projectedRoot,
    name: asNonEmptyString(options?.name)
      || asNonEmptyString(nativeResource?.title)
      || asNonEmptyString(nativeResource?.name)
      || rmEntity,
    rmEntity,
    archetypeId: asNonEmptyString(options?.archetypeId)
      || asNonEmptyString(nativeResource?.url)
      || asNonEmptyString(nativeResource?.type)
      || resourceType,
    sourceModel: {
      family: 'FHIR',
      sourceFormat: 'FHIR-RESOURCE-DEFINITION',
      artifactType: resourceType,
      resourceType,
      canonicalUrl: asNonEmptyString(nativeResource?.url) || null,
      nativeDefinition: nativeResource
    }
  });
}

export function isHierarchicalDefinition(definition) {
  return !!resolveRoot(definition);
}

export function shouldTreatDefinitionAsHierarchical(definition, definitionFormat) {
  if (typeof definitionFormat === 'string' && definitionFormat.trim().toUpperCase() === HIERARCHICAL_DEFINITION_FORMAT) {
    return true;
  }
  return isHierarchicalDefinition(definition);
}

export function flattenHierarchicalDefinition(definition) {
  const root = resolveRoot(definition);
  if (!root) return [];
  const nodes = buildNode(root, null, [1], new Set());
  return syncChildrenNodeIds(nodes);
}

function nodeToHierarchicalTree(node, nodeMap) {
  const next = {
    nodeId: node.nodeId,
    role: node.role,
    name: node.name,
    attribute: node.attribute,
    dataType: node.dataType,
    occurrences: node.occurrences
  };

  copyOptionalFields(node, next);

  const children = (Array.isArray(node.childrenNodeIds) ? node.childrenNodeIds : [])
    .map((id) => nodeMap.get(id))
    .filter(Boolean)
    .map((child) => nodeToHierarchicalTree(child, nodeMap));

  if (children.length > 0) next.children = children;
  return next;
}

export function nodesToHierarchicalDefinition(nodes, options = {}) {
  const preparedNodes = syncChildrenNodeIds(Array.isArray(nodes) ? nodes : []);
  const rootNode = preparedNodes.find((node) => node.parentNodeId === null);

  const definition = {
    definitionType: HIERARCHICAL_DEFINITION_FORMAT
  };

  if (typeof options.archetypeId === 'string' && options.archetypeId.trim()) {
    definition.archetypeId = options.archetypeId.trim();
  }
  if (typeof options.rmEntity === 'string' && options.rmEntity.trim()) {
    definition.rmEntity = options.rmEntity.trim();
  }
  if (typeof options.name === 'string' && options.name.trim()) {
    definition.name = options.name.trim();
  }

  if (!rootNode) {
    definition.root = null;
    return definition;
  }

  const nodeMap = new Map(preparedNodes.map((node) => [node.nodeId, node]));
  definition.root = nodeToHierarchicalTree(rootNode, nodeMap);
  return definition;
}

export function mergeHierarchicalDefinitionWithNodes(existingDefinition, nodes, options = {}) {
  const projected = nodesToHierarchicalDefinition(nodes, options);
  if (!isObjectRecord(existingDefinition)) {
    return projected;
  }
  return {
    ...existingDefinition,
    ...projected
  };
}
