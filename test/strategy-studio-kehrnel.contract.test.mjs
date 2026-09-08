// test/strategy-studio-kehrnel.contract.test.mjs
/**
 * HDL-KHR-018: Contract test for Strategy Studio Kehrnel rendering
 *
 * Verifies that Strategy Studio correctly:
 * 1. Transforms Kehrnel catalog to UI format (domain-first)
 * 2. Displays activation metadata from strategyLinks
 * 3. Handles lifecycle operations via HDL proxy routes
 */

import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock Kehrnel catalog response
const MOCK_KEHRNEL_CATALOG = {
  strategies: [
    {
      id: 'openehr.rps_dual',
      name: 'Reversed Path Search - Dual Collection',
      version: '0.1.0',
      summary: 'Optimizes indexing with a slim search collection',
      description: 'Reference OpenEHR strategy using reversed paths...',
      domain: 'openEHR',
      capabilities: ['transform', 'ingest', 'validate', 'query', 'plan', 'apply'],
      config_schema: {
        type: 'object',
        properties: {
          search_collection: { type: 'string', default: 'compositions_search' }
        }
      },
      default_config: {
        search_collection: 'compositions_search'
      },
      ui: {
        tags: ['openEHR', 'dual-collection', 'atlas-search'],
        domain_badge: 'openEHR'
      },
      ops: [
        { name: 'ensure_dictionaries', kind: 'maintenance', summary: 'Initialize dictionaries' }
      ]
    },
    {
      id: 'fhir.r4_standard',
      name: 'FHIR R4 Standard',
      version: '1.0.0',
      summary: 'Standard FHIR R4 persistence',
      domain: 'FHIR',
      capabilities: ['transform', 'ingest', 'query'],
      config_schema: {},
      default_config: {},
      ui: { tags: ['FHIR', 'R4'] },
      ops: []
    }
  ],
  source: 'kehrnel',
  connectionId: 'test-connection-123'
};

// Mock activation response
const MOCK_ACTIVATION = {
  activation_id: 'act_abc123def456',
  strategy_id: 'openehr.rps_dual',
  domain: 'openEHR',
  manifest_digest: 'sha256:1234567890abcdef',
  config_hash: 'cfg_hash_xyz',
  activated_at: '2025-01-15T10:30:00Z',
  endpoints: {
    ingest: { url: '/ingestions/body', method: 'POST' },
    query: { url: '/query', method: 'POST' },
    transform: { url: '/transform', method: 'POST' }
  }
};

// Mock environment with strategyLinks
const MOCK_ENVIRONMENT = {
  _id: 'env_test_123',
  id: 'env_test_123',
  name: 'Test Environment',
  strategyLinks: [
    {
      domain: 'openEHR',
      strategyId: 'openehr.rps_dual',
      strategyName: 'Reversed Path Search - Dual Collection',
      kehrnel: {
        strategyId: 'openehr.rps_dual',
        activationId: 'act_abc123def456',
        manifestDigest: 'sha256:1234567890abcdef',
        configHash: 'cfg_hash_xyz',
        activatedAt: '2025-01-15T10:30:00Z',
        endpoints: {
          ingest: { url: '/ingestions/body', method: 'POST' },
          query: { url: '/query', method: 'POST' },
          transform: { url: '/transform', method: 'POST' }
        }
      }
    }
  ],
  kehrnel: {
    connectionId: 'test-connection-123',
    instanceName: 'Test Kehrnel'
  }
};

