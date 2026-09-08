import { requireAuthenticatedUser } from '@/lib/security/api';
// ContextObjects Builder - API Routes
// GET: List SemanticObjects (migrated from ReusableDefinitions)
// POST: Create new SemanticObject

import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { validateSemanticObject, generateSemanticObjectId, generateNodeId } from '@/lib/semantic/utils';
import { upsertContextObjectDataModel } from '@/lib/contextObjects/dataModelSync';
import { coerceDataTypeForRole } from '@/lib/definitions/types';
import {
  HIERARCHICAL_DEFINITION_FORMAT,
  flattenHierarchicalDefinition,
  nodesToHierarchicalDefinition,
  shouldTreatDefinitionAsHierarchical
} from '@/lib/contextObjects/hierarchicalDefinition';

const COLLECTION_NAME = 'semantic_objects';

function isObjectRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function kindFromScope(scope) {
  return scope === 'building_block' ? 'block' : 'context_object';
}

function normalizeScope(scope) {
  if (scope === 'building_block' || scope === 'business_object') return scope;
  if (scope === 'technical') return 'business_object';
  return 'business_object';
}

function normalizeOrigin(origin) {
  if (origin === 'custom' || origin === 'standard' || origin === 'vendor') return origin;
  if (origin === 'openehr' || origin === 'fhir') return 'standard';
  if (origin === 'other' || origin === 'imported') return 'vendor';
  return 'custom';
}

function normalizeNodes(nodes = []) {
  const normalized = (Array.isArray(nodes) ? nodes : []).map((node) => ({
    ...node,
    nodeId: node?.nodeId || generateNodeId(),
    role: typeof node?.role === 'string' && node.role.trim() ? node.role.trim() : 'field',
    dataType: coerceDataTypeForRole(
      typeof node?.role === 'string' && node.role.trim() ? node.role.trim() : 'field',
      typeof node?.dataType === 'string' && node.dataType.trim() ? node.dataType.trim() : 'string'
    ),
    childrenNodeIds: Array.isArray(node?.childrenNodeIds) ? node.childrenNodeIds : [],
    occurrences: node?.occurrences || { min: 0, max: 1 }
  }));

  const childrenMap = new Map();
  normalized.forEach((node) => childrenMap.set(node.nodeId, []));
  normalized.forEach((node) => {
    if (node.parentNodeId && childrenMap.has(node.parentNodeId)) {
      childrenMap.get(node.parentNodeId).push(node.nodeId);
    }
  });

  return normalized.map((node) => ({
    ...node,
    childrenNodeIds: childrenMap.get(node.nodeId) || []
  }));
}

function normalizeOperationalProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return undefined;

  const normalized = {};
  const stringFields = ['writeMode', 'partitionKey', 'retentionPolicy', 'temporalAxis', 'consistencyModel'];
  const listFields = ['readPatterns', 'queryAxes', 'optimizedPaths', 'indexHints'];

  stringFields.forEach((field) => {
    const value = profile[field];
    if (typeof value === 'string' && value.trim()) {
      normalized[field] = value.trim();
    }
  });

  listFields.forEach((field) => {
    const value = profile[field];
    if (!Array.isArray(value)) return;
    const unique = [];
    const seen = new Set();
    value.forEach((item) => {
      if (typeof item !== 'string') return;
      const trimmed = item.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(trimmed);
    });
    if (unique.length > 0) {
      normalized[field] = unique;
    }
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeRelationships(relationships = []) {
  if (!Array.isArray(relationships)) return [];

  return relationships
    .filter((relationship) => relationship && typeof relationship === 'object' && !Array.isArray(relationship))
    .map((relationship) => {
      const fallbackId = `rel-${generateNodeId()}`;
      const targetNodeId = typeof relationship.targetNodeId === 'string' && relationship.targetNodeId.trim()
        ? relationship.targetNodeId.trim()
        : undefined;
      const targetObjectId = typeof relationship.targetObjectId === 'string' && relationship.targetObjectId.trim()
        ? relationship.targetObjectId.trim()
        : undefined;
      const targetPath = typeof relationship.targetPath === 'string' && relationship.targetPath.trim()
        ? relationship.targetPath.trim()
        : undefined;

      return {
        ...relationship,
        relationshipId: typeof relationship.relationshipId === 'string' && relationship.relationshipId.trim()
          ? relationship.relationshipId.trim()
          : fallbackId,
        type: typeof relationship.type === 'string' ? relationship.type.trim() : relationship.type,
        sourceNodeId: typeof relationship.sourceNodeId === 'string' ? relationship.sourceNodeId.trim() : relationship.sourceNodeId,
        targetNodeId,
        targetObjectId,
        targetPath,
        cardinality: typeof relationship.cardinality === 'string' ? relationship.cardinality.trim() : relationship.cardinality,
        description: typeof relationship.description === 'string' && relationship.description.trim()
          ? relationship.description.trim()
          : undefined
      };
    });
}

// Ensure indexes for efficient querying
async function ensureIndexes(db) {
  const collection = db.collection(COLLECTION_NAME);
  await collection.createIndexes([
    { key: { id: 1, version: -1 }, name: 'id_version' },
    { key: { scope: 1 }, name: 'scope_1' },
    { key: { kind: 1 }, name: 'kind_1' },
    { key: { origin: 1 }, name: 'origin_1' },
    { key: { status: 1 }, name: 'status_1' },
    { key: { name: 'text', description: 'text', 'metadata.tags': 'text' }, name: 'search_text' },
    { key: { 'metadata.createdAt': -1 }, name: 'createdAt_desc' },
    { key: { 'metadata.updatedAt': -1 }, name: 'updatedAt_desc' }
  ]);
}

/**
 * GET /api/definitions
 * List all SemanticObjects with optional filtering
 *
 * Query params:
 * - scope: filter by scope (building_block, business_object, technical)
 * - kind: filter by kind (context_object, block, legacy kinds)
 * - origin: filter by origin (custom, openehr, fhir)
 * - status: filter by status (draft, active, deprecated)
 * - search: text search on name, description, tags
 * - page: page number (default 1)
 * - limit: items per page (default 50)
 */
export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const kind = searchParams.get('kind');
    const origin = searchParams.get('origin');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const { db } = await getActiveTenantDb(request);
    await ensureIndexes(db);

    // Build query filter
    const filter = {};

    if (scope) {
      filter.scope = scope;
    }

    if (kind) {
      if (kind === 'context_object') {
        filter.kind = { $in: ['context_object', 'resource-definition', 'archetype', 'template'] };
      } else if (kind === 'block') {
        filter.kind = { $in: ['block', 'fragment'] };
      } else {
        filter.kind = kind;
      }
    }

    if (origin) {
      filter.origin = origin;
    }

    if (status) {
      filter.status = status;
    }

    if (search && search.trim()) {
      filter.$text = { $search: search.trim() };
    }

    const collection = db.collection(COLLECTION_NAME);

    // Get total count
    const total = await collection.countDocuments(filter);

    // Get paginated results
    const skip = (page - 1) * limit;
    const items = await collection
      .find(filter)
      .sort({ 'metadata.updatedAt': -1, version: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error listing definitions:', error);
    return NextResponse.json(
      { error: 'Failed to list definitions', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/definitions
 * Create a new SemanticObject
 *
 * Request body: Partial<ReusableDefinition> (without id, metadata.createdAt, metadata.updatedAt)
 */
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const { db } = await getActiveTenantDb(request);
    await ensureIndexes(db);

    const rawMetadata = (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata))
      ? body.metadata
      : {};
    const metadataRest = { ...rawMetadata };
    delete metadataRest.operationalProfile;
    const normalizedOperationalProfile = normalizeOperationalProfile(rawMetadata.operationalProfile);

    const requestedDefinitionFormat = typeof body.definitionFormat === 'string' && body.definitionFormat.trim()
      ? body.definitionFormat.trim().toUpperCase()
      : '';
    const definitionIsHierarchical = shouldTreatDefinitionAsHierarchical(body.definition, requestedDefinitionFormat);
    const definitionFormat = definitionIsHierarchical
      ? HIERARCHICAL_DEFINITION_FORMAT
      : (requestedDefinitionFormat || 'INTERNAL-JSON');

    const nodesFromDefinition = definitionIsHierarchical
      ? flattenHierarchicalDefinition(body.definition)
      : [];
    const normalizedNodes = normalizeNodes(nodesFromDefinition.length > 0 ? nodesFromDefinition : (body.nodes || []));
    const canonicalHierarchicalDefinition = definitionIsHierarchical
      ? nodesToHierarchicalDefinition(normalizedNodes, {
        name: body.name,
        rmEntity: body.rmType,
        archetypeId: isObjectRecord(body.definition) && typeof body.definition.archetypeId === 'string'
          ? body.definition.archetypeId
          : undefined
      })
      : null;
    const persistedDefinition = definitionIsHierarchical
      ? {
        ...(isObjectRecord(body.definition) ? body.definition : {}),
        ...(canonicalHierarchicalDefinition || {})
      }
      : body.definition;

    // Set defaults for SemanticObject
    const now = new Date().toISOString();
    const semanticObject = {
      ...body,
      id: body.id || generateSemanticObjectId(),
      version: body.version || '1.0.0',
      versionString: body.versionString || body.version || '1.0.0',
      scope: normalizeScope(body.scope || 'business_object'),
      kind: body.kind || kindFromScope(normalizeScope(body.scope || 'business_object')),
      origin: normalizeOrigin(body.origin || 'custom'),
      status: body.status || 'draft',
      definitionFormat,
      definition: persistedDefinition,
      nodes: normalizedNodes,
      terminologyBindings: body.terminologyBindings || [],
      structuralBindings: body.structuralBindings || [],
      relationships: normalizeRelationships(body.relationships || []),
      metadata: {
        ...metadataRest,
        ...(normalizedOperationalProfile ? { operationalProfile: normalizedOperationalProfile } : {}),
        createdBy: session.user.email || session.user.name || 'unknown',
        createdAt: now,
        updatedAt: now
      }
    };

    // Validate
    const validation = validateSemanticObject(semanticObject);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const collection = db.collection(COLLECTION_NAME);
    await collection.insertOne(semanticObject);
    await upsertContextObjectDataModel(db, semanticObject, session.user.email || session.user.name || 'unknown');

    // Return without MongoDB _id
    const { _id, ...result } = semanticObject;
    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error('Error creating semantic object:', error);
    return NextResponse.json(
      { error: 'Failed to create semantic object', details: error.message },
      { status: 500 }
    );
  }
}
