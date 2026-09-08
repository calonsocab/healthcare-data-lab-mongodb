#!/usr/bin/env node

/**
 * Seed Context Objects to Database
 *
 * Seeds the SEMANTIC_OBJECT_EXAMPLES to their respective collections:
 * - building_block scope -> sample_co_blocks collection
 * - business_object scope -> sample-data-models collection (domain: 'context')
 *
 * Usage:
 *   node scripts/seed-context-objects.mjs [--dry-run]
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DATA_MODELS_COLLECTION = 'sample-data-models';
const BLOCKS_COLLECTION = 'sample_co_blocks';

// ============================================================================
// Inline examples (same as examples.ts but in JS for script use)
// ============================================================================

function generateNodeId() {
  return 'n-' + Math.random().toString(36).substr(2, 9);
}

function createAnalyteResultBlock() {
  const rootId = generateNodeId();
  const analyteNameId = generateNodeId();
  const analyteValueId = generateNodeId();
  const analyteUnitId = generateNodeId();
  const refRangeId = generateNodeId();
  const refLowId = generateNodeId();
  const refHighId = generateNodeId();

  return {
    id: 'AnalyteResult',
    name: 'Analyte Result',
    description: 'Reusable analyte result building block with value, unit, and reference range',
    scope: 'building_block',
    origin: 'custom',
    version: '1.0.0',
    status: 'active',
    schema: { version: 'co/1', pathDialect: 'coql/v1' },
    nodes: [
      {
        nodeId: rootId,
        parentNodeId: null,
        childrenNodeIds: [analyteNameId, analyteValueId, analyteUnitId, refRangeId],
        role: 'group',
        name: 'Analyte Result',
        attribute: 'analyte',
        dataType: 'object',
        occurrences: { min: 1, max: 1 },
        description: 'Single lab test result (name, value, unit, optional range)'
      },
      {
        nodeId: analyteNameId,
        parentNodeId: rootId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Analyte Name',
        attribute: 'analyteName',
        dataType: 'code',
        occurrences: { min: 1, max: 1 },
        description: 'LOINC code for the specific analyte',
        terminologyBindings: [
          { system: 'LOINC', code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma' },
          { system: 'LOINC', code: '2571-8', display: 'Triglyceride [Mass/volume] in Serum or Plasma' }
        ]
      },
      {
        nodeId: analyteValueId,
        parentNodeId: rootId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Value',
        attribute: 'value',
        dataType: 'quantity',
        occurrences: { min: 1, max: 1 },
        constraints: { minValue: 0, maxValue: 1000 }
      },
      {
        nodeId: analyteUnitId,
        parentNodeId: rootId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Unit',
        attribute: 'unit',
        dataType: 'code',
        occurrences: { min: 1, max: 1 },
        description: 'Unit of measurement (UCUM)',
        constraints: { allowedValues: ['mg/dL', 'mmol/L', 'g/L'] },
        terminologyBindings: [{ system: 'UCUM', code: 'mg/dL', display: 'milligrams per deciliter' }]
      },
      {
        nodeId: refRangeId,
        parentNodeId: rootId,
        childrenNodeIds: [refLowId, refHighId],
        role: 'group',
        name: 'Reference Range',
        attribute: 'referenceRange',
        dataType: 'object',
        occurrences: { min: 0, max: 1 },
        description: 'Normal reference range'
      },
      {
        nodeId: refLowId,
        parentNodeId: refRangeId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Low',
        attribute: 'low',
        dataType: 'number',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: refHighId,
        parentNodeId: refRangeId,
        childrenNodeIds: [],
        role: 'field',
        name: 'High',
        attribute: 'high',
        dataType: 'number',
        occurrences: { min: 0, max: 1 }
      }
    ],
    metadata: {
      tags: ['lab', 'analyte', 'building-block']
    }
  };
}

function createVitalSignsBuildingBlock() {
  const rootId = generateNodeId();
  const bpSystolicId = generateNodeId();
  const bpDiastolicId = generateNodeId();
  const heartRateId = generateNodeId();
  const temperatureId = generateNodeId();
  const measurementTimeId = generateNodeId();

  return {
    id: 'VitalSigns',
    name: 'Vital Signs',
    description: 'Reusable vital signs building block with blood pressure, heart rate, and temperature',
    scope: 'building_block',
    origin: 'custom',
    version: '1.0.0',
    status: 'active',
    schema: { version: 'co/1', pathDialect: 'coql/v1' },
    nodes: [
      {
        nodeId: rootId,
        parentNodeId: null,
        childrenNodeIds: [bpSystolicId, bpDiastolicId, heartRateId, temperatureId, measurementTimeId],
        role: 'group',
        name: 'Vital Signs',
        attribute: 'vitalSigns',
        dataType: 'object',
        occurrences: { min: 1, max: 1 },
        description: 'Basic vital signs measurements'
      },
      {
        nodeId: bpSystolicId,
        parentNodeId: rootId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Blood Pressure Systolic',
        attribute: 'bpSystolic',
        dataType: 'quantity',
        occurrences: { min: 0, max: 1 },
        terminologyBindings: [{ system: 'LOINC', code: '8480-6', display: 'Systolic blood pressure' }],
        constraints: { minValue: 50, maxValue: 250 }
      },
      {
        nodeId: bpDiastolicId,
        parentNodeId: rootId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Blood Pressure Diastolic',
        attribute: 'bpDiastolic',
        dataType: 'quantity',
        occurrences: { min: 0, max: 1 },
        terminologyBindings: [{ system: 'LOINC', code: '8462-4', display: 'Diastolic blood pressure' }],
        constraints: { minValue: 30, maxValue: 150 }
      },
      {
        nodeId: heartRateId,
        parentNodeId: rootId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Heart Rate',
        attribute: 'heartRate',
        dataType: 'quantity',
        occurrences: { min: 0, max: 1 },
        terminologyBindings: [{ system: 'LOINC', code: '8867-4', display: 'Heart rate' }],
        constraints: { minValue: 30, maxValue: 250 }
      },
      {
        nodeId: temperatureId,
        parentNodeId: rootId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Body Temperature',
        attribute: 'temperature',
        dataType: 'quantity',
        occurrences: { min: 0, max: 1 },
        terminologyBindings: [{ system: 'LOINC', code: '8310-5', display: 'Body temperature' }],
        constraints: { minValue: 35.0, maxValue: 42.0 }
      },
      {
        nodeId: measurementTimeId,
        parentNodeId: rootId,
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
      tags: ['vital-signs', 'observation', 'building-block']
    }
  };
}

function createLabResultPanelDefinition() {
  const rootId = generateNodeId();
  const patientRefId = generateNodeId();
  const panelCodeId = generateNodeId();
  const eventSeriesId = generateNodeId();
  const eventId = generateNodeId();
  const eventTimeId = generateNodeId();
  const analytesArrayId = generateNodeId();
  const statusId = generateNodeId();
  const performerId = generateNodeId();
  const notesId = generateNodeId();

  return {
    id: 'LabResultPanel',
    name: 'Laboratory Result Panel',
    description: 'Comprehensive laboratory test panel supporting multiple analytes, temporal observations, and full FHIR/openEHR bindings',
    scope: 'business_object',
    origin: 'custom',
    version: '1.2.0',
    status: 'active',
    schema: { version: 'co/1', pathDialect: 'coql/v1' },
    nodes: [
      {
        nodeId: rootId,
        parentNodeId: null,
        childrenNodeIds: [patientRefId, panelCodeId, eventSeriesId],
        role: 'section',
        name: 'Laboratory Result Panel',
        attribute: 'labPanel',
        dataType: 'object',
        occurrences: { min: 1, max: 1 },
        description: 'Complete laboratory test panel with multiple analytes over time'
      },
      {
        nodeId: patientRefId,
        parentNodeId: rootId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Patient Reference',
        attribute: 'patientRef',
        dataType: 'reference',
        occurrences: { min: 1, max: 1 },
        terminologyBindings: [{ system: 'FHIR', code: 'Patient', display: 'Patient Resource Reference' }]
      },
      {
        nodeId: panelCodeId,
        parentNodeId: rootId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Panel Code',
        attribute: 'panelCode',
        dataType: 'code',
        occurrences: { min: 1, max: 1 },
        description: 'LOINC code identifying the lab panel',
        terminologyBindings: [{ system: 'LOINC', code: '24331-1', display: 'Lipid panel - Serum or Plasma' }],
        constraints: { pattern: '^[0-9]{4,5}-[0-9]$' }
      },
      {
        nodeId: eventSeriesId,
        parentNodeId: rootId,
        childrenNodeIds: [eventId],
        role: 'event_series',
        name: 'Observation Events',
        attribute: 'events',
        dataType: 'array',
        occurrences: { min: 1, max: '*' },
        description: 'Series of observation events, each with timestamp and measurements'
      },
      {
        nodeId: eventId,
        parentNodeId: eventSeriesId,
        childrenNodeIds: [eventTimeId, analytesArrayId, statusId, performerId, notesId],
        role: 'event',
        name: 'Observation Event',
        attribute: 'event',
        dataType: 'object',
        occurrences: { min: 1, max: 1 },
        description: 'Single observation event with timestamp'
      },
      {
        nodeId: eventTimeId,
        parentNodeId: eventId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Event Time',
        attribute: 'eventTime',
        dataType: 'datetime',
        occurrences: { min: 1, max: 1 },
        timeRole: 'timestamp',
        description: 'When this observation was taken'
      },
      {
        nodeId: analytesArrayId,
        parentNodeId: eventId,
        childrenNodeIds: [],
        role: 'group',
        name: 'Analytes',
        attribute: 'analytes',
        dataType: 'array',
        occurrences: { min: 1, max: '*' },
        description: 'Individual analyte measurements (items reference AnalyteResult block)',
        itemSpec: {
          role: 'block',
          name: 'Analyte Result',
          attribute: 'analyte',
          dataType: 'object',
          occurrences: { min: 1, max: 1 },
          blockId: 'AnalyteResult',
          versionRange: '^1.0.0'
        }
      },
      {
        nodeId: statusId,
        parentNodeId: eventId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Result Status',
        attribute: 'status',
        dataType: 'code',
        occurrences: { min: 1, max: 1 },
        constraints: { allowedValues: ['preliminary', 'final', 'amended', 'corrected', 'cancelled'] },
        terminologyBindings: [{ system: 'FHIR', code: 'ObservationStatus', display: 'Observation Status Code System' }]
      },
      {
        nodeId: performerId,
        parentNodeId: eventId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Performed By',
        attribute: 'performer',
        dataType: 'reference',
        occurrences: { min: 0, max: 1 },
        description: 'Laboratory or practitioner who performed the test'
      },
      {
        nodeId: notesId,
        parentNodeId: eventId,
        childrenNodeIds: [],
        role: 'field',
        name: 'Clinical Notes',
        attribute: 'notes',
        dataType: 'string',
        occurrences: { min: 0, max: 1 },
        constraints: { maxLength: 1000 }
      }
    ],
    terminologyBindings: [{ system: 'SNOMED-CT', code: '117015009', display: 'Laboratory test finding (finding)' }],
    metadata: {
      tags: ['laboratory', 'observation', 'clinical', 'FHIR', 'openEHR']
    }
  };
}

const SEMANTIC_OBJECT_EXAMPLES = [
  createAnalyteResultBlock(),
  createVitalSignsBuildingBlock(),
  createLabResultPanelDefinition()
];

// ============================================================================
// Main seeding logic
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Seed Context Objects to Database');
  console.log('='.repeat(60));
  console.log('');

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be made');
    console.log('');
  }

  const mongoUrl = process.env.MONGODB_URI || process.env.CORE_MONGODB_URL || process.env.MONGODB_URL;
  const dbName = process.env.CORE_DATABASE_NAME || 'openehr_core';

  if (!mongoUrl) {
    console.error('Error: MONGODB_URI not set');
    process.exit(1);
  }

  const client = new MongoClient(mongoUrl);
  const results = {
    blocks: { inserted: 0, updated: 0, items: [] },
    contextObjects: { inserted: 0, updated: 0, items: [] }
  };

  try {
    await client.connect();
    console.log(`Connected to MongoDB`);
    console.log(`Database: ${dbName}`);
    console.log('');

    const db = client.db(dbName);
    const blocksCollection = db.collection(BLOCKS_COLLECTION);
    const dataModelsCollection = db.collection(DATA_MODELS_COLLECTION);

    const now = new Date().toISOString();

    for (const example of SEMANTIC_OBJECT_EXAMPLES) {
      console.log(`Processing: ${example.name} (${example.scope})`);

      if (example.scope === 'building_block') {
        // Seed to sample_co_blocks
        const blockDoc = {
          blockId: `block.${example.id}.v1`,
          name: example.name,
          description: example.description || '',
          version: example.version || '1.0.0',
          schema: example.schema,
          nodes: example.nodes,
          terminologyBindings: example.terminologyBindings || [],
          metadata: {
            ...example.metadata,
            tags: example.metadata?.tags || ['building-block'],
            createdAt: now,
            updatedAt: now,
            seededBy: 'seed-script'
          }
        };

        if (dryRun) {
          console.log(`  Would insert/update block: ${blockDoc.blockId}`);
          results.blocks.items.push({ blockId: blockDoc.blockId, name: blockDoc.name, action: 'dry-run' });
        } else {
          const existing = await blocksCollection.findOne({
            blockId: blockDoc.blockId,
            version: blockDoc.version
          });

          if (existing) {
            await blocksCollection.updateOne(
              { blockId: blockDoc.blockId, version: blockDoc.version },
              { $set: { ...blockDoc, 'metadata.updatedAt': now } }
            );
            results.blocks.updated++;
            console.log(`  Updated block: ${blockDoc.blockId}`);
            results.blocks.items.push({ blockId: blockDoc.blockId, name: blockDoc.name, action: 'updated' });
          } else {
            await blocksCollection.insertOne(blockDoc);
            results.blocks.inserted++;
            console.log(`  Inserted block: ${blockDoc.blockId}`);
            results.blocks.items.push({ blockId: blockDoc.blockId, name: blockDoc.name, action: 'inserted' });
          }
        }

      } else {
        // Seed business objects to sample-data-models with domain: 'context'
        const dataModelDoc = {
          name: example.name,
          domain: 'context',
          modelType: example.scope || 'business_object',
          description: example.description || '',
          domainData: {
            schema: example.schema,
            id: example.id,
            scope: example.scope,
            origin: example.origin,
            version: example.version,
            status: example.status,
            nodes: example.nodes,
            terminologyBindings: example.terminologyBindings || []
          },
          metadata: {
            description: example.description,
            scope: example.scope,
            origin: example.origin,
            version: example.version,
            status: example.status,
            tags: example.metadata?.tags || ['context-object']
          },
          audit: {
            createdAt: new Date(),
            createdBy: 'seed-script',
            seededAt: new Date()
          }
        };

        if (dryRun) {
          console.log(`  Would insert/update context object: ${example.name}`);
          results.contextObjects.items.push({ id: example.id, name: example.name, action: 'dry-run' });
        } else {
          const result = await dataModelsCollection.updateOne(
            { name: dataModelDoc.name, domain: 'context' },
            { $set: dataModelDoc },
            { upsert: true }
          );

          if (result.upsertedCount > 0) {
            results.contextObjects.inserted++;
            console.log(`  Inserted context object: ${example.name}`);
            results.contextObjects.items.push({ id: example.id, name: example.name, action: 'inserted' });
          } else if (result.modifiedCount > 0) {
            results.contextObjects.updated++;
            console.log(`  Updated context object: ${example.name}`);
            results.contextObjects.items.push({ id: example.id, name: example.name, action: 'updated' });
          } else {
            console.log(`  No changes for context object: ${example.name}`);
            results.contextObjects.items.push({ id: example.id, name: example.name, action: 'unchanged' });
          }
        }
      }
    }

    // Create indexes if not dry run
    if (!dryRun) {
      console.log('');
      console.log('Creating indexes...');

      try {
        await dataModelsCollection.createIndex({ domain: 1 });
        await dataModelsCollection.createIndex({ name: 1, domain: 1 }, { unique: true });
        await dataModelsCollection.createIndex({ 'domainData.id': 1 });
        await dataModelsCollection.createIndex({ 'metadata.tags': 1 });
        console.log('  Created indexes on sample-data-models');
      } catch (err) {
        console.log(`  Index note: ${err.message}`);
      }

      try {
        await blocksCollection.createIndex({ blockId: 1 });
        await blocksCollection.createIndex({ blockId: 1, version: -1 }, { unique: true });
        await blocksCollection.createIndex({ 'metadata.tags': 1 });
        console.log('  Created indexes on sample_co_blocks');
      } catch (err) {
        console.log(`  Index note: ${err.message}`);
      }
    }

  } finally {
    await client.close();
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log('');

  console.log('Building Blocks (sample_co_blocks):');
  console.log(`  Inserted: ${results.blocks.inserted}`);
  console.log(`  Updated: ${results.blocks.updated}`);
  results.blocks.items.forEach(item => {
    console.log(`    - ${item.blockId}: ${item.action}`);
  });

  console.log('');
  console.log('Context Objects (sample-data-models, domain: context):');
  console.log(`  Inserted: ${results.contextObjects.inserted}`);
  console.log(`  Updated: ${results.contextObjects.updated}`);
  results.contextObjects.items.forEach(item => {
    console.log(`    - ${item.name}: ${item.action}`);
  });

  console.log('');
  if (dryRun) {
    console.log('(This was a dry run - no changes were made)');
    console.log('Run without --dry-run to apply changes.');
  } else {
    console.log('Seeding complete!');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
