// Semantic Object Utilities - JavaScript version for API routes

// ============= ID Generation =============

export function generateNodeId() {
  return 'n-' + Math.random().toString(36).substr(2, 9);
}

export function generateSemanticObjectId() {
  return 'so-' + Math.random().toString(36).substr(2, 12);
}

// ============= Path Building =============

export function buildCanonicalPath(node, nodeMap) {
  if (!node.parentNodeId) {
    return `/root[${node.nodeId}]`;
  }

  const parent = nodeMap.get(node.parentNodeId);
  if (!parent) {
    throw new Error(`Parent node ${node.parentNodeId} not found`);
  }

  const parentPath = parent.canonicalPath || buildCanonicalPath(parent, nodeMap);
  return `${parentPath}/${node.attribute}[${node.nodeId}]`;
}

export function buildDataPath(node, nodeMap) {
  if (!node.parentNodeId) {
    return '/root';
  }

  const parent = nodeMap.get(node.parentNodeId);
  if (!parent) {
    throw new Error(`Parent node ${node.parentNodeId} not found`);
  }

  const parentPath = parent.dataPath || buildDataPath(parent, nodeMap);
  return `${parentPath}/${node.attribute}`;
}

export function rebuildAllPaths(obj) {
  const nodeMap = new Map(obj.nodes.map(n => [n.nodeId, n]));

  const updatedNodes = obj.nodes.map(node => ({
    ...node,
    canonicalPath: buildCanonicalPath(node, nodeMap),
    dataPath: buildDataPath(node, nodeMap)
  }));

  return { ...obj, nodes: updatedNodes };
}

// ============= Node Tree Operations =============

export function syncChildrenNodeIds(nodes) {
  const childrenMap = new Map();

  for (const node of nodes) {
    if (node.parentNodeId) {
      if (!childrenMap.has(node.parentNodeId)) {
        childrenMap.set(node.parentNodeId, []);
      }
      childrenMap.get(node.parentNodeId).push(node.nodeId);
    }
  }

  return nodes.map(node => ({
    ...node,
    childrenNodeIds: childrenMap.get(node.nodeId) || []
  }));
}

export function getChildNodes(parentNodeId, nodes) {
  const parent = nodes.find(n => n.nodeId === parentNodeId);
  if (!parent) return [];

  return parent.childrenNodeIds
    .map(childId => nodes.find(n => n.nodeId === childId))
    .filter(n => n !== undefined);
}

// ============= Validation =============

const VALID_SCOPES = ['building_block', 'business_object'];
const LEGACY_SCOPES = ['technical'];
const VALID_ORIGINS = ['custom', 'standard', 'vendor'];
const LEGACY_ORIGINS = ['openehr', 'fhir', 'other', 'imported'];
const VALID_STATUSES = ['draft', 'active', 'deprecated'];
const VALID_ROLES = ['field', 'group', 'section', 'event', 'event_series', 'block'];
const VALID_DATA_TYPES = [
  'string', 'number', 'integer', 'boolean', 'date', 'time', 'datetime', 'duration',
  'object', 'array', 'code', 'coded_text', 'quantity', 'reference', 'identifier', 'uri', 'interval'
];
const ROLE_DATA_TYPE_ALLOWED = {
  section: ['object'],
  group: ['object'],
  event: ['object'],
  event_series: ['array'],
  block: ['object'],
  field: VALID_DATA_TYPES.filter((type) => !['object', 'array'].includes(type))
};
const VALID_STRUCTURAL_MODELS = ['FHIR', 'openEHR', 'X12', 'HL7v2', 'Other'];
const VALID_RELATIONSHIP_TYPES = ['reference', 'derived_from', 'caused_by', 'same_as', 'part_of', 'associated_with'];
const VALID_RELATIONSHIP_CARDINALITIES = ['one_to_one', 'one_to_many', 'many_to_many'];
const OPERATIONAL_PROFILE_LIST_FIELDS = ['readPatterns', 'queryAxes', 'optimizedPaths', 'indexHints'];
const OPERATIONAL_PROFILE_STRING_FIELDS = ['writeMode', 'partitionKey', 'retentionPolicy', 'temporalAxis', 'consistencyModel'];
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function looksLikeValueSetRef(value) {
  if (!isNonEmptyString(value)) return false;
  return /^https?:\/\//i.test(value) || /^urn:/i.test(value) || /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+/.test(value);
}

