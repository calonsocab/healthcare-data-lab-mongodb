import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { buildContextObjectDraftFromDataModel } from '@/lib/contextObjects/dataModelImport';

const COLLECTION_NAME = 'user-data-models';

export async function GET(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Data model ID is required' }, { status: 400 });
    }
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid data model ID' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const doc = await db.collection(COLLECTION_NAME).findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return NextResponse.json({ error: 'Data model not found' }, { status: 404 });
    }

    const draft = buildContextObjectDraftFromDataModel({
      ...doc,
      _id: doc._id.toString(),
    });

    return NextResponse.json({
      draft,
      importSource: draft?.metadata?.importSource || null,
    });
  } catch (error) {
    console.error('GET /api/context-objects/import-from-data-model/[id] error:', error);
    const status = error.message === 'This data model cannot be imported as a ContextObject' ? 400 : 500;
    return NextResponse.json(
      { error: error.message || 'Failed to build ContextObject draft from data model' },
      { status }
    );
  }
}
