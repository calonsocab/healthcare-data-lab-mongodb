// ContextObjects Builder - Type Definitions
// Schema: co/1 (ContextObject)
//
// Clean spec:
// - No persistence/search hints (emit) in CO definitions
// - Paths: coql (data path), coqlWithIds (debug)
// - FHIR/openEHR paths belong in bindings, not computed paths
// - Blocks: reusable subtrees with blockId, version, versionRange

// ============= Schema Constants =============

export const CO_SCHEMA_VERSION = 'co/1' as const;
export const PATH_DIALECT = 'coql/v1' as const;

// ============= Schema Object =============

export interface SchemaVersion {
  version: typeof CO_SCHEMA_VERSION;
  pathDialect: typeof PATH_DIALECT;
}

// ============= Core Enums and Types =============

// Status for CO
export type DefinitionStatus = 'draft' | 'active' | 'deprecated';

// Origin: source of definition
export type DefinitionOrigin = 'custom' | 'standard' | 'vendor';

// Scope: what the CO represents
export type DefinitionScope = 'business_object' | 'building_block';

// Node roles - 'block' is for embedding a block reference
export type NodeRole = 'section' | 'group' | 'field' | 'event' | 'event_series' | 'block';

export type NodeDataType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'duration'
  | 'object'
  | 'array'
  | 'code'
  | 'coded_text'
  | 'quantity'
  | 'reference'
  | 'identifier'
  | 'uri'
  | 'interval';

export type TimeRole = 'timestamp' | 'interval_start' | 'interval_end';

// ============= Node Occurrences =============

export interface NodeOccurrences {
  min: number;              // >= 0
  max: number | '*';        // >= min or "*" for unbounded
}

// ============= Node Constraints =============

export interface NodeConstraints {
  required?: boolean;
  fixedValue?: any;
  pattern?: string;
  allowedValues?: any[];
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
}

// ============= Bindings =============

export interface TerminologyBinding {
  system: string;           // e.g., "SNOMED-CT", "LOINC", "ICD-10"
  code: string;
  display?: string;
  valueSet?: string;
  version?: string;
  bindingStrength?: 'required' | 'extensible' | 'preferred' | 'example';
  preferredLanguage?: string;
}

export interface StructuralBinding {
  nodeId?: string;          // Reference to the node this binding applies to
  model: 'FHIR' | 'openEHR' | 'X12' | 'HL7v2' | 'Other';
  path: string;             // e.g., "Observation.valueQuantity.value"
}

export interface SemanticRelationship {
  relationshipId: string;
  type: 'reference' | 'derived_from' | 'caused_by' | 'same_as' | 'part_of' | 'associated_with';
  sourceNodeId: string;
  targetNodeId?: string;
  targetObjectId?: string;
  targetPath?: string;
  cardinality?: 'one_to_one' | 'one_to_many' | 'many_to_many';
  description?: string;
}

export interface OperationalProfile {
  writeMode?: string;
  partitionKey?: string;
  retentionPolicy?: string;
  temporalAxis?: string;
  consistencyModel?: string;
  readPatterns?: string[];
  queryAxes?: string[];
  optimizedPaths?: string[];
  indexHints?: string[];
}

// ============= Semantic Node (CONode) =============

/**
 * CONode - A single node in the ContextObject tree.
 *
 * Note: No persistence/search hints (emit). Those belong in Stage-2 mapping,
 * not in the definition layer.
 */
export interface SemanticNode {
  // Identity
  nodeId: string;                           // Stable, unique within CO
  parentNodeId: string | null;              // null for root node
  childrenNodeIds?: string[];               // Optional - can be computed from parentNodeId

  // Meaning
  role: NodeRole;                           // section, group, field, event, event_series, block
  name: string;                             // Human-readable label
  attribute: string;                        // JSON key name in instance payload
  description?: string;

  // Type & cardinality
  dataType?: NodeDataType;                  // undefined for block references
  occurrences: NodeOccurrences;

  // Constraints
  constraints?: NodeConstraints;

  // Time semantics (only for date/datetime fields)
  timeRole?: TimeRole;

  // Block reference (only when role === 'block')
  blockId?: string;                         // e.g., 'AnalyteResult'
  versionRange?: string;                    // Semver range: "^1.0", "~1.2.3", "1.0.0"

  // Terminology bindings (inline on node)
  terminologyBindings?: TerminologyBinding[];

  // Structural bindings (inline on node) - FHIR/openEHR paths
  structuralBindings?: StructuralBinding[];

  // Array item spec (for arrays that hold block items)
  itemSpec?: SemanticNode;

  // UI metadata (ephemeral, not persisted)
  uiId?: string;
  color?: string;
  icon?: string;
}

// ============= Metadata =============

export interface DefinitionMetadata {
  tags?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  operationalProfile?: OperationalProfile;
  [key: string]: unknown;
}

// ============= ContextObject (co/1 schema) =============

/**
 * SemanticObject (CO) - A semantic definition that can be either:
 * - A full template (scope: "business_object")
 * - A reusable building block (scope: "building_block")
 *
 * This is the "definition layer" - what defines the structure and constraints
 * for actual data instances. Nodes can reference other blocks via role:"block".
 */
export interface SemanticObject {
  // Schema version
  schema: SchemaVersion;                    // { version: "co/1", pathDialect: "coql/v1" }

  // Identity
  id: string;                               // e.g., "LabResultPanel" or "AnalyteResult"
  name: string;
  description?: string;

