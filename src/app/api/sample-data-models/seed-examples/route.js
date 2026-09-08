import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/sample-data-models/seed-examples/route.js
/**
 * Seed Sample Data Models API
 *
 * Seeds the unified sample-data-models collection with Context Objects (co/1 schema)
 * Building blocks go to sample_co_blocks, business objects go to sample-data-models
 */

import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';

// Import context object examples from examples.ts
import { SEMANTIC_OBJECT_EXAMPLES } from '@/lib/semantic/examples';

const DATA_MODELS_COLLECTION = 'sample-data-models';
const BLOCKS_COLLECTION = 'sample_co_blocks';

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const dataModelsCollection = coreDb.collection(DATA_MODELS_COLLECTION);
    const blocksCollection = coreDb.collection(BLOCKS_COLLECTION);

    const results = {
      blocks: { inserted: 0, updated: 0, items: [] },
      contextObjects: { inserted: 0, updated: 0, items: [] },
    };

    const now = new Date().toISOString();

    // Process each example
    for (const example of SEMANTIC_OBJECT_EXAMPLES) {
      try {
        if (example.scope === 'building_block') {
          // Seed building blocks to sample_co_blocks
          const blockDoc = {
            blockId: `block.${example.id}.v1`,
            name: example.name,
            description: example.description || '',
            version: example.version || '1.0.0',
            nodes: example.nodes,
            terminologyBindings: example.terminologyBindings || [],
            structuralBindings: example.structuralBindings || [],
            metadata: {
              ...example.metadata,
              tags: example.metadata?.tags || ['building-block'],
              createdAt: now,
              updatedAt: now,
              seededBy: session.user.email,
            },
          };

          const existing = await blocksCollection.findOne({
            blockId: blockDoc.blockId,
            version: blockDoc.version
          });

          if (existing) {
            await blocksCollection.updateOne(
              { blockId: blockDoc.blockId, version: blockDoc.version },
              { $set: { ...blockDoc, 'metadata.updatedAt': now } }
            );
            results.blocks.updated++;
          } else {
            await blocksCollection.insertOne(blockDoc);
            results.blocks.inserted++;
          }

          results.blocks.items.push({
            blockId: blockDoc.blockId,
            name: blockDoc.name,
            action: existing ? 'updated' : 'inserted'
          });

        } else {
          // Seed business objects to sample-data-models with domain: 'context'
          const dataModelDoc = {
            name: example.name,
            domain: 'context',
            modelType: example.scope || 'business_object',
            description: example.description || '',
            domainData: {
              schema: example.schema,
              id: example.id,
              scope: example.scope,
              origin: example.origin,
              version: example.version,
              status: example.status,
              nodes: example.nodes,
              terminologyBindings: example.terminologyBindings || [],
              structuralBindings: example.structuralBindings || [],
            },
            metadata: {
              description: example.description,
              scope: example.scope,
              origin: example.origin,
              version: example.version,
              status: example.status,
              tags: example.metadata?.tags || ['context-object'],
            },
            audit: {
              createdAt: new Date(),
              createdBy: session.user.email,
              seededAt: new Date(),
            },
          };

          // Upsert by name and domain
          const result = await dataModelsCollection.updateOne(
            { name: dataModelDoc.name, domain: 'context' },
            { $set: dataModelDoc },
            { upsert: true }
          );

          if (result.upsertedCount > 0) {
            results.contextObjects.inserted++;
          } else if (result.modifiedCount > 0) {
            results.contextObjects.updated++;
          }

          results.contextObjects.items.push({
            id: example.id,
            name: example.name,
            scope: example.scope,
            action: result.upsertedCount > 0 ? 'inserted' : 'updated'
          });
        }
      } catch (itemError) {
        console.error(`Error seeding ${example.name}:`, itemError);
      }
    }

    // Create indexes for sample-data-models
    try {
      await dataModelsCollection.createIndex({ domain: 1 });
      await dataModelsCollection.createIndex({ name: 1, domain: 1 }, { unique: true });
      await dataModelsCollection.createIndex({ 'domainData.id': 1 });
      await dataModelsCollection.createIndex({ 'metadata.tags': 1 });
      await dataModelsCollection.createIndex(
        { name: 'text', description: 'text' },
        { name: 'text_search_index' }
      );
    } catch (indexError) {
      console.log('Index creation note:', indexError.message);
    }

    // Create indexes for sample_co_blocks
    try {
      await blocksCollection.createIndex({ blockId: 1 });
      await blocksCollection.createIndex({ blockId: 1, version: -1 }, { unique: true });
      await blocksCollection.createIndex({ 'metadata.tags': 1 });
    } catch (indexError) {
      console.log('Block index creation note:', indexError.message);
    }

    const totalInserted = results.blocks.inserted + results.contextObjects.inserted;
    const totalUpdated = results.blocks.updated + results.contextObjects.updated;

    return NextResponse.json({
      success: true,
      message: `Seeded ${totalInserted} new, updated ${totalUpdated} existing items`,
      results,
    });
  } catch (error) {
    console.error('Seed sample data models error:', error);
    return NextResponse.json(
      { error: 'Failed to seed sample data models', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check current samples
export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const dataModelsCollection = coreDb.collection(DATA_MODELS_COLLECTION);
    const blocksCollection = coreDb.collection(BLOCKS_COLLECTION);

    // Get ContextObjects from sample-data-models
    const contextObjects = await dataModelsCollection
      .find({ domain: 'context' })
      .project({ name: 1, 'domainData.id': 1, 'domainData.scope': 1, 'metadata.tags': 1 })
      .toArray();

    // Get blocks from sample_co_blocks
    const blocks = await blocksCollection
      .find({})
      .project({ blockId: 1, name: 1, version: 1, 'metadata.tags': 1 })
      .toArray();

    // Get counts by domain in sample-data-models
    const counts = await dataModelsCollection.aggregate([
      { $group: { _id: '$domain', count: { $sum: 1 } } }
    ]).toArray();

    const countsByDomain = Object.fromEntries(counts.map(c => [c._id, c.count]));

    return NextResponse.json({
      contextObjects: {
        count: contextObjects.length,
        items: contextObjects.map(co => ({
          _id: co._id.toString(),
          name: co.name,
          id: co.domainData?.id,
          scope: co.domainData?.scope,
          tags: co.metadata?.tags || [],
        })),
      },
      blocks: {
        count: blocks.length,
        items: blocks.map(b => ({
          _id: b._id.toString(),
          blockId: b.blockId,
          name: b.name,
          version: b.version,
          tags: b.metadata?.tags || [],
        })),
      },
      countsByDomain,
      examplesAvailable: SEMANTIC_OBJECT_EXAMPLES.length,
    });
  } catch (error) {
    console.error('Get sample data models count error:', error);
    return NextResponse.json(
      { error: 'Failed to get sample count', details: error.message },
      { status: 500 }
    );
  }
}
