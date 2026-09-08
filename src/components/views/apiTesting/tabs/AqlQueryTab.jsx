"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Terminal, Play, Sparkles, Code2, Table2, Download, Copy, Check
} from 'lucide-react';
import {
  Badge, Card, Button, ErrorAlert, SummaryAlert, JsonViewer
} from '../components/ui';
import AQLEditor from '@/components/common/AQLEditor';
import { useLocation } from 'react-router-dom';
import { extractEhrIdHintFromAql } from '../lib/composition';
import { getAqlColumnLabel, serializeAqlCellValue, buildAqlCsv } from '../lib/aqlCsv';
import { useSandboxRuntime } from '../SandboxRuntimeProvider';
import { consumeSandboxAqlLaunch, readSandboxAqlDraft } from '@/lib/sandbox/aqlDraft';
import { viewToSherpaPath } from '@/lib/demoSherpa/hostRoutes';

const MAX_GUI_AQL_ROWS = 100;

const DEFAULT_QUERY = `SELECT
  e/ehr_id/value as ehr_id,
  c/uid/value as composition_id,
  c/name/value as composition_name,
  c/archetype_details/template_id/value as template_id
FROM
  EHR e
  CONTAINS COMPOSITION c
LIMIT 10`;

const BASIC_QUERY = `SELECT
  e/ehr_id/value as ehr_id,
  c/uid/value as composition_id,
  c/name/value as composition_name
FROM EHR e
CONTAINS COMPOSITION c
LIMIT 10`;

const ADVANCED_QUERY = `SELECT
  e/ehr_id/value as ehr_id,
  c/uid/value as composition_uid,
  c/archetype_details/template_id/value as template,
  c/context/start_time/value as date
FROM EHR e
CONTAINS COMPOSITION c
WHERE c/archetype_details/template_id/value LIKE '*'
ORDER BY c/context/start_time/value DESC
LIMIT 20`;

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

function locateProjectionInAql(aql, diagnostic) {
  const candidates = [
    diagnostic?.projectionText,
    diagnostic?.aqlPath,
  ].filter((value) => typeof value === 'string' && value.trim());

  for (const candidate of candidates) {
    const startIndex = aql.indexOf(candidate);
    if (startIndex === -1) continue;
    const endIndex = startIndex + candidate.length;
    const start = indexToLineColumn(aql, startIndex);
    const end = indexToLineColumn(aql, Math.max(startIndex, endIndex - 1));
    return {
      startLineNumber: start.line,
      startColumn: start.column,
      endLineNumber: end.line,
      endColumn: end.column + 1,
    };
  }

  return null;
}

function extractProjectionDiagnosticsFromError(error) {
  const diagnostics = Array.isArray(error?.details?.projectionErrors)
    ? [...error.details.projectionErrors]
    : [];

  if (
    error?.code === 'UNRESOLVED_AQL_PATH' &&
    typeof error?.details?.aql_path === 'string' &&
    !diagnostics.some((diagnostic) => diagnostic?.aqlPath === error.details.aql_path)
  ) {
    diagnostics.push({
      code: error.code,
      message: error.message,
      aqlPath: error.details.aql_path,
      selectors: Array.isArray(error?.details?.selectors) ? error.details.selectors : [],
    });
  }

  return diagnostics;
}

function buildProjectionMarkers(diagnostics, aql, severity = 'warning') {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) return [];

  return diagnostics.map((diagnostic, index) => {
    const explicitRange = typeof diagnostic?.line === 'number'
      ? {
        startLineNumber: diagnostic.line,
        startColumn: Math.max(1, diagnostic.column || 1),
        endLineNumber: Math.max(diagnostic.line, diagnostic.endLine || diagnostic.line),
        endColumn: Math.max(
          (diagnostic.column || 1) + 1,
          diagnostic.endColumn || diagnostic.column || 1
        ),
      }
      : null;
    const inferredRange = explicitRange || locateProjectionInAql(aql, diagnostic);

    if (!inferredRange) return null;

    const alias = diagnostic?.alias || `Projection ${index + 1}`;
    const path = diagnostic?.aqlPath || diagnostic?.projectionText || '';
    return {
      ...inferredRange,
      severity,
      message: diagnostic?.message
        ? `${alias}: ${diagnostic.message}${path ? `\n${path}` : ''}`
        : `${alias}${path ? `\n${path}` : ''}`,
    };
  }).filter(Boolean);
}

