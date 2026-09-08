// src/app/api/kehrnel/health/route.js
/**
 * Kehrnel Health Check Proxy
 *
 * Proxies health check requests to Kehrnel to avoid CORS issues.
 * Browser cannot call Kehrnel directly due to CORS - must go through this proxy.
 */
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { requireAuthenticatedUser } from '@/lib/security/api';
import { requirePlatformAdmin } from '@/lib/security/admin';

export const dynamic = 'force-dynamic';

function isPrivateIpv4(hostname = '') {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isLocalOrPrivateHost(hostname = '') {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || host === '[::1]') return true;
  if (host.endsWith('.local')) return true;
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  return isPrivateIpv4(host);
}

function canUsePrivateHealthUrls() {
  return process.env.ALLOW_PRIVATE_HEALTHCHECK_URLS === 'true' || process.env.NODE_ENV === 'development';
}

function validateDirectUrl(rawUrl = '') {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, message: 'Invalid URL format' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, message: 'Only http/https protocols are allowed' };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, message: 'Credentials in URL are not allowed' };
  }
  if (isLocalOrPrivateHost(parsed.hostname) && !canUsePrivateHealthUrls()) {
    return { valid: false, message: 'Private or local addresses are not allowed in this environment' };
  }
  return { valid: true, parsed };
}

/**
 * GET /api/kehrnel/health
 *
 * Check health of a Kehrnel instance.
 *
 * Query params:
 *   - connectionId: specific Kehrnel connection ID (optional)
 *   - url: direct URL to check (optional, used for testing new connections)
 */
export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connectionId');
    const directUrl = searchParams.get('url');

    // If direct URL provided, check it directly (for testing new connections)
    if (directUrl) {
      // Publish hardening: prevent arbitrary URL probes in non-dev unless platform admin.
      if (process.env.NODE_ENV !== 'development') {
        const admin = await requirePlatformAdmin();
        if (!admin.ok) return admin.response;
      }

      const validated = validateDirectUrl(directUrl);
      if (!validated.valid) {
        return NextResponse.json({
          healthy: false,
          error: validated.message
        }, { status: 200 });
      }
      const normalizedBaseUrl = validated.parsed.toString().replace(/\/$/, '');
      const healthUrl = `${normalizedBaseUrl}/health`;
      console.log('[Kehrnel Health] Checking direct URL');

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const fetchHeaders = { 'Accept': 'application/json' };
        const apiKey = process.env.KEHRNEL_API_KEY;
        if (apiKey) {
          fetchHeaders['x-api-key'] = apiKey;
        }
        const res = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: fetchHeaders,
          cache: 'no-store'
        });
        clearTimeout(timeout);

        if (!res.ok) {
          return NextResponse.json({
            healthy: false,
            error: `Kehrnel returned ${res.status}`,
            url: normalizedBaseUrl
          }, { status: 200 });
        }

        const text = await res.text();

        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          console.log('[Kehrnel Health] JSON parse error:', e.message);
        }

        return NextResponse.json({
          healthy: true,
          url: normalizedBaseUrl,
          ...data
        });
      } catch (error) {
        console.log('[Kehrnel Health] Fetch error:', error.name, error.message);
        return NextResponse.json({
          healthy: false,
          error: error.name === 'AbortError' ? 'Connection timeout' : (error.cause?.code || error.message),
          url: normalizedBaseUrl
        }, { status: 200 });
      }
    }

    // Otherwise use the KehrnelService to check configured connection
    const db = await getCoreDb();
    const service = createKehrnelService(db);

    try {
      const health = await service.checkHealth({ connectionId });
      return NextResponse.json({
        healthy: true,
        connectionId: health.connectionId,
        url: health.url,
        version: health.version,
        status: health.status
      });
    } catch (error) {
      return NextResponse.json({
        healthy: false,
        error: error.message,
        connectionId
      }, { status: 200 }); // Return 200 so frontend can read the response
    }
  } catch (error) {
    console.error('GET /api/kehrnel/health error:', error);
    return NextResponse.json({
      healthy: false,
      error: error.message
    }, { status: 200 }); // Return 200 so frontend can read the response
  }
}
