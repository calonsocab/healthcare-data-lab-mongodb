import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/environments/[envId]/query/route.js
/**
 * Execute AQL Query
 *
 * Executes an AQL query via Kehrnel against the environment's database.
 */
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { getCoreDb } from '../../../../../../lib/db/coreDb.js';
import { requireAccessibleEnvironment } from '../../../../../../lib/environments/requireEnvironmentAccess.js';
import { createKehrnelService } from '../../../../../../lib/kehrnel/KehrnelService.js';
import { resolveRuntimeContext, normalizeDomain } from '../../../../../../lib/kehrnel/runtimeContext.js';
import { safeUpstreamError } from '../../../../../../lib/security/api.js';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '../../../../../../lib/security/environmentControls.js';

const MAX_UNRESOLVED_PROJECTION_RETRIES = 8;
const MAX_SANDBOX_QUERY_ROWS = 100;

function normalizeSandboxQueryOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return { limit: MAX_SANDBOX_QUERY_ROWS };
  }

  const parsedLimit = Number.parseInt(String(options.limit ?? ''), 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, MAX_SANDBOX_QUERY_ROWS)
    : MAX_SANDBOX_QUERY_ROWS;

  return {
    ...options,
    limit,
  };
}

function normalizeNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizePositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isWhitespace(char) {
  return /\s/.test(char);
}

function isWordBoundaryChar(char) {
  return !char || !/[A-Za-z0-9_]/.test(char);
}

