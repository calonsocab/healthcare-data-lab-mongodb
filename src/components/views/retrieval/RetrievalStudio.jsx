"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, ChevronRight, Code2, FlaskConical, Plus, Search, Sparkles, X } from 'lucide-react';
import { AGENTIC_COPILOT_STRATEGY } from '@/config/agenticCopilotStrategy';
import KehrnelDocsPanel from '@/components/common/KehrnelDocsPanel';

const modeMeta = {
  library: {
    icon: BookOpen,
    title: 'Query Library',
    description: 'Record and reuse governed retrieval contracts across strategies.',
    aqlDescription: 'Manage reusable AQL queries for openEHR strategies.',
    con2lDescription: 'Manage reusable Con2L contracts for ContextObject retrieval.',
  },
  lab: {
    icon: FlaskConical,
    title: 'Query Lab',
    description: 'Validate deterministic translations and live retrieval behavior before operational use.',
    aqlDescription: 'Validate AQL translation, parsing, MQL output, and execution behavior.',
    con2lDescription: 'Negotiate Con2L contracts from draft to executable and inspect the live kernel result.',
  },
  builder: {
    icon: Code2,
    title: 'Retrieval Builder',
    description: 'Build governed retrieval contracts with the right dialect for the selected model.',
    aqlDescription: 'Build AQL visually for openEHR models.',
    con2lDescription: 'Shape Con2L drafts, resolved contracts, and executable retrieval for ContextObjects.',
  },
};