function isDataTypeAllowedForRole(role = 'field', dataType = 'string') {
  const allowed = ROLE_DATA_TYPE_ALLOWED[role];
  if (!Array.isArray(allowed)) return VALID_DATA_TYPES.includes(dataType);
  return allowed.includes(dataType);
}

function validateTerminologyBindings(bindings, prefix) {
  const errors = [];
  if (bindings === undefined) return errors;
  if (!Array.isArray(bindings)) {
    errors.push(`${prefix}.terminologyBindings must be an array when provided`);
    return errors;
  }

  const seen = new Set();
  bindings.forEach((binding, index) => {
    const itemPrefix = `${prefix}.terminologyBindings[${index}]`;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
      errors.push(`${itemPrefix} must be an object`);
      return;
    }

    if (!isNonEmptyString(binding.system)) {
      errors.push(`${itemPrefix}.system is required and must be a non-empty string`);
    }

    if (!isNonEmptyString(binding.code)) {
      errors.push(`${itemPrefix}.code is required and must be a non-empty string`);
    }

    if (binding.display !== undefined && typeof binding.display !== 'string') {
      errors.push(`${itemPrefix}.display must be a string when provided`);
    }

    if (binding.valueSet !== undefined) {
      if (!isNonEmptyString(binding.valueSet)) {
        errors.push(`${itemPrefix}.valueSet must be a non-empty string when provided`);
      } else if (!looksLikeValueSetRef(binding.valueSet.trim())) {
        errors.push(`${itemPrefix}.valueSet must be a URL, URN, or qualified identifier`);
      }
    }

    if (isNonEmptyString(binding.system) && isNonEmptyString(binding.code)) {
      const key = `${binding.system.trim().toLowerCase()}::${binding.code.trim().toLowerCase()}`;
      if (seen.has(key)) {
        errors.push(`${itemPrefix} duplicates terminology binding ${binding.system}:${binding.code}`);
      }
      seen.add(key);
    }
  });

  return errors;
}

function validateStructuralBindings(bindings, prefix, nodeIds = null) {
  const errors = [];
  if (bindings === undefined) return errors;
  if (!Array.isArray(bindings)) {
    errors.push(`${prefix}.structuralBindings must be an array when provided`);
    return errors;
  }

  bindings.forEach((binding, index) => {
    const itemPrefix = `${prefix}.structuralBindings[${index}]`;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
      errors.push(`${itemPrefix} must be an object`);
      return;
    }

    if (!isNonEmptyString(binding.model) || !VALID_STRUCTURAL_MODELS.includes(binding.model)) {
      errors.push(`${itemPrefix}.model must be one of: ${VALID_STRUCTURAL_MODELS.join(', ')}`);
    }

    if (!isNonEmptyString(binding.path)) {
      errors.push(`${itemPrefix}.path is required and must be a non-empty string`);
    }

    if (binding.nodeId !== undefined) {
      if (!isNonEmptyString(binding.nodeId)) {
        errors.push(`${itemPrefix}.nodeId must be a non-empty string when provided`);
      } else if (nodeIds instanceof Set && !nodeIds.has(binding.nodeId.trim())) {
        errors.push(`${itemPrefix}.nodeId references non-existent node: ${binding.nodeId}`);
      }
    }
  });

  return errors;
}

