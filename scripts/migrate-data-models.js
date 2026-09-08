#!/usr/bin/env node
/**
 * Migration script: Convert legacy data model format to new unified format
 *
 * Legacy format (webTemplate at root):
 *   { name, webTemplate, source, metadata, ... }
 *
 * New format (domainData wrapper):
 *   { name, domain: 'openehr', domainData: { webTemplate, source }, metadata, ... }
 *
 * Usage: node scripts/migrate-data-models.js [--dry-run]
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const COLLECTION_NAME = 'user-data-models';

// Target database - change this to migrate different tenant databases
const TARGET_DB = process.argv.includes('--db')
  ? process.argv[process.argv.indexOf('--db') + 1]
  : 'hdl-team';

async function migrate() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('=== DRY RUN MODE - No changes will be made ===\n');
  }

  console.log(`Target database: ${TARGET_DB}\n`);

  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI not found in environment');
    process.exit(1);
  }

  // Replace database name in URI
  const baseUri = MONGODB_URI.replace(/\/[^/?]+\?/, `/${TARGET_DB}?`);
  const client = new MongoClient(baseUri);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db(TARGET_DB);
    const col = db.collection(COLLECTION_NAME);

    // Find all documents that have legacy format:
    // - Has webTemplate at root level
    // - Does NOT have domainData.webTemplate
    const legacyQuery = {
      webTemplate: { $exists: true },
      'domainData.webTemplate': { $exists: false }
    };

    const legacyDocs = await col.find(legacyQuery).toArray();
    console.log(`Found ${legacyDocs.length} legacy OpenEHR documents to migrate\n`);

    if (legacyDocs.length === 0) {
      console.log('No migration needed - all documents are already in new format');
      return;
    }

    let migrated = 0;
    let errors = 0;

    for (const doc of legacyDocs) {
      try {
        const webTemplate = doc.webTemplate;
        const source = doc.source || { type: 'web' };

        // Build the update
        const update = {
          $set: {
            domain: 'openehr',
            domainData: {
              webTemplate,
              source
            }
          },
          $unset: {
            webTemplate: '',
            source: ''
          }
        };

        if (dryRun) {
          console.log(`[DRY RUN] Would migrate: ${doc.name}`);
          console.log(`  - webTemplate nodes: ${webTemplate?.children?.length || 0} children`);
          console.log(`  - source type: ${source?.type || 'unknown'}`);
        } else {
          await col.updateOne({ _id: doc._id }, update);
          console.log(`Migrated: ${doc.name}`);
        }

        migrated++;
      } catch (err) {
        console.error(`Error migrating ${doc.name}: ${err.message}`);
        errors++;
      }
    }

    console.log(`\n=== Migration Summary ===`);
    console.log(`Total legacy documents: ${legacyDocs.length}`);
    console.log(`Successfully ${dryRun ? 'would migrate' : 'migrated'}: ${migrated}`);
    console.log(`Errors: ${errors}`);

    if (dryRun) {
      console.log('\nRun without --dry-run to apply changes');
    }

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

migrate();
