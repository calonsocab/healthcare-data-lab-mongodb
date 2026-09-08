import { test } from 'node:test';
import assert from 'node:assert/strict';

const { resolveRuntimeContext } = await import('../src/lib/kehrnel/runtimeContext.js');

test('resolveRuntimeContext rebuilds stale stored config from manifest when overrides change dictionary behavior', async () => {
  const originalFetch = global.fetch;
  const manifest = {
    id: 'openehr.rps_dual',
    name: 'RPS Dual',
    domain: 'openEHR',
    config_schema: {
      type: 'object',
      properties: {
        collections: {
          type: 'object',
          properties: {
            compositions: { type: 'object', properties: { name: { type: 'string' } } },
            search: { type: 'object', properties: { name: { type: 'string' }, enabled: { type: 'boolean' } } },
            codes: { type: 'object', properties: { name: { type: 'string' } } },
            shortcuts: { type: 'object', properties: { name: { type: 'string' } } }
          }
        },
        paths: {
          type: 'object',
          properties: {
            separator: { type: 'string' }
          }
        },
        fields: {
          type: 'object',
          properties: {
            document: {
              type: 'object',
              properties: {
                tid: { type: 'string' },
                cn: { type: 'string' },
                sn: { type: 'string' }
              }
            },
            node: {
              type: 'object',
              properties: {
                p: { type: 'string' },
                data: { type: 'string' }
              }
            }
          }
        },
        transform: {
          type: 'object',
          properties: {
            apply_shortcuts: { type: 'boolean' },
            coding: {
              type: 'object',
              properties: {
                arcodes: { type: 'object', properties: { strategy: { type: 'string' } } },
                atcodes: {
                  type: 'object',
                  properties: {
                    strategy: { type: 'string' },
                    store_original: { type: 'boolean' }
                  }
                }
              }
            }
          }
        },
        bootstrap: {
          type: 'object',
          properties: {
            dictionariesOnActivate: {
              type: 'object',
              properties: {
                codes: { type: 'string' },
                shortcuts: { type: 'string' }
              }
            }
          }
        }
      }
    },
    default_config: {
      collections: {
        compositions: { name: 'compositions_rps' },
        search: { name: 'compositions_search', enabled: true },
        codes: { name: '_codes' },
        shortcuts: { name: '_shortcuts' }
      },
      paths: {
        separator: '.'
      },
      fields: {
        document: {
          tid: 'tid',
          cn: 'cn',
          sn: 'sn'
        },
        node: {
          p: 'p',
          data: 'data'
        }
      },
      transform: {
        apply_shortcuts: true,
        coding: {
          arcodes: { strategy: 'sequential' },
          atcodes: { strategy: 'negative_int', store_original: false }
        }
      },
      bootstrap: {
        dictionariesOnActivate: {
          codes: 'ensure',
          shortcuts: 'seed'
        }
      }
    }
  };

  global.fetch = async (url) => {
    if (String(url) === 'http://runtime.local/strategies/openehr.rps_dual') {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const userDoc = {
      email: 'test@example.com',
      environments: [
        {
          id: 'env-1',
          database: 'hc_openEHRCDR',
          kehrnel: {},
          strategyLinks: [
            {
              domain: 'openEHR',
              strategyId: 'openehr.rps_dual',
              targetDatabase: 'hc_openEHRCDR',
              configOverrides: {
                collections: {
                  codes: { name: '_codes_runtime' },
                  shortcuts: { name: '_shortcuts_runtime' }
                }
              },
              mergedConfig: {
                collections: {
                  compositions: { name: 'composition_rps' },
                  search: { name: 'search_rps', enabled: true },
                  dictionaries: { name: '_codes_legacy' },
                  shortcuts: { name: '_shortcuts_legacy' }
                },
                fields: {
                  composition: {
                    nodes: 'cn',
                    data: 'data',
                    path: 'p',
                    template_id: 'tid'
                  }
                },
                coding: {
                  archetype_ids: { enabled: false, store: 'int' },
                  atcodes: { enabled: true, strategy: 'negative_int', store_original: false }
                },
                dictionaries: {
                  shortcuts: { enabled: false },
                  arcodes: { enabled: false }
                },
                query_engine: { mode: 'atlas_search_dual' },
                node_representation: { path: { mode: 'reversed', token_joiner: '.' } }
              },
              kehrnel: {
                strategyId: 'openehr.rps_dual',
                configHash: 'cfg-old',
                manifestDigest: 'manifest-old'
              }
            }
          ]
        }
      ]
    };

    const coreDb = {
      collection(name) {
        if (name === 'users') {
          return { findOne: async ({ email }) => email === 'test@example.com' ? userDoc : null };
        }
        if (name === 'teams') {
          return { findOne: async () => null };
        }
        if (name === 'kehrnel_instances') {
          return {
            findOne: async () => ({
              _id: 'conn-1',
              url: 'http://runtime.local',
              enabled: true,
              isDefault: true
            })
          };
        }
        return { findOne: async () => null };
      }
    };

    const runtime = await resolveRuntimeContext({
      coreDb,
      userEmail: 'test@example.com',
      envId: 'env-1',
      requestedDomain: 'openEHR',
      strategyId: 'openehr.rps_dual'
    });

    assert.equal(runtime.autoActivate.requiresRefresh, true);
    assert.deepEqual(runtime.envKehrnel, {});
    assert.equal(runtime.autoActivate.config.collections.search.name, 'search_rps');
    assert.equal(runtime.autoActivate.config.collections.codes.name, '_codes_runtime');
    assert.equal(runtime.autoActivate.config.collections.shortcuts.name, '_shortcuts_runtime');
    assert.equal(runtime.autoActivate.config.fields.document.tid, 'tid');
    assert.equal(runtime.autoActivate.config.transform.coding.arcodes.strategy, 'sequential');
    assert.equal(runtime.autoActivate.config.transform.coding.atcodes.strategy, 'negative_int');
    assert.equal(runtime.autoActivate.config.bootstrap.dictionariesOnActivate.codes, 'none');
    assert.equal(runtime.autoActivate.config.bootstrap.dictionariesOnActivate.shortcuts, 'none');
    assert.equal(runtime.autoActivate.config.coding, undefined);
    assert.equal(runtime.autoActivate.config.dictionaries, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test('resolveRuntimeContext reads team environments for demo accounts so Kehrnel gets the linked config', async () => {
  const originalFetch = global.fetch;
  const manifest = {
    id: 'openehr.rps_dual',
    name: 'RPS Dual',
    domain: 'openEHR',
    config_schema: {
      type: 'object',
      properties: {
        collections: {
          type: 'object',
          properties: {
            compositions: { type: 'object', properties: { name: { type: 'string' } } },
            search: { type: 'object', properties: { name: { type: 'string' }, enabled: { type: 'boolean' } } },
            codes: { type: 'object', properties: { name: { type: 'string' } } },
            shortcuts: { type: 'object', properties: { name: { type: 'string' } } }
          }
        },
        transform: {
          type: 'object',
          properties: {
            apply_shortcuts: { type: 'boolean' },
            coding: {
              type: 'object',
              properties: {
                arcodes: { type: 'object', properties: { strategy: { type: 'string' } } },
                atcodes: {
                  type: 'object',
                  properties: {
                    strategy: { type: 'string' },
                    store_original: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    },
    default_config: {
      collections: {
        compositions: { name: 'compositions_rps' },
        search: { name: 'compositions_search', enabled: true },
        codes: { name: '_codes' },
        shortcuts: { name: '_shortcuts' }
      },
      transform: {
        apply_shortcuts: true,
        coding: {
          arcodes: { strategy: 'sequential' },
          atcodes: { strategy: 'negative_int', store_original: false }
        }
      }
    }
  };

  global.fetch = async (url) => {
    if (String(url) === 'http://runtime.local/strategies/openehr.rps_dual') {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const teamDoc = {
      _id: 'team-1',
      environments: [
        {
          id: 'env-demo',
          database: 'cdr-demo',
          kehrnel: { envKey: 'ENV-DEMO' },
          strategyLinks: [
            {
              domain: 'openEHR',
              strategyId: 'openehr.rps_dual',
              targetDatabase: 'cdr-demo',
              configOverrides: {
                collections: {
                  codes: { name: '_codes_demo' },
                  shortcuts: { name: '_shortcuts_demo' }
                }
              },
              mergedConfig: {
                collections: {
                  compositions: { name: 'compositions_rps' },
                  search: { name: 'compositions_search', enabled: true },
                  codes: { name: '_codes_demo' },
                  shortcuts: { name: '_shortcuts_demo' }
                },
                transform: {
                  apply_shortcuts: true,
                  coding: {
                    arcodes: { strategy: 'sequential' },
                    atcodes: { strategy: 'negative_int', store_original: false }
                  }
                }
              },
              kehrnel: {
                strategyId: 'openehr.rps_dual',
                configHash: 'cfg-demo',
                manifestDigest: 'manifest-demo'
              }
            }
          ]
        }
      ]
    };

    const coreDb = {
      collection(name) {
        if (name === 'users') {
          return {
            findOne: async ({ email }) => email === 'demo@example.com'
              ? { email, teamId: 'team-1', accountType: 'demo' }
              : null
          };
        }
        if (name === 'teams') {
          return { findOne: async ({ _id }) => _id === 'team-1' ? teamDoc : null };
        }
        if (name === 'kehrnel_instances') {
          return {
            findOne: async () => ({
              _id: 'conn-1',
              url: 'http://runtime.local',
              enabled: true,
              isDefault: true
            })
          };
        }
        return { findOne: async () => null };
      }
    };

    const runtime = await resolveRuntimeContext({
      coreDb,
      userEmail: 'demo@example.com',
      envId: 'env-demo',
      requestedDomain: 'openEHR',
      strategyId: 'openehr.rps_dual'
    });

    assert.equal(runtime.envKey, 'ENV-DEMO');
    assert.equal(runtime.domain, 'openehr');
    assert.deepEqual(runtime.envKehrnel, { envKey: 'ENV-DEMO' });
    assert.equal(runtime.autoActivate?.strategyId, 'openehr.rps_dual');
    assert.equal(runtime.autoActivate?.config?.collections?.codes?.name, '_codes_demo');
    assert.equal(runtime.autoActivate?.config?.collections?.shortcuts?.name, '_shortcuts_demo');
  } finally {
    global.fetch = originalFetch;
  }
});
