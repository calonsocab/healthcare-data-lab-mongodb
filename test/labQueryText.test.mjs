import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveQueryAqlText } from '../src/lib/lab/queryText.js';

test('resolveQueryAqlText prefers the primary aqlText field', () => {
  const value = resolveQueryAqlText({
    aqlText: 'SELECT e/ehr_id/value FROM EHR e',
    normalizedAQL: 'SELECT should_not_win'
  });

  assert.equal(value, 'SELECT e/ehr_id/value FROM EHR e');
});

test('resolveQueryAqlText falls back to normalizedAQL when aqlText is missing', () => {
  const value = resolveQueryAqlText({
    normalizedAQL: 'SELECT c FROM COMPOSITION c'
  });

  assert.equal(value, 'SELECT c FROM COMPOSITION c');
});

test('resolveQueryAqlText supports nested legacy query payloads', () => {
  const value = resolveQueryAqlText({
    query: {
      queryText: 'SELECT o FROM OBSERVATION o'
    }
  });

  assert.equal(value, 'SELECT o FROM OBSERVATION o');
});

test('resolveQueryAqlText returns the provided fallback when no query text exists', () => {
  const value = resolveQueryAqlText({}, 'SELECT s FROM EHR_STATUS s');

  assert.equal(value, 'SELECT s FROM EHR_STATUS s');
});
