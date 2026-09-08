#!/usr/bin/env node

/**
 * Normalize legacy document type alias:
 *   laboratory_csv -> biology_csv
 *
 * Dry run:
 *   node scripts/migrate-document-type-biology.mjs
 *
 * Apply:
 *   node scripts/migrate-document-type-biology.mjs --apply
 *   node scripts/migrate-document-type-biology.mjs --apply --uri="mongodb://..." --db="hdl_core"
 *
 * Tenant-wide:
 *   node scripts/migrate-document-type-biology.mjs --apply --all-tenants
 *   node scripts/migrate-document-type-biology.mjs --apply --env-id=<ENV_ID>
 */

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { openSecret } from '../src/lib/crypto/secrets.mjs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const LEGACY = 'laboratory_csv';
const CANONICAL = 'biology_csv';
const MIGRATION_ACTOR = 'script:migrate-document-type-biology';

function parseArgs(argv) {
  const args = argv.slice(2);
  const has = (flag) => args.includes(flag);
  const get = (name) => {
    const inline = args.find((a) => a.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1).trim();
    const idx = args.indexOf(name);
    if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1].trim();
    return '';
  };
  return {
    apply: has('--apply'),
    uri: get('--uri'),
    db: get('--db'),
    allTenants: has('--all-tenants'),
    envId: get('--env-id')
  };
}

function resolveMongoUri(argUri) {
  let uri = String(argUri || process.env.MONGODB_URI || process.env.CORE_MONGODB_URL || '').trim();
  if (uri.includes('${MONGODB_URI}')) {
    uri = String(process.env.MONGODB_URI || '').trim();
  }
  if (!uri || uri.includes('${')) {
    throw new Error('MongoDB URI is required. Set MONGODB_URI (or CORE_MONGODB_URL) or pass --uri.');
  }
  return uri;
}

function resolveDbName(argDb) {
  const db = String(argDb || process.env.CORE_DATABASE_NAME || 'hdl_core').trim();
  if (!db) throw new Error('Database name is required. Set CORE_DATABASE_NAME or pass --db.');
  return db;
}

async function collectTenantEnvironments(coreDb) {
  const envMap = new Map();

  const registerEnv = (env, ownerLabel) => {
    const id = String(env?.id || env?._id || '').trim();
    const database = String(env?.database || env?.dbName || '').trim();
    if (!id || !database) return;

    if (!envMap.has(id)) {
      envMap.set(id, {
        id,
        name: String(env?.name || id),
        database,
        sealedUri: env?.sealedUri || null,
        dbUri: env?.dbUri || null,
        owners: [ownerLabel]
      });
      return;
    }

    const existing = envMap.get(id);
    existing.owners.push(ownerLabel);
    if (!existing.sealedUri && env?.sealedUri) existing.sealedUri = env.sealedUri;
    if (!existing.dbUri && env?.dbUri) existing.dbUri = env.dbUri;
    if (!existing.database && database) existing.database = database;
  };

  const users = await coreDb.collection('users').find({}, { projection: { email: 1, environments: 1 } }).toArray();
  for (const user of users) {
    const envs = Array.isArray(user?.environments) ? user.environments : [];
    for (const env of envs) registerEnv(env, `user:${user.email || user._id}`);
  }

  const teams = await coreDb.collection('teams').find({}, { projection: { name: 1, environments: 1 } }).toArray();
  for (const team of teams) {
    const envs = Array.isArray(team?.environments) ? team.environments : [];
    for (const env of envs) registerEnv(env, `team:${team.name || team._id}`);
  }

  return Array.from(envMap.values());
}

function getSecretMap(secretDocs = []) {
  const out = new Map();
  for (const doc of secretDocs) {
    const keys = [doc?.envId, doc?.environmentId, doc?._id]
      .map((v) => (v == null ? '' : String(v).trim()))
      .filter(Boolean);
    for (const key of keys) {
      if (!out.has(key)) out.set(key, doc);
    }
  }
  return out;
}

