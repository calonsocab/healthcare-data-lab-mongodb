import { test } from 'node:test';
import assert from 'node:assert/strict';

const { KehrnelService } = await import('../src/lib/kehrnel/KehrnelService.js');

function createServiceWithStubs(endpoints) {
  const svc = new KehrnelService({
    collection: () => ({
      findOne: async () => ({ url: 'http://runtime.local' })
    })
  });

  svc.resolveConnection = async () => ({
    url: 'http://runtime.local',
    apiKey: 'key',
    connectionId: 'conn-1'
  });

  svc.resolveEndpoints = async () => endpoints;

  return svc;
}

test('compile/query/op require domain and use endpoint descriptors', async () => {
  const endpoints = {
    compile_query: { url: 'http://runtime.local/compile', method: 'POST' },
    query: { url: 'http://runtime.local/query', method: 'POST' },
    ops: { url: 'http://runtime.local/ops', method: 'POST' }
  };
  const svc = createServiceWithStubs(endpoints);

  // domain required
  await assert.rejects(() => svc.compileQuery('env-1', 'SELECT 1'), /domain is required/);
  await assert.rejects(() => svc.query('env-1', 'SELECT 1'), /domain is required/);
  await assert.rejects(() => svc.runOp('env-1', 'strategy', 'ping', {}), /domain is required/);

  let called = [];
  svc._fetch = async (url, opts) => {
    called.push({ url, opts });
    return { ok: true };
  };

  await svc.compileQuery('env-1', 'SELECT 1', { domain: 'openEHR' });
  await svc.query('env-1', 'SELECT 1', { domain: 'openEHR' });
  await svc.runOp('env-1', 'strategy', 'ping', { payload: true }, { domain: 'openEHR' });

  assert.equal(called[0].url, 'http://runtime.local/compile');
  assert.deepEqual(called[0].opts.body, { aql: 'SELECT 1' });
  assert.equal(called[1].url, 'http://runtime.local/query');
  assert.deepEqual(called[1].opts.body, { aql: 'SELECT 1' });
  assert.equal(called[2].url, 'http://runtime.local/ops/ping');
  assert.deepEqual(called[2].opts.body, { payload: true });
});

test('getStrategy caches manifests per connection unless forceRefresh is requested', async () => {
  const svc = createServiceWithStubs({});
  let fetchCalls = 0;

  svc._fetch = async (url) => {
    fetchCalls += 1;
    assert.equal(url, 'http://runtime.local/strategies/openehr.rps_dual');
    return { id: 'openehr.rps_dual', version: fetchCalls };
  };

  const first = await svc.getStrategy('openehr.rps_dual');
  const second = await svc.getStrategy('openehr.rps_dual');
  const refreshed = await svc.getStrategy('openehr.rps_dual', { forceRefresh: true });

  assert.equal(fetchCalls, 2);
  assert.equal(first.version, 1);
  assert.equal(second.version, 1);
  assert.equal(refreshed.version, 2);
});

test('runtime calls retry once with legacy envelope when an older Kehrnel requires domain in-body', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile', method: 'POST' },
    query: { url: 'http://runtime.local/query', method: 'POST' },
    ops: { url: 'http://runtime.local/environments/{env_id}/activations/{domain}/ops', method: 'POST' }
  });

  const calls = [];

  svc._fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (!opts?.body?.domain) {
      const err = new Error('domain missing');
      err.status = 400;
      err.code = 'DOMAIN_REQUIRED';
      throw err;
    }
    return { ok: true };
  };

  await svc.compileQuery('DEV', 'SELECT 1', { domain: 'openEHR' });
  await svc.query('DEV', 'SELECT 1', { domain: 'openEHR' });
  await svc.runOp('DEV', 'openehr.rps_dual', 'ensure_dictionaries', { force: true }, { domain: 'openEHR' });

  assert.equal(calls.length, 6);
  assert.deepEqual(calls[0].opts.body, { aql: 'SELECT 1' });
  assert.deepEqual(calls[1].opts.body, { aql: 'SELECT 1', environment: 'DEV', domain: 'openehr' });
  assert.deepEqual(calls[2].opts.body, { aql: 'SELECT 1' });
  assert.deepEqual(calls[3].opts.body, { aql: 'SELECT 1', environment: 'DEV', domain: 'openehr' });
  assert.deepEqual(calls[4].opts.body, { force: true });
  assert.deepEqual(calls[5].opts.body, { force: true, environment: 'DEV', domain: 'openehr' });
});

