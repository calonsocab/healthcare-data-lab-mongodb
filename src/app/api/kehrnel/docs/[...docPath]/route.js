// src/app/api/kehrnel/docs/[...docPath]/route.js
/**
 * Kehrnel Docs Page Proxy
 *
 * Proxies documentation pages (e.g. /docs/strategies/{domain}/{name}) served
 * by the Kehrnel backend so the browser never needs to reach the internal
 * Kehrnel hostname.
 *
 * URL pattern: /api/kehrnel/docs/{...docPath}
 * Proxied to:  {kehrnelUrl}/docs/{docPath}
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

    const segments = Array.isArray(params.docPath) ? params.docPath : [params.docPath];

    // Validate each segment to prevent path traversal
    const safe = segments.every(
      (s) => /^[a-zA-Z0-9._-]+$/.test(s) && s !== '.' && s !== '..'
    );
    if (!safe || segments.length === 0) {
      return new NextResponse('Invalid doc path', { status: 400 });
    }

    const db = await getCoreDb();
    const service = createKehrnelService(db);
    const conn = await service.resolveConnection({});

    if (!conn?.url) {
      return new NextResponse('No Kehrnel connection available', { status: 503 });
    }

    const docUrl = `${conn.url.replace(/\/+$/, '')}/docs/${segments.join('/')}`;

    const res = await fetch(docUrl, {
      headers: conn.apiKey ? { 'x-api-key': conn.apiKey } : {},
      cache: 'no-store'
    });

    if (!res.ok) {
      return new NextResponse(`Docs page not found: ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'text/html; charset=utf-8';
    const body = await res.text();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (error) {
    console.error('GET /api/kehrnel/docs error:', error);
    return new NextResponse('Failed to fetch docs page', { status: 500 });
  }
}
