const HEADER_ARRAY_ALLOWED_ATTRIBUTES = new Set(['sourceSystems', 'links']);
const GENERIC_WRAPPER_NAMES = new Set(['observation', 'observations']);
const GENERIC_LEAF_NAMES = new Set(['value', 'unit', 'type']);
const SEMANTIC_ID_HINTS = ['id', 'lineId', 'eventId', 'itemId', 'variantId', 'administrationId', 'claimLineId', 'entryId'];
const TEMPORAL_HINTS = ['recordedAt', 'asOf', 'updatedAt', 'period', 'eventTime', 'time'];
const VALUE_SET_REFERENCE_PATTERN = /^https?:\/\//i;
const BINDING_STRENGTHS = new Set(['required', 'extensible', 'preferred', 'example']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function looksLikeValueSetRef(value) {
  if (!isNonEmptyString(value)) return false;
  return VALUE_SET_REFERENCE_PATTERN.test(value) || /^urn:/i.test(value) || /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+/.test(value);
}

function isCodeLikeDataType(dataType) {
  return ['code', 'coded_text'].includes(`${dataType || ''}`.toLowerCase());
}

function normalizeTerminologyKey(binding) {
  if (!binding || typeof binding !== 'object') return null;
  if (!isNonEmptyString(binding.system) || !isNonEmptyString(binding.code)) return null;
  return `${binding.system.trim().toLowerCase()}::${binding.code.trim().toLowerCase()}`;
}

function cloneNodes(nodes = []) {
  return Array.isArray(nodes) ? nodes.map((node) => ({ ...node })) : [];
}

function indexNodes(nodes = []) {
  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  const childrenMap = new Map(nodes.map((node) => [node.nodeId, []]));
  nodes.forEach((node) => {
    if (node.parentNodeId && childrenMap.has(node.parentNodeId)) {
      childrenMap.get(node.parentNodeId).push(node.nodeId);
    }
  });
  return { nodeById, childrenMap };
}

function getRoot(nodes = []) {
  return nodes.find((node) => node.parentNodeId === null) || null;
}

function isHeaderNode(node) {
  if (!node) return false;
  if (`${node.blockKind || ''}`.toLowerCase() === 'project_header') return true;
  if (`${node.role || ''}`.toLowerCase() !== 'block') return false;
  const hint = `${node.blockId || ''} ${node.attribute || ''} ${node.name || ''}`.toLowerCase();
  return /contextheader|context_header|projectheader|project_header/.test(hint);
}

function buildPathById(nodes = []) {
  const { nodeById } = indexNodes(nodes);
  const cache = new Map();

  const buildForNode = (node) => {
    if (!node) return '/';
    if (cache.has(node.nodeId)) return cache.get(node.nodeId);
    if (!node.parentNodeId) {
      cache.set(node.nodeId, '/root');
      return '/root';
    }
    const parent = nodeById.get(node.parentNodeId);
    const parentPath = buildForNode(parent);
    const path = `${parentPath}/${node.attribute || node.name || 'node'}`;
    cache.set(node.nodeId, path);
    return path;
  };

  nodes.forEach((node) => buildForNode(node));
  return cache;
}

function inferInputsForNode(node) {
  const type = `${node?.dataType || ''}`.toLowerCase();
  if (isCodeLikeDataType(type)) return [{ terminology: 'local', list: [] }];
  if (type === 'quantity') return [{ suffix: 'magnitude', type: 'DECIMAL' }, { suffix: 'units', type: 'TEXT' }];
  if (type === 'integer') return [{ type: 'INTEGER' }];
  if (type === 'number') return [{ type: 'DECIMAL' }];
  if (type === 'boolean') return [{ type: 'BOOLEAN' }];
  if (type === 'date') return [{ type: 'DATE' }];
  if (type === 'datetime') return [{ type: 'DATETIME' }];
  return [{ type: 'TEXT' }];
}

function inferSemanticIdAttribute(node) {
  const attr = `${node?.attribute || ''}`.toLowerCase();
  if (attr.includes('line')) return 'lineId';
  if (attr.includes('event')) return 'eventId';
  if (attr.includes('variant')) return 'variantId';
  if (attr.includes('administration')) return 'administrationId';
  if (attr.includes('item')) return 'itemId';
  return 'id';
}

function anchorFieldName(primary = 'patient') {
  const map = {
    patient: 'patientId',
    participant: 'participantId',
    member: 'memberId',
    specimen: 'specimenId'
  };
  return map[primary] || 'patientId';
}

function anchorLabel(primary = 'patient') {
  const map = {
    patient: 'Patient ID',
    participant: 'Participant ID',
    member: 'Member ID',
    specimen: 'Specimen ID'
  };
  return map[primary] || 'Patient ID';
}

function hasLifecycle(nodes = [], headerNode = null, root = null) {
  const lifecycleAttrs = new Set(['status', 'recordedAt', 'asOf', 'updatedAt']);
  const scopeParents = new Set([headerNode?.nodeId, root?.nodeId].filter(Boolean));
  return nodes.some((node) => scopeParents.has(node.parentNodeId) && lifecycleAttrs.has(`${node.attribute || ''}`));
}

function collectDescendants(childrenMap, nodeId) {
  const ids = [];
  const walk = (id) => {
    const children = childrenMap.get(id) || [];
    children.forEach((childId) => {
      ids.push(childId);
      walk(childId);
    });
  };
  walk(nodeId);
  return ids;
}

function generateNodeId() {
  return `n-lint-${Math.random().toString(36).slice(2, 10)}`;
}

export function applyLintFix(nodes = [], issue = {}, context = {}) {
  const working = cloneNodes(nodes);
  const root = getRoot(working);
  const { childrenMap } = indexNodes(working);

  if (!root) return working;

  const headerNodes = working.filter((node) => node.parentNodeId === root.nodeId && isHeaderNode(node));
  const headerNode = headerNodes[0] || null;

  switch (issue?.fix?.id) {
    case 'header.insert_default': {
      if (headerNodes.length > 0) return working;
      working.push({
        nodeId: generateNodeId(),
        parentNodeId: root.nodeId,
        childrenNodeIds: [],
        role: 'block',
        blockKind: 'project_header',
        headerState: 'inherited',
        headerProfileId: context?.projectSettings?.defaultHeaderProfileId || 'header.patient.v1',
        name: 'Context Header',
        attribute: 'contextHeader',
        dataType: 'object',
        occurrences: { min: 1, max: 1 },
        blockId: 'ContextHeader',
        versionRange: '^1.0.0'
      });
      return syncChildren(working);
    }
    case 'header.collapse_duplicates': {
      if (headerNodes.length <= 1) return working;
      const keep = headerNodes[0];
      const removeIds = new Set(headerNodes.slice(1).map((node) => node.nodeId));
      working.forEach((node) => {
        if (removeIds.has(node.parentNodeId)) node.parentNodeId = keep.nodeId;
      });
      return syncChildren(working.filter((node) => !removeIds.has(node.nodeId)));
    }
    case 'header.remove_arrays': {
      const localHeader = headerNode || null;
      if (!localHeader) return working;
      const localChildrenMap = indexNodes(working).childrenMap;
      const queue = [localHeader.nodeId];
      while (queue.length > 0) {
        const id = queue.shift();
        const childIds = localChildrenMap.get(id) || [];
        childIds.forEach((childId) => {
          const child = working.find((node) => node.nodeId === childId);
          if (!child) return;
          const attr = `${child.attribute || ''}`;
          if (!HEADER_ARRAY_ALLOWED_ATTRIBUTES.has(attr)) {
            child.occurrences = { ...(child.occurrences || { min: 0, max: 1 }), max: 1 };
            if (child.role === 'event_series') {
              child.role = 'group';
              child.dataType = 'object';
            }
            if (child.dataType === 'array') child.dataType = 'object';
          }
          queue.push(childId);
        });
      }
      return syncChildren(working);
    }
    case 'header.add_primary_anchor': {
      const localHeader = headerNode;
      if (!localHeader) return working;
      const primary = `${localHeader?.centricity?.primary || context?.primaryAnchor || 'patient'}`;
      const attribute = anchorFieldName(primary);
      const exists = working.some((node) => node.parentNodeId === localHeader.nodeId && `${node.attribute || ''}` === attribute);
      if (exists) return working;
      working.push({
        nodeId: generateNodeId(),
        parentNodeId: localHeader.nodeId,
        childrenNodeIds: [],
        role: 'field',
        name: anchorLabel(primary),
        attribute,
        dataType: 'string',
        occurrences: { min: 1, max: 1 },
        inputs: [{ type: 'TEXT' }]
      });
      return syncChildren(working);
    }
    case 'header.remove_redundant_context_section': {
      const targetId = issue?.meta?.targetNodeId;
      if (!targetId) return working;
      const tree = indexNodes(working);
      const removeIds = new Set([targetId, ...collectDescendants(tree.childrenMap, targetId)]);
      return syncChildren(working.filter((node) => !removeIds.has(node.nodeId)));
    }
    case 'events.insert_default_event': {
      const parentId = issue?.meta?.targetNodeId;
      if (!parentId) return working;
      const exists = working.some((node) => node.parentNodeId === parentId && node.role === 'event');
      if (exists) return working;
      const eventId = generateNodeId();
      working.push({
        nodeId: eventId,
        parentNodeId: parentId,
        childrenNodeIds: [],
        role: 'event',
        name: 'Event',
        attribute: 'event',
        dataType: 'object',
        occurrences: { min: 1, max: 1 }
      });
      working.push({
        nodeId: generateNodeId(),
        parentNodeId: eventId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Event Time',
        attribute: 'eventTime',
        dataType: 'datetime',
        occurrences: { min: 1, max: 1 },
        timeRole: 'timestamp',
        inputs: [{ type: 'DATETIME' }]
      });
      return syncChildren(working);
    }
    case 'events.flatten_snapshot': {
      working.forEach((node) => {
        if (node.role === 'event_series') {
          node.role = 'group';
          node.dataType = 'object';
          node.occurrences = { ...(node.occurrences || { min: 0, max: 1 }), max: 1 };
        }
      });
      return syncChildren(working);
    }
    case 'structure.limit_unbounded': {
      const targetId = issue?.meta?.targetNodeId;
      const node = working.find((item) => item.nodeId === targetId);
      if (!node) return working;
      node.occurrences = { ...(node.occurrences || { min: 0, max: 1 }), max: 1 };
      return syncChildren(working);
    }
    case 'semantics.refactor_generic_observation': {
      working.forEach((node) => {
        const attr = `${node.attribute || ''}`.toLowerCase();
        if (GENERIC_WRAPPER_NAMES.has(attr)) {
          node.name = 'Clinical Findings';
          node.attribute = 'clinicalFindings';
        } else if (attr === 'value') {
          node.name = 'Measured Value';
          node.attribute = 'measuredValue';
        } else if (attr === 'unit') {
          node.name = 'Measurement Unit';
          node.attribute = 'measurementUnit';
        } else if (attr === 'type') {
          node.name = 'Finding Type';
          node.attribute = 'findingType';
        }
      });
      return syncChildren(working);
    }
    case 'metadata.add_lifecycle_fields': {
      const parent = headerNode || root;
      const defaults = [
        { attribute: 'status', name: 'Status', dataType: 'code', inputs: [{ terminology: 'local', list: [] }] },
        { attribute: 'recordedAt', name: 'Recorded At', dataType: 'datetime', inputs: [{ type: 'DATETIME' }] },
        { attribute: 'asOf', name: 'As Of', dataType: 'datetime', inputs: [{ type: 'DATETIME' }] },
        { attribute: 'updatedAt', name: 'Updated At', dataType: 'datetime', inputs: [{ type: 'DATETIME' }] }
      ];
      defaults.forEach((field) => {
        const exists = working.some((node) => node.parentNodeId === parent.nodeId && `${node.attribute || ''}` === field.attribute);
        if (!exists) {
          working.push({
            nodeId: generateNodeId(),
            parentNodeId: parent.nodeId,
            childrenNodeIds: [],
            role: 'field',
            name: field.name,
            attribute: field.attribute,
            dataType: field.dataType,
            occurrences: { min: 0, max: 1 },
            inputs: field.inputs
          });
        }
      });
      return syncChildren(working);
    }
    case 'webtemplate.add_leaf_inputs': {
      const targetId = issue?.meta?.targetNodeId;
      const node = working.find((item) => item.nodeId === targetId);
      if (!node) return working;
      node.inputs = inferInputsForNode(node);
      return syncChildren(working);
    }
    case 'webtemplate.add_leaf_inputs_bulk': {
      const targetIds = Array.isArray(issue?.meta?.targetNodeIds)
        ? new Set(issue.meta.targetNodeIds)
        : null;
      working.forEach((node) => {
        if (!targetIds || targetIds.has(node.nodeId)) {
          const hasInputs = Array.isArray(node.inputs) && node.inputs.length > 0;
          if (!hasInputs) {
            node.inputs = inferInputsForNode(node);
          }
        }
      });
      return syncChildren(working);
    }
    case 'webtemplate.regenerate_aql_paths': {
      const pathCache = buildPathById(working);
      working.forEach((node) => {
        const path = pathCache.get(node.nodeId) || '/root';
        node.aqlPath = path.replace('/root', '');
      });
      return syncChildren(working);
    }
    case 'arrays.add_semantic_id': {
      const targetId = issue?.meta?.targetNodeId;
      const parent = working.find((item) => item.nodeId === targetId);
      if (!parent) return working;
      const idAttr = inferSemanticIdAttribute(parent);
      const exists = working.some((item) => item.parentNodeId === parent.nodeId && `${item.attribute || ''}` === idAttr);
      if (exists) return working;
      working.push({
        nodeId: generateNodeId(),
        parentNodeId: parent.nodeId,
        childrenNodeIds: [],
        role: 'field',
        name: idAttr,
        attribute: idAttr,
        dataType: 'string',
        occurrences: { min: 1, max: 1 },
        inputs: [{ type: 'TEXT' }]
      });
      return syncChildren(working);
    }
    case 'arrays.add_temporal_marker': {
      const targetId = issue?.meta?.targetNodeId;
      const parent = working.find((item) => item.nodeId === targetId);
      if (!parent) return working;
      const existing = working.some((item) => item.parentNodeId === parent.nodeId && TEMPORAL_HINTS.includes(`${item.attribute || ''}`));
      if (existing) return working;
      working.push({
        nodeId: generateNodeId(),
        parentNodeId: parent.nodeId,
        childrenNodeIds: [],
        role: 'field',
        name: 'recordedAt',
        attribute: 'recordedAt',
        dataType: 'datetime',
        occurrences: { min: 0, max: 1 },
        inputs: [{ type: 'DATETIME' }]
      });
      return syncChildren(working);
    }
    default:
      return syncChildren(working);
  }
}

function syncChildren(nodes = []) {
  const childrenMap = new Map(nodes.map((node) => [node.nodeId, []]));
  nodes.forEach((node) => {
    if (node.parentNodeId && childrenMap.has(node.parentNodeId)) {
      childrenMap.get(node.parentNodeId).push(node.nodeId);
    }
  });
  return nodes.map((node) => ({
    ...node,
    childrenNodeIds: childrenMap.get(node.nodeId) || []
  }));
}

function createIssue({ id, severity, category, message, nodePath, suggestion, fix, meta }) {
  return { id, severity, category, message, nodePath, suggestion, fix, meta };
}

function shouldRequireHeader(context = {}) {
  const kind = `${context?.kind || ''}`.toLowerCase();
  const scope = `${context?.scope || ''}`.toLowerCase();
  if (kind === 'block' || scope === 'building_block') return false;
  if (context?.requireHeader === false) return false;
  return true;
}

export function lintContextObjectSchema({ nodes = [], context = {} }) {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  const issues = [];
  const root = getRoot(nodes);
  if (!root) return issues;

  const { nodeById, childrenMap } = indexNodes(nodes);
  const pathCache = buildPathById(nodes);
  const rootChildren = nodes.filter((node) => node.parentNodeId === root.nodeId);
  const headerNodes = rootChildren.filter((node) => isHeaderNode(node));
  const headerNode = headerNodes[0] || null;
  const primaryAnchor = `${headerNode?.centricity?.primary || context?.primaryAnchor || 'patient'}`;

  if (shouldRequireHeader(context) && headerNodes.length === 0) {
    issues.push(createIssue({
      id: 'header.missing',
      severity: 'error',
      category: 'Header',
      message: 'ContextHeader is required and missing.',
      suggestion: 'Insert the project ContextHeader block at root.',
      fix: { id: 'header.insert_default', label: 'Insert default header' }
    }));
  }

  if (headerNodes.length > 1) {
    issues.push(createIssue({
      id: 'header.duplicate',
      severity: 'error',
      category: 'Header',
      message: `Multiple ContextHeader blocks found (${headerNodes.length}).`,
      suggestion: 'Collapse duplicate headers into one inherited project header.',
      fix: { id: 'header.collapse_duplicates', label: 'Collapse duplicate headers' }
    }));
  }

  if (headerNode) {
    const queue = [headerNode.nodeId];
    let foundHeaderArray = null;
    while (queue.length > 0 && !foundHeaderArray) {
      const id = queue.shift();
      const childIds = childrenMap.get(id) || [];
      childIds.forEach((childId) => {
        const child = nodeById.get(childId);
        if (!child) return;
        const attr = `${child.attribute || ''}`;
        if (!HEADER_ARRAY_ALLOWED_ATTRIBUTES.has(attr)) {
          const max = child?.occurrences?.max;
          if (max === '*' || max === -1 || (typeof max === 'number' && max > 1) || child.role === 'event_series') {
            foundHeaderArray = child;
            return;
          }
        }
        queue.push(childId);
      });
    }

    if (foundHeaderArray) {
      issues.push(createIssue({
        id: `header.array.${foundHeaderArray.nodeId}`,
        severity: 'error',
        category: 'Header',
        message: 'Header contains repeating or array-like nodes; header must remain compact.',
        nodePath: pathCache.get(foundHeaderArray.nodeId),
        suggestion: 'Convert repeating header nodes to 0..1 objects/fields.',
        fix: { id: 'header.remove_arrays', label: 'Convert header arrays to single objects' },
        meta: { targetNodeId: foundHeaderArray.nodeId }
      }));
    }

    const anchorAttr = anchorFieldName(primaryAnchor);
    const hasAnchor = nodes.some((node) => node.parentNodeId === headerNode.nodeId && `${node.attribute || ''}` === anchorAttr);
    if (!hasAnchor) {
      issues.push(createIssue({
        id: 'header.anchor.missing',
        severity: 'error',
        category: 'Header',
        message: `Primary anchor is missing (${anchorAttr}).`,
        nodePath: pathCache.get(headerNode.nodeId),
        suggestion: 'Add required anchor id field matching header centricity.',
        fix: { id: 'header.add_primary_anchor', label: `Add ${anchorAttr}` }
      }));
    }
  }

  const redundantRootSections = rootChildren.filter((node) => {
    const attr = `${node.attribute || ''}`.toLowerCase();
    return ['subjectcontext', 'performercontext', 'carecontext'].includes(attr);
  });

  if (headerNode && redundantRootSections.length > 0) {
    redundantRootSections.forEach((node) => {
      issues.push(createIssue({
        id: `header.redundant.${node.nodeId}`,
        severity: 'warn',
        category: 'Header',
        message: `Redundant ${node.name || node.attribute} section exists outside header.`,
        nodePath: pathCache.get(node.nodeId),
        suggestion: 'Keep header as single source for subject/performer/context.',
        fix: { id: 'header.remove_redundant_context_section', label: 'Remove redundant section' },
        meta: { targetNodeId: node.nodeId }
      }));
    });
  }

  const missingLeafInputs = [];

  nodes.forEach((node) => {
    const terminologyBindings = Array.isArray(node.terminologyBindings) ? node.terminologyBindings : [];
    const nodeDataType = `${node?.dataType || ''}`.toLowerCase();
    const seenTerminologyBindings = new Set();
    const hasQualifiedTerminologyBinding = terminologyBindings.some((binding) => normalizeTerminologyKey(binding));

    if (isCodeLikeDataType(nodeDataType) && !hasQualifiedTerminologyBinding) {
      issues.push(createIssue({
        id: `terminology.code_binding.missing.${node.nodeId}`,
        severity: context?.strictTerminology ? 'error' : 'warn',
        category: 'Terminology',
        message: 'Coded node is missing a valid terminology binding (system + code).',
        nodePath: pathCache.get(node.nodeId),
        suggestion: 'Attach at least one terminology binding with system and code.'
      }));
    }

    terminologyBindings.forEach((binding, index) => {
      if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
        issues.push(createIssue({
          id: `terminology.binding.invalid.${node.nodeId}.${index}`,
          severity: 'warn',
          category: 'Terminology',
          message: 'Terminology binding entry must be an object.',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Replace this entry with an object including at least system and code.'
        }));
        return;
      }

      const hasSystem = isNonEmptyString(binding.system);
      const hasCode = isNonEmptyString(binding.code);
      if (!hasSystem || !hasCode) {
        issues.push(createIssue({
          id: `terminology.binding.incomplete.${node.nodeId}.${index}`,
          severity: context?.strictTerminology ? 'error' : 'warn',
          category: 'Terminology',
          message: 'Terminology binding must include non-empty system and code.',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Provide a concrete code system URI/name and a concept code.'
        }));
      }

      if (binding.bindingStrength !== undefined && !BINDING_STRENGTHS.has(`${binding.bindingStrength || ''}`.toLowerCase())) {
        issues.push(createIssue({
          id: `terminology.binding_strength.invalid.${node.nodeId}.${index}`,
          severity: 'warn',
          category: 'Terminology',
          message: 'bindingStrength should be one of: required, extensible, preferred, example.',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Normalize bindingStrength to the allowed vocabulary.'
        }));
      }

      if (binding.valueSet !== undefined && !looksLikeValueSetRef(`${binding.valueSet || ''}`.trim())) {
        issues.push(createIssue({
          id: `terminology.valueset.invalid.${node.nodeId}.${index}`,
          severity: context?.strictTerminology ? 'error' : 'warn',
          category: 'Terminology',
          message: 'Value set reference is malformed.',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Use an HTTP(S) URL, URN, or qualified identifier (e.g. loinc:lipid-panel).'
        }));
      }

      const key = normalizeTerminologyKey(binding);
      if (!key) return;
      if (seenTerminologyBindings.has(key)) {
        issues.push(createIssue({
          id: `terminology.binding.duplicate.${node.nodeId}.${index}`,
          severity: 'warn',
          category: 'Terminology',
          message: 'Duplicate terminology binding found for the same system/code.',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Keep a single canonical binding per system/code pair.'
        }));
        return;
      }
      seenTerminologyBindings.add(key);
    });

    if (isNonEmptyString(node.referencedObjectId)) {
      if (node.referencedObjectId === node.nodeId) {
        issues.push(createIssue({
          id: `relationship.self_reference.${node.nodeId}`,
          severity: 'error',
          category: 'Relationships',
          message: 'Node relationship cannot reference itself.',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Select a different relationship target.'
        }));
      } else if (!nodeById.has(node.referencedObjectId)) {
        issues.push(createIssue({
          id: `relationship.target_missing.${node.nodeId}`,
          severity: 'error',
          category: 'Relationships',
          message: 'Relationship target does not exist in this model.',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Re-link this node to a valid target.'
        }));
      }
    }

    if (node.role === 'event_series') {
      const hasEvent = (childrenMap.get(node.nodeId) || [])
        .map((childId) => nodeById.get(childId))
        .some((child) => child?.role === 'event');
      if (!hasEvent) {
        issues.push(createIssue({
          id: `events.missing_event.${node.nodeId}`,
          severity: 'error',
          category: 'Structure',
          message: 'event_series node has no event child.',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Insert a default event with timestamp child.',
          fix: { id: 'events.insert_default_event', label: 'Insert event child' },
          meta: { targetNodeId: node.nodeId }
        }));
      }
    }

    const max = node?.occurrences?.max;
    const isUnbounded = max === '*' || max === -1 || (typeof max === 'number' && max > 1);
    if (isUnbounded && node.role !== 'event_series' && node.parentNodeId) {
      const parent = nodeById.get(node.parentNodeId);
      const parentIsEventContainer = parent?.role === 'event_series' || parent?.role === 'event';
      if (!parentIsEventContainer) {
        issues.push(createIssue({
          id: `structure.unbounded.${node.nodeId}`,
          severity: 'warn',
          category: 'Structure',
          message: 'Unbounded cardinality detected outside event/item contexts.',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Restrict max cardinality to 1 or move under event_series.',
          fix: { id: 'structure.limit_unbounded', label: 'Set max to 1' },
          meta: { targetNodeId: node.nodeId }
        }));
      }
    }

    if (isUnbounded && node.parentNodeId) {
      const childAttrs = new Set(
        (childrenMap.get(node.nodeId) || [])
          .map((childId) => `${nodeById.get(childId)?.attribute || ''}`)
      );
      const hasSemanticId = Array.from(childAttrs).some((attr) => SEMANTIC_ID_HINTS.includes(attr));
      if (!hasSemanticId) {
        issues.push(createIssue({
          id: `arrays.semantic_id.${node.nodeId}`,
          severity: 'warn',
          category: 'Semantics',
          message: 'Repeating array-like node should include a stable semantic item identifier.',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Use semantic ids such as lineId/eventId/itemId instead of relying on structural nodeId.',
          fix: { id: 'arrays.add_semantic_id', label: 'Add semantic id field' },
          meta: { targetNodeId: node.nodeId }
        }));
      }

      const requiresTemporalMarker = node.role === 'event_series' || /event|timeline|history|series/i.test(`${node.attribute || ''} ${node.name || ''}`);
      const hasTemporal = Array.from(childAttrs).some((attr) => TEMPORAL_HINTS.includes(attr));
      if (requiresTemporalMarker && !hasTemporal) {
        issues.push(createIssue({
          id: `arrays.temporal.${node.nodeId}`,
          severity: 'warn',
          category: 'Semantics',
          message: 'Temporal/repeating node should include a time marker (recordedAt/eventTime/period).',
          nodePath: pathCache.get(node.nodeId),
          suggestion: 'Add recordedAt or period to support ordering and lifecycle queries.',
          fix: { id: 'arrays.add_temporal_marker', label: 'Add recordedAt' },
          meta: { targetNodeId: node.nodeId }
        }));
      }
    }
  });

  if (context?.temporalMode === 'snapshot' && nodes.some((node) => node.role === 'event_series')) {
    issues.push(createIssue({
      id: 'events.snapshot_mismatch',
      severity: 'warn',
      category: 'Structure',
      message: 'Snapshot mode selected but event_series nodes are present.',
      suggestion: 'Flatten event_series into single snapshot objects.',
      fix: { id: 'events.flatten_snapshot', label: 'Flatten event_series to snapshot' }
    }));
  }

  const genericObservationNode = nodes.find((node) => {
    const attr = `${node.attribute || ''}`.toLowerCase();
    const name = `${node.name || ''}`.toLowerCase();
    return GENERIC_WRAPPER_NAMES.has(attr) || GENERIC_WRAPPER_NAMES.has(name);
  });

  if (genericObservationNode) {
    const childAttrs = new Set((childrenMap.get(genericObservationNode.nodeId) || [])
      .map((childId) => `${nodeById.get(childId)?.attribute || ''}`.toLowerCase()));
    const hasSmellLeaves = ['value', 'unit', 'type'].every((key) => childAttrs.has(key));
    if (hasSmellLeaves) {
      issues.push(createIssue({
        id: 'semantics.generic_observation_smell',
        severity: 'warn',
        category: 'Semantics',
        message: 'Generic observation/value/unit pattern detected; this is semantically weak for healthcare analytics.',
        nodePath: pathCache.get(genericObservationNode.nodeId),
        suggestion: 'Refactor into clinically named fields/groups (PROM/vitals/labs).',
        fix: { id: 'semantics.refactor_generic_observation', label: 'Apply guided clinical naming refactor' }
      }));
    }
  }

  if (!hasLifecycle(nodes, headerNode, root)) {
    issues.push(createIssue({
      id: 'semantics.lifecycle.missing',
      severity: 'warn',
      category: 'Semantics',
      message: 'Lifecycle metadata fields missing (status/recordedAt/asOf/updatedAt).',
      suggestion: 'Add lifecycle timestamps and status for governance/queryability.',
      fix: { id: 'metadata.add_lifecycle_fields', label: 'Add lifecycle metadata fields' }
    }));
  }

  nodes.forEach((node) => {
    const childIds = childrenMap.get(node.nodeId) || [];
    const isLeaf = childIds.length === 0;
    const isContainer = ['group', 'section', 'event', 'event_series', 'block'].includes(`${node.role || ''}`);
    if (isLeaf && !isContainer) {
      const hasInputs = Array.isArray(node.inputs) && node.inputs.length > 0;
      if (!hasInputs) missingLeafInputs.push(node);
    }
  });

  if (missingLeafInputs.length === 1) {
    const target = missingLeafInputs[0];
    issues.push(createIssue({
      id: `webtemplate.inputs.missing.${target.nodeId}`,
      severity: context?.strictWebtemplate ? 'error' : 'warn',
      category: 'Webtemplate export',
      message: 'Leaf node is missing inputs[] for webtemplate export compatibility.',
      nodePath: pathCache.get(target.nodeId),
      suggestion: 'Infer inputs[] from datatype.',
      fix: { id: 'webtemplate.add_leaf_inputs', label: 'Add inferred inputs[]' },
      meta: { targetNodeId: target.nodeId }
    }));
  } else if (missingLeafInputs.length > 1) {
    const firstTarget = missingLeafInputs[0];
    issues.push(createIssue({
      id: 'webtemplate.inputs.missing.bulk',
      severity: context?.strictWebtemplate ? 'error' : 'warn',
      category: 'Webtemplate export',
      message: `${missingLeafInputs.length} leaf nodes are missing inputs[] for webtemplate export compatibility.`,
      nodePath: pathCache.get(firstTarget.nodeId),
      suggestion: 'Infer inputs[] from datatype for all affected leaves.',
      fix: { id: 'webtemplate.add_leaf_inputs_bulk', label: 'Add inferred inputs[] to all' },
      meta: { targetNodeIds: missingLeafInputs.map((node) => node.nodeId) }
    }));
  }

  const generatedAqlPaths = new Map();
  let hasAqlConflict = false;
  nodes.forEach((node) => {
    const path = (pathCache.get(node.nodeId) || '/root').replace('/root', '');
    if (generatedAqlPaths.has(path)) {
      hasAqlConflict = true;
    }
    generatedAqlPaths.set(path, node.nodeId);
  });

  if (hasAqlConflict) {
    issues.push(createIssue({
      id: 'webtemplate.aql.duplicate',
      severity: 'warn',
      category: 'Webtemplate export',
      message: 'Duplicate deterministic aqlPath detected.',
      suggestion: 'Regenerate stable aqlPath values from canonical node path.',
      fix: { id: 'webtemplate.regenerate_aql_paths', label: 'Regenerate aqlPath values' }
    }));
  }

  return issues;
}

export function applyAllSafeFixes(nodes = [], issues = [], context = {}) {
  let current = cloneNodes(nodes);
  issues
    .filter((issue) => issue?.fix?.id)
    .forEach((issue) => {
      current = applyLintFix(current, issue, context);
    });
  return current;
}
