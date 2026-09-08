import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TEMPLATE_PACKS_DIR,
  loadTemplatePacks,
  validateTemplatePacks,
  exportPackToWebTemplate
} from '../src/lib/contextObjects/template-packs/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_DIR = path.join(__dirname, 'snapshots', 'template-packs');
const VERSION_LOCK_PATH = path.join(TEMPLATE_PACKS_DIR, 'version-lock.json');

function collectCounts(root) {
  let nodeCount = 0;
  let valueNodeCount = 0;
  let repeatingNodeCount = 0;

  const walk = (node) => {
    nodeCount += 1;
    if (/^DV_/.test(`${node?.rmType || ''}`)) valueNodeCount += 1;
    if (typeof node?.max === 'number' && (node.max === -1 || node.max > 1)) repeatingNodeCount += 1;
    (node?.children || []).forEach(walk);
  };

  walk(root);
  return { nodeCount, valueNodeCount, repeatingNodeCount };
}

function major(version = '0.0.0') {
  const parts = `${version}`.split('.').map((item) => Number(item));
  return Number.isFinite(parts[0]) ? parts[0] : 0;
}

test('template packs are valid and snapshot-stable', () => {
  const loaded = loadTemplatePacks(TEMPLATE_PACKS_DIR);
  const issues = validateTemplatePacks(loaded);
  assert.deepEqual(issues, [], `Template pack validation issues:\n- ${issues.join('\n- ')}`);

  assert.ok(fs.existsSync(SNAPSHOT_DIR), 'Missing snapshot directory test/snapshots/template-packs');

  for (const { pack, dictionary } of loaded) {
    const exported = exportPackToWebTemplate(pack, dictionary);
    const snapshotPath = path.join(SNAPSHOT_DIR, `${pack.templateId}.json`);
    assert.ok(fs.existsSync(snapshotPath), `Missing snapshot for ${pack.templateId}`);

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    assert.deepEqual(exported, snapshot, `Snapshot mismatch for ${pack.templateId}`);

    const recomputed = collectCounts(exported);
    assert.deepEqual(
      exported.metadata.counts,
      recomputed,
      `Count mismatch for ${pack.templateId}`
    );
  }
});

test('breaking path changes require major bump or new templateId', () => {
  assert.ok(fs.existsSync(VERSION_LOCK_PATH), 'Missing template version lock file');
  const lock = JSON.parse(fs.readFileSync(VERSION_LOCK_PATH, 'utf8'));
  const lockById = new Map((lock.templates || []).map((item) => [item.templateId, item]));

  const loaded = loadTemplatePacks(TEMPLATE_PACKS_DIR);

  for (const { pack, dictionary } of loaded) {
    const exported = exportPackToWebTemplate(pack, dictionary);
    const prev = lockById.get(pack.templateId);

    if (!prev) {
      continue;
    }

    const pathChanged = `${prev.pathSignature || ''}` !== `${exported.metadata.pathSignature || ''}`;
    if (pathChanged) {
      assert.ok(
        major(exported.metadata.version) > major(prev.version),
        `Breaking path change for ${pack.templateId} requires major bump (${prev.version} -> ${exported.metadata.version})`
      );
    }

    assert.ok(
      major(exported.metadata.version) >= major(prev.version),
      `Template ${pack.templateId} major version cannot go backwards (${prev.version} -> ${exported.metadata.version})`
    );
  }
});
