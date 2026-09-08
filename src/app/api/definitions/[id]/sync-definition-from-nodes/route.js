import { requireAuthenticatedUser } from '@/lib/security/api';
// POST /api/definitions/:id/sync-definition-from-nodes
// Regenerate definition from nodes (INTERNAL-JSON or SPLASH-HIERARCHICAL)

import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { nodesToJsonSchema } from '@/lib/definitions/types';
import {
  HIERARCHICAL_DEFINITION_FORMAT,
  nodesToHierarchicalDefinition
} from '@/lib/contextObjects/hierarchicalDefinition';

const COLLECTION_NAME = 'reusable_definitions';

export async function POST(request, props) {
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

    // Get the definition
    const definition = await collection.findOne({ id });

    if (!definition) {
      return NextResponse.json({ error: 'Definition not found' }, { status: 404 });
    }

    // Check if this is a custom supported definition format
    if (
      definition.origin !== 'custom'
      || !['INTERNAL-JSON', HIERARCHICAL_DEFINITION_FORMAT].includes(definition.definitionFormat)
    ) {
      return NextResponse.json(
        { error: 'Sync is only available for custom INTERNAL-JSON or SPLASH-HIERARCHICAL definitions' },
        { status: 400 }
      );
    }

    // Generate definition from nodes
    const nodes = definition.nodes || [];
    const generatedDefinition = definition.definitionFormat === HIERARCHICAL_DEFINITION_FORMAT
      ? nodesToHierarchicalDefinition(nodes, {
        name: definition.name,
        rmEntity: definition.rmType,
        archetypeId: definition.definition?.archetypeId
      })
      : nodesToJsonSchema(nodes);

    // Update the definition
    const now = new Date().toISOString();
    await collection.updateOne(
      { id },
      {
        $set: {
          definition: generatedDefinition,
          'metadata.updatedAt': now
        }
      }
    );

    // Return the updated definition
    const updatedDefinition = await collection.findOne(
      { id },
      { projection: { _id: 0 } }
    );

    return NextResponse.json(updatedDefinition);

  } catch (error) {
    console.error('Error syncing definition from nodes:', error);
    return NextResponse.json(
      { error: 'Failed to sync definition from nodes', details: error.message },
      { status: 500 }
    );
  }
}
