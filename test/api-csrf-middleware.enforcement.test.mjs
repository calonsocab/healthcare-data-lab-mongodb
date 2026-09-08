import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');
const middlewarePath = path.join(repoRoot, 'middleware.js');

test('API middleware enforces centralized CSRF/origin validation', () => {
  assert.equal(fs.existsSync(middlewarePath), true, 'middleware.js is missing');
  const source = fs.readFileSync(middlewarePath, 'utf8');
  assert.equal(
    source.includes('evaluateApiMutationRequestOrigin'),
    true,
    'middleware must call evaluateApiMutationRequestOrigin'
  );
  assert.equal(
    source.includes("matcher: ['/api/:path*']"),
    true,
    'middleware matcher must cover API routes'
  );
});

