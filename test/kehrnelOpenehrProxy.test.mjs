import { test } from 'node:test';
import assert from 'node:assert/strict';

const { buildUpstreamProxyResponse } = await import('../src/lib/kehrnel/proxyResponse.js');

test('buildUpstreamProxyResponse returns a bodyless response for 204 deletes', async () => {
  const upstreamRes = new Response(null, {
    status: 204,
    headers: {
      'content-type': 'application/json',
      etag: '"abc123"'
    }
  });

  const response = buildUpstreamProxyResponse({
    method: 'DELETE',
    upstreamRes,
    text: ''
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('content-type'), null);
  assert.equal(response.headers.get('etag'), '"abc123"');
  assert.equal(await response.text(), '');
});

test('buildUpstreamProxyResponse preserves body and content type for normal responses', async () => {
  const upstreamRes = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json'
    }
  });

  const response = buildUpstreamProxyResponse({
    method: 'GET',
    upstreamRes,
    text: '{"ok":true}'
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(await response.text(), '{"ok":true}');
});
