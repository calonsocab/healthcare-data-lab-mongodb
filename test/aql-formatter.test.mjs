import test from 'node:test';
import assert from 'node:assert/strict';

import { formatQueryOnly } from '../src/lib/aqlToMql/formatter/formatter.js';

test('formatQueryOnly expands one-line AQL into readable clause blocks', () => {
  const input = "SELECT c/context/start_time/value AS StartTime, c/uid/value AS compositionId, e/ehr_id/value AS ehrId FROM EHR e[ehr_id/value=$ehrId] CONTAINS VERSION v CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.probs_base_composition.v0] WHERE c/archetype_details/template_id/value='PO_Foetus_pregnancy_follow_up_v0.15_FORMULARIS' ORDER BY v/commit_audit/time_committed/value, c/uid/value";

  const output = formatQueryOnly(input);

  assert.equal(
    output,
    [
      'SELECT',
      '    c/context/start_time/value AS StartTime,',
      '    c/uid/value AS compositionId,',
      '    e/ehr_id/value AS ehrId',
      'FROM',
      '    EHR e[ehr_id/value=$ehrId]',
      '        CONTAINS',
      '            VERSION v',
      '                CONTAINS',
      '                    COMPOSITION c[openEHR-EHR-COMPOSITION.probs_base_composition.v0]',
      'WHERE',
      "    c/archetype_details/template_id/value='PO_Foetus_pregnancy_follow_up_v0.15_FORMULARIS'",
      'ORDER BY',
      '    v/commit_audit/time_committed/value,',
      '    c/uid/value',
    ].join('\n')
  );
});

test('formatQueryOnly keeps commas inside functions and quoted strings intact', () => {
  const input = "SELECT COUNT(c/uid/value) AS total, CONCAT('A,B', c/name/value) AS label FROM EHR e CONTAINS COMPOSITION c";

  const output = formatQueryOnly(input);

  assert.equal(
    output,
    [
      'SELECT',
      '    COUNT(c/uid/value) AS total,',
      "    CONCAT('A,B', c/name/value) AS label",
      'FROM',
      '    EHR e',
      '        CONTAINS',
      '            COMPOSITION c',
    ].join('\n')
  );
});
