// JSON Schema Generator - JavaScript version for API routes

import { getChildNodes } from './utils.js';

// ============= Data Type Mapping =============

function mapDataTypeToJsonSchema(dataType) {
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
      return { type: 'string' };
    case 'quantity':
      return { type: 'number' };
    case 'reference':
    case 'uri':
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

function applyConstraints(schema, node) {
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

function buildNodeSchema(node, allNodes) {
  let schema = node.dataType
    ? mapDataTypeToJsonSchema(node.dataType)
    : { type: 'object' };

  if (node.description) {
    schema.description = node.description;
  }

  schema.title = node.name;
  schema = applyConstraints(schema, node);

  if (
    node.role === 'group' ||
    node.role === 'section' ||
    node.dataType === 'object' ||
    node.childrenNodeIds.length > 0
  ) {
    schema.type = 'object';
    schema.properties = {};
    const requiredFields = [];

    const children = getChildNodes(node.nodeId, allNodes);

    for (const child of children) {
      let childSchema = buildNodeSchema(child, allNodes);

      if (
        child.occurrences.max === '*' ||
        (typeof child.occurrences.max === 'number' && child.occurrences.max > 1)
      ) {
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

  if (node.role === 'event_series') {
    schema.type = 'array';
    schema.items = {
      type: 'object',
      properties: {}
    };

    const children = getChildNodes(node.nodeId, allNodes);
    const requiredFields = [];

    for (const child of children) {
      const childSchema = buildNodeSchema(child, allNodes);
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

export function semanticObjectToJsonSchema(obj) {
  const rootNode = obj.nodes.find(n => n.parentNodeId === null);

  if (!rootNode) {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: obj.name,
      description: obj.description || '',
      type: 'object',
      properties: {}
    };
  }

  const schema = buildNodeSchema(rootNode, obj.nodes);

  schema.$schema = 'http://json-schema.org/draft-07/schema#';
  schema.title = obj.name;

  if (obj.description) {
    schema.description = obj.description;
  }

  schema['x-semantic-object-id'] = obj.id;
  schema['x-semantic-object-version'] = obj.version;

  return schema;
}

export function generateSchemaSummary(obj) {
  const lines = [];

  const renderNode = (nodeId, depth = 0) => {
    const node = obj.nodes.find(n => n.nodeId === nodeId);
    if (!node) return;

    const indent = '  '.repeat(depth);
    const typeStr = node.dataType || 'object';
    const cardStr = node.occurrences.max === '*'
      ? `${node.occurrences.min}..*`
      : `${node.occurrences.min}..${node.occurrences.max}`;

    lines.push(`${indent}- ${node.name} (${node.attribute}: ${typeStr}) [${cardStr}]`);

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
