import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/strategies/preview-transform/route.js
/**
 * Strategy Transform Preview API
 *
 * Tests a strategy configuration with a sample composition by calling
 * the actual Kehrnel Docker instance for that strategy.
 *
 * Architecture:
 * - Each strategy has its own Kehrnel Docker container
 * - This API routes to the correct container based on config.strategy
 * - Returns the REAL transformed output from Kehrnel
 */
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { getCoreDb } from '@/lib/db/coreDb';
import { getKehrnelEndpoint } from '@/lib/kehrnel/endpoints';
import { adaptForKehrnel } from '@/lib/strategies/configAdapter';

export const dynamic = 'force-dynamic';

function resolveStrategyApiPrefix(strategyId, strategy = null) {
  const raw = String(strategyId || '').trim();
  const fallbackDomain = String(
    strategy?.blueprint?.domain?.[0] ||
    strategy?.blueprint?.domain ||
    strategy?.domain ||
    ''
  ).trim().toLowerCase();

  if (!raw) return null;

  if (raw.includes('/')) {
    const parts = raw.split('/').filter(Boolean);
    const domain = parts[0] || '';
    const name = parts[1] || '';
    if (!domain || !name) return null;
    return `/api/strategies/${domain}/${name}`;
  }

  if (raw.includes('.')) {
    const [domain, ...rest] = raw.split('.');
    const name = rest.join('_') || '';
    if (!domain || !name) return null;
    return `/api/strategies/${domain}/${name}`;
  }

  if (!fallbackDomain) return null;
  return `/api/strategies/${fallbackDomain}/${raw}`;
}

