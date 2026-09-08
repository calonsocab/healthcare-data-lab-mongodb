import { requireAuthenticatedUser } from '@/lib/security/api';
// POST /api/semantic-objects/seed-examples
// Seeds ContextObject examples using co/1 schema

import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';

// Import the co/1 examples
import { SEMANTIC_OBJECT_EXAMPLES } from '@/lib/semantic/examples';

export async function POST(request) {
  try {
    // Auth check
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { db } = await getActiveTenantDb(request);

    // Seed directly into the semantic_objects collection used by the builder list
    const collection = db.collection('semantic_objects');

    // Get the co/1 examples
    const examples = SEMANTIC_OBJECT_EXAMPLES;

    // Prepare documents for insertion (co/1 schema)
    const documents = examples.map(obj => ({
      schema: obj.schema || 'co/1',
      id: obj.id,
      name: obj.name,
      description: obj.description,
      kind: obj.kind || (obj.scope === 'building_block' ? 'block' : 'context_object'),
      scope: obj.scope,
      origin: obj.origin,
      version: obj.version,
      status: obj.status,
      defaultEmit: obj.defaultEmit || 'auto',
      nodes: obj.nodes,
      uses: obj.uses || [],
      bindings: obj.bindings || [],
      metadata: {
        ...obj.metadata,
        createdBy: session.user.email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }));

    // Delete existing examples if present
    const exampleIds = examples.map(obj => obj.id);
    await collection.deleteMany({
      id: { $in: exampleIds }
    });

    // Insert new examples
    const result = await collection.insertMany(documents);

    // Create indexes if they don't exist
    await collection.createIndex({ id: 1 });
    await collection.createIndex({ id: 1, version: -1 }, { unique: true });
    await collection.createIndex({ name: 1 });
    await collection.createIndex({ scope: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ 'metadata.tags': 1 });

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${result.insertedCount} ContextObject examples (co/1)`,
      inserted: result.insertedCount,
      collection: 'semantic_objects',
      examples: documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        scope: doc.scope,
        version: doc.version
      }))
    });

  } catch (error) {
    console.error('Seed examples error:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed examples',
        details: error.message
      },
      { status: 500 }
    );
  }
}
