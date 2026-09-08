import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, '..');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.git') || entry.name === 'node_modules' || entry.name === 'test' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile() && /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

test('no hardcoded Kehrnel paths are present', () => {
  const files = walk(repoRoot);
  const banned = [/\/v1\/query/, /\/v1\/compile_query/];
  const offenders = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('test/')) continue;
    for (const pattern of banned) {
      if (pattern.test(content)) {
        offenders.push(file);
        break;
      }
    }
  }

  assert.equal(offenders.length, 0, `Found hardcoded Kehrnel paths in: ${offenders.join(', ')}`);
});

// HDL-KHR-014: Guard against DB catalog usage in Strategy Studio
test('Strategy Studio does not use DB catalog endpoint', () => {
  const files = walk(repoRoot);
  const strategyStudioBanned = [
    /\/api\/persistence-strategies/,  // Must use /api/kehrnel/catalog
  ];
  const offenders = [];

  for (const file of files) {
    // Only check files in strategyStudio directory
    if (!file.includes('strategyStudio')) continue;

    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of strategyStudioBanned) {
      if (pattern.test(content)) {
        offenders.push({ file, pattern: pattern.toString() });
        break;
      }
    }
  }

  assert.equal(
    offenders.length,
    0,
    `Strategy Studio must use /api/kehrnel/catalog. Found DB catalog in:\n${offenders.map(o => `  ${o.file}`).join('\n')}`
  );
});

// HDL-KHR-014: Guard against legacy blueprint model in Strategy Studio
test('Strategy Studio uses domain-first model (no blueprint.*)', () => {
  const files = walk(repoRoot);
  const legacyPatterns = [
    /strategy\.blueprint\??\.protocol/,   // Use strategy.domain (matches both . and ?.)
    /strategy\.blueprint\??\.domain/,     // Use strategy.domain
    /strategy\.blueprint\??\.summary/,    // Use strategy.description
    /strategy\.blueprint\??\.composability/, // Not in Kehrnel model
    /strategy\.ownerType/,                // Not needed for Kehrnel
    /extractDomainFromId/,                // Domain comes from Kehrnel
  ];
  const offenders = [];

  for (const file of files) {
    // Only check files in strategyStudio directory
    if (!file.includes('strategyStudio')) continue;

    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of legacyPatterns) {
      if (pattern.test(content)) {
        offenders.push({ file, pattern: pattern.toString() });
      }
    }
  }

  assert.equal(
    offenders.length,
    0,
    `Strategy Studio must use domain-first model. Found legacy blueprint usage in:\n${offenders.map(o => `  ${o.file}: ${o.pattern}`).join('\n')}`
  );
});

// HDL-KHR-019: Guard against system endpoints in Strategy API Explorer
test('StrategyAPIExplorer does not include system endpoints', () => {
  const explorerPath = path.join(repoRoot, 'src/components/views/strategyStudio/StrategyManager/components/StrategyAPIExplorer.jsx');

  if (!fs.existsSync(explorerPath)) {
    // Skip if file doesn't exist (might be renamed)
    return;
  }

  const content = fs.readFileSync(explorerPath, 'utf8');

  // These system endpoints should be in KehrnelSettings, not StrategyAPIExplorer
  const systemEndpointPatterns = [
    { pattern: /id:\s*['"]health['"]/, name: 'health endpoint' },
    { pattern: /id:\s*['"]strategies-list['"]/, name: 'strategies-list endpoint' },
    { pattern: /id:\s*['"]strategies-activate['"]/, name: 'strategies-activate endpoint' },
    { pattern: /category:\s*['"]System['"]/, name: 'System category' },
    { pattern: /path:\s*['"]\/health['"]/, name: '/health path' },
    { pattern: /path:\s*['"]\/v1\/strategies['"],/, name: '/v1/strategies path (bare)' },
    { pattern: /path:\s*['"]\/v1\/strategies\/activate['"]/, name: '/v1/strategies/activate path' },
  ];

  const offenders = [];
  for (const { pattern, name } of systemEndpointPatterns) {
    if (pattern.test(content)) {
      offenders.push(name);
    }
  }

  assert.equal(
    offenders.length,
    0,
    `StrategyAPIExplorer should not include system endpoints (these belong in KehrnelSettings). Found:\n${offenders.map(o => `  - ${o}`).join('\n')}`
  );
});
