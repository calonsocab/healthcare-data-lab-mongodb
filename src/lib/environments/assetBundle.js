import { EJSON } from 'bson';
import {
  PROMOTABLE_ENVIRONMENT_ASSETS,
  extractPromotableRuntimeConfig,
  prepareDocumentsForPromotion,
} from './promotion.js';

export const TEAM_ASSET_BUNDLE_FORMAT = 'hdl-team-asset-bundle';
export const TEAM_ASSET_BUNDLE_VERSION = 1;
// Keep room for ZIP bundles carrying large OPT-heavy data-model documents while
// still capping uploads before they become unreasonable for an in-memory parse.
export const TEAM_ASSET_BUNDLE_MAX_BYTES = 256 * 1024 * 1024;

function sanitizeFilePart(value = '') {
  return String(value || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function createAssetBundleFileName(environmentName = 'environment') {
  const safeName = sanitizeFilePart(environmentName) || 'environment';
  return `${safeName}_asset_bundle.zip`;
}

export function getAssetCollectionFilePath(collectionName = '') {
  return `collections/${collectionName}.ndjson`;
}

export function serializeBundleDocuments(documents = []) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return '';
  }

  return documents
    .map((document) => EJSON.stringify(document, { relaxed: false }))
    .join('\n');
}

export function parseBundleDocuments(serialized = '') {
  const text = String(serialized || '').trim();
  if (!text) return [];

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => EJSON.parse(line));
}

export function parseBundleCollectionDocuments(
  collectionName,
  serialized = '',
  { targetEnvironment = {} } = {}
) {
  const documents = parseBundleDocuments(serialized);
  return prepareDocumentsForPromotion(collectionName, documents, { targetEnvironment });
}

export function buildAssetBundleManifest({
  sourceEnvironment = {},
  exportedBy = '',
  collectionSummaries = [],
} = {}) {
  return {
    format: TEAM_ASSET_BUNDLE_FORMAT,
    version: TEAM_ASSET_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: exportedBy || null,
    sourceEnvironment: {
      id: sourceEnvironment?.id || null,
      name: sourceEnvironment?.name || null,
      database: sourceEnvironment?.database || null,
    },
    runtimeConfig: extractPromotableRuntimeConfig(sourceEnvironment),
    collections: PROMOTABLE_ENVIRONMENT_ASSETS.map((asset) => {
      const match = collectionSummaries.find((summary) => summary.collection === asset.collection);
      return {
        collection: asset.collection,
        label: asset.label,
        path: getAssetCollectionFilePath(asset.collection),
        count: match?.count || 0,
      };
    }),
  };
}
