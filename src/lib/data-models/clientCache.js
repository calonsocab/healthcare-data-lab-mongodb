// src/lib/data-models/clientCache.js

const MAX_DETAIL_CACHE_ENTRIES = 60;

const detailCache = new Map();
const inflightRequests = new Map();

function hasTree(model) {
  return Array.isArray(model?.webTemplate?.children) && model.webTemplate.children.length > 0;
}

function hasData(model) {
  return model?.data !== undefined && model?.data !== null;
}

function hasXml(model) {
  return typeof model?.source?.xml === 'string' && model.source.xml.length > 0;
}

function normalizeIncludes(include) {
  if (!include) return [];
  if (Array.isArray(include)) return include.filter(Boolean);
  if (include instanceof Set) return Array.from(include).filter(Boolean);
  if (typeof include === 'string') return include.split(',').map((x) => x.trim()).filter(Boolean);
  return [];
}

function getRequestKey(id, includes) {
  return `${id}|${includes.slice().sort().join(',')}`;
}

function touchCacheKey(id) {
  const entry = detailCache.get(id);
  if (!entry) return;
  detailCache.delete(id);
  detailCache.set(id, entry);
}

function enforceCacheLimit() {
  while (detailCache.size > MAX_DETAIL_CACHE_ENTRIES) {
    const oldest = detailCache.keys().next().value;
    if (!oldest) break;
    detailCache.delete(oldest);
  }
}

function mergeModels(baseModel, incomingModel) {
  if (!baseModel) return incomingModel;
  if (!incomingModel) return baseModel;

  const mergedSource = {
    ...(baseModel.source || {}),
    ...(incomingModel.source || {}),
  };

  let mergedTree = incomingModel.webTemplate ?? baseModel.webTemplate;
  if (!hasTree(incomingModel) && hasTree(baseModel)) {
    mergedTree = baseModel.webTemplate;
  }

  return {
    ...baseModel,
    ...incomingModel,
    source: Object.keys(mergedSource).length ? mergedSource : undefined,
    metadata: {
      ...(baseModel.metadata || {}),
      ...(incomingModel.metadata || {}),
    },
    webTemplate: mergedTree,
    data: incomingModel.data !== undefined ? incomingModel.data : baseModel.data,
  };
}

function needsFetch(entry, includes) {
  if (!entry) return true;
  if (includes.includes('tree') && !entry.hasTree) return true;
  if (includes.includes('data') && !entry.hasData) return true;
  if (includes.includes('xml') && !entry.hasXml) return true;
  return false;
}

export function getCachedDataModel(id) {
  if (!id) return null;
  const entry = detailCache.get(id);
  if (!entry) return null;
  touchCacheKey(id);
  return entry.model;
}

export function setCachedDataModel(model, opts = {}) {
  const id = model?._id;
  if (!id) return null;

  const existing = detailCache.get(id);
  const merged = mergeModels(existing?.model, model);

  detailCache.set(id, {
    model: merged,
    hasTree: opts.hasTree ?? hasTree(merged),
    hasData: opts.hasData ?? hasData(merged),
    hasXml: opts.hasXml ?? hasXml(merged),
    cachedAt: Date.now(),
  });

  touchCacheKey(id);
  enforceCacheLimit();
  return merged;
}

export function primeDataModelSummaryList(items = []) {
  for (const item of items) {
    if (!item?._id) continue;
    setCachedDataModel(item, { hasTree: hasTree(item), hasData: hasData(item), hasXml: hasXml(item) });
  }
}

export function invalidateDataModelCache(id) {
  if (!id) return;
  detailCache.delete(id);
}

export function clearDataModelCache() {
  detailCache.clear();
  inflightRequests.clear();
}

export async function fetchDataModelDetail(id, { include, seedModel } = {}) {
  if (!id) throw new Error('id is required');

  const includes = normalizeIncludes(include);
  if (seedModel?._id) setCachedDataModel(seedModel);

  const cachedEntry = detailCache.get(id);
  if (!needsFetch(cachedEntry, includes)) {
    touchCacheKey(id);
    return cachedEntry.model;
  }

  const requestKey = getRequestKey(id, includes);
  if (inflightRequests.has(requestKey)) {
    return inflightRequests.get(requestKey);
  }

  const includeParam = includes.length ? `?include=${encodeURIComponent(includes.join(','))}` : '';
  const requestPromise = (async () => {
    const res = await fetch(`/api/data-model-catalog/${id}${includeParam}`);
    if (!res.ok) throw new Error(`Failed to fetch data model ${id}`);
    const doc = await res.json();
    const cached = detailCache.get(id)?.model || null;
    return setCachedDataModel(mergeModels(mergeModels(seedModel, cached), doc));
  })();

  inflightRequests.set(requestKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(requestKey);
  }
}