test('compile/query forward active environment headers to Kehrnel runtime endpoints', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile', method: 'POST' },
    query: { url: 'http://runtime.local/query', method: 'POST' },
    ops: { url: 'http://runtime.local/ops', method: 'POST' }
  });

  const calls = [];

  svc._fetch = async (url, opts) => {
    calls.push({ url, opts });
    return url.includes('/compile')
      ? { pipeline: [] }
      : { results: [] };
  };

  await svc.compileQuery('ENV-1', 'SELECT 1', { domain: 'openEHR' });
  await svc.query('ENV-1', 'SELECT 1', { domain: 'openEHR' });

  assert.equal(calls[0].opts.headers['x-active-env'], 'ENV-1');
  assert.equal(calls[0].opts.headers['x-kehrnel-env'], 'ENV-1');
  assert.equal(calls[0].opts.headers['x-kehrnel-domain'], 'openehr');
  assert.equal(calls[1].opts.headers['x-active-env'], 'ENV-1');
  assert.equal(calls[1].opts.headers['x-kehrnel-env'], 'ENV-1');
  assert.equal(calls[1].opts.headers['x-kehrnel-domain'], 'openehr');
});

test('endpoint picker tolerates array descriptors and aliases', async () => {
  const svc = createServiceWithStubs([
    { name: 'aql_compile', url: 'http://runtime.local/c', method: 'POST' },
    { name: 'aql_query', url: 'http://runtime.local/q' },
    { name: 'extensions', url: 'http://runtime.local/x' }
  ]);

  let lastUrl = '';
  svc._fetch = async (url) => { lastUrl = url; return {}; };

  await svc.compileQuery('env', 'SELECT 1', { domain: 'fhir' });
  assert.equal(lastUrl, 'http://runtime.local/c');

  await svc.query('env', 'SELECT 1', { domain: 'fhir' });
  assert.equal(lastUrl, 'http://runtime.local/q');

  await svc.runOp('env', 'strategy', 'op', {}, { domain: 'fhir' });
  assert.equal(lastUrl, 'http://runtime.local/x/op');
});

test('validate endpoints throws when required kinds are missing', async () => {
  const svc = createServiceWithStubs({ query: { url: 'http://runtime.local/q' } });
  assert.throws(
    () => svc._validateEndpoints({ query: { url: 'http://runtime.local/q' } }),
    (err) => err.code === 'KEHRNEL_ENDPOINTS_INVALID' && err.details?.missingKinds?.includes('compile_query')
  );
});

test('compile retries once after upgrade on 409', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/ops' },
    activate: { url: 'http://runtime.local/activate' },
    activations: { url: 'http://runtime.local/activations' }
  });

  let compileCalls = 0;
  let upgradeCalls = 0;
  svc.upgradeActivation = async () => { upgradeCalls += 1; return { upgraded: true }; };
  svc.resolveEndpoints = async () => ({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/ops' },
    activate: { url: 'http://runtime.local/activate' },
    activations: { url: 'http://runtime.local/activations' }
  });
  svc.resolveConnection = async () => ({
    url: 'http://runtime.local',
    apiKey: 'key',
    connectionId: 'conn-1'
  });
  svc._fetch = async (url) => {
    if (url.includes('/compile') && compileCalls === 0) {
      compileCalls += 1;
      const err = new Error('digest mismatch');
      err.status = 409;
      err.code = 'ACTIVATION_STRATEGY_MISMATCH';
      throw err;
    }
    compileCalls += 1;
    return { pipeline: [] };
  };

  const result = await svc.compileQuery('env-1', 'SELECT 1', { domain: 'openEHR' });
  assert.ok(result.pipeline);
  assert.equal(upgradeCalls, 1);
  assert.equal(compileCalls, 2);
});

