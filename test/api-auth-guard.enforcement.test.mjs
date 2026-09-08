import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');
const apiRoot = path.join(repoRoot, 'src', 'app', 'api');

const PUBLIC_ROUTES = new Set([
  path.join(apiRoot, 'auth', '[...nextauth]', 'route.js'),
  path.join(apiRoot, 'healthz', 'route.js'),
  path.join(apiRoot, 'kehrnel', 'version', 'route.js'),
  path.join(apiRoot, 'portal', 'access-state', 'route.js'),
  path.join(apiRoot, 'validate-composition', 'route.js')
]);

const GET_SERVER_SESSION_ALLOWED = new Set();

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile() && entry.name === 'route.js') {
      acc.push(full);
    }
  }
  return acc;
}

function hasHttpHandlers(source) {
  return /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/.test(source);
}

test('API routes enforce centralized auth guards', () => {
  const files = walk(apiRoot);
  const missingGuard = [];
  const disallowedSessionReads = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (!hasHttpHandlers(source)) continue;

    const usesGuard =
      source.includes('requireAuthenticatedUser(') ||
      source.includes('requireRelaxedAuthenticatedUser(') ||
      source.includes('requirePlatformAdmin(');

    if (!PUBLIC_ROUTES.has(file) && !usesGuard) {
      missingGuard.push(path.relative(repoRoot, file));
    }

    if (source.includes('getServerSession(') && !GET_SERVER_SESSION_ALLOWED.has(file)) {
      disallowedSessionReads.push(path.relative(repoRoot, file));
    }
  }

  assert.equal(
    missingGuard.length,
    0,
    `Routes missing centralized auth guard:\n${missingGuard.join('\n')}`
  );
  assert.equal(
    disallowedSessionReads.length,
    0,
    `Routes using getServerSession directly (bypass risk):\n${disallowedSessionReads.join('\n')}`
  );
});
