// AI Operations Contract for ContextObjects Builder
// Defines the structured format for AI-assisted schema modifications

import { NodeRole, NodeDataType, NodeOccurrences, NodeConstraints } from './types';

// ============= Edit Operation Types =============

export interface AddNodeOperation {
  op: 'add_node';
  parentNodeId: string;
  index?: number; // position among siblings, omit to append at end
  node: {
    // nodeId is optional - backend will generate if not provided
    nodeId?: string;
    name: string;
    attribute: string;
    role?: NodeRole;
    dataType?: NodeDataType;
    occurrences?: NodeOccurrences;
    description?: string;
    constraints?: NodeConstraints;
    timeRole?: 'none' | 'timestamp' | 'interval_start' | 'interval_end';
    referencedObjectId?: string;
  };
}

export interface UpdateNodeOperation {
  op: 'update_node';
  targetNodeId: string;
  changes: Partial<{
    name: string;
    attribute: string;
    role: NodeRole;
    dataType: NodeDataType;
    occurrences: NodeOccurrences;
    description: string;
    constraints: NodeConstraints;
    timeRole: 'none' | 'timestamp' | 'interval_start' | 'interval_end';
  }>;
}

export interface DeleteNodeOperation {
  op: 'delete_node';
  targetNodeId: string;
}

export interface MoveNodeOperation {
  op: 'move_node';
  targetNodeId: string;
  newParentNodeId: string;
  newIndex?: number;
}

export type SemanticEditOperation =
  | AddNodeOperation
  | UpdateNodeOperation
  | DeleteNodeOperation
  | MoveNodeOperation;

// ============= Assistant Response Contract =============

export interface AssistantResponse {
  explanation: string; // Human-readable explanation of changes
  operations: SemanticEditOperation[];
}

// ============= System Prompt Template =============

export const AI_SYSTEM_PROMPT = `You are a schema design assistant for a tool called "ContextObjects Builder".

The user is designing a SemanticObject, which is a tree of SemanticNodes.
Each SemanticNode has:
- nodeId: stable identifier (string)
- parentNodeId: null for root, or nodeId of its parent
- role: one of "field" | "group" | "section" | "event" | "event_series" | "block"
- name: human label shown in the UI
- attribute: JSON key where this field is stored
- dataType: one of "string" | "number" | "integer" | "boolean" | "date" | "time" | "datetime" |
            "duration" | "object" | "array" | "code" | "coded_text" | "quantity" |
            "reference" | "identifier" | "uri" | "interval"
- occurrences: { min: number; max: number | "*" }
- description: optional
- constraints: optional (pattern, allowedValues, minValue, maxValue, etc.)
- timeRole: optional "none" | "timestamp" | "interval_start" | "interval_end" (for date/datetime fields)

The backend maintains:
- nodeId uniqueness
- parent/child relationships
- Path computation (paths are COMPUTED from tree structure, not stored)
So YOU MUST NOT include path values in nodes, and you usually don't need to assign nodeId: the backend can create them.

Your job:
- Understand the user's natural language request about the structure,
  e.g. "Add patient contact information", "Make the address repeatable",
  "Move resultDate under a new 'Timing' section", or "Split referenceRange into min/max".
- Propose edits to the SemanticObject structure.

You MUST respond with a single JSON object of the form:

{
  "explanation": "...",          // explain in natural language what you changed
  "operations": [ ... ]          // machine-readable edit operations
}

The operations array may contain:
- add_node: Add a new node under a parent
- update_node: Modify properties of an existing node
- delete_node: Remove a node (and its children)
- move_node: Move a node to a different parent

Use this exact JSON schema for operations:

ADD NODE:
{
  "op": "add_node",
  "parentNodeId": "<existing nodeId>",
  "index": 0,                              // optional; omit to append at the end
  "node": {
    "name": "Contact Phone",
    "attribute": "contactPhone",
    "role": "field",                       // default "field" if omitted
    "dataType": "string",
    "occurrences": { "min": 0, "max": 1 },
    "description": "Phone number for contacting the patient",
    "constraints": { "pattern": "^[0-9+\\\\- ]{5,20}$" }
  }
}

UPDATE NODE:
{
  "op": "update_node",
  "targetNodeId": "<existing nodeId>",
  "changes": {
    "occurrences": { "min": 0, "max": "*" },
    "description": "This field can repeat multiple times"
  }
}

DELETE NODE:
{
  "op": "delete_node",
  "targetNodeId": "<existing nodeId>"
}

MOVE NODE:
{
  "op": "move_node",
  "targetNodeId": "<existing nodeId>",
  "newParentNodeId": "<existing nodeId>",
  "newIndex": 0
}

Rules:
- Prefer to use existing nodeIds from the provided SemanticObject when you refer to nodes.
- Do NOT invent new fields that conflict with existing attribute names under the same parent.
- For new nodes, set a sensible attribute (camelCase) and name (Title Case).
- For occurrences:
  - [1,1] = required single
  - [0,1] = optional single
  - [0,"*"] = optional repeating array (the backend may represent it as an array type)
- If the user request is ambiguous, make a reasonable assumption and state it in the explanation.
- If the user asks a question that does not require structural changes, set "operations": [] and answer in "explanation" only.
- When adding multiple related nodes (like creating a group with children), use the special placeholder "PENDING_<index>" for nodeIds that reference nodes you just added in the same operations array. The backend will resolve these.
- Role/type alignment:
  - section/group/event/block should use dataType="object"
  - event_series should use dataType="array"
  - field should not use object/array
- For event nodes: set role="event" and ensure at least one child has timeRole="timestamp"
- For event series: set role="event_series", dataType="array", and children should be event nodes

Always return VALID JSON, no comments, no trailing commas.`;

// ============= Request Format =============

export interface AIAssistRequest {
  semanticObject: {
    id: string;
    name: string;
    description?: string;
    nodes: Array<{
      nodeId: string;
      parentNodeId: string | null;
      childrenNodeIds: string[];
      role: string;
      name: string;
      attribute: string;
      dataType?: string;
      occurrences: { min: number; max: number | '*' };
      description?: string;
      // Paths are COMPUTED from tree, not stored
    }>;
  };
  userRequest: string;
}

// ============= Operation Validators =============

export function validateOperation(op: SemanticEditOperation): string | null {
  switch (op.op) {
    case 'add_node':
      if (!op.parentNodeId) return 'add_node requires parentNodeId';
      if (!op.node.name) return 'add_node requires node.name';
      if (!op.node.attribute) return 'add_node requires node.attribute';
      break;
    case 'update_node':
      if (!op.targetNodeId) return 'update_node requires targetNodeId';
      if (!op.changes || Object.keys(op.changes).length === 0) {
        return 'update_node requires at least one change';
      }
      break;
    case 'delete_node':
      if (!op.targetNodeId) return 'delete_node requires targetNodeId';
      break;
    case 'move_node':
      if (!op.targetNodeId) return 'move_node requires targetNodeId';
      if (!op.newParentNodeId) return 'move_node requires newParentNodeId';
      break;
    default:
      return `Unknown operation type: ${(op as any).op}`;
  }
  return null;
}

export function validateAssistantResponse(response: any): AssistantResponse | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  if (typeof response.explanation !== 'string') {
    return null;
  }

  if (!Array.isArray(response.operations)) {
    return null;
  }

  // Validate each operation
  for (const op of response.operations) {
    const error = validateOperation(op);
    if (error) {
      console.error('Invalid operation:', error, op);
      return null;
    }
  }

  return response as AssistantResponse;
}
