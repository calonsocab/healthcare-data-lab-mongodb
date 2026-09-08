import { requireAuthenticatedUser } from '@/lib/security/api';
// app/api/jsonld-mappings/route.js

import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { escapeRegex } from '@/lib/utils';

const MUTABLE_FIELDS = ['templateName', 'config', 'notes'];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj?.[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { db, environment } = await getActiveTenantDb(request);
    const col = db.collection('jsonld-mappings');

    const url = new URL(request.url);
    const search = (url.searchParams.get('search') || '').trim();
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 200);

    const escapedSearch = search ? escapeRegex(search) : '';
    const filter = search
      ? {
          $or: [
            { templateName: { $regex: escapedSearch, $options: 'i' } },
            { 'config.type': { $regex: escapedSearch, $options: 'i' } },
          ],
        }
      : {};

    const total = await col.countDocuments(filter);
    const cursor = col.find(filter).sort({ templateName: 1 }).skip((page - 1) * limit).limit(limit);
    const items = await cursor.toArray();

    return NextResponse.json({
      total,
      page,
      limit,
      environmentId: environment.id,
      items: items.map(d => ({ ...d, _id: d._id.toString() })),
    });
  } catch (err) {
    console.error('GET /api/jsonld-mappings error:', err);
    return NextResponse.json(
      { error: 'GET /api/jsonld-mappings failed', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const raw = await request.json();
    const body = pick(raw, MUTABLE_FIELDS);
    if (!body?.templateName || !body?.config?.type) {
      return NextResponse.json({ error: 'templateName and config.type are required' }, { status: 400 });
    }

    const { db, environment } = await getActiveTenantDb(request);
    const col = db.collection('jsonld-mappings');

    const doc = {
      ...body,
      createdAt: new Date(),
      createdBy: session.user.email,
      environmentId: environment.id,
      updatedAt: null,
      updatedBy: null,
    };

    const res = await col.insertOne(doc);
    return NextResponse.json({ _id: res.insertedId.toString(), ...doc }, { status: 201 });
  } catch (err) {
    console.error('POST /api/jsonld-mappings error:', err);
    return NextResponse.json(
      { error: 'POST /api/jsonld-mappings failed', details: err.message },
      { status: 500 }
    );
  }
}