test('compile surfaces the recovery failure when auto-upgrade cannot complete', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/ops' },
    activations: { url: 'http://runtime.local/activations' }
  });

  svc.upgradeActivation = async () => {
    const err = new Error('admin access required');
    err.status = 403;
    err.code = 'ADMIN_ACCESS_REQUIRED';
    err.details = { hint: 'Use an admin API key to upgrade activations.' };
    throw err;
  };

  svc._fetch = async (url) => {
    if (url.includes('/compile')) {
      const err = new Error('digest mismatch');
      err.status = 409;
      err.code = 'ACTIVATION_STRATEGY_MISMATCH';
      err.details = {
        expected_digest: 'sha-old',
        actual_digest: 'sha-new'
      };
      throw err;
    }
    return {};
  };

  await assert.rejects(
    () => svc.compileQuery('env-1', 'SELECT 1', { domain: 'openEHR' }),
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.code, 'ADMIN_ACCESS_REQUIRED');
      assert.equal(err.details.recoveryStep, 'upgradeActivation');
      assert.equal(err.details.originalError.code, 'ACTIVATION_STRATEGY_MISMATCH');
      assert.equal(err.details.originalError.status, 409);
      return true;
    }
  );
});

test('compile auto-activates and retries on ACTIVATION_NOT_FOUND', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/ops' },
    activations: { url: 'http://runtime.local/activations' }
  });

  let compileCalls = 0;
  let activateCalls = 0;

  svc.activateEnvironment = async () => {
    activateCalls += 1;
    return { activationId: 'act-1', status: 'ok' };
  };

  svc._fetch = async (url) => {
    if (url.includes('/compile') && compileCalls === 0) {
      compileCalls += 1;
      const err = new Error('activation missing');
      err.status = 404;
      err.code = 'ACTIVATION_NOT_FOUND';
      throw err;
    }
    compileCalls += 1;
    return { pipeline: [{ $match: {} }] };
  };

  const result = await svc.compileQuery('env-dev', 'SELECT 1', {
    domain: 'fhir',
    autoActivate: {
      strategyId: 'fhir.core',
      config: { mode: 'test' }
    }
  });

  assert.ok(Array.isArray(result.pipeline));
  assert.equal(activateCalls, 1);
  assert.equal(compileCalls, 2);
});

test('compile pre-activates when the current activation strategy differs from the selected binding', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/ops' },
    activations: { url: 'http://runtime.local/activations' }
  });

  const activationCalls = [];
  let compileCalls = 0;

  svc.listActivations = async () => ({
    activations: [
      {
        domain: 'openehr',
        strategy_id: 'openehr.core',
        config_hash: 'cfg-old'
      }
    ]
  });

  svc.activateEnvironment = async (...args) => {
    activationCalls.push(args);
    return { activationId: 'act-2', status: 'ok' };
  };

  svc._fetch = async (url) => {
    if (url.includes('/compile')) {
      compileCalls += 1;
      return { pipeline: [{ $match: { ok: true } }] };
    }
    return {};
  };

  const result = await svc.compileQuery('env-dev', 'SELECT 1', {
    domain: 'openEHR',
    autoActivate: {
      strategyId: 'openehr.rps_dual',
      config: { mode: 'dual' },
      configHash: 'cfg-new'
    }
  });

  assert.ok(Array.isArray(result.pipeline));
  assert.equal(compileCalls, 1);
  assert.equal(activationCalls.length, 1);
  assert.equal(activationCalls[0][0], 'env-dev');
  assert.equal(activationCalls[0][1], 'openehr.rps_dual');
  assert.deepEqual(activationCalls[0][2], { mode: 'dual' });
  assert.equal(activationCalls[0][3].domain, 'openehr');
  assert.equal(activationCalls[0][3].force, true);
});