/**
 * POST /api/strategies/preview-transform
 *
 * Test a strategy by calling the actual Kehrnel instance.
 *
 * Body:
 * - strategy: Full strategy object (with config including strategy name)
 * - sampleSource: { database, collection, documentId } to fetch sample from
 * - sampleComposition: Direct composition JSON (alternative to sampleSource)
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { strategy, sampleSource, sampleComposition } = body;
    const activeEnvId = (
      req.headers.get('x-active-env')
      || req.headers.get('x-env-id')
      || req.headers.get('x-environment-id')
      || body?.environment
      || body?.envId
      || body?.sampleSource?.environment
      || ''
    ).toString().trim();

    if (!strategy) {
      return NextResponse.json({ error: 'strategy is required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    // Get sample composition
    let composition = sampleComposition;
    let sampleMeta = {};

    if (!composition && sampleSource) {
      const sourceDb = sampleSource.database
        ? coreDb.client.db(sampleSource.database)
        : coreDb;

      const collectionName = sampleSource.collection || 'sample-compositions';
      const col = sourceDb.collection(collectionName);

      let doc;
      if (sampleSource.documentId) {
        const query = ObjectId.isValid(sampleSource.documentId)
          ? { _id: new ObjectId(sampleSource.documentId) }
          : { _id: sampleSource.documentId };
        doc = await col.findOne(query);
      } else {
        // Get a random sample
        doc = await col.findOne({});
      }

      if (!doc) {
        return NextResponse.json({
          error: 'Sample composition not found',
          source: sampleSource
        }, { status: 404 });
      }

      // Extract composition from document structure
      if (Array.isArray(doc.compositions) && doc.compositions.length > 0) {
        composition = doc.compositions[0].composition || doc.compositions[0];
      } else if (doc.canonicalJSON) {
        composition = doc.canonicalJSON;
      } else if (doc.composition) {
        composition = doc.composition;
      } else {
        // Remove MongoDB _id if present
        const { _id, ...rest } = doc;
        composition = rest;
      }

      sampleMeta = {
        sourceDatabase: sampleSource.database || 'core',
        sourceCollection: collectionName,
        sourceId: doc._id?.toString(),
        templateId: doc.template_id || composition.archetype_details?.template_id?.value,
        templateName: doc.template_name,
        patientId: doc.patient_id || doc.ehr_id
      };
    }

    if (!composition) {
      return NextResponse.json({
        error: 'No composition provided. Use sampleComposition or sampleSource.'
      }, { status: 400 });
    }

    // Build Kehrnel config from strategy
    // Merge strategy overrides from active environment (if any)
    const envOverrides = await loadActiveStrategyOverrides(coreDb, session?.user?.email, strategy, activeEnvId);
    const kehrnelConfig = deepMerge(adaptForKehrnel(strategy), envOverrides);
    const strategyName = String(
      kehrnelConfig.strategy ||
      strategy?.kehrnelId ||
      strategy?.id ||
      strategy?.blueprint?.id ||
      ''
    ).trim();
    if (!strategyName) {
      return NextResponse.json(
        { error: 'Strategy ID is missing from strategy pack metadata' },
        { status: 400 }
      );
    }

    // Get the Kehrnel endpoint for this strategy
    const endpoint = await getKehrnelEndpoint(coreDb, strategyName);

    if (!endpoint) {
      return NextResponse.json(
        { error: `No Kehrnel instance configured for strategy '${strategyName}'` },
        { status: 503 }
      );
    }

    console.log(`[Preview Transform] Strategy: ${strategyName} → ${endpoint.url}`);

    // Build a canonical-style payload expected by Kehrnel ingestion, with preview flag
    const previewEhrId = `preview-${Date.now()}`;
    const previewCompId = `preview-${uuidv4()}`;
    // Resolve tenant DB for analytics lookup (prefer active tenant)
    let tenantDb = null;
    try {
      const { getActiveTenantDb, resolveEnvByIdForUser } = await import('@/lib/db/tenantDb');
      // First try active tenant
      try {
        const activeTenant = await getActiveTenantDb(req);
        tenantDb = activeTenant?.db || null;
      } catch (e) {
        // ignore
      }
      // If sampleSource specifies env, try resolving that
      if (!tenantDb && sampleSource?.environment) {
        const envResult = await resolveEnvByIdForUser(req, sampleSource.environment);
        tenantDb = envResult?.db || null;
      }
    } catch (err) {
      // ignore; fallback to core DB only
    }

    const analyticsTemplate = await loadAnalyticsTemplate(coreDb, composition, sampleMeta, tenantDb);
    const analyticsAllowedPaths = Array.isArray(analyticsTemplate?.fields)
      ? analyticsTemplate.fields.map(f => f.path).filter(Boolean)
      : [];
    const searchProjection = describeSearchProjection(
      kehrnelConfig?.transform?.mappings,
      analyticsTemplate,
      analyticsAllowedPaths
    );

    // Use inner canonicalJSON if present; otherwise treat provided object as canonical
    const canonicalInput = composition?.canonicalJSON || composition;
    const normalizedComposition = normalizeDates(canonicalInput);

    const kehrnelPayload = {
      _id: previewCompId,
      ehr_id: previewEhrId,
      canonicalJSON: normalizedComposition,
      preview: true,
      // Attach config and analytics allowlist for runtime-aware flattening
      config: {
        ...kehrnelConfig,
        analytics_allowed_paths: analyticsAllowedPaths
        }
    };

    const strategyApiPrefix = resolveStrategyApiPrefix(strategyName, strategy);
    if (!strategyApiPrefix) {
      return NextResponse.json(
        { error: `Unable to resolve API prefix from strategy pack ID '${strategyName}'` },
        { status: 400 }
      );
    }

    // Call the strategy-scoped API (preview mode, do not persist)
    const kehrnelResponse = await fetch(`${endpoint.url}${strategyApiPrefix}/ingest/body?preview=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(endpoint.apiKey && { 'X-API-Key': endpoint.apiKey }),
        ...(activeEnvId && { 'x-active-env': activeEnvId }),
        'X-Preview-Mode': 'true' // Signal this is a preview, don't persist
      },
      body: JSON.stringify(kehrnelPayload)
    });

    if (!kehrnelResponse.ok) {
      const errorText = await kehrnelResponse.text();
      console.error(`[Preview Transform] Kehrnel error:`, errorText);
      return NextResponse.json(
        { error: `Kehrnel error ${kehrnelResponse.status}`, details: errorText || 'No response body' },
        { status: kehrnelResponse.status || 502 }
      );
    }

    const kehrnelResult = await kehrnelResponse.json();

    // Build minimal meta doc if Kehrnel doesn't return one
    const fallbackMeta = {
      ehr_id: previewEhrId,
      templates: [sampleMeta?.templateId || composition?.archetype_details?.template_id?.value || 'unknown'],
      documents: [{
        id: previewCompId,
        template: sampleMeta?.templateId || composition?.archetype_details?.template_id?.value || '',
        archetype: composition?.archetype_node_id || ''
      }]
    };

    // If no analytics mapping, drop search doc from preview; otherwise prefer Kehrnel search, and fallback to manual extraction if empty
    let searchDoc =
      analyticsAllowedPaths.length === 0
        ? null
        : (kehrnelResult.search_doc || kehrnelResult.search);
    const searchSuppressed = analyticsAllowedPaths.length === 0;

    const searchNodesField = kehrnelConfig?.fields?.search?.nodes || 'sn';
    const searchPathField = kehrnelConfig?.fields?.search?.path || 'p';
    const searchDataField = kehrnelConfig?.fields?.search?.data || 'data';

    // If search doc is missing or empty but analytics paths exist, build a minimal search doc from canonical composition
    const hasSearchNodes = searchDoc && Array.isArray(searchDoc[searchNodesField]) && searchDoc[searchNodesField].length > 0;
    if (!hasSearchNodes && analyticsAllowedPaths.length > 0) {
      const manualNodes = [];
      const cnNodes = kehrnelResult.base_doc?.cn || kehrnelResult.composition?.cn || [];
      for (const aqlPath of analyticsAllowedPaths) {
        const val = extractByAqlPath(normalizedComposition, aqlPath);
        if (val !== undefined) {
          const candidatePath = findPathFromCn(cnNodes, aqlPath) || aqlPath;
          manualNodes.push({ [searchPathField]: candidatePath, [searchDataField]: val });
        }
      }
      searchDoc = {
        _id: previewCompId,
        tid: kehrnelResult.base_doc?.tid || kehrnelResult.composition?.tid || null,
        ehr_id: previewEhrId,
        [searchNodesField]: manualNodes
      };
    }

    // Compute node count without mutating the returned composition
    const compNodeCount =
      (kehrnelResult.base_doc?.cn && Array.isArray(kehrnelResult.base_doc.cn)
        ? kehrnelResult.base_doc.cn.length
        : (kehrnelResult.composition?.cn && Array.isArray(kehrnelResult.composition.cn)
            ? kehrnelResult.composition.cn.length
            : 0));

    return NextResponse.json({
      preview: true,
      simulated: false,
      kehrnelInstance: endpoint.name,
      kehrnelUrl: endpoint.url,

      // Source info
      source: {
        ...sampleMeta,
        compositionType: composition._type,
        compositionName: composition.name?.value || composition.name,
        archetypeNodeId: composition.archetype_node_id
      },

      // Strategy info
      strategy: {
        name: strategy.name,
        blueprintId: strategy.blueprint?.id,
        strategyName
      },

      // Config sent to Kehrnel
      config: kehrnelConfig,
      searchProjection,
      searchProjectionPaths: analyticsAllowedPaths,
      // Backward-compatible aliases for older HDL consumers
      analyticsTemplate: analyticsTemplate || null,
      analyticsPaths: analyticsAllowedPaths,

      // Real output from Kehrnel
      output: {
        composition: kehrnelResult.base_doc || kehrnelResult.composition,
        search: searchDoc,
        meta: kehrnelResult.meta_doc || kehrnelResult.meta || fallbackMeta,
        _nodesTotal: compNodeCount,
        searchSuppressed
      },

      // Original composition (truncated for preview)
      originalComposition: composition
    });
  } catch (error) {
    console.error('POST /api/strategies/preview-transform error:', error);
    return NextResponse.json(
      { error: 'Transform preview failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Build a simulated preview when Kehrnel is not available
 */
