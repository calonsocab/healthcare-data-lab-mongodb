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

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeModel(model = {}) {
  return {
    model_id: model.model_id || model.id || model.template_id || null,
    template_id: model.template_id || null,
    name: model.name || model.display_name || model.model_id || model.template_id || 'Unnamed model',
    domain: normalizeSyntheticDomain(model.domain),
    strategy_id: model.strategy_id || null,
    type: model.type || model.model_type || null,
    version: model.version || null,
    status: model.status || 'active',
    storage_ref: model.storage_ref || null,
    checksum: model.checksum || null
  };
}

function mapUserDataModelToSemanticModel(doc = {}, fallback = {}) {
  const idAsString = doc?._id?.toString?.() || null;
  const templateId = doc?.metadata?.templateId || null;
  const modelName = doc?.name || templateId || idAsString || 'Unnamed model';

  return {
    model_id: idAsString || templateId || modelName,
    template_id: templateId,
    name: modelName,
    domain: normalizeSyntheticDomain(doc?.domain || fallback.domain),
    strategy_id: fallback.strategyId || null,
    type: doc?.domain === 'openehr' ? 'opt' : (doc?.domain === 'fhir' ? 'fhir' : 'contextobject'),
    version: doc?.templateVersion || doc?.domainData?.schema?.version || null,
    status: 'active',
    storage_ref: null,
    checksum: null,
    lookupKeys: {
      id: idAsString,
      name: doc?.name || null,
      templateId,
      legacyModelId: doc?.model_id || doc?.modelId || null
    }
  };
}

async function resolveCatalogDb(req, environment, requestedDatabaseName) {
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
    const search = (searchParams.get('search') || '').trim();

    const requestedCatalogDatabase =
      searchParams.get('catalogDatabase') ||
      searchParams.get('modelSourceDatabase') ||
      searchParams.get('database_name') ||
      '';
    const requestedCatalogCollection =
      searchParams.get('catalogCollection') ||
      searchParams.get('modelSourceCollection') ||
      searchParams.get('catalog_collection') ||
      '';

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

    const catalogCollectionName = (requestedCatalogCollection || 'user-data-models').trim();
    const catalogDatabaseName = (requestedCatalogDatabase || environment?.database || '').trim();

    const catalogDb = await resolveCatalogDb(req, environment, catalogDatabaseName);

    let items = [];

    let hasSemanticModels = false;
    if (catalogCollectionName === 'semantic_models') {
      hasSemanticModels = await collectionExists(catalogDb, 'semantic_models');
      if (hasSemanticModels) {
        const query = { domain: binding.domain };
        if (binding.strategyId) {
          query.strategy_id = binding.strategyId;
        }
      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        query.$or = [
          { model_id: rx },
          { template_id: rx },
          { name: rx },
          { type: rx }
          ];
        }

        const docs = await catalogDb.collection('semantic_models')
          .find(query, {
            projection: {
              model_id: 1,
              template_id: 1,
              name: 1,
              domain: 1,
              strategy_id: 1,
              type: 1,
              version: 1,
              status: 1,
              storage_ref: 1,
              checksum: 1
            }
          })
          .sort({ model_id: 1, name: 1 })
          .toArray();

        items = docs.map(normalizeModel).filter((model) => !!model.model_id);
      }
    }

    // Default/fallback path: user-data-models (new preferred contract path)
    if (!items.length && catalogCollectionName && (catalogCollectionName !== 'semantic_models' || !hasSemanticModels)) {
      const query = { domain: binding.domain };
      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        query.$or = [
          { name: rx },
          { model_id: rx },
          { modelId: rx },
          { 'metadata.templateId': rx },
          { 'domainData.schema.id': rx }
        ];
      }

      const docs = await catalogDb.collection(catalogCollectionName)
        .find(query, {
          projection: {
            _id: 1,
            model_id: 1,
            modelId: 1,
            template_id: 1,
            id: 1,
            name: 1,
            domain: 1,
            metadata: 1,
            templateVersion: 1,
            domainData: 1,
            strategy_id: 1,
            type: 1,
            status: 1,
            version: 1,
            storage_ref: 1,
            checksum: 1
          }
        })
        .sort({ name: 1, model_id: 1 })
        .toArray();

      items = docs
        .map((doc) => {
          if (catalogCollectionName === 'user-data-models') {
            return mapUserDataModelToSemanticModel(doc, {
              domain: binding.domain,
              strategyId: binding.strategyId
            });
          }

          const normalized = normalizeModel({
            ...doc,
            model_id: doc.model_id || doc.modelId || doc.id || doc._id?.toString?.() || null,
            template_id: doc.template_id || doc?.metadata?.templateId || null,
            strategy_id: doc.strategy_id || binding.strategyId || null,
            domain: doc.domain || binding.domain,
            version: doc.version || doc.templateVersion || null
          });

          if (!normalized.model_id) {
            return mapUserDataModelToSemanticModel(doc, {
              domain: binding.domain,
              strategyId: binding.strategyId
            });
          }
          return normalized;
        })
        .filter((model) => !!model.model_id);
    }

    return NextResponse.json({
      domain: binding.domain,
      strategyId: binding.strategyId,
      environment: {
        id: environment?.id || null,
        name: environment?.name || null,
        envKey: binding.envKey
      },
      model_source: {
        database_name: catalogDatabaseName || null,
        catalog_collection: catalogCollectionName
      },
      count: items.length,
      items
    });
  } catch (error) {
    console.error('GET /api/synthetic-data/kehrnel/models error:', error);
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;
    return NextResponse.json({ error: error.message || 'Failed to list semantic models' }, { status });
  }
}
