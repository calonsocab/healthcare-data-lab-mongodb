// Semantic Object Utilities - Validation, ID generation, path building

import {
  SemanticObject,
  SemanticNode,
  NodeOccurrences,
  VALID_SCOPES,
  VALID_ORIGINS,
  VALID_STATUSES,
  VALID_ROLES,
  VALID_DATA_TYPES,
  VALID_TIME_ROLES
} from './types';

// ============= ID Generation =============

/**
 * Generate a unique node ID
 * Format: n-<short-uuid>
 */
export function generateNodeId(): string {
  return 'n-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate a unique semantic object ID
 * Format: so-<short-uuid>
 */
export function generateSemanticObjectId(): string {
  return 'so-' + Math.random().toString(36).substr(2, 12);
}

// ============= Path Building =============

/**
 * Build canonical path for a node
 * Format: /root[n-root]/attribute[n-xxx]/...
 */
export function buildCanonicalPath(
  node: SemanticNode,
  nodeMap: Map<string, SemanticNode>
): string {
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
 * Build data path (without node IDs)
 * Format: /root/attribute/...
 */
export function buildDataPath(
  node: SemanticNode,
  nodeMap: Map<string, SemanticNode>
): string {
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

/**
 * Rebuild all canonical and data paths in a SemanticObject
 */
export function rebuildAllPaths(obj: SemanticObject): SemanticObject {
  const nodeMap = new Map(obj.nodes.map(n => [n.nodeId, n]));

  const updatedNodes = obj.nodes.map(node => ({
    ...node,
    canonicalPath: buildCanonicalPath(node, nodeMap),
    dataPath: buildDataPath(node, nodeMap)
  }));

  return { ...obj, nodes: updatedNodes };
}

// ============= Node Tree Operations =============

/**
 * Find root node in SemanticObject
 */
export function findRootNode(obj: SemanticObject): SemanticNode | undefined {
  return obj.nodes.find(n => n.parentNodeId === null);
}

/**
 * Get children of a node
 */
export function getChildNodes(
  parentNodeId: string,
  nodes: SemanticNode[]
): SemanticNode[] {
  const parent = nodes.find(n => n.nodeId === parentNodeId);
  if (!parent) return [];

  return parent.childrenNodeIds
    .map(childId => nodes.find(n => n.nodeId === childId))
    .filter((n): n is SemanticNode => n !== undefined);
}

/**
 * Get all descendants of a node (recursive)
 */
export function getDescendants(
  nodeId: string,
  nodes: SemanticNode[]
): SemanticNode[] {
  const descendants: SemanticNode[] = [];
  const children = getChildNodes(nodeId, nodes);

  for (const child of children) {
    descendants.push(child);
    descendants.push(...getDescendants(child.nodeId, nodes));
  }

  return descendants;
}

/**
 * Update childrenNodeIds to match actual parent references
 */
export function syncChildrenNodeIds(nodes: SemanticNode[]): SemanticNode[] {
  // Build map of parent -> children
  const childrenMap = new Map<string, string[]>();

  for (const node of nodes) {
    if (node.parentNodeId) {
      if (!childrenMap.has(node.parentNodeId)) {
        childrenMap.set(node.parentNodeId, []);
      }
      childrenMap.get(node.parentNodeId)!.push(node.nodeId);
    }
  }

  // Update each node's childrenNodeIds
  return nodes.map(node => ({
    ...node,
    childrenNodeIds: childrenMap.get(node.nodeId) || []
  }));
}

// ============= Validation =============

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const ROLE_DATA_TYPE_ALLOWED: Record<string, string[]> = {
  section: ['object'],
  group: ['object'],
  event: ['object'],
  event_series: ['array'],
  block: ['object'],
  field: VALID_DATA_TYPES.filter((type) => !['object', 'array'].includes(type))
};

/**
 * Validate node occurrences
 */
export function validateOccurrences(occ: NodeOccurrences): string[] {
  const errors: string[] = [];

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

/**
 * Validate a single SemanticNode
 */
export function validateNode(node: SemanticNode, index: number): string[] {
  const errors: string[] = [];
  const prefix = `nodes[${index}]`;

  // Required fields
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

  // Data type validation
  if (node.dataType && !VALID_DATA_TYPES.includes(node.dataType)) {
    errors.push(`${prefix}.dataType must be one of: ${VALID_DATA_TYPES.join(', ')}`);
  } else if (node.dataType && node.role && ROLE_DATA_TYPE_ALLOWED[node.role] && !ROLE_DATA_TYPE_ALLOWED[node.role].includes(node.dataType)) {
    errors.push(`${prefix}.dataType "${node.dataType}" is not allowed for role "${node.role}"`);
  }

  // TimeRole validation - only valid for date/datetime fields
  if (node.timeRole) {
    if (!VALID_TIME_ROLES.includes(node.timeRole)) {
      errors.push(`${prefix}.timeRole must be one of: ${VALID_TIME_ROLES.join(', ')}`);
    }
    if (node.dataType && !['date', 'time', 'datetime'].includes(node.dataType)) {
      errors.push(`${prefix}.timeRole can only be set on date, time, or datetime fields`);
    }
  }

  // Occurrences validation
  if (!node.occurrences) {
    errors.push(`${prefix}.occurrences is required`);
  } else {
    errors.push(...validateOccurrences(node.occurrences).map(e => `${prefix}.${e}`));
  }

  // ChildrenNodeIds must be an array
  if (!Array.isArray(node.childrenNodeIds)) {
    errors.push(`${prefix}.childrenNodeIds must be an array`);
  }

  // Paths are COMPUTED from tree structure, not stored
  // No validation needed for canonicalPath or dataPath

  return errors;
}

/**
 * Validate entire SemanticObject
 */
export function validateSemanticObject(obj: SemanticObject): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic object validation
  if (!obj.id || typeof obj.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  if (!obj.name || typeof obj.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!VALID_SCOPES.includes(obj.scope)) {
    errors.push(`scope must be one of: ${VALID_SCOPES.join(', ')}`);
  }

  if (!VALID_ORIGINS.includes(obj.origin)) {
    errors.push(`origin must be one of: ${VALID_ORIGINS.join(', ')}`);
  }

  if (!VALID_STATUSES.includes(obj.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (!obj.version || typeof obj.version !== 'string') {
    errors.push('version is required and must be a string');
  }

  // Nodes validation
  if (!obj.nodes || !Array.isArray(obj.nodes)) {
    errors.push('nodes is required and must be an array');
    return { valid: false, errors, warnings };
  }

  if (obj.nodes.length === 0) {
    warnings.push('nodes array is empty');
  } else {
    // Check for exactly one root node
    const rootNodes = obj.nodes.filter(n => n.parentNodeId === null);
    if (rootNodes.length === 0) {
      errors.push('Must have exactly one root node (parentNodeId = null)');
    } else if (rootNodes.length > 1) {
      errors.push(`Found ${rootNodes.length} root nodes, but only one is allowed`);
    }

    // Check unique nodeIds
    const nodeIds = new Set<string>();

    obj.nodes.forEach((node, index) => {
      // Validate each node
      errors.push(...validateNode(node, index));

      // Check nodeId uniqueness
      if (nodeIds.has(node.nodeId)) {
        errors.push(`Duplicate nodeId: ${node.nodeId} at index ${index}`);
      }
      nodeIds.add(node.nodeId);

      // Paths are COMPUTED from tree structure, not stored
      // No need to check canonicalPath uniqueness
    });

    // Validate parent references exist
    obj.nodes.forEach((node, index) => {
      if (node.parentNodeId !== null) {
        const parentExists = obj.nodes.some(n => n.nodeId === node.parentNodeId);
        if (!parentExists) {
          errors.push(`nodes[${index}].parentNodeId references non-existent node: ${node.parentNodeId}`);
        }
      }

      // Validate children references exist
      node.childrenNodeIds.forEach(childId => {
        const childExists = obj.nodes.some(n => n.nodeId === childId);
        if (!childExists) {
          errors.push(`nodes[${index}].childrenNodeIds contains non-existent node: ${childId}`);
        }
      });
    });

    // Validate event/event_series time semantics
    obj.nodes.forEach((node, index) => {
      if (node.role === 'event') {
        // Event nodes must have at least one child with timeRole
        const children = getChildNodes(node.nodeId, obj.nodes);
        const hasTimestamp = children.some(child => child.timeRole === 'timestamp');
        const hasIntervalStart = children.some(child => child.timeRole === 'interval_start');
        const hasIntervalEnd = children.some(child => child.timeRole === 'interval_end');

        if (!hasTimestamp && !(hasIntervalStart && hasIntervalEnd)) {
          warnings.push(
            `nodes[${index}] (${node.name}) has role "event" but no child with timeRole="timestamp" or interval_start/interval_end pair`
          );
        }
      }

      if (node.role === 'event_series') {
        // Event series nodes should contain event children
        const children = getChildNodes(node.nodeId, obj.nodes);
        const hasEventChild = children.some(child => child.role === 'event');
        if (!hasEventChild && children.length > 0) {
          warnings.push(
            `nodes[${index}] (${node.name}) has role "event_series" but no children with role="event"`
          );
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============= Default Creators =============

/**
 * Create a default root node
 */
export function createDefaultRootNode(objectName: string = 'root'): SemanticNode {
  const nodeId = generateNodeId();
  const attribute = objectName.toLowerCase().replace(/\s+/g, '');

  return {
    nodeId,
    parentNodeId: null,
    childrenNodeIds: [],
    role: 'group',
    name: objectName,
    attribute,
    dataType: 'object',
    occurrences: { min: 1, max: 1 },
    canonicalPath: `/root[${nodeId}]`,
    dataPath: '/root'
  };
}

/**
 * Create a default SemanticObject
 */
export function createDefaultSemanticObject(name: string = 'New Object'): SemanticObject {
  const rootNode = createDefaultRootNode(name);

  return {
    id: generateSemanticObjectId(),
    name,
    description: '',
    scope: 'business_object',
    origin: 'custom',
    version: '1.0.0',
    status: 'draft',
    nodes: [rootNode],
    metadata: {
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Create a field node
 */
export function createFieldNode(
  parentNode: SemanticNode,
  name: string,
  attribute: string,
  dataType: NodeDataType,
  required: boolean = false
): SemanticNode {
  const nodeId = generateNodeId();

  return {
    nodeId,
    parentNodeId: parentNode.nodeId,
    childrenNodeIds: [],
    role: 'field',
    name,
    attribute,
    dataType,
    occurrences: { min: required ? 1 : 0, max: 1 },
    canonicalPath: `${parentNode.canonicalPath}/${attribute}[${nodeId}]`,
    dataPath: `${parentNode.dataPath || '/root'}/${attribute}`,
    constraints: {
      required
    }
  };
}

/**
 * Create a group node
 */
export function createGroupNode(
  parentNode: SemanticNode,
  name: string,
  attribute: string
): SemanticNode {
  const nodeId = generateNodeId();

  return {
    nodeId,
    parentNodeId: parentNode.nodeId,
    childrenNodeIds: [],
    role: 'group',
    name,
    attribute,
    dataType: 'object',
    occurrences: { min: 0, max: 1 },
    canonicalPath: `${parentNode.canonicalPath}/${attribute}[${nodeId}]`,
    dataPath: `${parentNode.dataPath || '/root'}/${attribute}`
  };
}
