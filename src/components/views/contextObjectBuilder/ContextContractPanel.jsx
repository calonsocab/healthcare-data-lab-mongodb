"use client";

import React, { useMemo, useState } from 'react';
import { Plus, X, FileSearch, ShieldCheck, Layers3, Network, Languages, Sparkles } from 'lucide-react';
import {
  VALID_ACCESS_PROFILES,
  VALID_APPROVAL_WORKFLOWS,
  VALID_ASSERTION_MODELS,
  VALID_ASSERTION_DISAMBIGUATION,
  VALID_CLARIFICATION_POLICIES,
  VALID_CONTEXT_TYPES,
  VALID_COPILOT_USAGES,
  VALID_DETERMINISM_LEVELS,
  VALID_EXECUTION_TARGETS,
  VALID_MATERIALIZATION_POLICIES,
  VALID_PHI_SENSITIVITY,
  VALID_PRIMARY_ANCHORS,
  VALID_RERANK_POLICIES,
  VALID_RETRIEVAL_MODES,
  VALID_RESULT_SHAPES,
  VALID_SEMANTIC_CONTRACT_TYPES,
  VALID_SOURCE_OF_TRUTH,
  VALID_TEMPORAL_MODES,
  VALID_TERMINOLOGY_MATCH_MODES,
} from '@/lib/contextObjects/contextContract';

const sectionClassName = 'rounded-2xl border border-theme bg-surface p-5';
const labelClassName = 'block text-sm font-medium text-theme-primary mb-1';
const inputClassName =
  'w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary';

const prettify = (value) =>
  `${value || ''}`
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

