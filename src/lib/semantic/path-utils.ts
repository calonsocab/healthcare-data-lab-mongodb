// Path Computation Utilities for ContextObjects Builder
//
// COQL Dialect (coql/v1):
// - Separator: '/'
// - Arrays: literal segment name repeated, index optional: analytes[0]
// - Wildcard: '*'
// - Predicates (optional future): analytes[*].value
//
// Path types:
// 1. COQL Path (primary): /labPanel/events/event/eventTime
// 2. COQL+IDs (debug/lineage): /labPanel[n-56...]/events[n-3y6...]/event[n-org...]/eventTime[n-qak...]
//
// External bindings (FHIR, openEHR) are metadata, not first-class paths - computed on export.

import { SemanticNode, Block, ContextObject } from './types';

/**
 * Build a map of nodeId -> node for efficient lookups
 */
export function buildNodeMap(nodes: SemanticNode[]): Map<string, SemanticNode> {
  return new Map(nodes.map(node => [node.nodeId, node]));
}

// ============= COQL Path Functions =============

/**
 * Compute COQL path for a node (primary path format)
 * Format: /attribute/childAttribute/... (no nodeIds)
 *
 * This is the PRIMARY path format for queries and UI display.
 * Dialect: coql/v1
 *
 * @example /labPanel/events/event/value
 */
export function computeCoqlPath(node: SemanticNode, nodeMap: Map<string, SemanticNode>): string {
  // Root node
  if (!node.parentNodeId) {
    return `/${node.attribute}`;
  }

  // Get parent
  const parent = nodeMap.get(node.parentNodeId);
  if (!parent) {
    throw new Error(`Parent node ${node.parentNodeId} not found`);
  }

  // Recursive: build parent path first
  const parentPath = computeCoqlPath(parent, nodeMap);
  return `${parentPath}/${node.attribute}`;
}

/**
 * Compute COQL+IDs path for a node (debug/lineage path)
 * Format: /attribute[nodeId]/childAttribute[nodeId]/...
 *
 * This path includes node IDs for debugging and lineage tracking.
 *
 * @example /labPanel[n-56jsbpfp1]/events[n-3y6vr2se3]/event[n-orgn8pxpu]
 */
export function computeCanonicalPath(node: SemanticNode, nodeMap: Map<string, SemanticNode>): string {
  // Root node
  if (!node.parentNodeId) {
    return `/${node.attribute}[${node.nodeId}]`;
  }

  // Get parent
  const parent = nodeMap.get(node.parentNodeId);
  if (!parent) {
    throw new Error(`Parent node ${node.parentNodeId} not found`);
  }

  // Recursive: build parent path first
  const parentPath = computeCanonicalPath(parent, nodeMap);
  return `${parentPath}/${node.attribute}[${node.nodeId}]`;
}

/**
 * Compute COQL path by nodeId (convenience wrapper)
 */
export function computeCoqlPathById(nodeId: string, nodes: SemanticNode[]): string {
  const nodeMap = buildNodeMap(nodes);
  const node = nodeMap.get(nodeId);
  if (!node) return '';
  return computeCoqlPath(node, nodeMap);
}

/**
 * Compute canonical path by nodeId (convenience wrapper)
 */
export function computeCanonicalPathById(nodeId: string, nodes: SemanticNode[]): string {
  const nodeMap = buildNodeMap(nodes);
  const node = nodeMap.get(nodeId);
  if (!node) return '';
  return computeCanonicalPath(node, nodeMap);
}

// ============= Path Computation for All Nodes =============

/**
 * Compute both path types for a single node
 */
export function computeNodePaths(node: SemanticNode, nodeMap: Map<string, SemanticNode>): {
  coqlPath: string;
  canonicalPath: string;
} {
  return {
    coqlPath: computeCoqlPath(node, nodeMap),
    canonicalPath: computeCanonicalPath(node, nodeMap)
  };
}

/**
 * Compute all paths for all nodes in a definition
 * Returns a Map of nodeId -> paths
 */
export function computeAllPaths(nodes: SemanticNode[]): Map<string, { coqlPath: string; canonicalPath: string }> {
  const nodeMap = buildNodeMap(nodes);
  const pathsMap = new Map<string, { coqlPath: string; canonicalPath: string }>();

  for (const node of nodes) {
    try {
      pathsMap.set(node.nodeId, computeNodePaths(node, nodeMap));
    } catch {
      // If path computation fails, set empty paths
      pathsMap.set(node.nodeId, { coqlPath: '', canonicalPath: '' });
    }
  }

  return pathsMap;
}

/**
 * Attach computed paths to nodes (for UI display)
 * Returns new array with paths attached
 */
export function attachPathsToNodes(nodes: SemanticNode[]): (SemanticNode & { coqlPath: string; canonicalPath: string })[] {
  const pathsMap = computeAllPaths(nodes);

  return nodes.map(node => {
    const paths = pathsMap.get(node.nodeId) || { coqlPath: '', canonicalPath: '' };
    return { ...node, ...paths };
  });
}

// ============= Tree Navigation =============

/**
 * Get depth of a node in the tree (0 = root)
 */
export function computeNodeDepth(node: SemanticNode, nodeMap: Map<string, SemanticNode>): number {
  if (!node.parentNodeId) return 0;

  const parent = nodeMap.get(node.parentNodeId);
  if (!parent) return 0;

  return 1 + computeNodeDepth(parent, nodeMap);
}

