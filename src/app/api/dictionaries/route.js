// src/app/api/dictionaries/route.js
/**
 * Dictionary Management API
 *
 * Manages system dictionaries (_shortcuts, _codes) that are used by
 * persistence strategies for path compression and archetype encoding.
 *
 * Key concepts:
 * - System dictionaries exist in the core database (source of truth)
 * - When a strategy requires dictionaries, they are copied to tenant DB
 * - Some dictionaries are cross-strategy (arcodes can be shared)
 * - Users can view and manage dictionaries from the GUI
 */
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

export const dynamic = 'force-dynamic';

// System dictionary definitions
const SYSTEM_DICTIONARIES = {
  shortcuts: {
    id: 'shortcuts',
    name: 'Path Shortcuts',
    description: 'Maps full AQL paths to short integer codes for storage efficiency. Pre-computed from templates.',
    coreCollection: '_shortcuts',
    tenantCollection: '_shortcuts',
    crossStrategy: false,
    requiredBy: ['transform.rps'],
    mustPreExist: true, // Must be copied before transformation - not generated at runtime
    structure: {
      keys: 'Array of path strings',
      values: 'Array of integer codes',
      _id: 'Document identifier'
    }
  },
  codes: {
    id: 'codes',
    name: 'Archetype Codes',
    description: 'Maps archetype node IDs to integer codes. Generated at runtime if not present - can be seeded from core.',
    coreCollection: '_codes',
    tenantCollection: '_codes',
    crossStrategy: true, // Can be shared across strategies
    requiredBy: ['transform.openehr', 'transform.rps'],
    mustPreExist: false, // Generated dynamically at runtime, but can be pre-seeded
    generatedAtRuntime: true,
    structure: {
      at: 'AT-code mappings',
      _min: 'Minimum code value',
      _max: 'Maximum code value (if present)',
      '[archetype_id]': 'Per-archetype code mappings'
    }
  }
};

/**
 * GET /api/dictionaries
 *
 * List available dictionaries with their status in both core and tenant DBs
 *
 * Query params:
 * - includeContent: boolean - Include dictionary content (default: false)
 * - type: 'shortcuts' | 'codes' | 'all' - Filter by type
 */
export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const includeContent = searchParams.get('includeContent') === 'true';
    const typeFilter = searchParams.get('type');

    const coreDb = await getCoreDb();

    // Get tenant DB if available
    let tenantDb = null;
    let tenantDbName = null;
    try {
      const tenantResult = await getActiveTenantDb(req);
      tenantDb = tenantResult.db;
      tenantDbName = tenantResult.environment?.database;
    } catch (e) {
      // No tenant context - that's OK, will show warning in UI
      console.log('[Dictionaries] No tenant context:', e.message);
    }

    const dictionaries = [];

    for (const [key, def] of Object.entries(SYSTEM_DICTIONARIES)) {
      if (typeFilter && typeFilter !== 'all' && key !== typeFilter) continue;

      // Check core DB
      const coreDoc = await coreDb.collection(def.coreCollection).findOne({});
      const coreExists = !!coreDoc;
      const coreStats = coreExists ? await getDictionaryStats(coreDoc, key) : null;

      // Check tenant DB
      let tenantExists = false;
      let tenantStats = null;
      let tenantDoc = null;
      if (tenantDb) {
        tenantDoc = await tenantDb.collection(def.tenantCollection).findOne({});
        tenantExists = !!tenantDoc;
        tenantStats = tenantExists ? await getDictionaryStats(tenantDoc, key) : null;
      }

      const dictInfo = {
        ...def,
        core: {
          exists: coreExists,
          stats: coreStats,
          collection: def.coreCollection
        },
        tenant: tenantDb ? {
          exists: tenantExists,
          stats: tenantStats,
          collection: def.tenantCollection,
          database: tenantDbName,
          needsSync: coreExists && (!tenantExists || needsResync(coreStats, tenantStats))
        } : null
      };

      if (includeContent && coreExists) {
        dictInfo.content = {
          core: sanitizeDictContent(coreDoc, key),
          tenant: tenantExists ? sanitizeDictContent(tenantDoc, key) : null
        };
      }

      dictionaries.push(dictInfo);
    }

    return NextResponse.json({
      dictionaries,
      hasTenantContext: !!tenantDb,
      tenantDatabase: tenantDbName
    });
  } catch (error) {
    console.error('GET /api/dictionaries error:', error);
    return safeErrorResponse(error, 'Failed to fetch dictionaries');
  }
}

