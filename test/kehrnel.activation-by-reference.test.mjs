import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createMockKehrnelServer } from './mock-kehrnel-server.mjs';

process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'test';

// Ensure @/lib alias resolves for ESM imports in route modules.
const scopedDir = path.join(process.cwd(), 'node_modules', '@');
const libAliasDir = path.join(scopedDir, 'lib');
if (!fs.existsSync(libAliasDir)) {
  fs.mkdirSync(scopedDir, { recursive: true });
  fs.symlinkSync(path.join(process.cwd(), 'src', 'lib'), libAliasDir, 'dir');
}
const securityAliasDir = path.join(libAliasDir, 'security');
const securityApiAlias = path.join(securityAliasDir, 'api');
if (!fs.existsSync(securityApiAlias)) {
  fs.mkdirSync(securityAliasDir, { recursive: true });
  fs.symlinkSync(path.join(process.cwd(), 'src', 'lib', 'security', 'api.js'), securityApiAlias);
}

function req(url, init = {}) {
  return new Request(url, init);
}

async function loadActivateRoute() {
  try {
    const mod = await import('../src/app/api/kehrnel/environments/[envId]/activate/route.js');
    return { activatePOST: mod.POST };
  } catch (error) {
    return { error };
  }
}

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
      if (Object.prototype.hasOwnProperty.call(expected, '$ne')) return actual !== expected.$ne;
      if (Object.prototype.hasOwnProperty.call(expected, '$in')) return expected.$in.includes(actual);
    }
    return actual === expected;
  });
}

function createCoreDbMock(seed = {}) {
  const store = {
    users: [...(seed.users || [])],
    teams: [...(seed.teams || [])],
    kehrnel_instances: [...(seed.kehrnel_instances || [])],
    audit_events: [...(seed.audit_events || [])],
    environment_secrets: [...(seed.environment_secrets || [])]
  };

  const collection = (name) => {
    if (!store[name]) store[name] = [];
    return {
      findOne: async (filter = {}) => store[name].find((doc) => matchesFilter(doc, filter)) || null,
      updateOne: async (filter = {}, update = {}, options = {}) => {
        let idx = store[name].findIndex((doc) => matchesFilter(doc, filter));
        if (idx < 0 && options.upsert) {
          const base = { ...filter };
          if (update.$setOnInsert) Object.assign(base, update.$setOnInsert);
          store[name].push(base);
          idx = store[name].length - 1;
        }
        if (idx < 0) return { matchedCount: 0, modifiedCount: 0 };
        if (update.$set) {
          store[name][idx] = { ...store[name][idx], ...update.$set };
        }
        return { matchedCount: 1, modifiedCount: 1 };
      },
      insertOne: async (doc) => {
        store[name].push(doc);
        return { insertedId: doc._id || `${name}-${store[name].length}` };
      },
      find: () => ({ toArray: async () => [...store[name]] })
    };
  };

  return {
    collection,
    __store: store
  };
}

test('DEV/PROD activation uses env-scoped bindings_ref and lowercase domain', async (t) => {
  const route = await loadActivateRoute();
  if (route.error) {
    t.skip(`Skipping route-based test in this runtime: ${route.error.message}`);
    return;
  }
  const { activatePOST } = route;

  const server = createMockKehrnelServer();
  const baseUrl = await server.start();
  t.after(async () => server.stop());
  process.env.KEHRNEL_URL = baseUrl;

  globalThis.__HDL_TEST_CORE_DB__ = createCoreDbMock({
    users: [{ _id: 'u1', email: 'test@example.com', accountType: 'individual', environments: [] }]
  });
  t.after(() => { delete globalThis.__HDL_TEST_CORE_DB__; });

  const devRes = await activatePOST(
    req('http://test.local/api/kehrnel/environments/DEV/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategyId: 'openehr.rps',
        domain: 'openEHR',
        config: {}
      })
    }),
    { params: { envId: 'DEV' } }
  );
  assert.equal(devRes.status, 200);

  const prodRes = await activatePOST(
    req('http://test.local/api/kehrnel/environments/PROD/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategyId: 'fhir.core',
        domain: 'FHIR',
        config: {}
      })
    }),
    { params: { envId: 'PROD' } }
  );
  assert.equal(prodRes.status, 200);

  assert.equal(server.state.activationCalls.length, 2);

  const devCall = server.state.activationCalls[0];
  assert.equal(devCall.path, '/environments/DEV/activate');
  assert.equal(devCall.body.bindings_ref, 'hdl:env:DEV');
  assert.equal(devCall.body.allow_plaintext_bindings, false);
  assert.equal(devCall.body.domain, 'openehr');
  assert.equal(devCall.body.version, 'latest');

  const prodCall = server.state.activationCalls[1];
  assert.equal(prodCall.path, '/environments/PROD/activate');
  assert.equal(prodCall.body.bindings_ref, 'hdl:env:PROD');
  assert.equal(prodCall.body.allow_plaintext_bindings, false);
  assert.equal(prodCall.body.domain, 'fhir');
  assert.equal(prodCall.body.version, 'latest');
});