/**
 * Get the root node
 */
export function findRootNode(nodes: SemanticNode[]): SemanticNode | null {
  return nodes.find(n => n.parentNodeId === null) || null;
}

/**
 * Get direct children of a node
 */
export function getDirectChildren(nodeId: string, nodes: SemanticNode[]): SemanticNode[] {
  return nodes.filter(n => n.parentNodeId === nodeId);
}

/**
 * Get siblings of a node (excluding the node itself)
 */
export function getSiblings(nodeId: string, nodes: SemanticNode[]): SemanticNode[] {
  const node = nodes.find(n => n.nodeId === nodeId);
  if (!node || !node.parentNodeId) return [];

  return nodes.filter(n => n.parentNodeId === node.parentNodeId && n.nodeId !== nodeId);
}

/**
 * Get ancestors of a node (from parent to root)
 */
export function getAncestors(nodeId: string, nodes: SemanticNode[]): SemanticNode[] {
  const nodeMap = buildNodeMap(nodes);
  const node = nodeMap.get(nodeId);
  if (!node || !node.parentNodeId) return [];

  const ancestors: SemanticNode[] = [];
  let current = nodeMap.get(node.parentNodeId);

  while (current) {
    ancestors.push(current);
    current = current.parentNodeId ? nodeMap.get(current.parentNodeId) : undefined;
  }

  return ancestors;
}

/**
 * Get all descendants of a node (recursive)
 */
export function getDescendants(nodeId: string, nodes: SemanticNode[]): SemanticNode[] {
  const descendants: SemanticNode[] = [];

  function collect(id: string) {
    const children = nodes.filter(n => n.parentNodeId === id);
    for (const child of children) {
      descendants.push(child);
      collect(child.nodeId);
    }
  }

  collect(nodeId);
  return descendants;
}

// ============= Path Search =============

/**
 * Find a node by its COQL path
 */
export function findNodeByCoqlPath(coqlPath: string, nodes: SemanticNode[]): SemanticNode | null {
  const nodeMap = buildNodeMap(nodes);

  for (const node of nodes) {
    try {
      if (computeCoqlPath(node, nodeMap) === coqlPath) {
        return node;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Find a node by its canonical path
 */
export function findNodeByCanonicalPath(canonicalPath: string, nodes: SemanticNode[]): SemanticNode | null {
  const nodeMap = buildNodeMap(nodes);

  for (const node of nodes) {
    try {
      if (computeCanonicalPath(node, nodeMap) === canonicalPath) {
        return node;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Parse a COQL path into segments
 * @example "/labPanel/events/event" => ["labPanel", "events", "event"]
 */
export function parseCoqlPath(path: string): string[] {
  if (!path || path === '/') return [];
  return path.split('/').filter(s => s.length > 0);
}

/**
 * Build a COQL path from segments
 * @example ["labPanel", "events", "event"] => "/labPanel/events/event"
 */
export function buildCoqlPath(segments: string[]): string {
  if (segments.length === 0) return '/';
  return '/' + segments.join('/');
}

// ============= Block Path Utilities =============

/**
 * Re-root block nodes when inserting into a parent context
 * Updates parent references and generates new nodeIds to avoid conflicts
 */
export function rebaseBlockNodes(
  blockNodes: SemanticNode[],
  newParentId: string,
  generateNewId: () => string
): SemanticNode[] {
  // Create ID mapping: old nodeId -> new nodeId
  const idMap = new Map<string, string>();

  // First pass: generate new IDs for all nodes
  for (const node of blockNodes) {
    idMap.set(node.nodeId, generateNewId());
  }

  // Find the block's root node
  const blockRoot = blockNodes.find(n => n.parentNodeId === null);

  // Second pass: remap parent references
  return blockNodes.map(node => {
    const newNodeId = idMap.get(node.nodeId)!;

    // Determine new parent
    let newParentNodeId: string | null;
    if (node.nodeId === blockRoot?.nodeId) {
      // Block root's new parent is the insertion point
      newParentNodeId = newParentId;
    } else if (node.parentNodeId) {
      // Other nodes: map to new parent ID
      newParentNodeId = idMap.get(node.parentNodeId) || null;
    } else {
      newParentNodeId = null;
    }

    return {
      ...node,
      nodeId: newNodeId,
      parentNodeId: newParentNodeId
    };
  });
}

// ============= Utilities =============

/**
 * Check if a path matches a pattern (supports * wildcard)
 * @example matchPath("/events/event/*", "/events/event/value") => true
 */
export function matchPath(pattern: string, path: string): boolean {
  const patternParts = parseCoqlPath(pattern);
  const pathParts = parseCoqlPath(path);

  if (patternParts.length !== pathParts.length) return false;

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] !== '*' && patternParts[i] !== pathParts[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Get all paths matching a pattern
 */
export function findPathsMatching(pattern: string, nodes: SemanticNode[]): SemanticNode[] {
  const nodeMap = buildNodeMap(nodes);

  return nodes.filter(node => {
    try {
      const path = computeCoqlPath(node, nodeMap);
      return matchPath(pattern, path);
    } catch {
      return false;
    }
  });
}
