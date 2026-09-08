export function extractRuntimeQueryRows(payload) {
  const candidates = [
    payload?.rows,
    payload?.result?.rows,
    payload?.results,
    payload?.result?.results,
    payload?.raw?.rows,
    payload?.raw?.result?.rows,
    payload?.raw?.results,
    payload?.raw?.result?.results,
  ];
  return candidates.find(Array.isArray) || [];
}

export function extractRuntimeQueryColumns(payload, rows = extractRuntimeQueryRows(payload)) {
  const candidates = [
    payload?.columns,
    payload?.result?.columns,
    payload?.raw?.columns,
    payload?.raw?.result?.columns,
  ];
  const explicit = candidates.find(Array.isArray);
  if (explicit) return explicit;

  const explainCandidates = [
    payload?.explain,
    payload?.result?.explain,
    payload?.raw?.explain,
    payload?.raw?.result?.explain,
  ];
  for (const explain of explainCandidates) {
    const pipeline = explain?.plan?.pipeline || explain?.pipeline;
    if (!Array.isArray(pipeline)) continue;
    const projectStage = pipeline.find((stage) => stage && typeof stage === 'object' && stage.$project);
    if (!projectStage?.$project || typeof projectStage.$project !== 'object') continue;
    const names = Object.keys(projectStage.$project).filter((name) => name !== '_id');
    if (names.length > 0) {
      return names.map((name) => ({ name, path: name }));
    }
  }

  const sampleRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (sampleRow && typeof sampleRow === 'object' && !Array.isArray(sampleRow)) {
    return Object.keys(sampleRow).map((name) => ({ name, path: name }));
  }

  return [];
}

export function extractRuntimeProjectionErrors(payload) {
  const candidates = [
    payload?.projectionErrors,
    payload?.result?.projectionErrors,
    payload?.raw?.projectionErrors,
    payload?.raw?.result?.projectionErrors,
  ];
  return candidates.find(Array.isArray) || [];
}

function appendProjectionErrorColumns(columns, projectionErrors) {
  if (!Array.isArray(projectionErrors) || projectionErrors.length === 0) {
    return columns;
  }

  const nextColumns = Array.isArray(columns) ? [...columns] : [];
  projectionErrors.forEach((diagnostic, index) => {
    nextColumns.push({
      name: diagnostic?.alias || `Projection ${index + 1}`,
      path: diagnostic?.aqlPath || diagnostic?.projectionText || diagnostic?.alias || `projection_error_${index + 1}`,
      kind: 'projection_error',
      diagnostic,
    });
  });
  return nextColumns;
}

export function normalizeRuntimeQueryResult(payload) {
  const rows = extractRuntimeQueryRows(payload);
  const projectionErrors = extractRuntimeProjectionErrors(payload);
  const columns = appendProjectionErrorColumns(
    extractRuntimeQueryColumns(payload, rows),
    projectionErrors
  );

  const topLevelMetadata = payload && typeof payload === 'object' ? {
    projectionErrors,
    partialExecution: payload.partialExecution ?? payload.result?.partialExecution ?? false,
    effectiveAql: payload.effectiveAql ?? payload.result?.effectiveAql ?? null,
    requestedAql: payload.requestedAql ?? payload.result?.requestedAql ?? null,
  } : {
    projectionErrors,
    partialExecution: false,
    effectiveAql: null,
    requestedAql: null,
  };

  if (payload?.result && typeof payload.result === 'object') {
    return {
      ...topLevelMetadata,
      ...payload.result,
      rows,
      columns,
      raw: payload,
    };
  }

  return {
    ...(payload && typeof payload === 'object' ? payload : {}),
    ...topLevelMetadata,
    rows,
    columns,
  };
}

export function escapeAqlString(value) {
  return String(value ?? '').replace(/'/g, "''");
}
