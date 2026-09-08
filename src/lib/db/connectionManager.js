// src/lib/db/connectionManager.js
// • Single, pooled MongoDB connections per environment (no more open/close per request)
// • Fast tenant routing: resolve the active environment from cookie/header/session once
// • Small, focused libraries: connection manager, core DB, tenant DB, and template service
// • Safer: optional transport of active env via header/cookie instead of re-querying core DB each time
// • Ready for Next.js dev hot-reload: caches in globalThis

// Central connection pool manager. Reuses MongoClient instances per URI across requests.
import { MongoClient } from 'mongodb';

const DEFAULTS = {
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '20', 10),
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '0', 10),
  maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_MS || '60000', 10),
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 60000,
  retryWrites: true,
  compressors: 'zstd,zlib,snappy',
  appName: 'Healthcare-Data-Lab',
};

// dev-safe global cache (Next.js HMR)
const globalKey = '__openEhrConnMgr__';
const store = globalThis[globalKey] || { clients: new Map(), dbs: new Map() };
if (!globalThis[globalKey]) globalThis[globalKey] = store;

function dbKey(uri, dbName) { return `${uri}|${dbName}`; }

async function getClient(uri, mongoOptions = {}) {
  if (!uri) throw new Error('Mongo URI is required');
  if (!store.clients.has(uri)) {
    const p = (async () => {
      const client = new MongoClient(uri, { ...DEFAULTS, ...mongoOptions });
      await client.connect();
      return client;
    })();
    store.clients.set(uri, p);
  }
  return store.clients.get(uri);
}

export async function getDb({ uri, dbName, mongoOptions } = {}) {
  if (!uri || !dbName) throw new Error('getDb requires { uri, dbName }');
  const key = dbKey(uri, dbName);
  if (store.dbs.has(key)) return store.dbs.get(key);
  const client = await getClient(uri, mongoOptions);
  const db = client.db(dbName);
  store.dbs.set(key, db);
  return db;
}

export async function closeAllConnections() {
  const closers = [];
  for (const p of store.clients.values()) {
    try { const c = await p; closers.push(c.close()); } catch {}
  }
  await Promise.allSettled(closers);
  store.clients.clear();
  store.dbs.clear();
}

// one-time indexes per DB
const ensured = new Set();

export async function ensureTemplateIndexes(db) {
  // bump the signature if you change indexes
  const sig = `${db.databaseName}|user-data-models|v6`;
  if (ensured.has(sig)) return;

  const col = db.collection('user-data-models');

  // Index definitions - create individually to handle conflicts gracefully
  const indexes = [
    { key: { name: 1 }, name: 'name_1' },
    { key: { 'audit.createdAt': -1 }, name: 'audit_createdAt_desc' },
    { key: { domain: 1 }, name: 'domain_1' },
    { key: { 'domainData.source.type': 1 }, name: 'domainData_source_type_1' },
    { key: { 'domainData.webTemplate.nodeId': 1 }, name: 'domainData_webTemplate_nodeId_1' },
    { key: { 'metadata.templateId': 1 }, name: 'meta_templateId_1' },
    { key: { 'metadata.compositionKind': 1 }, name: 'meta_compositionKind_1' },
    { key: { 'metadata.archetypes': 1 }, name: 'meta_archetypes_1' },
    { key: { 'metadata.datatypes': 1 }, name: 'meta_datatypes_1' },
    { key: { 'metadata.languages': 1 }, name: 'meta_languages_1' },
    { key: { 'metadata.terminologies': 1 }, name: 'meta_terminologies_1' },
    { key: { name: 'text', 'metadata.description': 'text', description: 'text' }, name: 'tix_name_desc' },
  ];

  // Create indexes individually, ignoring "index already exists" errors
  for (const idx of indexes) {
    try {
      await col.createIndex(idx.key, { name: idx.name, background: true });
    } catch (err) {
      // Ignore if index already exists (code 85) or same key with different name (code 86)
      if (err.code !== 85 && err.code !== 86) {
        console.warn(`Index creation warning for ${idx.name}:`, err.message);
      }
    }
  }

  ensured.add(sig);
}