function buildProjectionSummary(diagnostics, kind, title, message) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) return null;

  const lines = diagnostics.slice(0, 5).map((diagnostic, index) => {
    const alias = diagnostic?.alias || `Projection ${index + 1}`;
    const path = diagnostic?.aqlPath || diagnostic?.projectionText || 'Unknown path';
    const location = diagnostic?.line ? `line ${diagnostic.line}` : null;
    return `${alias}: ${path}${location ? ` (${location})` : ''}`;
  });

  if (diagnostics.length > 5) {
    lines.push(`${diagnostics.length - 5} more projection issue${diagnostics.length - 5 === 1 ? '' : 's'}.`);
  }

  return {
    kind,
    title,
    message,
    lines,
  };
}

export default function AqlQueryTab() {
  const { runtimeQuery } = useSandboxRuntime();
  const location = useLocation();

  const [aqlQuery, setAqlQuery] = useState(DEFAULT_QUERY);
  const [aqlResults, setAqlResults] = useState(null);
  const [aqlLoading, setAqlLoading] = useState(false);
  const [aqlError, setAqlError] = useState(null);
  const [aqlViewMode, setAqlViewMode] = useState('table');
  const [showAqlAstPanel, setShowAqlAstPanel] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const totalRowCount = Array.isArray(aqlResults?.rows) ? aqlResults.rows.length : 0;
  const displayedRows = useMemo(
    () => (Array.isArray(aqlResults?.rows) ? aqlResults.rows.slice(0, MAX_GUI_AQL_ROWS) : []),
    [aqlResults]
  );
  const resultsAreCapped = totalRowCount > displayedRows.length;
  const visibleAqlResults = useMemo(() => (
    aqlResults ? { ...aqlResults, rows: displayedRows } : null
  ), [aqlResults, displayedRows]);
  const downloadableAqlCsv = useMemo(() => buildAqlCsv(visibleAqlResults), [visibleAqlResults]);
  const projectionErrors = useMemo(
    () => (Array.isArray(aqlResults?.projectionErrors) ? aqlResults.projectionErrors : []),
    [aqlResults]
  );
  const queryDiagnostics = useMemo(() => {
    if (projectionErrors.length > 0) {
      return buildProjectionMarkers(projectionErrors, aqlQuery, 'warning');
    }
    return buildProjectionMarkers(extractProjectionDiagnosticsFromError(aqlError), aqlQuery, 'error');
  }, [aqlError, aqlQuery, projectionErrors]);
  const projectionSummary = useMemo(() => (
    buildProjectionSummary(
      projectionErrors,
      'warning',
      'Partial results',
      'Rows are shown for the projections that resolved. The paths below were skipped because they could not be resolved against the active shortened-path dictionary.'
    )
  ), [projectionErrors]);
  const unresolvedErrorSummary = useMemo(() => {
    const diagnostics = extractProjectionDiagnosticsFromError(aqlError);
    if (!diagnostics.length) return null;
    return buildProjectionSummary(
      diagnostics,
      'error',
      'Query blocked by unresolved projection paths',
      'The query could not run end-to-end because at least one selected path is not available in the active shortened-path dictionary. The highlighted projection is the one to fix first.'
    );
  }, [aqlError]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const launchContext = consumeSandboxAqlLaunch();
    const params = new URLSearchParams(location.search || window.location.search);
    const directAql = params.get('aql');
    const source = params.get('source') || launchContext?.source || '';
    const draftAql = source === 'lab' ? readSandboxAqlDraft() : '';
    const preloadAql = draftAql || directAql || '';

    if (launchContext?.source === 'lab' && !params.get('source')) {
      const sandboxUrl = `${viewToSherpaPath('sandbox')}?explore=aql&source=lab`;
      window.history.replaceState(window.history.state, '', sandboxUrl);
    }

    if (preloadAql) {
      setAqlQuery(preloadAql);
      setAqlResults(null);
      setAqlError(null);
    }
  }, [location.search]);

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const executeAqlQuery = async () => {
    if (!aqlQuery.trim()) return;
    setAqlLoading(true);
    setAqlError(null);
    setAqlResults(null);
    try {
      const ehrIdHint = extractEhrIdHintFromAql(aqlQuery);
      const options = ehrIdHint ? { ehrIdHint } : {};
      setAqlResults(await runtimeQuery(aqlQuery, options));
    } catch (err) {
      setAqlError({
        message: err?.message || 'Query failed.',
        code: err?.code || null,
        details: err?.details || null,
      });
    } finally {
      setAqlLoading(false);
    }
  };

  const downloadAqlResultsCsv = () => {
    const csv = downloadableAqlCsv;
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    anchor.href = url;
    anchor.download = `sandbox-aql-results-${timestamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-200">AQL Query Playground</h3>
            <p className="text-sm text-slate-500">Execute Archetype Query Language queries against your openEHR data</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 font-medium">Query</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setAqlQuery(BASIC_QUERY)} className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Basic Query
                </button>
                <span className="text-slate-600">|</span>
                <button onClick={() => setAqlQuery(ADVANCED_QUERY)} className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Advanced Query
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-surface-alt">
              <AQLEditor
                initialValue={aqlQuery}
                onAqlChange={setAqlQuery}
                showAstPanel={showAqlAstPanel}
                onToggleAstPanel={() => setShowAqlAstPanel((current) => !current)}
                height="560px"
                wordWrap="off"
                fontSize={11}
                lineHeight={18}
                hideScrollbars={false}
                externalMarkers={queryDiagnostics}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Long openEHR paths stay on one line by default so you can scan aliases and predicates without broken wrapping.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={executeAqlQuery} loading={aqlLoading}>
              <Play className="w-4 h-4" />
              Execute Query
            </Button>
            <Button variant="ghost" onClick={() => { setAqlQuery(''); setAqlResults(null); setAqlError(null); }}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {projectionSummary && <SummaryAlert summary={projectionSummary} />}

      {aqlError && <ErrorAlert message={aqlError.message} onDismiss={() => setAqlError(null)} />}

      {unresolvedErrorSummary && <SummaryAlert summary={unresolvedErrorSummary} />}

      {aqlResults && (
        <Card>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-slate-200">Results</h3>
              {Array.isArray(aqlResults.rows) && (
                <Badge variant="success">
                  {resultsAreCapped
                    ? `${displayedRows.length} of ${totalRowCount} rows`
                    : `${totalRowCount} rows`}
                </Badge>
              )}
              {resultsAreCapped && (
                <Badge variant="warning">
                  GUI capped at {MAX_GUI_AQL_ROWS} rows
                </Badge>
              )}
              {projectionErrors.length > 0 && (
                <Badge variant="warning">
                  {projectionErrors.length} skipped column{projectionErrors.length === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-background rounded-lg p-1">
                <button
                  onClick={() => setAqlViewMode('table')}
                  className={`p-1.5 rounded ${aqlViewMode === 'table' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Table2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setAqlViewMode('json')}
                  className={`p-1.5 rounded ${aqlViewMode === 'json' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Code2 className="w-4 h-4" />
                </button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadAqlResultsCsv}
                disabled={!downloadableAqlCsv}
              >
                <Download className="w-4 h-4" />
                CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(JSON.stringify(visibleAqlResults, null, 2), 'aql-results')}>
                {copiedId === 'aql-results' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {resultsAreCapped && (
            <div className="px-4 pt-3 text-xs text-slate-500">
              Only the first {MAX_GUI_AQL_ROWS} rows are shown in the sandbox UI. Refine the query or add AQL `LIMIT`/`OFFSET` to inspect later pages.
            </div>
          )}

          {aqlViewMode === 'table' && visibleAqlResults?.columns && Array.isArray(visibleAqlResults.rows) ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-background">
                    {visibleAqlResults.columns.map((col, idx) => (
                      <th key={idx} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {getAqlColumnLabel(col, idx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleAqlResults.rows.length === 0 ? (
                    <tr>
                      <td colSpan={visibleAqlResults.columns.length} className="px-4 py-8 text-center text-slate-500">
                        No results found
                      </td>
                    </tr>
                  ) : (
                    visibleAqlResults.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-800/50 transition-colors">
                        {visibleAqlResults.columns.map((col, colIdx) => {
                          if (col?.kind === 'projection_error') {
                            const diagnostic = col.diagnostic || {};
                            const title = [
                              diagnostic.alias || col.name,
                              diagnostic.message,
                              diagnostic.aqlPath,
                            ].filter(Boolean).join('\n');
                            return (
                              <td key={colIdx} className="px-4 py-3 text-sm">
                                <span
                                  title={title}
                                  className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300"
                                >
                                  unresolved projection
                                </span>
                              </td>
                            );
                          }

                          const value = row[col.name] !== undefined ? row[col.name] : row[colIdx];
                          return (
                            <td key={colIdx} className="px-4 py-3 text-sm">
                              {value === null || value === undefined ? (
                                <span className="text-slate-600 italic">null</span>
                              ) : typeof value === 'object' ? (
                                <code className="text-xs text-cyan-400">{serializeAqlCellValue(value)}</code>
                              ) : (
                                <span className="text-slate-300">{serializeAqlCellValue(value)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <JsonViewer data={visibleAqlResults} maxHeight={500} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
