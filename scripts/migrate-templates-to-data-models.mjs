#!/usr/bin/env node
/**
 * Migration Script: user_templates → user_data_models
 *
 * Migrates existing OpenEHR templates from the `user_templates` collection
 * to the new unified `user_data_models` collection in tenant databases.
 *
 * The document shape is preserved, only adding `domain: 'openehr'` field.
 *
 * Usage:
 *   # Single tenant migration (manual - provide tenant connection string)
 *   node scripts/migrate-templates-to-data-models.mjs --tenant-uri="mongodb://..." --tenant-db="mydb" [--dry-run]
 *
 *   # Auto-discovery mode (iterates through all environments in core)
 *   node scripts/migrate-templates-to-data-models.mjs --auto [--dry-run]
 *
 * Options:
 *   --dry-run      Preview migration without writing to database
 *   --tenant-uri   MongoDB connection string for the tenant database
 *   --tenant-db    Tenant database name
 *   --auto         Auto-discover environments from core database (requires decryption)
 *   --core-uri     Core database MongoDB URI (or use CORE_MONGODB_URL env var)
 *   --core-db      Core database name (or use CORE_DATABASE_NAME env var)
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '..', '.env.local') });

import { MongoClient } from 'mongodb';

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const autoMode = args.includes('--auto');

function getArg(name) {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '') : null;
}

const tenantUri = getArg('tenant-uri');
const tenantDb = getArg('tenant-db');

// Resolve core URI - handle variable references like ${MONGODB_URI}
let coreUri = getArg('core-uri') || process.env.CORE_MONGODB_URL || process.env.MONGODB_URI;
if (coreUri && coreUri.startsWith('${') && coreUri.endsWith('}')) {
  const varName = coreUri.slice(2, -1);
  coreUri = process.env[varName] || coreUri;
}
const coreDb = getArg('core-db') || process.env.CORE_DATABASE_NAME || 'openehr_core';

// Constants
const SOURCE_COLLECTION = 'user_templates';
const TARGET_COLLECTION = 'user_data_models';

/**
 * Migrate a single tenant database
 */
async function migrateTenant(uri, dbName, envName = 'Unknown') {
  console.log('');
  console.log(`Migrating environment: ${envName} (${dbName})`);
  console.log('-'.repeat(50));

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    const sourceCol = db.collection(SOURCE_COLLECTION);
    const targetCol = db.collection(TARGET_COLLECTION);

    // Get source count
    const sourceCount = await sourceCol.countDocuments();
    console.log(`  Found ${sourceCount} templates in ${SOURCE_COLLECTION}`);

    if (sourceCount === 0) {
      console.log('  No templates to migrate.');
      return { migrated: 0, skipped: 0, errors: 0 };
    }

    // Check for existing documents in target
    const existingCount = await targetCol.countDocuments({ domain: 'openehr' });
    if (existingCount > 0) {
      console.log(`  Found ${existingCount} existing OpenEHR documents in ${TARGET_COLLECTION}`);
    }

    // Get existing names in target to avoid duplicates
    const existingNames = new Set();
    const existingDocs = await targetCol.find(
      { domain: 'openehr' },
      { projection: { name: 1 } }
    ).toArray();
    existingDocs.forEach(doc => existingNames.add(doc.name));

    // Fetch all templates
    const templates = await sourceCol.find({}).toArray();

    // Prepare documents for insertion
    const toInsert = [];
    const skipped = [];
    const errors = [];

    for (const template of templates) {
      try {
        if (existingNames.has(template.name)) {
          skipped.push({ name: template.name, reason: 'Already exists' });
          continue;
        }

        const { _id, ...rest } = template;
        const dataModel = {
          ...rest,
          domain: 'openehr',
          _legacyTemplateId: _id,
        };

        toInsert.push(dataModel);
      } catch (err) {
        errors.push({ name: template.name, error: err.message });
      }
    }

    console.log(`  To migrate: ${toInsert.length}, Skipped: ${skipped.length}, Errors: ${errors.length}`);

    if (toInsert.length > 0 && !dryRun) {
      // Create indexes
      await targetCol.createIndex({ domain: 1 });
      await targetCol.createIndex({ name: 1 });
      await targetCol.createIndex({ domain: 1, name: 1 }, { unique: true });
      await targetCol.createIndex({ 'audit.createdAt': -1 });

      // Insert in batches
      const batchSize = 100;
      let inserted = 0;

      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const result = await targetCol.insertMany(batch);
        inserted += result.insertedCount;
      }

      console.log(`  Inserted: ${inserted} documents`);
    } else if (dryRun && toInsert.length > 0) {
      console.log(`  DRY RUN - Would insert ${toInsert.length} documents`);
    }

    return { migrated: toInsert.length, skipped: skipped.length, errors: errors.length };
  } finally {
    await client.close();
  }
}

/**
 * Auto-discover environments from core database
 */
