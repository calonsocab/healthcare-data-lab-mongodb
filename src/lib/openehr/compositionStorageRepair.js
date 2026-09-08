function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function pickDocumentFields(runtime = {}) {
  return runtime?.autoActivate?.config?.fields?.document
    || runtime?.strategyLink?.mergedConfig?.fields?.document
    || {};
}

function pickCollections(runtime = {}) {
  return runtime?.autoActivate?.config?.collections
    || runtime?.strategyLink?.mergedConfig?.collections
    || {};
}

function buildFilter(compIdField, uid) {
  const clauses = [{ _id: uid }];
  if (compIdField && compIdField !== '_id') {
    clauses.push({ [compIdField]: uid });
  }
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

function asDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildCompositionRepairPlan(runtime = {}, summary = {}) {
  const uid = firstNonEmptyString(summary?.uid);
  const templateId = firstNonEmptyString(summary?.templateId);
  if (!uid || !templateId) {
    return null;
  }

  const collections = pickCollections(runtime);
  const documentFields = pickDocumentFields(runtime);
  const targetDatabase = firstNonEmptyString(
    runtime?.targetDatabase,
    runtime?.strategyLink?.targetDatabase
  );
  const collection = firstNonEmptyString(
    collections?.compositions?.name,
    runtime?.strategyLink?.mergedConfig?.collections?.compositions?.name
  );

  if (!targetDatabase || !collection) {
    return null;
  }

  const compIdField = firstNonEmptyString(documentFields?.comp_id, 'comp_id');
  const templateField = firstNonEmptyString(documentFields?.tid, 'tid');
  const versionField = firstNonEmptyString(documentFields?.v, 'v');
  const timeCommittedField = firstNonEmptyString(documentFields?.time_committed, 'time_committed');
  const sortTimeField = firstNonEmptyString(documentFields?.sort_time);

  const $set = {
    [templateField]: templateId
  };

  const compositionVersion = firstNonEmptyString(summary?.compositionVersion);
  if (compositionVersion) {
    $set[versionField] = compositionVersion;
  }

  const committedAt = asDate(summary?.timeCommitted);
  if (committedAt) {
    $set[timeCommittedField] = committedAt;
    if (sortTimeField) {
      $set[sortTimeField] = committedAt;
    }
  }

  return {
    targetDatabase,
    collection,
    filter: buildFilter(compIdField, uid),
    update: { $set }
  };
}
