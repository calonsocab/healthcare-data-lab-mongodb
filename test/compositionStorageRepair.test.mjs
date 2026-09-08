import { test } from 'node:test';
import assert from 'node:assert/strict';

const { buildCompositionRepairPlan } = await import('../src/lib/openehr/compositionStorageRepair.js');

test('buildCompositionRepairPlan maps root tid to canonical template id', () => {
  const runtime = {
    targetDatabase: 'cdr-informational',
    autoActivate: {
      config: {
        collections: {
          compositions: {
            name: 'compositions_rps'
          }
        },
        fields: {
          document: {
            comp_id: 'comp_id',
            tid: 'tid',
            v: 'v',
            time_committed: 'time_committed',
            sort_time: 'sort_time'
          }
        }
      }
    }
  };

  const summary = {
    uid: '49b9c20c-2232-4fd7-8bf8-9186b4f0c87b::my-openehr-server::1',
    templateId: 'PO_Care_of_newborn_and_fetus_1-n_during_childbirth_v0.13_FORMULARIS',
    compositionVersion: '1',
    timeCommitted: '2026-04-14T20:25:43.412Z'
  };

  const plan = buildCompositionRepairPlan(runtime, summary);

  assert.equal(plan.targetDatabase, 'cdr-informational');
  assert.equal(plan.collection, 'compositions_rps');
  assert.deepEqual(plan.filter, {
    $or: [
      { _id: '49b9c20c-2232-4fd7-8bf8-9186b4f0c87b::my-openehr-server::1' },
      { comp_id: '49b9c20c-2232-4fd7-8bf8-9186b4f0c87b::my-openehr-server::1' }
    ]
  });
  assert.equal(plan.update.$set.tid, 'PO_Care_of_newborn_and_fetus_1-n_during_childbirth_v0.13_FORMULARIS');
  assert.equal(plan.update.$set.v, '1');
  assert.ok(plan.update.$set.time_committed instanceof Date);
  assert.ok(plan.update.$set.sort_time instanceof Date);
});

test('buildCompositionRepairPlan respects custom document field names', () => {
  const runtime = {
    targetDatabase: 'cdr',
    autoActivate: {
      config: {
        collections: {
          compositions: {
            name: 'custom_compositions'
          }
        },
        fields: {
          document: {
            comp_id: 'composition_id',
            tid: 'template_id',
            v: 'version_number',
            time_committed: 'committed_at'
          }
        }
      }
    }
  };

  const plan = buildCompositionRepairPlan(runtime, {
    uid: 'abc::server::2',
    templateId: 'MY_TEMPLATE',
    compositionVersion: '2',
    timeCommitted: '2026-01-01T00:00:00.000Z'
  });

  assert.equal(plan.collection, 'custom_compositions');
  assert.deepEqual(plan.filter, {
    $or: [
      { _id: 'abc::server::2' },
      { composition_id: 'abc::server::2' }
    ]
  });
  assert.equal(plan.update.$set.template_id, 'MY_TEMPLATE');
  assert.equal(plan.update.$set.version_number, '2');
  assert.ok(plan.update.$set.committed_at instanceof Date);
});
