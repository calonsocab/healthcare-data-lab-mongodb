// ContextObjects Builder - Validation System
// Validates ContextObject/SemanticObject (co/1 schema)
//
// Validation Rules:
// 1. One root (parentNodeId=null)
// 2. All nodeIds unique
// 3. occurrences.min >= 0, max="*" | number >= min
// 4. event must include a child with timeRole=timestamp or interval pair
// 5. role:block must carry blockId and valid semver/range
// NOTE: No emit validation - persistence hints belong in Stage-2, not CO definitions

import {
  SemanticNode,
  SemanticObject,
  VALID_ROLES,
  VALID_DATA_TYPES,
  VALID_TIME_ROLES,
  CO_SCHEMA_VERSION,
  PATH_DIALECT
} from './types';

// ============= Validation Result Types =============

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
  field?: string;
  severity: 'error';
}

export interface ValidationWarning {
  code: string;
  message: string;
  nodeId?: string;
  field?: string;
  severity: 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ============= Error Codes =============

export const ValidationCodes = {
  // Structure errors
  NO_ROOT: 'NO_ROOT',
  MULTIPLE_ROOTS: 'MULTIPLE_ROOTS',
  DUPLICATE_NODE_ID: 'DUPLICATE_NODE_ID',
  ORPHAN_NODE: 'ORPHAN_NODE',
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',

  // Node errors
  INVALID_ROLE: 'INVALID_ROLE',
  INVALID_DATA_TYPE: 'INVALID_DATA_TYPE',
  INVALID_ROLE_DATA_TYPE: 'INVALID_ROLE_DATA_TYPE',
  INVALID_OCCURRENCES: 'INVALID_OCCURRENCES',
  INVALID_TIME_ROLE: 'INVALID_TIME_ROLE',
  MISSING_ATTRIBUTE: 'MISSING_ATTRIBUTE',
  MISSING_NAME: 'MISSING_NAME',

  // Block reference errors
  BLOCK_MISSING_ID: 'BLOCK_MISSING_ID',
  BLOCK_MISSING_VERSION_RANGE: 'BLOCK_MISSING_VERSION_RANGE',
  BLOCK_INVALID_VERSION_RANGE: 'BLOCK_INVALID_VERSION_RANGE',

  // Event errors
  EVENT_NO_TIMESTAMP: 'EVENT_NO_TIMESTAMP',

  // Schema errors
  INVALID_SCHEMA: 'INVALID_SCHEMA',
  MISSING_ID: 'MISSING_ID',
  MISSING_VERSION: 'MISSING_VERSION',
  INVALID_VERSION: 'INVALID_VERSION',

  // Warnings
  FIELD_NO_DATA_TYPE: 'FIELD_NO_DATA_TYPE'
} as const;

const ROLE_DATA_TYPE_ALLOWED: Record<string, string[]> = {
  section: ['object'],
  group: ['object'],
  event: ['object'],
  event_series: ['array'],
  block: ['object'],
  field: VALID_DATA_TYPES.filter((type) => !['object', 'array'].includes(type))
};

// ============= Node Validation =============

function validateNode(node: SemanticNode, allNodes: SemanticNode[]): (ValidationError | ValidationWarning)[] {
  const issues: (ValidationError | ValidationWarning)[] = [];
  const nodeId = node.nodeId;

  // Required fields
  if (!node.nodeId) {
    issues.push({
      code: ValidationCodes.DUPLICATE_NODE_ID,
      message: 'Node is missing nodeId',
      severity: 'error'
    });
  }

  if (!node.name || node.name.trim() === '') {
    issues.push({
      code: ValidationCodes.MISSING_NAME,
      message: 'Node is missing name',
      nodeId,
      severity: 'error'
    });
  }

  if (!node.attribute || node.attribute.trim() === '') {
    issues.push({
      code: ValidationCodes.MISSING_ATTRIBUTE,
      message: 'Node is missing attribute',
      nodeId,
      severity: 'error'
    });
  }

  // Validate role
  if (!node.role || !VALID_ROLES.includes(node.role)) {
    issues.push({
      code: ValidationCodes.INVALID_ROLE,
      message: `Invalid role "${node.role}". Must be one of: ${VALID_ROLES.join(', ')}`,
      nodeId,
      severity: 'error'
    });
  }

  // Validate dataType (required except for block references)
  if (node.role !== 'block') {
    if (node.dataType && !VALID_DATA_TYPES.includes(node.dataType)) {
      issues.push({
        code: ValidationCodes.INVALID_DATA_TYPE,
        message: `Invalid dataType "${node.dataType}". Must be one of: ${VALID_DATA_TYPES.join(', ')}`,
        nodeId,
        severity: 'error'
      });
    }

    if (node.role === 'field' && !node.dataType) {
      issues.push({
        code: ValidationCodes.FIELD_NO_DATA_TYPE,
        message: 'Field node should have a dataType',
        nodeId,
        severity: 'warning'
      });
    }
  }

  if (node.role && node.dataType && ROLE_DATA_TYPE_ALLOWED[node.role] && !ROLE_DATA_TYPE_ALLOWED[node.role].includes(node.dataType)) {
    issues.push({
      code: ValidationCodes.INVALID_ROLE_DATA_TYPE,
      message: `Role "${node.role}" does not allow dataType "${node.dataType}"`,
      nodeId,
      severity: 'error'
    });
  }

  // Validate occurrences
  if (node.occurrences) {
    const { min, max } = node.occurrences;

    if (typeof min !== 'number' || min < 0) {
      issues.push({
        code: ValidationCodes.INVALID_OCCURRENCES,
        message: 'occurrences.min must be a number >= 0',
        nodeId,
        severity: 'error'
      });
    }

    if (max !== '*' && (typeof max !== 'number' || max < 0)) {
      issues.push({
        code: ValidationCodes.INVALID_OCCURRENCES,
        message: 'occurrences.max must be "*" or a number >= 0',
        nodeId,
        severity: 'error'
      });
    }

    if (typeof max === 'number' && max < min) {
      issues.push({
        code: ValidationCodes.INVALID_OCCURRENCES,
        message: `occurrences.max (${max}) must be >= min (${min})`,
        nodeId,
        severity: 'error'
      });
    }
  }

  // Validate timeRole (only for date/datetime)
  if (node.timeRole) {
    if (!VALID_TIME_ROLES.includes(node.timeRole)) {
      issues.push({
        code: ValidationCodes.INVALID_TIME_ROLE,
        message: `Invalid timeRole "${node.timeRole}". Must be one of: ${VALID_TIME_ROLES.join(', ')}`,
        nodeId,
        severity: 'error'
      });
    }

    if (node.dataType !== 'date' && node.dataType !== 'time' && node.dataType !== 'datetime') {
      issues.push({
        code: ValidationCodes.INVALID_TIME_ROLE,
        message: 'timeRole can only be set on date, time, or datetime fields',
        nodeId,
        severity: 'error'
      });
    }
  }

  // Validate block reference nodes (role === 'block')
  if (node.role === 'block') {
    if (!node.blockId) {
      issues.push({
        code: ValidationCodes.BLOCK_MISSING_ID,
        message: 'Block node must have blockId',
        nodeId,
        severity: 'error'
      });
    }

    if (!node.versionRange) {
      issues.push({
        code: ValidationCodes.BLOCK_MISSING_VERSION_RANGE,
        message: 'Block node must have versionRange',
        nodeId,
        severity: 'error'
      });
    } else if (!isValidVersionRange(node.versionRange)) {
      issues.push({
        code: ValidationCodes.BLOCK_INVALID_VERSION_RANGE,
        message: `Invalid versionRange "${node.versionRange}". Use semver (1.0.0), caret (^1.0), or tilde (~1.0.0)`,
        nodeId,
        severity: 'error'
      });
    }
  }

  // Validate event has timestamp
  if (node.role === 'event') {
    const children = allNodes.filter(n => n.parentNodeId === node.nodeId);
    const hasTimestamp = children.some(c => c.timeRole === 'timestamp');
    const hasInterval = children.some(c => c.timeRole === 'interval_start') &&
                        children.some(c => c.timeRole === 'interval_end');

    if (!hasTimestamp && !hasInterval) {
      issues.push({
        code: ValidationCodes.EVENT_NO_TIMESTAMP,
        message: 'Event node should have a child with timeRole=timestamp or an interval pair (interval_start + interval_end)',
        nodeId,
        severity: 'warning'
      });
    }
  }

  return issues;
}

// ============= Tree Structure Validation =============

function validateTreeStructure(nodes: SemanticNode[]): (ValidationError | ValidationWarning)[] {
  const issues: (ValidationError | ValidationWarning)[] = [];

  // Check for exactly one root
  const roots = nodes.filter(n => n.parentNodeId === null);
  if (roots.length === 0) {
    issues.push({
      code: ValidationCodes.NO_ROOT,
      message: 'No root node found (parentNodeId = null)',
      severity: 'error'
    });
  } else if (roots.length > 1) {
    issues.push({
      code: ValidationCodes.MULTIPLE_ROOTS,
      message: `Found ${roots.length} root nodes, expected exactly 1`,
      severity: 'error'
    });
  }

  // Check for unique nodeIds
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.nodeId)) {
      issues.push({
        code: ValidationCodes.DUPLICATE_NODE_ID,
        message: `Duplicate nodeId: ${node.nodeId}`,
        nodeId: node.nodeId,
        severity: 'error'
      });
    }
    nodeIds.add(node.nodeId);
  }

  // Check for orphan nodes
  const nodeIdSet = new Set(nodes.map(n => n.nodeId));
  for (const node of nodes) {
    if (node.parentNodeId !== null && !nodeIdSet.has(node.parentNodeId)) {
      issues.push({
        code: ValidationCodes.ORPHAN_NODE,
        message: `Node references non-existent parent: ${node.parentNodeId}`,
        nodeId: node.nodeId,
        severity: 'error'
      });
    }
  }

  // Check for circular references
  for (const node of nodes) {
    const visited = new Set<string>();
    let current: SemanticNode | undefined = node;

    while (current && current.parentNodeId !== null) {
      if (visited.has(current.nodeId)) {
        issues.push({
          code: ValidationCodes.CIRCULAR_REFERENCE,
          message: 'Circular parent reference detected',
          nodeId: node.nodeId,
          severity: 'error'
        });
        break;
      }
      visited.add(current.nodeId);
      current = nodes.find(n => n.nodeId === current!.parentNodeId);
    }
  }

  return issues;
}

