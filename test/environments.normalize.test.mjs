import { test } from 'node:test';
import assert from 'node:assert/strict';

const { normalizeStrategyLinks } = await import('../src/lib/environments/normalizeStrategyLinks.js');

test('normalizes legacy strategy links to domain and dedupes by domain', () => {
  const links = [
    { strategyId: 'a', strategyName: 'Alpha', dataProductType: 'openEHR', configOverrides: { a: 1 } },
    { strategyId: 'b', strategyName: 'Beta', domain: 'fhir', configOverrides: { b: 2 } },
    { strategyId: 'c', strategyName: 'Override', dataProductType: 'openEHR', configOverrides: { c: 3 } }
  ];

  const normalized = normalizeStrategyLinks(links);
  assert.equal(normalized.length, 2);

  const openEhr = normalized.find(l => l.domain === 'openEHR');
  const fhir = normalized.find(l => l.domain === 'fhir');

  assert.ok(openEhr, 'openEHR link exists');
  assert.ok(fhir, 'fhir link exists');

  // Last one wins for duplicate domain
  assert.equal(openEhr.strategyId, 'c');
  assert.deepEqual(openEhr.configOverrides, { c: 3 });
});