test('query pre-activates when the activation hash differs from the selected binding', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/ops' },
    activations: { url: 'http://runtime.local/activations' }
  });

  let activationCalls = 0;
  let queryCalls = 0;

  svc.listActivations = async () => ({
    activations: [
      {
        domain: 'openehr',
        strategy_id: 'openehr.rps_dual',
        config_hash: 'cfg-old'
      }
    ]
  });

  svc.activateEnvironment = async () => {
    activationCalls += 1;
    return { activationId: 'act-3', status: 'ok' };
  };

  svc._fetch = async (url) => {
    if (url.includes('/query')) {
      queryCalls += 1;
      return { results: [{ ok: true }] };
    }
    return {};
  };

  const result = await svc.query('env-dev', 'SELECT 1', {
    domain: 'openEHR',
    autoActivate: {
      strategyId: 'openehr.rps_dual',
      config: { shortcuts: true },
      configHash: 'cfg-new'
    }
  });

  assert.ok(Array.isArray(result.results));
  assert.equal(queryCalls, 1);
  assert.equal(activationCalls, 1);
});

test('compile ensures dictionaries before translating coded RPS queries', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/environments/{env_id}/activations/{domain}/ops' },
    activations: { url: 'http://runtime.local/activations' }
  });

  const calledUrls = [];

  svc.listActivations = async () => ({
    activations: [
      {
        domain: 'openehr',
        strategy_id: 'openehr.rps_dual'
      }
    ]
  });

  svc._fetch = async (url) => {
    calledUrls.push(url);
    if (url.includes('/compile')) {
      return { pipeline: [{ $match: { tid: 1 } }] };
    }
    return { ok: true };
  };

  const result = await svc.compileQuery('DEV-UNSUPPORTED', 'SELECT 1', {
    domain: 'openEHR',
    autoActivate: {
      strategyId: 'openehr.rps_dual',
      config: {
        coding: {
          archetype_ids: { enabled: true },
          atcodes: { enabled: true }
        },
        dictionaries: {
          shortcuts: { enabled: true },
          arcodes: { enabled: true }
        }
      }
    }
  });

  assert.ok(Array.isArray(result.pipeline));
  assert.deepEqual(calledUrls, [
    'http://runtime.local/environments/DEV-UNSUPPORTED/activations/openehr/ops/ensure_dictionaries',
    'http://runtime.local/compile'
  ]);
});

test('compile reuses activation readiness cache across repeated calls', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/environments/{env_id}/activations/{domain}/ops' },
    activations: { url: 'http://runtime.local/activations' }
  });

  let activationChecks = 0;
  let compileCalls = 0;

  svc.listActivations = async () => {
    activationChecks += 1;
    return {
      activations: [
        {
          domain: 'openehr',
          strategy_id: 'openehr.rps_dual',
          config_hash: 'cfg-ready',
          manifest_digest: 'manifest-ready'
        }
      ]
    };
  };

  svc._fetch = async (url) => {
    if (url.includes('/compile')) {
      compileCalls += 1;
      return { pipeline: [{ $match: { ok: true } }] };
    }
    return { ok: true };
  };

  await svc.compileQuery('DEV', 'SELECT 1', {
    domain: 'openEHR',
    autoActivate: {
      strategyId: 'openehr.rps_dual',
      config: { mode: 'dual' },
      configHash: 'cfg-ready',
      manifestDigest: 'manifest-ready'
    }
  });

  await svc.compileQuery('DEV', 'SELECT 1', {
    domain: 'openEHR',
    autoActivate: {
      strategyId: 'openehr.rps_dual',
      config: { mode: 'dual' },
      configHash: 'cfg-ready',
      manifestDigest: 'manifest-ready'
    }
  });

  assert.equal(activationChecks, 1);
  assert.equal(compileCalls, 2);
});