function buildSimulatedPreview(composition, config) {
  const nodesField = config.fields?.composition?.nodes || 'cn';
  const searchNodesField = config.fields?.search?.nodes || 'sn';
  const ehrIdField = config.fields?.composition?.ehr_id || 'ehr_id';

  const previewEhrId = `preview-${Date.now()}`;
  const previewCompId = `comp-${Date.now()}`;

  // Build simulated nodes from composition
  const nodes = [];
  const pathMode = config.node_representation?.path?.mode || 'reversed';
  const joiner = config.node_representation?.path?.token_joiner || '.';

  function extractNodes(obj, path = []) {
    if (!obj || typeof obj !== 'object') return;

    if (obj._type || obj.value !== undefined || obj.defining_code) {
      const pathStr = pathMode === 'reversed'
        ? [...path].reverse().join(joiner)
        : path.join(joiner);

      nodes.push({
        p: pathStr,
        data: {
          _type: obj._type,
          value: obj.value,
          magnitude: obj.magnitude,
          defining_code: obj.defining_code
        }
      });
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, idx) => extractNodes(item, [...path, `[${idx}]`]));
    } else {
      for (const [key, val] of Object.entries(obj)) {
        if (key.startsWith('_')) continue;
        extractNodes(val, [...path, key]);
      }
    }
  }

  extractNodes(composition);

  return {
    composition: {
      _id: previewCompId,
      [ehrIdField]: previewEhrId,
      template_id: composition.archetype_details?.template_id?.value || 'unknown',
      [nodesField]: nodes.slice(0, 10), // First 10 nodes
      _nodesTotal: nodes.length,
      _simulated: true
    },
    search: config.collections?.search?.enabled ? {
      [ehrIdField]: previewEhrId,
      comp_id: previewCompId,
      [searchNodesField]: nodes.slice(0, 5).map(n => ({
        p: n.p,
        data: n.data
      })),
      _simulated: true
    } : null,
    meta: {
      [ehrIdField]: previewEhrId,
      templates: [composition.archetype_details?.template_id?.value || 'unknown'],
      _simulated: true
    }
  };
}

