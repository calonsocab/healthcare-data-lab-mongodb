import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/patterns/route.js
import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { canonicalizeDocumentType, getDocumentTypeVariants } from '@/lib/mappings/documentType';

const COLLECTION = 'document_patterns';

async function ensureIndexes(col) {
  try {
    await col.createIndex({ name: 1 }, { unique: true });
    await col.createIndex({ handler: 1 });
    await col.createIndex({ priority: -1 });
  } catch (err) {
    console.warn('Unable to create pattern indexes:', err.message);
  }
}

export async function GET(request) {
  try {
    const { db } = await getActiveTenantDb(request);
    const col = db.collection(COLLECTION);
    await ensureIndexes(col);

    const rawPatterns = await col.find({})
      .sort({ priority: -1, name: 1 })
      .toArray();

    const dedupedPatterns = [];
    const seenNames = new Set();
    for (const pattern of rawPatterns) {
      const canonicalName = canonicalizeDocumentType(pattern.name);
      if (seenNames.has(canonicalName)) continue;
      seenNames.add(canonicalName);
      dedupedPatterns.push({
        ...pattern,
        name: canonicalName
      });
    }

    return NextResponse.json({
      patterns: dedupedPatterns.map(p => ({
        ...p,
        _id: p._id.toString()
      }))
    });
  } catch (error) {
    console.error('GET /api/patterns error:', error);
    return NextResponse.json(
      { error: 'Failed to load patterns', details: error.message },
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
    const { name, handler = 'xml', priority = 50 } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Pattern name is required' }, { status: 400 });
    }
    const normalizedName = canonicalizeDocumentType(name.trim());
    const nameVariants = getDocumentTypeVariants(normalizedName);

    const { db } = await getActiveTenantDb(request);
    const col = db.collection(COLLECTION);
    await ensureIndexes(col);

    const now = new Date();
    const patternDoc = {
      name: normalizedName,
      handler,
      priority: Number(priority) || 50,
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
      { name: normalizedName },
      { projection: { _id: 1 } }
    );

    // Upsert by name
    const result = await col.updateOne(
      canonicalExisting ? { _id: canonicalExisting._id } : { name: { $in: nameVariants } },
      {
        $set: patternDoc,
        $setOnInsert: {
          createdAt: now,
          createdBy: session.user.email || session.user.name || 'unknown'
        }
      },
      { upsert: true }
    );

    const aliasNames = nameVariants.filter((candidate) => candidate !== normalizedName);
    if (aliasNames.length > 0) {
      await col.deleteMany({ name: { $in: aliasNames } });
    }

    return NextResponse.json({
      ...patternDoc,
      _id: result.upsertedId?.toString() || 'updated',
      status: result.upsertedCount > 0 ? 'created' : 'updated'
    });
  } catch (error) {
    console.error('POST /api/patterns error:', error);

    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'A pattern with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save pattern', details: error.message },
      { status: 500 }
    );
  }
}
