// JSON Schema Generator - Convert SemanticObject to JSON Schema

import {
  SemanticObject,
  SemanticNode,
  NodeDataType
} from './types';
import { getChildNodes } from './utils';

// ============= Data Type Mapping =============

/**
 * Map SemanticNode dataType to JSON Schema type
 */
function mapDataTypeToJsonSchema(dataType: NodeDataType): any {
  switch (dataType) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return { type: 'number' };
    case 'integer':
      return { type: 'integer' };
    case 'boolean':
      return { type: 'boolean' };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'time':
      return { type: 'string', format: 'time' };
    case 'datetime':
      return { type: 'string', format: 'date-time' };
    case 'duration':
      return { type: 'string', format: 'duration' };
    case 'object':
      return { type: 'object' };
    case 'array':
      return { type: 'array' };
    case 'code':
    case 'coded_text':
    case 'identifier':
      // Code is represented as a string with optional enum
      return { type: 'string' };
    case 'quantity':
      // Quantity maps to number (could be extended with units)
      return { type: 'number' };
    case 'reference':
    case 'uri':
      // Reference is typically a string (ID or URI)
      return { type: 'string', format: 'uri' };
    case 'interval':
      return {
        type: 'object',
        properties: {
          lower: { type: 'string' },
          upper: { type: 'string' }
        }
      };
    default:
      return { type: 'string' };
  }
}

/**
 * Apply constraints to JSON Schema property
 */
function applyConstraints(schema: any, node: SemanticNode): any {
  if (!node.constraints) return schema;

  const result = { ...schema };

  if (node.constraints.pattern) {
    result.pattern = node.constraints.pattern;
  }

  if (node.constraints.allowedValues && node.constraints.allowedValues.length > 0) {
    result.enum = node.constraints.allowedValues;
  }

  if (node.constraints.minValue !== undefined) {
    result.minimum = node.constraints.minValue;
  }

  if (node.constraints.maxValue !== undefined) {
    result.maximum = node.constraints.maxValue;
  }

  if (node.constraints.minLength !== undefined) {
    result.minLength = node.constraints.minLength;
  }

  if (node.constraints.maxLength !== undefined) {
    result.maxLength = node.constraints.maxLength;
  }

  if (node.constraints.fixedValue !== undefined) {
    result.const = node.constraints.fixedValue;
  }

  return result;
}

// ============= Schema Generation =============

/**
 * Optional resolver for referenced SemanticObjects
 * Used to inline schemas from building blocks
 */
export type SemanticObjectResolver = (objectId: string) => SemanticObject | null;

/**
 * Build JSON Schema for a single node (recursive)
 */
function buildNodeSchema(
  node: SemanticNode,
  allNodes: SemanticNode[],
  resolver?: SemanticObjectResolver
): any {
  // Handle referencedObjectId (inline the referenced object's schema)
  if (node.referencedObjectId && resolver) {
    const referencedObject = resolver(node.referencedObjectId);
    if (referencedObject) {
      // Generate schema from referenced object
      const refSchema = semanticObjectToJsonSchema(referencedObject, resolver);

      // Override with local node properties (name, description, etc.)
      if (node.name) {
        refSchema.title = node.name;
      }
      if (node.description) {
        refSchema.description = node.description;
      }

      // Add reference metadata
      refSchema['x-referenced-object-id'] = node.referencedObjectId;

      return refSchema;
    }
  }

  // Get base schema from data type
  let schema = node.dataType
    ? mapDataTypeToJsonSchema(node.dataType)
    : { type: 'object' };

  // Add description if present
  if (node.description) {
    schema.description = node.description;
  }

  // Add title (node name)
  schema.title = node.name;

  // Apply constraints
  schema = applyConstraints(schema, node);

  // Handle complex types (groups, sections, objects)
  if (
    node.role === 'group' ||
    node.role === 'section' ||
    node.dataType === 'object' ||
    node.childrenNodeIds.length > 0
  ) {
    schema.type = 'object';
    schema.properties = {};
    const requiredFields: string[] = [];

    const children = getChildNodes(node.nodeId, allNodes);

    for (const child of children) {
      // Build child schema
      let childSchema = buildNodeSchema(child, allNodes, resolver);

      // Handle arrays (max > 1 or max = "*")
      if (
        child.occurrences.max === '*' ||
        (typeof child.occurrences.max === 'number' && child.occurrences.max > 1)
      ) {
        // Wrap in array
        childSchema = {
          type: 'array',
          items: childSchema,
          minItems: child.occurrences.min
        };

        if (child.occurrences.max !== '*') {
          childSchema.maxItems = child.occurrences.max;
        }
      }

      schema.properties[child.attribute] = childSchema;

      // Track required fields
      if (
        child.occurrences.min >= 1 ||
        child.constraints?.required === true
      ) {
        requiredFields.push(child.attribute);
      }
    }

    if (requiredFields.length > 0) {
      schema.required = requiredFields;
    }
  }

  // Handle event_series (array of events)
  if (node.role === 'event_series') {
    schema.type = 'array';
    schema.items = {
      type: 'object',
      properties: {}
    };

    const children = getChildNodes(node.nodeId, allNodes);
    const requiredFields: string[] = [];

    for (const child of children) {
      const childSchema = buildNodeSchema(child, allNodes, resolver);
      schema.items.properties[child.attribute] = childSchema;

      if (child.occurrences.min >= 1) {
        requiredFields.push(child.attribute);
      }
    }

    if (requiredFields.length > 0) {
      schema.items.required = requiredFields;
    }

    if (node.occurrences.min > 0) {
      schema.minItems = node.occurrences.min;
    }
  }

  return schema;
}