test('ensureRuntimeReady pre-activates and seeds dictionaries for coded RPS runtimes', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/environments/{env_id}/activations/{domain}/ops' },
    activations: { url: 'http://runtime.local/activations' }
  });

  const activationCalls = [];
  const calledUrls = [];

  svc.listActivations = async () => ({
    activations: [
      {
        domain: 'openehr',
        strategy_id: 'openehr.core',
        config_hash: 'cfg-old'
      }
    ]
  });

  svc.activateEnvironment = async (...args) => {
    activationCalls.push(args);
    return { activationId: 'act-4', status: 'ok' };
  };

  svc._fetch = async (url) => {
    calledUrls.push(url);
    return { ok: true };
  };

  const result = await svc.ensureRuntimeReady('DEV', {
    domain: 'openEHR',
    autoActivate: {
      strategyId: 'openehr.rps_dual',
      config: {
        transform: {
          apply_shortcuts: true,
          coding: {
            arcodes: { strategy: 'sequential' },
            atcodes: { strategy: 'negative_int' }
          }
        },
        collections: {
          codes: { name: '_codes' },
          shortcuts: { name: '_shortcuts' }
        }
      },
      configHash: 'cfg-new'
    }
  });

  assert.equal(result.activated, true);
  assert.equal(result.dictionariesEnsured, true);
  assert.equal(activationCalls.length, 1);
  assert.equal(activationCalls[0][1], 'openehr.rps_dual');
  assert.deepEqual(calledUrls, [
    'http://runtime.local/environments/DEV/activations/openehr/ops/ensure_dictionaries'
  ]);
});

test('ensureRuntimeReady upgrades a stale activation before retrying ensure_dictionaries', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/environments/{env_id}/activations/{domain}/ops' },
    activations: { url: 'http://runtime.local/activations' }
  });

  let upgradeCalls = 0;
  const calledUrls = [];

  svc.listActivations = async () => ({
    activations: [
      {
        domain: 'openehr',
        strategy_id: 'openehr.rps_dual'
      }
    ]
  });

  svc.upgradeActivation = async () => {
    upgradeCalls += 1;
    return { activationId: 'act-upgraded', status: 'ok' };
  };

  svc._fetch = async (url) => {
    calledUrls.push(url);
    if (url.includes('/ensure_dictionaries') && upgradeCalls === 0) {
      const err = new Error('digest mismatch');
      err.status = 409;
      err.code = 'ACTIVATION_STRATEGY_MISMATCH';
      err.details = {
        expected_digest: 'sha-old',
        actual_digest: 'sha-new'
      };
      throw err;
    }
    return { ok: true };
  };

  const result = await svc.ensureRuntimeReady('DEV', {
    domain: 'openEHR',
    autoActivate: {
      strategyId: 'openehr.rps_dual',
      config: {
        coding: {
          archetype_ids: { enabled: true }
        }
      }
    }
  });

  assert.equal(result.activated, false);
  assert.equal(result.dictionariesEnsured, true);
  assert.equal(upgradeCalls, 1);
  assert.deepEqual(calledUrls, [
    'http://runtime.local/environments/DEV/activations/openehr/ops/ensure_dictionaries',
    'http://runtime.local/environments/DEV/activations/openehr/ops/ensure_dictionaries'
  ]);
});