const dialectMeta = {
  aql: {
    label: 'AQL',
    subtitle: 'openEHR query dialect',
  },
  con2l: {
    label: 'Con2L',
    subtitle: 'ContextObject contract dialect',
  },
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function artifactSubject(artifact) {
  return artifact?.draft?.subject || 'subject';
}

function artifactAsk(artifact) {
  return artifact?.draft?.ask || 'lookup';
}

function artifactWindow(artifact) {
  return artifact?.draft?.window || artifact?.executable?.window?.value || null;
}

function artifactFocus(artifact) {
  return [...safeArray(artifact?.draft?.focus), ...safeArray(artifact?.draft?.evidence)];
}

const subjectOptions = ['patient', 'population', 'encounter', 'specimen', 'organization'];
const askOptions = ['lookup', 'guidance', 'timeline', 'distribution', 'aggregate', 'similarity'];
const assertionOptions = ['observed', 'workflow', 'guidance', 'derived'];
const retrievalModeOptions = ['context_lookup', 'cross_subject', 'analytics', 'semantic_search', 'hybrid_search'];
const planFamilyOptions = [
  { id: 'subject_lookup', label: 'Subject lookup', description: 'Single-subject or patient-filtered retrieval.' },
  { id: 'cross_subject', label: 'Cross-subject', description: 'Population or cohort retrieval across many subjects.' },
  { id: 'analytics', label: 'Analytics', description: 'Aggregations, distributions, and grouped metrics.' },
  { id: 'semantic_search', label: 'Semantic search', description: 'Text, vector, or ontology-aware retrieval.' },
  { id: 'hybrid_search', label: 'Hybrid', description: 'Blend deterministic filters with text/vector ranking.' },
];
const windowTypeOptions = ['calendar_quarter', 'rolling_window', 'episode', 'snapshot', 'none'];

function parseTokenList(value) {
  return Array.from(
    new Set(
      `${value || ''}`
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function formatTokenList(values) {
  return safeArray(values).filter(Boolean).join(', ');
}

function normalizeWhereRows(rows = []) {
  return safeArray(rows).map((row, index) => ({
    id: row?.id || `where-${index + 1}`,
    field: row?.field || row?.predicate || '',
    op: row?.op || 'eq',
    value: row?.value ?? '',
  }));
}

function inferPlanFamily(artifact) {
  const retrievalMode = artifact?.resolved?.retrievalMode || '';
  const draftAsk = artifact?.draft?.ask || '';
  const subject = artifact?.draft?.subject || '';

  if (retrievalMode === 'analytics' || ['distribution', 'aggregate'].includes(draftAsk)) {
    return 'analytics';
  }
  if (retrievalMode === 'hybrid_search') {
    return 'hybrid_search';
  }
  if (retrievalMode === 'semantic_search' || draftAsk === 'similarity') {
    return 'semantic_search';
  }
  if (subject === 'population' || retrievalMode === 'cross_subject') {
    return 'cross_subject';
  }
  return 'subject_lookup';
}

function createBuilderState(artifact) {
  const whereRows = normalizeWhereRows(artifact?.executable?.where);
  return {
    title: artifact?.title || 'Untitled Con2L contract',
    naturalLanguage: artifact?.naturalLanguage || artifact?.title || '',
    draftSubject: artifact?.draft?.subject || 'patient',
    draftAsk: artifact?.draft?.ask || 'lookup',
    draftFocus: formatTokenList(artifact?.draft?.focus),
    draftEvidence: formatTokenList(artifact?.draft?.evidence),
    draftGroupBy: formatTokenList(artifact?.draft?.groupBy),
    draftWindow: artifact?.draft?.window || '',
    resolvedContextContract: artifact?.resolved?.contextContract || artifact?.executable?.from || '',
    resolvedAssertionType: artifact?.resolved?.assertionType || 'observed',
    resolvedRetrievalMode: artifact?.resolved?.retrievalMode || 'context_lookup',
    resolvedPredicates: formatTokenList(artifact?.resolved?.predicates),
    executableFrom: artifact?.executable?.from || artifact?.resolved?.contextContract || '',
    executableContains: formatTokenList(artifact?.executable?.contains),
    executableOutput: artifact?.executable?.output || '',
    executableGroupBy: formatTokenList(artifact?.executable?.groupBy || artifact?.draft?.groupBy),
    subjectAnchor: artifact?.executable?.subject?.anchor || (artifact?.draft?.subject === 'population' ? 'cohort' : 'patient'),
    subjectSource: artifact?.executable?.subject?.source || 'current_scope',
    windowType: artifact?.executable?.window?.type || 'none',
    windowValue: artifact?.executable?.window?.value || '',
    planFamily: inferPlanFamily(artifact),
    whereRows: whereRows.length > 0 ? whereRows : [{ id: 'where-1', field: '', op: 'eq', value: '' }],
  };
}

function buildArtifactFromState(state, baseArtifact) {
  const focus = parseTokenList(state.draftFocus);
  const evidence = parseTokenList(state.draftEvidence);
  const groupBy = parseTokenList(state.draftGroupBy || state.executableGroupBy);
  const predicates = parseTokenList(state.resolvedPredicates);
  const contains = parseTokenList(state.executableContains);
  const where = safeArray(state.whereRows)
    .filter((row) => `${row?.field || ''}`.trim())
    .map((row) => ({
      field: `${row.field}`.trim(),
      op: `${row.op || 'eq'}`.trim(),
      value: row.value,
    }));

  const executable = {
    dialect: 'con2l/v1',
    from: state.executableFrom || state.resolvedContextContract || 'context_contract',
    contains,
    where,
    groupBy,
    output: state.executableOutput || null,
    subject: {
      anchor: state.subjectAnchor || 'patient',
      source: state.subjectSource || 'current_scope',
    },
    meta: {
      planFamily: state.planFamily,
    },
  };

  if (state.windowType && state.windowType !== 'none') {
    executable.window = {
      type: state.windowType,
      value: state.windowValue || 'current',
    };
  }

  if (['distribution', 'aggregate'].includes(state.draftAsk)) {
    executable.aggregate = state.draftAsk;
  }

  return {
    id: baseArtifact?.id || `adhoc.${state.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    title: state.title,
    naturalLanguage: state.naturalLanguage,
    draft: {
      subject: state.draftSubject,
      ask: state.draftAsk,
      focus,
      evidence,
      groupBy,
      window: state.draftWindow || null,
    },
    resolved: {
      contextContract: state.resolvedContextContract || executable.from,
      assertionType: state.resolvedAssertionType,
      predicates,
      retrievalMode: state.resolvedRetrievalMode,
    },
    executable,
  };
}

function buildCompiledPreview(artifact) {
  const planFamily = artifact?.executable?.meta?.planFamily || inferPlanFamily(artifact);
  const retrievalMode = artifact?.resolved?.retrievalMode || 'context_lookup';
  const whereCount = safeArray(artifact?.executable?.where).length;
  const containsCount = safeArray(artifact?.executable?.contains).length;
  const groupBy = safeArray(artifact?.executable?.groupBy);

  const planMap = {
    subject_lookup: 'patient_filtered_mql',
    cross_subject: 'cohort_mql',
    analytics: 'aggregation_pipeline',
    semantic_search: 'atlas_search_or_vector_plan',
    hybrid_search: 'hybrid_search_pipeline',
  };

  return {
    engine: 'contextobjects.runtime',
    con2lDialect: artifact?.executable?.dialect || 'con2l/v1',
    retrievalMode,
    planFamily,
    mongoPlan: planMap[planFamily] || 'patient_filtered_mql',
    sourceDefinition: artifact?.executable?.from || artifact?.resolved?.contextContract || null,
    subjectScope: artifact?.draft?.subject || 'patient',
    deterministicStages: [
      'natural-language -> draft Con2L',
      'draft -> resolved ContextObject contract',
      'resolved -> executable Con2L',
      'executable -> deterministic Mongo-native plan',
    ],
    executionHints: {
      whereCount,
      containsCount,
      groupBy,
      output: artifact?.executable?.output || null,
      window: artifact?.executable?.window || null,
    },
  };
}

function BuilderPillGroup({ label, options, value, onChange }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              value === option
                ? 'bg-primary text-primary-text'
                : 'border border-border bg-background text-theme-secondary hover:bg-surface-hover'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function BuilderField({ label, value, onChange, placeholder, multiline = false }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">{label}</div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-theme-primary outline-none placeholder:text-theme-tertiary focus:border-primary"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-theme-primary outline-none placeholder:text-theme-tertiary focus:border-primary"
        />
      )}
    </label>
  );
}

function PreviewBlock({ title, payload }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">{title}</div>
      <pre className="mt-3 overflow-x-auto text-xs leading-5 text-theme-secondary">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

function StageTabs({ stage, onChange }) {
  const tabs = ['draft', 'resolved', 'executable'];
  return (
    <div className="inline-flex rounded-xl border border-border bg-background p-1">
      {tabs.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
            stage === item ? 'bg-primary text-primary-text' : 'text-theme-secondary hover:bg-surface-hover'
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function QueryDialectTabs({ activeDialect, onChange }) {
  return (
    <div className="inline-flex rounded-2xl border border-border bg-surface p-1">
      {Object.entries(dialectMeta).map(([id, meta]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-xl px-4 py-2 text-left transition ${
            activeDialect === id ? 'bg-primary text-primary-text shadow-sm' : 'text-theme-secondary hover:bg-surface-hover'
          }`}
        >
          <div className="text-sm font-semibold">{meta.label}</div>
          <div className={`text-xs ${activeDialect === id ? 'text-primary-text/80' : 'text-theme-tertiary'}`}>
            {meta.subtitle}
          </div>
        </button>
      ))}
    </div>
  );
}

