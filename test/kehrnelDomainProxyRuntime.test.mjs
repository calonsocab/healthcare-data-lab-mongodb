import { test } from 'node:test';
import assert from 'node:assert/strict';

const { ensureDomainProxyRuntimeReady } = await import('../src/lib/kehrnel/domainProxyRuntime.js');

test('ensureDomainProxyRuntimeReady uses the resolved runtime envKey and forwards auto-activation context', async () => {
  const calls = [];
  const service = {
    ensureRuntimeReady: async (...args) => {
      calls.push(args);
      return { activated: true };
    }
  };

  const runtime = {
    envKey: 'env-runtime-prod',
    domain: 'openehr',
    connectionId: 'conn-1',
    envKehrnel: { envKey: 'env-runtime-prod' },
    autoActivate: {
      strategyId: 'openehr.rps',
      config: { collections: { compositions: { name: 'compositions' } } },
      configHash: 'cfg-1',
      manifestDigest: 'manifest-1'
    }
  };

  const result = await ensureDomainProxyRuntimeReady(service, runtime, {
    envId: 'env-hdl',
    requestId: 'req-123',
    domain: 'openehr'
  });

  assert.deepEqual(result, {
    envKey: 'env-runtime-prod',
    domain: 'openehr'
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'env-runtime-prod');
  assert.equal(calls[0][1].strategyId, 'openehr.rps');
  assert.equal(calls[0][1].connectionId, 'conn-1');
  assert.equal(calls[0][1].requestId, 'req-123');
  assert.deepEqual(calls[0][1].envKehrnel, { envKey: 'env-runtime-prod' });
  assert.deepEqual(calls[0][1].autoActivate, runtime.autoActivate);
});

test('ensureDomainProxyRuntimeReady falls back to envId when no explicit runtime envKey exists', async () => {
  const calls = [];
  const service = {
    ensureRuntimeReady: async (...args) => {
      calls.push(args);
      return { activated: true };
    }
  };

  const result = await ensureDomainProxyRuntimeReady(service, { autoActivate: null }, {
    envId: 'env-fallback',
    domain: 'openehr'
  });

  assert.deepEqual(result, {
    envKey: 'env-fallback',
    domain: 'openehr'
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'env-fallback');
  assert.equal(calls[0][1].strategyId, null);
});
