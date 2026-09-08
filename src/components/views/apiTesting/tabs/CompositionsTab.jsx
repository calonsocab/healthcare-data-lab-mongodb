"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileJson, Plus, Info, Database, RefreshCw, Trash2, Upload,
  Eye, Copy, Check, X, Loader2, FileCode
} from 'lucide-react';
import {
  Badge, Card, Button, ErrorAlert, SummaryAlert, JsonViewer
} from '../components/ui';
import EhrPicker from '../components/EhrPicker';
import {
  getCompositionTemplateId, normalizeCompositionSummary, withTemplateId,
  parseCompositionEntriesFromText
} from '../lib/composition';
import {
  COMPOSITION_EXTENSIONS, COMPOSITION_MAX_BYTES, COMPOSITION_MIME_TYPES,
  validateSelectedFiles
} from '../lib/fileHandling';
import { buildBatchSummary, buildCompositionDeleteSummary } from '../lib/summaries';
import { useSandboxRuntime } from '../SandboxRuntimeProvider';

const CREATION_MODES = [
  { key: 'upload', label: 'Upload', icon: Upload, hint: 'Drop JSON file(s) to enqueue' },
  { key: 'paste', label: 'Paste', icon: FileCode, hint: 'Paste a composition JSON object or array' },
  { key: 'shell', label: 'Template shell', icon: Database, hint: 'Minimal shell from the selected template' },
];

const BULK_DELETE_CONCURRENCY = 3;

async function mapWithConcurrency(items, worker, limit = BULK_DELETE_CONCURRENCY) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