test('compile ignores unsupported ensure_dictionaries op and still executes', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/environments/{env_id}/activations/{domain}/ops' },
    activations: { url: 'http://runtime.local/activations' }
  });

  const calledUrls = [];

  svc.listActivations = async () => ({
    activations: [
      {
        domain: 'openehr',
        strategy_id: 'openehr.rps_dual'
      }
    ]
  });

  svc._fetch = async (url) => {
    calledUrls.push(url);
    if (url.includes('/ensure_dictionaries')) {
      const err = new Error('ensure_dictionaries unsupported for this runtime');
      err.status = 400;
      err.code = 'UNKNOWN_OPERATION';
      throw err;
    }
    if (url.includes('/compile')) {
      return { pipeline: [{ $match: { tid: 1 } }] };
    }
    return { ok: true };
  };

  const result = await svc.compileQuery('DEV-UNSUPPORTED', 'SELECT 1', {
    domain: 'openEHR',
    autoActivate: {
      strategyId: 'openehr.rps_dual',
      config: {
        coding: {
          archetype_ids: { enabled: true }
        }
      }
    }
  });

  assert.ok(Array.isArray(result.pipeline));
  assert.deepEqual(calledUrls, [
    'http://runtime.local/environments/DEV-UNSUPPORTED/activations/openehr/ops/ensure_dictionaries',
    'http://runtime.local/compile'
  ]);
});

test('synthetic job submit uses lowercase domain and models payload contract', async () => {
  const svc = createServiceWithStubs({});
  let captured = null;

  svc._fetch = async (url, opts) => {
    captured = { url, opts };
    return { job_id: 'job-1', status: 'queued' };
  };

  await svc.submitSyntheticJob('DEV', 'OpenEHR', {
    patient_count: 100,
    source_database: 'hc_openEHRCDR',
    source_collection: 'samples',
    model_source: {
      database_name: 'hdl-team',
      catalog_collection: 'user-data-models'
    },
    models: [
      { model_id: 'EII-Control_v2', min_per_patient: 1, max_per_patient: 2 }
    ],
    plan_only: true
  });

  assert.equal(captured.url, 'http://runtime.local/environments/DEV/synthetic/jobs');
  assert.equal(captured.opts.body.domain, 'openehr');
  assert.equal(captured.opts.body.op, 'synthetic_generate_batch');
  assert.equal(captured.opts.body.payload.model_source.database_name, 'hdl-team');
  assert.equal(captured.opts.body.payload.model_source.catalog_collection, 'user-data-models');
  assert.equal(Array.isArray(captured.opts.body.payload.models), true);
  assert.equal(captured.opts.body.payload.models[0].model_id, 'EII-Control_v2');
});

test('synthetic jobs use non-versioned endpoint', async () => {
  const svc = createServiceWithStubs({});
  const calls = [];

  svc._fetch = async (url) => {
    calls.push(url);
    return { items: [] };
  };

  const result = await svc.listSyntheticJobs('DEV', { domain: 'openEHR', limit: 25 });
  assert.equal(Array.isArray(result.items), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'http://runtime.local/environments/DEV/synthetic/jobs?domain=openehr&limit=25');
});

test('synthetic job normalization includes cross-db and by_model fields', async () => {
  const svc = createServiceWithStubs({});
  svc._fetch = async () => ({
    job_id: 'job-2',
    status: 'running',
    phase: 'generate',
    progress: 42,
    domain: 'openEHR',
    source_database: 'hc_openEHRCDR',
    plan_only: true,
    by_model: [{ model_id: 'EII-Control_v2', generated_docs: 20 }],
    by_template: [{ template_id: 'EII-Control_v2', generated_docs: 20 }],
    links_applied: 4,
    generated_docs: 20,
    inserted_base: 20,
    inserted_search: 20,
    stats: {
      patient_count: 10,
      generated_patients: 6
    }
  });

  const result = await svc.getSyntheticJob('DEV', 'job-2');
  assert.equal(result.job.id, 'job-2');
  assert.equal(result.job.domain, 'openehr');
  assert.equal(result.job.sourceDatabase, 'hc_openEHRCDR');
  assert.equal(result.job.planOnly, true);
  assert.equal(Array.isArray(result.job.byModel), true);
  assert.equal(result.job.byModel[0].model_id, 'EII-Control_v2');
  assert.equal(result.job.linksApplied, 4);
  assert.equal(result.job.generatedDocs, 20);
  assert.equal(result.job.insertedBase, 20);
  assert.equal(result.job.insertedSearch, 20);
});