const TokenEditor = ({ label, values = [], placeholder, onChange, tone = 'default' }) => {
  const [draft, setDraft] = useState('');
  const toneClasses =
    tone === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500'
      : tone === 'violet'
        ? 'border-violet-500/20 bg-violet-500/5 text-violet-500'
        : 'border-border bg-background text-theme-secondary';

  const commit = () => {
    const nextValues = Array.from(
      new Set(
        [...values, ...draft.split(',').map((value) => value.trim()).filter(Boolean)]
      )
    );
    onChange(nextValues);
    setDraft('');
  };

  const remove = (valueToRemove) => {
    onChange(values.filter((value) => value !== valueToRemove));
  };

  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          className={inputClassName}
        />
        <button
          type="button"
          onClick={commit}
          className="rounded-lg bg-primary/10 px-4 py-2 text-primary hover:bg-primary/20"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${toneClasses}`}
          >
            {value}
            <button type="button" onClick={() => remove(value)} className="hover:text-error">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

const ContextContractPanel = ({ definitionKind = 'context_object', contract, onChange }) => {
  const normalizedKind = definitionKind === 'block' ? 'block' : 'context_object';

  const suggestedContains = useMemo(
    () =>
      normalizedKind === 'block'
        ? ['terminology bindings', 'workflow steps']
        : ['identity', 'temporal events', 'provenance', 'risk signals'],
    [normalizedKind]
  );

  const setField = (field, value) => {
    onChange({ ...contract, [field]: value });
  };

  const setNestedField = (group, field, value) => {
    onChange({
      ...contract,
      [group]: {
        ...(contract?.[group] || {}),
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-theme bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-theme bg-background p-2 text-emerald-400">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-theme-primary">Context contract</h3>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-theme-secondary">
                Context contracts define what this ContextObject means operationally across any data product: what it
                contains, what anchor it uses, how it behaves over time, how deterministic retrieval should resolve it,
                and how downstream runtimes or copilots are allowed to consume it.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
              Anchor aware
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
              Con2L ready
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
              Copilot governed
            </span>
          </div>
        </div>
      </div>

      <section className={sectionClassName}>
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-emerald-400" />
          <h4 className="text-sm font-semibold text-theme-primary">Semantic contract for this data product</h4>
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-theme-secondary">
          This is the semantic layer that the source data product stands for. It is not the final executable query or
          service call. Downstream resolvers bind this contract to AQL, MQL, FHIR search, Kehrnel services, or other
          operational targets.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={labelClassName}>Contract type</label>
            <select
              value={contract.semanticContract?.contractType}
              onChange={(event) => setNestedField('semanticContract', 'contractType', event.target.value)}
              className={inputClassName}
            >
              {VALID_SEMANTIC_CONTRACT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Subject</label>
            <input
              type="text"
              value={contract.semanticContract?.subject || ''}
              onChange={(event) => setNestedField('semanticContract', 'subject', event.target.value)}
              placeholder="patient, encounter, specimen, study"
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>Focus</label>
            <input
              type="text"
              value={contract.semanticContract?.focus || ''}
              onChange={(event) => setNestedField('semanticContract', 'focus', event.target.value)}
              placeholder="alcohol_use, triage_visit, pathology_report"
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>Result shape</label>
            <select
              value={contract.semanticContract?.resultShape}
              onChange={(event) => setNestedField('semanticContract', 'resultShape', event.target.value)}
              className={inputClassName}
            >
              {VALID_RESULT_SHAPES.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClassName}>Source of truth</label>
            <select
              value={contract.semanticContract?.sourceOfTruth}
              onChange={(event) => setNestedField('semanticContract', 'sourceOfTruth', event.target.value)}
              className={inputClassName}
            >
              {VALID_SOURCE_OF_TRUTH.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClassName}>Standard version</label>
            <input
              type="text"
              value={contract.semanticContract?.standardVersion || ''}
              onChange={(event) => setNestedField('semanticContract', 'standardVersion', event.target.value)}
              placeholder="contextobjects.semantic_contract.v1"
              className={inputClassName}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <label className={labelClassName}>Intent</label>
            <textarea
              value={contract.semanticContract?.intent || ''}
              onChange={(event) => setNestedField('semanticContract', 'intent', event.target.value)}
              rows={4}
              placeholder="Describe the meaning this ContextObject stabilizes before any execution binding is chosen."
              className={`${inputClassName} resize-y`}
            />
          </div>
          <TokenEditor
            label="Execution targets"
            values={contract.semanticContract?.executionTargets || []}
            placeholder={VALID_EXECUTION_TARGETS.join(', ')}
            onChange={(values) => setNestedField('semanticContract', 'executionTargets', values)}
            tone="violet"
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={sectionClassName}>
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-theme-primary">Meaning and scope</h4>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClassName}>Context type</label>
              <select
                value={contract.contextType}
                onChange={(event) => setField('contextType', event.target.value)}
                className={inputClassName}
              >
                {VALID_CONTEXT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Primary anchor</label>
              <select
                value={contract.primaryAnchor}
                onChange={(event) => setField('primaryAnchor', event.target.value)}
                className={inputClassName}
              >
                {VALID_PRIMARY_ANCHORS.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Temporal mode</label>
              <select
                value={contract.temporalMode}
                onChange={(event) => setField('temporalMode', event.target.value)}
                className={inputClassName}
              >
                {VALID_TEMPORAL_MODES.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Assertion model</label>
              <select
                value={contract.assertionModel}
                onChange={(event) => setField('assertionModel', event.target.value)}
                className={inputClassName}
              >
                {VALID_ASSERTION_MODELS.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-5">
            <TokenEditor
              label="Contains / reusable pieces"
              values={contract.contains}
              placeholder={`Try: ${suggestedContains.join(', ')}`}
              onChange={(values) => setField('contains', values)}
              tone="emerald"
            />
            <TokenEditor
              label="Output families"
              values={contract.outputFamilies}
              placeholder="status summary, timeline, benchmark, evidence bundle"
              onChange={(values) => setField('outputFamilies', values)}
            />
            <TokenEditor
              label="Terminology bindings"
              values={contract.terminologyBindings}
              placeholder="SNOMED CT, LOINC, BI-RADS, ICD-10"
              onChange={(values) => setField('terminologyBindings', values)}
            />
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-theme-primary">Retrieval and governance</h4>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClassName}>Default retrieval mode</label>
              <select
                value={contract.retrievalPolicy?.defaultMode}
                onChange={(event) => setNestedField('retrievalPolicy', 'defaultMode', event.target.value)}
                className={inputClassName}
              >
                {VALID_RETRIEVAL_MODES.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Materialization policy</label>
              <select
                value={contract.retrievalPolicy?.materialization}
                onChange={(event) => setNestedField('retrievalPolicy', 'materialization', event.target.value)}
                className={inputClassName}
              >
                {VALID_MATERIALIZATION_POLICIES.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Deterministic compilation</label>
              <select
                value={contract.retrievalPolicy?.deterministicCompilation}
                onChange={(event) =>
                  setNestedField('retrievalPolicy', 'deterministicCompilation', event.target.value)
                }
                className={inputClassName}
              >
                {VALID_DETERMINISM_LEVELS.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Access profile</label>
              <select
                value={contract.governance?.accessProfile}
                onChange={(event) => setNestedField('governance', 'accessProfile', event.target.value)}
                className={inputClassName}
              >
                {VALID_ACCESS_PROFILES.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>PHI sensitivity</label>
              <select
                value={contract.governance?.phiSensitivity}
                onChange={(event) => setNestedField('governance', 'phiSensitivity', event.target.value)}
                className={inputClassName}
              >
                {VALID_PHI_SENSITIVITY.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Approval workflow</label>
              <select
                value={contract.governance?.approvalWorkflow}
                onChange={(event) => setNestedField('governance', 'approvalWorkflow', event.target.value)}
                className={inputClassName}
              >
                {VALID_APPROVAL_WORKFLOWS.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border border-theme bg-background px-4 py-3 text-sm text-theme-secondary">
              <input
                type="checkbox"
                checked={Boolean(contract.retrievalPolicy?.supportsCrossSubject)}
                onChange={(event) =>
                  setNestedField('retrievalPolicy', 'supportsCrossSubject', event.target.checked)
                }
                className="h-4 w-4 rounded border-theme"
              />
              Supports cross-subject retrieval
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-theme bg-background px-4 py-3 text-sm text-theme-secondary">
              <input
                type="checkbox"
                checked={Boolean(contract.governance?.provenanceRequired)}
                onChange={(event) =>
                  setNestedField('governance', 'provenanceRequired', event.target.checked)
                }
                className="h-4 w-4 rounded border-theme"
              />
              Provenance required
            </label>
          </div>

          <div className="mt-5">
            <TokenEditor
              label="Allowed retrieval modes"
              values={contract.retrievalPolicy?.allowedModes || []}
              placeholder="context_lookup, analytics, semantic_search"
              onChange={(values) => setNestedField('retrievalPolicy', 'allowedModes', values)}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={sectionClassName}>
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-theme-primary">Terminology and enrichment</h4>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClassName}>Terminology match mode</label>
              <select
                value={contract.terminologyPolicy?.matchMode}
                onChange={(event) => setNestedField('terminologyPolicy', 'matchMode', event.target.value)}
                className={inputClassName}
              >
                {VALID_TERMINOLOGY_MATCH_MODES.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Rerank policy</label>
              <select
                value={contract.enrichmentPolicy?.rerankPolicy}
                onChange={(event) => setNestedField('enrichmentPolicy', 'rerankPolicy', event.target.value)}
                className={inputClassName}
              >
                {VALID_RERANK_POLICIES.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border border-theme bg-background px-4 py-3 text-sm text-theme-secondary">
              <input
                type="checkbox"
                checked={Boolean(contract.enrichmentPolicy?.useDescriptions)}
                onChange={(event) => setNestedField('enrichmentPolicy', 'useDescriptions', event.target.checked)}
                className="h-4 w-4 rounded border-theme"
              />
              Use terminology descriptions during resolution
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-theme bg-background px-4 py-3 text-sm text-theme-secondary">
              <input
                type="checkbox"
                checked={Boolean(contract.enrichmentPolicy?.useEmbeddings)}
                onChange={(event) => setNestedField('enrichmentPolicy', 'useEmbeddings', event.target.checked)}
                className="h-4 w-4 rounded border-theme"
              />
              Use embeddings during candidate retrieval
            </label>
            <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-theme bg-background px-4 py-3 text-sm text-theme-secondary">
              <input
                type="checkbox"
                checked={Boolean(contract.enrichmentPolicy?.relationAwareScoring)}
                onChange={(event) =>
                  setNestedField('enrichmentPolicy', 'relationAwareScoring', event.target.checked)
                }
                className="h-4 w-4 rounded border-theme"
              />
              Re-score candidates using parent/child and sibling relations
            </label>
          </div>

          <div className="mt-5 grid gap-5">
            <TokenEditor
              label="Description sources"
              values={contract.terminologyPolicy?.descriptionSources || []}
              placeholder="terminology display, local glossary, source labels"
              onChange={(values) => setNestedField('terminologyPolicy', 'descriptionSources', values)}
            />
            <TokenEditor
              label="Preferred systems"
              values={contract.terminologyPolicy?.preferredSystems || []}
              placeholder="SNOMED CT, LOINC, ICD-10"
              onChange={(values) => setNestedField('terminologyPolicy', 'preferredSystems', values)}
            />
            <TokenEditor
              label="Concept expansion"
              values={contract.terminologyPolicy?.conceptExpansion || []}
              placeholder="synonyms, descendants, local aliases"
              onChange={(values) => setNestedField('terminologyPolicy', 'conceptExpansion', values)}
            />
            <TokenEditor
              label="Embedding collections"
              values={contract.enrichmentPolicy?.embeddingCollections || []}
              placeholder="contextobjects_definitions, terminology_descriptions"
              onChange={(values) => setNestedField('enrichmentPolicy', 'embeddingCollections', values)}
            />
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-theme-primary">Relation-aware resolution</h4>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClassName}>Assertion disambiguation</label>
              <select
                value={contract.resolutionPolicy?.assertionDisambiguation}
                onChange={(event) =>
                  setNestedField('resolutionPolicy', 'assertionDisambiguation', event.target.value)
                }
                className={inputClassName}
              >
                {VALID_ASSERTION_DISAMBIGUATION.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Clarification policy</label>
              <select
                value={contract.resolutionPolicy?.clarificationPolicy}
                onChange={(event) =>
                  setNestedField('resolutionPolicy', 'clarificationPolicy', event.target.value)
                }
                className={inputClassName}
              >
                {VALID_CLARIFICATION_POLICIES.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Minimum signal count</label>
              <input
                type="number"
                min="1"
                value={contract.resolutionPolicy?.minimumSignalCount ?? 1}
                onChange={(event) =>
                  setNestedField('resolutionPolicy', 'minimumSignalCount', Number(event.target.value || 1))
                }
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>Confidence threshold</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={contract.resolutionPolicy?.confidenceThreshold ?? 0.65}
                onChange={(event) =>
                  setNestedField('resolutionPolicy', 'confidenceThreshold', Number(event.target.value || 0))
                }
                className={inputClassName}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border border-theme bg-background px-4 py-3 text-sm text-theme-secondary">
              <input
                type="checkbox"
                checked={Boolean(contract.relationPolicy?.parentChildAware)}
                onChange={(event) => setNestedField('relationPolicy', 'parentChildAware', event.target.checked)}
                className="h-4 w-4 rounded border-theme"
              />
              Parent-child relations matter
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-theme bg-background px-4 py-3 text-sm text-theme-secondary">
              <input
                type="checkbox"
                checked={Boolean(contract.relationPolicy?.siblingAware)}
                onChange={(event) => setNestedField('relationPolicy', 'siblingAware', event.target.checked)}
                className="h-4 w-4 rounded border-theme"
              />
              Sibling fields can disambiguate meaning
            </label>
            <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-theme bg-background px-4 py-3 text-sm text-theme-secondary">
              <input
                type="checkbox"
                checked={Boolean(contract.relationPolicy?.temporalReasoning)}
                onChange={(event) => setNestedField('relationPolicy', 'temporalReasoning', event.target.checked)}
                className="h-4 w-4 rounded border-theme"
              />
              Temporal relations participate in resolution
            </label>
          </div>

          <div className="mt-5 grid gap-5">
            <TokenEditor
              label="Resolution preference order"
              values={contract.relationPolicy?.preferenceOrder || []}
              placeholder="anchor, parent-child, terminology, descriptions"
              onChange={(values) => setNestedField('relationPolicy', 'preferenceOrder', values)}
              tone="emerald"
            />
            <TokenEditor
              label="Causal / workflow predicates"
              values={contract.relationPolicy?.causalPredicates || []}
              placeholder="causes, follows, blocks, recommended_after"
              onChange={(values) => setNestedField('relationPolicy', 'causalPredicates', values)}
            />
          </div>
        </section>
      </div>

      <section className={sectionClassName}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <h4 className="text-sm font-semibold text-theme-primary">Copilot usage</h4>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-1">
            <label className={labelClassName}>Preferred usage</label>
            <select
              value={contract.copilot?.preferredUsage}
              onChange={(event) => setNestedField('copilot', 'preferredUsage', event.target.value)}
              className={inputClassName}
            >
              {VALID_COPILOT_USAGES.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="xl:col-span-3">
            <label className="flex items-center gap-3 rounded-xl border border-theme bg-background px-4 py-3 text-sm text-theme-secondary">
              <input
                type="checkbox"
                checked={Boolean(contract.copilot?.eligible)}
                onChange={(event) => setNestedField('copilot', 'eligible', event.target.checked)}
                className="h-4 w-4 rounded border-theme"
              />
              This ContextObject can be consumed directly by governed copilots
            </label>
          </div>
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <TokenEditor
            label="Linked semantic products"
            values={contract.copilot?.semanticProducts || []}
            placeholder="patient_case_summary, followup_delay_distribution"
            onChange={(values) => setNestedField('copilot', 'semanticProducts', values)}
            tone="violet"
          />
          <TokenEditor
            label="Linked answer models"
            values={contract.copilot?.answerModels || []}
            placeholder="status_answer, distribution_answer"
            onChange={(values) => setNestedField('copilot', 'answerModels', values)}
            tone="violet"
          />
        </div>
      </section>
    </div>
  );
};

export default ContextContractPanel;
