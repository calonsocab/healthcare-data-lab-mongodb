import { requireAuthenticatedUser } from '@/lib/security/api';
// ContextObjects Builder - Single Semantic Object API Routes
// GET: Get semantic object by ID
// PUT: Update semantic object
// DELETE: Delete semantic object

import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { validateSemanticObject, generateNodeId } from '@/lib/semantic/utils';
import { deleteContextObjectDataModels, upsertContextObjectDataModel } from '@/lib/contextObjects/dataModelSync';
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

/**
 * GET /api/definitions/:id
 * Get a single definition by ID
 */
export async function GET(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const collection = db.collection(COLLECTION_NAME);

    const semanticObject = await collection.findOne(
      { id },
      { projection: { _id: 0 } }
    );

    if (!semanticObject) {
      return NextResponse.json({ error: 'Semantic object not found' }, { status: 404 });
    }

    return NextResponse.json(semanticObject);

  } catch (error) {
    console.error('Error fetching semantic object:', error);
    return NextResponse.json(
      { error: 'Failed to fetch semantic object', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/definitions/:id
 * Update a definition
 *
 * Note: Cannot change kind, origin, or definitionFormat after creation
 */
export async function PUT(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { db } = await getActiveTenantDb(request);
    const collection = db.collection(COLLECTION_NAME);

    // Get existing semantic object
    const existing = await collection.findOne({ id });
    if (!existing) {
      return NextResponse.json({ error: 'Semantic object not found' }, { status: 404 });
    }

    // Build updated semantic object
    const now = new Date().toISOString();
    const incomingMetadata = (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata))
      ? body.metadata
      : {};
    const mergedMetadata = {
      ...(existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata) ? existing.metadata : {}),
      ...incomingMetadata
    };
    const normalizedOperationalProfile = normalizeOperationalProfile(mergedMetadata.operationalProfile);
    const metadataWithoutOperationalProfile = { ...mergedMetadata };
    delete metadataWithoutOperationalProfile.operationalProfile;

    const incomingDefinitionFormat = typeof body.definitionFormat === 'string' && body.definitionFormat.trim()
      ? body.definitionFormat.trim().toUpperCase()
      : (typeof existing.definitionFormat === 'string' ? existing.definitionFormat.trim().toUpperCase() : '');
    const incomingDefinition = body.definition !== undefined ? body.definition : existing.definition;
    const definitionIsHierarchical = shouldTreatDefinitionAsHierarchical(incomingDefinition, incomingDefinitionFormat);
    const definitionFormat = definitionIsHierarchical
      ? HIERARCHICAL_DEFINITION_FORMAT
      : (incomingDefinitionFormat || 'INTERNAL-JSON');

    const nodesFromDefinition = definitionIsHierarchical
      ? flattenHierarchicalDefinition(incomingDefinition)
      : [];
    const normalizedNodes = (definitionIsHierarchical && body.definition !== undefined)
      ? normalizeNodes(nodesFromDefinition)
      : (
        body.nodes
          ? normalizeNodes(body.nodes)
          : (nodesFromDefinition.length > 0 ? normalizeNodes(nodesFromDefinition) : normalizeNodes(existing.nodes || []))
      );

    const canonicalHierarchicalDefinition = definitionIsHierarchical
      ? nodesToHierarchicalDefinition(normalizedNodes, {
        name: body.name || existing.name,
        rmEntity: body.rmType || existing.rmType,
        archetypeId: isObjectRecord(incomingDefinition) && typeof incomingDefinition.archetypeId === 'string'
          ? incomingDefinition.archetypeId
          : undefined
      })
      : null;
    const persistedDefinition = definitionIsHierarchical
      ? {
        ...(isObjectRecord(incomingDefinition) ? incomingDefinition : {}),
        ...(canonicalHierarchicalDefinition || {})
      }
      : (body.definition !== undefined ? body.definition : existing.definition);

    const updated = {
      ...existing,
      ...body,
      // Preserve immutable fields
      id: existing.id,
      scope: normalizeScope(body.scope || existing.scope || 'business_object'),
      origin: normalizeOrigin(body.origin || existing.origin || 'custom'),
      kind: body.kind || existing.kind || kindFromScope(normalizeScope(body.scope || existing.scope || 'business_object')),
      definitionFormat,
      definition: persistedDefinition,
      nodes: normalizedNodes,
      relationships: body.relationships !== undefined
        ? normalizeRelationships(body.relationships)
        : normalizeRelationships(existing.relationships || []),
      // Update metadata
      metadata: {
        ...metadataWithoutOperationalProfile,
        ...(normalizedOperationalProfile ? { operationalProfile: normalizedOperationalProfile } : {}),
        createdBy: existing.metadata?.createdBy,
        createdAt: existing.metadata?.createdAt,
        updatedAt: now
      }
    };

    // Remove MongoDB _id if present
    delete updated._id;

    // Validate
    const validation = validateSemanticObject(updated);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Update in database
    await collection.replaceOne({ id }, updated);
    await upsertContextObjectDataModel(db, updated, session.user.email || session.user.name || 'unknown');

    return NextResponse.json(updated);

  } catch (error) {
    console.error('Error updating semantic object:', error);
    return NextResponse.json(
      { error: 'Failed to update definition', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/definitions/:id
 * Delete a definition
 */
export async function DELETE(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.deleteOne({ id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Semantic object not found' }, { status: 404 });
    }

    await deleteContextObjectDataModels(db, id);

    return NextResponse.json({ message: 'Semantic object deleted successfully' });

  } catch (error) {
    console.error('Error deleting semantic object:', error);
    return NextResponse.json(
      { error: 'Failed to delete semantic object', details: error.message },
      { status: 500 }
    );
  }
}
