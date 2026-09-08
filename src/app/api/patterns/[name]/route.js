import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/patterns/[name]/route.js
import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { canonicalizeDocumentType, getDocumentTypeVariants } from '@/lib/mappings/documentType';

const COLLECTION = 'document_patterns';

export async function GET(request, props) {
  const params = await props.params;
  try {
    const { name } = params;
    const canonicalName = canonicalizeDocumentType(name);
    const nameVariants = getDocumentTypeVariants(canonicalName);

    const { db } = await getActiveTenantDb(request);
    const col = db.collection(COLLECTION);

    const pattern = await col.findOne({ name: { $in: nameVariants } });

    if (!pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...pattern,
      name: canonicalName,
      _id: pattern._id.toString()
    });
  } catch (error) {
    console.error('GET /api/patterns/[name] error:', error);
    return NextResponse.json(
      { error: 'Failed to load pattern', details: error.message },
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

    const { name } = params;
    const canonicalName = canonicalizeDocumentType(name);
    const nameVariants = getDocumentTypeVariants(canonicalName);

    const { db } = await getActiveTenantDb(request);
    const col = db.collection(COLLECTION);

    const result = await col.deleteMany({ name: { $in: nameVariants } });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
    }

    return NextResponse.json({ name: canonicalName, status: 'deleted' });
  } catch (error) {
    console.error('DELETE /api/patterns/[name] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete pattern', details: error.message },
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

    const { name } = params;
    const canonicalName = canonicalizeDocumentType(name);
    const nameVariants = getDocumentTypeVariants(canonicalName);
    const body = await request.json();

    const { db } = await getActiveTenantDb(request);
    const col = db.collection(COLLECTION);

    const now = new Date();
    const updateData = {
      handler: body.handler || 'xml',
      priority: Number(body.priority) || 50,
      required_elements: Array.isArray(body.required_elements)
        ? body.required_elements.map(e => String(e).trim()).filter(Boolean)
        : [],
      xpath_patterns: Array.isArray(body.xpath_patterns)
        ? body.xpath_patterns.map(e => String(e).trim()).filter(Boolean)
        : [],
      namespaces: typeof body.namespaces === 'object' && body.namespaces !== null
        ? body.namespaces
        : {},
      csv_headers: Array.isArray(body.csv_headers)
        ? body.csv_headers.map(e => String(e).trim().toLowerCase()).filter(Boolean)
        : [],
      exclude_elements: Array.isArray(body.exclude_elements)
        ? body.exclude_elements.map(e => String(e).trim()).filter(Boolean)
        : [],
      updatedAt: now,
      updatedBy: session.user.email || session.user.name || 'unknown'
    };

    const canonicalExisting = await col.findOne(
      { name: canonicalName },
      { projection: { _id: 1 } }
    );

    const result = await col.updateOne(
      canonicalExisting ? { _id: canonicalExisting._id } : { name: { $in: nameVariants } },
      { $set: { ...updateData, name: canonicalName } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
    }

    const aliasNames = nameVariants.filter((candidate) => candidate !== canonicalName);
    if (aliasNames.length > 0) {
      await col.deleteMany({ name: { $in: aliasNames } });
    }

    return NextResponse.json({ name: canonicalName, ...updateData, status: 'updated' });
  } catch (error) {
    console.error('PUT /api/patterns/[name] error:', error);
    return NextResponse.json(
      { error: 'Failed to update pattern', details: error.message },
      { status: 500 }
    );
  }
}
