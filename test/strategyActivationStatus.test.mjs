import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMockKehrnelServer } from './mock-kehrnel-server.mjs';
import { createKehrnelService } from '../src/lib/kehrnel/KehrnelService.js';
import {
  buildActivationWorkflow,
  mergeCoherenceValidationsIntoStrategyLinks,
  mergeValidationIntoWorkflow,
  validateStrategyLinkCoherence,
} from '../src/lib/environments/strategyActivationStatus.js';

function createCoreDbMock() {
  return {
    collection() {
      return {
        findOne: async () => null,
      };
    },
  };
}

test('validateStrategyLinkCoherence reports activated when HDL and Kehrnel match', async (t) => {
  const server = createMockKehrnelServer();
  const baseUrl = await server.start();
  t.after(async () => server.stop());

  const previousUrl = process.env.KEHRNEL_URL;
  process.env.KEHRNEL_URL = baseUrl;
  t.after(() => {
    if (previousUrl === undefined) delete process.env.KEHRNEL_URL;
    else process.env.KEHRNEL_URL = previousUrl;
  });

  const service = createKehrnelService(createCoreDbMock());
  await service.activateEnvironment('env-1', 'openehr.rps', {}, { domain: 'openEHR' });

  const coherence = await validateStrategyLinkCoherence({
    service,
    env: {
      id: 'env-1',
      database: 'hdl_env_1',
      kehrnel: {},
    },
    envId: 'env-1',
    link: {
      domain: 'openEHR',
      strategyId: 'openehr.rps',
      targetDatabase: 'hdl_env_1',
      configHash: 'sha:config',
      manifestDigest: 'sha:manifest',
      kehrnel: {
        strategyId: 'openehr.rps',
        configHash: 'sha:config',
        manifestDigest: 'sha:manifest',
      },
    },
  });

  assert.equal(coherence.status, 'activated');
  assert.equal(coherence.checks.activationFound, true);
  assert.equal(coherence.checks.strategyMatch, true);
  assert.equal(coherence.checks.endpointsAvailable, true);
  assert.deepEqual(coherence.mismatches, []);
});

test('buildActivationWorkflow and mergeValidationIntoWorkflow preserve step detail', () => {
  const workflow = buildActivationWorkflow({
    confirmedAt: '2026-04-23T10:00:00.000Z',
    activation: {
      activationId: 'act-123',
      strategyId: 'openehr.rps',
      domain: 'openehr',
    },
    initialization: {
      artifacts: {
        ok: true,
        created: ['compositions_rps', 'compositions_search'],
        warnings: [],
        skipped: [],
      },
      dictionaries: {
        ok: false,
        warning: 'dictionary bootstrap failed',
      },
    },
    validation: {
      status: 'mismatch',
      message: 'The environment link and runtime activation are not fully aligned yet.',
      checkedAt: '2026-04-23T10:00:02.000Z',
      checks: {
        activationFound: true,
      },
      mismatches: ['The active configuration hash in Kehrnel differs from HDL.'],
    },
  });

  assert.equal(workflow.status, 'attention_required');
  assert.equal(workflow.steps.find((step) => step.id === 'initialize_storage')?.status, 'completed');
  assert.equal(workflow.steps.find((step) => step.id === 'bootstrap_dictionaries')?.status, 'warning');
  assert.equal(workflow.steps.find((step) => step.id === 'validate_environment')?.status, 'warning');

  const merged = mergeValidationIntoWorkflow(workflow, {
    status: 'activated',
    message: 'The strategy is activated and coherent with this environment.',
    checkedAt: '2026-04-23T10:00:05.000Z',
    checks: {
      activationFound: true,
      strategyMatch: true,
      configHashMatch: true,
      manifestDigestMatch: true,
      endpointsAvailable: true,
    },
    mismatches: [],
  });

  assert.equal(merged.status, 'activated_with_warnings');
  assert.equal(merged.steps.find((step) => step.id === 'validate_environment')?.status, 'completed');
});

test('mergeCoherenceValidationsIntoStrategyLinks skips stale validation results after a link changes', () => {
  const { strategyLinks, results, changed } = mergeCoherenceValidationsIntoStrategyLinks(
    [
      {
        domain: 'openEHR',
        strategyId: 'openehr.rps.next',
        activationId: 'act-new',
        kehrnel: {
          strategyId: 'openehr.rps.next',
          activationId: 'act-new',
          activationWorkflow: {
            status: 'pending',
            steps: [],
          },
        },
      },
    ],
    [
      {
        domain: 'openEHR',
        expectedActivationId: 'act-old',
        expectedStrategyId: 'openehr.rps',
        coherence: {
          status: 'activated',
          message: 'Old validation result.',
          checkedAt: '2026-04-23T10:00:05.000Z',
          checks: {
            activationFound: true,
          },
          mismatches: [],
        },
      },
    ]
  );

  assert.equal(changed, false);
  assert.equal(strategyLinks[0]?.kehrnel?.coherence || null, null);
  assert.deepEqual(results, [
    {
      domain: 'openehr',
      status: 'stale',
      message: 'Validation was skipped because the strategy link changed while the check was running.',
      applied: false,
    },
  ]);
});
