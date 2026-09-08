// src/app/api/kehrnel/instances/route.js
/**
 * Kehrnel Instances API
 *
 * Manages Kehrnel instance registrations with GitHub source configuration.
 * Each instance can serve multiple strategies and has its own GitHub repo settings.
 */

import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCoreDb } from '@/lib/db/coreDb';
import { sealSecret } from '@/lib/crypto/secrets.mjs';
import { safeErrorResponse } from '@/lib/security/api';
import { requirePlatformAdmin } from '@/lib/security/admin';

export const dynamic = 'force-dynamic';

const COLLECTION_NAME = 'kehrnel_instances';

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

function canUsePrivateInstanceUrls() {
  return process.env.ALLOW_PRIVATE_KEHRNEL_URLS === 'true' || process.env.NODE_ENV === 'development';
}

/**
 * Sanitize instance for client response (never expose API keys)
 */
function sanitizeInstance(instance, health = null) {
  return {
    _id: instance._id?.toString(),
    name: instance.name,
    url: instance.url,
    strategies: instance.strategies || [],
    github: instance.github,
    enabled: instance.enabled !== false,
    isDefault: !!instance.isDefault,
    discoveredStrategies: instance.discoveredStrategies || [],
    createdBy: instance.createdBy,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
    hasApiKey: !!(instance.apiKey), // Boolean indicator only
    health
  };
}

/**
 * GET /api/kehrnel/instances
 *
 * List all registered Kehrnel instances with their health status.
 */
export async function GET(req) {
  try {
    const admin = await requirePlatformAdmin();
    if (!admin.ok) return admin.response;

    const db = await getCoreDb();
    const instances = await db.collection(COLLECTION_NAME)
      .find({ enabled: { $ne: false } })
      .toArray();

    // Check health of each instance and sanitize response
    const instancesWithHealth = await Promise.all(
      instances.map(async (instance) => {
        const health = await checkHealth(instance.url);
        return sanitizeInstance(instance, health);
      })
    );

    return NextResponse.json({
      instances: instancesWithHealth,
      count: instancesWithHealth.length
    });
  } catch (error) {
    console.error('GET /api/kehrnel/instances error:', error);
    return safeErrorResponse(error, 'Failed to fetch instances');
  }
}

/**
 * POST /api/kehrnel/instances
 *
 * Register or update a Kehrnel instance.
 *
 * Body:
 * - name: Display name for the instance
 * - url: Base URL (e.g., https://api.kehrnel.example.com)
 * - strategies: Array of strategy IDs this instance serves
 * - github: GitHub configuration { repo, branch, baseUrl }
 * - apiKey: Optional API key for authenticated requests
 */
export async function POST(req) {
  try {
    const admin = await requirePlatformAdmin();
    if (!admin.ok) return admin.response;
    const session = admin.session;

    const body = await req.json();
    const { name, url, strategies, github, apiKey, isDefault } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'url is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only http/https URLs are allowed' },
        { status: 400 }
      );
    }
    if ((parsedUrl.username || parsedUrl.password)) {
      return NextResponse.json(
        { error: 'Credentials in URL are not allowed' },
        { status: 400 }
      );
    }
    if (isLocalOrPrivateHost(parsedUrl.hostname) && !canUsePrivateInstanceUrls()) {
      return NextResponse.json(
        { error: 'Private/local Kehrnel URLs are not allowed in this environment' },
        { status: 400 }
      );
    }

    const normalizedUrl = url.replace(/\/$/, '');

    const db = await getCoreDb();
    const existing = await db.collection(COLLECTION_NAME).findOne({ url: normalizedUrl });

    // Test connection before saving
    const health = await checkHealth(normalizedUrl);
    if (health.status === 'error') {
      return NextResponse.json({
        error: 'Cannot connect to Kehrnel instance',
        details: health.error,
        url: normalizedUrl
      }, { status: 503 });
    }

    // Fetch strategies from the instance
    let discoveredStrategies = [];
    try {
      const strategiesRes = await fetch(`${url}/strategies`, {
        headers: apiKey ? { 'X-API-Key': apiKey } : {}
      });
      if (strategiesRes.ok) {
        const data = await strategiesRes.json();
        discoveredStrategies = (data.manifests || []).map(m => m.id);
      }
    } catch (err) {
      console.warn('Could not discover strategies:', err.message);
    }

    // Seal API key before storage (if provided)
    let sealedApiKey = existing?.apiKey || null;
    if (apiKey !== undefined) {
      if (apiKey) {
        try {
          sealedApiKey = sealSecret(apiKey);
        } catch (err) {
          console.error('Failed to seal API key:', err.message);
          return NextResponse.json(
            { error: 'Failed to secure API key. Ensure ENV_SECRETS_KEY is configured.' },
            { status: 500 }
          );
        }
      } else {
        sealedApiKey = null;
      }
    }

    const resolvedIsDefault = isDefault === undefined
      ? !!existing?.isDefault
      : !!isDefault;

    // If setting as default, unset any existing default first
    if (resolvedIsDefault) {
      await db.collection(COLLECTION_NAME).updateMany(
        { isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const doc = {
      name: name || existing?.name || 'Kehrnel Instance',
      url: normalizedUrl,
      strategies: strategies || discoveredStrategies || existing?.strategies || [],
      github: github || existing?.github || {
        repo: 'mongodb-industry-solutions/kehrnel',
        branch: 'main',
        baseUrl: 'https://github.com/mongodb-industry-solutions/kehrnel/blob/main'
      },
      apiKey: sealedApiKey, // Store sealed key
      isDefault: resolvedIsDefault,
      enabled: existing?.enabled !== false,
      discoveredStrategies: discoveredStrategies.length > 0
        ? discoveredStrategies
        : (existing?.discoveredStrategies || []),
      createdBy: existing?.createdBy || session.user.email,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date()
    };

    // Upsert by URL
    const result = await db.collection(COLLECTION_NAME).updateOne(
      { url: doc.url },
      {
        $set: doc,
        $setOnInsert: { createdAt: doc.createdAt }
      },
      { upsert: true }
    );

    const persistedId = existing?._id || result.upsertedId || null;

    return NextResponse.json({
      success: true,
      instance: sanitizeInstance({
        ...doc,
        _id: persistedId
      }, health),
      discoveredStrategies
    });
  } catch (error) {
    console.error('POST /api/kehrnel/instances error:', error);
    return safeErrorResponse(error, 'Failed to register instance');
  }
}

/**
 * DELETE /api/kehrnel/instances
 *
 * Remove a Kehrnel instance registration.
 *
 * Query params:
 * - url: URL of the instance to remove
 */
export async function DELETE(req) {
  try {
    const admin = await requirePlatformAdmin();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const url = searchParams.get('url');

    if (!id && !url) {
      return NextResponse.json(
        { error: 'id or url query param is required' },
        { status: 400 }
      );
    }

    const db = await getCoreDb();
    const query = id ? { _id: new ObjectId(id) } : { url };
    const result = await db.collection(COLLECTION_NAME).deleteOne(query);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Instance not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: id || url });
  } catch (error) {
    console.error('DELETE /api/kehrnel/instances error:', error);
    return safeErrorResponse(error, 'Failed to delete instance');
  }
}

/**
 * Check health of a Kehrnel instance
 */
async function checkHealth(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${url}/health`, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return { status: 'healthy', ...data };
    } else {
      return { status: 'unhealthy', statusCode: res.status };
    }
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}
