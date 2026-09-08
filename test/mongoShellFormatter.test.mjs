import { test } from 'node:test';
import assert from 'node:assert/strict';

const { stringifyMongoShell } = await import('../src/lib/kehrnel/mongoShellFormatter.js');

test('stringifyMongoShell renders ISO timestamps as Mongo shell ISODate literals', () => {
  const pipeline = [
    {
      $match: {
        tid: 'PO_Obstetric_process_v0.8_FORMULARIS',
        time_c: {
          $gte: '2017-04-14T17:29:47.785000+00:00',
          $lt: '2026-04-15T17:29:47.786000+00:00',
        },
      },
    },
  ];

  const rendered = stringifyMongoShell(pipeline, 2);

  assert.match(rendered, /\$gte": ISODate\("2017-04-14T17:29:47\.785000\+00:00"\)/);
  assert.match(rendered, /\$lt": ISODate\("2026-04-15T17:29:47\.786000\+00:00"\)/);
  assert.doesNotMatch(rendered, /\$gte": "2017-04-14T17:29:47\.785000\+00:00"/);
  assert.doesNotMatch(rendered, /\$lt": "2026-04-15T17:29:47\.786000\+00:00"/);
});

test('stringifyMongoShell supports extended json dates too', () => {
  const rendered = stringifyMongoShell({
    createdAt: { $date: '2026-04-15T17:29:47.786000+00:00' },
  });

  assert.equal(
    rendered,
    '{\n  "createdAt": ISODate("2026-04-15T17:29:47.786000+00:00")\n}'
  );
});
