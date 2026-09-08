import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  hydrateSyntheticBindingConfig,
  resolveSyntheticBinding
} = await import('../src/lib/synthetic-data/kehrnelRuntime.js');

function buildManifest() {
  return {
    id: 'openehr.rps_dual',
    config_schema: {
      type: 'object',
      properties: {
        collections: {
          type: 'object',
          properties: {
            search: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                name: { type: 'string' }
              }
            }
          }
        },
        transform: {
          type: 'object',
          properties: {
            apply_shortcuts: { type: 'boolean' },
            mappings: {}
          }
        }
      }
    },
    default_config: {
      collections: {
        search: {
          enabled: true,
          name: 'compositions_search'
        }
      },
      transform: {
        apply_shortcuts: true
      }
    }
  };
}

test('hydrateSyntheticBindingConfig injects catalog-backed mappings for stale synthetic bindings', async () => {
  const environment = {
    id: 'env-1',
    database: 'hdl-team',
    kehrnel: {},
    strategyLinks: [
      {
        domain: 'openEHR',
        strategyId: 'openehr.rps_dual',
        targetDatabase: 'hdl-team-openehr',
        contexts: { synthetic: true },
        mergedConfig: {
          collections: {
            search: {
              enabled: true,
              name: 'compositions_search'
            }
          },
          transform: {
            apply_shortcuts: true
          }
        },
        configOverrides: {}
      }
    ]
  };

  const binding = resolveSyntheticBinding(environment, { domain: 'openEHR' });
  const hydrated = await hydrateSyntheticBindingConfig(environment, binding, {
    service: {
      getStrategy: async () => buildManifest()
    }
  });

  assert.deepEqual(hydrated.mergedConfig.transform.mappings, {
    source: 'catalog',
    catalog_collection: 'user-data-models',
    domain: 'openehr'
  });
  assert.equal(hydrated.targetDatabase, 'hdl-team');
});

test('hydrateSyntheticBindingConfig preserves explicit synthetic transform.mappings overrides', async () => {
  const environment = {
    id: 'env-1',
    database: 'hdl-team',
    kehrnel: {},
    strategyLinks: [
      {
        domain: 'openEHR',
        strategyId: 'openehr.rps_dual',
        targetDatabase: 'hdl-team-openehr',
        contexts: { synthetic: true },
        configOverrides: {
          transform: {
            mappings: 'file://samples/reference/projection_mappings.json'
          }
        }
      }
    ]
  };

  const binding = resolveSyntheticBinding(environment, { domain: 'openEHR' });
  const hydrated = await hydrateSyntheticBindingConfig(environment, binding, {
    service: {
      getStrategy: async () => buildManifest()
    }
  });

  assert.equal(hydrated.mergedConfig.transform.mappings, 'file://samples/reference/projection_mappings.json');
});
