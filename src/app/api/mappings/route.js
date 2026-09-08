import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/mappings/route.js
import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { buildTemplateSyntaxDisabledError, findDisallowedTemplateMarker } from '@/lib/mappings/security';
import { canonicalizeDocumentType, getDocumentTypeVariants } from '@/lib/mappings/documentType';

async function ensureIndexes(col) {
  try {
    await col.createIndex({ name: 1 }, { unique: true });
  } catch (err) {
    console.warn('Unable to create mapping index:', err.message);
  }
}

export async function GET(request) {
  try {
    const { db } = await getActiveTenantDb(request);
    const col = db.collection('mapping_definitions');
    await ensureIndexes(col);

    const items = await col.find({})
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json(
      items.map(doc => ({
        ...doc,
        _id: doc._id.toString(),
        documentType: canonicalizeDocumentType(doc.documentType)
      }))
    );
  } catch (error) {
    console.error('GET /api/mappings error:', error);
    return NextResponse.json(
      { error: 'Failed to load mappings', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const name = (body.name || '').trim();
    const rawDocumentType = body.documentType ? String(body.documentType).trim() : '';
    const documentType = canonicalizeDocumentType(rawDocumentType);
    const yaml = body.yaml || '';

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!yaml) {
      return NextResponse.json({ error: 'YAML definition is required' }, { status: 400 });
    }
    const jinjaMarker = findDisallowedTemplateMarker(yaml);
    if (jinjaMarker) {
      return NextResponse.json(
        buildTemplateSyntaxDisabledError('Mapping YAML', jinjaMarker),
        { status: 400 }
      );
    }

    const { db } = await getActiveTenantDb(request);
    const col = db.collection('mapping_definitions');
    await ensureIndexes(col);

    const now = new Date();
    const doc = {
      name,
      documentType,
      description: body.description || '',
      sourceFormat: body.sourceFormat || '',
      targetTemplate: body.targetTemplate || '',
      yaml,
      tags: Array.isArray(body.tags)
        ? body.tags
        : (body.tags ? String(body.tags).split(',').map(t => t.trim()).filter(Boolean) : []),
      createdAt: now,
      updatedAt: now,
      createdBy: session.user.email || session.user.name || 'unknown',
      updatedBy: session.user.email || session.user.name || 'unknown'
    };

    const documentTypeVariants = documentType ? getDocumentTypeVariants(documentType) : [];

    const existing = await col.findOne({
      $or: [
        { name },
        ...(documentTypeVariants.length ? [{ documentType: { $in: documentTypeVariants } }] : [])
      ]
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A mapping with that name already exists' },
        { status: 409 }
      );
    }

    const res = await col.insertOne(doc);
    return NextResponse.json(
      { ...doc, _id: res.insertedId.toString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/mappings error:', error);
    return NextResponse.json(
      { error: 'Failed to create mapping', details: error.message },
      { status: 500 }
    );
  }
}
