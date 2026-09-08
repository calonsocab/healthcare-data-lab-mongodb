import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { ensureDomainProxyRuntimeReady } from '@/lib/kehrnel/domainProxyRuntime';
import { buildUpstreamProxyResponse } from '@/lib/kehrnel/proxyResponse';
import { resolveRuntimeContext } from '@/lib/kehrnel/runtimeContext';
import { requireAccessibleEnvironment } from '@/lib/environments/requireEnvironmentAccess';
import { enforceApiRateLimit, resolvePolicyContext } from '@/lib/security/teamPolicy';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';

export const dynamic = 'force-dynamic';

function getRequestEnvId(req) {
  const url = new URL(req.url);
  return (
    req.headers.get('x-active-env') ||
    req.headers.get('x-env-id') ||
    req.headers.get('x-environment-id') ||
    url.searchParams.get('env_id') ||
    url.searchParams.get('environment') ||
    null
  );
}

function buildForwardHeaders(req, { apiKey, envKey }) {
  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  const accept = req.headers.get('accept');
  const prefer = req.headers.get('prefer');
  const ifMatch = req.headers.get('if-match');
  if (contentType) headers.set('content-type', contentType);
  if (accept) headers.set('accept', accept);
  if (prefer) headers.set('prefer', prefer);
  if (ifMatch) headers.set('if-match', ifMatch);
  if (apiKey) headers.set('x-api-key', apiKey);
  if (envKey) headers.set('x-active-env', envKey);
  return headers;
}

function hasUnsafePathSegment(segment) {
  let decoded = '';
  try {
    decoded = decodeURIComponent(segment || '');
  } catch {
    return true;
  }
  return (
    decoded === '.' ||
    decoded === '..' ||
    decoded.includes('..') ||
    decoded.includes('\\') ||
    decoded.includes('\0')
  );
}

async function proxy(req, { params }) {
  try {
    const params = await ctx.params;
    let session = { user: { email: 'test@example.com' } };
    if (!isTestModeBypassEnabled()) {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
      session = auth.session;
    }

    const envId = getRequestEnvId(req);
    if (!envId) {
      return NextResponse.json(
        { error: 'Missing active environment. Provide x-active-env (or env_id query param).' },
        { status: 400 }
      );
    }

    const pathParts = Array.isArray(params?.path) ? params.path : [];
    if (!pathParts.length) {
      return NextResponse.json({ error: 'Target path is required' }, { status: 400 });
    }
    if (pathParts.some(hasUnsafePathSegment)) {
      return NextResponse.json({ error: 'Invalid target path' }, { status: 400 });
    }
    const suffix = pathParts.map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    }).join('/');
    if (!suffix) {
      return NextResponse.json({ error: 'Target path is required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const policyContext = await resolvePolicyContext(coreDb, session.user.email);
    await enforceApiRateLimit(coreDb, policyContext, `kehrnel-openehr-proxy:${(req.method || 'GET').toLowerCase()}`);

    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(coreDb, session.user.email, envId);
      if (!access.ok) return access.response;
    }

    // Treat non-GET as write/ops to protect paused/read-only environments.
    const methodUpper = String(req.method || 'GET').toUpperCase();
    const capability = (methodUpper === 'GET' || methodUpper === 'HEAD')
      ? ENV_CONTROL_CAPABILITY.READ
      : ENV_CONTROL_CAPABILITY.WRITE;
    const envGate = await enforceEnvironmentControl(coreDb, envId, capability, { route: 'api/domains/openehr' });
    if (envGate) return envGate;

    const service = createKehrnelService(coreDb);
    const runtime = await resolveRuntimeContext({
      coreDb,
      userEmail: session.user.email,
      envId,
      requestedDomain: 'openehr',
      hydrateStrategyConfig: false,
    });

    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;

    const conn = await service.resolveConnection({
      connectionId: runtime.connectionId || undefined,
      envKehrnel: runtime.envKehrnel || {}
    });
    if (!conn?.url) {
      return NextResponse.json({ error: 'No Kehrnel connection available' }, { status: 503 });
    }

    // Sandbox and domain-proxy flows should behave like the query/ops routes:
    // if HDL has a linked strategy but the runtime activation is missing
    // (common after runtime restarts or fresh deployments), re-ensure the
    // environment activation before forwarding to the domain API.
    const { envKey } = await ensureDomainProxyRuntimeReady(service, runtime, {
      envId,
      requestId,
      domain: 'openehr'
    });

    const incoming = new URL(req.url);
    const upstream = `${conn.url.replace(/\/+$/, '')}/api/domains/openehr/${suffix}${incoming.search}`;
    const method = req.method || 'GET';
    const hasBody = !['GET', 'HEAD'].includes(methodUpper);
    const body = hasBody ? await req.text() : undefined;

    const upstreamRes = await fetch(upstream, {
      method,
      headers: buildForwardHeaders(req, { apiKey: conn.apiKey, envKey }),
      body,
      cache: 'no-store',
    });

    const text = await upstreamRes.text();
    return buildUpstreamProxyResponse({
      method,
      upstreamRes,
      text,
    });
  } catch (error) {
    console.error('Kehrnel openEHR proxy error:', error);
    return NextResponse.json({ error: error?.message || 'Proxy request failed' }, { status: 500 });
  }
}

export async function GET(req, ctx) {
  return proxy(req, ctx);
}

export async function POST(req, ctx) {
  return proxy(req, ctx);
}

export async function PUT(req, ctx) {
  return proxy(req, ctx);
}

export async function PATCH(req, ctx) {
  return proxy(req, ctx);
}

export async function DELETE(req, ctx) {
  return proxy(req, ctx);
}