  // Classification
  scope: DefinitionScope;                   // business_object or building_block
  origin: DefinitionOrigin;                 // custom, standard, vendor

  // Versioning
  version: string;                          // Semver: "1.2.0"
  status: DefinitionStatus;

  // Structure
  nodes: SemanticNode[];                    // Tree with exactly one root (parentNodeId = null)

  // Bindings (at definition level)
  terminologyBindings?: TerminologyBinding[];
  structuralBindings?: StructuralBinding[];
  relationships?: SemanticRelationship[];

  // Metadata
  metadata?: DefinitionMetadata;
}

// Alias for compatibility
export type ContextObject = SemanticObject;

// ============= Context Instance Types =============

export interface ContextSubject {
  type: string;
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface ContextInterval {
  start: string;
  end?: string;
}

// ============= Validation Constants =============

export const VALID_STATUSES: DefinitionStatus[] = ['draft', 'active', 'deprecated'];
export const VALID_ORIGINS: DefinitionOrigin[] = ['custom', 'standard', 'vendor'];
export const VALID_SCOPES: DefinitionScope[] = ['business_object', 'building_block'];
export const VALID_ROLES: NodeRole[] = ['section', 'group', 'field', 'event', 'event_series', 'block'];
export const VALID_DATA_TYPES: NodeDataType[] = [
  'string', 'number', 'integer', 'boolean', 'date', 'time', 'datetime', 'duration',
  'object', 'array', 'code', 'coded_text', 'quantity', 'reference', 'identifier', 'uri', 'interval'
];
export const VALID_TIME_ROLES: TimeRole[] = ['timestamp', 'interval_start', 'interval_end'];

// ============= Version Utilities =============

/**
 * Generate a random nodeId
 */
export function generateNodeId(): string {
  return 'n-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Parse semver string
 */
export function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

/**
 * Check if a version satisfies a version range (simplified)
 * Supports: exact "1.2.3", caret "^1.2", tilde "~1.2.3"
 */
export function satisfiesVersionRange(version: string, range: string): boolean {
  const v = parseSemver(version);
  if (!v) return false;

  // Exact match
  if (!range.startsWith('^') && !range.startsWith('~')) {
    return version === range;
  }

  // Caret range: ^1.2.3 allows >=1.2.3 <2.0.0
  if (range.startsWith('^')) {
    const base = parseSemver(range.slice(1));
    if (!base) return false;
    if (v.major !== base.major) return false;
    if (v.major === 0) {
      if (v.minor !== base.minor) return false;
      return v.patch >= base.patch;
    }
    if (v.minor < base.minor) return false;
    if (v.minor === base.minor && v.patch < base.patch) return false;
    return true;
  }

  // Tilde range: ~1.2.3 allows >=1.2.3 <1.3.0
  if (range.startsWith('~')) {
    const base = parseSemver(range.slice(1));
    if (!base) return false;
    if (v.major !== base.major) return false;
    if (v.minor !== base.minor) return false;
    return v.patch >= base.patch;
  }

  return false;
}

// ============= Factory Functions =============

/**
 * Create a new empty SemanticObject
 */
export function createSemanticObject(
  name: string,
  scope: DefinitionScope = 'business_object',
  description?: string
): SemanticObject {
  const rootId = generateNodeId();

  return {
    schema: { version: CO_SCHEMA_VERSION, pathDialect: PATH_DIALECT },
    id: name.replace(/\s+/g, ''),
    name,
    description,
    scope,
    origin: 'custom',
    version: '1.0.0',
    status: 'draft',
    nodes: [{
      nodeId: rootId,
      parentNodeId: null,
      childrenNodeIds: [],
      role: 'section',
      name,
      attribute: name.toLowerCase().replace(/\s+/g, ''),
      dataType: 'object',
      occurrences: { min: 1, max: 1 }
    }],
    metadata: {
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Create a block reference node
 */
export function createBlockNode(
  blockId: string,
  versionRange: string,
  parentNodeId: string,
  name: string,
  attribute: string
): SemanticNode {
  return {
    nodeId: generateNodeId(),
    parentNodeId,
    childrenNodeIds: [],
    role: 'block',
    name,
    attribute,
    dataType: 'object',
    blockId,
    versionRange,
    occurrences: { min: 0, max: 1 }
  };
}

/**
 * Create a field node
 */
export function createFieldNode(
  name: string,
  attribute: string,
  dataType: NodeDataType,
  parentNodeId: string,
  options?: {
    required?: boolean;
    timeRole?: TimeRole;
    description?: string;
  }
): SemanticNode {
  return {
    nodeId: generateNodeId(),
    parentNodeId,
    childrenNodeIds: [],
    role: 'field',
    name,
    attribute,
    dataType,
    occurrences: { min: options?.required ? 1 : 0, max: 1 },
    timeRole: options?.timeRole,
    description: options?.description
  };
}

// ============= Legacy Compatibility =============

// These functions support the old numeric version format
export function semanticVersionToNumber(version: string): number {
  const parsed = parseSemver(version);
  if (!parsed) return 10000; // Default to 1.0.0
  return parsed.major * 10000 + parsed.minor * 100 + parsed.patch;
}

export function numberToSemanticVersion(num: number): string {
  const major = Math.floor(num / 10000);
  const minor = Math.floor((num % 10000) / 100);
  const patch = num % 100;
  return `${major}.${minor}.${patch}`;
}
