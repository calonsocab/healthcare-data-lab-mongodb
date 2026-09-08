import { test } from 'node:test';
import assert from 'node:assert/strict';

const { validateSemanticObject } = await import('../src/lib/semantic/utils.js');

function createBaseSemanticObject(overrides = {}) {
  const rootNode = {
    nodeId: 'n-root',
    parentNodeId: null,
    childrenNodeIds: ['n-status'],
    role: 'group',
    name: 'Root',
    attribute: 'root',
    dataType: 'object',
    occurrences: { min: 1, max: 1 }
  };

  const statusNode = {
    nodeId: 'n-status',
    parentNodeId: 'n-root',
    childrenNodeIds: [],
    role: 'field',
    name: 'Status',
    attribute: 'status',
    dataType: 'code',
    occurrences: { min: 0, max: 1 },
    terminologyBindings: [{ system: 'LOINC', code: 'LA33-6', display: 'Normal' }]
  };

  return {
    id: 'so-test-1',
    name: 'Test Object',
    scope: 'business_object',
    origin: 'custom',
    status: 'draft',
    version: '1.0.0',
    nodes: [rootNode, statusNode],
    ...overrides
  };
}

test('validateSemanticObject accepts legacy scope/origin with warnings', () => {
  const obj = createBaseSemanticObject({
    scope: 'technical',
    origin: 'fhir'
  });

  const result = validateSemanticObject(obj);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((warning) => warning.includes('scope "technical" is legacy')));
  assert.ok(result.warnings.some((warning) => warning.includes('origin "fhir" is legacy')));
});

test('validateSemanticObject rejects non-semver version and invalid structural binding', () => {
  const obj = createBaseSemanticObject({
    version: '1.0',
    structuralBindings: [{ model: 'BadModel', path: '' }]
  });

  const result = validateSemanticObject(obj);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('version must use semantic version format x.y.z')));
  assert.ok(result.errors.some((error) => error.includes('object.structuralBindings[0].model must be one of')));
  assert.ok(result.errors.some((error) => error.includes('object.structuralBindings[0].path is required')));
});

test('validateSemanticObject catches malformed valueSet refs and duplicate terminology bindings', () => {
  const obj = createBaseSemanticObject();
  obj.nodes[1].terminologyBindings = [
    { system: 'LOINC', code: '1234-5', valueSet: 'not_a_ref' },
    { system: 'loinc', code: '1234-5', valueSet: 'http://example.org/fhir/ValueSet/lipid-panel' }
  ];

  const result = validateSemanticObject(obj);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('valueSet must be a URL, URN, or qualified identifier')));
  assert.ok(result.errors.some((error) => error.includes('duplicates terminology binding')));
});

test('validateSemanticObject validates object relationships against node graph', () => {
  const obj = createBaseSemanticObject({
    relationships: [
      {
        relationshipId: 'rel-1',
        type: 'reference',
        sourceNodeId: 'n-status',
        targetNodeId: 'n-root',
        cardinality: 'one_to_one'
      },
      {
        relationshipId: 'rel-1',
        type: 'associated_with',
        sourceNodeId: 'n-missing',
        targetObjectId: 'so-other'
      }
    ]
  });

  const result = validateSemanticObject(obj);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('relationshipId duplicates')));
  assert.ok(result.errors.some((error) => error.includes('sourceNodeId references non-existent node: n-missing')));
});

test('validateSemanticObject validates operational profile shape', () => {
  const obj = createBaseSemanticObject({
    metadata: {
      operationalProfile: {
        writeMode: '',
        readPatterns: ['timeline', 'timeline'],
        queryAxes: ['subject', '']
      }
    }
  });

  const result = validateSemanticObject(obj);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('metadata.operationalProfile.writeMode must be a non-empty string')));
  assert.ok(result.errors.some((error) => error.includes('metadata.operationalProfile.readPatterns[1] duplicates')));
  assert.ok(result.errors.some((error) => error.includes('metadata.operationalProfile.queryAxes[1] must be a non-empty string')));
});

test('validateSemanticObject accepts Splash-aligned field data types', () => {
  const obj = createBaseSemanticObject({
    nodes: [
      {
        nodeId: 'n-root',
        parentNodeId: null,
        childrenNodeIds: ['n-code', 'n-id', 'n-time', 'n-duration', 'n-uri'],
        role: 'group',
        name: 'Root',
        attribute: 'root',
        dataType: 'object',
        occurrences: { min: 1, max: 1 }
      },
      {
        nodeId: 'n-code',
        parentNodeId: 'n-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Diagnosis',
        attribute: 'diagnosis',
        dataType: 'coded_text',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-id',
        parentNodeId: 'n-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Identifier',
        attribute: 'identifier',
        dataType: 'identifier',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-time',
        parentNodeId: 'n-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Clock Time',
        attribute: 'clockTime',
        dataType: 'time',
        timeRole: 'timestamp',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-duration',
        parentNodeId: 'n-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Duration',
        attribute: 'duration',
        dataType: 'duration',
        occurrences: { min: 0, max: 1 }
      },
      {
        nodeId: 'n-uri',
        parentNodeId: 'n-root',
        childrenNodeIds: [],
        role: 'field',
        name: 'Endpoint',
        attribute: 'endpoint',
        dataType: 'uri',
        occurrences: { min: 0, max: 1 }
      }
    ]
  });

  const result = validateSemanticObject(obj);
  assert.equal(result.valid, true);
});

test('validateSemanticObject rejects incompatible role and dataType combinations', () => {
  const obj = createBaseSemanticObject({
    nodes: [
      {
        nodeId: 'n-root',
        parentNodeId: null,
        childrenNodeIds: ['n-events'],
        role: 'group',
        name: 'Root',
        attribute: 'root',
        dataType: 'object',
        occurrences: { min: 1, max: 1 }
      },
      {
        nodeId: 'n-events',
        parentNodeId: 'n-root',
        childrenNodeIds: [],
        role: 'event_series',
        name: 'Events',
        attribute: 'events',
        dataType: 'object',
        occurrences: { min: 0, max: '*' }
      }
    ]
  });

  const result = validateSemanticObject(obj);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('not allowed for role "event_series"')));
});
