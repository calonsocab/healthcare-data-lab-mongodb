import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/type-template-associations/route.js
import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { canonicalizeDocumentType, getDocumentTypeVariants } from '@/lib/mappings/documentType';

const COLLECTION = 'type_template_associations';

export async function GET(request) {
  try {
    const { db } = await getActiveTenantDb(request);
    const col = db.collection(COLLECTION);

    const docs = await col.find({}).toArray();

    // Return as key-value object: { canonicalDocumentType: templateId }
    // When aliases exist, keep the newest association.
    const byType = docs.reduce((acc, doc) => {
      const canonicalType = canonicalizeDocumentType(doc.documentType);
      if (canonicalType && doc.templateId) {
        const prev = acc[canonicalType];
        const prevTs = prev?.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
        const nextTs = doc?.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
        if (!prev || nextTs >= prevTs) {
          acc[canonicalType] = doc;
        }
      }
      return acc;
    }, {});

    const associations = Object.entries(byType).reduce((acc, [canonicalType, doc]) => {
      if (doc?.templateId) {
        acc[canonicalType] = doc.templateId;
      }
      return acc;
    }, {});

    return NextResponse.json(associations);
  } catch (error) {
    console.error('GET /api/type-template-associations error:', error);
    return NextResponse.json(
      { error: 'Failed to load associations', details: error.message },
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
    const rawDocumentType = String(body.documentType || '').trim();
    const templateId = body.templateId;
    const documentType = canonicalizeDocumentType(rawDocumentType);

    if (!documentType) {
      return NextResponse.json({ error: 'documentType is required' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const col = db.collection(COLLECTION);

    const now = new Date();

    // Upsert: update if exists, insert if not
    await col.updateOne(
      { documentType },
      {
        $set: {
          documentType,
          templateId: templateId || null,
          updatedAt: now,
          updatedBy: session.user.email || session.user.name || 'unknown'
        },
        $setOnInsert: {
          createdAt: now,
          createdBy: session.user.email || session.user.name || 'unknown'
        }
      },
      { upsert: true }
    );

    const variants = getDocumentTypeVariants(documentType).filter((type) => type !== documentType);
    if (variants.length > 0) {
      await col.deleteMany({ documentType: { $in: variants } });
    }

    return NextResponse.json({ documentType, templateId, status: 'saved' });
  } catch (error) {
    console.error('POST /api/type-template-associations error:', error);
    return NextResponse.json(
      { error: 'Failed to save association', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const rawDocumentType = searchParams.get('documentType');
    const documentType = canonicalizeDocumentType(rawDocumentType);

    if (!documentType) {
      return NextResponse.json({ error: 'documentType is required' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const col = db.collection(COLLECTION);

    const variants = getDocumentTypeVariants(documentType);
    await col.deleteMany({ documentType: { $in: variants } });

    return NextResponse.json({ documentType, status: 'deleted' });
  } catch (error) {
    console.error('DELETE /api/type-template-associations error:', error);
    return NextResponse.json(
      { error: 'Failed to delete association', details: error.message },
      { status: 500 }
    );
  }
}
