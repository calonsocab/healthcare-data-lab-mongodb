import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { validateSemanticObject, rebuildAllPaths, generateSemanticObjectId, syncChildrenNodeIds, generateNodeId } from '@/lib/semantic/utils';
import { semanticObjectToJsonSchema } from '@/lib/semantic/schema-generator';
import { upsertContextObjectDataModel } from '@/lib/contextObjects/dataModelSync';
import { escapeRegex } from '@/lib/utils';
import { clampPositiveInt, requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

function kindFromScope(scope) {
  return scope === 'building_block' ? 'block' : 'context_object';
}

function normalizeNodes(nodes = []) {
  const prepared = (Array.isArray(nodes) ? nodes : []).map((node) => ({
    ...node,
    nodeId: node?.nodeId || generateNodeId(),
    occurrences: node?.occurrences || { min: 0, max: 1 },
    childrenNodeIds: Array.isArray(node?.childrenNodeIds) ? node.childrenNodeIds : []
  }));

  return syncChildrenNodeIds(prepared);
}

// GET /api/semantic-objects - List semantic objects with filters
export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const origin = searchParams.get('origin');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = clampPositiveInt(searchParams.get('limit'), 50, 500);
    const skip = clampPositiveInt(searchParams.get('skip'), 0, 10000);

    const { db } = await getActiveTenantDb(request);
    const collection = db.collection('semantic_objects');

    // Build query
    const query = {};

    if (scope) {
      query.scope = scope;
    }

    if (origin) {
      query.origin = origin;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { 'metadata.tags': { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    // Get total count
    const total = await collection.countDocuments(query);

    // Get items
    const items = await collection
      .find(query)
      .sort({ 'metadata.updatedAt': -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      items,
      total,
      limit,
      skip
    });
  } catch (error) {
    console.error('Error fetching semantic objects:', error);
    return safeErrorResponse(error, 'Failed to fetch semantic objects');
  }
}

// POST /api/semantic-objects - Create new semantic object
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const data = await request.json();

    // Generate ID if not provided
    if (!data.id) {
      data.id = generateSemanticObjectId();
    }

    data.scope = data.scope || 'business_object';
    data.kind = data.kind || kindFromScope(data.scope);
    data.origin = data.origin || 'custom';
    data.status = data.status || 'draft';
    data.version = data.version || '1.0.0';

    // Set timestamps
    const now = new Date().toISOString();
    if (!data.metadata) {
      data.metadata = {};
    }
    data.metadata.createdAt = now;
    data.metadata.updatedAt = now;

    // Ensure nodes have childrenNodeIds synced
    if (data.nodes && Array.isArray(data.nodes)) {
      data.nodes = normalizeNodes(data.nodes);
    }

    // Rebuild paths
    const withPaths = rebuildAllPaths(data);

    // Validate
    const validation = validateSemanticObject(withPaths);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid semantic object', details: validation.errors },
        { status: 400 }
      );
    }

    // Generate JSON Schema
    withPaths.jsonSchema = semanticObjectToJsonSchema(withPaths);

    // Save to database
    const { db } = await getActiveTenantDb(request);
    const collection = db.collection('semantic_objects');

    // Check for duplicate ID
    const existing = await collection.findOne({ id: withPaths.id });
    if (existing) {
      return NextResponse.json(
        { error: 'Semantic object with this ID already exists' },
        { status: 409 }
      );
    }

    await collection.insertOne(withPaths);
    await upsertContextObjectDataModel(
      db,
      withPaths,
      withPaths?.metadata?.updatedBy || withPaths?.metadata?.createdBy || 'unknown'
    );

    return NextResponse.json(withPaths, { status: 201 });
  } catch (error) {
    console.error('Error creating semantic object:', error);
    return safeErrorResponse(error, 'Failed to create semantic object');
  }
}