function validateRelationships(relationships, nodeIds, prefix = 'object') {
  const errors = [];
  if (relationships === undefined) return errors;
  if (!Array.isArray(relationships)) {
    errors.push(`${prefix}.relationships must be an array when provided`);
    return errors;
  }

  const seenRelationshipIds = new Set();
  const seenEdgeKeys = new Set();

  relationships.forEach((relationship, index) => {
    const itemPrefix = `${prefix}.relationships[${index}]`;
    if (!relationship || typeof relationship !== 'object' || Array.isArray(relationship)) {
      errors.push(`${itemPrefix} must be an object`);
      return;
    }

    if (!isNonEmptyString(relationship.relationshipId)) {
      errors.push(`${itemPrefix}.relationshipId is required and must be a non-empty string`);
    } else {
      const relId = relationship.relationshipId.trim().toLowerCase();
      if (seenRelationshipIds.has(relId)) {
        errors.push(`${itemPrefix}.relationshipId duplicates an existing relationship id`);
      }
      seenRelationshipIds.add(relId);
    }

    if (!isNonEmptyString(relationship.type) || !VALID_RELATIONSHIP_TYPES.includes(relationship.type)) {
      errors.push(`${itemPrefix}.type must be one of: ${VALID_RELATIONSHIP_TYPES.join(', ')}`);
    }

    if (!isNonEmptyString(relationship.sourceNodeId)) {
      errors.push(`${itemPrefix}.sourceNodeId is required and must be a non-empty string`);
    } else if (nodeIds instanceof Set && !nodeIds.has(relationship.sourceNodeId.trim())) {
      errors.push(`${itemPrefix}.sourceNodeId references non-existent node: ${relationship.sourceNodeId}`);
    }

    const hasTargetNodeId = isNonEmptyString(relationship.targetNodeId);
    const hasTargetObjectId = isNonEmptyString(relationship.targetObjectId);
    const hasTargetPath = isNonEmptyString(relationship.targetPath);

    if (!hasTargetNodeId && !hasTargetObjectId && !hasTargetPath) {
      errors.push(`${itemPrefix} must define at least one target (targetNodeId, targetObjectId, or targetPath)`);
    }

    if (relationship.targetNodeId !== undefined && !hasTargetNodeId) {
      errors.push(`${itemPrefix}.targetNodeId must be a non-empty string when provided`);
    } else if (hasTargetNodeId && nodeIds instanceof Set && !nodeIds.has(relationship.targetNodeId.trim())) {
      errors.push(`${itemPrefix}.targetNodeId references non-existent node: ${relationship.targetNodeId}`);
    }

    if (relationship.targetObjectId !== undefined && !hasTargetObjectId) {
      errors.push(`${itemPrefix}.targetObjectId must be a non-empty string when provided`);
    }

    if (relationship.targetPath !== undefined && !hasTargetPath) {
      errors.push(`${itemPrefix}.targetPath must be a non-empty string when provided`);
    }

    if (hasTargetNodeId && hasTargetObjectId) {
      errors.push(`${itemPrefix} should reference either targetNodeId or targetObjectId, not both`);
    }

    if (
      isNonEmptyString(relationship.sourceNodeId) &&
      hasTargetNodeId &&
      relationship.sourceNodeId.trim() === relationship.targetNodeId.trim()
    ) {
      errors.push(`${itemPrefix} cannot reference the same node for sourceNodeId and targetNodeId`);
    }

    if (
      relationship.cardinality !== undefined &&
      (!isNonEmptyString(relationship.cardinality) || !VALID_RELATIONSHIP_CARDINALITIES.includes(relationship.cardinality))
    ) {
      errors.push(`${itemPrefix}.cardinality must be one of: ${VALID_RELATIONSHIP_CARDINALITIES.join(', ')}`);
    }

    if (relationship.description !== undefined && typeof relationship.description !== 'string') {
      errors.push(`${itemPrefix}.description must be a string when provided`);
    }

    const edgeKey = [
      `${relationship.type || ''}`.trim().toLowerCase(),
      `${relationship.sourceNodeId || ''}`.trim().toLowerCase(),
      `${relationship.targetNodeId || ''}`.trim().toLowerCase(),
      `${relationship.targetObjectId || ''}`.trim().toLowerCase(),
      `${relationship.targetPath || ''}`.trim().toLowerCase()
    ].join('::');
    if (seenEdgeKeys.has(edgeKey)) {
      errors.push(`${itemPrefix} duplicates an existing relationship edge`);
    }
    seenEdgeKeys.add(edgeKey);
  });

  return errors;
}

function validateOperationalProfile(profile, prefix = 'metadata.operationalProfile') {
  const errors = [];
  if (profile === undefined) return errors;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    errors.push(`${prefix} must be an object when provided`);
    return errors;
  }

  OPERATIONAL_PROFILE_STRING_FIELDS.forEach((field) => {
    const value = profile[field];
    if (value !== undefined && !isNonEmptyString(value)) {
      errors.push(`${prefix}.${field} must be a non-empty string when provided`);
    }
  });

  OPERATIONAL_PROFILE_LIST_FIELDS.forEach((field) => {
    const value = profile[field];
    if (value === undefined) return;
    if (!Array.isArray(value)) {
      errors.push(`${prefix}.${field} must be an array of non-empty strings when provided`);
      return;
    }

    const seen = new Set();
    value.forEach((item, index) => {
      if (!isNonEmptyString(item)) {
        errors.push(`${prefix}.${field}[${index}] must be a non-empty string`);
        return;
      }
      const normalized = item.trim().toLowerCase();
      if (seen.has(normalized)) {
        errors.push(`${prefix}.${field}[${index}] duplicates "${item}"`);
      }
      seen.add(normalized);
    });
  });

  return errors;
}

