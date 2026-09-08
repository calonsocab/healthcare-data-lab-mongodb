import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { resolveRuntimeContext } from '@/lib/kehrnel/runtimeContext';
import { enforceApiRateLimit, resolvePolicyContext } from '@/lib/security/teamPolicy';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';

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
    throw new Error(`Template OPT not found for templateId=${templateId}`);
  }

  return {
    opt,
    domain: (doc?.domain || 'openehr').toLowerCase(),
  };
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const activeEnvId = (
      request.headers.get('x-active-env')
      || request.headers.get('x-env-id')
      || request.headers.get('x-environment-id')
      || body?.environment
      || body?.envId
      || ''
    ).toString().trim();
    const composition = body?.composition;
    const templateId = String(body?.templateId || '').trim();
    const domainHint = String(body?.domain || 'openehr').trim().toLowerCase();

    if (!composition || typeof composition !== 'object') {
      return NextResponse.json({ error: 'composition object is required' }, { status: 400 });
    }
    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const policyContext = await resolvePolicyContext(coreDb, session.user.email);
    await enforceApiRateLimit(coreDb, policyContext, 'validate:post');
    const service = createKehrnelService(coreDb);
    const { db: tenantDb, environment } = await getActiveTenantDb(request);
    const envGate = await enforceEnvironmentControl(coreDb, environment?.id, ENV_CONTROL_CAPABILITY.READ);
    if (envGate) return envGate;
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

    const response = await fetch(`${conn.url.replace(/\/$/, '')}/api/validate-composition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(conn.apiKey && { 'X-API-Key': conn.apiKey }),
        ...(activeEnvId && { 'x-active-env': activeEnvId }),
        ...(runtime?.envKey && { 'x-kehrnel-env': String(runtime.envKey) }),
        ...(domain && { 'x-kehrnel-domain': domain }),
        'x-authenticated-user': session.user.email
      },
      body: JSON.stringify({
        composition,
        opt_content: template.opt,
        template_id: templateId
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return NextResponse.json(
        {
          error: `Kehrnel validate failed (${response.status})`,
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
    console.error('POST /api/validate error:', error);
    return NextResponse.json(
      {
        error: 'Validate proxy failed',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
