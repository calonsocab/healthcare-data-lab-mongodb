const PORTABLE_QUERY_EXPORT_TYPE = 'hdl-query-config';
const PORTABLE_QUERY_EXPORT_VERSION = 1;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeTagName(tag) {
  if (typeof tag === 'string') return tag.trim();
  if (tag && typeof tag === 'object' && typeof tag.name === 'string') return tag.name.trim();
  return '';
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  const seen = new Set();
  const out = [];

  for (const tag of tags) {
    const name = normalizeTagName(tag);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  return out;
}

function normalizeAffectedTemplates(templates) {
  if (!Array.isArray(templates)) return [];

  const seen = new Set();
  const out = [];

  for (const template of templates) {
    const id = template?.id ?? template?._id ?? null;
    const name = normalizeText(template?.name).trim();
    const key = `${id || ''}::${name.toLowerCase()}`;

    if ((!id && !name) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...(id ? { id: String(id) } : {}),
      ...(name ? { name } : {}),
    });
  }

  return out;
}

function normalizeStrategyValidations(value) {
  return isPlainObject(value) ? value : {};
}

function normalizePortableQueryShape(source = {}) {
  const normalized = {
    name: normalizeText(source.name).trim(),
    description: normalizeText(source.description),
    uuid: normalizeText(source.uuid),
    tags: normalizeTags(source.tags),
    folderPath: normalizeText(source.folderPath).trim() || null,
    aqlText: normalizeText(source.aqlText),
    normalizedAQL: normalizeText(source.normalizedAQL),
    affectedTemplates: normalizeAffectedTemplates(source.affectedTemplates),
    strategyValidations: normalizeStrategyValidations(source.strategyValidations),
  };

  if (source.conversionStrategy !== undefined) {
    normalized.conversionStrategy = source.conversionStrategy;
  }

  if (source.generatedMql !== undefined) {
    normalized.generatedMql = source.generatedMql;
  }

  return normalized;
}

function getSourceQueryDocument(raw) {
  if (!isPlainObject(raw)) {
    throw new Error('Query file must contain a JSON object.');
  }

  if (raw.exportType === PORTABLE_QUERY_EXPORT_TYPE && isPlainObject(raw.query)) {
    return raw.query;
  }

  return raw;
}

function findFolderByName(folderPath, folders = []) {
  const target = `${folderPath || ''}`.trim().toLowerCase();
  if (!target) return null;
  return folders.find((folder) => `${folder?.name || ''}`.trim().toLowerCase() === target) || null;
}

function findFolderById(folderId, folders = []) {
  const target = folderId == null ? '' : String(folderId);
  if (!target) return null;
  return folders.find((folder) => String(folder?._id || '') === target) || null;
}

function findTemplateMatches(dataModelsByName = {}) {
  const byId = new Map();
  const byName = new Map();

  for (const model of Object.values(dataModelsByName || {})) {
    if (!model?._id) continue;
    byId.set(String(model._id), model);

    const key = `${model.name || ''}`.trim().toLowerCase();
    if (key && !byName.has(key)) {
      byName.set(key, model);
    }
  }

  return { byId, byName };
}

function buildUniqueName(baseName, usedNames = new Set()) {
  const normalizedBase = `${baseName || ''}`.trim() || 'Imported Query';
  const key = normalizedBase.toLowerCase();
  if (!usedNames.has(key)) {
    return normalizedBase;
  }

  let counter = 2;
  while (usedNames.has(`${normalizedBase} (${counter})`.toLowerCase())) {
    counter += 1;
  }
  return `${normalizedBase} (${counter})`;
}

export function resolveFolderPath(folderId, folders = []) {
  return findFolderById(folderId, folders)?.name || null;
}

export function createQueryExportFileName(queryName = 'query') {
  const safeName = `${queryName || 'query'}`
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${safeName || 'query'}_query.json`;
}

export function extractPortableQueryConfig(raw) {
  const source = getSourceQueryDocument(raw);
  const normalized = normalizePortableQueryShape(source);

  if (!normalized.name) {
    throw new Error('Query name is required.');
  }

  if (!normalized.aqlText.trim()) {
    throw new Error('AQL query text is required.');
  }

  return normalized;
}

export function buildPortableQueryExport(query, { folders = [] } = {}) {
  const portableQuery = normalizePortableQueryShape({
    ...query,
    folderPath: resolveFolderPath(query?.folderId, folders),
  });

  return {
    exportType: PORTABLE_QUERY_EXPORT_TYPE,
    version: PORTABLE_QUERY_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    query: portableQuery,
  };
}

export function preparePortableQueryForImport(raw, { folders = [], dataModelsByName = {}, usedNames = new Set() } = {}) {
  const source = getSourceQueryDocument(raw);
  const config = extractPortableQueryConfig(raw);
  const warnings = [];

  let folder = null;
  if (config.folderPath) {
    folder = findFolderByName(config.folderPath, folders);
  }

  if (!folder && source?.folderId) {
    folder = findFolderById(source.folderId, folders);
  }

  if (config.folderPath && !folder) {
    warnings.push(`Folder "${config.folderPath}" was not found, so the query was imported into the root.`);
  }

  const { byId, byName } = findTemplateMatches(dataModelsByName);
  const affectedTemplates = [];
  const matchedTemplateIds = new Set();

  for (const template of config.affectedTemplates) {
    let match = null;
    if (template.id && byId.has(String(template.id))) {
      match = byId.get(String(template.id));
    }

    if (!match && template.name) {
      match = byName.get(template.name.trim().toLowerCase()) || null;
    }

    if (!match?._id || matchedTemplateIds.has(String(match._id))) {
      continue;
    }

    matchedTemplateIds.add(String(match._id));
    affectedTemplates.push({ id: String(match._id), name: match.name || template.name || String(match._id) });
  }

  if (config.affectedTemplates.length > affectedTemplates.length) {
    warnings.push('Some template references could not be matched in this team and were skipped.');
  }

  const name = buildUniqueName(config.name, usedNames);
  if (name !== config.name) {
    warnings.push(`A query named "${config.name}" already existed, so it was imported as "${name}".`);
  }

  usedNames.add(name.toLowerCase());

  const payload = {
    name,
    description: config.description,
    uuid: config.uuid,
    folderId: folder?._id || null,
    tags: config.tags,
    aqlText: config.aqlText,
    normalizedAQL: config.normalizedAQL,
    affectedTemplates,
    strategyValidations: config.strategyValidations,
  };

  if (config.conversionStrategy !== undefined) {
    payload.conversionStrategy = config.conversionStrategy;
  }

  if (config.generatedMql !== undefined) {
    payload.generatedMql = config.generatedMql;
  }

  return {
    payload,
    warnings,
    folderPath: config.folderPath,
    tags: config.tags,
  };
}

