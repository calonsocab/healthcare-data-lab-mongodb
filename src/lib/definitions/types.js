// ContextObjects Builder - Type Definitions
// These types define the ReusableDefinition model for Phase 1

/**
 * @typedef {'context_object' | 'block' | 'resource-definition' | 'archetype' | 'template' | 'fragment'} DefinitionKind
 */

/**
 * @typedef {'custom' | 'openehr'} DefinitionOrigin
 * Future: 'fhir' will be added in later phases
 */

/**
 * @typedef {'draft' | 'active' | 'deprecated'} DefinitionStatus
 */

/**
 * @typedef {'INTERNAL-JSON' | 'SPLASH-HIERARCHICAL' | 'ADL' | 'OPT'} DefinitionFormat
 * Future: 'FHIR-JSON' | 'FHIR-Profile' will be added
 */

/**
 * @typedef {Object} Slot
 * @property {string} id - UUID for the slot
 * @property {string} role - Semantic role (e.g., "section", "address")
 * @property {string} [targetDefinitionId] - Reference to another ReusableDefinition
 * @property {number} min - Minimum cardinality (>= 0)
 * @property {number|string} max - Maximum cardinality (>= min or "*")
 */

/**
 * @typedef {Object} Occurrences
 * @property {number} min - Minimum cardinality (>= 0)
 * @property {number|string} max - Maximum cardinality (>= min or "*")
 */

/**
 * @typedef {'string' | 'number' | 'integer' | 'boolean' | 'date' | 'time' | 'datetime' | 'duration' | 'object' | 'array' | 'code' | 'coded_text' | 'quantity' | 'reference' | 'identifier' | 'uri' | 'interval'} NodeDataType
 */

/**
 * @typedef {Object} DefinitionNode
 * @property {string} nodeId - Unique within this ReusableDefinition
 * @property {string} name - Human-friendly field name for UI
 * @property {string} attribute - Technical field/attribute name for JSON
 * @property {string} [description] - Optional description/help text
 * @property {string|null} parentNodeId - Parent nodeId, or null for root
 * @property {NodeDataType} dataType - Node type
 * @property {Occurrences} occurrences - Cardinality of this node
 * @property {string[]} childrenNodeIds - Children (direct) of this node
 * @property {string} canonicalPath - Canonical path inside this definition
 * @property {string} [dataPath] - Optional JSON pointer or dot-path
 */

/**
 * @typedef {Object} ReusableDefinitionMetadata
 * @property {string[]} [tags] - Tags for categorization
 * @property {string} [createdBy] - User who created this definition
 * @property {string} [createdAt] - ISO timestamp
 * @property {string} [updatedAt] - ISO timestamp
 */

/**
 * @typedef {Object} ReusableDefinition
 * @property {string} id - Internal UUID
 * @property {DefinitionKind} kind - Type of definition
 * @property {DefinitionOrigin} origin - Source of definition (openehr or custom)
 * @property {string} [externalId] - External identifier (e.g., openEHR archetype_id)
 * @property {string} name - Human-readable name
 * @property {string} [description] - Optional description
 * @property {string|null} rmType - Reference Model type (e.g., "COMPOSITION", "OBSERVATION")
 * @property {string} version - Semantic version (e.g., "0.1.0")
 * @property {DefinitionStatus} status - Current status
 * @property {DefinitionFormat} definitionFormat - Format of the definition content
 * @property {any} definition - The actual constraints/schema
 * @property {Slot[]} slots - Composition slots for embedding other definitions
 * @property {DefinitionNode[]} nodes - List of nodes (fields/structure)
 * @property {ReusableDefinitionMetadata} [metadata] - Additional metadata
 */

// ============= ContextObjects v1 Constants =============

// Schema version constants
export const SCHEMA_VERSION = 'co/1';
export const PATH_DIALECT = 'coql/v1';

// v1 Scope values
export const VALID_V1_SCOPES = ['business_object', 'building_block'];

// v1 Origin values
export const VALID_V1_ORIGINS = ['custom', 'standard', 'vendor'];

// v1 Role values (includes block for block references)
export const VALID_V1_ROLES = ['section', 'group', 'field', 'event', 'event_series', 'block'];

// v1 Time roles
export const VALID_TIME_ROLES = ['timestamp', 'interval_start', 'interval_end'];

// ============= Legacy Constants (for backward compatibility) =============

