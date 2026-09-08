import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const requestOriginPath = path.join(testDir, '..', 'src', 'lib', 'security', 'requestOrigin.js');
const requestOriginSource = fs.readFileSync(requestOriginPath, 'utf8');
const requestOriginEsm = requestOriginSource.replace(/\bexport\s+function\s+/g, 'function ');
const requestOriginModule = await import(
  `data:text/javascript;base64,${Buffer.from(
    `${requestOriginEsm}
export { resolveAllowedOrigins, evaluateApiMutationRequestOrigin };
`,
    'utf8'
  ).toString('base64')}`
);
const { evaluateApiMutationRequestOrigin } = requestOriginModule;

function createRequest({
  method = 'POST',
  pathname = '/api/example',
  appOrigin = 'https://portal.example.com',
  headers = {}
} = {}) {
  const map = new Map();
  for (const [key, value] of Object.entries(headers)) {
    map.set(String(key).toLowerCase(), String(value));
  }
  const parsed = new URL(appOrigin);
  return {
    method,
    nextUrl: {
      pathname,
      origin: parsed.origin,
      protocol: parsed.protocol
    },
    headers: {
      get(name) {
        return map.get(String(name).toLowerCase()) ?? null;
      }
    }
  };
}

test('allows same-origin mutating request with Origin header', () => {
  const verdict = evaluateApiMutationRequestOrigin(createRequest({
    headers: { origin: 'https://portal.example.com' }
  }));
  assert.equal(verdict.ok, true);
});

test('blocks cross-origin mutating request', () => {
  const verdict = evaluateApiMutationRequestOrigin(createRequest({
    headers: { origin: 'https://evil.example.com' }
  }));
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'CSRF_ORIGIN_MISMATCH');
});

test('blocks mutating request when headers are missing', () => {
  const verdict = evaluateApiMutationRequestOrigin(createRequest());
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'CSRF_ORIGIN_REQUIRED');
});

test('allows same-origin sec-fetch-site fallback when origin headers are missing', () => {
  const verdict = evaluateApiMutationRequestOrigin(createRequest({
    headers: { 'sec-fetch-site': 'same-origin' }
  }));
  assert.equal(verdict.ok, true);
});

test('blocks explicit cross-site sec-fetch-site', () => {
  const verdict = evaluateApiMutationRequestOrigin(createRequest({
    headers: { 'sec-fetch-site': 'cross-site' }
  }));
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'CSRF_CROSS_SITE_BLOCKED');
});

test('allows trusted origin from CSRF_TRUSTED_ORIGINS', () => {
  const prev = process.env.CSRF_TRUSTED_ORIGINS;
  process.env.CSRF_TRUSTED_ORIGINS = 'https://admin.example.com';
  try {
    const verdict = evaluateApiMutationRequestOrigin(createRequest({
      headers: { origin: 'https://admin.example.com' }
    }));
    assert.equal(verdict.ok, true);
  } finally {
    if (prev === undefined) delete process.env.CSRF_TRUSTED_ORIGINS;
    else process.env.CSRF_TRUSTED_ORIGINS = prev;
  }
});

test('exempts NextAuth API endpoints', () => {
  const verdict = evaluateApiMutationRequestOrigin(createRequest({
    pathname: '/api/auth/signout'
  }));
  assert.equal(verdict.ok, true);
});
