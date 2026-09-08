"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Upload, FileText, Code2, Check, Copy, Eye, X, Loader2
} from 'lucide-react';
import {
  Badge, Card, Button, Input, ErrorAlert, SummaryAlert, JsonViewer
} from '../components/ui';
import {
  getCatalogTemplateId, getCatalogTemplateSourceType, isCatalogTemplateImportable
} from '../lib/catalog';
import {
  TEMPLATE_EXTENSIONS, TEMPLATE_MAX_BYTES, TEMPLATE_MIME_TYPES,
  validateSelectedFiles, mergeUniqueFiles
} from '../lib/fileHandling';
import { buildBatchSummary, buildImportSummary } from '../lib/summaries';
import { useSandboxRuntime } from '../SandboxRuntimeProvider';
import { useDataModels } from '@/providers/DataModelProvider';

// Statuses for the unified list. A single row can only be in one of these.
const STATUS = {
  LOADED: 'loaded',      // present in the runtime
  LOADABLE: 'loadable',  // in the catalog, OPT-backed, not yet in runtime
  CATALOG: 'catalog',    // in the catalog but has no OPT source
};

export default function TemplatesTab() {
  const {
    templates, templatesLoading, templatesError, templatesLoaded,
    availableTemplateIds,
    fetchTemplates, ensureTemplates,
    apiFetch, tenantFetch,
  } = useSandboxRuntime();

  const { dataModelsByName, isLoading: catalogLoading, refreshDataModels } = useDataModels();

  const [localTemplatesError, setLocalTemplatesError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLoadableIds, setSelectedLoadableIds] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [templateFiles, setTemplateFiles] = useState([]);
  const [templateUploadSummary, setTemplateUploadSummary] = useState(null);
  const [showUploader, setShowUploader] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateDetail, setTemplateDetail] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { ensureTemplates(); }, [ensureTemplates]);

  const error = localTemplatesError || templatesError;

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Runtime templates indexed by their template_id so we can merge with catalog.
  const runtimeById = useMemo(() => {
    const map = new Map();
    for (const t of templates) {
      const id = t?.template_id || t?._id || t?.templateId;
      if (id) map.set(id, t);
    }
    return map;
  }, [templates]);

  // OpenEHR models from the shared DataModelProvider cache, keyed by templateId.
  const catalogByTemplateId = useMemo(() => {
    const map = new Map();
    for (const model of Object.values(dataModelsByName || {})) {
      if ((model?.domain || 'openehr') !== 'openehr') continue;
      const tid = getCatalogTemplateId(model);
      if (tid && !map.has(tid)) map.set(tid, model);
    }
    return map;
  }, [dataModelsByName]);

  // Build the unified row list. One row per template_id, tagged with its state.
  const rows = useMemo(() => {
    const out = [];
    const seen = new Set();

    // Loaded templates come first.
    for (const [tid, runtime] of runtimeById.entries()) {
      out.push({
        id: tid,
        templateId: tid,
        status: STATUS.LOADED,
        runtime,
        catalogModel: catalogByTemplateId.get(tid) || null,
      });
      seen.add(tid);
    }

    // Then catalog-only entries not yet loaded.
    for (const [tid, model] of catalogByTemplateId.entries()) {
      if (seen.has(tid)) continue;
      const importable = isCatalogTemplateImportable(model);
      out.push({
        id: tid,
        templateId: tid,
        status: importable ? STATUS.LOADABLE : STATUS.CATALOG,
        runtime: null,
        catalogModel: model,
      });
    }

    // Loaded first, then loadable, then catalog-only. Alphabetical within group.
    const order = { [STATUS.LOADED]: 0, [STATUS.LOADABLE]: 1, [STATUS.CATALOG]: 2 };
    out.sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.templateId.localeCompare(b.templateId);
    });
    return out;
  }, [runtimeById, catalogByTemplateId]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.templateId.toLowerCase().includes(term));
  }, [rows, search]);

  const loadableRows = useMemo(
    () => rows.filter((r) => r.status === STATUS.LOADABLE),
    [rows]
  );

  const visibleLoadableIds = useMemo(
    () => filteredRows.filter((r) => r.status === STATUS.LOADABLE).map((r) => r.templateId),
    [filteredRows]
  );

  // Keep the selection pruned as the list changes.
  useEffect(() => {
    const loadableSet = new Set(loadableRows.map((r) => r.templateId));
    setSelectedLoadableIds((cur) => cur.filter((id) => loadableSet.has(id)));
  }, [loadableRows]);

  const counts = useMemo(() => ({
    loaded: runtimeById.size,
    loadable: loadableRows.length,
    catalogOnly: rows.filter((r) => r.status === STATUS.CATALOG).length,
  }), [runtimeById, loadableRows, rows]);

  // ========== Actions ==========

  const handleLoadSelected = async () => {
    if (selectedLoadableIds.length === 0) return;
    setImporting(true);
    setLocalTemplatesError('');
    setImportSummary(null);

    try {
      const byTid = catalogByTemplateId;
      let successCount = 0;
      let alreadyLoadedCount = 0;
      const failures = [];

      for (const tid of selectedLoadableIds) {
        const model = byTid.get(tid);
        if (!model) continue;
        const label = tid || model?.name || model?._id || 'OpenEHR model';

        if (availableTemplateIds.has(tid)) {
          alreadyLoadedCount += 1;
          continue;
        }

        try {
          const detailRes = await tenantFetch(`/api/data-model-catalog/${encodeURIComponent(model._id)}?include=xml`);
          if (!detailRes.ok) {
            const err = await detailRes.json().catch(() => ({}));
            throw new Error(err.error || err.message || `Failed to fetch source XML: ${detailRes.status}`);
          }
          const detail = await detailRes.json();
          const xml = detail?.source?.xml;
          if (typeof xml !== 'string' || !xml.trim()) {
            throw new Error('This data model does not include a reusable OPT/XML source.');
          }

          const importRes = await apiFetch('/definition/template/adl1.4', {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body: xml,
          });

          if (importRes.ok) { successCount += 1; continue; }

          const err = await importRes.json().catch(() => ({}));
          if (importRes.status === 409) { alreadyLoadedCount += 1; continue; }

          throw new Error(err.detail || err.message || `Failed to load template into sandbox: ${importRes.status}`);
        } catch (error) {
          failures.push({ label, message: error.message || 'Failed to load template.' });
        }
      }

      if (successCount > 0 || alreadyLoadedCount > 0) await fetchTemplates();
      setSelectedLoadableIds([]);
      setImportSummary(buildImportSummary({
        itemLabel: 'template',
        successCount,
        alreadyLoadedCount,
        failures,
      }));
    } finally {
      setImporting(false);
    }
  };

  const handleTemplateUpload = async (e) => {
    e.preventDefault();
    if (templateFiles.length === 0) return;
    setUploadingTemplate(true);
    setLocalTemplatesError('');
    setTemplateUploadSummary(null);

    try {
      const failures = [];
      let successCount = 0;

      for (const file of templateFiles) {
        try {
          const content = await file.text();
          const isXml = file.name.endsWith('.xml') || file.name.endsWith('.opt');
          const res = await apiFetch('/definition/template/adl1.4', {
            method: 'POST',
            headers: { 'Content-Type': isXml ? 'application/xml' : 'application/json' },
            body: content,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || err.message || `Failed to upload template: ${res.status}`);
          }
          successCount += 1;
        } catch (error) {
          failures.push({
            file,
            label: file.name,
            message: error.message || 'Failed to upload template.',
          });
        }
      }

      setTemplateFiles(failures.map(({ file }) => file));
      setTemplateUploadSummary(buildBatchSummary({
        itemLabel: 'template',
        successCount,
        failureCount: failures.length,
        failures,
      }));

      if (successCount > 0) await fetchTemplates();
    } catch (err) {
      setLocalTemplatesError(err.message);
    } finally {
      setUploadingTemplate(false);
    }
  };

  const fetchTemplateDetail = async (templateId) => {
    try {
      const res = await apiFetch(`/definition/template/adl1.4/${encodeURIComponent(templateId)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to fetch template: ${res.status}`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        setTemplateDetail({ format: 'json', content: await res.json() });
      } else if (contentType.includes('xml')) {
        setTemplateDetail({ format: 'xml', content: await res.text() });
      } else {
        setTemplateDetail({ format: 'text', content: await res.text() });
      }
      setSelectedTemplate(templateId);
    } catch (err) {
      setLocalTemplatesError(err.message);
    }
  };

  const refreshAll = () => {
    fetchTemplates();
    refreshDataModels();
  };

  const toggleLoadableId = (tid) => {
    setSelectedLoadableIds((cur) => (
      cur.includes(tid) ? cur.filter((id) => id !== tid) : [...cur, tid]
    ));
    setImportSummary(null);
  };

  const allVisibleLoadableSelected =
    visibleLoadableIds.length > 0 && visibleLoadableIds.every((id) => selectedLoadableIds.includes(id));

  const toggleSelectAllVisibleLoadable = () => {
    setSelectedLoadableIds((cur) => {
      if (allVisibleLoadableSelected) {
        return cur.filter((id) => !visibleLoadableIds.includes(id));
      }
      return Array.from(new Set([...cur, ...visibleLoadableIds]));
    });
    setImportSummary(null);
  };

  const refreshing = templatesLoading || catalogLoading;

  return (
    <div className="space-y-4">
      <Card>
        {/* Header */}
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <FileText className="w-4 h-4 text-teal-400 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-slate-200">Templates</h3>
          <span className="text-xs text-slate-500">
            <span className="text-teal-400">{counts.loaded}</span> in runtime
            {counts.loadable > 0 && (
              <> · <span className="text-cyan-400">{counts.loadable}</span> loadable</>
            )}
            {counts.catalogOnly > 0 && (
              <> · <span className="text-amber-300">{counts.catalogOnly}</span> catalog-only</>
            )}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {selectedLoadableIds.length > 0 && (
              <Button size="sm" loading={importing} onClick={handleLoadSelected}>
                <Upload className="w-4 h-4" />
                Load {selectedLoadableIds.length}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshAll}
              disabled={refreshing}
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowUploader((v) => !v)}>
              <Upload className="w-4 h-4" />
              {showUploader ? 'Hide upload' : 'Upload'}
            </Button>
          </div>
        </div>

        {/* Search + summaries */}
        <div className="px-4 py-3 border-b border-border space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by template id…"
          />
          {importSummary && (
            <SummaryAlert summary={importSummary} onDismiss={() => setImportSummary(null)} />
          )}
          {error && <ErrorAlert message={error} onDismiss={() => setLocalTemplatesError('')} />}
        </div>

        {/* Collapsible uploader for raw OPT/XML files */}
        {showUploader && (
          <form onSubmit={handleTemplateUpload} className="px-4 py-4 border-b border-border bg-background/30 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="sandbox-template-upload"
                type="file"
                accept=".opt,.xml"
                multiple
                onChange={(e) => {
                  const selectedFiles = e.target.files;
                  if (!selectedFiles?.length) return;
                  const { validFiles, errors } = validateSelectedFiles(selectedFiles, {
                    allowedExtensions: TEMPLATE_EXTENSIONS,
                    allowedMimeTypes: TEMPLATE_MIME_TYPES,
                    maxBytes: TEMPLATE_MAX_BYTES,
                    allowMissingType: true,
                  });
                  setLocalTemplatesError(errors.length > 0 ? errors.join(' ') : '');
                  if (validFiles.length === 0) { e.target.value = ''; return; }
                  setTemplateUploadSummary(null);
                  setTemplateFiles((current) => mergeUniqueFiles(current, validFiles));
                  e.target.value = '';
                }}
                className="hidden"
              />
              <label
                htmlFor="sandbox-template-upload"
                className="inline-flex items-center justify-center gap-2 rounded-lg font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600 px-3 py-1.5 text-xs cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Choose .opt / .xml file(s)
              </label>
              {templateFiles.length > 0 ? (
                <Badge variant="teal">{templateFiles.length} selected</Badge>
              ) : (
                <span className="text-xs text-slate-500">JSON web templates belong in the Data Models catalog.</span>
              )}
              {templateFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setTemplateFiles([]); setTemplateUploadSummary(null); }}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {templateFiles.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-auto pr-1">
                {templateFiles.map((file) => (
                  <div
                    key={`${file.name}:${file.size}:${file.lastModified}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-700/60 bg-slate-900/40 px-2.5 py-1.5"
                  >
                    <span className="text-xs text-slate-200 truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={() => {
                        setTemplateFiles((current) => current.filter((f) => f !== file));
                        setTemplateUploadSummary(null);
                      }}
                      className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {templateUploadSummary && (
              <SummaryAlert summary={templateUploadSummary} onDismiss={() => setTemplateUploadSummary(null)} />
            )}

            <div className="flex justify-end">
              <Button type="submit" loading={uploadingTemplate} disabled={templateFiles.length === 0}>
                <Upload className="w-4 h-4" />
                {templateFiles.length > 1 ? 'Upload all' : 'Upload'}
              </Button>
            </div>
          </form>
        )}

        {/* Bulk-select row — only while loadable items are visible */}
        {visibleLoadableIds.length > 0 && (
          <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-background/20">
            <input
              type="checkbox"
              checked={allVisibleLoadableSelected}
              onChange={toggleSelectAllVisibleLoadable}
              aria-label="Select all loadable templates"
              className="h-4 w-4 rounded border-border bg-background text-cyan-400 focus:ring-cyan-400/40"
            />
            <span className="text-xs text-slate-400">
              {allVisibleLoadableSelected
                ? `Selected ${selectedLoadableIds.length} loadable`
                : `Select all ${visibleLoadableIds.length} loadable`}
            </span>
          </div>
        )}

        {/* Unified list */}
        {refreshing && rows.length === 0 ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-slate-500">Loading templates…</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">
            {rows.length === 0
              ? 'No templates. Upload an OPT/XML file or add an OpenEHR data model to the catalog.'
              : 'No templates match the current filter.'}
          </p>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredRows.map((row) => {
              const { templateId, status } = row;
              const checked = selectedLoadableIds.includes(templateId);

              return (
                <div
                  key={templateId}
                  className={`flex items-center gap-3 px-4 py-2 transition-colors ${
                    status === STATUS.CATALOG ? 'opacity-70' : 'hover:bg-background/30'
                  }`}
                >
                  {/* Leading indicator: selection checkbox for loadable, check for loaded, nothing for catalog-only */}
                  {status === STATUS.LOADABLE ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLoadableId(templateId)}
                      aria-label={`Select ${templateId} for loading`}
                      className="h-4 w-4 rounded border-border bg-background text-cyan-400 focus:ring-cyan-400/40 flex-shrink-0"
                    />
                  ) : status === STATUS.LOADED ? (
                    <Check className="w-4 h-4 text-teal-400 flex-shrink-0" aria-label="Loaded in runtime" />
                  ) : (
                    <span className="w-4 h-4 flex-shrink-0" />
                  )}

                  <p className="text-sm text-slate-200 truncate min-w-0 flex-1 font-mono" title={templateId}>
                    {templateId}
                  </p>

                  {/* State label */}
                  {status === STATUS.LOADED && (
                    <span className="text-xs text-teal-400 flex-shrink-0">In runtime</span>
                  )}
                  {status === STATUS.LOADABLE && (
                    <span className="text-xs text-cyan-400 flex-shrink-0">From catalog</span>
                  )}
                  {status === STATUS.CATALOG && (
                    <span
                      className="text-xs text-amber-300 flex-shrink-0"
                      title="Catalog entry has no OPT/XML source — cannot be loaded into runtime."
                    >
                      Catalog only
                    </span>
                  )}

                  {/* Action */}
                  {status === STATUS.LOADED ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchTemplateDetail(templateId)}
                      aria-label="View template"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  ) : status === STATUS.LOADABLE ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={importing && checked}
                      onClick={() => {
                        if (!checked) toggleLoadableId(templateId);
                        // Fire immediately without waiting for selection UX.
                        setSelectedLoadableIds([templateId]);
                        handleLoadSelected();
                      }}
                      aria-label="Load into runtime"
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                  ) : (
                    <span className="w-7" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Template detail panel */}
      {selectedTemplate && templateDetail && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-200">{selectedTemplate}</h3>
                <Badge variant="teal">{templateDetail.format.toUpperCase()}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(
                  templateDetail.format === 'json' ? JSON.stringify(templateDetail.content, null, 2) : templateDetail.content,
                  'template-detail'
                )}
              >
                {copiedId === 'template-detail' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedTemplate(null); setTemplateDetail(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {templateDetail.format === 'json' ? (
            <JsonViewer data={templateDetail.content} maxHeight={500} />
          ) : (
            <pre className="bg-background rounded-lg p-4 overflow-auto text-xs font-mono text-teal-300 border border-border" style={{ maxHeight: 500 }}>
              {templateDetail.content}
            </pre>
          )}
        </Card>
      )}
    </div>
  );
}
