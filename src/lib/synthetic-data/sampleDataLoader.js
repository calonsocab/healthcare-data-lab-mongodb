// src/lib/synthetic-data/sampleDataLoader.js
/**
 * Sample Data Loader
 *
 * Centralized utility for loading sample compositions from the core database.
 * Used by both generate and preview routes.
 */

import { getCoreDb } from '@/lib/db/coreDb';

// Constants
export const MAX_PATIENT_COUNT = 10000;
export const MAX_TEMPLATE_COUNT = 100;
export const SAMPLE_COLLECTION_NAMES = ['sample_compositions', 'sample-compositions'];

/**
 * Resolve collection by checking which name exists in the database
 * @param {object} db - MongoDB database instance
 * @param {string[]} names - Array of possible collection names
 * @returns {Promise<Collection>} - MongoDB collection
 * @throws {Error} - If no matching collection exists
 */
export async function resolveCollection(db, names = SAMPLE_COLLECTION_NAMES) {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name)
  );

  for (const name of names) {
    if (existing.has(name)) {
      return db.collection(name);
    }
  }

  // Instead of silently creating, throw an error
  throw new Error(
    `Sample compositions collection not found. Expected one of: ${names.join(', ')}`
  );
}

/**
 * Fetch sample patients from the core database
 * @param {string[]} templateKeys - Array of template identifiers to match
 * @param {string|null} importId - Optional import source ID
 * @returns {Promise<Array>} - Array of patient data sets with compositions
 */
export async function fetchSamplePatients(templateKeys, importId = null) {
  if (!templateKeys || !templateKeys.length) {
    return [];
  }

  const coreDb = await getCoreDb();
  const col = await resolveCollection(coreDb, SAMPLE_COLLECTION_NAMES);

  const query = {
    $and: [
      {
        $or: [
          { 'compositions.template_id': { $in: templateKeys } },
          { 'compositions.template_name': { $in: templateKeys } },
          { template_id: { $in: templateKeys } },
          { template_name: { $in: templateKeys } }
        ]
      },
      importId
        ? { source: `import:${importId}` }
        : { $or: [{ source: { $exists: false } }, { source: 'system' }] }
    ]
  };

  const docs = await col.find(query).toArray();

  return docs.map(doc => {
    let comps = [];
    if (Array.isArray(doc.compositions) && doc.compositions.length) {
      comps = doc.compositions;
    } else {
      // Build a pseudo-composition from top-level fields
      // Store both template_id (UUID) and template_name for matching
      comps = [{
        composition: doc.canonicalJSON || doc.composition || {},
        template_id: doc.template_id || null,
        template_name: doc.template_name || null,
        archetype_node_id: doc.archetype_node_id || null
      }];
    }

    return {
      ehrId: doc.patient_id || doc.ehr_id || doc._id?.toString(),
      compositions: comps
        .filter(c => {
          // Match against template_id, template_name, templateId, or template
          const possibleKeys = [
            c.template_id,
            c.template_name,
            c.templateId,
            c.template
          ].filter(Boolean);
          return possibleKeys.some(key => templateKeys.includes(key));
        })
        .map(c => ({
          composition: c.composition || c,
          archetypeNodeId: c.archetype_node_id || c.archetypeNodeId || ''
        }))
    };
  }).filter(p => p.ehrId && p.compositions.length);
}

/**
 * Validate generation input parameters
 * @param {object} params - Generation parameters
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export function validateGenerationInput(params) {
  const errors = [];
  const { templates, patientCount, envId, strategyId } = params;

  // Validate templates
  if (!Array.isArray(templates) || templates.length === 0) {
    errors.push('At least one template must be selected');
  } else if (templates.length > MAX_TEMPLATE_COUNT) {
    errors.push(`Maximum ${MAX_TEMPLATE_COUNT} templates allowed per generation`);
  }

  // Validate patient count
  if (!patientCount || patientCount < 1) {
    errors.push('Patient count must be at least 1');
  } else if (patientCount > MAX_PATIENT_COUNT) {
    errors.push(`Maximum ${MAX_PATIENT_COUNT} patients allowed per generation`);
  }

  // Validate environment
  if (!envId) {
    errors.push('A target environment must be selected');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get sample data statistics
 * @param {string[]} templateKeys - Template keys to check
 * @param {string|null} importId - Optional import ID
 * @returns {Promise<object>} - Statistics about available sample data
 */
export async function getSampleDataStats(templateKeys, importId = null) {
  const coreDb = await getCoreDb();

  try {
    const col = await resolveCollection(coreDb, SAMPLE_COLLECTION_NAMES);

    const totalCount = await col.countDocuments({});
    const matchingCount = templateKeys.length > 0
      ? await col.countDocuments({
          $or: [
            { template_id: { $in: templateKeys } },
            { template_name: { $in: templateKeys } }
          ]
        })
      : 0;

    const distinctTemplates = await col.distinct('template_name');

    return {
      totalDocuments: totalCount,
      matchingDocuments: matchingCount,
      availableTemplates: distinctTemplates.length,
      templateNames: distinctTemplates.slice(0, 20) // First 20 for preview
    };
  } catch (error) {
    return {
      totalDocuments: 0,
      matchingDocuments: 0,
      availableTemplates: 0,
      templateNames: [],
      error: error.message
    };
  }
}
