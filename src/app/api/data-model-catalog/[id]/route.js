import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/data-model-catalog/[id]/route.js
// Now uses 'user-data-models' collection with domain field
import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';

const COLLECTION_NAME = 'user-data-models';

function buildProjection({ includeTree, includeData, includeXml }) {
  const projection = {
    name: 1,
    domain: 1,
    templateVersion: 1,
    metadata: 1,
    description: 1,
    analyticsTemplate: 1,
    audit: 1,
    'domainData.resourceType': 1,
    'domainData.source.type': 1,
    'domainData.source.fileName': 1,
    'domainData.source.size': 1,
    'domainData.source.contentType': 1,
    'source.type': 1,
    'source.fileName': 1,
    'source.size': 1,
    'source.contentType': 1,
  };

  if (includeTree) {
    projection['domainData.webTemplate'] = 1;
    projection.webTemplate = 1;
  } else {
    projection['domainData.webTemplate.nodeId'] = 1;
    projection['domainData.webTemplate.rmType'] = 1;
    projection['webTemplate.nodeId'] = 1;
    projection['webTemplate.rmType'] = 1;
  }
  if (includeData) {
    projection['domainData.resource'] = 1;
    projection['domainData.schema'] = 1;
  }
  if (includeXml) {
    projection['domainData.source.xml'] = 1;
    projection['source.xml'] = 1;
  }

  return projection;
}

export async function GET(req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    const url = new URL(req.url);
    const include = new Set((url.searchParams.get('include') || '').split(',').filter(Boolean));
    const includeTree = include.has('tree');
    const includeXml = include.has('xml');
    const includeData = include.has('data');

    const { db } = await getActiveTenantDb(req);
    const { ObjectId } = await import('mongodb');

    const projection = buildProjection({ includeTree, includeData, includeXml });
    const doc = await db.collection(COLLECTION_NAME).findOne(
      { _id: new ObjectId(id) },
      { projection }
    );
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const domain = doc.domain || 'openehr';

    // Build response based on domain
    let response;
    if (domain === 'openehr') {
      // Support both new format (domainData.webTemplate) and legacy format (webTemplate at root)
      const tree = doc?.domainData?.webTemplate || doc?.webTemplate || null;
      const source = doc?.domainData?.source || doc?.source || {};
      // OpenEHR templates - same shape as before
      response = {
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
          ...(includeXml && source?.xml ? { xml: source.xml } : {})
        },
        audit: doc.audit,
        analyticsTemplate: doc.analyticsTemplate
      };
      if (includeTree) {
        response.webTemplate = tree;
      } else {
        response.webTemplate = {
          nodeId: tree?.nodeId,
          rmType: tree?.rmType
        };
      }
    } else if (domain === 'fhir') {
      // FHIR resources
      response = {
        _id: doc._id.toString(),
        name: doc.name,
        domain: 'fhir',
        description: doc.description,
        analyticsTemplate: doc.analyticsTemplate,
        resourceType: doc?.domainData?.resourceType || 'Unknown',
        source: doc?.domainData?.source,
        audit: doc.audit
      };
      if (includeData) {
        response.data = doc?.domainData?.resource;
      }
    } else if (domain === 'contextobject') {
      // Context Objects
      response = {
        _id: doc._id.toString(),
        name: doc.name,
        domain: 'contextobject',
        description: doc.description,
        analyticsTemplate: doc.analyticsTemplate,
        source: doc?.domainData?.source,
        audit: doc.audit
      };
      if (includeData) {
        response.data = doc?.domainData?.schema;
      }
    } else {
      // Unknown domain - return full doc
      response = { ...doc, _id: doc._id.toString() };
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error('GET /api/data-model-catalog/[id] error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
  }
}
