import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/mappings/[mappingId]/route.js
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { buildTemplateSyntaxDisabledError, findDisallowedTemplateMarker } from '@/lib/mappings/security';
import { canonicalizeDocumentType, getDocumentTypeVariants } from '@/lib/mappings/documentType';

function parseId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

export async function GET(request, props) {
  const params = await props.params;
  try {
    const mappingId = parseId(params.mappingId);
    if (!mappingId) {
      return NextResponse.json({ error: 'Invalid mapping id' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const doc = await db.collection('mapping_definitions').findOne({ _id: mappingId });
    if (!doc) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...doc,
      _id: doc._id.toString(),
      documentType: canonicalizeDocumentType(doc.documentType)
    });
  } catch (error) {
    console.error('GET /api/mappings/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to load mapping', details: error.message },
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

    const mappingId = parseId(params.mappingId);
    if (!mappingId) {
      return NextResponse.json({ error: 'Invalid mapping id' }, { status: 400 });
    }

    const body = await request.json();
    const updates = {};

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.documentType !== undefined) {
      updates.documentType = canonicalizeDocumentType(String(body.documentType || '').trim());
    }
    if (body.description !== undefined) updates.description = body.description || '';
    if (body.sourceFormat !== undefined) updates.sourceFormat = body.sourceFormat || '';
    if (body.targetTemplate !== undefined) updates.targetTemplate = body.targetTemplate || '';
    if (body.yaml !== undefined) {
      const yamlValue = String(body.yaml || '');
      const jinjaMarker = findDisallowedTemplateMarker(yamlValue);
      if (jinjaMarker) {
        return NextResponse.json(
          buildTemplateSyntaxDisabledError('Mapping YAML', jinjaMarker),
          { status: 400 }
        );
      }
      updates.yaml = yamlValue;
    }
    if (body.tags !== undefined) {
      updates.tags = Array.isArray(body.tags)
        ? body.tags
        : String(body.tags || '')
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    updates.updatedAt = new Date();
    updates.updatedBy = session.user.email || session.user.name || 'unknown';

    const { db } = await getActiveTenantDb(request);
    const col = db.collection('mapping_definitions');

    if (updates.name || updates.documentType) {
      const match = [];
      if (updates.name) match.push({ name: updates.name });
      if (updates.documentType) {
        const typeVariants = getDocumentTypeVariants(updates.documentType);
        if (typeVariants.length) {
          match.push({ documentType: { $in: typeVariants } });
        }
      }
      const other = match.length
        ? await col.findOne({ _id: { $ne: mappingId }, $or: match })
        : null;
      if (other) {
        return NextResponse.json(
          { error: 'A mapping with that name already exists' },
          { status: 409 }
        );
      }
    }

    const res = await col.findOneAndUpdate(
      { _id: mappingId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    // Mongo driver compatibility:
    // - v5: returns { value: doc, ... }
    // - v6: may return doc directly depending on options/runtime
    const updatedDoc = res?.value ?? res ?? null;

    if (!updatedDoc || !updatedDoc._id) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...updatedDoc,
      _id: updatedDoc._id.toString(),
      documentType: canonicalizeDocumentType(updatedDoc.documentType)
    });
  } catch (error) {
    console.error('PUT /api/mappings/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update mapping', details: error.message },
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

    const mappingId = parseId(params.mappingId);
    if (!mappingId) {
      return NextResponse.json({ error: 'Invalid mapping id' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const col = db.collection('mapping_definitions');
    const res = await col.deleteOne({ _id: mappingId });

    if (!res.deletedCount) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    // Remove samples for this mapping as well
    await db.collection('mapping_samples').deleteMany({ mappingId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/mappings/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete mapping', details: error.message },
      { status: 500 }
    );
  }
}
