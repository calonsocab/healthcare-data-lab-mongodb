import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';

/**
 * Sample block definitions following co/1 schema (clean spec - no emit)
 * These are seeded to the CORE database (sample_co_blocks) and available to all tenants
 */
const SAMPLE_BLOCKS = [
  {
    blockId: 'block.Address.v1',
    name: 'Address',
    description: 'Standard postal address structure',
    version: '1.0.0',
    nodes: [
      {
        nodeId: 'n-address-root',
        parentNodeId: null,
        childrenNodeIds: ['n-addr-line1', 'n-addr-line2', 'n-addr-city', 'n-addr-state', 'n-addr-zip', 'n-addr-country'],
        role: 'group',
        name: 'Address',
        attribute: 'address',
        dataType: 'object',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-addr-line1',
        parentNodeId: 'n-address-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Address Line 1',
        attribute: 'line1',
        dataType: 'string',
        occurrences: { min: 1, max: 1 }
      },
      {
        nodeId: 'n-addr-line2',
        parentNodeId: 'n-address-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Address Line 2',
        attribute: 'line2',
        dataType: 'string',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-addr-city',
        parentNodeId: 'n-address-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'City',
        attribute: 'city',
        dataType: 'string',
        occurrences: { min: 1, max: 1 }
      },
      {
        nodeId: 'n-addr-state',
        parentNodeId: 'n-address-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'State/Province',
        attribute: 'state',
        dataType: 'code',
        occurrences: { min: 1, max: 1 }
      },
      {
        nodeId: 'n-addr-zip',
        parentNodeId: 'n-address-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Postal Code',
        attribute: 'postalCode',
        dataType: 'string',
        occurrences: { min: 1, max: 1 }
      },
      {
        nodeId: 'n-addr-country',
        parentNodeId: 'n-address-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Country',
        attribute: 'country',
        dataType: 'code',
        occurrences: { min: 0, max: 1 }
      }
    ],
    metadata: {
      tags: ['demographics', 'address', 'common']
    }
  },
  {
    blockId: 'block.Name.v1',
    name: 'Person Name',
    description: 'Human name structure with prefix, given, family, and suffix',
    version: '1.0.0',
    nodes: [
      {
        nodeId: 'n-name-root',
        parentNodeId: null,
        childrenNodeIds: ['n-name-prefix', 'n-name-given', 'n-name-family', 'n-name-suffix'],
        role: 'group',
        name: 'Name',
        attribute: 'name',
        dataType: 'object',
        occurrences: { min: 1, max: 1 }
      },
      {
        nodeId: 'n-name-prefix',
        parentNodeId: 'n-name-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Prefix',
        attribute: 'prefix',
        dataType: 'string',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-name-given',
        parentNodeId: 'n-name-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Given Name',
        attribute: 'given',
        dataType: 'string',
        occurrences: { min: 1, max: '*' }
      },
      {
        nodeId: 'n-name-family',
        parentNodeId: 'n-name-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Family Name',
        attribute: 'family',
        dataType: 'string',
        occurrences: { min: 1, max: 1 }
      },
      {
        nodeId: 'n-name-suffix',
        parentNodeId: 'n-name-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Suffix',
        attribute: 'suffix',
        dataType: 'string',
        occurrences: { min: 0, max: 1 }
      }
    ],
    metadata: {
      tags: ['demographics', 'name', 'common']
    }
  },
  {
    blockId: 'block.Diagnosis.v1',
    name: 'Diagnosis',
    description: 'Clinical diagnosis with ICD coding',
    version: '1.0.0',
    nodes: [
      {
        nodeId: 'n-diag-root',
        parentNodeId: null,
        childrenNodeIds: ['n-diag-code', 'n-diag-desc', 'n-diag-type', 'n-diag-date'],
        role: 'group',
        name: 'Diagnosis',
        attribute: 'diagnosis',
        dataType: 'object',
        occurrences: { min: 0, max: '*' }
      },
      {
        nodeId: 'n-diag-code',
        parentNodeId: 'n-diag-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Diagnosis Code',
        attribute: 'code',
        dataType: 'code',
        occurrences: { min: 1, max: 1 },
        terminologyBindings: [{ system: 'ICD-10-CM', code: '', display: '' }]
      },
      {
        nodeId: 'n-diag-desc',
        parentNodeId: 'n-diag-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Description',
        attribute: 'description',
        dataType: 'string',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-diag-type',
        parentNodeId: 'n-diag-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Diagnosis Type',
        attribute: 'type',
        dataType: 'code',
        occurrences: { min: 0, max: 1 },
        constraints: {
          allowedValues: ['principal', 'admitting', 'secondary', 'external_cause']
        }
      },
      {
        nodeId: 'n-diag-date',
        parentNodeId: 'n-diag-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Onset Date',
        attribute: 'onsetDate',
        dataType: 'date',
        occurrences: { min: 0, max: 1 }
      }
    ],
    structuralBindings: [
      { nodeId: 'n-diag-code', model: 'FHIR', path: 'Condition.code.coding[0].code' }
    ],
    metadata: {
      tags: ['clinical', 'diagnosis', 'x12']
    }
  },
  {
    blockId: 'block.AnalyteResult.v1',
    name: 'Analyte Result',
    description: 'Laboratory analyte with value, unit, and reference range',
    version: '1.0.0',
    nodes: [
      {
        nodeId: 'n-analyte-root',
        parentNodeId: null,
        childrenNodeIds: ['n-analyte-code', 'n-analyte-name', 'n-analyte-value', 'n-analyte-unit', 'n-analyte-range', 'n-analyte-flag'],
        role: 'group',
        name: 'Analyte',
        attribute: 'analyte',
        dataType: 'object',
        occurrences: { min: 1, max: '*' }
      },
      {
        nodeId: 'n-analyte-code',
        parentNodeId: 'n-analyte-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Test Code',
        attribute: 'code',
        dataType: 'code',
        occurrences: { min: 1, max: 1 },
        terminologyBindings: [{ system: 'LOINC', code: '', display: '' }]
      },
      {
        nodeId: 'n-analyte-name',
        parentNodeId: 'n-analyte-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Test Name',
        attribute: 'name',
        dataType: 'string',
        occurrences: { min: 1, max: 1 }
      },
      {
        nodeId: 'n-analyte-value',
        parentNodeId: 'n-analyte-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Result Value',
        attribute: 'value',
        dataType: 'quantity',
        occurrences: { min: 1, max: 1 }
      },
      {
        nodeId: 'n-analyte-unit',
        parentNodeId: 'n-analyte-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Unit',
        attribute: 'unit',
        dataType: 'code',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-analyte-range',
        parentNodeId: 'n-analyte-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Reference Range',
        attribute: 'referenceRange',
        dataType: 'string',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-analyte-flag',
        parentNodeId: 'n-analyte-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Abnormal Flag',
        attribute: 'flag',
        dataType: 'code',
        occurrences: { min: 0, max: 1 },
        constraints: {
          allowedValues: ['N', 'L', 'H', 'LL', 'HH', 'A', 'AA']
        }
      }
    ],
    structuralBindings: [
      { nodeId: 'n-analyte-code', model: 'FHIR', path: 'Observation.code.coding[0].code' },
      { nodeId: 'n-analyte-value', model: 'FHIR', path: 'Observation.valueQuantity.value' },
      { nodeId: 'n-analyte-unit', model: 'FHIR', path: 'Observation.valueQuantity.unit' }
    ],
    metadata: {
      tags: ['laboratory', 'analyte', 'result']
    }
  },
  {
    blockId: 'block.VitalSigns.v1',
    name: 'Vital Signs',
    description: 'Common vital signs measurements',
    version: '1.0.0',
    nodes: [
      {
        nodeId: 'n-vitals-root',
        parentNodeId: null,
        childrenNodeIds: ['n-vitals-hr', 'n-vitals-bp-sys', 'n-vitals-bp-dia', 'n-vitals-temp', 'n-vitals-resp', 'n-vitals-spo2', 'n-vitals-time'],
        role: 'group',
        name: 'Vital Signs',
        attribute: 'vitalSigns',
        dataType: 'object',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-vitals-hr',
        parentNodeId: 'n-vitals-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Heart Rate',
        attribute: 'heartRate',
        dataType: 'quantity',
        occurrences: { min: 0, max: 1 },
        terminologyBindings: [{ system: 'LOINC', code: '8867-4', display: 'Heart rate' }]
      },
      {
        nodeId: 'n-vitals-bp-sys',
        parentNodeId: 'n-vitals-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Systolic BP',
        attribute: 'systolicBP',
        dataType: 'quantity',
        occurrences: { min: 0, max: 1 },
        terminologyBindings: [{ system: 'LOINC', code: '8480-6', display: 'Systolic blood pressure' }]
      },
      {
        nodeId: 'n-vitals-bp-dia',
        parentNodeId: 'n-vitals-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Diastolic BP',
        attribute: 'diastolicBP',
        dataType: 'quantity',
        occurrences: { min: 0, max: 1 },
        terminologyBindings: [{ system: 'LOINC', code: '8462-4', display: 'Diastolic blood pressure' }]
      },
      {
        nodeId: 'n-vitals-temp',
        parentNodeId: 'n-vitals-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Temperature',
        attribute: 'temperature',
        dataType: 'quantity',
        occurrences: { min: 0, max: 1 },
        terminologyBindings: [{ system: 'LOINC', code: '8310-5', display: 'Body temperature' }]
      },
      {
        nodeId: 'n-vitals-resp',
        parentNodeId: 'n-vitals-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Respiratory Rate',
        attribute: 'respiratoryRate',
        dataType: 'quantity',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-vitals-spo2',
        parentNodeId: 'n-vitals-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'SpO2',
        attribute: 'oxygenSaturation',
        dataType: 'quantity',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-vitals-time',
        parentNodeId: 'n-vitals-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Measurement Time',
        attribute: 'measurementTime',
        dataType: 'datetime',
        occurrences: { min: 1, max: 1 },
        timeRole: 'timestamp'
      }
    ],
    metadata: {
      tags: ['vitals', 'observation', 'clinical']
    }
  }
];

