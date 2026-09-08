import { requireAuthenticatedUser } from '@/lib/security/api';
// GET /api/definitions/:id/nodes - Get nodes for a definition

import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';

const COLLECTION_NAME = 'reusable_definitions';

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

    const coreDb = await getCoreDb();
    const collection = coreDb.collection(COLLECTION_NAME);

    const definition = await collection.findOne(
      { id },
      { projection: { _id: 0, nodes: 1 } }
    );

    if (!definition) {
      return NextResponse.json({ error: 'Definition not found' }, { status: 404 });
    }

    return NextResponse.json({
      nodes: definition.nodes || []
    });

  } catch (error) {
    console.error('Error fetching definition nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch definition nodes', details: error.message },
      { status: 500 }
    );
  }
}
