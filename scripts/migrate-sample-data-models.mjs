#!/usr/bin/env node
/**
 * Migration Script: Unify Sample Data Models
 *
 * This script migrates data from the legacy collection structure to the new unified
 * sample-data-models collection with domain field.
 *
 * Old structure:
 * - sample-openehr-templates (OpenEHR templates)
 * - sample-fhir-resources (FHIR resources)
 * - sample-context-objects (Context objects - currently empty)
 *
 * New structure:
 * - sample-data-models (all domains with 'domain' field)
 *
 * Usage:
 *   node scripts/migrate-sample-data-models.mjs
 *
 * Environment variables:
 *   CORE_MONGODB_URL - MongoDB connection string for core database
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Support both direct MONGODB_URI and CORE_MONGODB_URL (which may reference MONGODB_URI)
let CORE_MONGODB_URL = process.env.CORE_MONGODB_URL;
if (CORE_MONGODB_URL?.includes('${MONGODB_URI}')) {
  CORE_MONGODB_URL = process.env.MONGODB_URI;
}
const CORE_DATABASE_NAME = process.env.CORE_DATABASE_NAME || 'openehr_core';

if (!CORE_MONGODB_URL) {
  console.error('ERROR: CORE_MONGODB_URL or MONGODB_URI environment variable is not set');
  process.exit(1);
}

// Source collections to migrate from
const SOURCE_COLLECTIONS = {
  openehr: 'sample-openehr-templates',
  fhir: 'sample-fhir-resources',
  context: 'sample-context-objects',
};

const TARGET_COLLECTION = 'sample-data-models';

/**
 * Transform OpenEHR template document to unified format
 */
function transformOpenEHR(doc) {
  return {
    name: doc.name || doc.webTemplate?.templateId || 'Unnamed Template',
    domain: 'openehr',
    modelType: 'template',
    description: doc.metadata?.description || doc.webTemplate?.description || '',
    domainData: {
      webTemplate: doc.webTemplate,
      source: doc.source,
    },
    metadata: {
      templateId: doc.webTemplate?.templateId || doc.metadata?.templateId,
      node: doc.metadata?.node,
      description: doc.metadata?.description,
      compositionKind: doc.metadata?.compositionKind,
      archetypes: doc.metadata?.archetypes || [],
      entryTypes: doc.metadata?.entryTypes || [],
      datatypes: doc.metadata?.datatypes || [],
      languages: doc.metadata?.languages || [],
      terminologies: doc.metadata?.terminologies || [],
      counts: doc.metadata?.counts || {},
      tags: doc.metadata?.tags || ['openehr', 'template'],
    },
    audit: {
      createdAt: doc.audit?.createdAt || new Date(),
      createdBy: doc.audit?.createdBy || 'migration',
      updatedAt: doc.audit?.updatedAt,
      updatedBy: doc.audit?.updatedBy,
      migratedAt: new Date(),
      migratedFrom: 'sample-openehr-templates',
    },
  };
}

/**
 * Transform FHIR resource document to unified format
 */
function transformFHIR(doc) {
  return {
    name: doc.name || doc.domainData?.resourceType || 'Unnamed Resource',
    domain: 'fhir',
    modelType: doc.modelType || 'resource',
    description: doc.description || '',
    domainData: {
      resourceType: doc.domainData?.resourceType,
      category: doc.domainData?.category,
      version: doc.domainData?.version,
      structure: doc.domainData?.structure,
    },
    metadata: {
      tags: doc.metadata?.tags || ['fhir', 'resource'],
      domainMetadata: doc.metadata?.domainMetadata,
      ...doc.metadata,
    },
    audit: {
      createdAt: doc.audit?.createdAt || new Date(),
      createdBy: doc.audit?.createdBy || 'migration',
      updatedAt: doc.audit?.updatedAt,
      updatedBy: doc.audit?.updatedBy,
      migratedAt: new Date(),
      migratedFrom: 'sample-fhir-resources',
    },
  };
}