/**
 * Generate complete JSON Schema from SemanticObject
 */
export function semanticObjectToJsonSchema(
  obj: SemanticObject,
  resolver?: SemanticObjectResolver
): any {
  // Find root node
  const rootNode = obj.nodes.find(n => n.parentNodeId === null);

  if (!rootNode) {
    // Return empty schema if no root
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: obj.name,
      description: obj.description || '',
      type: 'object',
      properties: {}
    };
  }

  // Build schema from root
  const schema = buildNodeSchema(rootNode, obj.nodes, resolver);

  // Add schema metadata
  schema.$schema = 'http://json-schema.org/draft-07/schema#';
  schema.title = obj.name;

  if (obj.description) {
    schema.description = obj.description;
  }

  // Add custom extensions for semantic info (optional)
  schema['x-semantic-object-id'] = obj.id;
  schema['x-semantic-object-version'] = obj.version;

  return schema;
}

/**
 * Generate a simplified schema summary (for display)
 */
export function generateSchemaSummary(obj: SemanticObject): string {
  const lines: string[] = [];

  const renderNode = (nodeId: string, depth: number = 0) => {
    const node = obj.nodes.find(n => n.nodeId === nodeId);
    if (!node) return;

    const indent = '  '.repeat(depth);
    const typeStr = node.dataType || 'object';
    const cardStr = node.occurrences.max === '*'
      ? `${node.occurrences.min}..*`
      : `${node.occurrences.min}..${node.occurrences.max}`;

    lines.push(`${indent}- ${node.name} (${node.attribute}: ${typeStr}) [${cardStr}]`);

    // Render children
    for (const childId of node.childrenNodeIds) {
      renderNode(childId, depth + 1);
    }
  };

  const root = obj.nodes.find(n => n.parentNodeId === null);
  if (root) {
    renderNode(root.nodeId, 0);
  }

  return lines.join('\n');
}

/**
 * Count total fields in SemanticObject
 */
export function countFields(obj: SemanticObject): number {
  return obj.nodes.filter(n => n.role === 'field').length;
}

/**
 * Get all leaf nodes (fields without children)
 */
export function getLeafNodes(obj: SemanticObject): SemanticNode[] {
  return obj.nodes.filter(n => n.childrenNodeIds.length === 0);
}

/**
 * Get depth of the deepest node
 */
export function getMaxDepth(obj: SemanticObject): number {
  let maxDepth = 0;

  const nodeMap = new Map(obj.nodes.map(n => [n.nodeId, n]));

  const getDepth = (nodeId: string): number => {
    const node = nodeMap.get(nodeId);
    if (!node || !node.parentNodeId) return 0;

    return 1 + getDepth(node.parentNodeId);
  };

  for (const node of obj.nodes) {
    const depth = getDepth(node.nodeId);
    if (depth > maxDepth) {
      maxDepth = depth;
    }
  }

  return maxDepth;
}
