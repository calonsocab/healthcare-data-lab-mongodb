import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  adaptForGenerator,
  adaptForKehrnel,
  adaptForTranslator
} = await import('../src/lib/strategies/configAdapter.js');

test('config adapters do not emit archetype_path/ap fields for ingest payloads', () => {
  const strategy = {
    _id: 'openehr.rps_dual',
    name: 'RPS Dual',
    blueprint: {
      id: 'openehr.rps_dual',
      display_name: 'RPS Dual',
      domain: ['openEHR'],
      collections: {},
      fields: {},
      coding: {},
      dictionaries: {},
      index_templates: {}
    },
    config: {
      strategy: 'openehr.rps_dual',
      fields: {
        composition: {
          nodes: 'cn',
          data: 'data',
          path: 'p',
          archetype_path: 'ap',
          template_id: 'tid',
          version: 'v'
        },
        search: {
          nodes: 'sn',
          data: 'data',
          path: 'p',
          archetype_path: 'ap',
          template_id: 'tid'
        }
      }
    }
  };

  const translatorConfig = adaptForTranslator(strategy);
  const generatorConfig = adaptForGenerator(strategy);
  const kehrnelConfig = adaptForKehrnel(strategy);

  assert.equal(Object.prototype.hasOwnProperty.call(translatorConfig.fields, 'compositionArchetypePath'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(translatorConfig.fields, 'searchArchetypePath'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(generatorConfig.fieldMappings, 'archetypePathField'), false);
  assert.equal(generatorConfig.fieldMappings.pathField, 'p');
  assert.equal(generatorConfig.fieldMappings.templateIdField, 'tid');

  assert.equal(Object.prototype.hasOwnProperty.call(kehrnelConfig.fields.composition, 'archetype_path'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(kehrnelConfig.fields.search, 'archetype_path'), false);
  assert.equal(kehrnelConfig.fields.composition.path, 'p');
  assert.equal(kehrnelConfig.fields.composition.template_id, 'tid');
});
