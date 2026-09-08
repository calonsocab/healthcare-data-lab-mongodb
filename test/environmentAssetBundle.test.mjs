import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import {
  TEAM_ASSET_BUNDLE_FORMAT,
  TEAM_ASSET_BUNDLE_VERSION,
  buildAssetBundleManifest,
  createAssetBundleFileName,
  parseBundleCollectionDocuments,
  parseBundleDocuments,
  serializeBundleDocuments,
} from '../src/lib/environments/assetBundle.js';

test('serializeBundleDocuments and parseBundleDocuments preserve MongoDB types', () => {
  const input = [
    {
      _id: new ObjectId('64f0c0c0c0c0c0c0c0c0c0c0'),
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      domainData: {
        source: {
          type: 'opt',
          xml: '<template>very large opt payload</template>',
        },
      },
    },
  ];

  const parsed = parseBundleDocuments(serializeBundleDocuments(input));

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]._id?._bsontype, 'ObjectId');
  assert.equal(parsed[0]._id.toHexString(), '64f0c0c0c0c0c0c0c0c0c0c0');
  assert.equal(parsed[0].createdAt instanceof Date, true);
  assert.equal(parsed[0].createdAt.toISOString(), '2026-04-22T10:00:00.000Z');
  assert.equal(parsed[0].domainData.source.xml, '<template>very large opt payload</template>');
});

test('buildAssetBundleManifest records format metadata and runtime config', () => {
  const manifest = buildAssetBundleManifest({
    sourceEnvironment: {
      id: 'env-dev',
      name: 'DEV',
      database: 'db-dev',
      domainDatabases: { openehr: 'search-dev' },
      strategyLinks: [
        {
          domain: 'openehr',
          strategyId: 'openehr.rps_dual',
          activationId: 'activation-123',
          configOverrides: { mode: 'search' },
        },
      ],
      kehrnel: {
        useDefault: false,
        apiUrl: 'http://kehrnel-dev.local',
        connectionId: 'kehrnel-dev',
      },
    },
    exportedBy: 'owner@example.com',
    collectionSummaries: [
      { collection: 'user-data-models', count: 12 },
      { collection: 'aql-queries', count: 4 },
    ],
  });

  assert.equal(manifest.format, TEAM_ASSET_BUNDLE_FORMAT);
  assert.equal(manifest.version, TEAM_ASSET_BUNDLE_VERSION);
  assert.equal(manifest.exportedBy, 'owner@example.com');
  assert.equal(manifest.sourceEnvironment.name, 'DEV');
  assert.deepEqual(manifest.runtimeConfig.domainDatabases, { openehr: 'search-dev' });
  assert.equal(manifest.runtimeConfig.strategyLinks[0].activationId, null);
  assert.equal(manifest.runtimeConfig.kehrnel.connectionId, 'kehrnel-dev');
  assert.equal(manifest.collections.find((entry) => entry.collection === 'user-data-models')?.count, 12);
});

test('parseBundleCollectionDocuments rewrites environment-bound mapping records for the target environment', () => {
  const serialized = serializeBundleDocuments([
    {
      _id: new ObjectId('64f0c0c0c0c0c0c0c0c0c0c1'),
      templateName: 'Vitals',
      environmentId: 'env-source',
      createdAt: new Date('2026-04-22T10:05:00.000Z'),
    },
  ]);

  const parsed = parseBundleCollectionDocuments('jsonld-mappings', serialized, {
    targetEnvironment: { id: 'env-target' },
  });

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]._id?._bsontype, 'ObjectId');
  assert.equal(parsed[0].environmentId, 'env-target');
  assert.equal(parsed[0].createdAt instanceof Date, true);
});

test('createAssetBundleFileName generates a safe zip filename', () => {
  assert.equal(createAssetBundleFileName('CatSalut PRE / PROD'), 'CatSalut_PRE_PROD_asset_bundle.zip');
});