/**
 * Truncate composition for preview (keep structure, limit depth)
 */
function truncateForPreview(obj, maxDepth = 3, currentDepth = 0) {
  if (currentDepth >= maxDepth) {
    if (Array.isArray(obj)) return `[Array(${obj.length})]`;
    if (typeof obj === 'object' && obj !== null) return '{...}';
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 3).map(item =>
      truncateForPreview(item, maxDepth, currentDepth + 1)
    );
  }

  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    const keys = Object.keys(obj).slice(0, 10);
    for (const key of keys) {
      result[key] = truncateForPreview(obj[key], maxDepth, currentDepth + 1);
    }
    if (Object.keys(obj).length > 10) {
      result['...'] = `(${Object.keys(obj).length - 10} more keys)`;
    }
    return result;
  }

  return obj;
}

/**
 * Normalize Mongo-style {"$date": "..."} objects to ISO strings.
 */
function normalizeDates(input) {
  if (Array.isArray(input)) {
    return input.map(normalizeDates);
  }
  if (input && typeof input === 'object') {
    if ('$date' in input && Object.keys(input).length === 1) {
      return input['$date'];
    }
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = normalizeDates(v);
    }
    return out;
  }
  return input;
}

/**
 * Extract value from canonical composition using a simplified AQL path.
 * Supports selectors like items[openEHR-...], [at0001], or numeric indexes.
 */