async function discoverEnvironments() {
  if (!coreUri) {
    console.error('Error: Core database URI required for auto mode');
    console.error('Use --core-uri=xxx or set CORE_MONGODB_URL env var');
    process.exit(1);
  }

  console.log('Connecting to core database...');
  console.log(`Database: ${coreDb}`);

  const client = new MongoClient(coreUri);

  try {
    await client.connect();
    const db = client.db(coreDb);

    // Find all teams with environments
    const teams = await db.collection('teams').find(
      { 'environments.0': { $exists: true } },
      { projection: { name: 1, environments: 1 } }
    ).toArray();

    // Find all users with environments (individual accounts)
    const users = await db.collection('users').find(
      { 'environments.0': { $exists: true }, accountType: { $ne: 'team' } },
      { projection: { email: 1, environments: 1 } }
    ).toArray();

    console.log(`Found ${teams.length} teams and ${users.length} individual users with environments`);

    const environments = [];

    // Collect team environments
    for (const team of teams) {
      for (const env of team.environments || []) {
        const secret = await db.collection('environment_secrets').findOne({ envId: env.id });
        environments.push({
          envId: env.id,
          envName: env.name,
          database: env.database,
          owner: `Team: ${team.name}`,
          sealedUri: secret?.sealedUri || env.sealedUri
        });
      }
    }

    // Collect user environments
    for (const user of users) {
      for (const env of user.environments || []) {
        const secret = await db.collection('environment_secrets').findOne({ envId: env.id });
        environments.push({
          envId: env.id,
          envName: env.name,
          database: env.database,
          owner: `User: ${user.email}`,
          sealedUri: secret?.sealedUri || env.sealedUri
        });
      }
    }

    return environments;
  } finally {
    await client.close();
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Migration: user_templates → user_data_models');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  if (tenantUri && tenantDb) {
    // Manual single tenant migration
    console.log('Running single tenant migration...');
    const result = await migrateTenant(tenantUri, tenantDb, 'Manual');
    console.log('');
    console.log('Migration complete!');
    console.log(`  Migrated: ${result.migrated}`);
    console.log(`  Skipped: ${result.skipped}`);
    console.log(`  Errors: ${result.errors}`);
  } else if (autoMode) {
    // Auto-discover mode
    console.log('Running auto-discovery mode...');

    const environments = await discoverEnvironments();

    if (environments.length === 0) {
      console.log('No environments found.');
      return;
    }

    console.log('');
    console.log(`Found ${environments.length} environments:`);
    environments.forEach((env, i) => {
      console.log(`  ${i + 1}. ${env.envName} (${env.database}) - ${env.owner}`);
      console.log(`     Has sealed URI: ${env.sealedUri ? 'Yes' : 'No'}`);
    });

    // Try to decrypt and migrate
    console.log('');
    console.log('Attempting to decrypt and migrate...');
    console.log('(If decryption fails, use manual mode with --tenant-uri)');

    let openSecret;
    try {
      const cryptoModule = await import('../src/lib/crypto/secrets.mjs');
      openSecret = cryptoModule.openSecret;
    } catch (err) {
      console.error('');
      console.error('Failed to load crypto module:', err.message);
      console.error('');
      console.error('Please use manual mode with --tenant-uri and --tenant-db');
      console.error('Example:');
      console.error('  node scripts/migrate-templates-to-data-models.mjs --tenant-uri="mongodb://..." --tenant-db="mydb"');
      process.exit(1);
    }

    const totals = { migrated: 0, skipped: 0, errors: 0, failed: 0 };

    for (const env of environments) {
      if (!env.sealedUri) {
        console.log(`  Skipping ${env.envName}: No sealed URI`);
        totals.failed++;
        continue;
      }

      try {
        const uri = openSecret(env.sealedUri);
        if (!uri) {
          console.log(`  Skipping ${env.envName}: Failed to decrypt`);
          totals.failed++;
          continue;
        }

        const result = await migrateTenant(uri, env.database, env.envName);
        totals.migrated += result.migrated;
        totals.skipped += result.skipped;
        totals.errors += result.errors;
      } catch (err) {
        console.error(`  Error migrating ${env.envName}: ${err.message}`);
        totals.failed++;
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`  Total migrated: ${totals.migrated}`);
    console.log(`  Total skipped: ${totals.skipped}`);
    console.log(`  Total errors: ${totals.errors}`);
    console.log(`  Failed environments: ${totals.failed}`);
  } else {
    console.log('Usage:');
    console.log('');
    console.log('  Single tenant (manual):');
    console.log('    node scripts/migrate-templates-to-data-models.mjs \\');
    console.log('      --tenant-uri="mongodb://..." --tenant-db="mydb" [--dry-run]');
    console.log('');
    console.log('  Auto-discovery (all environments):');
    console.log('    node scripts/migrate-templates-to-data-models.mjs --auto [--dry-run]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run      Preview without making changes');
    console.log('  --tenant-uri   Tenant MongoDB connection string');
    console.log('  --tenant-db    Tenant database name');
    console.log('  --auto         Auto-discover all environments from core');
    console.log('  --core-uri     Core database URI (default: CORE_MONGODB_URL env)');
    console.log('  --core-db      Core database name (default: CORE_DATABASE_NAME env)');
  }
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