function resolveTenantUri(env, secretMap) {
  if (env?.sealedUri) {
    return openSecret(env.sealedUri);
  }

  const sec = secretMap.get(env.id);
  if (sec?.sealedUri) {
    return openSecret(sec.sealedUri);
  }

  if (env?.dbUri) return String(env.dbUri);
  return '';
}

function asTs(value) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function pickNewest(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return null;
  return [...docs].sort((a, b) => asTs(b.updatedAt || b.createdAt) - asTs(a.updatedAt || a.createdAt))[0];
}

function unionStrings(a, b) {
  const out = new Set();
  for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    const text = String(item || '').trim();
    if (text) out.add(text);
  }
  return Array.from(out);
}

async function migrateMappingDefinitions(db, apply) {
  const col = db.collection('mapping_definitions');
  const legacyDocs = await col.find({ documentType: LEGACY }).toArray();
  if (!legacyDocs.length) {
    console.log('mapping_definitions: no legacy documentType found.');
    return;
  }

  console.log(`mapping_definitions: ${legacyDocs.length} document(s) will be normalized to ${CANONICAL}.`);
  if (!apply) return;

  const now = new Date();
  for (const doc of legacyDocs) {
    await col.updateOne(
      { _id: doc._id },
      {
        $set: {
          documentType: CANONICAL,
          updatedAt: now,
          updatedBy: MIGRATION_ACTOR
        }
      }
    );
  }
}

async function migrateTypeTemplateAssociations(db, apply) {
  const col = db.collection('type_template_associations');
  const docs = await col.find({ documentType: { $in: [LEGACY, CANONICAL] } }).toArray();
  if (!docs.length) {
    console.log('type_template_associations: no legacy/canonical entries found.');
    return;
  }

  const newest = pickNewest(docs);
  const newestWithTemplate = pickNewest(docs.filter((d) => d?.templateId));
  const resolvedTemplateId = newestWithTemplate?.templateId || newest?.templateId || null;

  console.log(
    `type_template_associations: ${docs.length} record(s) found, final templateId = ${resolvedTemplateId || '(none)'}.`
  );
  if (!apply) return;

  const now = new Date();
  if (newest?._id) {
    await col.updateOne(
      { _id: newest._id },
      {
        $set: {
          documentType: CANONICAL,
          templateId: resolvedTemplateId,
          updatedAt: now,
          updatedBy: MIGRATION_ACTOR
        }
      }
    );

    await col.deleteMany({
      _id: { $ne: newest._id },
      documentType: { $in: [LEGACY, CANONICAL] }
    });
  } else {
    await col.updateOne(
      { documentType: CANONICAL },
      {
        $set: {
          documentType: CANONICAL,
          templateId: resolvedTemplateId,
          updatedAt: now,
          updatedBy: MIGRATION_ACTOR
        },
        $setOnInsert: {
          createdAt: now,
          createdBy: MIGRATION_ACTOR
        }
      },
      { upsert: true }
    );
    await col.deleteMany({ documentType: LEGACY });
  }
}