// ============= SemanticObject Validation =============

/**
 * Validate a SemanticObject (co/1 schema)
 */
export function validateSemanticObject(obj: SemanticObject | any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Schema validation (object format: { version: "co/1", pathDialect: "coql/v1" })
  if (obj.schema) {
    if (typeof obj.schema === 'object') {
      if (obj.schema.version !== CO_SCHEMA_VERSION) {
        errors.push({
          code: ValidationCodes.INVALID_SCHEMA,
          message: `Invalid schema version "${obj.schema.version}". Expected "${CO_SCHEMA_VERSION}"`,
          severity: 'error'
        });
      }
      if (obj.schema.pathDialect && obj.schema.pathDialect !== PATH_DIALECT) {
        warnings.push({
          code: ValidationCodes.INVALID_SCHEMA,
          message: `Unexpected pathDialect "${obj.schema.pathDialect}". Expected "${PATH_DIALECT}"`,
          severity: 'warning'
        });
      }
    }
    // Allow string format for backwards compatibility
  }

  // Required fields
  if (!obj.id) {
    errors.push({
      code: ValidationCodes.MISSING_ID,
      message: 'SemanticObject must have an id',
      severity: 'error'
    });
  }

  if (!obj.name) {
    errors.push({
      code: ValidationCodes.MISSING_NAME,
      message: 'SemanticObject must have a name',
      severity: 'error'
    });
  }

  if (!obj.version) {
    errors.push({
      code: ValidationCodes.MISSING_VERSION,
      message: 'SemanticObject must have a version',
      severity: 'error'
    });
  } else if (!isValidSemver(obj.version)) {
    errors.push({
      code: ValidationCodes.INVALID_VERSION,
      message: `Invalid version "${obj.version}". Use semver format (x.y.z)`,
      severity: 'error'
    });
  }

  // Validate tree structure
  if (obj.nodes && Array.isArray(obj.nodes)) {
    const structureIssues = validateTreeStructure(obj.nodes);
    for (const issue of structureIssues) {
      if (issue.severity === 'error') {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }

    // Validate each node
    for (const node of obj.nodes) {
      const nodeIssues = validateNode(node, obj.nodes);
      for (const issue of nodeIssues) {
        if (issue.severity === 'error') {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Alias for compatibility
export const validateContextObject = validateSemanticObject;
export const validate = validateSemanticObject;

// ============= Helper Functions =============

function isValidSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function isValidVersionRange(range: string): boolean {
  // Exact version
  if (/^\d+\.\d+\.\d+$/.test(range)) return true;
  // Caret range: ^1.2.3 or ^1.2 or ^1
  if (/^\^(\d+)(\.\d+)?(\.\d+)?$/.test(range)) return true;
  // Tilde range: ~1.2.3 or ~1.2
  if (/^~(\d+)\.(\d+)(\.\d+)?$/.test(range)) return true;
  return false;
}

// ============= Node Tree Utilities =============

/**
 * Sync childrenNodeIds from parentNodeId references.
 * Rebuilds the children arrays based on parent pointers.
 */
export function syncChildrenNodeIds(nodes: SemanticNode[]): SemanticNode[] {
  const childrenMap = new Map<string, string[]>();

  // Initialize empty arrays for all nodes
  for (const node of nodes) {
    childrenMap.set(node.nodeId, []);
  }

  // Build children arrays from parent references
  for (const node of nodes) {
    if (node.parentNodeId) {
      const siblings = childrenMap.get(node.parentNodeId);
      if (siblings) {
        siblings.push(node.nodeId);
      }
    }
  }

  // Return nodes with updated childrenNodeIds
  return nodes.map(node => ({
    ...node,
    childrenNodeIds: childrenMap.get(node.nodeId) || []
  }));
}

/**
 * Get all descendant nodeIds of a given node
 */
export function getDescendantIds(nodeId: string, nodes: SemanticNode[]): string[] {
  const descendants: string[] = [];

  function collectDescendants(id: string) {
    for (const node of nodes) {
      if (node.parentNodeId === id) {
        descendants.push(node.nodeId);
        collectDescendants(node.nodeId);
      }
    }
  }

  collectDescendants(nodeId);
  return descendants;
}

/**
 * Extract a subtree starting from a given node
 */
export function extractSubtree(rootNodeId: string, nodes: SemanticNode[]): SemanticNode[] {
  const descendantIds = new Set([rootNodeId, ...getDescendantIds(rootNodeId, nodes)]);
  return nodes.filter(n => descendantIds.has(n.nodeId));
}

/**
 * Build a Map of nodeId -> SemanticNode for quick lookups
 */
export function buildNodeMap(nodes: SemanticNode[]): Map<string, SemanticNode> {
  return new Map(nodes.map(n => [n.nodeId, n]));
}
