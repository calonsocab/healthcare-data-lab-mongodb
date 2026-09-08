import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/synthetic-data/preview/route.js
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import { resolveEnvByIdForUser } from '@/lib/db/tenantDb';
import { getDb } from '@/lib/db/connectionManager';
import { filterPatientDataSetsByArchetype } from '@/lib/synthetic-data/syntheticDataUtils';
import { adaptForGenerator } from '@/lib/strategies/configAdapter';
import { getCoreDb } from '@/lib/db/coreDb';
import { fetchSamplePatients } from '@/lib/synthetic-data/sampleDataLoader';

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      templates,
      patientCount,
      strategyId,
      strategyConfig,
      strategyBindingId,
      environment: envId,
      importId
    } = body || {};

    if (!Array.isArray(templates) || !templates.length) {
      return NextResponse.json({ error: 'At least one template must be selected' }, { status: 400 });
    }
    if (!patientCount || patientCount < 1) {
      return NextResponse.json({ error: 'Patient count must be at least 1' }, { status: 400 });
    }
    if (!envId) {
      return NextResponse.json({ error: 'A target environment must be selected' }, { status: 400 });
    }

    // Resolve environment + tenant DB
    let resolvedEnv;
    try {
      resolvedEnv = await resolveEnvByIdForUser(req, envId);
    } catch (err) {
      console.error('POST /api/synthetic-data/preview env resolve error:', err?.message || err);
      // Do not reflect internal error details back to the client.
      return NextResponse.json({ error: 'Invalid environment' }, { status: 400 });
    }

    const envSummary = resolvedEnv.summary || {};
    const tenantUri = resolvedEnv.uri;
    const environment = {
      id: envSummary.id,
      name: envSummary.name,
      database: envSummary.database,
      strategyLinks: envSummary.strategyLinks || [],
    };

    if (!environment.id || !environment.database || !tenantUri) {
      return NextResponse.json({ error: 'Environment is missing required connection information' }, { status: 400 });
    }

    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const tenantDb = await getDb({ uri: tenantUri, dbName: environment.database });
    const coreDb = await getCoreDb();

    // Validate strategy link
    const envStrategyLinks = environment.strategyLinks || [];
    const selectedStrategyId = strategyId ? strategyId.toString() : null;
    if (envStrategyLinks.length) {
      const binding =
        envStrategyLinks.find(link => link.id === strategyBindingId) ||
        (!strategyBindingId && selectedStrategyId
          ? envStrategyLinks.find(link => (link.strategyId || '').toString() === selectedStrategyId)
          : null);
      if (!binding) {
        return NextResponse.json({ error: 'Selected strategy is not linked to this environment.' }, { status: 400 });
      }
      if ((binding.strategyId || '').toString() !== (selectedStrategyId || '').toString()) {
        return NextResponse.json({ error: 'Strategy link mismatch. Refresh and try again.' }, { status: 400 });
      }
      if (!binding.contexts?.synthetic) {
        return NextResponse.json({ error: 'This strategy is not enabled for synthetic data generation in the selected environment.' }, { status: 400 });
      }
    }

    // Resolve strategy document from Kehrnel
    const binding = envStrategyLinks.find(link => link.id === strategyBindingId);
    const effectiveStrategyId = selectedStrategyId || binding?.strategyId || null;
    let strategyDoc = strategyConfig?._fullStrategy || null;

    if (!strategyDoc && effectiveStrategyId) {
      try {
        const { createKehrnelService } = await import('@/lib/kehrnel/KehrnelService');
        const service = createKehrnelService(coreDb);
        const manifest = await service.getStrategy(effectiveStrategyId);
        if (manifest) {
          strategyDoc = wrapKehrnelManifest(manifest, binding?.configOverrides);
        }
      } catch (err) {
        console.warn('Could not fetch strategy from Kehrnel:', err.message);
      }
    }

    if (!strategyDoc) {
      strategyDoc = strategyConfig; // Fallback to client-provided config
    }

    if (!strategyDoc) {
      return NextResponse.json({ error: 'No persistence strategy found for preview' }, { status: 400 });
    }

    const adaptedConfig = adaptForGenerator(strategyDoc);

    // Load templates from tenant
    const templateIds = Array.isArray(templates) ? templates : [];
    const objectIds = [];
    const nameIds = [];

    for (const id of templateIds) {
      if (!id) continue;
      if (ObjectId.isValid(id)) {
        try {
          objectIds.push(new ObjectId(id));
        } catch {
          nameIds.push(id);
        }
      } else {
        nameIds.push(id);
      }
    }

    const query = [];
    if (objectIds.length) query.push({ _id: { $in: objectIds } });
    if (nameIds.length) query.push({ name: { $in: nameIds } });

    const utCol = tenantDb.collection('user-data-models');
    const tmplDocs = await utCol
      .find(query.length ? { $or: query } : { _id: { $in: [] } })
      .project({ 'domainData.webTemplate.nodeId': 1, 'metadata.templateId': 1, name: 1 })
      .toArray();

    if (!tmplDocs.length) {
      return NextResponse.json({ error: 'No templates found with the provided IDs' }, { status: 400 });
    }

    // Gather archetype node ids
    const archetypeIds = tmplDocs
      .map(t => t.domainData?.webTemplate?.nodeId || t.domainData?.webTemplate?.archetype_node_id || '')
      .filter(Boolean);

    // Source data
    const templateKeys = tmplDocs.map(t =>
      t.metadata?.templateId ||
      t.name ||
      t._id?.toString() ||
      ''
    ).filter(Boolean);
    const allPatientDataSets = await fetchSamplePatients(templateKeys, importId);
    const filtered = filterPatientDataSetsByArchetype(allPatientDataSets, archetypeIds);

    if (!filtered.length) {
      return NextResponse.json({ error: 'No matching compositions found for the selected templates' }, { status: 400 });
    }

    // Build a single-sample preview
    const sampleSource = filtered[0];
    const sample = buildPreviewSample(sampleSource, adaptedConfig, tmplDocs);
    const indexPlan = adaptedConfig.indexPlan || { autoIndexes: [], recommendedIndexes: [], atlasSearch: null };

    return NextResponse.json({
      preview: true,
      environment: {
        id: environment.id,
        name: environment.name,
        database: environment.database
      },
      strategy: {
        id: strategyDoc._id?.toString() || effectiveStrategyId,
        name: strategyDoc.name || strategyDoc.blueprint?.display_name || 'Unknown',
        kehrnel_module: strategyDoc.blueprint?.kehrnel_library?.transform_module || 'transform'
      },
      collections: {
        compositions: adaptedConfig.targetCollections.compositions,
        meta: adaptedConfig.targetCollections.metaIndex,
        search: adaptedConfig.targetCollections.search,
        codes: adaptedConfig.targetCollections.codes,
        shortcuts: adaptedConfig.targetCollections.shortcuts,
        dictionaries: adaptedConfig.targetCollections.dictionaries
      },
      fieldMappings: adaptedConfig.fieldMappings,
      indexes: {
        autoCreate: false,
        autoIndexes: [],
        recommended: indexPlan.recommendedIndexes || [],
        atlasSearch: indexPlan.atlasSearch
      },
      sample
    });
  } catch (err) {
    // Publish hardening: never echo runtime/internal errors, as they may contain secrets (e.g., DB URIs).
    console.error('POST /api/synthetic-data/preview error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to build preview' }, { status: 500 });
  }
}

