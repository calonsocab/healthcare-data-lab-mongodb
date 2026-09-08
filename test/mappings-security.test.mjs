import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.join(testDir, '..', 'src', 'lib', 'mappings', 'security.js');
const source = fs.readFileSync(modulePath, 'utf8');
const asEsm = source.replace(/\bexport\s+function\s+/g, 'function ');
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(
    `${asEsm}\nexport { findDisallowedTemplateMarker, buildTemplateSyntaxDisabledError };\n`,
    'utf8'
  ).toString('base64')}`
);

const { findDisallowedTemplateMarker, buildTemplateSyntaxDisabledError } = mod;

test('findDisallowedTemplateMarker returns null for plain YAML', () => {
  const marker = findDisallowedTemplateMarker('compose:\n  content: []\n');
  assert.equal(marker, null);
});

test('findDisallowedTemplateMarker reports marker with line and column', () => {
  const marker = findDisallowedTemplateMarker('compose:\n  value: "{{ patient_name }}"\n');
  assert.equal(marker?.marker, '{{');
  assert.equal(marker?.line, 2);
  assert.equal(marker?.column, 11);
});

test('buildTemplateSyntaxDisabledError returns stable error shape', () => {
  const error = buildTemplateSyntaxDisabledError('Mapping YAML', {
    marker: '{{',
    line: 4,
    column: 9
  });
  assert.equal(error.code, 'JINJA_TEMPLATE_SYNTAX_DISABLED');
  assert.equal(error.error, 'Mapping YAML contains disabled template syntax');
  assert.deepEqual(error.details, {
    marker: '{{',
    line: 4,
    column: 9
  });
});
