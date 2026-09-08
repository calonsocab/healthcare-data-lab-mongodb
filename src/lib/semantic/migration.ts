// Migration Utilities - Convert existing JSON Schema to SemanticObject

import {
  SemanticObject,
  SemanticNode,
  NodeDataType
} from './types';
import {
  generateNodeId,
  generateSemanticObjectId,
  syncChildrenNodeIds
} from './utils';

// ============= JSON Schema to Data Type Mapping =============

/**
 * Map JSON Schema type to NodeDataType
 */
function mapJsonSchemaType(schemaType: any, format?: string): NodeDataType {
  if (typeof schemaType === 'string') {
    switch (schemaType) {
      case 'string':
        if (format === 'date') return 'date';
        if (format === 'time') return 'time';
        if (format === 'date-time') return 'datetime';
        if (format === 'duration') return 'duration';
        if (format === 'uri' || format === 'iri') return 'uri';
        if (format === 'uuid') return 'identifier';
        return 'string';
      case 'number':
        return 'number';
      case 'integer':
        return 'integer';
      case 'boolean':
        return 'boolean';
      case 'object':
        return 'object';
      case 'array':
        return 'array';
      default:
        return 'string';
    }
  }

  // Array of types - pick first valid one
  if (Array.isArray(schemaType)) {
    const nonNull = schemaType.find(t => t !== 'null');
    if (nonNull) {
      return mapJsonSchemaType(nonNull, format);
    }
  }

  return 'string';
}

/**
 * Detect if a property represents a "code" type (enum or coded value)
 */
function isCodeType(schema: any): boolean {
  return !!(
    schema.enum ||
    schema['x-code'] ||
    (schema.type === 'string' && schema.pattern?.includes('|'))
  );
}

/**
 * Detect if a property represents a "quantity" type
 */
function isQuantityType(schema: any, propertyName: string): boolean {
  const quantityPatterns = ['value', 'amount', 'quantity', 'measurement', 'result'];
  return (
    schema.type === 'number' &&
    quantityPatterns.some(pattern =>
      propertyName.toLowerCase().includes(pattern)
    )
  );
}

// ============= JSON Schema to SemanticObject Migration =============

interface MigrationContext {
  nodes: SemanticNode[];
  name: string;
}

/**
 * Convert a JSON Schema property to SemanticNode(s)
 */
function convertProperty(
  propertyName: string,
  schema: any,
  parentNode: SemanticNode,
  requiredFields: string[],
  context: MigrationContext
): void {
  const nodeId = generateNodeId();
  const isRequired = requiredFields.includes(propertyName);

  // Determine data type
  let dataType: NodeDataType = 'string';
  let role: 'field' | 'group' = 'field';

  if (schema.type === 'object' && schema.properties) {
    // Nested object - create group
    dataType = 'object';
    role = 'group';
  } else if (schema.type === 'array') {
    // Array type
    if (schema.items?.type === 'object' && schema.items.properties) {
      // Array of objects - create group with array cardinality
      dataType = 'object';
      role = 'group';
    } else {
      dataType = 'array';
    }
  } else if (isCodeType(schema)) {
    dataType = 'code';
  } else if (isQuantityType(schema, propertyName)) {
    dataType = 'quantity';
  } else {
    dataType = mapJsonSchemaType(schema.type, schema.format);
  }

  // Create the node
  const node: SemanticNode = {
    nodeId,
    parentNodeId: parentNode.nodeId,
    childrenNodeIds: [],
    role,
    name: schema.title || formatPropertyName(propertyName),
    attribute: propertyName,
    description: schema.description,
    dataType,
    occurrences: {
      min: isRequired ? 1 : 0,
      max: 1
    },
    constraints: {}
  };

  // Handle array cardinality
  if (schema.type === 'array') {
    node.occurrences.min = schema.minItems || 0;
    node.occurrences.max = schema.maxItems || '*';
  }

  // Apply constraints
  if (isRequired) {
    node.constraints!.required = true;
  }

  if (schema.pattern) {
    node.constraints!.pattern = schema.pattern;
  }

  if (schema.enum) {
    node.constraints!.allowedValues = schema.enum;
  }

  if (schema.minimum !== undefined) {
    node.constraints!.minValue = schema.minimum;
  }

  if (schema.maximum !== undefined) {
    node.constraints!.maxValue = schema.maximum;
  }

  if (schema.minLength !== undefined) {
    node.constraints!.minLength = schema.minLength;
  }

  if (schema.maxLength !== undefined) {
    node.constraints!.maxLength = schema.maxLength;
  }

  if (schema.const !== undefined) {
    node.constraints!.fixedValue = schema.const;
  }

  // Clean up empty constraints
  if (Object.keys(node.constraints!).length === 0) {
    delete node.constraints;
  }

  context.nodes.push(node);

  // Update parent's children list
  parentNode.childrenNodeIds.push(nodeId);

  // Process nested properties for objects
  if (schema.type === 'object' && schema.properties) {
    const nestedRequired = schema.required || [];
    for (const [nestedName, nestedSchema] of Object.entries(schema.properties)) {
      convertProperty(nestedName, nestedSchema, node, nestedRequired, context);
    }
  }

  // Process array items if they're objects
  if (schema.type === 'array' && schema.items?.type === 'object' && schema.items.properties) {
    const nestedRequired = schema.items.required || [];
    for (const [nestedName, nestedSchema] of Object.entries(schema.items.properties)) {
      convertProperty(nestedName, nestedSchema, node, nestedRequired, context);
    }
  }
}