test('synthetic job normalization preserves error code from async job failure', async () => {
  const svc = createServiceWithStubs({});
  svc._fetch = async () => ({
    job_id: 'job-err-1',
    status: 'failed',
    error: {
      code: 'ACTIVATION_STRATEGY_MISMATCH',
      message: 'Active strategy differs from current manifest',
      details: { expected: 'sha:new', actual: 'sha:old' }
    }
  });

  const result = await svc.getSyntheticJob('DEV', 'job-err-1');
  assert.equal(result.job.id, 'job-err-1');
  assert.equal(result.job.status, 'failed');
  assert.equal(result.job.errorCode, 'ACTIVATION_STRATEGY_MISMATCH');
  assert.match(result.job.error, /current manifest/i);
  assert.deepEqual(result.job.errorDetails, { expected: 'sha:new', actual: 'sha:old' });
});

test('activateEnvironment handles activation envelope response', async () => {
  const svc = createServiceWithStubs({});
  svc._fetch = async () => ({
    ok: true,
    activation: {
      activation_id: 'act-123',
      strategy_id: 'openehr.rps_dual',
      strategy_version: '0.1.0',
      domain: 'openEHR',
      config_hash: 'cfg-hash',
      manifest_digest: 'man-digest',
      replaced: true,
      previous_activation_id: 'act-122',
      already_active: true,
    },
    initialization: {
      artifacts: { ok: true, created: ['compositions_rps'], warnings: [], skipped: [] },
      dictionaries: { ok: true, ensured_collections: { codes: 1 }, seeded: {}, warnings: [] }
    },
  });

  const res = await svc.activateEnvironment('DEV', 'openehr.rps_dual', {}, { domain: 'openEHR' });
  assert.equal(res.activationId, 'act-123');
  assert.equal(res.domain, 'openehr');
  assert.equal(res.configHash, 'cfg-hash');
  assert.equal(res.manifestDigest, 'man-digest');
  assert.equal(res.replaced, true);
  assert.equal(res.previousActivationId, 'act-122');
  assert.equal(res.alreadyActive, true);
  assert.deepEqual(res.initialization?.artifacts?.created, ['compositions_rps']);
});

test('listActivations normalizes map responses to array', async () => {
  const svc = createServiceWithStubs({});
  svc._fetch = async () => ({
    env_id: 'DEV',
    activations: {
      openehr: {
        strategy_id: 'openehr.rps_dual',
        activation_id: 'act-open'
      },
      fhir: {
        strategy_id: 'fhir.resource_first',
        activation_id: 'act-fhir'
      }
    }
  });

  const res = await svc.listActivations('DEV');
  assert.equal(Array.isArray(res.activations), true);
  assert.equal(res.activations.length, 2);
  assert.equal(res.activationsByDomain.openehr.activation_id, 'act-open');
  assert.equal(res.activationsByDomain.fhir.activation_id, 'act-fhir');
});

test('runOp resolves templated endpoint URLs from Kehrnel endpoint registry', async () => {
  const svc = createServiceWithStubs({
    compile_query: { url: 'http://runtime.local/compile' },
    query: { url: 'http://runtime.local/query' },
    ops: { url: 'http://runtime.local/environments/{env_id}/activations/{domain}/ops' }
  });
  let calledUrl = null;
  svc._fetch = async (url) => {
    calledUrl = url;
    return { ok: true };
  };

  await svc.runOp('DEV', 'openehr.rps_dual', 'ensure_dictionaries', {}, { domain: 'openEHR' });
  assert.equal(calledUrl, 'http://runtime.local/environments/DEV/activations/openehr/ops/ensure_dictionaries');
});