export default function CompositionsTab({ onNavigateToTemplates }) {
  const {
    activeEnvironment,
    ehrRecords, ehrLoaded, ensureEhrRecords,
    nativeEhrRecords, nativeEhrLoading, nativeEhrError, nativeEhrChecked, ensureNativeEhrRecords,
    templates, templatesLoading, templatesLoaded, ensureTemplates, availableTemplateIds,
    compositionsByEhr, compositionsLoadingFor, compositionsErrorByEhr,
    fetchCompositions, ensureCompositions, upsertCompositions, removeCompositions, fetchNativeCompositionDetail,
    apiFetch,
  } = useSandboxRuntime();

  const [selectedEhrForComps, setSelectedEhrForComps] = useState('');
  const [selectedCompositionUids, setSelectedCompositionUids] = useState([]);
  const [selectedComposition, setSelectedComposition] = useState(null);
  const [localError, setLocalError] = useState('');
  const [compositionActionSummary, setCompositionActionSummary] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [showCreator, setShowCreator] = useState(false);
  const [creationMode, setCreationMode] = useState('upload');
  const [newCompositionTemplate, setNewCompositionTemplate] = useState('');
  const [newCompositionData, setNewCompositionData] = useState('');
  const [compositionFileName, setCompositionFileName] = useState('');
  const [compositionUploadItems, setCompositionUploadItems] = useState([]);
  const [creatingComposition, setCreatingComposition] = useState(false);
  const [deletingCompositionUid, setDeletingCompositionUid] = useState('');
  const [bulkDeletingCompositions, setBulkDeletingCompositions] = useState(false);

  const compositionFileInputRef = useRef(null);

  useEffect(() => { ensureEhrRecords(); }, [ensureEhrRecords]);
  useEffect(() => { ensureTemplates(); }, [ensureTemplates]);
  useEffect(() => {
    if (ehrLoaded && ehrRecords.length === 0) ensureNativeEhrRecords();
  }, [ehrLoaded, ehrRecords.length, ensureNativeEhrRecords]);

  // Lazy-fetch compositions only when an EHR is first selected.
  useEffect(() => {
    if (selectedEhrForComps) ensureCompositions(selectedEhrForComps);
  }, [selectedEhrForComps, ensureCompositions]);

  const usingNativeCompositionBrowse = ehrLoaded && ehrRecords.length === 0 && nativeEhrRecords.length > 0;
  const effectiveEhrRecords = usingNativeCompositionBrowse ? nativeEhrRecords : ehrRecords;
  const compositions = useMemo(
    () => compositionsByEhr[selectedEhrForComps] || [],
    [compositionsByEhr, selectedEhrForComps]
  );
  const compositionsLoading = compositionsLoadingFor === selectedEhrForComps;
  const compositionsError = compositionsErrorByEhr[selectedEhrForComps] || '';
  const error = localError || compositionsError || (!usingNativeCompositionBrowse ? nativeEhrError : '');

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selectedCompositionUidSet = useMemo(
    () => new Set(selectedCompositionUids),
    [selectedCompositionUids]
  );

  const selectableCompositionUids = useMemo(
    () => compositions
      .map((c) => c?.uid)
      .filter((uid) => typeof uid === 'string' && uid.trim()),
    [compositions]
  );

  const allVisibleCompositionsSelected = useMemo(
    () => selectableCompositionUids.length > 0 &&
      selectableCompositionUids.every((uid) => selectedCompositionUidSet.has(uid)),
    [selectableCompositionUids, selectedCompositionUidSet]
  );

  const toggleCompositionSelection = (uid) => {
    if (!uid) return;
    setSelectedCompositionUids((current) => (
      current.includes(uid)
        ? current.filter((u) => u !== uid)
        : [...current, uid]
    ));
  };

  const toggleSelectAllCompositions = () => {
    setSelectedCompositionUids((current) => (
      selectableCompositionUids.length > 0 && selectableCompositionUids.every((uid) => current.includes(uid))
        ? current.filter((uid) => !selectableCompositionUids.includes(uid))
        : Array.from(new Set([...current, ...selectableCompositionUids]))
    ));
  };

  const clearCompositionDraft = () => {
    setNewCompositionData('');
    setCompositionFileName('');
    setCompositionUploadItems([]);
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === creationMode) return;
    // Switching modes clears inputs belonging to the old mode so the submit
    // button only considers data matching the visible input.
    if (creationMode === 'upload') {
      setCompositionUploadItems([]);
      setCompositionFileName('');
    } else if (creationMode === 'paste') {
      setNewCompositionData('');
      setCompositionFileName('');
    }
    setCompositionActionSummary(null);
    setCreationMode(nextMode);
  };

  const handleCompositionFileUpload = async (event) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles?.length) return;

    setLocalError('');
    setCompositionActionSummary(null);

    try {
      const { validFiles, errors } = validateSelectedFiles(selectedFiles, {
        allowedExtensions: COMPOSITION_EXTENSIONS,
        allowedMimeTypes: COMPOSITION_MIME_TYPES,
        maxBytes: COMPOSITION_MAX_BYTES,
        allowMissingType: true,
      });

      const parsedItems = [];
      const parseErrors = [...errors];

      for (const file of validFiles) {
        try {
          const text = await file.text();
          parsedItems.push(...parseCompositionEntriesFromText(text, file.name));
        } catch (error) {
          parseErrors.push(error.message || `Failed to load ${file.name}.`);
        }
      }

      if (parseErrors.length > 0) setLocalError(parseErrors.join(' '));
      if (parsedItems.length === 0) return;

      const detectedTemplateIds = Array.from(
        new Set(parsedItems.map((item) => getCompositionTemplateId(item.payload)).filter(Boolean))
      );
      if (detectedTemplateIds.length === 1) setNewCompositionTemplate(detectedTemplateIds[0]);

      setCompositionFileName('');
      setCompositionUploadItems((current) => [...current, ...parsedItems]);
    } catch (err) {
      setLocalError(err.message || 'Failed to load composition file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleCreateComposition = async (e) => {
    e.preventDefault();
    if (!selectedEhrForComps || (!newCompositionTemplate && !newCompositionData.trim() && compositionUploadItems.length === 0)) return;
    setCreatingComposition(true);
    setLocalError('');
    setCompositionActionSummary(null);

    try {
      const queuedItems = compositionUploadItems.map((item) => ({ ...item, source: 'queue' }));

      const draftItems = newCompositionData.trim()
        ? parseCompositionEntriesFromText(newCompositionData, compositionFileName || 'Pasted composition JSON')
            .map((item) => ({ ...item, source: 'draft' }))
        : [];

      const generatedItems = !newCompositionData.trim() && compositionUploadItems.length === 0 && newCompositionTemplate
        ? [{
            id: crypto.randomUUID(),
            label: `Minimal composition (${newCompositionTemplate})`,
            payload: {
              _type: 'COMPOSITION',
              archetype_details: { template_id: { value: newCompositionTemplate } },
            },
            source: 'generated',
          }]
        : [];

      const batchItems = [...queuedItems, ...draftItems, ...generatedItems];
      if (batchItems.length === 0) {
        throw new Error('Add composition JSON or choose a template before creating compositions.');
      }

      const preparedItems = batchItems.map((item) => {
        const payloadTemplateId = getCompositionTemplateId(item.payload);
        const effectiveTemplateId = payloadTemplateId || newCompositionTemplate;
        if (!effectiveTemplateId) {
          throw new Error(`${item.label}: missing template id. Choose a template or provide JSON that already includes archetype_details.template_id.value.`);
        }
        return {
          ...item,
          payload: payloadTemplateId ? item.payload : withTemplateId(item.payload, effectiveTemplateId),
        };
      });

      // Pre-validate against the runtime. Skip the gate only if the runtime
      // cache hasn't resolved yet — better to attempt the create and let the
      // server's real error propagate than to block with stale state.
      if (templatesLoaded) {
        const missingTemplates = preparedItems.flatMap((item) => {
          const templateId = getCompositionTemplateId(item.payload);
          if (!templateId || availableTemplateIds.has(templateId)) return [];
          return [{
            label: item.label,
            message: `requires template '${templateId}' which is not loaded in the runtime.`,
          }];
        });

        if (missingTemplates.length > 0) {
          setCompositionActionSummary(buildBatchSummary({
            itemLabel: 'composition',
            successCount: 0,
            failureCount: missingTemplates.length,
            failures: missingTemplates.map((entry) => ({
              ...entry,
              message: `${entry.message} Load the matching OpenEHR model into sandbox runtime templates from the Templates tab.`,
            })),
          }));
          return;
        }
      }

      const failures = [];
      const createdSummaries = [];

      const createViaCanonicalEndpoint = async (item) => {
        const res = await apiFetch(`/ehr/${encodeURIComponent(selectedEhrForComps)}/composition`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(item.payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || err.message || `Failed to create composition: ${res.status}`);
        }

        const created = await res.json().catch(() => null);
        return normalizeCompositionSummary({
          uid: created?.uid,
          name: created?.data?.name?.value || item.payload?.name?.value,
          templateId: getCompositionTemplateId(created?.data || item.payload),
        });
      };

      const createViaCanonicalLoop = async () => {
        for (const item of preparedItems) {
          try {
            createdSummaries.push(await createViaCanonicalEndpoint(item));
          } catch (error) {
            failures.push({ ...item, message: error.message || 'Failed to create composition.' });
          }
        }
      };

      if (preparedItems.length > 1) {
        const bulkRes = await apiFetch(
          `/ehr/${encodeURIComponent(selectedEhrForComps)}/composition/$bulk-create`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: preparedItems.map((item) => ({ composition: item.payload })),
            }),
          }
        );

        if (bulkRes.ok) {
          const data = await bulkRes.json().catch(() => ({}));
          const created = Array.isArray(data?.created) ? data.created : [];
          const failed = Array.isArray(data?.failed) ? data.failed : [];

          createdSummaries.push(
            ...created.map((item) => normalizeCompositionSummary({
              uid: item?.uid,
              name: item?.name,
              templateId: item?.templateId,
            }))
          );

          failures.push(
            ...failed.map((entry) => {
              const index = Number.isInteger(entry?.index) ? entry.index : -1;
              const item = index >= 0 ? preparedItems[index] : null;
              return {
                ...(item || {}),
                message: entry?.message || 'Failed to create composition.',
              };
            })
          );
        } else if (bulkRes.status === 404 || bulkRes.status === 405) {
          await createViaCanonicalLoop();
        } else {
          const err = await bulkRes.json().catch(() => ({}));
          throw new Error(err.detail || err.message || `Failed to create compositions: ${bulkRes.status}`);
        }
      } else {
        await createViaCanonicalLoop();
      }

      const successCount = preparedItems.length - failures.length;

      // Use the returned items to update the cache — no refetch needed.
      if (successCount > 0) {
        upsertCompositions(selectedEhrForComps, createdSummaries);
      }

      const failedQueueItems = failures
        .filter((item) => item.source === 'queue')
        .map(({ id, label, payload }) => ({ id, label, payload }));
      const failedDraftPayloads = failures
        .filter((item) => item.source !== 'queue')
        .map(({ payload }) => payload);

      setCompositionUploadItems(failedQueueItems);

      if (failedDraftPayloads.length > 0) {
        setNewCompositionData(JSON.stringify(
          failedDraftPayloads.length === 1 ? failedDraftPayloads[0] : failedDraftPayloads,
          null,
          2
        ));
        setCompositionFileName(failedDraftPayloads.length === 1 ? failures.find((item) => item.source !== 'queue')?.label || '' : '');
      } else {
        setNewCompositionData('');
        setCompositionFileName('');
      }

      if (failures.length === 0) {
        clearCompositionDraft();
        setNewCompositionTemplate('');
      }

      setCompositionActionSummary(buildBatchSummary({
        itemLabel: 'composition',
        successCount,
        failureCount: failures.length,
        failures,
      }));
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setCreatingComposition(false);
    }
  };

  const fetchCompositionDetail = async (ehrId, compositionUid) => {
    try {
      if (usingNativeCompositionBrowse) {
        const composition = await fetchNativeCompositionDetail(compositionUid, ehrId);
        if (!composition) {
          throw new Error('Composition not found in the native collection.');
        }
        setSelectedComposition({ uid: compositionUid, data: composition });
        return;
      }

      const encodedEhrId = encodeURIComponent(ehrId);
      const encodedCompositionUid = encodeURIComponent(compositionUid);
      let res = await apiFetch(`/ehr/${encodedEhrId}/composition-unflatten/${encodedCompositionUid}`);
      if (!res.ok) {
        res = await apiFetch(`/ehr/${encodedEhrId}/composition/${encodedCompositionUid}`);
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to fetch composition: ${res.status}`);
      }
      setSelectedComposition({ uid: compositionUid, data: await res.json() });
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleDeleteComposition = async (ehrId, compositionUid) => {
    if (!ehrId || !compositionUid) return;
    if (!confirm(`Delete composition ${compositionUid}?`)) return;

    setDeletingCompositionUid(compositionUid);
    setLocalError('');
    setCompositionActionSummary(null);

    try {
      const res = await apiFetch(
        `/ehr/${encodeURIComponent(ehrId)}/composition/${encodeURIComponent(compositionUid)}`,
        { method: 'DELETE', headers: { 'If-Match': compositionUid } }
      );
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || `Failed to delete composition: ${res.status}`);
      }
      removeCompositions(ehrId, [compositionUid]);
      setSelectedComposition((current) => (current?.uid === compositionUid ? null : current));
      setSelectedCompositionUids((current) => current.filter((u) => u !== compositionUid));
    } catch (err) {
      setLocalError(err.message || 'Failed to delete composition.');
    } finally {
      setDeletingCompositionUid('');
    }
  };

  const handleDeleteSelectedCompositions = async () => {
    const selectedUids = selectedCompositionUids.filter(Boolean);
    if (!selectedEhrForComps || selectedUids.length === 0) return;
    if (!confirm(`Delete ${selectedUids.length} selected composition${selectedUids.length === 1 ? '' : 's'}?`)) return;

    setBulkDeletingCompositions(true);
    setLocalError('');
    setCompositionActionSummary(null);

    try {
      let results = null;

      const bulkRes = await apiFetch(
        `/ehr/${encodeURIComponent(selectedEhrForComps)}/composition/$bulk-delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uids: selectedUids })
        }
      );

      if (bulkRes.ok) {
        const data = await bulkRes.json().catch(() => ({}));
        const deletedUids = Array.isArray(data?.deletedUids) ? data.deletedUids.filter(Boolean) : [];
        const failures = Array.isArray(data?.failed) ? data.failed : [];
        results = [
          ...deletedUids.map((uid) => ({ ok: true, uid })),
          ...failures.map((item) => ({
            ok: false,
            uid: item?.uid || '',
            message: item?.message || 'Failed to delete composition.'
          }))
        ];
      } else if (bulkRes.status === 404 || bulkRes.status === 405) {
        results = await mapWithConcurrency(selectedUids, async (compositionUid) => {
          try {
            const res = await apiFetch(
              `/ehr/${encodeURIComponent(selectedEhrForComps)}/composition/${encodeURIComponent(compositionUid)}`,
              { method: 'DELETE', headers: { 'If-Match': compositionUid } }
            );
            if (!res.ok && res.status !== 204) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.detail || err.message || `Failed to delete composition: ${res.status}`);
            }
            return { ok: true, uid: compositionUid };
          } catch (error) {
            return {
              ok: false,
              uid: compositionUid,
              message: error.message || 'Failed to delete composition.'
            };
          }
        });
      } else {
        const err = await bulkRes.json().catch(() => ({}));
        throw new Error(err.detail || err.message || `Failed to delete selected compositions: ${bulkRes.status}`);
      }

      const deletedUids = results.filter((result) => result?.ok).map((result) => result.uid);
      const failures = results
        .filter((result) => result && !result.ok)
        .map((result) => ({ label: result.uid, message: result.message }));

      if (deletedUids.length > 0) {
        removeCompositions(selectedEhrForComps, deletedUids);
        setSelectedComposition((current) => (current && deletedUids.includes(current.uid) ? null : current));
      }

      setSelectedCompositionUids((current) => current.filter((uid) => !deletedUids.includes(uid)));
      setCompositionActionSummary(buildCompositionDeleteSummary(deletedUids.length, failures));
    } catch (err) {
      setLocalError(err.message || 'Failed to delete selected compositions.');
    } finally {
      setBulkDeletingCompositions(false);
    }
  };

  const noEhrRecords = ehrLoaded && ehrRecords.length === 0 && nativeEhrChecked && nativeEhrRecords.length === 0;
  const canCreate =
    (creationMode === 'upload' && compositionUploadItems.length > 0) ||
    (creationMode === 'paste' && newCompositionData.trim().length > 0) ||
    (creationMode === 'shell' && !!newCompositionTemplate);

  return (
    <div className="space-y-4">
      {usingNativeCompositionBrowse && (
        <Card className="p-4 bg-cyan-500/10 border-cyan-500/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-cyan-100">
                Canonical openEHR sandbox endpoints returned no EHR records, but the active Kehrnel strategy can read your imported compositions directly.
              </p>
              <p className="text-xs text-cyan-200/80">
                This tab is using native Kehrnel AQL browsing against the strategy collections. Reading and detail preview are enabled; create and delete stay disabled to avoid mutating IBM-imported data through the wrong API.
              </p>
            </div>
          </div>
        </Card>
      )}

      {nativeEhrLoading && !usingNativeCompositionBrowse && ehrLoaded && ehrRecords.length === 0 ? (
        <Card className="p-4">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Checking whether the active Kehrnel strategy can expose compositions directly…
          </div>
        </Card>
      ) : noEhrRecords ? (
        <Card className="p-4 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-amber-300">
              No EHR records are available from the sandbox runtime for this environment.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          {/* Header row: picker + actions */}
          <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
            <FileJson className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <div className="flex-1 min-w-[240px]">
              <EhrPicker
                ehrRecords={effectiveEhrRecords}
                value={selectedEhrForComps}
                onChange={(nextId) => {
                  setSelectedComposition(null);
                  setSelectedCompositionUids([]);
                  setCompositionActionSummary(null);
                  setShowCreator(false);
                  setSelectedEhrForComps(nextId);
                }}
                envId={activeEnvironment?.id}
                scope="compositions"
              />
            </div>
            {selectedEhrForComps && (
              <>
                <Badge variant="cyan">{compositions.length}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchCompositions(selectedEhrForComps)}
                  aria-label="Refresh compositions"
                >
                  <RefreshCw className={`w-4 h-4 ${compositionsLoading ? 'animate-spin' : ''}`} />
                </Button>
                {!usingNativeCompositionBrowse && (
                  <Button
                    size="sm"
                    onClick={() => setShowCreator((v) => !v)}
                  >
                    <Plus className="w-4 h-4" />
                    {showCreator ? 'Hide' : 'Create'}
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Inline creator — only when toggled */}
          {selectedEhrForComps && showCreator && !usingNativeCompositionBrowse && (
            <div className="px-4 py-4 border-b border-border bg-background/30 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex rounded-lg border border-border bg-background/60 p-0.5">
                  {CREATION_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const isActive = creationMode === mode.key;
                    return (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => handleModeChange(mode.key)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors ${
                          isActive
                            ? 'bg-surface text-slate-100 border border-cyan-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
                {onNavigateToTemplates && (
                  <Button type="button" variant="ghost" size="sm" onClick={onNavigateToTemplates}>
                    <Database className="w-4 h-4" />
                    Manage Templates
                  </Button>
                )}
              </div>

              <form onSubmit={handleCreateComposition} className="space-y-3">
                <input
                  ref={compositionFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  multiple
                  onChange={handleCompositionFileUpload}
                  className="hidden"
                />

                {creationMode === 'upload' && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => compositionFileInputRef.current?.click()}>
                        <Upload className="w-4 h-4" />
                        Choose JSON File(s)
                      </Button>
                      {compositionUploadItems.length > 0 ? (
                        <Badge variant="cyan">{compositionUploadItems.length} queued</Badge>
                      ) : (
                        <span className="text-xs text-slate-500">openEHR composition JSON file(s) or a JSON array.</span>
                      )}
                      {compositionUploadItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { clearCompositionDraft(); setCompositionActionSummary(null); }}
                          className="ml-auto text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {compositionUploadItems.length > 0 && (
                      <div className="space-y-1.5 max-h-40 overflow-auto pr-1">
                        {compositionUploadItems.map((item) => {
                          const templateId = getCompositionTemplateId(item.payload);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 rounded-md border border-slate-700/60 bg-slate-900/40 px-2.5 py-1.5"
                            >
                              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-slate-200 truncate">{item.label}</span>
                                {templateId ? (
                                  <Badge variant={availableTemplateIds.has(templateId) ? 'info' : 'warning'}>
                                    {templateId}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-amber-300">Template required</span>
                                )}
                              </div>
                              <button
                                type="button"
                                aria-label="Remove from queue"
                                onClick={() => {
                                  setCompositionUploadItems((current) => current.filter((q) => q.id !== item.id));
                                  setCompositionActionSummary(null);
                                }}
                                className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {creationMode === 'paste' && (
                  <div className="relative">
                    <textarea
                      value={newCompositionData}
                      onChange={(e) => { setNewCompositionData(e.target.value); setCompositionActionSummary(null); }}
                      placeholder="Paste a canonical openEHR composition JSON object or array…"
                      className="w-full h-36 px-3 py-2 bg-background border border-border rounded-md text-slate-200 font-mono text-sm placeholder:text-slate-500 focus:outline-none focus:border-primary/50 resize-none"
                    />
                    {newCompositionData && (
                      <button
                        type="button"
                        onClick={() => { setNewCompositionData(''); setCompositionActionSummary(null); }}
                        className="absolute top-2 right-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}

                {/* Template + submit share a row to save vertical space */}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <select
                      value={newCompositionTemplate}
                      onChange={(e) => setNewCompositionTemplate(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-slate-200 text-sm focus:outline-none focus:border-primary/50"
                    >
                      <option value="">
                        {creationMode === 'shell' ? 'Select a template…' : 'Template (optional when JSON includes one)'}
                      </option>
                      {templates.map((t, idx) => {
                        const tid = t.template_id || t._id || t.templateId;
                        return <option key={idx} value={tid}>{tid}</option>;
                      })}
                    </select>
                  </div>
                  <Button type="submit" loading={creatingComposition} disabled={!canCreate}>
                    <Plus className="w-4 h-4" />
                    {creationMode === 'upload' && compositionUploadItems.length > 1 ? 'Create all' : 'Create'}
                  </Button>
                </div>

                {templatesLoaded && templates.length === 0 && (
                  <p className="text-xs text-amber-300">
                    No templates in the runtime. Load one from the Templates tab first.
                  </p>
                )}

                {compositionActionSummary && (
                  <SummaryAlert summary={compositionActionSummary} onDismiss={() => setCompositionActionSummary(null)} />
                )}
              </form>
            </div>
          )}

          {/* Bulk actions row — only when something selected */}
          {selectedEhrForComps && selectedCompositionUids.length > 0 && !usingNativeCompositionBrowse && (
            <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-background/20">
              <Badge>{selectedCompositionUids.length} selected</Badge>
              <Button
                variant="danger"
                size="sm"
                loading={bulkDeletingCompositions}
                onClick={handleDeleteSelectedCompositions}
                disabled={bulkDeletingCompositions || !!deletingCompositionUid}
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </Button>
            </div>
          )}

          {/* List / loading / empty */}
          {!selectedEhrForComps ? (
            <p className="px-4 py-6 text-sm text-slate-500 text-center">
              Select an EHR to view its compositions.
            </p>
          ) : compositionsLoading && compositions.length === 0 ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-slate-500">Loading compositions…</p>
            </div>
          ) : compositions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500 text-center">
              {usingNativeCompositionBrowse
                ? 'No compositions were returned for this EHR from the native strategy query.'
                : <>No compositions yet. Click <span className="text-slate-300">Create</span> to add one.</>}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-background">
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={allVisibleCompositionsSelected}
                        onChange={toggleSelectAllCompositions}
                        disabled={selectableCompositionUids.length === 0 || bulkDeletingCompositions}
                        aria-label="Select all compositions"
                        className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary/50"
                      />
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Template</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {compositions.map((comp, idx) => {
                    const { uid, name, templateId } = comp;
                    return (
                      <tr key={uid || idx} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={uid ? selectedCompositionUidSet.has(uid) : false}
                            onChange={() => toggleCompositionSelection(uid)}
                            disabled={!uid || bulkDeletingCompositions || deletingCompositionUid === uid}
                            aria-label={uid ? `Select composition ${uid}` : 'Select composition'}
                            className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary/50"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-cyan-400 font-mono" title={uid || ''}>
                              {uid ? `${String(uid).substring(0, 20)}…` : '-'}
                            </code>
                            {uid && (
                              <button
                                onClick={() => copyToClipboard(uid, `comp-${idx}`)}
                                className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                                aria-label="Copy composition uid"
                              >
                                {copiedId === `comp-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-300">{name || '-'}</td>
                        <td className="px-3 py-2">
                          {templateId && <Badge>{templateId}</Badge>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => uid && fetchCompositionDetail(selectedEhrForComps, uid)}
                              disabled={!uid || bulkDeletingCompositions}
                              aria-label="View composition"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!usingNativeCompositionBrowse && (
                              <Button
                                variant="ghost"
                                size="sm"
                                loading={deletingCompositionUid === uid}
                                onClick={() => uid && handleDeleteComposition(selectedEhrForComps, uid)}
                                disabled={!uid || deletingCompositionUid === uid || bulkDeletingCompositions}
                                aria-label="Delete composition"
                                className="hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {error && <ErrorAlert message={error} onDismiss={() => setLocalError('')} />}

      {selectedComposition && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <FileJson className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-200">Composition Detail</h3>
                <code className="text-xs text-slate-500">{selectedComposition.uid}</code>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(JSON.stringify(selectedComposition.data, null, 2), 'comp-detail')}>
                {copiedId === 'comp-detail' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Copy
              </Button>
              {!usingNativeCompositionBrowse && (
                <Button
                  variant="danger"
                  size="sm"
                  loading={deletingCompositionUid === selectedComposition.uid}
                  onClick={() => handleDeleteComposition(selectedEhrForComps, selectedComposition.uid)}
                  disabled={deletingCompositionUid === selectedComposition.uid || bulkDeletingCompositions}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedComposition(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <JsonViewer data={selectedComposition.data} maxHeight={500} />
        </Card>
      )}
    </div>
  );
}
