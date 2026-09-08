import { ensureTemplateIndexes } from '@/lib/db/connectionManager';

const DATA_MODEL_COLLECTION = 'user-data-models';
const CONTEXT_DOMAIN = 'contextobject';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function countByKey(items, key) {
  const counts = {};
  for (const item of items) {
    const rawValue = item?.[key];
    if (!rawValue || typeof rawValue !== 'string') continue;
    counts[rawValue] = (counts[rawValue] || 0) + 1;
  }
  return counts;
}

function detectRootNode(nodes = []) {
  return nodes.find((node) => node?.parentNodeId == null) || null;
}

function computeSourceSize(semanticObject) {
  try {
    return Buffer.byteLength(JSON.stringify(semanticObject), 'utf8');
  } catch {
    return null;
  }
}

function normalizeModelType(scope) {
  return typeof scope === 'string' && scope ? scope : 'business_object';
}

function normalizeKind(scope, kind) {
  if (typeof kind === 'string' && kind) return kind;
  return normalizeModelType(scope) === 'building_block' ? 'block' : 'context_object';
}

function buildDomainMetadata(semanticObject = {}) {
  const nodes = safeArray(semanticObject.nodes);
  const roleCounts = countByKey(nodes, 'role');
  const dataTypeCounts = countByKey(nodes, 'dataType');
  const rootNode = detectRootNode(nodes);

  return {
    id: semanticObject.id || null,
    scope: semanticObject.scope || null,
    origin: semanticObject.origin || null,
    kind: semanticObject.kind || null,
    status: semanticObject.status || null,
    version: semanticObject.version || null,
    versionString: semanticObject.versionString || semanticObject.version || null,
    nodeCount: nodes.length,
    fieldCount: roleCounts.field || 0,
    groupCount: roleCounts.group || 0,
    sectionCount: roleCounts.section || 0,
    roleCounts,
    dataTypeCounts,
    hasTerminologyBindings: safeArray(semanticObject.terminologyBindings).length > 0,
    hasStructuralBindings: safeArray(semanticObject.structuralBindings).length > 0,
    rootNodeId: rootNode?.nodeId || null,
    tags: safeArray(semanticObject.metadata?.tags),
    createdBy: semanticObject.metadata?.createdBy || null,
    createdAt: semanticObject.metadata?.createdAt || null,
    updatedAt: semanticObject.metadata?.updatedAt || null,
  };
}

function buildContextObjectDataModelDocument(semanticObject, existingDoc = null, actorEmail = 'unknown') {
  const now = new Date();
  const semanticMetadata = semanticObject?.metadata || {};
  const tags = safeArray(semanticMetadata.tags).length
    ? safeArray(semanticMetadata.tags)
    : safeArray(existingDoc?.metadata?.tags);

  const modelType = normalizeModelType(semanticObject?.scope || existingDoc?.modelType);
  const status = semanticObject?.status || existingDoc?.status || 'draft';
  const templateVersion = semanticObject?.versionString || semanticObject?.version || existingDoc?.templateVersion || null;
  const semanticObjectId = semanticObject?.id || existingDoc?.metadata?.semanticObjectId || null;

  return {
    name: semanticObject?.name || existingDoc?.name || 'Untitled ContextObject',
    domain: CONTEXT_DOMAIN,
    modelType,
    status,
    templateVersion,
    description: semanticObject?.description || '',
    domainData: {
      schema: semanticObject,
      source: {
        type: 'builder',
        fileName: null,
        contentType: 'application/json',
        size: computeSourceSize(semanticObject),
      },
    },
    metadata: {
      ...(existingDoc?.metadata || {}),
      semanticObjectId,
      scope: modelType,
      kind: normalizeKind(modelType, semanticObject?.kind || existingDoc?.metadata?.kind),
      origin: semanticObject?.origin || existingDoc?.metadata?.origin || 'custom',
      status,
      tags,
      createdAt: existingDoc?.metadata?.createdAt || semanticMetadata.createdAt || now.toISOString(),
      createdBy: existingDoc?.metadata?.createdBy || semanticMetadata.createdBy || actorEmail,
      updatedAt: semanticMetadata.updatedAt || now.toISOString(),
      updatedBy: actorEmail,
      domainMetadata: buildDomainMetadata(semanticObject),
    },
    audit: {
      createdAt: existingDoc?.audit?.createdAt || now,
      createdBy: existingDoc?.audit?.createdBy || actorEmail,
      updatedAt: now,
      updatedBy: actorEmail,
    },
  };
}

async function findExistingContextObjectDataModel(col, semanticObject) {
  const semanticObjectId = semanticObject?.id;
  if (semanticObjectId) {
    const byMetadataId = await col.findOne({
      domain: CONTEXT_DOMAIN,
      'metadata.semanticObjectId': semanticObjectId,
    });
    if (byMetadataId) return byMetadataId;

    const bySchemaId = await col.findOne({
      domain: CONTEXT_DOMAIN,
      'domainData.schema.id': semanticObjectId,
    });
    if (bySchemaId) return bySchemaId;
  }

  if (!semanticObjectId && semanticObject?.name) {
    return col.findOne({
      domain: CONTEXT_DOMAIN,
      name: semanticObject.name,
    });
  }

  return null;
}

export async function upsertContextObjectDataModel(db, semanticObject, actorEmail = 'unknown') {
  if (!semanticObject || typeof semanticObject !== 'object') {
    throw new Error('semanticObject is required to sync user-data-models');
  }

  await ensureTemplateIndexes(db);
  const col = db.collection(DATA_MODEL_COLLECTION);
  const existing = await findExistingContextObjectDataModel(col, semanticObject);
  const doc = buildContextObjectDataModelDocument(semanticObject, existing, actorEmail);

  if (existing?._id) {
    await col.updateOne({ _id: existing._id }, { $set: doc });
    return existing._id;
  }

  const res = await col.insertOne(doc);
  return res.insertedId;
}

export async function deleteContextObjectDataModels(db, semanticObjectId) {
  if (!semanticObjectId) return;

  await ensureTemplateIndexes(db);
  await db.collection(DATA_MODEL_COLLECTION).deleteMany({
    domain: CONTEXT_DOMAIN,
    $or: [
      { 'metadata.semanticObjectId': semanticObjectId },
      { 'domainData.schema.id': semanticObjectId },
    ],
  });
}