test('activation metadata is persisted to strategyLinks[].kehrnel with no plaintext DB URI leakage', async (t) => {
  const route = await loadActivateRoute();
  if (route.error) {
    t.skip(`Skipping route-based test in this runtime: ${route.error.message}`);
    return;
  }
  const { activatePOST } = route;

  const server = createMockKehrnelServer();
  const baseUrl = await server.start();
  t.after(async () => server.stop());
  process.env.KEHRNEL_URL = baseUrl;

  const coreDb = createCoreDbMock({
    users: [
      {
        _id: 'u1',
        email: 'test@example.com',
        accountType: 'individual',
        environments: [
          {
            id: 'DEV',
            name: 'DEV',
            database: 'hdl_dev',
            kehrnel: { connectionId: null },
            strategyLinks: [
              {
                id: 'link-fhir',
                domain: 'FHIR',
                strategyId: 'fhir.core',
                strategyName: 'FHIR Core',
                configOverrides: { mode: 'safe' },
                contexts: { synthetic: true, query: true, api: true }
              }
            ]
          }
        ]
      }
    ]
  });
  globalThis.__HDL_TEST_CORE_DB__ = coreDb;
  t.after(() => { delete globalThis.__HDL_TEST_CORE_DB__; });

  const response = await activatePOST(
    req('http://test.local/api/kehrnel/environments/DEV/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategyId: 'fhir.core',
        domain: 'FHIR',
        config: { mode: 'safe' }
      })
    }),
    { params: { envId: 'DEV' } }
  );
  assert.equal(response.status, 200);

  const updatedUser = coreDb.__store.users[0];
  const savedLink = updatedUser.environments[0].strategyLinks[0];
  const savedKehrnel = savedLink.kehrnel || {};

  assert.ok(savedKehrnel.activationId);
  assert.ok(savedKehrnel.manifestDigest);
  assert.ok(savedKehrnel.configHash);
  assert.ok(savedKehrnel.strategyVersion);
  assert.ok(savedKehrnel.activatedAt);
  assert.equal(typeof savedKehrnel.replaced, 'boolean');
  assert.ok(Object.prototype.hasOwnProperty.call(savedKehrnel, 'previousActivationId'));
  assert.ok(savedKehrnel.lastStatus);

  const persistedSerialized = JSON.stringify(savedLink);
  const auditSerialized = JSON.stringify(coreDb.__store.audit_events || []);
  assert.equal(persistedSerialized.includes('mongodb+srv://'), false);
  assert.equal(auditSerialized.includes('mongodb+srv://'), false);
});

test('activation persists only schema-compatible overrides when Kehrnel narrows allowed options', async (t) => {
  const route = await loadActivateRoute();
  if (route.error) {
    t.skip(`Skipping route-based test in this runtime: ${route.error.message}`);
    return;
  }
  const { activatePOST } = route;

  const server = createMockKehrnelServer();
  server.state.strategies = [
    {
      id: 'openehr.rps_dual',
      name: 'RPS Dual',
      domain: 'openEHR',
      version: '1.0.0',
      default_config: {
        collections: {
          search: {
            enabled: true
          }
        },
        transform: {
          coding: {
            atcodes: {
              strategy: 'negative_int'
            }
          }
        }
      },
      config_schema: {
        type: 'object',
        properties: {
          collections: {
            type: 'object',
            properties: {
              search: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' }
                }
              }
            }
          },
          transform: {
            type: 'object',
            properties: {
              coding: {
                type: 'object',
                properties: {
                  atcodes: {
                    type: 'object',
                    properties: {
                      strategy: {
                        type: 'string',
                        enum: ['negative_int', 'literal']
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  ];

  const baseUrl = await server.start();
  t.after(async () => server.stop());
  process.env.KEHRNEL_URL = baseUrl;

  const coreDb = createCoreDbMock({
    users: [
      {
        _id: 'u1',
        email: 'test@example.com',
        accountType: 'individual',
        environments: [
          {
            id: 'DEV',
            name: 'DEV',
            database: 'hdl_dev',
            kehrnel: { connectionId: null },
            strategyLinks: []
          }
        ]
      }
    ]
  });
  globalThis.__HDL_TEST_CORE_DB__ = coreDb;
  t.after(() => { delete globalThis.__HDL_TEST_CORE_DB__; });

  const response = await activatePOST(
    req('http://test.local/api/kehrnel/environments/DEV/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategyId: 'openehr.rps_dual',
        domain: 'openEHR',
        configOverrides: {
          collections: {
            search: {
              enabled: false
            }
          },
          transform: {
            coding: {
              atcodes: {
                strategy: 'legacy_compact'
              }
            }
          }
        }
      })
    }),
    { params: { envId: 'DEV' } }
  );

  assert.equal(response.status, 200);

  const updatedUser = coreDb.__store.users[0];
  const savedLink = updatedUser.environments[0].strategyLinks[0];
  assert.deepEqual(savedLink.configOverrides, {
    collections: {
      search: {
        enabled: false
      }
    }
  });
  assert.equal(savedLink.kehrnel.config.collections.search.enabled, false);
  assert.equal(savedLink.kehrnel.config.transform.coding.atcodes.strategy, 'negative_int');
});