function extractByAqlPath(root, aqlPath) {
  if (!root || !aqlPath || typeof aqlPath !== 'string') return undefined;
  const segments = aqlPath.replace(/^\//, '').split('/').filter(Boolean);
  let current = root;

  for (const seg of segments) {
    const match = seg.match(/^([^\[]+)(\[(.+?)\])?$/);
    if (!match) return undefined;
    const key = match[1];
    const selRaw = match[3];

    if (Array.isArray(current)) {
      // If current is array, try to select by archetype_node_id or index
      if (selRaw && !isNaN(Number(selRaw))) {
        const idx = Number(selRaw);
        current = current[idx];
      } else {
        current = current.find(item => matchSelector(item, selRaw)) || current[0];
      }
    } else if (current && typeof current === 'object') {
      current = current[key];
      if (Array.isArray(current)) {
        if (selRaw && !isNaN(Number(selRaw))) {
          const idx = Number(selRaw);
          current = current[idx];
        } else {
          current = current.find(item => matchSelector(item, selRaw)) || current[0];
        }
      }
    } else {
      return undefined;
    }
  }
  return current;
}

function matchSelector(item, selector) {
  if (!selector) return true;
  if (!item || typeof item !== 'object') return false;
  // If selector contains comma, take first token (archetype)
  const primary = selector.split(',')[0].replace(/^'|'$/g, '');
  if (primary && item.archetype_node_id === primary) return true;
  return false;
}

function findPathFromCn(cnNodes, aqlPath) {
  if (!Array.isArray(cnNodes) || !aqlPath) return null;
  const sel = lastSelector(aqlPath);
  if (!sel) return null;
  const match = cnNodes.find(n => n?.archetype_node_id === sel);
  return match?.p || null;
}

function lastSelector(aqlPath) {
  const parts = aqlPath.split('[');
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i];
    const token = seg.split(']')[0];
    if (token) return token.replace(/^'|'$/g, '');
  }
  return null;
}

/**
 * Load strategy overrides from the active environment for this user/strategy
 */
