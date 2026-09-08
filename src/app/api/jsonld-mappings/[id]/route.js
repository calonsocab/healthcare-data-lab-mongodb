import { requireAuthenticatedUser } from '@/lib/security/api';
// app/api/jsonld-mappings/[id]/route.js
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';

const MUTABLE_FIELDS = ['templateName', 'config', 'notes'];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj?.[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

export async function GET(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params || {};
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { db, environment } = await getActiveTenantDb(request);

    const col = db.collection('jsonld-mappings');

    const doc = await col.findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (doc.environmentId && doc.environmentId !== environment.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ ...doc, _id: doc._id.toString() });
  } catch (err) {
    console.error('GET /api/jsonld-mappings/[id] error:', err);
    return NextResponse.json(
      { error: 'GET /api/jsonld-mappings/[id] failed', details: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params || {};
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const raw = await request.json();
    if (!raw) return NextResponse.json({ error: 'Body is required' }, { status: 400 });
    const payload = pick(raw, MUTABLE_FIELDS);

    const { db } = await getActiveTenantDb(request);
    const col = db.collection('jsonld-mappings');

    const res = await col.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...payload,
          updatedAt: new Date(),
          updatedBy: session.user.email,
        },
      }
    );

    if (!res.matchedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await col.findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ ...updated, _id: updated._id.toString() });
  } catch (err) {
    console.error('PUT /api/jsonld-mappings/[id] error:', err);
    return NextResponse.json(
      { error: 'PUT /api/jsonld-mappings/[id] failed', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params || {};
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { db } = await getActiveTenantDb(request);
    const col = db.collection('jsonld-mappings');

    const res = await col.deleteOne({ _id: new ObjectId(id) });
    if (!res.deletedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/jsonld-mappings/[id] error:', err);
    return NextResponse.json(
      { error: 'DELETE /api/jsonld-mappings/[id] failed', details: err.message },
      { status: 500 }
    );
  }
}