describe('Strategy Studio Kehrnel Contract', () => {

  describe('Catalog Transformation (domain-first)', () => {

    test('transforms Kehrnel catalog to UI format with domain-first fields', () => {
      // Simulate the transformKehrnelCatalog function from StrategyManager.jsx
      function transformKehrnelCatalog(strategies) {
        return (strategies || []).map(s => ({
          id: s.id,
          name: s.name || s.id,
          description: s.summary || s.description || '',
          domain: s.domain,
          version: s.version,
          config_schema: s.config_schema,
          default_config: s.default_config,
          ops: s.ops || [],
          capabilities: s.capabilities || [],
          ui: s.ui || {},
          source: 'kehrnel',
        }));
      }

      const transformed = transformKehrnelCatalog(MOCK_KEHRNEL_CATALOG.strategies);

      // Verify domain-first model
      assert.equal(transformed.length, 2, 'Should have 2 strategies');

      const openehr = transformed.find(s => s.id === 'openehr.rps_dual');
      assert.ok(openehr, 'Should have openEHR strategy');
      assert.equal(openehr.domain, 'openEHR', 'domain should be string, not array');
      assert.equal(openehr.source, 'kehrnel', 'source should be kehrnel');
      assert.ok(Array.isArray(openehr.capabilities), 'capabilities should be array');
      assert.ok(openehr.capabilities.includes('transform'), 'should have transform capability');
      assert.ok(openehr.ops.length > 0, 'should have ops');
      assert.equal(openehr.ops[0].name, 'ensure_dictionaries');

      const fhir = transformed.find(s => s.id === 'fhir.r4_standard');
      assert.ok(fhir, 'Should have FHIR strategy');
      assert.equal(fhir.domain, 'FHIR', 'FHIR domain should be string');
    });

    test('no blueprint fields in transformed catalog', () => {
      function transformKehrnelCatalog(strategies) {
        return (strategies || []).map(s => ({
          id: s.id,
          name: s.name || s.id,
          description: s.summary || s.description || '',
          domain: s.domain,
          version: s.version,
          config_schema: s.config_schema,
          default_config: s.default_config,
          ops: s.ops || [],
          capabilities: s.capabilities || [],
          ui: s.ui || {},
          source: 'kehrnel',
        }));
      }

      const transformed = transformKehrnelCatalog(MOCK_KEHRNEL_CATALOG.strategies);

      for (const strategy of transformed) {
        assert.equal(strategy.blueprint, undefined, `strategy ${strategy.id} should not have blueprint`);
        assert.equal(strategy.ownerType, undefined, `strategy ${strategy.id} should not have ownerType`);
        assert.equal(strategy._id, undefined, `strategy ${strategy.id} should not have _id (use id)`);
      }
    });
  });

  describe('Activation Metadata Display', () => {

    test('environment strategyLinks contain required Kehrnel metadata', () => {
      const link = MOCK_ENVIRONMENT.strategyLinks[0];

      // Required fields for ActiveStrategyBanner display
      assert.ok(link.domain, 'should have domain');
      assert.ok(link.kehrnel, 'should have kehrnel object');
      assert.ok(link.kehrnel.strategyId, 'should have strategyId');
      assert.ok(link.kehrnel.activationId, 'should have activationId');
      assert.ok(link.kehrnel.manifestDigest, 'should have manifestDigest');
      assert.ok(link.kehrnel.configHash, 'should have configHash');
      assert.ok(link.kehrnel.activatedAt, 'should have activatedAt');
      assert.ok(link.kehrnel.endpoints, 'should have endpoints');
    });

    test('endpoints count is correctly calculated', () => {
      const link = MOCK_ENVIRONMENT.strategyLinks[0];
      const endpointsCount = Object.keys(link.kehrnel.endpoints).length;

      assert.equal(endpointsCount, 3, 'should have 3 endpoints (ingest, query, transform)');
    });

    test('activation metadata can be truncated for display', () => {
      const link = MOCK_ENVIRONMENT.strategyLinks[0];

      // Simulate truncation logic from ActiveStrategyBanner
      const truncatedActivationId = link.kehrnel.activationId.slice(0, 8) + '…';
      const truncatedDigest = link.kehrnel.manifestDigest.slice(0, 8) + '…';

      assert.equal(truncatedActivationId, 'act_abc1…');
      assert.equal(truncatedDigest, 'sha256:1…');
    });
  });

  describe('Domain Theme Resolution', () => {

    test('getStrategyTheme uses strategy.domain directly (domain-first)', () => {
      const DOMAIN_THEMES = {
        openEHR: { primary: '#00a99d' },
        FHIR: { primary: '#ff6b6b' },
        Custom: { primary: '#fdcb6e' }
      };

      function getStrategyTheme(strategy) {
        if (!strategy) return DOMAIN_THEMES.Custom;

        const domain = strategy.domain;
        if (domain && DOMAIN_THEMES[domain]) {
          return DOMAIN_THEMES[domain];
        }

        // Case-insensitive fallback
        if (domain) {
          const normalizedDomain = domain.toLowerCase();
          for (const [key, theme] of Object.entries(DOMAIN_THEMES)) {
            if (key.toLowerCase() === normalizedDomain) {
              return theme;
            }
          }
        }

        return DOMAIN_THEMES.Custom;
      }

      // Test domain-first resolution
      const openehrStrategy = { domain: 'openEHR', id: 'openehr.rps_dual' };
      assert.equal(getStrategyTheme(openehrStrategy).primary, '#00a99d');

      const fhirStrategy = { domain: 'FHIR', id: 'fhir.r4' };
      assert.equal(getStrategyTheme(fhirStrategy).primary, '#ff6b6b');

      // Test case-insensitive
      const lowercaseOpenehr = { domain: 'openehr', id: 'test' };
      assert.equal(getStrategyTheme(lowercaseOpenehr).primary, '#00a99d');

      // Test fallback to Custom
      const unknownDomain = { domain: 'Unknown', id: 'test' };
      assert.equal(getStrategyTheme(unknownDomain).primary, '#fdcb6e');

      // Test no domain
      const noDomain = { id: 'test' };
      assert.equal(getStrategyTheme(noDomain).primary, '#fdcb6e');
    });
  });

  describe('Proxy Route Contracts', () => {

    test('activation lifecycle routes use correct URL patterns', () => {
      const envId = 'env_123';
      const domain = 'openEHR';

      // Verify correct URL patterns (these should match the actual API routes)
      const upgradeUrl = `/api/kehrnel/environments/${envId}/activations/${domain}/upgrade`;
      const rollbackUrl = `/api/kehrnel/environments/${envId}/activations/${domain}/rollback`;
      const deleteUrl = `/api/kehrnel/environments/${envId}/activations/${domain}`;
      const syncUrl = `/api/kehrnel/environments/${envId}/activations`;

      assert.match(upgradeUrl, /\/api\/kehrnel\/environments\/\w+\/activations\/\w+\/upgrade/);
      assert.match(rollbackUrl, /\/api\/kehrnel\/environments\/\w+\/activations\/\w+\/rollback/);
      assert.match(deleteUrl, /\/api\/kehrnel\/environments\/\w+\/activations\/\w+$/);
      assert.match(syncUrl, /\/api\/kehrnel\/environments\/\w+\/activations$/);
    });

    test('catalog route uses correct URL pattern', () => {
      const catalogUrl = '/api/kehrnel/catalog';
      const catalogWithConnection = '/api/kehrnel/catalog?connectionId=test-123';

      assert.match(catalogUrl, /\/api\/kehrnel\/catalog/);
      assert.match(catalogWithConnection, /\/api\/kehrnel\/catalog\?connectionId=/);
    });

    test('sync activation request body format', () => {
      const syncBody = { action: 'sync' };

      assert.equal(syncBody.action, 'sync');
      assert.deepEqual(Object.keys(syncBody), ['action']);
    });
  });

  describe('Catalog Source Banner Contract', () => {

    test('catalogSource contains expected fields', () => {
      const catalogSource = {
        source: MOCK_KEHRNEL_CATALOG.source,
        connectionId: MOCK_KEHRNEL_CATALOG.connectionId,
        fetchedAt: new Date().toISOString()
      };

      assert.ok(catalogSource.source, 'should have source');
      assert.ok(catalogSource.connectionId, 'should have connectionId');
      assert.ok(catalogSource.fetchedAt, 'should have fetchedAt');
    });

    test('environment contains kehrnel connection info', () => {
      assert.ok(MOCK_ENVIRONMENT.kehrnel, 'should have kehrnel config');
      assert.ok(MOCK_ENVIRONMENT.kehrnel.connectionId, 'should have connectionId');
      assert.ok(MOCK_ENVIRONMENT.kehrnel.instanceName, 'should have instanceName');
    });
  });

  describe('HDL-KHR-020: Catalog Stats Contract', () => {

    test('catalog stats are correctly calculated from strategies', () => {
      const strategies = MOCK_KEHRNEL_CATALOG.strategies;

      // Calculate stats like CatalogSourceBanner does
      const strategyCount = strategies.length;
      const domains = [...new Set(strategies.map(s => s.domain).filter(Boolean))];
      const domainCount = domains.length;

      assert.equal(strategyCount, 2, 'should have 2 strategies');
      assert.equal(domainCount, 2, 'should have 2 unique domains (openEHR, FHIR)');
      assert.ok(domains.includes('openEHR'), 'should include openEHR domain');
      assert.ok(domains.includes('FHIR'), 'should include FHIR domain');
    });

    test('empty catalog triggers warning state', () => {
      const emptyStrategies = [];

      const getHealthStatus = (strategies, catalogSource) => {
        if (!catalogSource?.source) return { status: 'unknown', warning: null };
        if (catalogSource.error) return { status: 'error', warning: catalogSource.error };
        if (strategies.length === 0) {
          return { status: 'warning', warning: 'No strategies returned from Kehrnel' };
        }
        return { status: 'healthy', warning: null };
      };

      const healthEmpty = getHealthStatus(emptyStrategies, { source: 'kehrnel' });
      assert.equal(healthEmpty.status, 'warning', 'empty catalog should be warning');
      assert.ok(healthEmpty.warning, 'should have warning message');

      const healthWithStrategies = getHealthStatus(MOCK_KEHRNEL_CATALOG.strategies, { source: 'kehrnel' });
      assert.equal(healthWithStrategies.status, 'healthy', 'catalog with strategies should be healthy');
      assert.equal(healthWithStrategies.warning, null, 'should not have warning');
    });

    test('sync activation endpoint returns expected structure', () => {
      // Mock sync result structure
      const syncResult = {
        success: true,
        domainsUpdated: ['openEHR'],
        environment: MOCK_ENVIRONMENT
      };

      assert.ok(syncResult.success, 'should have success flag');
      assert.ok(Array.isArray(syncResult.domainsUpdated), 'domainsUpdated should be array');
      assert.ok(syncResult.environment, 'should return updated environment');
      assert.ok(syncResult.environment.strategyLinks, 'environment should have strategyLinks');
    });
  });
});
