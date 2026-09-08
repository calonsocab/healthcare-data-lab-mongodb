import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPortableQueryExport,
  createQueryExportFileName,
  extractPortableQueryConfig,
  preparePortableQueryForImport,
} from '../src/lib/aqlQueries/portableQuery.js';

test('buildPortableQueryExport wraps a query into the portable config shape', () => {
  const payload = buildPortableQueryExport(
    {
      _id: 'query-1',
      name: 'Blood Pressure Query',
      description: 'Returns latest blood pressure observations',
      folderId: 'folder-1',
      tags: [{ name: 'clinical' }, 'Vitals'],
      aqlText: 'SELECT e/ehr_id/value FROM EHR e',
      normalizedAQL: 'SELECT e/ehr_id/value FROM EHR e',
      affectedTemplates: [{ _id: 'template-1', name: 'Vital Signs' }],
    },
    {
      folders: [{ _id: 'folder-1', name: 'Clinical/Vitals' }],
    }
  );

  assert.equal(payload.exportType, 'hdl-query-config');
  assert.equal(payload.version, 1);
  assert.equal(payload.query.folderPath, 'Clinical/Vitals');
  assert.deepEqual(payload.query.tags, ['clinical', 'Vitals']);
  assert.deepEqual(payload.query.affectedTemplates, [{ id: 'template-1', name: 'Vital Signs' }]);
});

test('extractPortableQueryConfig accepts legacy raw query documents', () => {
  const config = extractPortableQueryConfig({
    name: 'Legacy Query',
    description: 'Old export shape',
    aqlText: 'SELECT s FROM EHR_STATUS s',
    tags: ['legacy'],
    affectedTemplates: [{ id: 'template-2', name: 'Status' }],
  });

  assert.equal(config.name, 'Legacy Query');
  assert.equal(config.aqlText, 'SELECT s FROM EHR_STATUS s');
  assert.deepEqual(config.tags, ['legacy']);
  assert.deepEqual(config.affectedTemplates, [{ id: 'template-2', name: 'Status' }]);
});

test('preparePortableQueryForImport remaps folders, templates, and duplicate names', () => {
  const usedNames = new Set(['blood pressure query']);

  const { payload, warnings } = preparePortableQueryForImport(
    {
      exportType: 'hdl-query-config',
      version: 1,
      query: {
        name: 'Blood Pressure Query',
        folderPath: 'Clinical/Vitals',
        tags: ['clinical', 'vitals'],
        aqlText: 'SELECT c FROM COMPOSITION c',
        normalizedAQL: 'SELECT c FROM COMPOSITION c',
        affectedTemplates: [
          { id: 'missing-template-id', name: 'Vital Signs' },
          { id: 'unknown-template-id', name: 'Missing Template' },
        ],
      },
    },
    {
      folders: [{ _id: 'folder-9', name: 'Clinical/Vitals' }],
      dataModelsByName: {
        'template-9': { _id: 'template-9', name: 'Vital Signs' },
      },
      usedNames,
    }
  );

  assert.equal(payload.name, 'Blood Pressure Query (2)');
  assert.equal(payload.folderId, 'folder-9');
  assert.equal(payload.aqlText, 'SELECT c FROM COMPOSITION c');
  assert.deepEqual(payload.affectedTemplates, [{ id: 'template-9', name: 'Vital Signs' }]);
  assert.ok(
    warnings.some((warning) => warning.includes('already existed')),
    'expected duplicate-name warning'
  );
  assert.ok(
    warnings.some((warning) => warning.includes('template references')),
    'expected template-remapping warning'
  );
});

test('createQueryExportFileName produces a filesystem-safe filename', () => {
  assert.equal(createQueryExportFileName('  Blood Pressure / Query  '), 'Blood_Pressure_Query_query.json');
});

