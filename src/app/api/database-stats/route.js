// src/app/api/database-stats/route.js
import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { getDb } from '@/lib/db/connectionManager';
import { normalizeDomainKey, resolveDomainTargetDatabase } from '@/lib/environments/domainDatabases';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/database-stats
 *
 * Returns document counts and statistics for collections defined in the active strategy.
 * This provides visibility into the data stored in the database for the current environment.
 *
 * Query params:
 * - domain: 'openEHR' | 'FHIR' (defaults to 'openEHR')
 *
 * Returns:
 * {
 *   environment: { id, name, database },
 *   strategy: { id, name },
 *   collections: {
 *     [collectionName]: {
 *       name: string,
 *       documentCount: number,
 *       storageSize: number (bytes),
 *       avgDocumentSize: number (bytes),
 *       indexes: number,
 *       exists: boolean
 *     }
 *   },
 *   totals: {
 *     documents: number,
 *     collections: number,
 *     storageSize: number
 *   },
 *   timestamp: ISO date string
 * }
 */
export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain') || 'openEHR';
    const normalizedDomain = normalizeDomainKey(domain) || 'openehr';

    // Get active environment + base tenant database connection
    const { db: baseDb, environment, uri } = await getActiveTenantDb(request);

    // Find the strategy link for this domain
    const strategyLink = (environment.strategyLinks || [])
      .find(link => normalizeDomainKey(link?.domain) === normalizedDomain);

    // Get strategy info from Kehrnel activation or legacy strategyId
    const kehrnelStrategyId = strategyLink?.kehrnel?.strategyId || strategyLink?.strategyId;
    const strategyName = strategyLink?.kehrnel?.strategyId || strategyLink?.strategyName || kehrnelStrategyId;

    // Resolve target DB for this domain (strategy override > domainDatabases > derived fallback)
    const { targetDatabase } = resolveDomainTargetDatabase(
      environment,
      normalizedDomain,
      strategyLink?.targetDatabase || strategyLink?.kehrnel?.targetDatabase || null
    );
    const effectiveDbName = targetDatabase || environment.database;
    const db = effectiveDbName === environment.database
      ? baseDb
      : await getDb({ uri, dbName: effectiveDbName });

    if (!kehrnelStrategyId && !strategyLink?.strategyId) {
      return NextResponse.json({
        error: 'No strategy linked for this domain',
        environment: {
          id: environment.id,
          name: environment.name,
          database: effectiveDbName,
          baseDatabase: environment.database,
        },
        strategy: null,
        collections: {},
        totals: { documents: 0, collections: 0, storageSize: 0 },
        timestamp: new Date().toISOString(),
      });
    }

    // Get collection configuration from multiple sources:
    // 1. Kehrnel activation config (strategyLink.kehrnel.config)
    // 2. Strategy config overrides (strategyLink.configOverrides)
    // 3. Default config from Kehrnel default_config
    const kehrnelConfig = strategyLink?.kehrnel?.config || {};
    const overrides = strategyLink?.configOverrides || {};
    const mergedConfig = deepMerge(kehrnelConfig, overrides);

    // For Kehrnel strategies, get collection names from config or use defaults
    const collectionsConfig = mergedConfig.collections || {};

    // Extract collection names - Kehrnel uses 'compositions' and 'search' (or 'search_nodes')
    let collectionNames = extractKehrnelCollectionNames({
      collectionsConfig,
      strategyId: kehrnelStrategyId,
      domain: normalizedDomain,
      mergedConfig,
    });

    // Get stats for each collection
    const collectionStats = {};
    let totalDocuments = 0;
    let totalStorageSize = 0;
    let existingCollections = 0;

    // Get list of existing collections in the database
    const existingCollectionsList = await db.listCollections().toArray();
    const existingCollectionNames = new Set(existingCollectionsList.map(c => c.name));
    collectionNames = preferExistingRpsCollections(collectionNames, existingCollectionNames);

    for (const [key, collectionName] of Object.entries(collectionNames)) {
      if (!collectionName) continue;

      const exists = existingCollectionNames.has(collectionName);

      if (exists) {
        try {
          // Get collection stats
          const stats = await db.command({ collStats: collectionName });

          collectionStats[key] = {
            name: collectionName,
            documentCount: stats.count || 0,
            storageSize: stats.storageSize || 0,
            avgDocumentSize: stats.avgObjSize || 0,
            indexes: stats.nindexes || 0,
            exists: true,
          };

          totalDocuments += stats.count || 0;
          totalStorageSize += stats.storageSize || 0;
          existingCollections++;
        } catch (err) {
          // Collection might not have stats available
          console.warn(`Could not get stats for collection ${collectionName}:`, err.message);

          // Fallback to countDocuments
          try {
            const count = await db.collection(collectionName).countDocuments();
            collectionStats[key] = {
              name: collectionName,
              documentCount: count,
              storageSize: 0,
              avgDocumentSize: 0,
              indexes: 0,
              exists: true,
            };
            totalDocuments += count;
            existingCollections++;
          } catch {
            collectionStats[key] = {
              name: collectionName,
              documentCount: 0,
              storageSize: 0,
              avgDocumentSize: 0,
              indexes: 0,
              exists: false,
              error: 'Could not access collection',
            };
          }
        }
      } else {
        collectionStats[key] = {
          name: collectionName,
          documentCount: 0,
          storageSize: 0,
          avgDocumentSize: 0,
          indexes: 0,
          exists: false,
        };
      }
    }

    return NextResponse.json({
      environment: {
        id: environment.id,
        name: environment.name,
        database: effectiveDbName,
        baseDatabase: environment.database,
      },
      strategy: {
        id: kehrnelStrategyId,
        name: strategyName,
        domain: normalizedDomain,
      },
      collections: collectionStats,
      totals: {
        documents: totalDocuments,
        collections: existingCollections,
        storageSize: totalStorageSize,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GET /api/database-stats error:', error);

    // Handle HttpError from tenantDb
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return safeErrorResponse(error, 'Failed to fetch database stats');
  }
}

/**
 * Extract collection names from Kehrnel strategy config
 * Kehrnel strategies use a config structure like:
 * {
 *   collections: {
 *     compositions: { name: "compositions", ... },
 *     search: { name: "search_nodes", ... },
 *     // or legacy format:
 *     compositions: "compositions",
 *     search_nodes: "search_nodes"
 *   }
 * }
 */
function extractKehrnelCollectionNames({ collectionsConfig = {}, strategyId, domain, mergedConfig = {} } = {}) {
  const names = {};
  const seenNames = new Set();

  // Helper to extract name from config entry (handles both object and string formats)
  const extractName = (entry) => {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object' && entry.name) return entry.name;
    return null;
  };

  const addName = (key, rawName) => {
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name) return;

    const normalizedKey =
      key === 'search_nodes'
        ? 'search'
        : key === 'meta'
          ? 'ehr_index'
          : key === 'shortcut_dict'
            ? 'shortcuts'
            : key;

    if (seenNames.has(name) || names[normalizedKey]) {
      return;
    }

    names[normalizedKey] = name;
    seenNames.add(name);
  };

  // Primary collection names used by Kehrnel strategies
  const collectionKeys = [
    'compositions',
    'search',
    'codes',
    'shortcuts',
    'search_nodes',
    'ehr_index',
    'meta',
    'dictionaries',
    'shortcut_dict',
    'canonical',
    'ehr',
    'contributions',
    'templates',
  ];

  for (const key of collectionKeys) {
    addName(key, extractName(collectionsConfig[key]));
  }

  // Top-level compatibility knobs used by Kehrnel openEHR runtime.
  addName('canonical', mergedConfig.canonical_collection);

  // openEHR runtime always relies on these support collections, even when the
  // strategy config only advertises transform-facing collections.
  if (domain === 'openehr') {
    addName('canonical', extractName(collectionsConfig.canonical) || mergedConfig.canonical_collection || 'compositions');
    addName('ehr', extractName(collectionsConfig.ehr) || 'ehr');
    addName('contributions', extractName(collectionsConfig.contributions) || 'contributions');
    addName('templates', extractName(collectionsConfig.templates) || 'templates');
  }

  // Fallback defaults if nothing found
  if (Object.keys(names).length === 0) {
    // Use RPS defaults when strategy indicates dual-collection RPS.
    if (/rps/i.test(String(strategyId || ''))) {
      addName('compositions', 'compositions_rps');
      addName('search', 'compositions_search');
      addName('codes', '_codes');
      addName('shortcuts', '_shortcuts');
      if (domain === 'openehr') {
        addName('canonical', 'compositions');
        addName('ehr', 'ehr');
        addName('contributions', 'contributions');
        addName('templates', 'templates');
      }
    } else {
      addName('compositions', 'compositions');
      addName('search', 'search_nodes');
    }
  }

  return names;
}