/**
 * POST /api/blocks/seed-examples - Seed sample blocks (co/1 schema, clean spec)
 *
 * Query params:
 * - target: 'core' | 'tenant' (default: 'core')
 *   - core: Seeds to CORE database (sample_co_blocks - shared across all tenants)
 *   - tenant: Seeds to current TENANT database (co_blocks - customer-specific)
 */
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target') || 'core';

    let collection;
    let dbName;
    let collectionName;

    if (target === 'core') {
      if (process.env.ALLOW_CORE_BLOCK_SEEDING !== 'true') {
        return NextResponse.json(
          { error: 'Core block seeding is disabled in this deployment' },
          { status: 403 }
        );
      }
      const coreDb = await getCoreDb();
      collection = coreDb.collection('sample_co_blocks');
      dbName = 'core';
      collectionName = 'sample_co_blocks';
    } else if (target === 'tenant') {
      const { db } = await getActiveTenantDb(request);
      collection = db.collection('co_blocks');
      dbName = 'tenant';
      collectionName = 'co_blocks';
    } else {
      return NextResponse.json(
        { error: 'Invalid target. Must be "core" or "tenant"' },
        { status: 400 }
      );
    }

    // Upsert each sample block
    const results = {
      inserted: [],
      updated: [],
      errors: []
    };

    for (const block of SAMPLE_BLOCKS) {
      try {
        const existing = await collection.findOne({
          blockId: block.blockId,
          version: block.version
        });

        const now = new Date().toISOString();

        if (existing) {
          // Update existing
          await collection.updateOne(
            { blockId: block.blockId, version: block.version },
            {
              $set: {
                ...block,
                metadata: {
                  ...block.metadata,
                  updatedAt: now
                }
              }
            }
          );
          results.updated.push(block.blockId);
        } else {
          // Insert new
          await collection.insertOne({
            ...block,
            metadata: {
              ...block.metadata,
              createdAt: now,
              updatedAt: now
            }
          });
          results.inserted.push(block.blockId);
        }
      } catch (blockError) {
        results.errors.push({
          blockId: block.blockId,
          error: blockError.message
        });
      }
    }

    // Create indexes
    try {
      await collection.createIndex({ blockId: 1 });
      await collection.createIndex({ blockId: 1, version: -1 }, { unique: true });
      await collection.createIndex({ name: 1, version: -1 });
      await collection.createIndex({ 'metadata.tags': 1 });
    } catch (indexError) {
      console.log('Index creation note:', indexError.message);
    }

    return NextResponse.json({
      success: true,
      target: dbName,
      collection: collectionName,
      schema: 'co/1',
      totalBlocks: SAMPLE_BLOCKS.length,
      inserted: results.inserted.length,
      updated: results.updated.length,
      errors: results.errors.length,
      details: results
    });
  } catch (error) {
    console.error('Error seeding blocks:', error);
    return NextResponse.json(
      { error: 'Failed to seed blocks', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/blocks/seed-examples - List available sample blocks
 */
export async function GET() {
  return NextResponse.json({
    schema: 'co/1',
    blocks: SAMPLE_BLOCKS.map(b => ({
      blockId: b.blockId,
      version: b.version,
      name: b.name,
      description: b.description,
      nodeCount: b.nodes.length,
      tags: b.metadata?.tags || []
    })),
    total: SAMPLE_BLOCKS.length
  });
}
