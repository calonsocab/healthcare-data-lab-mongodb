import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  findEnvironmentSecretDoc,
  listEnvironmentSecretDocs,
  buildEnvironmentSecretFilter
} = await import('../src/lib/environments/secretScope.js');

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
    collection(name) {
      return {
        findOne: async (filter = {}) => store[name].find((doc) => matchesFilter(doc, filter)) || null,
        find: (filter = {}) => ({
          toArray: async () => store[name].filter((doc) => matchesFilter(doc, filter))
        })
      };
    }
  };
}

test('buildEnvironmentSecretFilter uses team ownership for shared environments', () => {
  assert.deepEqual(
    buildEnvironmentSecretFilter(
      { mode: 'team', user: { teamId: 'team-1' }, team: { _id: 'team-1' } },
      'env-1'
    ),
    { envId: 'env-1', ownerType: 'team', ownerId: 'team-1' }
  );
});

test('findEnvironmentSecretDoc prefers scoped rows and falls back to legacy rows for the same owner env', async () => {
  const coreDb = createCoreDbMock({
    environment_secrets: [
      { envId: 'env-scoped', ownerType: 'user', ownerId: 'user-1', sealedUri: { v: 1, iv: 'scoped' } },
      { envId: 'env-legacy', sealedUri: { v: 1, iv: 'legacy' } },
      { envId: 'env-other', ownerType: 'team', ownerId: 'team-2', sealedUri: { v: 1, iv: 'other' } }
    ]
  });

  const ownerScope = { mode: 'individual', user: { _id: 'user-1' } };
  const scopedDoc = await findEnvironmentSecretDoc(coreDb, ownerScope, 'env-scoped');
  const legacyDoc = await findEnvironmentSecretDoc(coreDb, ownerScope, 'env-legacy');
  const foreignDoc = await findEnvironmentSecretDoc(coreDb, ownerScope, 'env-other');

  assert.equal(scopedDoc?.sealedUri?.iv, 'scoped');
  assert.equal(legacyDoc?.sealedUri?.iv, 'legacy');
  assert.equal(foreignDoc, null);
});

test('listEnvironmentSecretDocs only returns rows for the current owner plus legacy fallback rows', async () => {
  const coreDb = createCoreDbMock({
    environment_secrets: [
      { envId: 'env-1', ownerType: 'team', ownerId: 'team-1', sealedUri: { v: 1 } },
      { envId: 'env-2', sealedUri: { v: 1 } },
      { envId: 'env-3', ownerType: 'team', ownerId: 'team-2', sealedUri: { v: 1 } }
    ]
  });

  const docs = await listEnvironmentSecretDocs(
    coreDb,
    { mode: 'team', team: { _id: 'team-1' } },
    ['env-1', 'env-2', 'env-3']
  );

  assert.deepEqual(
    docs.map((doc) => doc.envId).sort(),
    ['env-1', 'env-2']
  );
});
