#!/usr/bin/env node

/**
 * Cleanup Script: Remove legacy migration metadata fields
 *
 * Removes these fields from semantic objects:
 * - updatedBy
 * - migratedAt
 * - migratedFrom
 *
 * Usage:
 *   node scripts/cleanup-migration-fields.mjs [--dry-run]
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const FIELDS_TO_REMOVE = ['updatedBy', 'migratedAt', 'migratedFrom'];

async function cleanupCollection(db, collectionName, dryRun = false) {
  const collection = db.collection(collectionName);

  // Find documents with any of these fields
  const query = {
    $or: FIELDS_TO_REMOVE.map(field => ({ [field]: { $exists: true } }))
  };

  const count = await collection.countDocuments(query);
  console.log(`  Found ${count} documents with legacy fields in ${collectionName}`);

  if (count === 0) {
    return { total: 0, updated: 0 };
  }

  if (!dryRun) {
    // Build $unset object
    const unsetFields = {};
    FIELDS_TO_REMOVE.forEach(field => {
      unsetFields[field] = '';
    });

    const result = await collection.updateMany(query, { $unset: unsetFields });
    console.log(`  Removed fields from ${result.modifiedCount} documents`);
    return { total: count, updated: result.modifiedCount };
  }

  return { total: count, updated: 0 };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Cleanup: Remove Legacy Migration Fields');
  console.log('='.repeat(60));
  console.log('');
  console.log('Fields to remove:', FIELDS_TO_REMOVE.join(', '));
  console.log('');

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be made');
    console.log('');
  }

  const results = { core: null, tenant: null };

  // Connect to CORE database
  // MONGODB_URI is the primary connection string
  const coreUrl = process.env.MONGODB_URI || process.env.CORE_MONGODB_URL || process.env.MONGODB_URL;
  const coreDbName = process.env.CORE_DATABASE_NAME || 'openehr_core';

  if (!coreUrl) {
    console.error('Error: MONGODB_URL not set');
    process.exit(1);
  }

  const client = new MongoClient(coreUrl);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log('');

    // Cleanup CORE collections
    console.log('Cleaning CORE database...');
    const coreDb = client.db(coreDbName);

    const coreCollections = [
      'sample_semantic_objects',
      'sample_co_blocks',
      'co_definitions'
    ];

    for (const collName of coreCollections) {
      try {
        const result = await cleanupCollection(coreDb, collName, dryRun);
        if (!results.core) results.core = {};
        results.core[collName] = result;
      } catch (err) {
        console.log(`  Skipping ${collName}: ${err.message}`);
      }
    }

    // Cleanup TENANT collections (from environments)
    console.log('');
    console.log('Cleaning TENANT collections...');

    const tenantCollections = [
      'semantic_objects',
      'co_blocks',
      'co_definitions'
    ];

    // Try tenant database if configured
    const tenantDbName = process.env.TENANT_DATABASE_NAME;
    if (tenantDbName) {
      const tenantDb = client.db(tenantDbName);
      for (const collName of tenantCollections) {
        try {
          const result = await cleanupCollection(tenantDb, collName, dryRun);
          if (!results.tenant) results.tenant = {};
          results.tenant[collName] = result;
        } catch (err) {
          console.log(`  Skipping ${collName}: ${err.message}`);
        }
      }
    } else {
      console.log('  No TENANT_DATABASE_NAME configured, skipping tenant cleanup');
    }

  } finally {
    await client.close();
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Cleanup Summary');
  console.log('='.repeat(60));

  if (results.core) {
    console.log('');
    console.log('CORE Database:');
    for (const [coll, result] of Object.entries(results.core)) {
      console.log(`  ${coll}: ${result.updated}/${result.total} cleaned`);
    }
  }

  if (results.tenant) {
    console.log('');
    console.log('TENANT Database:');
    for (const [coll, result] of Object.entries(results.tenant)) {
      console.log(`  ${coll}: ${result.updated}/${result.total} cleaned`);
    }
  }

  console.log('');
  console.log('Cleanup complete!');
  if (dryRun) {
    console.log('(This was a dry run - no changes were made)');
    console.log('Run without --dry-run to apply changes.');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
