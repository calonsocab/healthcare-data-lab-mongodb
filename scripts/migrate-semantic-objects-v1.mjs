#!/usr/bin/env node

/**
 * Migration Script: Semantic Objects to v1 Format (Clean Spec)
 *
 * This script transforms existing semantic objects to the ContextObjects v1 specification.
 * It updates both CORE (sample) and TENANT databases.
 *
 * Changes made:
 * - Adds schema: { version: 'co/1', pathDialect: 'coql/v1' }
 * - Maps old scope values: building_block, business_object
 * - Maps old origin values: custom, standard, vendor
 * - Adds role field to nodes (defaults to 'field')
 * - Ensures version is string format (semver)
 * - Syncs childrenNodeIds from parentNodeId references
 * - REMOVES emit fields (emit belongs in Stage-2, not CO definitions)
 *
 * Usage:
 *   node scripts/migrate-semantic-objects-v1.mjs [--dry-run] [--core-only] [--tenant-only]
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

// ============= Configuration =============

const SCHEMA_VERSION = 'co/1';
const PATH_DIALECT = 'coql/v1';

// Scope mappings (clean spec: business_object | building_block)
const SCOPE_MAP = {
  'building_block': 'building_block',
  'business_object': 'business_object',
  'technical': 'building_block',  // Map legacy to building_block
  'block': 'building_block',      // Normalize to building_block
  'event': 'business_object',     // Events are business objects
  'document': 'business_object'   // Documents are business objects
};

// Origin mappings (clean spec: custom | standard | vendor)
const ORIGIN_MAP = {
  'custom': 'custom',
  'openehr': 'standard',
  'fhir': 'standard',
  'other': 'vendor',
  'imported': 'vendor',
  // New values pass through
  'standard': 'standard',
  'vendor': 'vendor'
};

// Role inference from dataType
function inferRole(node) {
  if (node.role) return node.role;

  // If it has children, it's likely a container
  if (node.childrenNodeIds && node.childrenNodeIds.length > 0) {
    if (node.dataType === 'array') return 'event_series';
    return 'group';
  }

  // Leaf nodes are fields
  return 'field';
}

// ============= Migration Functions =============

function migrateNode(node) {
  // Clean CO v1 spec: NO emit field in node definitions
  // emit belongs in Stage-2 mapping, not the definition layer
  const migrated = {
    nodeId: node.nodeId,
    parentNodeId: node.parentNodeId,
    childrenNodeIds: node.childrenNodeIds || [],
    role: inferRole(node),
    name: node.name || '',
    attribute: node.attribute || '',
    dataType: node.dataType,
    occurrences: node.occurrences || { min: 0, max: 1 }
  };

  // Optional fields - only include if present
  if (node.description) migrated.description = node.description;
  if (node.constraints) migrated.constraints = node.constraints;
  if (node.timeRole) migrated.timeRole = node.timeRole;
  if (node.blockId) migrated.blockId = node.blockId;
  if (node.versionRange) migrated.versionRange = node.versionRange;
  if (node.terminologyBindings?.length) migrated.terminologyBindings = node.terminologyBindings;
  if (node.structuralBindings?.length) migrated.structuralBindings = node.structuralBindings;
  if (node.itemSpec) migrated.itemSpec = node.itemSpec;

  // UI hints (ephemeral)
  if (node.color) migrated.color = node.color;
  if (node.icon) migrated.icon = node.icon;

  return migrated;
}

function syncChildrenNodeIds(nodes) {
  const childrenMap = new Map();

  // Initialize
  nodes.forEach(node => childrenMap.set(node.nodeId, []));

  // Build from parent refs
  nodes.forEach(node => {
    if (node.parentNodeId) {
      const siblings = childrenMap.get(node.parentNodeId);
      if (siblings) {
        siblings.push(node.nodeId);
      }
    }
  });

  // Apply
  return nodes.map(node => ({
    ...node,
    childrenNodeIds: childrenMap.get(node.nodeId) || []
  }));
}

function migrateSemanticObject(obj) {
  // Migrate nodes first
  let migratedNodes = (obj.nodes || []).map(migrateNode);

  // Sync children from parent references
  migratedNodes = syncChildrenNodeIds(migratedNodes);

  // Convert numeric version to string if needed
  let version = obj.version;
  if (typeof version === 'number') {
    const major = Math.floor(version / 10000);
    const minor = Math.floor((version % 10000) / 100);
    const patch = version % 100;
    version = `${major}.${minor}.${patch}`;
  } else if (!version) {
    version = '1.0.0';
  }

  // Build migrated object with clean CO v1 structure
  const migrated = {
    // Preserve ID
    _id: obj._id,
    id: obj.id,

    // v1 Schema (object format, not separate fields)
    schema: { version: SCHEMA_VERSION, pathDialect: PATH_DIALECT },

    // Basic info
    name: obj.name || '',
    description: obj.description || '',

    // v1 Classification
    scope: SCOPE_MAP[obj.scope] || obj.scope || 'business_object',
    origin: ORIGIN_MAP[obj.origin] || obj.origin || 'custom',

    // v1 Versioning
    version: version,
    status: obj.status || 'draft',

    // Structure
    nodes: migratedNodes,

    // Metadata
    metadata: {
      ...obj.metadata,
      migratedToV1: new Date().toISOString(),
      previousSchemaVersion: obj.schemaVersion || obj.schema?.version || 'pre-v1'
    }
  };

  // Optional bindings (include if present)
  if (obj.terminologyBindings?.length) {
    migrated.terminologyBindings = obj.terminologyBindings;
  }
  if (obj.structuralBindings?.length) {
    migrated.structuralBindings = obj.structuralBindings;
  }

  // Remove legacy fields that should not exist in v1
  // emissionPolicyDefault, schemaVersion (moved to schema.version), pathDialect (moved to schema.pathDialect)

  return migrated;
}

// ============= Database Operations =============

async function migrateCollection(db, collectionName, dryRun = false) {
  const collection = db.collection(collectionName);

  // Find objects that need migration
  // Objects with schema.version !== 'co/1' need migration
  const query = {
    $or: [
      { 'schema.version': { $exists: false } },
      { 'schema.version': { $ne: SCHEMA_VERSION } }
    ]
  };

  const objects = await collection.find(query).toArray();

  console.log(`  Found ${objects.length} objects to migrate in ${collectionName}`);

  const results = {
    total: objects.length,
    migrated: 0,
    errors: []
  };

  for (const obj of objects) {
    try {
      const migrated = migrateSemanticObject(obj);

      if (!dryRun) {
        await collection.updateOne(
          { _id: obj._id },
          { $set: migrated }
        );
      }

      results.migrated++;

      if (results.migrated % 10 === 0) {
        console.log(`  Migrated ${results.migrated}/${objects.length}...`);
      }
    } catch (error) {
      results.errors.push({
        id: obj.id || obj._id?.toString(),
        error: error.message
      });
      console.error(`  Error migrating ${obj.id || obj._id}: ${error.message}`);
    }
  }

  return results;
}

// ============= Main =============

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const coreOnly = args.includes('--core-only');
  const tenantOnly = args.includes('--tenant-only');

  console.log('='.repeat(60));
  console.log('ContextObjects v1 Migration Script');
  console.log('='.repeat(60));
  console.log('');

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be made');
    console.log('');
  }

  const results = {
    core: null,
    tenants: []
  };

  // Migrate CORE database
  if (!tenantOnly) {
    console.log('Migrating CORE database...');

    const coreUrl = process.env.CORE_MONGODB_URL || process.env.MONGODB_URL;
    const coreDbName = process.env.CORE_DATABASE_NAME || 'openehr_core';

    if (!coreUrl) {
      console.error('Error: CORE_MONGODB_URL not set');
    } else {
      const coreClient = new MongoClient(coreUrl);
      try {
        await coreClient.connect();
        const coreDb = coreClient.db(coreDbName);

        // Migrate sample semantic objects
        const sampleResults = await migrateCollection(coreDb, 'sample_semantic_objects', dryRun);
        results.core = {
          sample_semantic_objects: sampleResults
        };

        console.log(`  Core migration complete: ${sampleResults.migrated}/${sampleResults.total}`);
        if (sampleResults.errors.length > 0) {
          console.log(`  Errors: ${sampleResults.errors.length}`);
        }
      } finally {
        await coreClient.close();
      }
    }
    console.log('');
  }

  // Migrate TENANT databases
  if (!coreOnly) {
    console.log('Migrating TENANT databases...');

    // Get list of tenant databases from core
    const coreUrl = process.env.CORE_MONGODB_URL || process.env.MONGODB_URL;
    const coreDbName = process.env.CORE_DATABASE_NAME || 'openehr_core';

    if (!coreUrl) {
      console.error('Error: CORE_MONGODB_URL not set');
    } else {
      const coreClient = new MongoClient(coreUrl);
      try {
        await coreClient.connect();
        const coreDb = coreClient.db(coreDbName);

        // Get all environments with database URIs
        const environments = await coreDb.collection('environments').find({}).toArray();
        const secrets = await coreDb.collection('environment_secrets').find({}).toArray();

        const secretMap = new Map(secrets.map(s => [s.environmentId?.toString() || s._id?.toString(), s]));

        console.log(`  Found ${environments.length} environments`);

        for (const env of environments) {
          const envId = env._id?.toString();
          const secret = secretMap.get(envId);

          if (!secret?.encryptedDbUri && !env.dbUri) {
            console.log(`  Skipping ${env.name || envId} - no database URI`);
            continue;
          }

          // Note: In production, you'd decrypt the URI using openSecret()
          // For this script, we'll use direct URI if available
          const tenantUri = env.dbUri || process.env.TENANT_MONGODB_URL;
          const tenantDbName = env.dbName || env.name || `tenant_${envId}`;

          if (!tenantUri) {
            console.log(`  Skipping ${env.name || envId} - cannot determine URI`);
            continue;
          }

          console.log(`  Migrating tenant: ${env.name || envId}`);

          const tenantClient = new MongoClient(tenantUri);
          try {
            await tenantClient.connect();
            const tenantDb = tenantClient.db(tenantDbName);

            const tenantResults = await migrateCollection(tenantDb, 'semantic_objects', dryRun);
            results.tenants.push({
              name: env.name || envId,
              results: tenantResults
            });

            console.log(`    Migrated ${tenantResults.migrated}/${tenantResults.total}`);
          } catch (tenantError) {
            console.error(`    Error connecting to tenant: ${tenantError.message}`);
            results.tenants.push({
              name: env.name || envId,
              error: tenantError.message
            });
          } finally {
            await tenantClient.close();
          }
        }
      } finally {
        await coreClient.close();
      }
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));

  if (results.core) {
    console.log('');
    console.log('CORE Database:');
    for (const [collection, result] of Object.entries(results.core)) {
      console.log(`  ${collection}: ${result.migrated}/${result.total} migrated, ${result.errors.length} errors`);
    }
  }

  if (results.tenants.length > 0) {
    console.log('');
    console.log('TENANT Databases:');
    for (const tenant of results.tenants) {
      if (tenant.error) {
        console.log(`  ${tenant.name}: ERROR - ${tenant.error}`);
      } else {
        console.log(`  ${tenant.name}: ${tenant.results.migrated}/${tenant.results.total} migrated, ${tenant.results.errors.length} errors`);
      }
    }
  }

  console.log('');
  console.log('Migration complete!');
  if (dryRun) {
    console.log('(This was a dry run - no changes were made)');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