// Validation constants
export const VALID_KINDS = ['context_object', 'block', 'resource-definition', 'archetype', 'template', 'fragment'];
export const VALID_ORIGINS = ['custom', 'openehr'];
export const VALID_STATUSES = ['draft', 'active', 'deprecated'];
export const VALID_FORMATS = ['INTERNAL-JSON', 'SPLASH-HIERARCHICAL', 'ADL', 'OPT'];
export const VALID_NODE_DATA_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'date',
  'time',
  'datetime',
  'duration',
  'object',
  'array',
  'code',
  'coded_text',
  'quantity',
  'reference',
  'identifier',
  'uri',
  'interval'
];
export const CODE_LIKE_NODE_DATA_TYPES = ['code', 'coded_text'];
export const ROLE_DATA_TYPE_DEFAULTS = {
  section: 'object',
  group: 'object',
  event: 'object',
  event_series: 'array',
  block: 'object',
  field: 'string'
};

const FIELD_ALLOWED_DATA_TYPES = VALID_NODE_DATA_TYPES.filter((type) => !['object', 'array'].includes(type));
export const ROLE_DATA_TYPE_ALLOWED = {
  section: ['object'],
  group: ['object'],
  event: ['object'],
  event_series: ['array'],
  block: ['object'],
  field: FIELD_ALLOWED_DATA_TYPES
};

export function getDefaultDataTypeForRole(role = 'field') {
  return ROLE_DATA_TYPE_DEFAULTS[role] || 'string';
}

export function isDataTypeAllowedForRole(role = 'field', dataType = 'string') {
  const allowed = ROLE_DATA_TYPE_ALLOWED[role];
  if (!Array.isArray(allowed)) return VALID_NODE_DATA_TYPES.includes(dataType);
  return allowed.includes(dataType);
}

export function coerceDataTypeForRole(role = 'field', dataType = 'string') {
  if (isDataTypeAllowedForRole(role, dataType)) return dataType;
  return getDefaultDataTypeForRole(role);
}

// Origin-Format mapping for validation
export const ORIGIN_FORMAT_MAP = {
  openehr: ['ADL', 'OPT'],
  custom: ['INTERNAL-JSON', 'SPLASH-HIERARCHICAL'],
  standard: ['INTERNAL-JSON', 'SPLASH-HIERARCHICAL'],
  imported: ['INTERNAL-JSON', 'SPLASH-HIERARCHICAL', 'ADL', 'OPT']
};

/**
 * Generates a short random ID for nodes
 * @returns {string}
 */