/**
 * Transform Context Object document to unified format
 */
function transformContext(doc) {
  return {
    name: doc.name || doc.id || 'Unnamed Context Object',
    domain: 'context',
    modelType: doc.scope || 'business_object',
    description: doc.description || '',
    domainData: {
      id: doc.id,
      scope: doc.scope,
      origin: doc.origin,
      version: doc.version,
      versionString: doc.versionString,
      status: doc.status,
      nodes: doc.nodes,
      terminologyBindings: doc.terminologyBindings,
      structuralBindings: doc.structuralBindings,
      schema: doc.schema,
    },
    metadata: {
      scope: doc.scope,
      origin: doc.origin,
      version: doc.version,
      versionString: doc.versionString,
      status: doc.status,
      tags: doc.metadata?.tags || ['context', doc.scope || 'business_object'],
      ...doc.metadata,
    },
    audit: {
      createdAt: doc.metadata?.createdAt || doc.audit?.createdAt || new Date(),
      createdBy: doc.metadata?.createdBy || doc.audit?.createdBy || 'migration',
      migratedAt: new Date(),
      migratedFrom: 'sample-context-objects',
    },
  };
}

async function migrate() {
  const client = new MongoClient(CORE_MONGODB_URL);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log(`Database: ${CORE_DATABASE_NAME}`);

    const db = client.db(CORE_DATABASE_NAME);
    const targetCollection = db.collection(TARGET_COLLECTION);

    const stats = {
      openehr: { migrated: 0, skipped: 0, errors: 0 },
      fhir: { migrated: 0, skipped: 0, errors: 0 },
      context: { migrated: 0, skipped: 0, errors: 0 },
    };

    // List existing collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('\nExisting collections:', collectionNames.join(', '));

    // 1. Migrate OpenEHR templates
    console.log('\n--- Migrating OpenEHR templates ---');
    if (collectionNames.includes(SOURCE_COLLECTIONS.openehr)) {
      const sourceCollection = db.collection(SOURCE_COLLECTIONS.openehr);
      const count = await sourceCollection.countDocuments();
      console.log(`Found ${count} documents in ${SOURCE_COLLECTIONS.openehr}`);

      const cursor = sourceCollection.find({});
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        try {
          // Check if already exists in target (by name and domain)
          const existing = await targetCollection.findOne({
            name: doc.name || doc.webTemplate?.templateId,
            domain: 'openehr'
          });

          if (existing) {
            stats.openehr.skipped++;
            continue;
          }

          const transformed = transformOpenEHR(doc);
          await targetCollection.insertOne(transformed);
          stats.openehr.migrated++;
          console.log(`  + ${transformed.name}`);
        } catch (err) {
          stats.openehr.errors++;
          console.error(`  ERROR: ${doc.name}: ${err.message}`);
        }
      }
    } else {
      console.log(`  Collection ${SOURCE_COLLECTIONS.openehr} not found`);
    }

    // 2. Migrate FHIR resources
    console.log('\n--- Migrating FHIR resources ---');
    if (collectionNames.includes(SOURCE_COLLECTIONS.fhir)) {
      const sourceCollection = db.collection(SOURCE_COLLECTIONS.fhir);
      const count = await sourceCollection.countDocuments();
      console.log(`Found ${count} documents in ${SOURCE_COLLECTIONS.fhir}`);

      const cursor = sourceCollection.find({});
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        try {
          // Check if already exists in target (by name and domain)
          const existing = await targetCollection.findOne({
            name: doc.name || doc.domainData?.resourceType,
            domain: 'fhir'
          });

          if (existing) {
            stats.fhir.skipped++;
            continue;
          }

          const transformed = transformFHIR(doc);
          await targetCollection.insertOne(transformed);
          stats.fhir.migrated++;
          console.log(`  + ${transformed.name}`);
        } catch (err) {
          stats.fhir.errors++;
          console.error(`  ERROR: ${doc.name}: ${err.message}`);
        }
      }
    } else {
      console.log(`  Collection ${SOURCE_COLLECTIONS.fhir} not found`);
    }

    // 3. Migrate Context Objects (if any exist)
    console.log('\n--- Migrating Context Objects ---');
    if (collectionNames.includes(SOURCE_COLLECTIONS.context)) {
      const sourceCollection = db.collection(SOURCE_COLLECTIONS.context);
      const count = await sourceCollection.countDocuments();
      console.log(`Found ${count} documents in ${SOURCE_COLLECTIONS.context}`);

      if (count > 0) {
        const cursor = sourceCollection.find({});
        while (await cursor.hasNext()) {
          const doc = await cursor.next();
          try {
            const existing = await targetCollection.findOne({
              name: doc.name || doc.id,
              domain: 'context'
            });

            if (existing) {
              stats.context.skipped++;
              continue;
            }

            const transformed = transformContext(doc);
            await targetCollection.insertOne(transformed);
            stats.context.migrated++;
            console.log(`  + ${transformed.name}`);
          } catch (err) {
            stats.context.errors++;
            console.error(`  ERROR: ${doc.name}: ${err.message}`);
          }
        }
      }
    } else {
      console.log(`  Collection ${SOURCE_COLLECTIONS.context} not found or empty`);
    }

    // 4. Create indexes on target collection
    console.log('\n--- Creating indexes ---');
    try {
      await targetCollection.createIndex({ domain: 1 });
      await targetCollection.createIndex({ name: 1, domain: 1 }, { unique: true });
      await targetCollection.createIndex({ modelType: 1 });
      await targetCollection.createIndex({ 'metadata.tags': 1 });
      await targetCollection.createIndex({ 'domainData.resourceType': 1 });
      await targetCollection.createIndex({ 'domainData.webTemplate.templateId': 1 });
      await targetCollection.createIndex({ 'audit.createdAt': -1 });
      console.log('  Indexes created successfully');
    } catch (err) {
      console.log(`  Index creation: ${err.message}`);
    }

    // 5. Print summary
    console.log('\n========================================');
    console.log('         MIGRATION SUMMARY');
    console.log('========================================');
    console.log(`OpenEHR: ${stats.openehr.migrated} migrated, ${stats.openehr.skipped} skipped, ${stats.openehr.errors} errors`);
    console.log(`FHIR:    ${stats.fhir.migrated} migrated, ${stats.fhir.skipped} skipped, ${stats.fhir.errors} errors`);
    console.log(`Context: ${stats.context.migrated} migrated, ${stats.context.skipped} skipped, ${stats.context.errors} errors`);

    const totalMigrated = stats.openehr.migrated + stats.fhir.migrated + stats.context.migrated;
    const totalSkipped = stats.openehr.skipped + stats.fhir.skipped + stats.context.skipped;
    console.log(`\nTotal: ${totalMigrated} migrated, ${totalSkipped} skipped`);

    // Final counts
    const finalCount = await targetCollection.countDocuments();
    console.log(`\nTarget collection (${TARGET_COLLECTION}): ${finalCount} documents`);

    // Count by domain
    const domainCounts = await targetCollection.aggregate([
      { $group: { _id: '$domain', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    console.log('\nDocuments by domain:');
    for (const dc of domainCounts) {
      console.log(`  ${dc._id}: ${dc.count}`);
    }

    console.log('\n========================================');
    console.log('Migration complete!');
    console.log('\nNote: Old collections have NOT been dropped.');
    console.log('After verifying the migration, you can drop them manually:');
    console.log(`  - ${SOURCE_COLLECTIONS.openehr}`);
    console.log(`  - ${SOURCE_COLLECTIONS.fhir}`);
    console.log(`  - ${SOURCE_COLLECTIONS.context}`);

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

migrate();
