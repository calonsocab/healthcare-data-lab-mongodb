import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/data-model-catalog/route.js
// Now uses 'user-data-models' collection with domain field
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { ensureTemplateIndexes } from '@/lib/db/connectionManager';
import { computeWebTemplateMetadata, extractTemplateVersion } from '@/lib/templates';
import { escapeRegex } from '@/lib/utils';
import {
  enforceApiRateLimit,
  enforceNumericLimit,
  resolvePolicyContext
} from '@/lib/security/teamPolicy';
import { parseJsonWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';

const COLLECTION_NAME = 'user-data-models';
const ALLOWED_FHIR_ARTIFACT_TYPES = new Set(['StructureDefinition', 'ValueSet', 'CodeSystem']);

function normalizeOpenEhrSource(source = {}) {
  const type = source.type || 'web';
  return {
    type,
    fileName: source.fileName || null,
    contentType: source.contentType || (type === 'opt' ? 'application/xml' : 'application/json'),
    size: source.size ?? null,
    ...(type === 'opt' && typeof source.xml === 'string' ? { xml: source.xml } : {})
  };
}

function isAllowedFhirArtifact(resourceType) {
  return typeof resourceType === 'string' && ALLOWED_FHIR_ARTIFACT_TYPES.has(resourceType);
}

function toOpenEhrResponse(doc) {
  // Support both legacy format (webTemplate at root) and new format (domainData.webTemplate)
  const tree = doc?.domainData?.webTemplate || doc?.webTemplate || null;
  const source = doc?.domainData?.source || doc?.source || null;
  return {
    ...doc,
    webTemplate: tree,
    source
  };
}

function toFhirResponse(doc) {
  return {
    ...doc,
    resourceType: doc?.domainData?.resourceType || 'Unknown',
    data: doc?.domainData?.resource || null,
    source: doc?.domainData?.source || null
  };
}

function toContextResponse(doc) {
  return {
    ...doc,
    data: doc?.domainData?.schema || null,
    source: doc?.domainData?.source || null
  };
}

function mapTemplateResponse(doc) {
  if (!doc) return doc;
  if (doc.domain === 'openehr' || !doc.domain) return toOpenEhrResponse(doc);
  if (doc.domain === 'fhir') return toFhirResponse(doc);
  if (doc.domain === 'contextobject') return toContextResponse(doc);
  return doc;
}

function normalizeCatalogDomain(domain) {
  if (!domain) return null;
  if (domain === 'context') return 'contextobject';
  return domain;
}

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '0', 10);
    const search = url.searchParams.get('search') || '';
    const summary = url.searchParams.get('summary') !== '0';
    const sortBy = url.searchParams.get('sort') || 'name'; // 'name', 'recent', 'created'
    const domain = normalizeCatalogDomain(url.searchParams.get('domain')); // 'openehr', 'fhir', 'contextobject', or null for all

    const { db, environment } = await getActiveTenantDb(request);
    await ensureTemplateIndexes(db);

    const col = db.collection(COLLECTION_NAME);

    // Build query with optional domain filter
    const query = {};
    if (domain) {
      query.domain = domain;
    }
    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { 'metadata.description': { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { 'domainData.resourceType': { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const projection = summary ? {
      name: 1,
      domain: 1,
      templateVersion: 1,
      description: 1, // For FHIR/Context
      // New format (domainData.*)
      'domainData.webTemplate.nodeId': 1,
      'domainData.webTemplate.rmType': 1,
      'domainData.resourceType': 1,
      'domainData.source.type': 1,
      'domainData.source.fileName': 1,
      'domainData.source.contentType': 1,
      'domainData.source.size': 1,
      // Legacy format (fields at root)
      'webTemplate.nodeId': 1,
      'webTemplate.rmType': 1,
      'webTemplate.metadata': 1,
      'source.type': 1,
      'source.fileName': 1,
      'source.contentType': 1,
      'source.size': 1,
      metadata: 1,
      audit: 1,
      analyticsTemplate: 1,
      // FHIR-specific
      resourceType: 1,
      // Context-specific
      schema: 1
    } : undefined;

    // Determine sort order
    let sortOrder = { name: 1 };
    if (sortBy === 'recent') {
      sortOrder = { 'audit.updatedAt': -1, 'audit.createdAt': -1, name: 1 };
    } else if (sortBy === 'created') {
      sortOrder = { 'audit.createdAt': -1, name: 1 };
    }

    const total = await col.countDocuments(query);
    const cursor = col.find(query, projection ? { projection } : undefined).sort(sortOrder);
    if (limit > 0) cursor.skip((page - 1) * limit).limit(limit);
    const items = await cursor.toArray();

    // Get counts by domain
    const domainCounts = await col.aggregate([
      { $group: { _id: '$domain', count: { $sum: 1 } } }
    ]).toArray();
    const counts = {
      openehr: 0,
      fhir: 0,
      contextobject: 0,
      ...Object.fromEntries(domainCounts.map(d => [d._id || 'openehr', d.count]))
    };

    return NextResponse.json({
      total, page, limit,
      counts,
      items: items.map((t) => {
        const domainValue = t.domain || 'openehr';
        const normalized = mapTemplateResponse({ ...t, domain: domainValue });
        return {
          ...normalized,
          _id: t._id.toString(),
          domain: domainValue, // Default for legacy docs
          environmentId: environment.id,
          environmentName: environment.name
        };
      })
    });
  } catch (e) {
    console.error('GET /api/data-model-catalog error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const policyContext = await resolvePolicyContext(coreDb, session.user.email);
    await enforceApiRateLimit(coreDb, policyContext, 'data-model-catalog:post');

    const fallbackMaxBytes = 25 * 1024 * 1024; // 25MB safety cap
    const policyMaxBytes = policyContext?.policy?.limits?.maxUploadFileBytes;
    const maxBytes = Number.isFinite(policyMaxBytes) && policyMaxBytes > 0
      ? Math.min(fallbackMaxBytes, policyMaxBytes + (1 * 1024 * 1024))
      : fallbackMaxBytes;

    const body = await parseJsonWithLimit(request, maxBytes);

    const uploadBytes = Buffer.byteLength(JSON.stringify(body || {}), 'utf8');
    enforceNumericLimit(
      policyContext?.policy?.limits?.maxUploadFileBytes,
      uploadBytes,
      {
        code: 'TEAM_MODEL_UPLOAD_TOO_LARGE',
        status: 413,
        message: 'Model payload exceeds team upload size policy',
        details: {
          bytes: uploadBytes,
          maxUploadFileBytes: policyContext?.policy?.limits?.maxUploadFileBytes
        }
      }
    );

    const domain = normalizeCatalogDomain(body.domain || 'openehr');

    if (!body?.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    await ensureTemplateIndexes(db);
    const col = db.collection(COLLECTION_NAME);

    // Handle different domains differently
    if (domain === 'openehr') {
      // OpenEHR templates - require webTemplate
      const incomingWebTemplate = body?.domainData?.webTemplate;
      const incomingTree = incomingWebTemplate?.tree || incomingWebTemplate;
      const incomingSource = body?.domainData?.source;

      if (!incomingTree) {
        return NextResponse.json({ error: 'domainData.webTemplate is required for OpenEHR' }, { status: 400 });
      }
      if (!incomingSource?.type) {
        return NextResponse.json({ error: 'domainData.source.type is required ("web" | "opt")' }, { status: 400 });
      }
      if (incomingSource.type === 'opt' && typeof incomingSource.xml !== 'string') {
        return NextResponse.json({ error: 'domainData.source.xml is required for type "opt"' }, { status: 400 });
      }

      // compute semantic-only metadata on server
      const extras = {
        templateId: body.templateId || body?.metadata?.templateId || body.name,
        defaultLanguage: body?.metadata?.defaultLanguage
      };
      const computed = computeWebTemplateMetadata(incomingTree, extras);
      const metadata = { ...computed, ...(body.metadata || {}) };
      const source = normalizeOpenEhrSource(incomingSource);
      const tree = { ...incomingTree, metadata };

      if (body.name && !body.templateVersion) {
        const { version } = extractTemplateVersion(body.name);
        if (version) body.templateVersion = version;
      }

      const existing = await col.findOne({ name: body.name, domain: 'openehr' });
      if (existing) {
        await col.updateOne(
          { _id: existing._id },
          {
            $set: {
              name: body.name,
              domain: 'openehr',
              templateVersion: body.templateVersion,
              metadata,
              domainData: {
                webTemplate: tree,
                source
              },
              'audit.updatedAt': new Date(),
              'audit.updatedBy': session.user.email
            }
          }
        );
        return NextResponse.json({ updated: true, id: existing._id.toString(), domain: 'openehr' });
      } else {
        const countBeforeInsert = await col.countDocuments({});
        enforceNumericLimit(
          policyContext?.policy?.limits?.maxDataModels,
          countBeforeInsert + 1,
          {
            code: 'TEAM_MAX_DATA_MODELS_EXCEEDED',
            status: 429,
            message: 'Team reached the maximum number of data models',
            details: {
              current: countBeforeInsert,
              attempted: countBeforeInsert + 1,
              maxDataModels: policyContext?.policy?.limits?.maxDataModels
            }
          }
        );
        const doc = {
          name: body.name,
          domain: 'openehr',
          templateVersion: body.templateVersion || null,
          metadata,
          domainData: {
            webTemplate: tree,
            source
          },
          audit: {
            createdAt: new Date(),
            createdBy: session.user.email
          }
        };
        const res = await col.insertOne(doc);
        return NextResponse.json({ inserted: true, id: res.insertedId.toString(), domain: 'openehr' });
      }
    } else if (domain === 'fhir') {
      // FHIR artifacts (profiles/terminology) only
      const incomingResource = body?.domainData?.resource || body?.domainData?.data || null;
      if (!incomingResource) {
        return NextResponse.json({ error: 'domainData.resource (FHIR resource JSON) is required' }, { status: 400 });
      }
      const resourceType = incomingResource.resourceType || body.domainData.resourceType || 'Unknown';
      if (!isAllowedFhirArtifact(resourceType)) {
        return NextResponse.json({
          error: `Unsupported FHIR resourceType "${resourceType}". Allowed types: StructureDefinition, ValueSet, CodeSystem.`
        }, { status: 400 });
      }

      const existing = await col.findOne({ name: body.name, domain: 'fhir' });
      if (existing) {
        await col.updateOne(
          { _id: existing._id },
          {
            $set: {
              name: body.name,
              domain: 'fhir',
              description: body.description || '',
              domainData: {
                resourceType,
                resource: incomingResource,
                source: {
                  type: 'json',
                  fileName: body.domainData.source?.fileName || null,
                  size: body.domainData.source?.size ?? null
                }
              },
              'audit.updatedAt': new Date(),
              'audit.updatedBy': session.user.email
            }
          }
        );
        return NextResponse.json({ updated: true, id: existing._id.toString(), domain: 'fhir' });
      } else {
        const countBeforeInsert = await col.countDocuments({});
        enforceNumericLimit(
          policyContext?.policy?.limits?.maxDataModels,
          countBeforeInsert + 1,
          {
            code: 'TEAM_MAX_DATA_MODELS_EXCEEDED',
            status: 429,
            message: 'Team reached the maximum number of data models',
            details: {
              current: countBeforeInsert,
              attempted: countBeforeInsert + 1,
              maxDataModels: policyContext?.policy?.limits?.maxDataModels
            }
          }
        );
        const doc = {
          name: body.name,
          domain: 'fhir',
          description: body.description || '',
          domainData: {
            resourceType,
            resource: incomingResource,
            source: {
              type: 'json',
              fileName: body.domainData.source?.fileName || null,
              size: body.domainData.source?.size ?? null
            }
          },
          audit: {
            createdAt: new Date(),
            createdBy: session.user.email
          }
        };
        const res = await col.insertOne(doc);
        return NextResponse.json({ inserted: true, id: res.insertedId.toString(), domain: 'fhir' });
      }
    } else if (domain === 'contextobject') {
      // Context Objects - store the JSON schema directly
      if (!body?.domainData?.schema) {
        return NextResponse.json({ error: 'domainData.schema (context object JSON) is required' }, { status: 400 });
      }

      const existing = await col.findOne({ name: body.name, domain: 'contextobject' });
      if (existing) {
        await col.updateOne(
          { _id: existing._id },
          {
            $set: {
              name: body.name,
              domain: 'contextobject',
              description: body.description || '',
              domainData: {
                schema: body.domainData.schema,
                source: {
                  type: 'json',
                  fileName: body.domainData.source?.fileName || null,
                  size: body.domainData.source?.size ?? null
                }
              },
              'audit.updatedAt': new Date(),
              'audit.updatedBy': session.user.email
            }
          }
        );
        return NextResponse.json({ updated: true, id: existing._id.toString(), domain: 'contextobject' });
      } else {
        const countBeforeInsert = await col.countDocuments({});
        enforceNumericLimit(
          policyContext?.policy?.limits?.maxDataModels,
          countBeforeInsert + 1,
          {
            code: 'TEAM_MAX_DATA_MODELS_EXCEEDED',
            status: 429,
            message: 'Team reached the maximum number of data models',
            details: {
              current: countBeforeInsert,
              attempted: countBeforeInsert + 1,
              maxDataModels: policyContext?.policy?.limits?.maxDataModels
            }
          }
        );
        const doc = {
          name: body.name,
          domain: 'contextobject',
          description: body.description || '',
          domainData: {
            schema: body.domainData.schema,
            source: {
              type: 'json',
              fileName: body.domainData.source?.fileName || null,
              size: body.domainData.source?.size ?? null
            }
          },
          audit: {
            createdAt: new Date(),
            createdBy: session.user.email
          }
        };
        const res = await col.insertOne(doc);
        return NextResponse.json({ inserted: true, id: res.insertedId.toString(), domain: 'contextobject' });
      }
    } else {
      return NextResponse.json({ error: `Unknown domain: ${domain}` }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    console.error('POST /api/data-model-catalog error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json(
      { code: e.code || null, error: e.message || 'Server error', details: e.details || null },
      { status }
    );
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Data model ID is required' }, { status: 400 });

    const { db } = await getActiveTenantDb(request);
    const { ObjectId } = await import('mongodb');
    const res = await db.collection(COLLECTION_NAME).deleteOne({ _id: new ObjectId(id) });
    if (!res.deletedCount) return NextResponse.json({ error: 'Data model not found' }, { status: 404 });
    return NextResponse.json({ success: true, deletedCount: res.deletedCount });
  } catch (e) {
    console.error('DELETE /api/data-model-catalog error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
  }
}
