import { test } from 'node:test';
import assert from 'node:assert/strict';

const { buildMaskedConnectionStringPreview } = await import('../src/lib/environments/connectionStringPreview.js');

test('buildMaskedConnectionStringPreview masks MongoDB passwords and preserves the target host', () => {
  const uri = [
    'mongodb+srv://atlas-user',
    'placeholder-password',
    '@cluster0.example.test/cdr-informational?retryWrites=true&w=majority',
  ].join(':');
  const preview = buildMaskedConnectionStringPreview(
    uri
  );

  assert.equal(
    preview,
    'mongodb+srv://atlas-user:****@cluster0.example.test/cdr-informational?...'
  );
  assert.equal(preview.includes('placeholder-password'), false);
});

test('buildMaskedConnectionStringPreview supports multi-host MongoDB URIs', () => {
  const uri = [
    'mongodb://app-user',
    'placeholder-secret',
    '@host1.example.test:27017,host2.example.test:27017/cdr?replicaSet=rs0',
  ].join(':');
  const preview = buildMaskedConnectionStringPreview(
    uri
  );

  assert.equal(
    preview,
    'mongodb://app-user:****@host1.example.test:27017,host2.example.test:27017/cdr?...'
  );
  assert.equal(preview.includes('placeholder-secret'), false);
});
