import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { getActiveTenantDb, resolveEnvByIdForUser } from '@/lib/db/tenantDb';
import { getDb } from '@/lib/db/connectionManager';
import { resolveSyntheticBinding, normalizeSyntheticDomain } from '@/lib/synthetic-data/kehrnelRuntime';

export const dynamic = 'force-dynamic';

async function collectionExists(db, name) {
  const found = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return found.length > 0;
}

function normalizeLink(link = {}) {
  return {
    from: link.from || null,
    to: link.to || null,
    probability: typeof link.probability === 'number' ? link.probability : 1,
    min_to_per_patient: Number.isInteger(link.min_to_per_patient) ? link.min_to_per_patient : 0,
    type: link.type || 'related'
  };
}

async function resolveLinksDb(req, environment, requestedDatabaseName) {
  if (!requestedDatabaseName || requestedDatabaseName === environment?.database) {
    const { db } = await getActiveTenantDb(req);
    return db;
  }

  const envId = environment?.id;
  if (!envId) {
    throw Object.assign(new Error('No active environment selected'), { status: 400 });
  }

  const resolved = await resolveEnvByIdForUser(req, envId);
  return getDb({ uri: resolved.uri, dbName: requestedDatabaseName });
}

export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const requestedDomain = normalizeSyntheticDomain(searchParams.get('domain'));
    const requestedStrategyId = searchParams.get('strategyId') || '';
    const modelIds = (searchParams.get('modelIds') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const requestedLinksDatabase =
      searchParams.get('linksDatabase') ||
      searchParams.get('database_name') ||
      '';
    const requestedLinksCollection =
      searchParams.get('linksCollection') ||
      searchParams.get('links_collection') ||
      'semantic_links';

    const { environment } = await getActiveTenantDb(req);
    const binding = resolveSyntheticBinding(environment, {
      domain: requestedDomain,
      strategyId: requestedStrategyId
    });

    if (!binding.domain) {
      return NextResponse.json(
        {
          error: 'No synthetic-enabled domain found for this environment',
          availableDomains: binding.availableDomains || []
        },
        { status: 400 }
      );
    }

    const linksDatabaseName = (requestedLinksDatabase || environment?.database || '').trim();
    const linksCollectionName = (requestedLinksCollection || 'semantic_links').trim();

    const linksDb = await resolveLinksDb(req, environment, linksDatabaseName);
    const hasLinks = await collectionExists(linksDb, linksCollectionName);
    if (!hasLinks) {
      return NextResponse.json({
        domain: binding.domain,
        strategyId: binding.strategyId,
        links_source: {
          database_name: linksDatabaseName || null,
          links_collection: linksCollectionName
        },
        count: 0,
        items: []
      });
    }

    const query = {};
    const and = [];
    if (binding.domain) {
      and.push({
        $or: [
          { domain: { $exists: false } },
          { domain: binding.domain }
        ]
      });
    }
    if (binding.strategyId) {
      and.push({
        $or: [
          { strategy_id: { $exists: false } },
          { strategy_id: binding.strategyId }
        ]
      });
    }
    if (modelIds.length) {
      and.push({
        $or: [
          { from: { $in: modelIds } },
          { to: { $in: modelIds } }
        ]
      });
    }
    if (and.length) {
      query.$and = and;
    }

    const docs = await linksDb.collection(linksCollectionName)
      .find(query, {
        projection: {
          from: 1,
          to: 1,
          probability: 1,
          min_to_per_patient: 1,
          type: 1
        }
      })
      .sort({ from: 1, to: 1 })
      .toArray();

    const items = docs.map(normalizeLink).filter((link) => link.from && link.to);
    return NextResponse.json({
      domain: binding.domain,
      strategyId: binding.strategyId,
      links_source: {
        database_name: linksDatabaseName || null,
        links_collection: linksCollectionName
      },
      count: items.length,
      items
    });
  } catch (error) {
    console.error('GET /api/synthetic-data/kehrnel/links error:', error);
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;
    return NextResponse.json({ error: error.message || 'Failed to list semantic links' }, { status });
  }
}