function preferExistingRpsCollections(names, existingCollectionNames) {
  if (!existingCollectionNames || typeof existingCollectionNames.has !== 'function') return names;
  const hasRpsBase = existingCollectionNames.has('compositions_rps');
  const hasRpsSearch = existingCollectionNames.has('compositions_search');
  if (!hasRpsBase && !hasRpsSearch) return names;

  const result = { ...(names || {}) };
  const isLegacyBase = !result.compositions || result.compositions === 'compositions';
  const isLegacySearch = !result.search || result.search === 'search_nodes';

  if (hasRpsBase && isLegacyBase) result.compositions = 'compositions_rps';
  if (hasRpsSearch && isLegacySearch) result.search = 'compositions_search';

  return result;
}

/**
 * Extract collection names from strategy config (legacy)
 */
function extractCollectionNames(collectionsConfig, blueprint) {
  const names = {};

  // Try to get collection names from config
  if (collectionsConfig.compositions?.name) {
    names.compositions = collectionsConfig.compositions.name;
  } else if (typeof collectionsConfig.compositions === 'string') {
    names.compositions = collectionsConfig.compositions;
  }

  if (collectionsConfig.search?.name) {
    names.search = collectionsConfig.search.name;
  } else if (collectionsConfig.search_nodes?.name) {
    names.search = collectionsConfig.search_nodes.name;
  } else if (typeof collectionsConfig.search === 'string') {
    names.search = collectionsConfig.search;
  } else if (typeof collectionsConfig.search_nodes === 'string') {
    names.search = collectionsConfig.search_nodes;
  }

  if (collectionsConfig.ehr_index?.name) {
    names.ehr_index = collectionsConfig.ehr_index.name;
  } else if (collectionsConfig.meta?.name) {
    names.ehr_index = collectionsConfig.meta.name;
  } else if (typeof collectionsConfig.ehr_index === 'string') {
    names.ehr_index = collectionsConfig.ehr_index;
  } else if (typeof collectionsConfig.meta === 'string') {
    names.ehr_index = collectionsConfig.meta;
  }

  if (collectionsConfig.dictionaries?.name) {
    names.dictionaries = collectionsConfig.dictionaries.name;
  } else if (typeof collectionsConfig.dictionaries === 'string') {
    names.dictionaries = collectionsConfig.dictionaries;
  }

  if (collectionsConfig.codes?.name) {
    names.codes = collectionsConfig.codes.name;
  } else if (typeof collectionsConfig.codes === 'string') {
    names.codes = collectionsConfig.codes;
  }

  if (collectionsConfig.shortcuts?.name) {
    names.shortcuts = collectionsConfig.shortcuts.name;
  } else if (typeof collectionsConfig.shortcuts === 'string') {
    names.shortcuts = collectionsConfig.shortcuts;
  }

  // Fallback to blueprint defaults if available
  if (blueprint?.collections) {
    if (!names.compositions && blueprint.collections.compositions) {
      names.compositions = blueprint.collections.compositions.default_name || blueprint.collections.compositions;
    }
    if (!names.search && blueprint.collections.search) {
      names.search = blueprint.collections.search.default_name || blueprint.collections.search;
    }
    if (!names.ehr_index && blueprint.collections.ehr_index) {
      names.ehr_index = blueprint.collections.ehr_index.default_name || blueprint.collections.ehr_index;
    }
    if (!names.dictionaries && blueprint.collections.dictionaries) {
      names.dictionaries = blueprint.collections.dictionaries.default_name || blueprint.collections.dictionaries;
    }
    if (!names.codes && blueprint.collections.codes) {
      names.codes = blueprint.collections.codes.default_name || blueprint.collections.codes;
    }
    if (!names.shortcuts && blueprint.collections.shortcuts) {
      names.shortcuts = blueprint.collections.shortcuts.default_name || blueprint.collections.shortcuts;
    }
  }

  // Final fallbacks for common collection names
  if (!names.compositions) names.compositions = 'compositions';
  if (!names.ehr_index) names.ehr_index = 'ehr_index';

  return names;
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