function buildPreviewSample(sampleSource, adaptedConfig, tmplDocs) {
  const ehrId = sampleSource.ehrId || `patient-${uuidv4()}`;
  const first = sampleSource.compositions[0];
  if (!first) {
    throw new Error('Preview source is missing compositions');
  }
  const baseComp = first.composition || first;
  const compId = `preview-${uuidv4()}`;
  const templateIdField = adaptedConfig.fieldMappings.templateIdField;

  const exampleComp = {
    ...baseComp,
    _id: compId,
    [adaptedConfig.fieldMappings.ehrIdField]: ehrId,
    [adaptedConfig.fieldMappings.versionField]: 1,
    last_processed: new Date()
  };

  if (templateIdField && !exampleComp[templateIdField]) {
    exampleComp[templateIdField] = baseComp[templateIdField] || baseComp.template_id || '';
  }

  if (adaptedConfig.fieldMappings.ehrIdField !== 'ehr_id') {
    exampleComp.ehr_id = ehrId;
  }

  const metaDoc = {
    [adaptedConfig.fieldMappings.ehrIdField]: ehrId,
    ehr_id: ehrId,
    created: new Date(),
    templates: tmplDocs.map(t => t._id.toString()),
    documents: [{
      id: exampleComp._id,
      template: exampleComp[templateIdField] || exampleComp.template_id || '',
      archetype: exampleComp.archetype_node_id || ''
    }]
  };

  const mappingSummary = {
    ehrIdField: adaptedConfig.fieldMappings.ehrIdField,
    versionField: adaptedConfig.fieldMappings.versionField,
    templateIdField,
    applied: {
      [adaptedConfig.fieldMappings.ehrIdField]: exampleComp[adaptedConfig.fieldMappings.ehrIdField],
      [adaptedConfig.fieldMappings.versionField]: exampleComp[adaptedConfig.fieldMappings.versionField],
      [templateIdField]: exampleComp[templateIdField] || ''
    }
  };

  return {
    patientId: ehrId,
    composition: exampleComp,
    meta: metaDoc,
    mappingSummary
  };
}

/**
 * Wrap a Kehrnel manifest into the format expected by configAdapter
 */
function wrapKehrnelManifest(manifest, configOverrides = {}) {
  const id = manifest.id || manifest.strategy_id || manifest.name;
  return {
    _id: id,
    name: manifest.name || manifest.display_name || id,
    kehrnelId: id,
    blueprint: {
      id: id,
      display_name: manifest.display_name || manifest.name,
      domain: manifest.domain || [],
      summary: manifest.summary || manifest.description,
      topology: manifest.topology || { modes: ['single'], default: 'single' },
      query_focus: manifest.query_focus || 'mixed',
      complexity: manifest.complexity || 'medium',
      collections: manifest.collections || {},
      fields: manifest.fields || {},
      coding: manifest.coding || {},
      dictionaries: manifest.dictionaries || {},
      index_templates: manifest.index_templates || {},
      kehrnel_library: {
        package: 'kehrnel',
        capabilities: manifest.capabilities || []
      }
    },
    config: {
      ...(manifest.default_config || {}),
      ...configOverrides,
      strategy: id
    }
  };
}