function validateConstraints(constraints, prefix) {
  const errors = [];
  if (constraints === undefined) return errors;
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) {
    errors.push(`${prefix}.constraints must be an object when provided`);
    return errors;
  }

  if (constraints.pattern !== undefined && typeof constraints.pattern !== 'string') {
    errors.push(`${prefix}.constraints.pattern must be a string when provided`);
  }

  if (constraints.allowedValues !== undefined && !Array.isArray(constraints.allowedValues)) {
    errors.push(`${prefix}.constraints.allowedValues must be an array when provided`);
  }

  if (constraints.minValue !== undefined && typeof constraints.minValue !== 'number') {
    errors.push(`${prefix}.constraints.minValue must be a number when provided`);
  }

  if (constraints.maxValue !== undefined && typeof constraints.maxValue !== 'number') {
    errors.push(`${prefix}.constraints.maxValue must be a number when provided`);
  }

  if (
    typeof constraints.minValue === 'number' &&
    typeof constraints.maxValue === 'number' &&
    constraints.maxValue < constraints.minValue
  ) {
    errors.push(`${prefix}.constraints.maxValue must be >= minValue`);
  }

  if (constraints.minLength !== undefined && (!Number.isInteger(constraints.minLength) || constraints.minLength < 0)) {
    errors.push(`${prefix}.constraints.minLength must be an integer >= 0 when provided`);
  }

  if (constraints.maxLength !== undefined && (!Number.isInteger(constraints.maxLength) || constraints.maxLength < 0)) {
    errors.push(`${prefix}.constraints.maxLength must be an integer >= 0 when provided`);
  }

  if (
    Number.isInteger(constraints.minLength) &&
    Number.isInteger(constraints.maxLength) &&
    constraints.maxLength < constraints.minLength
  ) {
    errors.push(`${prefix}.constraints.maxLength must be >= minLength`);
  }

  return errors;
}

export function validateOccurrences(occ) {
  const errors = [];

  if (typeof occ.min !== 'number' || occ.min < 0) {
    errors.push('occurrences.min must be a number >= 0');
  }

  if (occ.max !== '*') {
    if (typeof occ.max !== 'number' || occ.max < occ.min) {
      errors.push('occurrences.max must be "*" or a number >= min');
    }
  }

  return errors;
}

export function validateNode(node, index) {
  const errors = [];
  const prefix = `nodes[${index}]`;

  if (!node.nodeId || typeof node.nodeId !== 'string') {
    errors.push(`${prefix}.nodeId is required and must be a string`);
  }

  if (!node.name || typeof node.name !== 'string') {
    errors.push(`${prefix}.name is required and must be a string`);
  }

  if (!node.attribute || typeof node.attribute !== 'string') {
    errors.push(`${prefix}.attribute is required and must be a string`);
  }

  if (!VALID_ROLES.includes(node.role)) {
    errors.push(`${prefix}.role must be one of: ${VALID_ROLES.join(', ')}`);
  }

  if (node.dataType && !VALID_DATA_TYPES.includes(node.dataType)) {
    errors.push(`${prefix}.dataType must be one of: ${VALID_DATA_TYPES.join(', ')}`);
  } else if (node.dataType && node.role && !isDataTypeAllowedForRole(node.role, node.dataType)) {
    errors.push(`${prefix}.dataType "${node.dataType}" is not allowed for role "${node.role}"`);
  }

  if (!node.occurrences) {
    errors.push(`${prefix}.occurrences is required`);
  } else {
    errors.push(...validateOccurrences(node.occurrences).map(e => `${prefix}.${e}`));
  }

  if (!Array.isArray(node.childrenNodeIds)) {
    errors.push(`${prefix}.childrenNodeIds must be an array`);
  }

  if (node.role === 'block') {
    if (!node.blockId || typeof node.blockId !== 'string') {
      errors.push(`${prefix}.blockId is required for role "block"`);
    }
    if (!node.versionRange || typeof node.versionRange !== 'string') {
      errors.push(`${prefix}.versionRange is required for role "block"`);
    }
  }

  if (node.timeRole !== undefined) {
    if (!isNonEmptyString(node.timeRole) || !['timestamp', 'interval_start', 'interval_end'].includes(node.timeRole)) {
      errors.push(`${prefix}.timeRole must be one of: timestamp, interval_start, interval_end`);
    } else if (!['date', 'time', 'datetime'].includes(`${node.dataType || ''}`)) {
      errors.push(`${prefix}.timeRole can only be set on date, time, or datetime nodes`);
    }
  }

  errors.push(...validateConstraints(node.constraints, prefix));
  errors.push(...validateTerminologyBindings(node.terminologyBindings, prefix));
  errors.push(...validateStructuralBindings(node.structuralBindings, prefix));

  // Paths are COMPUTED from tree structure, not stored
  // No validation needed for canonicalPath or dataPath

  return errors;
}

