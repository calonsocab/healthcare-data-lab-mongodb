import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/data-models/[id]/route.js
/**
 * Individual Data Model API
 * Canonical storage: user-data-models
 */

import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';

const COLLECTION_NAME = 'user-data-models';

function normalizeCatalogDomain(domain) {
  if (!domain) return 'openehr';
  if (domain === 'context') return 'contextobject';
  return domain;
}

function mapDoc(doc, include = new Set()) {
  const domain = normalizeCatalogDomain(doc.domain);

  if (domain === 'openehr') {
    const tree = doc?.domainData?.webTemplate || null;
    const source = doc?.domainData?.source || {};
    const response = {
      _id: doc._id.toString(),
      name: doc.name,
      domain: 'openehr',
      templateVersion: doc.templateVersion,
      metadata: doc.metadata || tree?.metadata || {},
      source: {
        type: source?.type,
        fileName: source?.fileName,
        size: source?.size,
        contentType: source?.contentType,
      },
      audit: doc.audit,
      analyticsTemplate: doc.analyticsTemplate,
    };

    if (include.has('xml') && source?.xml) {
      response.source.xml = source.xml;
    }

    if (include.has('tree') || include.has('domainData') || include.has('*')) {
      response.webTemplate = tree;
      response.domainData = doc.domainData;
    } else {
      response.webTemplate = {
        nodeId: tree?.nodeId,
        rmType: tree?.rmType,
      };
    }

    return response;
  }

  if (domain === 'fhir') {
    const response = {
      _id: doc._id.toString(),
      name: doc.name,
      domain: 'fhir',
      description: doc.description,
      resourceType: doc?.domainData?.resourceType || 'Unknown',
      source: doc?.domainData?.source,
      audit: doc.audit,
    };

    if (include.has('data') || include.has('domainData') || include.has('*')) {
      response.data = doc?.domainData?.resource;
      response.domainData = doc.domainData;
    }

    return response;
  }

  if (domain === 'contextobject') {
    const response = {
      _id: doc._id.toString(),
      name: doc.name,
      domain: 'contextobject',
      description: doc.description,
      source: doc?.domainData?.source,
      audit: doc.audit,
    };

    if (include.has('data') || include.has('domainData') || include.has('*')) {
      response.data = doc?.domainData?.schema || doc?.domainData?.semanticObject;
      response.domainData = doc.domainData;
    }

    return response;
  }

  return { ...doc, _id: doc._id.toString(), domain };
}

export async function GET(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const url = new URL(request.url);
    const include = new Set((url.searchParams.get('include') || '').split(',').filter(Boolean));

    const { db, environment } = await getActiveTenantDb(request);
    const { ObjectId } = await import('mongodb');

    const doc = await db.collection(COLLECTION_NAME).findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ error: 'Data model not found' }, { status: 404 });

    const mapped = mapDoc(doc, include);
    return NextResponse.json({
      ...mapped,
      environmentId: environment.id,
      environmentName: environment.name,
    });
  } catch (e) {
    console.error('GET /api/data-models/[id] error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
  }
}

export async function PUT(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const body = await request.json();
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'Update data is required' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const { ObjectId } = await import('mongodb');
    const col = db.collection(COLLECTION_NAME);

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Data model not found' }, { status: 404 });

    const updateFields = {};

    ['name', 'description', 'templateVersion', 'metadata'].forEach((field) => {
      if (body[field] !== undefined) updateFields[field] = body[field];
    });

    if (body.domainData) {
      updateFields.domainData = {
        ...existing.domainData,
        ...body.domainData,
      };
    }

    updateFields['audit.updatedAt'] = new Date();
    updateFields['audit.updatedBy'] = session.user.email;

    await col.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

    const updated = await col.findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true, ...mapDoc(updated, new Set(['domainData', 'data', 'tree'])) });
  } catch (e) {
    console.error('PUT /api/data-models/[id] error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
  }
}

export async function DELETE(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const { db } = await getActiveTenantDb(request);
    const { ObjectId } = await import('mongodb');

    const res = await db.collection(COLLECTION_NAME).deleteOne({ _id: new ObjectId(id) });
    if (!res.deletedCount) return NextResponse.json({ error: 'Data model not found' }, { status: 404 });

    return NextResponse.json({ success: true, id, deletedCount: res.deletedCount });
  } catch (e) {
    console.error('DELETE /api/data-models/[id] error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
  }
}
