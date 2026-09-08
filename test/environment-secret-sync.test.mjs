import { test } from 'node:test';
import assert from 'node:assert/strict';

const { syncEnvironmentSecrets } = await import('../src/lib/environments/syncSecrets.js');

function getPath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function matchesFilter(doc, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = getPath(doc, key);
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (Object.prototype.hasOwnProperty.call(expected, '$in')) {
        return expected.$in.includes(actual);
      }
      if (Object.prototype.hasOwnProperty.call(expected, '$exists')) {
        return expected.$exists ? actual !== undefined : actual === undefined;
      }
    }
    return actual === expected;
  });
}

function createCoreDbMock(seed = {}) {
  const store = {
    environment_secrets: [...(seed.environment_secrets || [])]
  };

  return {
    __store: store,
    collection(name) {
      if (!store[name]) store[name] = [];
      return {
        updateOne: async (filter = {}, update = {}, options = {}) => {
          const index = store[name].findIndex((doc) => matchesFilter(doc, filter));
          if (index >= 0) {
            store[name][index] = {
              ...store[name][index],
              ...(update.$set || {})
            };
            return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
          }

          if (!options?.upsert) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };

          store[name].push({
            envId: filter.envId,
            ...(update.$setOnInsert || {}),
            ...(update.$set || {})
          });
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        },
        deleteOne: async (filter = {}) => {
          const index = store[name].findIndex((doc) => matchesFilter(doc, filter));
          if (index >= 0) {
            store[name].splice(index, 1);
            return { deletedCount: 1 };
          }
          return { deletedCount: 0 };
        },
        deleteMany: async (filter = {}) => {
          const before = store[name].length;
          store[name] = store[name].filter((doc) => !matchesFilter(doc, filter));
          return { deletedCount: before - store[name].length };
        }
      };
    }
  };
}

test('syncEnvironmentSecrets upserts sealed secrets for saved environments', async () => {
  const coreDb = createCoreDbMock();
  const ownerScope = { mode: 'individual', user: { _id: 'user-1' } };

  await syncEnvironmentSecrets(coreDb, ownerScope, [
    { id: 'env-1', sealedUri: { v: 1, iv: 'a', ct: 'b', tag: 'c' } },
    { id: 'env-2', sealedUri: { v: 1, iv: 'd', ct: 'e', tag: 'f' } }
  ]);

  assert.equal(coreDb.__store.environment_secrets.length, 2);
  assert.deepEqual(
    coreDb.__store.environment_secrets.map((doc) => [doc.envId, doc.ownerType, doc.ownerId]).sort(),
    [
      ['env-1', 'user', 'user-1'],
      ['env-2', 'user', 'user-1']
    ]
  );
});

test('syncEnvironmentSecrets rewrites legacy unscoped secrets into owner-scoped rows', async () => {
  const coreDb = createCoreDbMock({
    environment_secrets: [
      { envId: 'env-1', sealedUri: { v: 1, iv: 'old' } }
    ]
  });

  await syncEnvironmentSecrets(
    coreDb,
    { mode: 'team', team: { _id: 'team-1' } },
    [{ id: 'env-1', sealedUri: { v: 1, iv: 'new' } }]
  );

  assert.deepEqual(
    coreDb.__store.environment_secrets.map((doc) => [doc.envId, doc.ownerType, doc.ownerId, doc.sealedUri.iv]),
    [['env-1', 'team', 'team-1', 'new']]
  );
});

test('syncEnvironmentSecrets removes secret rows for deleted environments', async () => {
  const coreDb = createCoreDbMock({
    environment_secrets: [
      { envId: 'env-keep', ownerType: 'team', ownerId: 'team-1', sealedUri: { v: 1 } },
      { envId: 'env-drop', ownerType: 'team', ownerId: 'team-1', sealedUri: { v: 1 } }
    ]
  });

  await syncEnvironmentSecrets(
    coreDb,
    { mode: 'team', team: { _id: 'team-1' } },
    [{ id: 'env-keep', sealedUri: { v: 1, iv: 'new' } }],
    [{ id: 'env-keep' }, { id: 'env-drop' }]
  );

  assert.deepEqual(coreDb.__store.environment_secrets.map((doc) => doc.envId), ['env-keep']);
  assert.equal(coreDb.__store.environment_secrets[0].sealedUri.iv, 'new');
});