/**
 * POST /api/dictionaries
 *
 * Perform dictionary operations (copy, sync, validate)
 *
 * Body:
 * - action: 'copy' | 'sync' | 'validate' | 'preview'
 * - dictionaryId: 'shortcuts' | 'codes'
 * - targetDatabase: (optional) specific target DB
 */
export async function POST(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { action, dictionaryId, targetDatabase } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const def = SYSTEM_DICTIONARIES[dictionaryId];
    if (!def && dictionaryId) {
      return NextResponse.json({ error: `Unknown dictionary: ${dictionaryId}` }, { status: 400 });
    }

    const coreDb = await getCoreDb();

    // Get tenant DB
    let tenantDb = null;
    let tenantDbName = null;
    try {
      const tenantResult = await getActiveTenantDb(req);
      tenantDb = tenantResult.db;
      tenantDbName = tenantResult.environment?.database;
    } catch (e) {
      if (action !== 'preview' && action !== 'validate') {
        return NextResponse.json({
          error: 'No active tenant database. Select an environment first.'
        }, { status: 400 });
      }
    }

    switch (action) {
      case 'copy': {
        if (!dictionaryId) {
          return NextResponse.json({ error: 'dictionaryId required for copy' }, { status: 400 });
        }

        // Get source document
        const sourceDoc = await coreDb.collection(def.coreCollection).findOne({});
        if (!sourceDoc) {
          return NextResponse.json({
            error: `Dictionary '${dictionaryId}' not found in core database`
          }, { status: 404 });
        }

        // Check if already exists in tenant
        const existingDoc = await tenantDb.collection(def.tenantCollection).findOne({});

        // Copy to tenant
        const copyDoc = {
          ...sourceDoc,
          _copiedFrom: 'core',
          _copiedAt: new Date(),
          _sourceId: sourceDoc._id
        };
        delete copyDoc._id;

        if (existingDoc) {
          // Update existing
          await tenantDb.collection(def.tenantCollection).replaceOne(
            { _id: existingDoc._id },
            { ...copyDoc, _id: existingDoc._id }
          );
        } else {
          // Insert new
          await tenantDb.collection(def.tenantCollection).insertOne(copyDoc);
        }

        const stats = await getDictionaryStats(sourceDoc, dictionaryId);

        return NextResponse.json({
          success: true,
          action: 'copy',
          dictionary: dictionaryId,
          targetDatabase: tenantDbName,
          targetCollection: def.tenantCollection,
          stats,
          wasUpdate: !!existingDoc
        });
      }

      case 'sync': {
        // Sync all required dictionaries for the tenant
        const results = [];

        for (const [key, dictDef] of Object.entries(SYSTEM_DICTIONARIES)) {
          if (dictionaryId && key !== dictionaryId) continue;

          const sourceDoc = await coreDb.collection(dictDef.coreCollection).findOne({});
          if (!sourceDoc) {
            results.push({ dictionary: key, skipped: true, reason: 'Not found in core' });
            continue;
          }

          const existingDoc = await tenantDb.collection(dictDef.tenantCollection).findOne({});

          const copyDoc = {
            ...sourceDoc,
            _copiedFrom: 'core',
            _copiedAt: new Date(),
            _sourceId: sourceDoc._id
          };
          delete copyDoc._id;

          if (existingDoc) {
            await tenantDb.collection(dictDef.tenantCollection).replaceOne(
              { _id: existingDoc._id },
              { ...copyDoc, _id: existingDoc._id }
            );
          } else {
            await tenantDb.collection(dictDef.tenantCollection).insertOne(copyDoc);
          }

          results.push({
            dictionary: key,
            success: true,
            wasUpdate: !!existingDoc,
            stats: await getDictionaryStats(sourceDoc, key)
          });
        }

        return NextResponse.json({
          success: true,
          action: 'sync',
          targetDatabase: tenantDbName,
          results
        });
      }

      case 'validate': {
        // Validate dictionaries for a strategy
        const strategyRequirements = body.strategy?.blueprint?.kehrnel_library?.capabilities || [];
        const validation = {
          required: [],
          available: [],
          missing: []
        };

        for (const [key, dictDef] of Object.entries(SYSTEM_DICTIONARIES)) {
          const isRequired = dictDef.requiredBy.some(engine =>
            strategyRequirements.includes('shortcuts_generation') && key === 'shortcuts' ||
            strategyRequirements.includes('arcodes_encoding') && key === 'codes'
          );

          if (isRequired) {
            validation.required.push(key);

            const coreDoc = await coreDb.collection(dictDef.coreCollection).findOne({});
            const tenantDoc = tenantDb
              ? await tenantDb.collection(dictDef.tenantCollection).findOne({})
              : null;

            if (coreDoc) {
              validation.available.push({
                dictionary: key,
                inCore: true,
                inTenant: !!tenantDoc,
                needsCopy: !tenantDoc
              });
            } else {
              validation.missing.push(key);
            }
          }
        }

        return NextResponse.json({
          valid: validation.missing.length === 0,
          validation,
          hasTenantContext: !!tenantDb
        });
      }

      case 'preview': {
        // Preview dictionary content
        if (!dictionaryId) {
          return NextResponse.json({ error: 'dictionaryId required for preview' }, { status: 400 });
        }

        const sourceDoc = await coreDb.collection(def.coreCollection).findOne({});
        if (!sourceDoc) {
          return NextResponse.json({
            error: `Dictionary '${dictionaryId}' not found`
          }, { status: 404 });
        }

        return NextResponse.json({
          dictionary: dictionaryId,
          name: def.name,
          description: def.description,
          structure: def.structure,
          stats: await getDictionaryStats(sourceDoc, dictionaryId),
          preview: sanitizeDictContent(sourceDoc, dictionaryId),
          crossStrategy: def.crossStrategy
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('POST /api/dictionaries error:', error);
    return safeErrorResponse(error, 'Dictionary operation failed');
  }
}

/**
 * Get statistics for a dictionary document
 */
async function getDictionaryStats(doc, type) {
  if (!doc) return null;

  if (type === 'shortcuts') {
    // Handle both array and object formats for keys/values
    const keys = doc.keys;
    const values = doc.values;

    let totalPaths = 0;
    let samplePaths = [];

    if (Array.isArray(keys)) {
      totalPaths = keys.length;
      samplePaths = keys.slice(0, 5);
    } else if (keys && typeof keys === 'object') {
      const keyEntries = Object.keys(keys);
      totalPaths = keyEntries.length;
      samplePaths = keyEntries.slice(0, 5);
    }

    let totalCodes = 0;
    if (Array.isArray(values)) {
      totalCodes = values.length;
    } else if (values && typeof values === 'object') {
      totalCodes = Object.keys(values).length;
    }

    return {
      totalPaths,
      totalCodes,
      samplePaths
    };
  }

  if (type === 'codes') {
    const archetypes = Object.keys(doc).filter(k => k.startsWith('openEHR-'));
    return {
      totalArchetypes: archetypes.length,
      atCodesCount: doc.at ? Object.keys(doc.at).length : 0,
      minCode: doc._min,
      maxCode: doc._max,
      sampleArchetypes: archetypes.slice(0, 5)
    };
  }

  return { documentId: doc._id?.toString() };
}

/**
 * Check if tenant dictionary needs resync from core
 */
function needsResync(coreStats, tenantStats) {
  if (!tenantStats) return true;
  if (!coreStats) return false;

  // Compare key metrics
  if (coreStats.totalPaths !== tenantStats.totalPaths) return true;
  if (coreStats.totalArchetypes !== tenantStats.totalArchetypes) return true;

  return false;
}

/**
 * Sanitize dictionary content for preview (limit size)
 */
function sanitizeDictContent(doc, type) {
  if (!doc) return null;

  const result = { _id: doc._id?.toString() };

  if (type === 'shortcuts') {
    // Handle both array and object formats
    const keys = doc.keys;
    const values = doc.values;

    if (Array.isArray(keys)) {
      result.keys = keys.slice(0, 20);
      result._truncated = keys.length > 20;
      result._totalKeys = keys.length;
    } else if (keys && typeof keys === 'object') {
      const keyEntries = Object.entries(keys);
      result.keys = Object.fromEntries(keyEntries.slice(0, 20));
      result._truncated = keyEntries.length > 20;
      result._totalKeys = keyEntries.length;
    } else {
      result.keys = [];
      result._truncated = false;
      result._totalKeys = 0;
    }

    if (Array.isArray(values)) {
      result.values = values.slice(0, 20);
    } else if (values && typeof values === 'object') {
      result.values = Object.fromEntries(Object.entries(values).slice(0, 20));
    } else {
      result.values = [];
    }
  } else if (type === 'codes') {
    result.at = doc.at ? Object.fromEntries(
      Object.entries(doc.at).slice(0, 20)
    ) : {};
    result._min = doc._min;
    result._max = doc._max;
    result._truncated = doc.at ? Object.keys(doc.at).length > 20 : false;

    // Include first few archetype mappings
    const archetypes = Object.keys(doc).filter(k => k.startsWith('openEHR-'));
    for (const arch of archetypes.slice(0, 3)) {
      result[arch] = doc[arch];
    }
  }

  return result;
}
