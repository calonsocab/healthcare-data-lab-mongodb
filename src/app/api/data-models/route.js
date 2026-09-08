import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/data-models/route.js
/**
 * Unified Data Models API (compatible with Catalog UI)
 *
 * Canonical storage collection: user-data-models
 * Canonical domains: openehr | fhir | contextobject
 */

import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { ensureTemplateIndexes } from '@/lib/db/connectionManager';
import { parseWithAutoDetect, parseWithDomain } from '@/lib/domains';
import { DATA_MODEL_SOURCES } from '@/lib/data-models';
import { computeWebTemplateMetadata } from '@/lib/templates';
import { escapeRegex } from '@/lib/utils';
import {
  enforceApiRateLimit,
  enforceNumericLimit,
  resolvePolicyContext
} from '@/lib/security/teamPolicy';
import { parseJsonWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';

const COLLECTION_NAME = 'user-data-models';
const ALLOWED_FHIR_ARTIFACT_TYPES = new Set(['StructureDefinition', 'ValueSet', 'CodeSystem']);

function normalizeCatalogDomain(domain) {
  if (!domain) return null;
  if (domain === 'context') return 'contextobject';
  return domain;
}

function isAllowedFhirArtifact(resourceType) {
  return typeof resourceType === 'string' && ALLOWED_FHIR_ARTIFACT_TYPES.has(resourceType);
}

function normalizeParserDomain(domain) {
  if (!domain) return null;
  if (domain === 'contextobject') return 'context';
  return domain;
}

function normalizeOpenEhrSource(source = {}) {
  const type = source.type || 'web';
  return {
    type,
    fileName: source.fileName || null,
    contentType: source.contentType || (type === 'opt' ? 'application/xml' : 'application/json'),
    size: source.size ?? null,
    ...(type === 'opt' && typeof source.xml === 'string' ? { xml: source.xml } : {}),
  };
}

function toOpenEhrResponse(doc) {
  return {
    ...doc,
    webTemplate: doc?.domainData?.webTemplate || null,
    source: doc?.domainData?.source || null,
  };
}

function toFhirResponse(doc) {
  return {
    ...doc,
    resourceType: doc?.domainData?.resourceType || 'Unknown',
    data: doc?.domainData?.resource || null,
    source: doc?.domainData?.source || null,
  };
}

function toContextResponse(doc) {
  return {
    ...doc,
    data: doc?.domainData?.schema || doc?.domainData?.semanticObject || null,
    source: doc?.domainData?.source || null,
  };
}

function mapDataModelResponse(doc) {
  if (!doc) return doc;
  const domain = normalizeCatalogDomain(doc.domain || 'openehr') || 'openehr';
  const normalizedDoc = { ...doc, domain };
  if (domain === 'openehr') return toOpenEhrResponse(normalizedDoc);
  if (domain === 'fhir') return toFhirResponse(normalizedDoc);
  if (domain === 'contextobject') return toContextResponse(normalizedDoc);
  return normalizedDoc;
}

function normalizeParsedModel(parsed, body = {}) {
  const sourceFileName = body.fileName || null;
  const inputDomain = normalizeCatalogDomain(parsed?.domain || body.domain || 'openehr') || 'openehr';

  if (inputDomain === 'openehr') {
    const tree = parsed?.domainData?.webTemplate || body?.domainData?.webTemplate || null;
    const metadataFromParser = parsed?.metadata?.domainMetadata || parsed?.metadata || {};
    const metadata = tree
      ? {
          ...computeWebTemplateMetadata(tree, {
            templateId: metadataFromParser?.templateId || parsed?.name,
            defaultLanguage: metadataFromParser?.defaultLanguage,
          }),
          ...metadataFromParser,
        }
      : metadataFromParser;

    const source = normalizeOpenEhrSource(
      parsed?.metadata?.domainMetadata?.source ||
      body?.domainData?.source ||
      {
        type: typeof body?.content === 'string' ? 'opt' : 'web',
        fileName: sourceFileName,
        ...(typeof body?.content === 'string' ? { xml: body.content } : {}),
      }
    );

    return {
      name: body.name || parsed?.name,
      domain: 'openehr',
      templateVersion: body.templateVersion || parsed?.version || null,
      metadata,
      domainData: {
        webTemplate: tree,
        source,
      },
      description: body.description || parsed?.description || metadata?.description || '',
    };
  }

  if (inputDomain === 'fhir') {
    const resource = parsed?.domainData?.resource || body?.domainData?.resource || body?.content;
    return {
      name: body.name || parsed?.name,
      domain: 'fhir',
      description: body.description || parsed?.description || '',
      domainData: {
        resourceType: parsed?.domainData?.resourceType || resource?.resourceType || 'Unknown',
        resource,
        source: {
          type: 'json',
          fileName: sourceFileName,
          size: body?.domainData?.source?.size ?? null,
        },
      },
    };
  }

  const semantic =
    parsed?.domainData?.semanticObject ||
    parsed?.domainData?.schema ||
    parsed?.domainData ||
    body?.domainData?.schema ||
    body?.content;

  return {
    name: body.name || parsed?.name,
    domain: 'contextobject',
    description: body.description || parsed?.description || '',
    domainData: {
      schema: semantic,
      source: {
        type: 'json',
        fileName: sourceFileName,
        size: body?.domainData?.source?.size ?? null,
      },
    },
  };
}

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const search = url.searchParams.get('search') || '';
    const summary = url.searchParams.get('summary') !== 'false';
    const sortBy = url.searchParams.get('sort') || 'name';
    const requestedDomain = normalizeCatalogDomain(url.searchParams.get('domain'));

    const { db, environment } = await getActiveTenantDb(request);
    await ensureTemplateIndexes(db);

    const col = db.collection(COLLECTION_NAME);
    const query = {};

    if (requestedDomain) {
      query.domain = requestedDomain;
    }

    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { 'metadata.description': { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { 'domainData.resourceType': { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const projection = summary
      ? {
          name: 1,
          domain: 1,
          templateVersion: 1,
          description: 1,
          'domainData.webTemplate.nodeId': 1,
          'domainData.webTemplate.rmType': 1,
          'domainData.resourceType': 1,
          metadata: 1,
          'domainData.source.type': 1,
          'domainData.source.fileName': 1,
          'domainData.source.contentType': 1,
          'domainData.source.size': 1,
          audit: 1,
          analyticsTemplate: 1,
        }
      : undefined;

    let sortOrder = { name: 1 };
    if (sortBy === 'recent') {
      sortOrder = { 'audit.updatedAt': -1, 'audit.createdAt': -1, name: 1 };
    } else if (sortBy === 'created') {
      sortOrder = { 'audit.createdAt': -1, name: 1 };
    } else if (sortBy === 'domain') {
      sortOrder = { domain: 1, name: 1 };
    }

    const total = await col.countDocuments(query);
    const cursor = col.find(query, projection ? { projection } : undefined).sort(sortOrder);
    if (limit > 0) cursor.skip((page - 1) * limit).limit(limit);
    const items = await cursor.toArray();

    const domainCounts = await col.aggregate([
      { $group: { _id: '$domain', count: { $sum: 1 } } },
    ]).toArray();

    const rawCounts = Object.fromEntries(domainCounts.map((d) => [normalizeCatalogDomain(d._id) || 'openehr', d.count]));

    const byDomain = {
      openehr: rawCounts.openehr || 0,
      fhir: rawCounts.fhir || 0,
      context: rawCounts.contextobject || 0,
      contextobject: rawCounts.contextobject || 0,
    };

    return NextResponse.json({
      total,
      page,
      limit,
      counts: {
        total,
        byDomain,
      },
      items: items.map((item) => {
        const mapped = mapDataModelResponse({ ...item, domain: normalizeCatalogDomain(item.domain) || 'openehr' });
        return {
          ...mapped,
          _id: item._id.toString(),
          environmentId: environment.id,
          environmentName: environment.name,
        };
      }),
    });
  } catch (e) {
    console.error('GET /api/data-models error:', e);
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
    await enforceApiRateLimit(coreDb, policyContext, 'data-models:post');

    const fallbackMaxBytes = 25 * 1024 * 1024; // 25MB safety cap
    const policyMaxBytes = policyContext?.policy?.limits?.maxUploadFileBytes;
    const maxBytes = Number.isFinite(policyMaxBytes) && policyMaxBytes > 0
      ? Math.min(fallbackMaxBytes, policyMaxBytes + (1 * 1024 * 1024))
      : fallbackMaxBytes;

    const body = await parseJsonWithLimit(request, maxBytes);

    const uploadBytes = Buffer.byteLength(
      JSON.stringify(body?.content ?? body?.dataModel ?? body ?? {}),
      'utf8'
    );
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

    let parsedModel = null;

    if (body.dataModel) {
      parsedModel = body.dataModel;
    } else if (body.content !== undefined) {
      const fileName = body.fileName || '';
      const explicitDomain = normalizeParserDomain(body.domain);

      const parseResult = explicitDomain
        ? await parseWithDomain(explicitDomain, body.content, {
            fileName,
            source: DATA_MODEL_SOURCES.UPLOAD,
          })
        : await parseWithAutoDetect(body.content, {
            fileName,
            source: DATA_MODEL_SOURCES.UPLOAD,
          });

      if (!parseResult.success) {
        return NextResponse.json(
          { error: parseResult.error || 'Failed to parse content' },
          { status: 400 }
        );
      }

      parsedModel = parseResult.dataModel;
    } else {
      return NextResponse.json(
        { error: 'Either content or dataModel is required' },
        { status: 400 }
      );
    }

    const normalized = normalizeParsedModel(parsedModel, body);

    if (!normalized?.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (normalized.domain === 'openehr' && !normalized?.domainData?.webTemplate) {
      return NextResponse.json({ error: 'domainData.webTemplate is required for OpenEHR' }, { status: 400 });
    }
    if (normalized.domain === 'fhir' && !normalized?.domainData?.resource) {
      return NextResponse.json({ error: 'domainData.resource is required for FHIR' }, { status: 400 });
    }
    if (normalized.domain === 'fhir') {
      const resourceType = normalized?.domainData?.resourceType || normalized?.domainData?.resource?.resourceType || 'Unknown';
      if (!isAllowedFhirArtifact(resourceType)) {
        return NextResponse.json({
          error: `Unsupported FHIR resourceType "${resourceType}". Allowed types: StructureDefinition, ValueSet, CodeSystem.`
        }, { status: 400 });
      }
      normalized.domainData.resourceType = resourceType;
    }
    if (normalized.domain === 'contextobject' && !normalized?.domainData?.schema) {
      return NextResponse.json({ error: 'domainData.schema is required for ContextObjects' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    await ensureTemplateIndexes(db);
    const col = db.collection(COLLECTION_NAME);

    const existing = await col.findOne({ name: normalized.name, domain: normalized.domain });

    if (existing) {
      await col.updateOne(
        { _id: existing._id },
        {
          $set: {
            ...normalized,
            'audit.updatedAt': new Date(),
            'audit.updatedBy': session.user.email,
          },
        }
      );

      return NextResponse.json({
        updated: true,
        id: existing._id.toString(),
        domain: normalized.domain,
      });
    }

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
      ...normalized,
      audit: {
        createdAt: new Date(),
        createdBy: session.user.email,
      },
    };

    const res = await col.insertOne(doc);
    return NextResponse.json({ inserted: true, id: res.insertedId.toString(), domain: normalized.domain });
  } catch (e) {
    if (e instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    console.error('POST /api/data-models error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
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
    console.error('DELETE /api/data-models error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
  }
}