export function generateNodeId() {
  return 'node-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Builds canonical path for a node
 * @param {DefinitionNode} node - The node
 * @param {Map<string, DefinitionNode>} nodeMap - Map of all nodes by nodeId
 * @returns {string}
 */
export function buildCanonicalPath(node, nodeMap) {
  if (!node.parentNodeId) {
    // Root node
    return `/root[${node.nodeId}]`;
  }

  const parent = nodeMap.get(node.parentNodeId);
  if (!parent) {
    throw new Error(`Parent node ${node.parentNodeId} not found`);
  }

  const parentPath = parent.canonicalPath || buildCanonicalPath(parent, nodeMap);
  return `${parentPath}/${node.attribute}[${node.nodeId}]`;
}

/**
 * Validates nodes array
 * @param {DefinitionNode[]} nodes
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateNodes(nodes) {
  const errors = [];

  if (!nodes || !Array.isArray(nodes)) {
    return { valid: true, errors: [] }; // nodes is optional
  }

  if (nodes.length === 0) {
    return { valid: true, errors: [] };
  }

  // Check for exactly one root node
  const rootNodes = nodes.filter(n => n.parentNodeId === null);
  if (rootNodes.length === 0) {
    errors.push('Nodes must have exactly one root node (parentNodeId = null)');
  } else if (rootNodes.length > 1) {
    errors.push(`Found ${rootNodes.length} root nodes, but only one is allowed`);
  }

  // Check unique nodeIds
  const nodeIds = new Set();
  const canonicalPaths = new Set();

  nodes.forEach((node, index) => {
    // Check nodeId uniqueness
    if (nodeIds.has(node.nodeId)) {
      errors.push(`Duplicate nodeId: ${node.nodeId} at index ${index}`);
    }
    nodeIds.add(node.nodeId);

    // Check canonicalPath uniqueness
    if (canonicalPaths.has(node.canonicalPath)) {
      errors.push(`Duplicate canonicalPath: ${node.canonicalPath} at index ${index}`);
    }
    canonicalPaths.add(node.canonicalPath);

    // Validate required fields
    if (!node.nodeId || typeof node.nodeId !== 'string') {
      errors.push(`nodes[${index}].nodeId is required and must be a string`);
    }
    if (!node.name || typeof node.name !== 'string') {
      errors.push(`nodes[${index}].name is required and must be a string`);
    }
    if (!node.attribute || typeof node.attribute !== 'string') {
      errors.push(`nodes[${index}].attribute is required and must be a string`);
    }
    if (!VALID_V1_ROLES.includes(node.role)) {
      errors.push(`nodes[${index}].role must be one of: ${VALID_V1_ROLES.join(', ')}`);
    }

    if (!VALID_NODE_DATA_TYPES.includes(node.dataType)) {
      errors.push(`nodes[${index}].dataType must be one of: ${VALID_NODE_DATA_TYPES.join(', ')}`);
    } else if (!isDataTypeAllowedForRole(node.role || 'field', node.dataType)) {
      errors.push(`nodes[${index}].dataType "${node.dataType}" is not allowed for role "${node.role}"`);
    }

    // Validate occurrences
    if (!node.occurrences) {
      errors.push(`nodes[${index}].occurrences is required`);
    } else {
      if (typeof node.occurrences.min !== 'number' || node.occurrences.min < 0) {
        errors.push(`nodes[${index}].occurrences.min must be a number >= 0`);
      }
      if (node.occurrences.max !== '*' && (typeof node.occurrences.max !== 'number' || node.occurrences.max < node.occurrences.min)) {
        errors.push(`nodes[${index}].occurrences.max must be "*" or a number >= min`);
      }
    }

    // Validate childrenNodeIds
    if (!Array.isArray(node.childrenNodeIds)) {
      errors.push(`nodes[${index}].childrenNodeIds must be an array`);
    }

    // Validate parent reference exists (except for root)
    if (node.parentNodeId !== null && !nodeIds.has(node.parentNodeId)) {
      // Parent might be declared later, we'll do a second pass
    }
  });

  // Second pass: validate parent references
  nodes.forEach((node, index) => {
    if (node.parentNodeId !== null) {
      const parentExists = nodes.some(n => n.nodeId === node.parentNodeId);
      if (!parentExists) {
        errors.push(`nodes[${index}].parentNodeId references non-existent node: ${node.parentNodeId}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Converts nodes to a JSON Schema-like definition (for INTERNAL-JSON format)
 * @param {DefinitionNode[]} nodes
 * @returns {Object}
 */
export function nodesToJsonSchema(nodes) {
  if (!nodes || nodes.length === 0) {
    return { type: 'object', properties: {} };
  }

  // Build node map
  const nodeMap = new Map();
  nodes.forEach(n => nodeMap.set(n.nodeId, n));

  // Find root
  const root = nodes.find(n => n.parentNodeId === null);
  if (!root) {
    return { type: 'object', properties: {} };
  }

  // Recursive function to build schema
  const buildSchema = (node) => {
    const schema = {};

    switch (node.dataType) {
      case 'string':
      case 'code':
      case 'coded_text':
      case 'identifier':
        schema.type = 'string';
        break;
      case 'number':
      case 'quantity':
        schema.type = 'number';
        break;
      case 'boolean':
        schema.type = 'boolean';
        break;
      case 'date':
        schema.type = 'string';
        schema.format = 'date';
        break;
      case 'time':
        schema.type = 'string';
        schema.format = 'time';
        break;
      case 'datetime':
        schema.type = 'string';
        schema.format = 'date-time';
        break;
      case 'duration':
        schema.type = 'string';
        schema.format = 'duration';
        break;
      case 'reference':
      case 'uri':
        schema.type = 'string';
        schema.format = 'uri';
        break;
      case 'interval':
        schema.type = 'object';
        schema.properties = {
          lower: { type: 'string' },
          upper: { type: 'string' }
        };
        break;
      case 'array':
        schema.type = 'array';
        // If has children, items are objects
        if (node.childrenNodeIds.length > 0) {
          const itemProperties = {};
          const required = [];
          node.childrenNodeIds.forEach(childId => {
            const child = nodeMap.get(childId);
            if (child) {
              itemProperties[child.attribute] = buildSchema(child);
              if (child.occurrences.min > 0) {
                required.push(child.attribute);
              }
            }
          });
          schema.items = {
            type: 'object',
            properties: itemProperties,
            ...(required.length > 0 ? { required } : {})
          };
        } else {
          schema.items = { type: 'string' };
        }
        break;
      case 'object':
      default:
        schema.type = 'object';
        if (node.childrenNodeIds.length > 0) {
          schema.properties = {};
          const required = [];
          node.childrenNodeIds.forEach(childId => {
            const child = nodeMap.get(childId);
            if (child) {
              schema.properties[child.attribute] = buildSchema(child);
              if (child.occurrences.min > 0) {
                required.push(child.attribute);
              }
            }
          });
          if (required.length > 0) {
            schema.required = required;
          }
        }
        break;
    }

    if (node.description) {
      schema.description = node.description;
    }

    return schema;
  };

  return buildSchema(root);
}

/**
 * Validates a ReusableDefinition object
 * @param {Partial<ReusableDefinition>} def - The definition to validate
 * @param {boolean} isCreate - Whether this is a create operation (more lenient on some fields)
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateDefinition(def, isCreate = false) {
  const errors = [];

  // Required fields
  if (!def.name || typeof def.name !== 'string' || def.name.trim() === '') {
    errors.push('name is required and must be a non-empty string');
  }

  if (!def.kind || !VALID_KINDS.includes(def.kind)) {
    errors.push(`kind must be one of: ${VALID_KINDS.join(', ')}`);
  }

  if (!def.origin || !VALID_ORIGINS.includes(def.origin)) {
    errors.push(`origin must be one of: ${VALID_ORIGINS.join(', ')}`);
  }

  if (!def.definitionFormat || !VALID_FORMATS.includes(def.definitionFormat)) {
    errors.push(`definitionFormat must be one of: ${VALID_FORMATS.join(', ')}`);
  }

  if (!def.version || typeof def.version !== 'string') {
    errors.push('version is required and must be a string');
  }

  if (!def.status || !VALID_STATUSES.includes(def.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  // Origin-Format consistency check
  if (def.origin && def.definitionFormat) {
    const allowedFormats = ORIGIN_FORMAT_MAP[def.origin];
    if (allowedFormats && !allowedFormats.includes(def.definitionFormat)) {
      errors.push(`For origin="${def.origin}", definitionFormat must be one of: ${allowedFormats.join(', ')}`);
    }
  }

  // Validate slots if present
  if (def.slots && Array.isArray(def.slots)) {
    def.slots.forEach((slot, index) => {
      if (!slot.id || typeof slot.id !== 'string') {
        errors.push(`slots[${index}].id must be a string`);
      }
      if (!slot.role || typeof slot.role !== 'string') {
        errors.push(`slots[${index}].role must be a string`);
      }
      if (typeof slot.min !== 'number' || slot.min < 0) {
        errors.push(`slots[${index}].min must be a number >= 0`);
      }
      if (slot.max !== '*' && (typeof slot.max !== 'number' || slot.max < slot.min)) {
        errors.push(`slots[${index}].max must be "*" or a number >= min`);
      }
    });
  }

  // Validate nodes if present
  if (def.nodes && Array.isArray(def.nodes) && def.nodes.length > 0) {
    const nodesValidation = validateNodes(def.nodes);
    if (!nodesValidation.valid) {
      errors.push(...nodesValidation.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates a default empty definition for custom archetypes
 * @returns {Partial<ReusableDefinition>}
 */
export function createDefaultCustomDefinition() {
  const rootNodeId = generateNodeId();
  return {
    origin: 'custom',
    kind: 'context_object',
    rmType: null,
    definitionFormat: 'INTERNAL-JSON',
    version: '0.1.0',
    status: 'draft',
    definition: {
      type: 'object',
      properties: {}
    },
    slots: [],
    nodes: []
  };
}

/**
 * Creates a root node for a new definition
 * @param {string} objectName - Name of the object
 * @returns {DefinitionNode}
 */
export function createRootNode(objectName) {
  const rootNodeId = generateNodeId();
  return {
    nodeId: rootNodeId,
    name: objectName,
    attribute: 'root',
    description: `Root of the ${objectName} object`,
    parentNodeId: null,
    dataType: 'object',
    occurrences: { min: 1, max: 1 },
    childrenNodeIds: [],
    canonicalPath: `/root[${rootNodeId}]`
  };
}

/**
 * Creates a field node
 * @param {string} name - Display name
 * @param {string} attribute - Technical attribute name
 * @param {NodeDataType} dataType - Data type
 * @param {boolean} required - Whether field is required
 * @param {string} parentNodeId - Parent node ID
 * @param {string} parentCanonicalPath - Parent's canonical path
 * @param {string} [description] - Optional description
 * @returns {DefinitionNode}
 */
export function createFieldNode(name, attribute, dataType, required, parentNodeId, parentCanonicalPath, description = '') {
  const nodeId = generateNodeId();
  return {
    nodeId,
    name,
    attribute,
    description,
    parentNodeId,
    dataType,
    occurrences: { min: required ? 1 : 0, max: 1 },
    childrenNodeIds: [],
    canonicalPath: `${parentCanonicalPath}/${attribute}[${nodeId}]`
  };
}

// ============= ContextObjects v1 Helper Functions =============

/**
 * Creates a v1 SemanticObject with proper defaults
 * @param {string} name - Object name
 * @param {object} options - Optional overrides
 * @returns {object}
 */
export function createV1SemanticObject(name, options = {}) {
  const rootNodeId = 'n-' + Math.random().toString(36).substr(2, 9);
  const attribute = name.toLowerCase().replace(/\s+/g, '_');

  return {
    schema: { version: SCHEMA_VERSION, pathDialect: PATH_DIALECT },
    id: options.id || attribute,
    name,
    description: options.description || '',
    scope: options.scope || 'business_object',
    origin: options.origin || 'custom',
    version: options.version || '1.0.0',
    status: options.status || 'draft',
    nodes: options.nodes || [{
      nodeId: rootNodeId,
      parentNodeId: null,
      childrenNodeIds: [],
      role: 'section',
      name,
      attribute,
      dataType: 'object',
      occurrences: { min: 1, max: 1 }
    }],
    terminologyBindings: options.terminologyBindings || [],
    structuralBindings: options.structuralBindings || [],
    metadata: {
      tags: options.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...options.metadata
    }
  };
}

/**
 * Creates a v1 node with proper defaults
 * @param {object} nodeData - Node properties
 * @returns {object}
 */
export function createV1Node(nodeData) {
  const nodeId = nodeData.nodeId || 'n-' + Math.random().toString(36).substr(2, 9);

  return {
    nodeId,
    parentNodeId: nodeData.parentNodeId ?? null,
    childrenNodeIds: nodeData.childrenNodeIds || [],
    role: nodeData.role || 'field',
    name: nodeData.name || '',
    attribute: nodeData.attribute || '',
    description: nodeData.description,
    dataType: coerceDataTypeForRole(nodeData.role || 'field', nodeData.dataType || 'string'),
    occurrences: nodeData.occurrences || { min: 0, max: 1 },
    constraints: nodeData.constraints,
    timeRole: nodeData.timeRole,
    // Block reference fields (only for role: 'block')
    blockId: nodeData.blockId,
    versionRange: nodeData.versionRange,
    terminologyBindings: nodeData.terminologyBindings || [],
    structuralBindings: nodeData.structuralBindings || []
  };
}

/**
 * Creates a block reference node (role: 'block')
 * @param {string} name - Display name
 * @param {string} attribute - JSON attribute
 * @param {string} blockId - Block to reference (e.g., 'block.Address.v1')
 * @param {string} versionRange - Version range (e.g., '^1.0.0' or '1.x')
 * @param {string} parentNodeId - Parent node ID
 * @param {object} occurrences - Cardinality
 * @returns {object}
 */
export function createBlockNode(name, attribute, blockId, versionRange, parentNodeId, occurrences = { min: 0, max: 1 }) {
  return createV1Node({
    parentNodeId,
    role: 'block',
    name,
    attribute,
    blockId,
    versionRange,
    occurrences
  });
}

// Alias for backward compatibility
export const createBlockRefNode = createBlockNode;

/**
 * Sync childrenNodeIds from parentNodeId references
 * @param {Array} nodes - Array of nodes
 * @returns {Array} - Nodes with synced childrenNodeIds
 */
export function syncChildrenNodeIds(nodes) {
  const childrenMap = new Map();

  // Initialize all nodes with empty children arrays
  nodes.forEach(node => {
    childrenMap.set(node.nodeId, []);
  });

  // Build children arrays from parent references
  nodes.forEach(node => {
    if (node.parentNodeId) {
      const siblings = childrenMap.get(node.parentNodeId);
      if (siblings) {
        siblings.push(node.nodeId);
      }
    }
  });

  // Return nodes with corrected childrenNodeIds
  return nodes.map(node => ({
    ...node,
    childrenNodeIds: childrenMap.get(node.nodeId) || []
  }));
}

/**
 * Compute COQL path for a node
 * @param {string} nodeId - Node ID
 * @param {Array} nodes - All nodes
 * @returns {string}
 */
export function computeCoqlPath(nodeId, nodes) {
  const nodeMap = new Map(nodes.map(n => [n.nodeId, n]));
  const node = nodeMap.get(nodeId);

  if (!node) return '';
  if (!node.parentNodeId) return `/${node.attribute}`;

  const parentPath = computeCoqlPath(node.parentNodeId, nodes);
  return `${parentPath}/${node.attribute}`;
}
