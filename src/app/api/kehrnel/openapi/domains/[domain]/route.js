// src/app/api/kehrnel/openapi/domains/[domain]/route.js
/**
 * OpenAPI Spec Proxy
 * 
 * Proxies OpenAPI spec requests to Kehrnel backend to avoid CORS and mixed content issues.
 */
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { requireAuthenticatedUser } from '@/lib/security/api';

export const dynamic = 'force-dynamic';

export async function GET(req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { domain } = params;
    const safeDomain = String(domain || '').trim();

    if (!safeDomain || safeDomain === '.' || safeDomain === '..' || !/^[a-zA-Z0-9._-]+$/.test(safeDomain)) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const db = await getCoreDb();
    const service = createKehrnelService(db);

    const conn = await service.resolveConnection({});
    if (!conn?.url) {
      return NextResponse.json({ error: 'No Kehrnel connection available' }, { status: 503 });
    }

    const specUrl = `${conn.url.replace(/\/+$/, '')}/openapi/domains/${encodeURIComponent(safeDomain)}.json`;

    const res = await fetch(specUrl, {
      headers: conn.apiKey ? { 'x-api-key': conn.apiKey } : {},
      cache: 'no-store'
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch OpenAPI spec: ${res.status}` },
        { status: res.status }
      );
    }

    const spec = await res.json();
    
    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (error) {
    console.error('GET /api/kehrnel/openapi/domains/[domain] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch OpenAPI spec' },
      { status: 500 }
    );
  }
}
