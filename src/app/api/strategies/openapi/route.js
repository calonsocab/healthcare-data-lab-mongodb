// src/app/api/strategies/openapi/route.js
/**
 * OpenAPI Spec Proxy
 *
 * Fetches the OpenAPI spec from Kehrnel for a specific strategy.
 * This avoids CORS issues when fetching from the browser.
 */
import { NextResponse } from 'next/server';
import { getKehrnelEndpoint } from '@/lib/kehrnel/endpoints';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';
import { getCoreDb } from '@/lib/db/coreDb';
import { enforceApiRateLimit, resolvePolicyContext } from '@/lib/security/teamPolicy';

export const dynamic = 'force-dynamic';

function sanitizeSegment(value) {
  const raw = String(value || '').trim();
  // Keep route segment strict: letters, numbers, dot, underscore, dash only.
  if (!/^[a-zA-Z0-9._-]+$/.test(raw) || raw === '.' || raw === '..') return '';
  return raw;
}

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const coreDb = await getCoreDb();
    const policyContext = await resolvePolicyContext(coreDb, auth.session?.user?.email);
    await enforceApiRateLimit(coreDb, policyContext, 'strategies-openapi:get');

    const { searchParams } = new URL(request.url);
    const domain = sanitizeSegment(searchParams.get('domain'));
    const strategy = sanitizeSegment(searchParams.get('strategy'));
    if (!domain || !strategy) {
      return NextResponse.json(
        { error: 'domain and strategy are required' },
        { status: 400 }
      );
    }

    // Get Kehrnel base URL
    const endpoint = await getKehrnelEndpoint(coreDb, strategy);
    if (!endpoint?.url) {
      return NextResponse.json(
        { error: 'No Kehrnel endpoint configured' },
        { status: 503 }
      );
    }

    // Fetch OpenAPI spec from Kehrnel
    const openApiUrl = `${endpoint.url}/openapi/strategies/${domain}/${strategy}.json`;

    const response = await fetch(openApiUrl, {
      headers: {
        'Accept': 'application/json',
      },
      // Short timeout
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch OpenAPI spec: ${response.status}` },
        { status: response.status }
      );
    }

    const spec = await response.json();

    return NextResponse.json(spec);
  } catch (error) {
    return safeErrorResponse(error, 'Failed to fetch OpenAPI spec');
  }
}
