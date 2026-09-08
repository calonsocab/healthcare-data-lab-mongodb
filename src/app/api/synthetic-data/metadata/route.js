// src/app/api/synthetic-data/metadata/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

export const dynamic = 'force-dynamic';

async function resolveCollection(db, names = []) {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name)
  );
  for (const name of names) {
    if (existing.has(name)) return db.collection(name);
  }
  // fallback to first name (will create if not exists, but better than nothing)
  return db.collection(names[0]);
}

/**
 * Get metadata about available synthetic data
 * @route GET /api/synthetic-data/metadata
 */
export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    // Simple in-memory cache (expires every 10 minutes)
    const cacheKey = '__synthetic_metadata_cache__';
    const cacheTtlMs = 10 * 60 * 1000;
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === '1';
    if (!globalThis[cacheKey]) {
      globalThis[cacheKey] = { ts: 0, data: null };
    }
    const now = Date.now();
    if (!forceRefresh && globalThis[cacheKey].data && now - globalThis[cacheKey].ts < cacheTtlMs) {
      return NextResponse.json(globalThis[cacheKey].data);
    }

    const coreDb = await getCoreDb();
    // Support either underscores or dashes; prefer existing collection names
    const col = await resolveCollection(coreDb, ['sample_compositions', 'sample-compositions']);
    const sampleTemplatesCol = await resolveCollection(coreDb, ['sample_templates', 'sample-templates']);

    // Aggregate counts per template_id and archetype_node_id
    const pipeline = [
      {
        $project: {
          _template: {
            $ifNull: ['$template_id', '$template_name']
          },
          _templateName: {
            $ifNull: ['$template_name', '$templateName']
          },
          _archetype: '$archetype_node_id',
          patientField: {
            $ifNull: ['$patient_id', { $ifNull: ['$ehr_id', '$_id'] }]
          }
        }
      },
      {
        $match: { _template: { $ne: null } }
      },
      {
        $group: {
          _id: { template: '$_template', archetype: '$_archetype' },
          compCount: { $sum: 1 },
          patientIds: { $addToSet: '$patientField' },
          templateNames: { $addToSet: '$_templateName' }
        }
      },
      {
        $group: {
          _id: '$_id.template',
          archetypes: {
            $addToSet: {
              archetype_node_id: '$_id.archetype',
              count: '$compCount'
            }
          },
          count: { $sum: '$compCount' },
          patientIds: { $addToSet: '$patientIds' },
          templateNames: { $addToSet: '$templateNames' }
        }
      },
      {
        $addFields: {
          patient_count: {
            $size: {
              $reduce: {
                input: '$patientIds',
                initialValue: [],
                in: { $setUnion: ['$$value', '$$this'] }
              }
            }
          }
        }
      }
    ];

    const results = await col.aggregate(pipeline).toArray();
    const sampleTemplates = sampleTemplatesCol ? await sampleTemplatesCol.find({}).toArray() : [];
    const sampleTemplateMap = sampleTemplates.reduce((acc, t) => {
      const tid = t.template_id || t.templateId || t.name;
      if (tid) {
        acc[tid] = {
          name: t.name || tid,
          archetype_node_id: t.archetype_node_id || ''
        };
      }
      return acc;
    }, {});

    const templates = {};
    let totalComps = 0;
    let totalPatients = new Set();

    if (results.length) {
      results.forEach(r => {
        const templateIdRaw = r._id || 'unknown';
        const patientCount = r.patient_count || 0;
        const compCount = r.count || 0;
        totalComps += compCount;
        const sampleTemplate = sampleTemplateMap[templateIdRaw] || {};
        const flatNames = (r.templateNames || []).flat().filter(Boolean);
        const resolvedName = sampleTemplate.name || flatNames[0] || templateIdRaw;
        const templateKey = resolvedName || templateIdRaw || 'unknown';
        templates[templateKey] = {
          template_id: templateIdRaw,
          count: compCount,
          patient_count: patientCount,
          archetypes: (r.archetypes || []).filter(a => a.archetype_node_id),
          name: resolvedName,
          archetype_node_id: sampleTemplate.archetype_node_id || ''
        };
      });
    } else if (sampleTemplates.length) {
      // Fallback: build metadata from sample_templates collection
      sampleTemplates.forEach(t => {
        const templateIdRaw = t.template_id || t.templateId || t.name || 'unknown';
        const templateKey = t.name || templateIdRaw || 'unknown';
        const compCount = t.count || t.composition_count || 0;
        const patientCount = t.patient_count || t.patientCount || 0;
        totalComps += compCount;
        templates[templateKey] = {
          template_id: templateIdRaw,
          count: compCount,
          patient_count: patientCount,
          archetypes: t.archetypes || [],
          name: t.name || templateIdRaw,
          archetype_node_id: t.archetype_node_id || ''
        };
      });
    }

    // patient_count aggregation may double-count; fallback to distinct patient_id count
    const distinctPatients = new Set();
    for (const field of ['patient_id', 'ehr_id', 'ehrId', 'ehrid', '_id']) {
      const vals = await col.distinct(field);
      vals.forEach(v => distinctPatients.add(v?.toString()));
    }
    let globalPatientCount = distinctPatients.size;
    // If we only have sampleTemplates fallback, use their patient counts
    if (!globalPatientCount && Object.keys(templates).length) {
      globalPatientCount = Math.max(
        0,
        ...Object.values(templates).map(t => t.patient_count || 0)
      );
    }

    if (totalComps === 0 && Object.keys(templates).length) {
      totalComps = Object.values(templates).reduce((sum, t) => sum + (t.count || 0), 0);
    }

    const metadata = {
      summary: {
        patient_count: globalPatientCount,
        composition_count: totalComps,
        collection_date: new Date().toISOString()
      },
      templates,
      is_estimated: false
    };

    globalThis[cacheKey] = { ts: now, data: metadata };

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Error in synthetic data metadata API:', error);
    return safeErrorResponse(error, 'Failed to retrieve synthetic data metadata');
  }
}