function findTopLevelKeyword(aql, keyword, startIndex = 0) {
  const needle = String(keyword || '').toUpperCase();
  if (!needle) return -1;

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;
  let roundDepth = 0;
  let squareDepth = 0;
  let curlyDepth = 0;

  for (let index = startIndex; index < aql.length; index += 1) {
    const char = aql[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (!inDoubleQuote && char === '\'') {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (!inSingleQuote && char === '"') {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) continue;

    if (char === '(') roundDepth += 1;
    else if (char === ')') roundDepth = Math.max(0, roundDepth - 1);
    else if (char === '[') squareDepth += 1;
    else if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
    else if (char === '{') curlyDepth += 1;
    else if (char === '}') curlyDepth = Math.max(0, curlyDepth - 1);

    if (roundDepth > 0 || squareDepth > 0 || curlyDepth > 0) continue;

    if (aql.slice(index, index + needle.length).toUpperCase() !== needle) continue;

    const before = aql[index - 1];
    const after = aql[index + needle.length];
    if (!isWordBoundaryChar(before) || !isWordBoundaryChar(after)) continue;

    return index;
  }

  return -1;
}

function enforceAqlResultWindow(aql, options = {}) {
  const requestedLimit = normalizePositiveInteger(options.limit);
  const hardLimit = requestedLimit
    ? Math.min(requestedLimit, MAX_SANDBOX_QUERY_ROWS)
    : MAX_SANDBOX_QUERY_ROWS;
  const requestedOffset = normalizeNonNegativeInteger(options.offset);

  const limitIndex = findTopLevelKeyword(aql, 'LIMIT');
  const offsetIndex = findTopLevelKeyword(aql, 'OFFSET');
  const clauseIndex = [limitIndex, offsetIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;

  let baseAql = String(aql || '').trimEnd().replace(/;\s*$/, '');
  let existingLimit = null;
  let existingOffset = null;

  if (clauseIndex >= 0) {
    const clauseText = baseAql.slice(clauseIndex);
    const limitMatch = clauseText.match(/\bLIMIT\s+(\d+)\b/i);
    const offsetMatch = clauseText.match(/\bOFFSET\s+(\d+)\b/i);
    existingLimit = normalizePositiveInteger(limitMatch?.[1]);
    existingOffset = normalizeNonNegativeInteger(offsetMatch?.[1]);
    baseAql = baseAql.slice(0, clauseIndex).trimEnd();
  }

  const effectiveLimit = existingLimit ? Math.min(existingLimit, hardLimit) : hardLimit;
  const effectiveOffset = requestedOffset ?? existingOffset;
  const limitClause = effectiveOffset != null
    ? `LIMIT ${effectiveLimit} OFFSET ${effectiveOffset}`
    : `LIMIT ${effectiveLimit}`;

  return `${baseAql}\n${limitClause}`;
}

function indexToLineColumn(aql, index) {
  let line = 1;
  let column = 1;

  for (let cursor = 0; cursor < index && cursor < aql.length; cursor += 1) {
    if (aql[cursor] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function parseSelectColumns(aql) {
  const selectIndex = findTopLevelKeyword(aql, 'SELECT');
  if (selectIndex === -1) return null;

  const fromIndex = findTopLevelKeyword(aql, 'FROM', selectIndex + 'SELECT'.length);
  if (fromIndex === -1) return null;

  let bodyStart = selectIndex + 'SELECT'.length;
  while (bodyStart < fromIndex && isWhitespace(aql[bodyStart])) bodyStart += 1;

  if (aql.slice(bodyStart, bodyStart + 'DISTINCT'.length).toUpperCase() === 'DISTINCT') {
    const before = aql[bodyStart - 1];
    const after = aql[bodyStart + 'DISTINCT'.length];
    if (isWordBoundaryChar(before) && isWordBoundaryChar(after)) {
      bodyStart += 'DISTINCT'.length;
      while (bodyStart < fromIndex && isWhitespace(aql[bodyStart])) bodyStart += 1;
    }
  }

  const selectBody = aql.slice(bodyStart, fromIndex);
  const columns = [];

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;
  let roundDepth = 0;
  let squareDepth = 0;
  let curlyDepth = 0;
  let segmentStart = 0;

  const pushSegment = (segmentEnd) => {
    const raw = selectBody.slice(segmentStart, segmentEnd);
    const leadingWhitespaceMatch = raw.match(/^\s*/);
    const trailingWhitespaceMatch = raw.match(/\s*$/);
    const trimmed = raw.trim();
    if (!trimmed) return;

    const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0].length : 0;
    const trailingWhitespace = trailingWhitespaceMatch ? trailingWhitespaceMatch[0].length : 0;

    const absoluteRawStart = bodyStart + segmentStart;
    const absoluteRawEnd = bodyStart + segmentEnd;
    const absoluteTrimmedStart = absoluteRawStart + leadingWhitespace;
    const absoluteTrimmedEnd = absoluteRawEnd - trailingWhitespace;

    const aliasMatch = trimmed.match(/\s+AS\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i);
    const expression = aliasMatch ? trimmed.slice(0, aliasMatch.index).trim() : trimmed;
    const alias = aliasMatch ? aliasMatch[1] : null;

    columns.push({
      raw,
      trimmed,
      expression,
      alias,
      startIndex: absoluteTrimmedStart,
      endIndex: absoluteTrimmedEnd,
    });
  };

  for (let index = 0; index < selectBody.length; index += 1) {
    const char = selectBody[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (!inDoubleQuote && char === '\'') {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (!inSingleQuote && char === '"') {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) continue;

    if (char === '(') roundDepth += 1;
    else if (char === ')') roundDepth = Math.max(0, roundDepth - 1);
    else if (char === '[') squareDepth += 1;
    else if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
    else if (char === '{') curlyDepth += 1;
    else if (char === '}') curlyDepth = Math.max(0, curlyDepth - 1);

    if (roundDepth === 0 && squareDepth === 0 && curlyDepth === 0 && char === ',') {
      pushSegment(index);
      segmentStart = index + 1;
    }
  }

  pushSegment(selectBody.length);

  return {
    selectIndex,
    fromIndex,
    bodyStart,
    prefix: aql.slice(0, bodyStart),
    suffix: aql.slice(fromIndex),
    columns,
  };
}

function normalizeProjectionExpression(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function rebuildAqlWithoutColumns(parsed, omitIndexes) {
  const omitSet = new Set(Array.isArray(omitIndexes) ? omitIndexes : [omitIndexes]);
  const keptColumns = parsed.columns.filter((_, index) => !omitSet.has(index));
  if (keptColumns.length === 0) return null;

  const indentMatch = parsed.prefix.match(/\n([ \t]*)$/);
  const indent = indentMatch ? indentMatch[1] : '';
  const separator = indentMatch ? `,\n${indent}` : ', ';
  const beforeFrom = indentMatch || keptColumns.some((column) => column.raw.includes('\n')) ? '\n' : ' ';

  return `${parsed.prefix}${keptColumns.map((column) => column.trimmed).join(separator)}${beforeFrom}${parsed.suffix.trimStart()}`;
}

function rebuildAqlWithoutColumn(parsed, omitIndex) {
  return rebuildAqlWithoutColumns(parsed, [omitIndex]);
}

function findProjectionByPath(aql, aqlPath, usedRanges = new Set()) {
  const parsed = parseSelectColumns(aql);
  if (!parsed) return null;

  const normalizedTarget = normalizeProjectionExpression(aqlPath);
  const foundIndex = parsed.columns.findIndex((column) => {
    const rangeKey = `${column.startIndex}:${column.endIndex}`;
    if (usedRanges.has(rangeKey)) return false;
    return normalizeProjectionExpression(column.expression) === normalizedTarget;
  });

  if (foundIndex === -1) return null;

  const column = parsed.columns[foundIndex];
  const start = indexToLineColumn(aql, column.startIndex);
  const end = indexToLineColumn(aql, Math.max(column.startIndex, column.endIndex - 1));

  return {
    ...column,
    index: foundIndex,
    rangeKey: `${column.startIndex}:${column.endIndex}`,
    line: start.line,
    column: start.column,
    endLine: end.line,
    endColumn: end.column + 1,
  };
}

function removeProjectionByPath(aql, aqlPath) {
  const parsed = parseSelectColumns(aql);
  if (!parsed) return { changed: false, reason: 'invalid_select' };

  const normalizedTarget = normalizeProjectionExpression(aqlPath);
  const foundIndex = parsed.columns.findIndex(
    (column) => normalizeProjectionExpression(column.expression) === normalizedTarget
  );

  if (foundIndex === -1) {
    return { changed: false, reason: 'projection_not_found' };
  }

  const rebuiltAql = rebuildAqlWithoutColumn(parsed, foundIndex);
  if (!rebuiltAql) {
    return { changed: false, reason: 'last_projection' };
  }

  return {
    changed: true,
    aql: rebuiltAql,
    removedProjection: parsed.columns[foundIndex],
    remainingProjectionCount: parsed.columns.length - 1,
  };
}

function extractArchetypeSelectors(expression) {
  return [...String(expression || '').matchAll(/\[([^\]]+)\]/g)]
    .map((match) => String(match[1] || '').trim())
    .filter((selector) => selector.startsWith('openEHR-'));
}

function getCodesCollectionName(runtime) {
  const codeCollection = runtime?.autoActivate?.config?.collections?.codes;
  if (typeof codeCollection === 'string' && codeCollection.trim()) return codeCollection.trim();
  if (codeCollection?.name && typeof codeCollection.name === 'string') return codeCollection.name.trim();

  const dictCollection = runtime?.autoActivate?.config?.collections?.dictionaries;
  if (typeof dictCollection === 'string' && dictCollection.trim()) return dictCollection.trim();
  if (dictCollection?.name && typeof dictCollection.name === 'string') return dictCollection.name.trim();

  return '_codes';
}

function getCodesDocId(runtime) {
  const codingDictionary = runtime?.autoActivate?.config?.coding?.archetype_ids?.dictionary;
  if (typeof codingDictionary === 'string' && codingDictionary.trim()) return codingDictionary.trim();

  const arcodesDocId = runtime?.autoActivate?.config?.dictionaries?.arcodes?.doc_id;
  if (typeof arcodesDocId === 'string' && arcodesDocId.trim()) return arcodesDocId.trim();

  return 'ar_code';
}

async function loadTenantCodesDocument(req, session, coreDb, runtime, envId) {
  try {
    const tenant = await getActiveTenantDb(req, { session, coreDb, envId });
    const collectionName = getCodesCollectionName(runtime);
    const docId = getCodesDocId(runtime);
    return await tenant.db.collection(collectionName).findOne({ _id: docId });
  } catch {
    return null;
  }
}

function getRuntimeStrategyId(runtime) {
  return (
    runtime?.autoActivate?.strategyId ||
    runtime?.strategyLink?.kehrnel?.strategyId ||
    runtime?.strategyLink?.strategyId ||
    null
  );
}

function shouldPreflightProjectionPruning(runtime) {
  const strategyId = getRuntimeStrategyId(runtime);
  const separator = runtime?.autoActivate?.config?.paths?.separator;
  const atcodeStrategy = runtime?.autoActivate?.config?.transform?.coding?.atcodes?.strategy;

  if (
    strategyId === 'openehr.rps_dual_ibm' ||
    (separator === '/' && atcodeStrategy === 'compact_prefix')
  ) {
    return false;
  }
  return true;
}

function hasOwn(obj, key) {
  return !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
}

function selectorExistsInCodesDoc(codesDoc, selector) {
  if (!codesDoc || typeof codesDoc !== 'object' || !selector) return false;

  if (hasOwn(codesDoc, selector)) return true;

  const familyMatch = String(selector).match(/^(openEHR-EHR-[A-Z_]+)\.(.+)$/);
  if (!familyMatch) return false;

  const [, family, remainder] = familyMatch;
  const familyNode = codesDoc[family];
  if (!familyNode || typeof familyNode !== 'object') return false;

  if (hasOwn(familyNode, remainder)) return true;

  const leafMatch = remainder.match(/^(.+)\.(v\d+)$/i);
  if (!leafMatch) return false;

  const [, leaf, version] = leafMatch;
  const leafNode = familyNode[leaf];
  if (!leafNode || typeof leafNode !== 'object') return false;

  return hasOwn(leafNode, version);
}

function pruneMissingCodeProjections(aql, codesDoc) {
  const parsed = parseSelectColumns(aql);
  if (!parsed || !codesDoc || typeof codesDoc !== 'object') {
    return { aql, projectionErrors: [] };
  }

  const indexesToRemove = [];
  const projectionErrors = [];

  parsed.columns.forEach((column, index) => {
    const missingSelectors = extractArchetypeSelectors(column.expression)
      .filter((selector) => !selectorExistsInCodesDoc(codesDoc, selector));

    if (missingSelectors.length === 0) return;

    const start = indexToLineColumn(aql, column.startIndex);
    const end = indexToLineColumn(aql, Math.max(column.startIndex, column.endIndex - 1));

    indexesToRemove.push(index);
    projectionErrors.push({
      code: 'UNRESOLVED_AQL_PATH',
      message: `Archetype selector(s) missing from tenant codes dictionary: ${missingSelectors.join(', ')}`,
      aqlPath: column.expression,
      alias: column.alias || null,
      projectionText: column.trimmed,
      selectIndex: index,
      line: start.line,
      column: start.column,
      endLine: end.line,
      endColumn: end.column + 1,
      selectors: missingSelectors,
      reason: 'missing_codes_dictionary',
    });
  });

  if (indexesToRemove.length === 0) {
    return { aql, projectionErrors: [] };
  }

  const prunedAql = rebuildAqlWithoutColumns(parsed, indexesToRemove);
  return {
    aql: prunedAql || aql,
    projectionErrors,
  };
}

function decoratePartialExecutionError(error, projectionErrors, effectiveAql, requestedAql, parameterSubstitutions = []) {
  if (!projectionErrors.length && !parameterSubstitutions.length && effectiveAql === requestedAql) return error;

  const details = error?.details && typeof error.details === 'object' ? error.details : {};
  error.details = {
    ...details,
    projectionErrors,
    effectiveAql,
    requestedAql,
    parameterSubstitutions,
  };

  return error;
}

function clampRows(rows, maxRows = MAX_SANDBOX_QUERY_ROWS) {
  if (!Array.isArray(rows) || rows.length <= maxRows) return rows;
  return rows.slice(0, maxRows);
}

function clampQueryResultRows(result, maxRows = MAX_SANDBOX_QUERY_ROWS) {
  if (!result || typeof result !== 'object') return result;

  const topLevelRows = Array.isArray(result.rows) ? result.rows : null;
  const rawRows = Array.isArray(result?.raw?.rows) ? result.raw.rows : null;
  const rawResultRows = Array.isArray(result?.raw?.result?.rows) ? result.raw.result.rows : null;
  const rowLimitApplied = [topLevelRows, rawRows, rawResultRows].some(
    (rows) => Array.isArray(rows) && rows.length > maxRows
  );

  if (!rowLimitApplied) {
    return {
      ...result,
      _meta: {
        ...(result._meta || {}),
        rowLimit: maxRows,
        rowLimitApplied: false,
      },
    };
  }

  const next = {
    ...result,
    rows: clampRows(result.rows, maxRows),
    _meta: {
      ...(result._meta || {}),
      rowLimit: maxRows,
      rowLimitApplied: true,
    },
  };

  if (result.raw && typeof result.raw === 'object') {
    next.raw = {
      ...result.raw,
      rows: clampRows(result.raw.rows, maxRows),
    };
    if (result.raw.result && typeof result.raw.result === 'object') {
      next.raw.result = {
        ...result.raw.result,
        rows: clampRows(result.raw.result.rows, maxRows),
      };
    }
  }

  return next;
}

async function executeWithProjectionRecovery({
  service,
  envKey,
  requestedAql,
  executableAql,
  queryOptions,
  initialProjectionErrors = [],
  parameterSubstitutions = [],
}) {
  let currentAql = executableAql;
  let attempts = 0;
  const projectionErrors = [...initialProjectionErrors];
  const originalProjectionRanges = new Set();

  while (attempts <= MAX_UNRESOLVED_PROJECTION_RETRIES) {
    try {
      const result = await service.query(envKey, currentAql, queryOptions);

      if (
        projectionErrors.length === 0 &&
        parameterSubstitutions.length === 0 &&
        currentAql === requestedAql
      ) {
        return result;
      }

      return {
        ...(result && typeof result === 'object' ? result : {}),
        partialExecution: projectionErrors.length > 0,
        requestedAql,
        effectiveAql: currentAql,
        projectionErrors,
        parameterSubstitutions,
      };
    } catch (error) {
      if (error?.code !== 'UNRESOLVED_AQL_PATH') {
        throw decoratePartialExecutionError(error, projectionErrors, currentAql, requestedAql, parameterSubstitutions);
      }

      const unresolvedPath = error?.details?.aql_path;
      if (!unresolvedPath || attempts === MAX_UNRESOLVED_PROJECTION_RETRIES) {
        throw decoratePartialExecutionError(error, projectionErrors, currentAql, requestedAql, parameterSubstitutions);
      }

      const removal = removeProjectionByPath(currentAql, unresolvedPath);
      if (!removal?.changed) {
        throw decoratePartialExecutionError(error, projectionErrors, currentAql, requestedAql, parameterSubstitutions);
      }

      const originalProjection = findProjectionByPath(requestedAql, unresolvedPath, originalProjectionRanges);
      if (originalProjection?.rangeKey) {
        originalProjectionRanges.add(originalProjection.rangeKey);
      }

      const diagnosticProjection = originalProjection || removal.removedProjection || null;
      projectionErrors.push({
        code: error.code,
        message: error.message || 'Projection path could not be resolved.',
        aqlPath: unresolvedPath,
        alias: diagnosticProjection?.alias || null,
        projectionText: diagnosticProjection?.trimmed || diagnosticProjection?.expression || unresolvedPath,
        selectIndex: typeof diagnosticProjection?.index === 'number' ? diagnosticProjection.index : null,
        line: diagnosticProjection?.line || null,
        column: diagnosticProjection?.column || null,
        endLine: diagnosticProjection?.endLine || diagnosticProjection?.line || null,
        endColumn: diagnosticProjection?.endColumn || diagnosticProjection?.column || null,
        selectors: Array.isArray(error?.details?.selectors) ? error.details.selectors : [],
      });

      currentAql = removal.aql;
      attempts += 1;
    }
  }

  return service.query(envKey, currentAql, queryOptions);
}

/**
 * POST /api/kehrnel/environments/[envId]/query
 *
 * Execute an AQL query via Kehrnel.
 *
 * Body:
 *   - aql: AQL query string (required)
 *   - domain: Domain identifier (required)
 *   - strategyId: Kehrnel strategy ID to use (optional; selects env strategyLink)
 *   - options: Additional query options (optional)
 *     - limit: Max results
 *     - offset: Skip results
 *     - fetch: Fetch behavior
 *   - connectionId: Specific Kehrnel connection (optional)
 *
 * Returns:
 *   - results: Query results
 *   - meta: Query metadata (timing, counts, etc.)
 *   - _meta: Request metadata
 */
export async function POST(req, props) {
  const params = await props.params;
  try {
    let session = { user: { email: 'test@example.com' } };
    if (!isTestModeBypassEnabled()) {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
      session = auth.session;
    }

    const { envId } = params;
    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }
    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;

    const body = await req.json();
    const { aql, options, connectionId, domain, strategyId } = body;

    if (!aql) {
      return NextResponse.json({ error: 'aql is required' }, { status: 400 });
    }
    const db = await getCoreDb();
    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(db, session?.user?.email, envId);
      if (!access.ok) return access.response;
    }
    const envGate = await enforceEnvironmentControl(db, envId, ENV_CONTROL_CAPABILITY.READ, {
      route: 'api/kehrnel/environments/query'
    });
    if (envGate) return envGate;

    const service = createKehrnelService(db);
    const runtime = await resolveRuntimeContext({
      coreDb: db,
      userEmail: session?.user?.email,
      envId,
      requestedDomain: domain,
      strategyId,
      requestedConnectionId: connectionId,
      hydrateStrategyConfig: false
    });
    const resolvedDomain = runtime.domain || normalizeDomain(domain);
    if (!resolvedDomain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 });
    }
    const envKey = runtime.envKey || envId;

    const originalAql = aql;
    const normalizedOptions = normalizeSandboxQueryOptions(options);
    let executableAql = enforceAqlResultWindow(aql, normalizedOptions);

    await service.ensureRuntimeReady(envKey, {
      strategyId: runtime.autoActivate?.strategyId || null,
      connectionId: runtime.connectionId || connectionId,
      envKehrnel: runtime.envKehrnel || {},
      domain: resolvedDomain,
      requestId,
      autoActivate: runtime.autoActivate || null
    });

    const allowProjectionPreflight = shouldPreflightProjectionPruning(runtime);
    const tenantCodesDoc = allowProjectionPreflight
      ? await loadTenantCodesDocument(req, session, db, runtime, envId)
      : null;
    const preflight = allowProjectionPreflight
      ? pruneMissingCodeProjections(executableAql, tenantCodesDoc)
      : { aql: executableAql, projectionErrors: [] };
    executableAql = preflight.aql;

    const result = await executeWithProjectionRecovery({
      service,
      envKey,
      requestedAql: originalAql,
      executableAql,
      queryOptions: {
        queryOptions: normalizedOptions,
        strategyId: runtime.autoActivate?.strategyId || null,
        connectionId: runtime.connectionId || connectionId,
        envKehrnel: runtime.envKehrnel || {},
        domain: resolvedDomain,
        requestId,
        autoActivate: runtime.autoActivate || null
      },
      initialProjectionErrors: preflight.projectionErrors,
    });

    return NextResponse.json(clampQueryResultRows(result));
  } catch (error) {
    console.error(`POST /api/kehrnel/environments/${params?.envId}/query error:`, error);
    return safeUpstreamError(error, 'Query failed');
  }
}
