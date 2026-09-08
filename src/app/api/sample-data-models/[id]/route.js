import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/sample-data-models/[id]/route.js
/**
 * Individual Sample Data Model API
 *
 * Fetches a complete sample data model by ID from the unified collection or code.
 * Returns full data payload for import.
 */

import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ObjectId } from 'mongodb';
import { SEMANTIC_OBJECT_EXAMPLES } from '@/lib/semantic/examples';

const COLLECTION_NAME = 'sample-data-models';

export async function GET(req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const collection = coreDb.collection(COLLECTION_NAME);
    let doc = null;

    // Try to find by MongoDB _id first
    if (ObjectId.isValid(id)) {
      doc = await collection.findOne({ _id: new ObjectId(id) });
    }

    // If not found, try by name
    if (!doc) {
      doc = await collection.findOne({ name: id });
    }

    // If not found, try by templateId (for openehr)
    if (!doc) {
      doc = await collection.findOne({ 'metadata.templateId': id });
    }

    // If not found, try by domainData.id (for context objects)
    if (!doc) {
      doc = await collection.findOne({ 'domainData.id': id });
    }

    // If not found in DB, check ContextObjects from code
    if (!doc && SEMANTIC_OBJECT_EXAMPLES) {
      const contextExample = SEMANTIC_OBJECT_EXAMPLES.find(
        ex => ex.id === id || ex.name === id
      );

      if (contextExample) {
        return NextResponse.json({
          _id: contextExample.id,
          name: contextExample.name,
          domain: 'context',
          modelType: contextExample.scope || 'business_object',
          description: contextExample.description,
          domainData: {
            id: contextExample.id,
            scope: contextExample.scope,
            origin: contextExample.origin,
            version: contextExample.version,
            versionString: contextExample.versionString,
            status: contextExample.status,
            nodes: contextExample.nodes,
            terminologyBindings: contextExample.terminologyBindings,
            schema: contextExample.schema,
          },
          metadata: {
            scope: contextExample.scope,
            origin: contextExample.origin,
            version: contextExample.version,
            versionString: contextExample.versionString,
            status: contextExample.status,
            tags: contextExample.metadata?.tags || [],
            ...contextExample.metadata,
          },
          source: 'code',
        });
      }
    }

    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Return full document for import
    return NextResponse.json({
      ...doc,
      _id: doc._id.toString(),
      source: 'database',
    });
  } catch (error) {
    console.error('GET /api/sample-data-models/[id] error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove a sample data model
 */
export async function DELETE(req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const collection = coreDb.collection(COLLECTION_NAME);

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('DELETE /api/sample-data-models/[id] error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update a sample data model
 */
export async function PATCH(req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const collection = coreDb.collection(COLLECTION_NAME);
    const body = await req.json();

    // Build update object (only allow certain fields to be updated)
    const updateFields = {};
    if (body.name !== undefined) updateFields.name = body.name;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.modelType !== undefined) updateFields.modelType = body.modelType;
    if (body.domainData !== undefined) updateFields.domainData = body.domainData;
    if (body.metadata !== undefined) updateFields.metadata = body.metadata;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Add audit info
    updateFields['audit.updatedAt'] = new Date();
    updateFields['audit.updatedBy'] = session.user.email || session.user.name || 'unknown';

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...result,
      _id: result._id.toString(),
    });
  } catch (error) {
    console.error('PATCH /api/sample-data-models/[id] error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
