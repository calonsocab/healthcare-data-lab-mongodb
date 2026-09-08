import { test } from 'node:test';
import assert from 'node:assert/strict';

const { default: validateAQL } = await import('../src/lib/aqlToMql/parser/validateAql.js');

test('validateAQL accepts VERSION contains chains through the custom fallback parser', () => {
  const result = validateAQL(
    'SELECT e/ehr_id/value AS ehrId FROM EHR e CONTAINS VERSION v CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.probs_base_composition.v0] ORDER BY v/commit_audit/time_committed/value LIMIT 1'
  );

  assert.equal(result.success, true);
  assert.deepEqual(result.errors, []);
});

test('validateAQL still rejects empty AQL', () => {
  const result = validateAQL('');

  assert.equal(result.success, false);
  assert.ok(Array.isArray(result.errors));
  assert.equal(result.errors.length, 0);
});
