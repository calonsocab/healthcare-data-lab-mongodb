// src/app/api/kehrnel/strategies/[strategyId]/assets/[...assetPath]/route.js
/**
 * Strategy Asset Proxy
 *
 * Proxies static asset requests (PDFs, images, etc.) from the Kehrnel backend
 * so the browser never needs to reach the internal Kehrnel hostname.
 *
 * URL pattern: /api/kehrnel/strategies/{strategyId}/assets/{...assetPath}
 * Proxied to:  {kehrnelUrl}/strategies/{strategyId}/assets/{assetPath}
 */
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { requireAuthenticatedUser } from '@/lib/security/api';

export const dynamic = 'force-dynamic';

const SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;

export async function GET(req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { strategyId, assetPath } = params;

    if (!strategyId || strategyId === '.' || strategyId === '..' || !SEGMENT_RE.test(strategyId)) {
      return new NextResponse('Invalid strategy ID', { status: 400 });
    }

    const assetSegments = Array.isArray(assetPath) ? assetPath : [assetPath];
    const hasInvalidAssetSegment = assetSegments.some(
      (segment) => !segment || segment === '.' || segment === '..' || !SEGMENT_RE.test(segment)
    );
    if (hasInvalidAssetSegment) {
      return new NextResponse('Invalid asset path', { status: 400 });
    }

    const safeAssetPath = assetSegments
      .map(segment => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');

    const db = await getCoreDb();
    const service = createKehrnelService(db);
    const conn = await service.resolveConnection({});

    if (!conn?.url) {
      return new NextResponse('No Kehrnel connection available', { status: 503 });
    }

    const assetUrl = `${conn.url.replace(/\/+$/, '')}/strategies/${encodeURIComponent(strategyId)}/assets/${safeAssetPath}`;

    const res = await fetch(assetUrl, {
      headers: conn.apiKey ? { 'x-api-key': conn.apiKey } : {},
      cache: 'no-store'
    });

    if (!res.ok) {
      return new NextResponse(`Asset not found: ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store',
        'Content-Disposition': res.headers.get('content-disposition') || ''
      }
    });
  } catch (error) {
    console.error('GET /api/kehrnel/strategies/[strategyId]/assets error:', error);
    return new NextResponse('Failed to fetch asset', { status: 500 });
  }
}
