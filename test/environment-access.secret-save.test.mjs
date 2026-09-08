import { test } from 'node:test';
import assert from 'node:assert/strict';

const { findAccessibleEnvironment, loadEnvironmentScope } = await import('../src/lib/environments/access.js');

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
    }
    return actual === expected;
  });
}

function createCoreDbMock(seed = {}) {
  const store = {
    users: [...(seed.users || [])],
    teams: [...(seed.teams || [])],
    environment_secrets: [...(seed.environment_secrets || [])]
  };

  return {
    collection(name) {
      if (!store[name]) store[name] = [];
      return {
        findOne: async (filter = {}) => store[name].find((doc) => matchesFilter(doc, filter)) || null
      };
    }
  };
}

test('findAccessibleEnvironment resolves an individual environment without requiring a saved secret row', async () => {
  const coreDb = createCoreDbMock({
    users: [
      {
        email: 'test@example.com',
        accountType: 'individual',
        environments: [
          { id: 'env-new', name: 'New Environment', database: 'hdl_dev', isActive: true }
        ]
      }
    ]
  });

  const result = await findAccessibleEnvironment(coreDb, 'test@example.com', 'env-new');

  assert.equal(result.mode, 'individual');
  assert.equal(result.environment?.id, 'env-new');
  assert.equal(result.environment?.database, 'hdl_dev');
});

test('findAccessibleEnvironment resolves team environments from the team record', async () => {
  const coreDb = createCoreDbMock({
    users: [
      {
        email: 'owner@example.com',
        accountType: 'team',
        teamId: 'team-1',
        environments: []
      }
    ],
    teams: [
      {
        _id: 'team-1',
        environments: [
          { id: 'env-team', name: 'Team Environment', database: 'team_db', isActive: true }
        ]
      }
    ]
  });

  const result = await findAccessibleEnvironment(coreDb, 'owner@example.com', 'env-team');

  assert.equal(result.mode, 'team');
  assert.equal(result.environment?.id, 'env-team');
  assert.equal(result.environment?.database, 'team_db');
});

test('loadEnvironmentScope returns no environments for unknown users', async () => {
  const coreDb = createCoreDbMock();

  const result = await loadEnvironmentScope(coreDb, 'missing@example.com');

  assert.equal(result.mode, 'none');
  assert.deepEqual(result.environments, []);
  assert.equal(result.user, null);
});