async function loadActiveStrategyOverrides(coreDb, email, strategy, preferredEnvId = '') {
  if (!email) return {};
  const user = await coreDb.collection('users').findOne({ email }) || {};
  const envs = Array.isArray(user.environments) ? user.environments : [];
  const activeEnv = (preferredEnvId
    ? envs.find(e => e.id === preferredEnvId)
    : null) || envs.find(e => e.isActive) || envs[0];
  if (!activeEnv) return {};

  const links = Array.isArray(activeEnv.strategyLinks) ? activeEnv.strategyLinks : [];
  // Match by strategyId or domain
  let link = links.find(l => (l.strategyId || '').toString() === (strategy._id || strategy.id || '').toString());
  if (!link) {
    const dp = strategy.blueprint?.domain?.[0] || 'openEHR';
    link = links.find(l => l.domain === dp) || links[0];
  }
  return link?.configOverrides || {};
}

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  const out = Array.isArray(target) ? [...target] : { ...(target || {}) };
  for (const [key, val] of Object.entries(source)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      out[key] = deepMerge(out[key], val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Load analyticsTemplate for a template key (name or templateId) from core DB
 */
async function loadAnalyticsTemplate(coreDb, composition, sampleMeta, tenantDb = null) {
  try {
    const templateKeys = [
      sampleMeta?.templateId,
      sampleMeta?.templateName,
      composition?.archetype_details?.template_id?.value,
      composition?.template_id,
      composition?.template_name
    ].filter(Boolean);

    if (!templateKeys.length) return null;

    const query = {
      $or: [
        { name: { $in: templateKeys } },
        { 'metadata.templateId': { $in: templateKeys } }
      ]
    };

    // Prefer tenant DB if available (user-owned templates)
    if (tenantDb) {
      const docTenant = await tenantDb.collection('user-data-models')
        .findOne(query, { projection: { analyticsTemplate: 1 } });
      if (docTenant?.analyticsTemplate) return docTenant.analyticsTemplate;
    }

    const doc = await coreDb.collection('user-data-models')
      .findOne(query, { projection: { analyticsTemplate: 1 } });

    return doc?.analyticsTemplate || null;
  } catch (err) {
    console.warn('loadAnalyticsTemplate error:', err.message);
    return null;
  }
}

function describeSearchProjection(transformMappings, analyticsTemplate, paths = []) {
  const fieldCount = Array.isArray(paths) ? paths.length : 0;
  const source = describeTransformMappingsSource(transformMappings);
  const templateId = String(
    analyticsTemplate?.templateId ||
    analyticsTemplate?.template_id ||
    analyticsTemplate?.id ||
    ''
  ).trim() || null;

  return {
    source: source.kind,
    sourceLabel: source.label,
    mappingsRef: transformMappings ?? null,
    templateId,
    fieldCount,
    status: fieldCount > 0 ? 'mapped' : 'missing',
    emptyStateMessage: fieldCount > 0
      ? null
      : 'No search projection mappings found for this template. Kehrnel will skip the `compositions_search` sidecar.'
  };
}

function describeTransformMappingsSource(transformMappings) {
  if (typeof transformMappings === 'string') {
    if (transformMappings.startsWith('file://')) {
      return { kind: 'file', label: transformMappings };
    }
    if (transformMappings.startsWith('collection://')) {
      return { kind: 'collection', label: transformMappings };
    }
    return { kind: 'reference', label: transformMappings };
  }

  if (transformMappings && typeof transformMappings === 'object') {
    const source = String(transformMappings.source || '').trim().toLowerCase();
    if (source === 'catalog' || source === 'db' || source === 'database' || source === 'model_catalog') {
      const collection = String(transformMappings.catalog_collection || transformMappings.collection || 'user-data-models').trim();
      const domain = String(transformMappings.domain || '').trim();
      return {
        kind: 'catalog',
        label: domain ? `catalog:${collection} (${domain})` : `catalog:${collection}`
      };
    }
    return { kind: 'inline', label: 'inline transform.mappings' };
  }

  return { kind: 'none', label: 'No transform.mappings configured' };
}

/**
 * Filter search document nodes to only analytics-configured paths
 */
function applyAnalyticsFilter(searchDoc, analyticsTemplate, kehrnelConfig) {
  if (!searchDoc || !analyticsTemplate?.fields?.length) return searchDoc;
  const nodesField = kehrnelConfig?.fields?.search?.nodes || 'sn';
  const pathField = kehrnelConfig?.fields?.search?.path || 'p';

  const nodes = searchDoc[nodesField];
  if (!Array.isArray(nodes)) return searchDoc;

  const allowed = new Set(
    analyticsTemplate.fields
      .map(f => f?.path)
      .filter(Boolean)
  );

  const filtered = nodes.filter(n => allowed.has(n?.[pathField]));
  return { ...searchDoc, [nodesField]: filtered };
}

/**
 * GET /api/strategies/preview-transform
 *
 * Get available sample sources for preview, or fetch a random sample.
 *
 * Query params:
 * - random=true: Fetch a random sample composition
 * - template=xxx: Filter random sample by template ID
 *
 * Returns:
 * 1. sample-compositions from core database
 * 2. compositions from active tenant database (if available)
 * 3. List of available templates for filtering
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const wantsRandom = searchParams.get('random') === 'true';
    const templateFilter = searchParams.get('template');

    const coreDb = await getCoreDb();

    // If requesting a random sample, fetch and return it
    if (wantsRandom) {
      const sampleCol = coreDb.collection('sample-compositions');

      // Build query - filter by template if specified
      const query = {};
      if (templateFilter) {
        query.$or = [
          { template_id: templateFilter },
          { template_name: templateFilter },
          { 'compositions.template_id': templateFilter }
        ];
      }

      // Use aggregation with $sample for true random selection
      const pipeline = [];
      if (Object.keys(query).length > 0) {
        pipeline.push({ $match: query });
      }
      pipeline.push({ $sample: { size: 1 } });

      const docs = await sampleCol.aggregate(pipeline).toArray();
      const doc = docs[0];

      if (!doc) {
        return NextResponse.json({
          sample: null,
          error: templateFilter ? `No samples found for template: ${templateFilter}` : 'No samples found'
        });
      }

      // Extract template ID and composition from various possible locations
      let templateId = doc.template_id || doc.template_name;
      let composition = null;

      if (doc.compositions?.[0]) {
        composition = doc.compositions[0].composition || doc.compositions[0];
        if (!templateId) {
          templateId = composition.archetype_details?.template_id?.value || composition.template_id;
        }
      } else if (doc.canonicalJSON) {
        composition = doc.canonicalJSON;
        if (!templateId) {
          templateId = composition.archetype_details?.template_id?.value;
        }
      } else if (doc.composition) {
        composition = doc.composition;
        if (!templateId) {
          templateId = composition.archetype_details?.template_id?.value;
        }
      } else {
        // The document itself might be the composition
        const { _id, ...rest } = doc;
        composition = rest;
        if (!templateId) {
          templateId = composition.archetype_details?.template_id?.value;
        }
      }

      // Look up template name from sample_templates
      let templateName = templateId;
      try {
        const collections = await coreDb.listCollections({}, { nameOnly: true }).toArray();
        const collectionNames = collections.map(c => c.name);
        let sampleTemplatesCol = null;
        if (collectionNames.includes('sample_templates')) {
          sampleTemplatesCol = coreDb.collection('sample_templates');
        } else if (collectionNames.includes('sample-templates')) {
          sampleTemplatesCol = coreDb.collection('sample-templates');
        }

        if (sampleTemplatesCol && templateId) {
          // Search across all possible template ID field names
          // metadata.templateId is the primary field in sample-templates collection
          const templateDoc = await sampleTemplatesCol.findOne({
            $or: [
              { 'metadata.templateId': templateId },
              { template_id: templateId },
              { templateId: templateId },
              { 'webTemplate.metadata.templateId': templateId },
              { 'webTemplate.templateId': templateId },
              { name: templateId }
            ]
          });
          if (templateDoc) {
            // doc.name is the primary human-readable name field
            templateName =
              templateDoc.name ||
              templateDoc.template_name ||
              templateDoc.templateName ||
              templateDoc.metadata?.name ||
              templateDoc.webTemplate?.tree?.name ||
              templateDoc.webTemplate?.metadata?.name ||
              templateDoc.webTemplate?.name ||
              templateId;
          }
        }
      } catch (e) {
        console.error('Error looking up template name:', e);
      }

      return NextResponse.json({
        sample: {
          _id: doc._id?.toString(),
          templateId: templateId || 'unknown',
          template_id: templateId || 'unknown',
          templateName: templateName || templateId || 'unknown',
          composition: composition
        }
      });
    }

    // Otherwise, return sources and templates list
    const sources = [];
    const templates = [];

    // 1. Check sample-compositions in core DB (the canonical sample source)
    try {
      const sampleCompositionsCount = await coreDb.collection('sample-compositions').countDocuments();
      if (sampleCompositionsCount > 0) {
        sources.push({
          database: null, // core DB
          collection: 'sample-compositions',
          count: sampleCompositionsCount,
          description: 'Core sample compositions',
          type: 'samples'
        });

        // Get distinct templates from sample-compositions
        // Try multiple possible field locations for template ID
        const distinctTemplates = await coreDb.collection('sample-compositions').aggregate([
          {
            $project: {
              templateId: {
                $ifNull: [
                  '$template_id',
                  { $ifNull: [
                    '$templateId',
                    { $ifNull: [
                      { $arrayElemAt: ['$compositions.template_id', 0] },
                      { $ifNull: [
                        '$canonicalJSON.archetype_details.template_id.value',
                        '$composition.archetype_details.template_id.value'
                      ]}
                    ]}
                  ]}
                ]
              }
            }
          },
          { $match: { templateId: { $ne: null, $type: 'string' } } },
          { $group: { _id: '$templateId' } },
          { $limit: 50 }
        ]).toArray();

        // Resolve collection name (might be with underscore or dash)
        let sampleTemplatesCol = null;
        try {
          const collections = await coreDb.listCollections({}, { nameOnly: true }).toArray();
          const collectionNames = collections.map(c => c.name);
          if (collectionNames.includes('sample_templates')) {
            sampleTemplatesCol = coreDb.collection('sample_templates');
          } else if (collectionNames.includes('sample-templates')) {
            sampleTemplatesCol = coreDb.collection('sample-templates');
          }
        } catch (e) {
          console.error('Error listing collections:', e);
        }

        const templateNameMap = {};

        if (sampleTemplatesCol) {
          // Fetch all sample templates to build a complete mapping
          const templateDocs = await sampleTemplatesCol.find({}).toArray();
          console.log(`[Preview Transform] Found ${templateDocs.length} template documents in sample-templates`);

          // Build a map of templateId (UUID) -> displayName
          // The sample-templates collection has:
          // - name: human-readable name (e.g., "Blood Pressure Measurement")
          // - metadata.templateId: the UUID that links to sample-compositions
          for (const doc of templateDocs) {
            // Possible UUID fields - metadata.templateId is the primary one
            const possibleUuids = [
              doc.metadata?.templateId,
              doc.template_id,
              doc.templateId,
              doc.webTemplate?.metadata?.templateId,
              doc.webTemplate?.templateId,
              doc._id?.toString()
            ].filter(Boolean);

            // The display name is primarily in doc.name
            const displayName =
              doc.name ||
              doc.template_name ||
              doc.templateName ||
              doc.metadata?.name ||
              doc.webTemplate?.tree?.name ||
              doc.webTemplate?.metadata?.name ||
              doc.webTemplate?.name ||
              possibleUuids[0];

            // Map all possible UUIDs to the display name
            for (const uuid of possibleUuids) {
              if (uuid && typeof uuid === 'string') {
                templateNameMap[uuid] = displayName;
              }
            }
          }
          console.log(`[Preview Transform] Template name map has ${Object.keys(templateNameMap).length} entries`);
          // Log a few sample entries for debugging
          const sampleEntries = Object.entries(templateNameMap).slice(0, 3);
          for (const [k, v] of sampleEntries) {
            console.log(`[Preview Transform] Sample mapping: ${k} -> ${v}`);
          }
        } else {
          console.log('[Preview Transform] No sample-templates collection found');
        }

        console.log(`[Preview Transform] Found ${distinctTemplates.length} distinct templates in sample-compositions`);
        for (const t of distinctTemplates) {
          if (t._id && typeof t._id === 'string') {
            const mappedName = templateNameMap[t._id];
            console.log(`[Preview Transform] Template ${t._id} -> ${mappedName || '(not found in map)'}`);
            templates.push({
              id: t._id,
              name: mappedName || t._id
            });
          }
        }
      }
    } catch (e) {
      // Collection doesn't exist
      console.error('Error fetching templates:', e);
    }

    // 2. Check active tenant database for compositions
    try {
      const { getActiveTenantDb } = await import('@/lib/db/tenantDb');
      const tenantResult = await getActiveTenantDb(req);
      const tenantDb = tenantResult.db;
      const tenantDbName = tenantResult.envSummary?.database;

      if (tenantDb && tenantDbName) {
        // Look for compositions collection in tenant DB
        const tenantCollections = await tenantDb.listCollections().toArray();
        const compositionCollections = tenantCollections.filter(c =>
          c.name.includes('composition') && !c.name.startsWith('_')
        );

        for (const col of compositionCollections) {
          const count = await tenantDb.collection(col.name).countDocuments();
          if (count > 0) {
            sources.push({
              database: tenantDbName,
              collection: col.name,
              count,
              description: `Tenant: ${tenantDbName}`,
              type: 'tenant'
            });
          }
        }
      }
    } catch (e) {
      // No tenant context - that's OK
    }

    return NextResponse.json({
      sources,
      templates,
      total: sources.reduce((sum, s) => sum + s.count, 0),
      supportsCustomComposition: true
    });
  } catch (error) {
    console.error('GET /api/strategies/preview-transform error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sample sources', details: error.message },
      { status: 500 }
    );
  }
}