async function migrateDocumentPatterns(db, apply) {
  const col = db.collection('document_patterns');
  const legacy = await col.findOne({ name: LEGACY });
  const canonical = await col.findOne({ name: CANONICAL });

  if (!legacy && !canonical) {
    console.log('document_patterns: no legacy/canonical pattern found.');
    return;
  }

  if (legacy && !canonical) {
    console.log('document_patterns: legacy pattern will be renamed to biology_csv.');
    if (!apply) return;
    await col.updateOne(
      { _id: legacy._id },
      {
        $set: {
          name: CANONICAL,
          updatedAt: new Date(),
          updatedBy: MIGRATION_ACTOR
        }
      }
    );
    return;
  }

  if (!legacy && canonical) {
    console.log('document_patterns: canonical pattern already present, no rename needed.');
    return;
  }

  console.log('document_patterns: both legacy and canonical patterns found, merging into canonical.');
  if (!apply) return;

  const now = new Date();
  const merged = {
    handler: canonical?.handler || legacy?.handler || 'csv',
    priority: Math.max(Number(canonical?.priority || 0), Number(legacy?.priority || 0), 50),
    required_elements: unionStrings(canonical?.required_elements, legacy?.required_elements),
    xpath_patterns: unionStrings(canonical?.xpath_patterns, legacy?.xpath_patterns),
    namespaces: {
      ...(legacy?.namespaces && typeof legacy.namespaces === 'object' ? legacy.namespaces : {}),
      ...(canonical?.namespaces && typeof canonical.namespaces === 'object' ? canonical.namespaces : {})
    },
    csv_headers: unionStrings(canonical?.csv_headers, legacy?.csv_headers).map((v) => v.toLowerCase()),
    exclude_elements: unionStrings(canonical?.exclude_elements, legacy?.exclude_elements),
    updatedAt: now,
    updatedBy: MIGRATION_ACTOR
  };

  await col.updateOne({ _id: canonical._id }, { $set: merged });
  await col.deleteOne({ _id: legacy._id });
}

async function migrateDatabase({ uri, dbName, apply, label = null }) {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    if (label) {
      console.log(`\n[${label}] db=${dbName}`);
    }
    await migrateMappingDefinitions(db, apply);
    await migrateTypeTemplateAssociations(db, apply);
    await migrateDocumentPatterns(db, apply);
  } finally {
    await client.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? 'APPLY' : 'DRY-RUN';

  if (args.allTenants || args.envId) {
    const coreUri = resolveMongoUri(args.uri);
    const coreDbName = resolveDbName(args.db);
    console.log(`\n[migrate-document-type-biology] mode=${mode} scope=${args.envId ? `env=${args.envId}` : 'all-tenants'} coreDb=${coreDbName}`);

    const coreClient = new MongoClient(coreUri);
    try {
      await coreClient.connect();
      const coreDb = coreClient.db(coreDbName);
      const allEnvs = await collectTenantEnvironments(coreDb);
      const secretDocs = await coreDb.collection('environment_secrets').find({}, { projection: { envId: 1, environmentId: 1, sealedUri: 1 } }).toArray();
      const secretMap = getSecretMap(secretDocs);

      const targetEnvs = args.envId
        ? allEnvs.filter((env) => env.id === args.envId)
        : allEnvs;

      if (!targetEnvs.length) {
        throw new Error(args.envId
          ? `Environment not found in users/teams: ${args.envId}`
          : 'No tenant environments found in users/teams');
      }

      for (const env of targetEnvs) {
        let tenantUri = '';
        try {
          tenantUri = resolveTenantUri(env, secretMap);
        } catch (error) {
          console.error(`\n[${env.name}] skipped: cannot decrypt URI (${error.message})`);
          continue;
        }

        if (!tenantUri || tenantUri.includes('${')) {
          console.error(`\n[${env.name}] skipped: missing or unresolved tenant URI.`);
          continue;
        }

        try {
          await migrateDatabase({
            uri: tenantUri,
            dbName: env.database,
            apply: args.apply,
            label: `${env.name} (${env.id})`
          });
        } catch (error) {
          console.error(`\n[${env.name}] migration failed: ${error.message}`);
        }
      }
    } finally {
      await coreClient.close();
    }
  } else {
    const uri = resolveMongoUri(args.uri);
    const dbName = resolveDbName(args.db);
    console.log(`\n[migrate-document-type-biology] mode=${mode} db=${dbName}`);
    await migrateDatabase({ uri, dbName, apply: args.apply });
  }

  if (!args.apply) {
    console.log('\nDry run complete. Re-run with --apply to persist changes.');
  } else {
    console.log('\nMigration complete.');
  }
}

main().catch((error) => {
  console.error('\nMigration failed:', error);
  process.exit(1);
});
