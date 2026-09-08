import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/metadata/route.js
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

const VALID_CATEGORIES = ['tags', 'folders', 'environments'];
const MUTABLE_FIELDS = ['name', 'category', 'color', 'description', 'parentId', 'meta'];
const ensuredMetadataIndexes = new Set();

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj?.[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

async function ensureMetadataIndexes(db) {
  const key = `${db.databaseName}:metadata:v1`;
  if (ensuredMetadataIndexes.has(key)) return;
  const col = db.collection('metadata');
  await col.createIndexes([
    { key: { category: 1, name: 1 }, name: 'category_name_unique', unique: true },
    { key: { updatedAt: -1 }, name: 'updatedAt_desc' },
  ]);
  ensuredMetadataIndexes.add(key);
}

export async function GET(request) {
  console.log('API GET /api/metadata called');
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    console.log(`Fetching metadata for category: ${category}`);

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be one of: tags, folders, environments' },
        { status: 400 }
      );
    }

    const { db } = await getActiveTenantDb(request, { session });
    await ensureMetadataIndexes(db);

    const items = await db.collection('metadata').find({ category }).toArray();
    console.log(`Returning ${items.length} items for category: ${category}`);

    return NextResponse.json(items.map(i => ({ ...i, _id: i._id.toString() })));
  } catch (error) {
    console.error('GET /api/metadata error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const raw = await request.json();
    const body = pick(raw, MUTABLE_FIELDS);
    if (!body.name || !body.category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be one of: tags, folders, environments' },
        { status: 400 }
      );
    }

    const { db } = await getActiveTenantDb(request, { session });
    await ensureMetadataIndexes(db);

    body.createdBy = session.user.email;
    body.createdAt = new Date();
    body.updatedAt = new Date();
    body.updatedBy = session.user.email;

    const col = db.collection('metadata');

    // friendly check before the unique index enforces it
    const exists = await col.findOne({ category: body.category, name: body.name });
    if (exists) {
      return NextResponse.json({
        exists: true,
        item: { ...exists, _id: exists._id.toString() },
      });
    }

    const res = await col.insertOne(body);
    return NextResponse.json({
      success: true,
      _id: res.insertedId.toString(),
      ...body,
      createdAt: body.createdAt.toISOString(),
      updatedAt: body.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('POST /api/metadata error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const raw = await request.json();
    if (!raw._id || !raw.name || !raw.category) {
      return NextResponse.json({ error: 'ID, name, and category are required' }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(raw.category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be one of: tags, folders, environments' },
        { status: 400 }
      );
    }

    const { db } = await getActiveTenantDb(request, { session });
    const col = db.collection('metadata');

    const body = pick(raw, MUTABLE_FIELDS);
    body.updatedAt = new Date();
    body.updatedBy = session.user.email;
    const update = body;

    const res = await col.updateOne(
      { _id: new ObjectId(raw._id), category: raw.category },
      { $set: update }
    );

    if (!res.matchedCount) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      _id: raw._id,
      ...update,
      updatedAt: update.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('PUT /api/metadata error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id, category } = await request.json();
    if (!id || !category) {
      return NextResponse.json({ error: 'ID and category are required' }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be one of: tags, folders, environments' },
        { status: 400 }
      );
    }

    const { db } = await getActiveTenantDb(request, { session });
    const res = await db.collection('metadata').deleteOne({ _id: new ObjectId(id), category });

    if (!res.deletedCount) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deletedCount: res.deletedCount });
  } catch (error) {
    console.error('DELETE /api/metadata error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
