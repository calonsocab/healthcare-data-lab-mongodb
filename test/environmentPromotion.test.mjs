import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROMOTABLE_ENVIRONMENT_ASSETS,
  buildTargetEnvironmentAfterPromotion,
  prepareDocumentsForPromotion,
  sanitizeStrategyLinksForPromotion,
} from '../src/lib/environments/promotion.js';

test('promotion asset list includes the core reusable workspace collections', () => {
  assert.deepEqual(
    PROMOTABLE_ENVIRONMENT_ASSETS.map((asset) => asset.collection),
    [
      'user-data-models',
      'metadata',
      'aql-queries',
      'type_template_associations',
      'jsonld-mappings',
      'mapping_definitions',
    ]
  );
});

test('sanitizeStrategyLinksForPromotion keeps strategy config and strips activation state', () => {
  const [promotedLink] = sanitizeStrategyLinksForPromotion([
    {
      id: 'link-openehr',
      domain: 'openehr',
      strategyId: 'openehr.rps_dual',
      strategyName: 'RPS Dual',
      targetDatabase: 'search-db',
      strategyVersion: '3.2.1',
      activationId: 'activation-123',
      manifestDigest: 'digest-1',
      configHash: 'hash-1',
      configOverrides: { mode: 'search' },
      mergedConfig: { mode: 'search', index: true },
      contexts: { synthetic: true, query: true, api: false },
      notes: 'promote me',
      kehrnel: {
        activationId: 'activation-123',
        strategyId: 'openehr.rps_dual',
        configHash: 'hash-1',
      },
    },
  ]);

  assert.equal(promotedLink.id, 'link-openehr');
  assert.equal(promotedLink.strategyId, 'openehr.rps_dual');
  assert.equal(promotedLink.strategyName, 'RPS Dual');
  assert.equal(promotedLink.targetDatabase, 'search-db');
  assert.deepEqual(promotedLink.configOverrides, { mode: 'search' });
  assert.deepEqual(promotedLink.mergedConfig, { mode: 'search', index: true });
  assert.equal(promotedLink.activationId, null);
  assert.equal(promotedLink.manifestDigest, null);
  assert.equal(promotedLink.configHash, null);
  assert.equal(promotedLink.strategyVersion, null);
  assert.equal(promotedLink.kehrnel, null);
});

test('buildTargetEnvironmentAfterPromotion copies runtime config but preserves target env identity fields', () => {
  const sourceEnvironment = {
    id: 'env-source',
    name: 'DEV',
    database: 'db-dev',
    domainDatabases: { openehr: 'search-dev' },
    strategyLinks: [
      {
        id: 'link-openehr',
        domain: 'openehr',
        strategyId: 'openehr.rps_dual',
        strategyName: 'RPS Dual',
        activationId: 'activation-123',
        configOverrides: { mode: 'search' },
      },
    ],
    kehrnel: {
      useDefault: false,
      apiUrl: 'http://kehrnel-dev.local',
      connectionId: 'kehrnel-dev',
      envKey: 'dev',
      lastHealth: { status: 'ok' },
    },
  };

  const targetEnvironment = {
    id: 'env-target',
    name: 'PRE',
    database: 'db-pre',
    strategyLinks: [],
    domainDatabases: {},
    kehrnel: {
      useDefault: true,
      apiUrl: 'http://kehrnel-pre.local',
      connectionId: 'kehrnel-pre',
      envKey: 'pre',
      lastHealth: { status: 'error' },
    },
  };

  const promoted = buildTargetEnvironmentAfterPromotion(sourceEnvironment, targetEnvironment, {
    includeRuntimeConfig: true,
    nowIso: '2026-04-22T10:00:00.000Z',
  });

  assert.equal(promoted.id, 'env-target');
  assert.equal(promoted.name, 'PRE');
  assert.equal(promoted.database, 'db-pre');
  assert.deepEqual(promoted.domainDatabases, { openehr: 'search-dev' });
  assert.equal(promoted.strategyLinks.length, 1);
  assert.equal(promoted.strategyLinks[0].strategyId, 'openehr.rps_dual');
  assert.equal(promoted.strategyLinks[0].activationId, null);
  assert.equal(promoted.kehrnel.useDefault, false);
  assert.equal(promoted.kehrnel.apiUrl, 'http://kehrnel-dev.local');
  assert.equal(promoted.kehrnel.connectionId, 'kehrnel-dev');
  assert.equal(promoted.kehrnel.envKey, 'pre');
  assert.deepEqual(promoted.kehrnel.lastHealth, { status: 'error' });
  assert.equal(promoted.updatedAt, '2026-04-22T10:00:00.000Z');
});

test('prepareDocumentsForPromotion rewrites jsonld mapping environment ownership', () => {
  const prepared = prepareDocumentsForPromotion(
    'jsonld-mappings',
    [
      {
        _id: 'mapping-1',
        templateName: 'Vitals',
        environmentId: 'env-source',
      },
    ],
    {
      targetEnvironment: { id: 'env-target' },
    }
  );

  assert.deepEqual(prepared, [
    {
      _id: 'mapping-1',
      templateName: 'Vitals',
      environmentId: 'env-target',
    },
  ]);
});

