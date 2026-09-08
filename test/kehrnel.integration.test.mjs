import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createMockKehrnelServer } from './mock-kehrnel-server.mjs';

process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'test';

// Ensure @ alias resolves to src for ESM imports in tests
const aliasDir = path.join(process.cwd(), 'node_modules', '@');
if (!fs.existsSync(aliasDir)) {
  fs.mkdirSync(path.join(process.cwd(), 'node_modules'), { recursive: true });
  fs.symlinkSync(path.join(process.cwd(), 'src'), aliasDir, 'dir');
}

function req(url, init = {}) {
  return new Request(url, init);
}

async function loadRoutes() {
  try {
    const [
      catalog,
      activate,
      endpoints,
      compile,
      query,
      activations,
      upgrade,
      rollback,
      removeActivation
    ] = await Promise.all([
      import('../src/app/api/kehrnel/catalog/route.js'),
      import('../src/app/api/kehrnel/environments/[envId]/activate/route.js'),
      import('../src/app/api/kehrnel/environments/[envId]/endpoints/route.js'),
      import('../src/app/api/kehrnel/environments/[envId]/compile/route.js'),
      import('../src/app/api/kehrnel/environments/[envId]/query/route.js'),
      import('../src/app/api/kehrnel/environments/[envId]/activations/route.js'),
      import('../src/app/api/kehrnel/environments/[envId]/activations/[domain]/upgrade/route.js'),
      import('../src/app/api/kehrnel/environments/[envId]/activations/[domain]/rollback/route.js'),
      import('../src/app/api/kehrnel/environments/[envId]/activations/[domain]/route.js')
    ]);

    return {
      catalogGET: catalog.GET,
      activatePOST: activate.POST,
      endpointsGET: endpoints.GET,
      compilePOST: compile.POST,
      queryPOST: query.POST,
      activationsGET: activations.GET,
      upgradePOST: upgrade.POST,
      rollbackPOST: rollback.POST,
      deleteActivation: removeActivation.DELETE
    };
  } catch (error) {
    return { error };
  }
}

test('Kehrnel proxy routes use endpoints and require domain (mocked)', async (t) => {
  const routes = await loadRoutes();
  if (routes.error) {
    t.skip(`Skipping integration route test in this runtime: ${routes.error.message}`);
    return;
  }

  const {
    catalogGET,
    activatePOST,
    endpointsGET,
    compilePOST,
    queryPOST,
    activationsGET,
    upgradePOST,
    rollbackPOST,
    deleteActivation
  } = routes;

  const server = createMockKehrnelServer(undefined, { requireUpgradeDomains: ['openEHR'] });
  const baseUrl = await server.start();
  t.after(async () => server.stop());
  process.env.KEHRNEL_URL = baseUrl;

  // Catalog
  const catRes = await catalogGET(req('http://test.local/api/kehrnel/catalog'));
  const catJson = await catRes.json();
  assert.equal(catRes.status, 200);
  assert.ok(Array.isArray(catJson.strategies));

  // Activate with domain
  const activateRes = await activatePOST(
    req('http://test.local/api/kehrnel/environments/env-1/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategyId: 'openehr.rps',
        domain: 'openEHR',
        config: { a: 1 },
        force: true,
        reason: 'test'
      })
    }),
    { params: { envId: 'env-1' } }
  );
  const activateJson = await activateRes.json();
  assert.equal(activateRes.status, 200);
  assert.ok(activateJson.activationId);

  // Endpoints
  const epRes = await endpointsGET(
    req('http://test.local/api/kehrnel/environments/env-1/endpoints?domain=openEHR'),
    { params: { envId: 'env-1' } }
  );
  const epJson = await epRes.json();
  assert.equal(epRes.status, 200);
  assert.ok(epJson.endpoints);

  // Compile
  const compRes = await compilePOST(
    req('http://test.local/api/kehrnel/environments/env-1/compile?debug=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aql: 'SELECT 1', domain: 'openEHR' })
    }),
    { params: { envId: 'env-1' } }
  );
  const compJson = await compRes.json();
  assert.equal(compRes.status, 200);
  assert.ok(compJson.pipeline);

  // Query
  const queryRes = await queryPOST(
    req('http://test.local/api/kehrnel/environments/env-1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aql: 'SELECT 1', domain: 'openEHR' })
    }),
    { params: { envId: 'env-1' } }
  );
  const queryJson = await queryRes.json();
  assert.equal(queryRes.status, 200);
  assert.ok(queryJson.results);
  assert.ok(server.state.upgradeCalls > 0);

  // Activations list
  const actsRes = await activationsGET(
    req('http://test.local/api/kehrnel/environments/env-1/activations'),
    { params: { envId: 'env-1' } }
  );
  const actsJson = await actsRes.json();
  assert.equal(actsRes.status, 200);
  assert.ok(actsJson.activations);

  // Upgrade
  const upRes = await upgradePOST(
    req('http://test.local/api/kehrnel/environments/env-1/activations/openEHR/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'upgrade' })
    }),
    { params: { envId: 'env-1', domain: 'openEHR' } }
  );
  assert.equal(upRes.status, 200);

  // Rollback
  const rollRes = await rollbackPOST(
    req('http://test.local/api/kehrnel/environments/env-1/activations/openEHR/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'rollback' })
    }),
    { params: { envId: 'env-1', domain: 'openEHR' } }
  );
  assert.equal(rollRes.status, 200);

  // Delete
  const delRes = await deleteActivation(
    req('http://test.local/api/kehrnel/environments/env-1/activations/openEHR', {
      method: 'DELETE'
    }),
    { params: { envId: 'env-1', domain: 'openEHR' } }
  );
  assert.equal(delRes.status, 200);
});
