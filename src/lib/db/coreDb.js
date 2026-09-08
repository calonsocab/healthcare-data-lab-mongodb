// src/lib/db/coreDb.js

export async function getCoreDb() {
  if (process.env.TEST_MODE === 'true') {
    if (globalThis.__HDL_TEST_CORE_DB__) {
      return globalThis.__HDL_TEST_CORE_DB__;
    }
    // Minimal stub for tests to avoid real DB connections
    return {
      collection: () => ({
        findOne: async () => null,
        updateMany: async () => ({}),
        deleteOne: async () => ({ deletedCount: 1 }),
        updateOne: async () => ({}),
        find: () => ({ toArray: async () => [] })
      })
    };
  }
  const uri = process.env.CORE_MONGODB_URL;
  const dbName = process.env.CORE_DATABASE_NAME || 'openehr_core';
  if (!uri) throw new Error('CORE_MONGODB_URL is not set');
  const { getDb } = await import('./connectionManager');
  return getDb({ uri, dbName });
}
