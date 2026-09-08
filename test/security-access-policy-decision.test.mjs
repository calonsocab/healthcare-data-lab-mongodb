import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const accessPolicyPath = path.join(testDir, '..', 'src', 'lib', 'security', 'accessPolicyDecision.js');
const accessPolicySource = fs.readFileSync(accessPolicyPath, 'utf8');
const accessPolicyEsm = accessPolicySource.replace(/\bexport\s+function\s+/g, 'function ');
const accessPolicyModule = await import(
  `data:text/javascript;base64,${Buffer.from(
    `${accessPolicyEsm}
export { decideAccessGate };
`,
    'utf8'
  ).toString('base64')}`
);
const { decideAccessGate } = accessPolicyModule;

test('maintenance mode is denied by default', () => {
  const result = decideAccessGate({
    portalMode: 'maintenance',
    sessionAccessKey: 'k1',
    liveAccessKey: 'k1'
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.body?.code, 'MAINTENANCE_MODE');
});

test('stale session key is denied', () => {
  const result = decideAccessGate({
    portalMode: 'normal',
    sessionAccessKey: 'k1',
    liveAccessKey: 'k2'
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.body?.code, 'SESSION_ACCESS_STALE');
});

test('blocked user is denied', () => {
  const result = decideAccessGate({
    portalMode: 'normal',
    sessionAccessKey: 'k1',
    liveAccessKey: 'k1',
    userAccessStatus: 'blocked',
    userAccessReason: 'manual_block'
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.body?.code, 'ACCESS_BLOCKED');
});

test('pending preview request is denied when onboarding block is enabled', () => {
  const result = decideAccessGate({
    portalMode: 'normal',
    sessionAccessKey: 'k1',
    liveAccessKey: 'k1',
    evaluationAccess: 'pending',
    evaluationAllowlisted: false,
    evaluationEffectiveMode: 'allowlist_only'
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.body?.code, 'PREVIEW_ACCESS_REQUIRED');
  assert.equal(result.body?.access, 'pending');
});

test('relaxed onboarding option can allow pending users', () => {
  const result = decideAccessGate({
    portalMode: 'normal',
    sessionAccessKey: 'k1',
    liveAccessKey: 'k1',
    evaluationAccess: 'pending',
    allowOnboardingBlocked: true
  });
  assert.equal(result.ok, true);
});
