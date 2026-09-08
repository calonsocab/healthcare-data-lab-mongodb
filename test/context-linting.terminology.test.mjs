import { test } from 'node:test';
import assert from 'node:assert/strict';

const { lintContextObjectSchema } = await import('../src/lib/contextObjects/linting.js');

function createBaseNodes(overrides = {}) {
  const rootNode = {
    nodeId: 'n-root',
    parentNodeId: null,
    childrenNodeIds: ['n-code'],
    role: 'group',
    name: 'Root',
    attribute: 'root',
    dataType: 'object',
    occurrences: { min: 1, max: 1 }
  };

  const codeNode = {
    nodeId: 'n-code',
    parentNodeId: 'n-root',
    childrenNodeIds: [],
    role: 'field',
    name: 'Status',
    attribute: 'status',
    dataType: 'code',
    occurrences: { min: 0, max: 1 },
    inputs: [{ terminology: 'local', list: [] }],
    terminologyBindings: []
  };

  const mergedCodeNode = { ...codeNode, ...(overrides.codeNode || {}) };
  return [rootNode, mergedCodeNode];
}

test('lintContextObjectSchema reports missing terminology binding for code node', () => {
  const issues = lintContextObjectSchema({
    nodes: createBaseNodes(),
    context: { scope: 'building_block' }
  });

  assert.ok(
    issues.some((issue) => issue.id === 'terminology.code_binding.missing.n-code'),
    'Expected missing code-binding issue for code node'
  );
});

test('lintContextObjectSchema reports malformed value set and duplicate bindings', () => {
  const issues = lintContextObjectSchema({
    nodes: createBaseNodes({
      codeNode: {
        terminologyBindings: [
          { system: 'LOINC', code: '1234-5', valueSet: 'invalid_ref' },
          { system: 'loinc', code: '1234-5', valueSet: 'http://example.org/fhir/ValueSet/lipid-panel' }
        ]
      }
    }),
    context: { scope: 'building_block' }
  });

  assert.ok(
    issues.some((issue) => issue.id === 'terminology.valueset.invalid.n-code.0'),
    'Expected malformed value-set issue'
  );
  assert.ok(
    issues.some((issue) => issue.id === 'terminology.binding.duplicate.n-code.1'),
    'Expected duplicate terminology binding issue'
  );
});

test('lintContextObjectSchema reports incomplete binding entries', () => {
  const issues = lintContextObjectSchema({
    nodes: createBaseNodes({
      codeNode: {
        terminologyBindings: [{ system: 'LOINC', code: '' }]
      }
    }),
    context: { scope: 'building_block', strictTerminology: true }
  });

  const incomplete = issues.find((issue) => issue.id === 'terminology.binding.incomplete.n-code.0');
  assert.ok(incomplete, 'Expected incomplete terminology binding issue');
  assert.equal(incomplete.severity, 'error');
});

test('lintContextObjectSchema validates relationship target references', () => {
  const nodes = createBaseNodes({
    codeNode: {
      terminologyBindings: [{ system: 'SNOMED-CT', code: '123' }],
      referencedObjectId: 'missing-node'
    }
  });

  const issues = lintContextObjectSchema({
    nodes,
    context: { scope: 'building_block' }
  });

  assert.ok(
    issues.some((issue) => issue.id === 'relationship.target_missing.n-code'),
    'Expected missing relationship target issue'
  );
});