/**
 * Convert property name to human-readable format
 * "testName" -> "Test Name"
 */
function formatPropertyName(name: string): string {
  return name
    // Insert space before uppercase letters
    .replace(/([A-Z])/g, ' $1')
    // Insert space before numbers
    .replace(/([0-9]+)/g, ' $1')
    // Capitalize first letter
    .replace(/^./, str => str.toUpperCase())
    // Trim extra spaces
    .trim();
}

/**
 * Migrate JSON Schema to SemanticObject
 */
export function jsonSchemaToSemanticObject(
  jsonSchema: any,
  options: {
    name?: string;
    description?: string;
    id?: string;
    scope?: 'building_block' | 'business_object' | 'technical';
  } = {}
): SemanticObject {
  const objectId = options.id || generateSemanticObjectId();
  const objectName = options.name || jsonSchema.title || 'Migrated Object';
  const objectDescription = options.description || jsonSchema.description || '';

  // Create root node
  const rootNodeId = generateNodeId();
  const rootNode: SemanticNode = {
    nodeId: rootNodeId,
    parentNodeId: null,
    childrenNodeIds: [],
    role: 'group',
    name: objectName,
    attribute: 'root',
    dataType: 'object',
    occurrences: { min: 1, max: 1 }
  };

  const context: MigrationContext = {
    nodes: [rootNode],
    name: objectName
  };

  // Process top-level properties
  if (jsonSchema.properties) {
    const requiredFields = jsonSchema.required || [];
    for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
      convertProperty(propName, propSchema, rootNode, requiredFields, context);
    }
  }

  // Create SemanticObject
  const semanticObject: SemanticObject = {
    id: objectId,
    name: objectName,
    description: objectDescription,
    scope: options.scope || 'business_object',
    origin: 'custom',
    version: '1.0.0',
    status: 'draft',
    nodes: context.nodes,
    jsonSchema, // Keep original for reference
    metadata: {
      tags: jsonSchema['x-tags'] || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };

  return semanticObject;
}

/**
 * Migrate existing DefinitionNode array to SemanticNode array
 * (For backward compatibility with current system)
 */
export function migrateDefinitionNodesToSemanticNodes(
  definitionNodes: any[]
): SemanticNode[] {
  if (!definitionNodes || definitionNodes.length === 0) {
    return [];
  }

  const semanticNodes: SemanticNode[] = definitionNodes.map(node => {
    // Map old dataType to new if needed
    let dataType: NodeDataType = node.dataType || 'string';

    // Determine role based on dataType and children
    let role: 'field' | 'group' = 'field';
    if (
      dataType === 'object' ||
      (node.childrenNodeIds && node.childrenNodeIds.length > 0)
    ) {
      role = 'group';
    }

    return {
      nodeId: node.nodeId,
      parentNodeId: node.parentNodeId,
      childrenNodeIds: node.childrenNodeIds || [],
      role,
      name: node.name,
      attribute: node.attribute,
      description: node.description,
      dataType,
      occurrences: node.occurrences || { min: 0, max: 1 },
      constraints: node.constraints || (
        node.occurrences?.min >= 1 ? { required: true } : undefined
      )
    };
  });

  return syncChildrenNodeIds(semanticNodes);
}

/**
 * Migrate ReusableDefinition to SemanticObject
 * (For existing definitions in the system)
 */
export function migrateReusableDefinitionToSemanticObject(
  definition: any
): SemanticObject {
  // If already has nodes in the right format, use them
  if (definition.nodes && definition.nodes.length > 0) {
    const semanticNodes = migrateDefinitionNodesToSemanticNodes(definition.nodes);

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      scope: definition.kind === 'archetype' ? 'business_object' : 'building_block',
      origin: definition.origin || 'custom',
      version: definition.version || '1.0.0',
      status: definition.status || 'draft',
      nodes: semanticNodes,
      jsonSchema: definition.definition,
      metadata: {
        tags: definition.metadata?.tags || [],
        createdBy: definition.metadata?.createdBy,
        createdAt: definition.metadata?.createdAt || new Date().toISOString(),
        updatedAt: definition.metadata?.updatedAt || new Date().toISOString()
      }
    };
  }

  // Otherwise, migrate from JSON Schema
  if (definition.definition && typeof definition.definition === 'object') {
    return jsonSchemaToSemanticObject(definition.definition, {
      name: definition.name,
      description: definition.description,
      id: definition.id,
      scope: definition.kind === 'archetype' ? 'business_object' : 'building_block'
    });
  }

  // Fallback: create empty semantic object
  const rootNodeId = generateNodeId();
  return {
    id: definition.id || generateSemanticObjectId(),
    name: definition.name || 'Unknown',
    description: definition.description || '',
    scope: 'business_object',
    origin: 'custom',
    version: '1.0.0',
    status: 'draft',
    nodes: [{
      nodeId: rootNodeId,
      parentNodeId: null,
      childrenNodeIds: [],
      role: 'group',
      name: definition.name || 'Root',
      attribute: 'root',
      dataType: 'object',
      occurrences: { min: 1, max: 1 }
    }],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}
