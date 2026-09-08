import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { resolveRuntimeContext } from '@/lib/kehrnel/runtimeContext';
import {
  enforceApiRateLimit,
  enforceNumericLimit,
  resolvePolicyContext
} from '@/lib/security/teamPolicy';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';
import { validateFileBasics } from '@/lib/uploads/validation';
import { parseFormDataWithLimit } from '@/lib/uploads/bodyLimit';
import { buildTemplateSyntaxDisabledError, findDisallowedTemplateMarker } from '@/lib/mappings/security';

const DEFAULT_TRANSFORM_MAX_BYTES = 100 * 1024 * 1024; // 100MB
const TRANSFORM_EXTENSIONS = ['.xml', '.cda', '.csv', '.json', '.txt', '.hl7'];
const TRANSFORM_MIME_TYPES = [
  'application/xml',
  'text/xml',
  'application/json',
  'text/json',
  'text/plain',
  'text/csv',
  'application/csv',
  'application/hl7-v2',
  'application/octet-stream'
];

async function resolveMappingYaml(db, mappingId) {
  if (!mappingId) throw new Error('mappingId is required');
  const col = db.collection('mapping_definitions');
  let doc = null;
  if (ObjectId.isValid(mappingId)) {
    doc = await col.findOne({ _id: new ObjectId(mappingId) }, { projection: { yaml: 1, name: 1 } });
  }
  if (!doc) {
    doc = await col.findOne({ name: mappingId }, { projection: { yaml: 1, name: 1 } });
  }
  if (!doc?.yaml) {
    throw new Error(`Mapping not found for mappingId=${mappingId}`);
  }
  return { yaml: doc.yaml, name: doc.name || null };
}

async function resolveTemplateOpt(db, templateId) {
  if (!templateId) throw new Error('templateId is required');
  const col = db.collection('user-data-models');
  const queries = [];
  if (ObjectId.isValid(templateId)) {
    queries.push({ _id: new ObjectId(templateId) });
  }
  queries.push({ 'metadata.templateId': String(templateId) });
  queries.push({ name: String(templateId) });

  let doc = null;
  for (const q of queries) {
    doc = await col.findOne(q, {
      projection: {
        metadata: 1,
        name: 1,
        domain: 1,
        domainData: 1,
        source: 1,
        opt: 1,
      }
    });
    if (doc) break;
  }

  const candidates = [
    doc?.metadata?.opt,
    doc?.domainData?.source?.xml,
    doc?.source?.xml,
    doc?.opt,
  ];

  const opt = candidates.find((v) => typeof v === 'string' && v.trim().length > 0) || null;
  if (!opt) {
    const sourceType = doc?.domainData?.source?.type || doc?.source?.type || null;
    throw new Error(
      `Template OPT not found for templateId=${templateId}. ` +
      `Template exists but has no stored OPT XML (source.type=${sourceType || 'unknown'}).`
    );
  }

  return {
    opt,
    name: doc?.name || null,
    domain: (doc?.domain || 'openehr').toLowerCase()
  };
}

/**
 * POST /api/transform
 *
 * Mapping Studio secure proxy:
 * - resolves active env/session + Kehrnel runtime server-side
 * - resolves mapping YAML + OPT from tenant DB
 * - sends full transform payload to Kehrnel /api/transform
 */
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const policyContext = await resolvePolicyContext(coreDb, session.user.email);
    await enforceApiRateLimit(coreDb, policyContext, 'transform:post');
    const policyMaxBytes = policyContext?.policy?.limits?.maxUploadFileBytes;
    const maxBytes = Number.isFinite(policyMaxBytes) && policyMaxBytes > 0
      ? policyMaxBytes
      : DEFAULT_TRANSFORM_MAX_BYTES;

    const incoming = await parseFormDataWithLimit(request, maxBytes + (1 * 1024 * 1024));
    const activeEnvId = (
      request.headers.get('x-active-env')
      || request.headers.get('x-env-id')
      || request.headers.get('x-environment-id')
      || ''
    ).toString().trim();
    const document = incoming.get('document');
    const mappingId = String(incoming.get('mappingId') || '').trim();
    const templateId = String(incoming.get('templateId') || '').trim();
    const domainHint = String(incoming.get('domain') || 'openehr').trim().toLowerCase();

    if (!document || typeof document === 'string') {
      return NextResponse.json({ error: 'document file is required' }, { status: 400 });
    }
    if (!mappingId) {
      return NextResponse.json({ error: 'mappingId is required' }, { status: 400 });
    }
    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
    }
    enforceNumericLimit(
      maxBytes,
      document?.size || 0,
      {
        code: 'TEAM_UPLOAD_FILE_TOO_LARGE',
        status: 413,
        message: 'Document exceeds upload size policy',
        details: {
          fileSize: document?.size || 0,
          maxUploadFileBytes: maxBytes
        }
      }
    );
    const validationError = validateFileBasics(document, {
      allowedExtensions: TRANSFORM_EXTENSIONS,
      allowedMimeTypes: TRANSFORM_MIME_TYPES,
      maxBytes,
      allowMissingType: true,
      requireSafeName: true
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const service = createKehrnelService(coreDb);
    const { db: tenantDb, environment } = await getActiveTenantDb(request);

    const envGate = await enforceEnvironmentControl(coreDb, environment?.id, ENV_CONTROL_CAPABILITY.WRITE);
    if (envGate) return envGate;

    const mapping = await resolveMappingYaml(tenantDb, mappingId);
    const jinjaMarker = findDisallowedTemplateMarker(mapping?.yaml || '');
    if (jinjaMarker) {
      return NextResponse.json(
        buildTemplateSyntaxDisabledError('Mapping YAML', jinjaMarker),
        { status: 400 }
      );
    }
    const template = await resolveTemplateOpt(tenantDb, templateId);
    const domain = template.domain || domainHint || 'openehr';

    const runtime = await resolveRuntimeContext({
      coreDb,
      userEmail: session.user.email,
      envId: environment?.id,
      requestedDomain: domain
    });

    const conn = await service.resolveConnection({
      connectionId: runtime.connectionId || undefined,
      envKehrnel: environment?.kehrnel || {}
    });

    if (!conn?.url) {
      return NextResponse.json(
        { error: 'No Kehrnel connection available for active environment' },
        { status: 503 }
      );
    }

    const outbound = new FormData();
    outbound.append('document', document);
    outbound.append('mapping_yaml', mapping.yaml);
    outbound.append('opt_content', template.opt);
    outbound.append('template_id', templateId);

    const url = `${conn.url.replace(/\/$/, '')}/api/transform`;
    const headers = {
      ...(conn.apiKey && { 'X-API-Key': conn.apiKey }),
      ...(activeEnvId && { 'x-active-env': activeEnvId }),
      ...(runtime?.envKey && { 'x-kehrnel-env': String(runtime.envKey) }),
      ...(domain && { 'x-kehrnel-domain': domain }),
      'x-authenticated-user': session.user.email
    };

    const response = await fetch(url, {
      method: 'POST',
      body: outbound,
      headers
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return NextResponse.json(
        {
          error: `Kehrnel transform failed (${response.status})`,
          details: errorText || null,
          runtime: {
            envId: environment?.id || null,
            envKey: runtime?.envKey || null,
            domain,
            kehrnelUrl: conn.url
          }
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('POST /api/transform error:', error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    return NextResponse.json(
      {
        code: error?.code || null,
        error: error?.message || 'Transform proxy failed',
        details: error?.details || null
      },
      { status }
    );
  }
}
