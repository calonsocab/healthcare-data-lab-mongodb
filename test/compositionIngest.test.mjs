import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  normalizeCompositionForIngest,
  summarizeCompositionForIngest
} = await import('../src/lib/openehr/compositionIngest.js');

test('normalizeCompositionForIngest copies canonical template id and derives version metadata', () => {
  const source = {
    archetype_node_id: 'openEHR-EHR-COMPOSITION.probs_base_composition.v0',
    archetype_details: {
      template_id: {
        value: 'PO_Obstetric_process_v0.8_FORMULARIS'
      }
    },
    uid: {
      value: '3c70ca3f-f211-4748-ada1-e7a73bfe53e2::ehrbase.ehrbase.org::2'
    },
    context: {
      start_time: {
        value: '2026-03-26T17:12:48.000Z'
      }
    }
  };

  const normalized = normalizeCompositionForIngest(source);

  assert.equal(normalized.composition.template_id, 'PO_Obstetric_process_v0.8_FORMULARIS');
  assert.equal(normalized.composition.templateId, 'PO_Obstetric_process_v0.8_FORMULARIS');
  assert.equal(normalized.composition.composition_version, '2');
  assert.equal(normalized.composition.version, '2');
  assert.equal(normalized.composition.time_committed, '2026-03-26T17:12:48.000Z');
  assert.equal(normalized.composition.commit_audit.time_committed.value, '2026-03-26T17:12:48.000Z');
  assert.equal(normalized.summary.errors.length, 0);
});

test('summarizeCompositionForIngest flags suspicious template/archetype collisions', () => {
  const summary = summarizeCompositionForIngest({
    archetype_node_id: 'openEHR-EHR-COMPOSITION.probs_base_composition.v0',
    archetype_details: {
      template_id: {
        value: 'openEHR-EHR-COMPOSITION.probs_base_composition.v0'
      }
    }
  });

  assert.equal(summary.errors.length, 0);
  assert.equal(summary.warnings.length, 1);
  assert.match(summary.warnings[0], /matches composition archetype_node_id/i);
});

test('summarizeCompositionForIngest rejects top-level template ids that are really archetype ids', () => {
  const summary = summarizeCompositionForIngest({
    archetype_node_id: 'openEHR-EHR-COMPOSITION.probs_base_composition.v0',
    template_id: 'openEHR-EHR-COMPOSITION.probs_base_composition.v0'
  });

  assert.equal(summary.errors.length, 1);
  assert.match(summary.errors[0], /composition archetype_node_id instead of the canonical template id/i);
});

test('normalizeCompositionForIngest prefers explicit commit metadata over canonical fallbacks', () => {
  const source = {
    archetype_details: {
      template_id: {
        value: 'PO_Attention_to_the_mother_during_labour_v0.19_FORMULARIS'
      }
    },
    uid: {
      value: '3d26fefb-e881-4010-8b06-4bc291ff794e::my-openehr-server::1'
    },
    context: {
      start_time: {
        value: '2026-03-26T17:12:48.000Z'
      }
    }
  };

  const normalized = normalizeCompositionForIngest(source, {
    compositionVersion: '7',
    commit_audit: {
      time_committed: {
        value: '2026-04-14T10:11:12.000Z'
      }
    }
  });

  assert.equal(normalized.composition.composition_version, '7');
  assert.equal(normalized.composition.time_committed, '2026-04-14T10:11:12.000Z');
  assert.equal(normalized.composition.commit_audit.time_committed.value, '2026-04-14T10:11:12.000Z');
});
