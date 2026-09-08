import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { validateSemanticObject, rebuildAllPaths, syncChildrenNodeIds, generateNodeId } from '@/lib/semantic/utils';
import { semanticObjectToJsonSchema } from '@/lib/semantic/schema-generator';
import { deleteContextObjectDataModels, upsertContextObjectDataModel } from '@/lib/contextObjects/dataModelSync';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

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

// GET /api/semantic-objects/:id - Get single semantic object
export async function GET(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { id } = params;

    const { db } = await getActiveTenantDb(request);
    const collection = db.collection('semantic_objects');

    const semanticObject = await collection.findOne({ id });

    if (!semanticObject) {
      return NextResponse.json(
        { error: 'Semantic object not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(semanticObject);
  } catch (error) {
    console.error('Error fetching semantic object:', error);
    return safeErrorResponse(error, 'Failed to fetch semantic object');
  }
}

// PUT /api/semantic-objects/:id - Update semantic object
export async function PUT(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { id } = params;
    const data = await request.json();

    // Ensure ID matches
    if (data.id && data.id !== id) {
      return NextResponse.json(
        { error: 'ID in body does not match URL parameter' },
        { status: 400 }
      );
    }
    data.id = id;
    data.scope = data.scope || 'business_object';
    data.kind = data.kind || kindFromScope(data.scope);
    data.origin = data.origin || 'custom';
    data.status = data.status || 'draft';
    data.version = data.version || '1.0.0';

    // Update timestamp
    if (!data.metadata) {
      data.metadata = {};
    }
    data.metadata.updatedAt = new Date().toISOString();

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

    // Regenerate JSON Schema
    withPaths.jsonSchema = semanticObjectToJsonSchema(withPaths);

    // Update in database
    const { db } = await getActiveTenantDb(request);
    const collection = db.collection('semantic_objects');

    const result = await collection.findOneAndUpdate(
      { id },
      { $set: withPaths },
      { returnDocument: 'after', upsert: false }
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Semantic object not found' },
        { status: 404 }
      );
    }

    await upsertContextObjectDataModel(
      db,
      withPaths,
      withPaths?.metadata?.updatedBy || withPaths?.metadata?.createdBy || 'unknown'
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating semantic object:', error);
    return safeErrorResponse(error, 'Failed to update semantic object');
  }
}

// DELETE /api/semantic-objects/:id - Delete semantic object
export async function DELETE(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { id } = params;

    const { db } = await getActiveTenantDb(request);
    const collection = db.collection('semantic_objects');

    const result = await collection.deleteOne({ id });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Semantic object not found' },
        { status: 404 }
      );
    }

    await deleteContextObjectDataModels(db, id);

    return NextResponse.json({ success: true, message: 'Semantic object deleted' });
  } catch (error) {
    console.error('Error deleting semantic object:', error);
    return safeErrorResponse(error, 'Failed to delete semantic object');
  }
}
