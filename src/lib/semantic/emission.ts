// ContextObjects - Stage-2 Emission Logic
//
// This is STAGE-2 runtime logic for generating context crumbs.
// It is NOT part of the CO definition layer (Stage-1).
//
// The clean CO v1 spec has NO emit fields on nodes or objects.
// Emission policy is determined at runtime based on data types.
//
// Controls which nodes emit context crumbs (p/v pairs) for search/joins.
// Emission is used to generate the `contextNodes` array in ContextObject instances.

import {
  SemanticObject,
  SemanticNode,
  NodeDataType
} from './types';
import { computeCoqlPath, buildNodeMap } from './path-utils';

// ============= Stage-2 Types =============

/**
 * Context crumb - a path/value pair for indexing
 */
export interface ContextCrumb {
  p: string;  // COQL path
  v: string | number | boolean;  // Value
}

/**
 * Emission policy (Stage-2 runtime, not in CO definitions)
 */
export type EmissionPolicy = 'auto' | 'always' | 'never';

// ============= Emission Configuration =============

/**
 * Data types that emit by default under 'auto' policy
 */
const AUTO_EMIT_TYPES: NodeDataType[] = ['code', 'coded_text', 'reference', 'identifier', 'uri', 'date', 'time', 'datetime'];

/**
 * Roles that should never emit (containers)
 */
const NEVER_EMIT_ROLES = ['section', 'group', 'event_series'];

// ============= Emission Logic =============

/**
 * Determine if a node should emit based on its data type
 *
 * Note: Clean CO v1 spec has no emit field on nodes.
 * This function determines emission purely from data type.
 */
export function shouldEmitNode(
  node: SemanticNode,
  policy: EmissionPolicy = 'auto'
): boolean {
  // Never emit container roles
  if (NEVER_EMIT_ROLES.includes(node.role)) {
    return false;
  }

  // Block references don't emit directly (their expanded content does)
  if (node.role === 'block') {
    return false;
  }

  // Apply policy
  switch (policy) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'auto':
    default:
      // Auto: emit for code, reference, and date types
      return node.dataType ? AUTO_EMIT_TYPES.includes(node.dataType) : false;
  }
}

/**
 * Get all nodes that should emit from a SemanticObject
 */
export function getEmittingNodes(
  obj: SemanticObject,
  policy: EmissionPolicy = 'auto'
): SemanticNode[] {
  return obj.nodes.filter(node => shouldEmitNode(node, policy));
}

/**
 * Build context crumbs from a SemanticObject definition and instance data
 *
 * @param obj - The SemanticObject definition
 * @param data - The instance data conforming to the SemanticObject's structure
 * @param policy - Emission policy (default: 'auto')
 * @returns Array of ContextCrumb objects { p, v }
 */
export function buildContextCrumbs(
  obj: SemanticObject,
  data: any,
  policy: EmissionPolicy = 'auto'
): ContextCrumb[] {
  const crumbs: ContextCrumb[] = [];
  const nodeMap = buildNodeMap(obj.nodes);

  // Find root node
  const rootNode = obj.nodes.find(n => n.parentNodeId === null);
  if (!rootNode) {
    return crumbs;
  }

  // Recursive function to walk the tree and extract values
  function walkNode(node: SemanticNode, currentData: any, currentPath: string[]): void {
    if (currentData === undefined || currentData === null) {
      return;
    }

    // Check if this node should emit
    if (shouldEmitNode(node, policy)) {
      const value = extractValue(currentData, node);
      if (value !== undefined && value !== null && value !== '') {
        const coqlPath = '/' + currentPath.join('/');
        crumbs.push({ p: coqlPath, v: value });
      }
    }

    // Recursively process children
    const childrenIds = node.childrenNodeIds || [];
    for (const childId of childrenIds) {
      const childNode = nodeMap.get(childId);
      if (!childNode) continue;

      const childData = currentData[childNode.attribute];
      const childPath = [...currentPath, childNode.attribute];

      // Handle arrays
      if (Array.isArray(childData)) {
        childData.forEach((item) => {
          walkNode(childNode, item, childPath);
        });
      } else {
        walkNode(childNode, childData, childPath);
      }
    }
  }

  // Start walking from root
  const rootData = data[rootNode.attribute] !== undefined ? data[rootNode.attribute] : data;
  walkNode(rootNode, rootData, [rootNode.attribute]);

  return crumbs;
}

/**
 * Extract the value from data for a specific node
 */
function extractValue(data: any, node: SemanticNode): string | number | boolean | undefined {
  if (typeof data !== 'object' || data === null) {
    // Data is already a primitive
    return coerceValue(data, node.dataType);
  }

  // Data is an object, this shouldn't happen for leaf nodes
  // But handle gracefully
  return undefined;
}

/**
 * Coerce a value to the appropriate type for emission
 */
function coerceValue(value: any, dataType?: NodeDataType): string | number | boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  switch (dataType) {
    case 'boolean':
      return Boolean(value);
    case 'number':
    case 'integer':
    case 'quantity':
      const num = Number(value);
      return isNaN(num) ? String(value) : num;
    case 'date':
    case 'time':
    case 'datetime':
    case 'string':
    case 'code':
    case 'coded_text':
    case 'identifier':
    case 'reference':
    case 'uri':
    case 'duration':
    case 'interval':
    default:
      return String(value);
  }
}

// ============= Emission Preview =============

/**
 * Preview what paths would emit for a SemanticObject (without data)
 * Useful for UI to show which fields will be indexed
 */
export function previewEmissionPaths(
  obj: SemanticObject,
  policy: EmissionPolicy = 'auto'
): {
  path: string;
  nodeId: string;
  name: string;
  dataType?: NodeDataType;
}[] {
  return obj.nodes
    .filter(node => shouldEmitNode(node, policy))
    .map(node => ({
      path: computeCoqlPath(node.nodeId, obj.nodes),
      nodeId: node.nodeId,
      name: node.name,
      dataType: node.dataType
    }));
}

/**
 * Get emission statistics for a SemanticObject
 */
export function getEmissionStats(
  obj: SemanticObject,
  policy: EmissionPolicy = 'auto'
): {
  totalNodes: number;
  emittingNodes: number;
  byDataType: Record<string, number>;
} {
  const emitting = obj.nodes.filter(n => shouldEmitNode(n, policy));

  const byDataType: Record<string, number> = {};
  emitting.forEach(n => {
    const type = n.dataType || 'unknown';
    byDataType[type] = (byDataType[type] || 0) + 1;
  });

  return {
    totalNodes: obj.nodes.length,
    emittingNodes: emitting.length,
    byDataType
  };
}
