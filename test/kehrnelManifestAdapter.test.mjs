import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  buildKehrnelActivationConfig,
  hasPhysicalKehrnelConfig,
  normalizeKehrnelConfigInput
} = await import('../src/lib/strategies/kehrnelManifestAdapter.js');

test('buildKehrnelActivationConfig returns manifest-schema runtime config for Kehrnel', () => {
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
        ids: {
          type: 'object',
          properties: {
            ehr_id: { type: 'string' },
            composition_id: { type: 'string' }
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
                ehr_id: { type: 'string' },
                comp_id: { type: 'string' },
                tid: { type: 'string' },
                v: { type: 'string' },
                cn: { type: 'string' },
                sn: { type: 'string' }
              }
            },
            node: {
              type: 'object',
              properties: {
                p: { type: 'string' },
                pi: { type: 'string' },
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
      },
      additionalProperties: false
    },
    default_config: {
      collections: {
        compositions: { name: 'compositions_rps' },
        search: { name: 'compositions_search', enabled: true },
        codes: { name: '_codes' },
        shortcuts: { name: '_shortcuts' }
      },
      ids: {
        ehr_id: 'string',
        composition_id: 'objectid'
      },
      paths: {
        separator: '.'
      },
      fields: {
        document: {
          ehr_id: 'ehr_id',
          comp_id: 'comp_id',
          tid: 'tid',
          v: 'v',
          cn: 'cn',
          sn: 'sn'
        },
        node: {
          p: 'p',
          pi: 'pi',
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
    },
  };

  const config = buildKehrnelActivationConfig(manifest, {}, 'hc_openEHRCDR');

  assert.deepEqual(Object.keys(config).sort(), ['bootstrap', 'collections', 'fields', 'ids', 'paths', 'transform']);
  assert.equal(config.collections.compositions.name, 'compositions_rps');
  assert.equal(config.collections.search.name, 'compositions_search');
  assert.equal(config.collections.codes.name, '_codes');
  assert.equal(config.collections.shortcuts.name, '_shortcuts');
  assert.equal(config.fields.document.tid, 'tid');
  assert.equal(config.fields.document.cn, 'cn');
  assert.equal(config.fields.node.data, 'data');
  assert.equal(config.transform.coding.arcodes.strategy, 'sequential');
  assert.equal(config.transform.coding.atcodes.strategy, 'negative_int');
  assert.equal(config.bootstrap.dictionariesOnActivate.shortcuts, 'seed');
  assert.equal(config.database, undefined);
});

test('buildKehrnelActivationConfig injects catalog-backed transform.mappings for openehr.rps_dual when absent', () => {
  const manifest = {
    id: 'openehr.rps_dual',
    config_schema: {
      type: 'object',
      properties: {
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
      transform: {
        apply_shortcuts: true
      }
    }
  };

  const config = buildKehrnelActivationConfig(manifest, {});

  assert.equal(config.transform.apply_shortcuts, true);
  assert.deepEqual(config.transform.mappings, {
    source: 'catalog',
    catalog_collection: 'user-data-models',
    domain: 'openehr'
  });
});

test('buildKehrnelActivationConfig injects catalog-backed transform.mappings for openehr.rps_dual_ibm when absent', () => {
  const manifest = {
    id: 'openehr.rps_dual_ibm',
    config_schema: {
      type: 'object',
      properties: {
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
      transform: {
        apply_shortcuts: true
      }
    }
  };

  const config = buildKehrnelActivationConfig(manifest, {});

  assert.equal(config.transform.apply_shortcuts, true);
  assert.deepEqual(config.transform.mappings, {
    source: 'catalog',
    catalog_collection: 'user-data-models',
    domain: 'openehr'
  });
});

test('buildKehrnelActivationConfig preserves explicit transform.mappings overrides for openehr.rps_dual', () => {
  const manifest = {
    id: 'openehr.rps_dual',
    config_schema: {
      type: 'object',
      properties: {
        transform: {
          type: 'object',
          properties: {
            mappings: {}
          }
        }
      }
    },
    default_config: {}
  };

  const config = buildKehrnelActivationConfig(manifest, {
    transform: {
      mappings: 'file://samples/reference/projection_mappings.json'
    }
  });

  assert.equal(config.transform.mappings, 'file://samples/reference/projection_mappings.json');
});

test('buildKehrnelActivationConfig maps legacy HDL config into Kehrnel manifest schema', () => {
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
            search: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                enabled: { type: 'boolean' },
                atlasIndex: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' }
                  }
                }
              }
            },
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

  const config = buildKehrnelActivationConfig(manifest, {
    collections: {
      compositions: { name: 'composition_rps' },
      search: { name: 'search_rps', enabled: true, atlas_index_name: 'search_nodes_index' },
      dictionaries: { name: '_codes_runtime' },
      shortcuts: { name: '_shortcuts_runtime' }
    },
    fields: {
      composition: {
        nodes: 'cn',
        data: 'payload',
        path: 'rp',
        template_id: 'template_code'
      },
      search: {
        nodes: 'sn'
      }
    },
    coding: {
      archetype_ids: { store: 'int', enabled: false },
      atcodes: { strategy: 'alpha_compact', store_original: true }
    },
    dictionaries: {
      shortcuts: { enabled: false }
    },
    node_representation: {
      path: { token_joiner: '/' }
    }
  }, 'hc_openEHRCDR');

  assert.equal(config.collections.compositions.name, 'composition_rps');
  assert.equal(config.collections.search.name, 'search_rps');
  assert.equal(config.collections.search.atlasIndex.name, 'search_nodes_index');
  assert.equal(config.collections.codes.name, '_codes_runtime');
  assert.equal(config.collections.shortcuts.name, '_shortcuts_runtime');
  assert.equal(config.paths.separator, '/');
  assert.equal(config.fields.document.tid, 'template_code');
  assert.equal(config.fields.node.p, 'rp');
  assert.equal(config.fields.node.data, 'payload');
  assert.equal(config.transform.coding.arcodes.strategy, 'sequential');
  assert.equal(config.transform.coding.atcodes.strategy, 'negative_int');
  assert.equal(config.transform.coding.atcodes.store_original, true);
  assert.equal(config.bootstrap.dictionariesOnActivate.codes, 'none');
  assert.equal(config.bootstrap.dictionariesOnActivate.shortcuts, 'none');
  assert.equal(config.coding, undefined);
  assert.equal(config.dictionaries, undefined);
});

test('hasPhysicalKehrnelConfig rejects incomplete legacy physical configs', () => {
  const partialConfig = {
    collections: {
      compositions: { name: 'composition_rps' }
    },
    fields: {
      composition: {
        nodes: 'cn',
        path: 'p'
      }
    },
    coding: {
      archetype_ids: { enabled: true }
    },
    query_engine: {
      mode: 'atlas_search_dual'
    }
  };

  assert.equal(hasPhysicalKehrnelConfig(partialConfig), false);
});

test('normalizeKehrnelConfigInput removes overrides that no longer satisfy manifest enums', () => {
  const manifest = {
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
    },
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
    }
  };

  const input = {
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
    },
    unsupported: {
      keep: false
    }
  };

  const normalized = normalizeKehrnelConfigInput(manifest, input);
  assert.deepEqual(normalized, {
    collections: {
      search: {
        enabled: false
      }
    }
  });

  const merged = buildKehrnelActivationConfig(manifest, input);
  assert.equal(merged.collections.search.enabled, false);
  assert.equal(merged.transform.coding.atcodes.strategy, 'negative_int');
});