export function validateSemanticObject(obj) {
  const errors = [];
  const warnings = [];
  const nodeIds = new Set();

  if (!obj.id || typeof obj.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  if (!obj.name || typeof obj.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!VALID_SCOPES.includes(obj.scope)) {
    if (LEGACY_SCOPES.includes(obj.scope)) {
      warnings.push(`scope "${obj.scope}" is legacy; migrate to one of: ${VALID_SCOPES.join(', ')}`);
    } else {
      errors.push(`scope must be one of: ${VALID_SCOPES.join(', ')}`);
    }
  }

  if (!VALID_ORIGINS.includes(obj.origin)) {
    if (LEGACY_ORIGINS.includes(obj.origin)) {
      warnings.push(`origin "${obj.origin}" is legacy; migrate to one of: ${VALID_ORIGINS.join(', ')}`);
    } else {
      errors.push(`origin must be one of: ${VALID_ORIGINS.join(', ')}`);
    }
  }

  if (!VALID_STATUSES.includes(obj.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (!obj.version || typeof obj.version !== 'string') {
    errors.push('version is required and must be a string');
  } else if (!SEMVER_PATTERN.test(obj.version)) {
    errors.push('version must use semantic version format x.y.z');
  }

  if (!obj.nodes || !Array.isArray(obj.nodes)) {
    errors.push('nodes is required and must be an array');
    return { valid: false, errors, warnings };
  }

  if (obj.nodes.length === 0) {
    warnings.push('nodes array is empty');
  } else {
    const rootNodes = obj.nodes.filter(n => n.parentNodeId === null);
    if (rootNodes.length === 0) {
      errors.push('Must have exactly one root node (parentNodeId = null)');
    } else if (rootNodes.length > 1) {
      errors.push(`Found ${rootNodes.length} root nodes, but only one is allowed`);
    }

    obj.nodes.forEach((node, index) => {
      errors.push(...validateNode(node, index));

      if (nodeIds.has(node.nodeId)) {
        errors.push(`Duplicate nodeId: ${node.nodeId} at index ${index}`);
      }
      if (isNonEmptyString(node.nodeId)) {
        nodeIds.add(node.nodeId.trim());
      }

      // Paths are COMPUTED from tree structure, not stored
      // No need to check canonicalPath uniqueness
    });

    obj.nodes.forEach((node, index) => {
      if (node.parentNodeId !== null) {
        const parentExists = obj.nodes.some(n => n.nodeId === node.parentNodeId);
        if (!parentExists) {
          errors.push(`nodes[${index}].parentNodeId references non-existent node: ${node.parentNodeId}`);
        }
      }

      const childNodeIds = Array.isArray(node.childrenNodeIds) ? node.childrenNodeIds : [];
      childNodeIds.forEach(childId => {
        const childExists = obj.nodes.some(n => n.nodeId === childId);
        if (!childExists) {
          errors.push(`nodes[${index}].childrenNodeIds contains non-existent node: ${childId}`);
        }
      });
    });
  }

  errors.push(...validateTerminologyBindings(obj.terminologyBindings, 'object'));
  errors.push(...validateStructuralBindings(obj.structuralBindings, 'object', nodeIds));
  errors.push(...validateRelationships(obj.relationships, nodeIds, 'object'));
  errors.push(...validateOperationalProfile(obj.metadata?.operationalProfile));

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