function SemanticConfirmationDialog({ state, loading, onCancel, onConfirm }) {
  const candidates = safeArray(state?.confirmation?.candidates);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState(candidates[0]?.definitionId || '');
  const [selectedNodeId, setSelectedNodeId] = useState(candidates[0]?.nodes?.[0]?.nodeId || '');

  useEffect(() => {
    setSelectedDefinitionId(candidates[0]?.definitionId || '');
    setSelectedNodeId(candidates[0]?.nodes?.[0]?.nodeId || '');
  }, [state?.artifactId, candidates]);

  if (!state?.confirmation?.required) return null;

  const activeCandidate = candidates.find((candidate) => candidate.definitionId === selectedDefinitionId) || candidates[0] || null;
  const activeNodes = safeArray(activeCandidate?.nodes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              <div className="text-xs font-semibold uppercase tracking-[0.16em]">Semantic Confirmation Required</div>
            </div>
            <h3 className="mt-2 text-xl font-semibold text-theme-primary">Confirm the intended semantic target</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-theme-secondary">
              {state.confirmation.prompt || state.confirmation.reason || 'Choose the ContextObject and semantic target before running the Con2L contract.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-theme-secondary hover:bg-surface-hover"
          >
            Close
          </button>
        </div>

        <div className="grid max-h-[calc(88vh-154px)] gap-0 overflow-hidden xl:grid-cols-[0.95fr_1.05fr]">
          <div className="overflow-y-auto border-r border-border bg-background/60 p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">ContextObject candidates</div>
            <div className="space-y-3">
              {candidates.map((candidate) => {
                const active = candidate.definitionId === selectedDefinitionId;
                return (
                  <button
                    key={candidate.definitionId}
                    type="button"
                    onClick={() => {
                      setSelectedDefinitionId(candidate.definitionId);
                      setSelectedNodeId(candidate.nodes?.[0]?.nodeId || '');
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-primary/40 bg-primary/5 shadow-sm'
                        : 'border-border bg-surface hover:border-primary/30 hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-theme-primary">{candidate.name}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {candidate.contextType ? (
                            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
                              {candidate.contextType}
                            </span>
                          ) : null}
                          {candidate.primaryAnchor ? (
                            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
                              anchor: {candidate.primaryAnchor}
                            </span>
                          ) : null}
                        </div>
                        {safeArray(candidate.matchedSignals).length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {candidate.matchedSignals.slice(0, 4).map((signal) => (
                              <span key={`${candidate.definitionId}-${signal}`} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
                                {signal}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-500">
                        {Math.round(candidate.score)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-y-auto p-5">
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Node candidates</div>
              <div className="mt-2 text-sm text-theme-secondary">
                Policy: {state.confirmation.policy} • confidence {Math.round((state.confirmation.confidence || 0) * 100)}% • threshold {Math.round((state.confirmation.threshold || 0) * 100)}%
              </div>
            </div>

            {activeCandidate ? (
              <div className="space-y-3">
                {activeNodes.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-background p-4 text-sm text-theme-secondary">
                    This candidate does not expose a strong node-level target yet. You can still confirm the ContextObject.
                  </div>
                ) : (
                  activeNodes.map((node) => {
                    const active = node.nodeId === selectedNodeId;
                    return (
                      <button
                        key={node.nodeId}
                        type="button"
                        onClick={() => setSelectedNodeId(node.nodeId)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          active
                            ? 'border-primary/40 bg-primary/5 shadow-sm'
                            : 'border-border bg-background hover:border-primary/30 hover:bg-surface-hover'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-theme-primary">{node.name}</div>
                            <div className="mt-1 text-xs text-theme-secondary font-mono">{node.attribute}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {node.conceptLabel ? (
                                <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary">
                                  {node.conceptLabel}
                                </span>
                              ) : null}
                              {node.ontologySource ? (
                                <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary">
                                  {node.ontologySource}
                                </span>
                              ) : null}
                              {node.policy ? (
                                <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary">
                                  {node.policy}
                                </span>
                              ) : null}
                            </div>
                            {safeArray(node.matchedSignals).length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {node.matchedSignals.slice(0, 4).map((signal) => (
                                  <span key={`${node.nodeId}-${signal}`} className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary">
                                    {signal}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {node.prompt ? (
                              <p className="mt-3 text-sm leading-6 text-theme-secondary">{node.prompt}</p>
                            ) : null}
                          </div>
                          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-500">
                            {Math.round(node.score)}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background p-4 text-sm text-theme-secondary">
                No semantic candidates are available for confirmation yet.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="text-sm text-theme-secondary">
            {state.confirmation.reason}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-theme-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm({
                definitionId: selectedDefinitionId,
                nodeIds: selectedNodeId ? [selectedNodeId] : [],
              })}
              disabled={loading || !selectedDefinitionId}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm font-medium text-emerald-500 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Confirming...' : 'Use selected target'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Con2LArtifactInspector({ artifact, preview, error, loading, onRun }) {
  const [stage, setStage] = useState('draft');

  useEffect(() => {
    setStage('draft');
  }, [artifact?.id]);

  if (!artifact) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-theme-secondary">
        Select a Con2L contract to inspect its draft, resolved contract, and executable form.
      </div>
    );
  }

  const payload = artifact?.[stage] || {};
  const runtime = preview?.runtime || null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-tertiary">Con2L contract</div>
          <h3 className="mt-2 text-xl font-semibold text-theme-primary">{artifact.title}</h3>
          <p className="mt-2 text-sm leading-6 text-theme-secondary">{artifact.naturalLanguage || artifact.title}</p>
        </div>
        <button
          type="button"
          onClick={onRun}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm font-medium text-emerald-500 hover:bg-emerald-500/10"
        >
          {loading ? 'Running live negotiation...' : 'Run live negotiation'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
          {artifactSubject(artifact)}
        </span>
        <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
          {artifactAsk(artifact)}
        </span>
        {artifactWindow(artifact) ? (
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
            {artifactWindow(artifact)}
          </span>
        ) : null}
        {artifactFocus(artifact).map((item) => (
          <span key={item} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
            {item}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <StageTabs stage={stage} onChange={setStage} />
        {runtime ? (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-500">
            Runtime: {runtime.status || 'unknown'}
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">{stage}</div>
        <pre className="mt-3 overflow-x-auto text-xs leading-5 text-theme-secondary">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>

      {preview?.semanticResolution ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-theme-primary">Semantic resolution</div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                preview.semanticResolution.confirmationRequired
                  ? 'border-amber-500/20 bg-amber-500/5 text-amber-500'
                  : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500'
              }`}
            >
              {preview.semanticResolution.confirmationRequired ? 'Confirmation required' : 'Resolved'}
            </span>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Confidence</div>
              <div className="mt-2 text-sm text-theme-primary">
                {Math.round((preview.semanticResolution.confidence || 0) * 100)}%
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Policy</div>
              <div className="mt-2 text-sm text-theme-primary">{preview.semanticResolution.policy || 'inherit'}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">ContextObject</div>
              <div className="mt-2 text-sm text-theme-primary">{preview.semanticResolution.selectedDefinition?.name || 'Unresolved'}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Node targets</div>
              <div className="mt-2 text-sm text-theme-primary">
                {safeArray(preview.semanticResolution.selectedNodes).map((node) => node.attribute).join(', ') || 'Unresolved'}
              </div>
            </div>
          </div>
          {preview.semanticResolution.reason ? (
            <p className="mt-4 text-sm leading-6 text-theme-secondary">{preview.semanticResolution.reason}</p>
          ) : null}
        </div>
      ) : null}

      {(preview?.summary || safeArray(preview?.matchedDefinitions).length > 0 || safeArray(preview?.warnings).length > 0) && (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <div className="text-sm font-semibold text-theme-primary">Resolution preview</div>
          {preview?.summary ? (
            <div className="mt-4 grid gap-3 xl:grid-cols-4">
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Context contract</div>
                <div className="mt-2 text-sm text-theme-primary">{preview.summary.contextContract || 'Unresolved'}</div>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Retrieval mode</div>
                <div className="mt-2 text-sm text-theme-primary">{preview.summary.retrievalMode || 'Unresolved'}</div>
              </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Matched definitions</div>
                  <div className="mt-2 text-sm text-theme-primary">{preview.summary.matchedDefinitionCount || 0}</div>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Semantic confidence</div>
                  <div className="mt-2 text-sm text-theme-primary">
                    {typeof preview.summary.semanticConfidence === 'number'
                      ? `${Math.round(preview.summary.semanticConfidence * 100)}%`
                      : 'Unresolved'}
                  </div>
                </div>
              </div>
          ) : null}

          {safeArray(preview?.summary?.deterministicSignals).length > 0 ? (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Deterministic signals</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {preview.summary.deterministicSignals.map((signal) => (
                  <span key={signal} className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {safeArray(preview?.matchedDefinitions).length > 0 ? (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Candidate ContextObjects</div>
              <div className="mt-3 grid gap-3">
                {preview.matchedDefinitions.map((definition) => (
                  <div key={definition.id} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-theme-primary">{definition.name}</div>
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-500">
                        {Math.round(definition.score || 0)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {definition.kind ? (
                        <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
                          {definition.kind}
                        </span>
                      ) : null}
                      {definition.scope ? (
                        <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
                          {definition.scope}
                        </span>
                      ) : null}
                      {definition.primaryAnchor ? (
                        <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
                          anchor: {definition.primaryAnchor}
                        </span>
                      ) : null}
                      {safeArray(definition.matchedSignals).slice(0, 3).map((signal) => (
                        <span key={`${definition.id}-${signal}`} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
                          {signal}
                        </span>
                      ))}
                    </div>
                    {safeArray(definition.matchedNodes).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {definition.matchedNodes.slice(0, 3).map((node) => (
                          <span key={`${definition.id}-${node.nodeId}`} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
                            {node.attribute}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {safeArray(preview?.warnings).length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-500">Warnings</div>
              <ul className="mt-2 space-y-2 text-sm text-amber-200">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {(preview || error) && (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <div className="text-sm font-semibold text-theme-primary">Runtime result</div>
          {error ? (
            <p className="mt-3 text-sm text-rose-400">{error}</p>
          ) : runtime?.available === false ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm leading-6 text-theme-secondary">
                {runtime?.reason || 'Live runtime is not available for this environment.'}
              </p>
              <pre className="overflow-x-auto text-xs leading-5 text-theme-secondary">
                {JSON.stringify({ target: runtime?.target || {}, catalog: runtime?.catalog?.summary || {} }, null, 2)}
              </pre>
            </div>
          ) : runtime?.status === 'confirmation_required' ? (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                <div className="text-sm font-semibold">Execution paused for semantic confirmation</div>
              </div>
              <p className="mt-3 text-sm leading-6 text-theme-secondary">
                {runtime?.confirmation?.reason || runtime?.semanticResolution?.reason || 'Choose the intended semantic target before HDL compiles the live plan.'}
              </p>
            </div>
          ) : runtime?.status === 'error' ? (
            <p className="mt-3 text-sm text-rose-400">{runtime?.error || 'Runtime failed.'}</p>
          ) : (
            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Resolved</div>
                <pre className="mt-2 overflow-x-auto text-xs leading-5 text-theme-secondary">
                  {JSON.stringify(runtime?.negotiated?.resolved || {}, null, 2)}
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Executable</div>
                <pre className="mt-2 overflow-x-auto text-xs leading-5 text-theme-secondary">
                  {JSON.stringify(runtime?.negotiated?.executable || {}, null, 2)}
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Compiled</div>
                <pre className="mt-2 overflow-x-auto text-xs leading-5 text-theme-secondary">
                  {JSON.stringify(runtime?.negotiated?.compiled || runtime?.authoredExecutable || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Con2LLibraryPanel({
  artifacts,
  selectedArtifactId,
  onSelectArtifact,
  onRunArtifact,
  activeArtifactId,
  artifactLoading,
  artifactPreview,
  artifactError,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [askFilter, setAskFilter] = useState('all');

  const subjectOptions = useMemo(
    () => ['all', ...Array.from(new Set(artifacts.map((artifact) => artifactSubject(artifact))))],
    [artifacts]
  );
  const askOptions = useMemo(
    () => ['all', ...Array.from(new Set(artifacts.map((artifact) => artifactAsk(artifact))))],
    [artifacts]
  );

  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((artifact) => {
      const haystack = [artifact.title, artifact.naturalLanguage, ...artifactFocus(artifact)].join(' ').toLowerCase();
      const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
      const matchesSubject = subjectFilter === 'all' || artifactSubject(artifact) === subjectFilter;
      const matchesAsk = askFilter === 'all' || artifactAsk(artifact) === askFilter;
      return matchesSearch && matchesSubject && matchesAsk;
    });
  }, [artifacts, searchTerm, subjectFilter, askFilter]);

  const selectedArtifact = filteredArtifacts.find((artifact) => artifact.id === selectedArtifactId)
    || artifacts.find((artifact) => artifact.id === selectedArtifactId)
    || filteredArtifacts[0]
    || null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-tertiary" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search Con2L contracts..."
              className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4 text-sm text-theme-primary outline-none placeholder:text-theme-tertiary focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {subjectOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSubjectFilter(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  subjectFilter === option ? 'bg-primary text-primary-text' : 'border border-border bg-background text-theme-secondary'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {askOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAskFilter(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  askFilter === option ? 'bg-primary text-primary-text' : 'border border-border bg-background text-theme-secondary'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            {filteredArtifacts.map((artifact) => {
              const isActive = artifact.id === selectedArtifact?.id;
              return (
                <button
                  key={artifact.id}
                  type="button"
                  onClick={() => onSelectArtifact(artifact.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isActive
                      ? 'border-primary/40 bg-primary/5 shadow-sm'
                      : 'border-border bg-background hover:border-primary/30 hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-theme-primary">{artifact.title}</div>
                      <p className="mt-2 text-sm leading-6 text-theme-secondary">{artifact.naturalLanguage}</p>
                    </div>
                    <ChevronRight className={`mt-1 h-4 w-4 ${isActive ? 'text-primary' : 'text-theme-tertiary'}`} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary">
                      {artifactSubject(artifact)}
                    </span>
                    <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary">
                      {artifactAsk(artifact)}
                    </span>
                    {artifactFocus(artifact).slice(0, 2).map((item) => (
                      <span key={item} className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary">
                        {item}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <Con2LArtifactInspector
            artifact={selectedArtifact}
            preview={selectedArtifact?.id === activeArtifactId ? artifactPreview : null}
            error={selectedArtifact?.id === activeArtifactId ? artifactError : null}
            loading={selectedArtifact?.id === activeArtifactId && artifactLoading}
            onRun={() => selectedArtifact && onRunArtifact(selectedArtifact.id)}
          />
        </div>
      </div>

      <KehrnelDocsPanel
        title="Kernel docs for Con2L"
        description="The execution-kernel documentation behind ContextObject contract resolution and Con2L negotiation."
        docs={AGENTIC_COPILOT_STRATEGY.docs.retrieval}
      />
    </div>
  );
}

function Con2LLabPanel(props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="text-sm text-theme-secondary">
          Use the same familiar lab pattern, but for contract negotiation instead of AQL parsing. Select a Con2L contract,
          inspect its draft, and run live negotiation against the active kernel runtime.
        </div>
      </div>
      <Con2LLibraryPanel {...props} />
    </div>
  );
}

function Con2LBuilderPanel({ artifacts, selectedArtifactId, onSelectArtifact, onRunArtifact, activeArtifactId, artifactLoading, artifactPreview, artifactError }) {
  const artifact =
    artifacts.find((item) => item.id === selectedArtifactId) ||
    artifacts[0] ||
    null;
  const [builderState, setBuilderState] = useState(() => createBuilderState(artifact));

  useEffect(() => {
    setBuilderState(createBuilderState(artifact));
  }, [artifact]);

  const workingArtifact = useMemo(
    () => buildArtifactFromState(builderState, artifact),
    [builderState, artifact]
  );

  const compiledPreview = useMemo(
    () => buildCompiledPreview(workingArtifact),
    [workingArtifact]
  );

  const updateBuilderState = (field, value) => {
    setBuilderState((current) => ({ ...current, [field]: value }));
  };

  const updateWhereRow = (rowId, key, value) => {
    setBuilderState((current) => ({
      ...current,
      whereRows: current.whereRows.map((row) =>
        row.id === rowId ? { ...row, [key]: value } : row
      ),
    }));
  };

  const addWhereRow = () => {
    setBuilderState((current) => ({
      ...current,
      whereRows: [
        ...current.whereRows,
        { id: `where-${current.whereRows.length + 1}`, field: '', op: 'eq', value: '' },
      ],
    }));
  };

  const removeWhereRow = (rowId) => {
    setBuilderState((current) => ({
      ...current,
      whereRows:
        current.whereRows.length === 1
          ? current.whereRows
          : current.whereRows.filter((row) => row.id !== rowId),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <h3 className="text-base font-semibold text-theme-primary">Con2L builder</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-theme-secondary">
          Con2L should be shaped through the same disciplined builder flow as AQL: start from a seed contract, author the
          draft request, confirm ContextObject resolution, and validate the executable retrieval before promotion.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="text-sm font-semibold text-theme-primary">Seed contracts</div>
          <p className="mt-2 text-sm leading-6 text-theme-secondary">
            Start from a governed example, then reshape the draft, resolution, and executable stages for the retrieval
            contract you want.
          </p>
          <div className="mt-4 space-y-3">
            {artifacts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectArtifact(item.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  item.id === artifact?.id
                    ? 'border-primary/40 bg-primary/5 shadow-sm'
                    : 'border-border bg-background hover:border-primary/30 hover:bg-surface-hover'
                }`}
              >
                  <div className="text-sm font-semibold text-theme-primary">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-theme-secondary">{item.naturalLanguage}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary">
                      {artifactSubject(item)}
                    </span>
                    <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary">
                      {artifactAsk(item)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-tertiary">Draft request</div>
                <h4 className="mt-2 text-lg font-semibold text-theme-primary">Author the intent contract</h4>
              </div>
              <button
                type="button"
                onClick={() => artifact && setBuilderState(createBuilderState(artifact))}
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-theme-secondary hover:bg-surface-hover"
              >
                Reset from seed
              </button>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <BuilderField
                label="Contract Title"
                value={builderState.title}
                onChange={(value) => updateBuilderState('title', value)}
                placeholder="Follow-up delay distribution"
              />
              <BuilderField
                label="Natural Language"
                value={builderState.naturalLanguage}
                onChange={(value) => updateBuilderState('naturalLanguage', value)}
                placeholder="Ask the retrieval question in plain language"
              />
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <BuilderPillGroup
                label="Subject"
                options={subjectOptions}
                value={builderState.draftSubject}
                onChange={(value) => updateBuilderState('draftSubject', value)}
              />
              <BuilderPillGroup
                label="Intent"
                options={askOptions}
                value={builderState.draftAsk}
                onChange={(value) => updateBuilderState('draftAsk', value)}
              />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <BuilderField
                label="Focus"
                value={builderState.draftFocus}
                onChange={(value) => updateBuilderState('draftFocus', value)}
                placeholder="follow-up delay, next diagnostic step"
              />
              <BuilderField
                label="Evidence"
                value={builderState.draftEvidence}
                onChange={(value) => updateBuilderState('draftEvidence', value)}
                placeholder="protocol, pathology, imaging"
              />
              <BuilderField
                label="Group By"
                value={builderState.draftGroupBy}
                onChange={(value) => updateBuilderState('draftGroupBy', value)}
                placeholder="center, pathway step"
              />
              <BuilderField
                label="Window"
                value={builderState.draftWindow}
                onChange={(value) => updateBuilderState('draftWindow', value)}
                placeholder="this quarter"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-tertiary">Resolved contract</div>
            <h4 className="mt-2 text-lg font-semibold text-theme-primary">Bind to ContextObjects and semantics</h4>

            <div className="mt-5 grid gap-5 xl:grid-cols-3">
              <BuilderField
                label="Context Contract"
                value={builderState.resolvedContextContract}
                onChange={(value) => updateBuilderState('resolvedContextContract', value)}
                placeholder="oncology_episode_context"
              />
              <BuilderPillGroup
                label="Assertion Type"
                options={assertionOptions}
                value={builderState.resolvedAssertionType}
                onChange={(value) => updateBuilderState('resolvedAssertionType', value)}
              />
              <BuilderPillGroup
                label="Retrieval Mode"
                options={retrievalModeOptions}
                value={builderState.resolvedRetrievalMode}
                onChange={(value) => updateBuilderState('resolvedRetrievalMode', value)}
              />
            </div>

            <div className="mt-5">
              <BuilderField
                label="Resolution Predicates"
                value={builderState.resolvedPredicates}
                onChange={(value) => updateBuilderState('resolvedPredicates', value)}
                placeholder="contains workflow steps, bind protocol knowledge"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-tertiary">Executable contract</div>
                <h4 className="mt-2 text-lg font-semibold text-theme-primary">Shape the deterministic execution target</h4>
              </div>
              <button
                type="button"
                onClick={() => onRunArtifact(workingArtifact.id, workingArtifact)}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm font-medium text-emerald-500 hover:bg-emerald-500/10"
              >
                {artifactLoading && activeArtifactId === workingArtifact.id ? 'Running live negotiation...' : 'Run current builder contract'}
              </button>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <BuilderField
                label="From"
                value={builderState.executableFrom}
                onChange={(value) => updateBuilderState('executableFrom', value)}
                placeholder="followup_population_context"
              />
              <BuilderField
                label="Output"
                value={builderState.executableOutput}
                onChange={(value) => updateBuilderState('executableOutput', value)}
                placeholder="guidance_bundle"
              />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <BuilderField
                label="Contains"
                value={builderState.executableContains}
                onChange={(value) => updateBuilderState('executableContains', value)}
                placeholder="diagnostic_evidence, protocol_guidance"
              />
              <BuilderField
                label="Subject Anchor"
                value={builderState.subjectAnchor}
                onChange={(value) => updateBuilderState('subjectAnchor', value)}
                placeholder="patient"
              />
              <BuilderField
                label="Subject Source"
                value={builderState.subjectSource}
                onChange={(value) => updateBuilderState('subjectSource', value)}
                placeholder="current_scope"
              />
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Plan Family</div>
              <div className="grid gap-3 xl:grid-cols-2">
                {planFamilyOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => updateBuilderState('planFamily', option.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      builderState.planFamily === option.id
                        ? 'border-primary/40 bg-primary/5 shadow-sm'
                        : 'border-border bg-background hover:border-primary/30 hover:bg-surface-hover'
                    }`}
                  >
                    <div className="text-sm font-semibold text-theme-primary">{option.label}</div>
                    <p className="mt-2 text-sm leading-6 text-theme-secondary">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Window Type</div>
                <select
                  value={builderState.windowType}
                  onChange={(event) => updateBuilderState('windowType', event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-theme-primary outline-none focus:border-primary"
                >
                  {windowTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <BuilderField
                label="Window Value"
                value={builderState.windowValue}
                onChange={(value) => updateBuilderState('windowValue', value)}
                placeholder="current"
              />
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Where predicates</div>
                <button
                  type="button"
                  onClick={addWhereRow}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-theme-secondary hover:bg-surface-hover"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add predicate
                </button>
              </div>
              <div className="space-y-3">
                {builderState.whereRows.map((row) => (
                  <div key={row.id} className="grid gap-3 rounded-2xl border border-border bg-background p-3 xl:grid-cols-[1.2fr_0.7fr_1fr_auto]">
                    <input
                      value={row.field}
                      onChange={(event) => updateWhereRow(row.id, 'field', event.target.value)}
                      placeholder="delay_type"
                      className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-theme-primary outline-none placeholder:text-theme-tertiary focus:border-primary"
                    />
                    <input
                      value={row.op}
                      onChange={(event) => updateWhereRow(row.id, 'op', event.target.value)}
                      placeholder="eq"
                      className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-theme-primary outline-none placeholder:text-theme-tertiary focus:border-primary"
                    />
                    <input
                      value={row.value}
                      onChange={(event) => updateWhereRow(row.id, 'value', event.target.value)}
                      placeholder="followup"
                      className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-theme-primary outline-none placeholder:text-theme-tertiary focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeWhereRow(row.id)}
                      className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-3 py-3 text-theme-secondary hover:bg-surface-hover"
                      title="Remove predicate"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-tertiary">Canonical previews</div>
            <h4 className="mt-2 text-lg font-semibold text-theme-primary">Inspect the authored contract before promotion</h4>

            <div className="mt-5 grid gap-4">
              <PreviewBlock title="Draft Con2L" payload={workingArtifact.draft} />
              <PreviewBlock title="Resolved contract" payload={workingArtifact.resolved} />
              <PreviewBlock title="Executable Con2L" payload={workingArtifact.executable} />
              <PreviewBlock title="Compiled Mongo target" payload={compiledPreview} />
            </div>
          </section>

          <Con2LArtifactInspector
            artifact={workingArtifact}
            preview={activeArtifactId === workingArtifact.id ? artifactPreview : null}
            error={activeArtifactId === workingArtifact.id ? artifactError : null}
            loading={activeArtifactId === workingArtifact.id && artifactLoading}
            onRun={() => onRunArtifact(workingArtifact.id, workingArtifact)}
          />
        </div>
      </div>
    </div>
  );
}

const RetrievalStudio = ({ mode = 'library', children }) => {
  const meta = modeMeta[mode] || modeMeta.library;
  const Icon = meta.icon;
  const [activeDialect, setActiveDialect] = useState('con2l');
  const [activeArtifactId, setActiveArtifactId] = useState(AGENTIC_COPILOT_STRATEGY.retrieval.con2lArtifacts[0]?.id || null);
  const [artifactPreview, setArtifactPreview] = useState(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState(null);
  const [semanticConfirmationState, setSemanticConfirmationState] = useState(null);

  useEffect(() => {
    setArtifactPreview(null);
    setArtifactError(null);
    setArtifactLoading(false);
    setSemanticConfirmationState(null);
  }, [mode, activeDialect]);

  useEffect(() => {
    setActiveDialect('con2l');
  }, [mode]);

  const loadArtifactPreview = async (artifactId, artifactPayload = null, semanticConfirmation = null) => {
    setActiveArtifactId(artifactId);
    setArtifactLoading(true);
    setArtifactError(null);
    try {
      const response = await fetch('/api/context-objects/strategy-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'con2lArtifact',
          id: artifactId,
          artifact: artifactPayload,
          runtime: {
            semanticConfirmation,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to preview contract');
      }
      setArtifactPreview(payload);
      if (payload?.runtime?.status === 'confirmation_required' && payload?.runtime?.confirmation?.required) {
        setSemanticConfirmationState({
          artifactId,
          artifactPayload,
          confirmation: payload.runtime.confirmation,
        });
      } else {
        setSemanticConfirmationState(null);
      }
    } catch (error) {
      setArtifactPreview(null);
      setArtifactError(error.message || 'Failed to preview contract');
      setSemanticConfirmationState(null);
    } finally {
      setArtifactLoading(false);
    }
  };

  const sharedCon2LProps = {
    artifacts: AGENTIC_COPILOT_STRATEGY.retrieval.con2lArtifacts,
    selectedArtifactId: activeArtifactId,
    onSelectArtifact: setActiveArtifactId,
    onRunArtifact: loadArtifactPreview,
    activeArtifactId,
    artifactLoading,
    artifactPreview,
    artifactError,
  };

  return (
    <div className="space-y-6">
      <SemanticConfirmationDialog
        state={semanticConfirmationState}
        loading={artifactLoading}
        onCancel={() => setSemanticConfirmationState(null)}
        onConfirm={(selection) => loadArtifactPreview(
          semanticConfirmationState?.artifactId,
          semanticConfirmationState?.artifactPayload || null,
          selection
        )}
      />

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-400">
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold text-theme-primary">{meta.title}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-theme-secondary">{meta.description}</p>
            </div>
          </div>
          <QueryDialectTabs activeDialect={activeDialect} onChange={setActiveDialect} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="text-sm font-semibold text-theme-primary">
          {activeDialect === 'aql' ? meta.aqlDescription : meta.con2lDescription}
        </div>
      </div>

      {activeDialect === 'aql' ? (
        <div>{children}</div>
      ) : mode === 'library' ? (
        <Con2LLibraryPanel {...sharedCon2LProps} />
      ) : mode === 'lab' ? (
        <Con2LLabPanel {...sharedCon2LProps} />
      ) : (
        <Con2LBuilderPanel {...sharedCon2LProps} />
      )}
    </div>
  );
};

export default RetrievalStudio;
