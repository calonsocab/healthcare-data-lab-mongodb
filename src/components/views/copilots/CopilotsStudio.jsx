"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  MessagesSquare,
  Boxes,
  Wrench,
  LayoutTemplate,
  Activity,
  ArrowRight,
  GitBranch,
  Sparkles,
  Network,
  Loader2,
} from 'lucide-react';
import {
  AGENTIC_COPILOT_STRATEGY,
  AGENTIC_COPILOT_SUMMARY,
} from '@/config/agenticCopilotStrategy';
import {
  COPILOT_BUILDER_FRAMEWORK,
  COPILOT_BUILDER_SUMMARY,
} from '@/config/copilotBuilderFramework';
import KehrnelDocsPanel from '@/components/common/KehrnelDocsPanel';
import { summarizeSemanticMatchCoverage } from '@/lib/contextObjects/semanticMatching';

const modeMeta = {
  questions: {
    icon: MessagesSquare,
    title: 'Question Library',
    description: 'Question families, personas, and expected products used to drive deterministic answer governance.',
  },
  products: {
    icon: Boxes,
    title: 'Semantic Products',
    description: 'Governed answer contracts that sit on top of ContextObjects and Retrieval.',
  },
  tools: {
    icon: Wrench,
    title: 'Tools and Plans',
    description: 'Capabilities and execution plans used by semantic products to retrieve and compute safely.',
  },
  answers: {
    icon: LayoutTemplate,
    title: 'Answer Models',
    description: 'How raw results become a final narrative answer, widgets, and panel handoff.',
  },
  control: {
    icon: Activity,
    title: 'Control Plane',
    description: 'The observability layer for question coverage, product readiness, retrieval determinism, and scenario quality.',
  },
};

const MetricCard = ({ label, value }) => (
  <div className="rounded-xl border border-border bg-background px-4 py-3">
    <div className="text-xs font-medium uppercase tracking-[0.14em] text-theme-tertiary">{label}</div>
    <div className="mt-2 text-xl font-semibold text-theme-primary">{value}</div>
  </div>
);

const toneClassName = {
  emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500',
  sky: 'border-sky-500/20 bg-sky-500/5 text-sky-500',
  violet: 'border-violet-500/20 bg-violet-500/5 text-violet-500',
  amber: 'border-amber-500/20 bg-amber-500/5 text-amber-500',
  slate: 'border-border bg-background text-theme-secondary',
};

const Pill = ({ children, tone = 'slate' }) => (
  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClassName[tone] || toneClassName.slate}`}>
    {children}
  </span>
);

const SectionShell = ({ icon: Icon, title, description, children }) => (
  <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-emerald-400" />
      <h3 className="text-base font-semibold text-theme-primary">{title}</h3>
    </div>
    {description ? <p className="mt-3 max-w-4xl text-sm leading-6 text-theme-secondary">{description}</p> : null}
    <div className="mt-4">{children}</div>
  </section>
);

const CopilotsStudio = ({ mode = 'questions' }) => {
  const [definitionAuditState, setDefinitionAuditState] = useState({
    loading: mode === 'control',
    error: null,
    items: [],
    total: 0,
  });
  const meta = modeMeta[mode] || modeMeta.questions;
  const Icon = meta.icon;
  const modeFocus = COPILOT_BUILDER_FRAMEWORK.modeFocus[mode] || COPILOT_BUILDER_FRAMEWORK.modeFocus.questions;

  useEffect(() => {
    if (mode !== 'control') return;

    let cancelled = false;

    const fetchDefinitionAudit = async () => {
      try {
        setDefinitionAuditState((prev) => ({ ...prev, loading: true, error: null }));
        const response = await fetch('/api/definitions?limit=250');
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load ContextObject audit data');
        }

        if (!cancelled) {
          setDefinitionAuditState({
            loading: false,
            error: null,
            items: Array.isArray(payload.items) ? payload.items : [],
            total: Number(payload.total || 0),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setDefinitionAuditState({
            loading: false,
            error: error.message,
            items: [],
            total: 0,
          });
        }
      }
    };

    fetchDefinitionAudit();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const liveContextAudit = useMemo(() => {
    const items = Array.isArray(definitionAuditState.items) ? definitionAuditState.items : [];
    const byFamily = new Map();
    let preservedNative = 0;
    let nodeProjection = 0;
    let copilotEligible = 0;
    let strictDeterminism = 0;
    let clarificationOnAmbiguity = 0;
    let semanticallyReady = 0;
    let descriptionReady = 0;
    let valueSetReady = 0;
    let hintReady = 0;
    let embeddingReady = 0;
    let ontologyReady = 0;
    let confirmationReady = 0;

    items.forEach((item) => {
      const lifecycle = item?.metadata?.definitionLifecycle || {};
      const contract = item?.metadata?.contextContract || {};
      const canonicalSource = lifecycle.canonicalSource || item?.definition?.canonicalSource || 'node_projection';
      const sourceFamily = lifecycle.sourceFamily || item?.definition?.sourceModel?.family || 'Unspecified';
      const semantic = summarizeSemanticMatchCoverage(item);

      if (canonicalSource === 'native_definition') preservedNative += 1;
      else nodeProjection += 1;

      if (contract?.copilot?.eligible) copilotEligible += 1;
      if (contract?.retrievalPolicy?.deterministicCompilation === 'strict') strictDeterminism += 1;
      if (contract?.resolutionPolicy?.clarificationPolicy === 'on_ambiguity') clarificationOnAmbiguity += 1;
      if (semantic.semanticReady) semanticallyReady += 1;
      if (semantic.readinessSignals.descriptionCoverage) descriptionReady += 1;
      if (semantic.readinessSignals.valueSetCoverage) valueSetReady += 1;
      if (semantic.readinessSignals.hintCoverage) hintReady += 1;
      if (semantic.readinessSignals.embeddingCoverage) embeddingReady += 1;
      if (semantic.readinessSignals.ontologyCoverage) ontologyReady += 1;
      if (semantic.readinessSignals.confirmationCoverage) confirmationReady += 1;

      byFamily.set(sourceFamily, (byFamily.get(sourceFamily) || 0) + 1);
    });

    const familyRows = Array.from(byFamily.entries())
      .map(([family, count]) => ({ family, count }))
      .sort((left, right) => right.count - left.count || left.family.localeCompare(right.family));

    const sampleRows = items.slice(0, 8).map((item) => {
      const lifecycle = item?.metadata?.definitionLifecycle || {};
      const contract = item?.metadata?.contextContract || {};
      const semantic = summarizeSemanticMatchCoverage(item);
      return {
        id: item.id,
        name: item.name,
        family: lifecycle.sourceFamily || item?.definition?.sourceModel?.family || 'Unspecified',
        canonicalSource: lifecycle.canonicalSource || item?.definition?.canonicalSource || 'node_projection',
        copilotUsage: contract?.copilot?.preferredUsage || 'not_defined',
        determinism: contract?.retrievalPolicy?.deterministicCompilation || 'guided',
        semanticScore: semantic.readinessScore,
      };
    });

    const gapRows = items
      .map((item) => {
        const lifecycle = item?.metadata?.definitionLifecycle || {};
        const semantic = summarizeSemanticMatchCoverage(item);

        return {
          id: item.id,
          name: item.name,
          family: lifecycle.sourceFamily || item?.definition?.sourceModel?.family || 'Unspecified',
          semanticScore: semantic.readinessScore,
          missing: semantic.missingSignals
            .map((signal) => signal.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
            .map((signal) => signal.replace(/[_-]+/g, ' '))
            .map((signal) => signal.replace(/\b\w/g, (match) => match.toUpperCase()))
        };
      })
      .sort((left, right) => left.semanticScore - right.semanticScore || left.name.localeCompare(right.name))
      .slice(0, 8);

    return {
      total: definitionAuditState.total || items.length,
      loaded: items.length,
      preservedNative,
      nodeProjection,
      copilotEligible,
      strictDeterminism,
      clarificationOnAmbiguity,
      semanticallyReady,
      descriptionReady,
      valueSetReady,
      hintReady,
      embeddingReady,
      ontologyReady,
      confirmationReady,
      familyRows,
      sampleRows,
      gapRows,
    };
  }, [definitionAuditState.items, definitionAuditState.total]);

  const renderBody = () => {
    if (mode === 'questions') {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="text-base font-semibold text-theme-primary">Question generation inputs</h3>
              <p className="mt-3 text-sm leading-6 text-theme-secondary">
                HDL should generate question libraries from source-model richness plus approved target roles, not
                from a fixed arbitrary quota. Each role should inherit scope, evidence need, and risk posture from
                the ContextObjects it can access.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill tone="emerald">Roles</Pill>
                <Pill tone="sky">ContextObject coverage</Pill>
                <Pill tone="violet">Data richness signals</Pill>
                <Pill tone="amber">Clarification risk</Pill>
              </div>
            </article>

            <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="text-base font-semibold text-theme-primary">What every approved question should store</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {['Expected product', 'Expected Request IR / Con2L shape', 'Answer model kind', 'Human expectation', 'Clarification policy', 'Panel destination'].map((item) => (
                  <div key={item} className="rounded-xl border border-border bg-background p-4 text-sm text-theme-secondary">
                    <div className="font-semibold text-theme-primary">{item}</div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-theme-primary">Question library</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-background text-theme-tertiary">
                  <tr>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Question</th>
                    <th className="px-5 py-3 font-medium">Family</th>
                    <th className="px-5 py-3 font-medium">Expected product</th>
                    <th className="px-5 py-3 font-medium">Answer model</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENTIC_COPILOT_STRATEGY.copilots.questionLibrary.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-5 py-4 text-theme-secondary">{row.role}</td>
                      <td className="px-5 py-4 font-medium text-theme-primary">{row.question}</td>
                      <td className="px-5 py-4 text-theme-secondary">{row.family}</td>
                      <td className="px-5 py-4 text-theme-secondary">{row.expectedProduct}</td>
                      <td className="px-5 py-4 text-theme-secondary">{row.answerModel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (mode === 'products') {
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          {AGENTIC_COPILOT_STRATEGY.copilots.semanticProducts.map((product) => (
            <article key={product.id} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-theme-primary">{product.id}</h3>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-500">
                  {product.answerModel}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-theme-secondary">{product.purpose}</p>
              <div className="mt-4 space-y-2 text-sm text-theme-secondary">
                <div><span className="font-semibold text-theme-primary">Requires:</span> {product.requires.join(', ')}</div>
                <div><span className="font-semibold text-theme-primary">Route:</span> {product.route}</div>
              </div>
            </article>
          ))}
        </div>
      );
    }

    if (mode === 'tools') {
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          {AGENTIC_COPILOT_STRATEGY.copilots.toolsAndPlans.map((item) => (
            <article key={item.id} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-theme-primary">{item.id}</h3>
                <span className="rounded-full border border-sky-500/20 bg-sky-500/5 px-3 py-1 text-xs font-medium text-sky-500">
                  {item.type}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-theme-secondary">{item.purpose}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.usedBy.map((value) => (
                  <span key={value} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary">
                    {value}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      );
    }

    if (mode === 'answers') {
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          {AGENTIC_COPILOT_STRATEGY.copilots.answerModels.map((model) => (
            <article key={model.id} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-theme-primary">{model.id}</h3>
                <span className="rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-xs font-medium text-violet-500">
                  {model.handoff}
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-theme-secondary">
                <div><span className="font-semibold text-theme-primary">Lead:</span> {model.lead}</div>
                <div><span className="font-semibold text-theme-primary">Widgets:</span> {model.widgets.join(', ')}</div>
              </div>
            </article>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {AGENTIC_COPILOT_STRATEGY.copilots.controlPlane.map((pillar) => (
          <article key={pillar.id} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-theme-primary">{pillar.name}</h3>
            <p className="mt-3 text-sm leading-6 text-theme-secondary">{pillar.description}</p>
          </article>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-theme bg-surface p-2 text-emerald-400">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-theme-primary">{meta.title}</h2>
              <p className="mt-1 max-w-4xl text-sm text-theme-secondary">{meta.description}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-theme bg-surface px-3 py-2 text-xs text-theme-secondary">
          Copilots
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Questions" value={AGENTIC_COPILOT_SUMMARY.questions} />
        <MetricCard label="Products" value={AGENTIC_COPILOT_SUMMARY.products} />
        <MetricCard label="Tools + plans" value={AGENTIC_COPILOT_SUMMARY.toolsAndPlans} />
        <MetricCard label="Answer models" value={AGENTIC_COPILOT_SUMMARY.answerModels} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Workflow Steps" value={COPILOT_BUILDER_SUMMARY.workflowSteps} />
        <MetricCard label="Enrichment Layers" value={COPILOT_BUILDER_SUMMARY.enrichmentLayers} />
        <MetricCard label="Artifact Buckets" value={COPILOT_BUILDER_SUMMARY.artifactBuckets} />
        <MetricCard label="Audit Loops" value={COPILOT_BUILDER_SUMMARY.improvementLoops} />
      </div>

      <SectionShell
        icon={GitBranch}
        title="Practical Copilot Builder Framework"
        description={COPILOT_BUILDER_FRAMEWORK.northStar}
      >
        <div className="grid gap-3 lg:grid-cols-4">
          {COPILOT_BUILDER_FRAMEWORK.workflow.map((step, index) => (
            <article key={step.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">
                  Step {index + 1}
                </span>
                <Pill tone={index < 2 ? 'emerald' : index < 5 ? 'sky' : index < 7 ? 'violet' : 'amber'}>
                  {index < 2 ? 'Foundation' : index < 5 ? 'Factory' : index < 7 ? 'Binding' : 'Audit'}
                </Pill>
              </div>
              <div className="mt-3 text-sm font-semibold text-theme-primary">{step.title}</div>
              <p className="mt-2 text-sm leading-6 text-theme-secondary">{step.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {step.outputs.map((item) => (
                  <Pill key={item}>{item}</Pill>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        icon={ArrowRight}
        title="Deterministic Binding Ladder"
        description="Natural language should not jump straight to collections. In HDL, it should bind through ContextObjects and Con2L first, then compile into safe execution."
      >
        <div className="grid gap-3 lg:grid-cols-5">
          {COPILOT_BUILDER_FRAMEWORK.deterministicPath.map((step, index) => (
            <article key={step.id} className="rounded-xl border border-border bg-background p-4 text-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">
                Layer {index + 1}
              </div>
              <div className="mt-2 font-semibold text-theme-primary">{step.title}</div>
              <p className="mt-2 leading-6 text-theme-secondary">{step.summary}</p>
            </article>
          ))}
        </div>
      </SectionShell>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionShell
          icon={Sparkles}
          title="Semantic Match Layer"
          description="To make Con2L binding robust, HDL should enrich ContextObjects with the semantic signals needed for safe matching."
        >
          <div className="grid gap-3">
            {COPILOT_BUILDER_FRAMEWORK.enrichmentLayers.map((layer) => (
              <article key={layer.id} className="rounded-xl border border-border bg-background p-4">
                <div className="text-sm font-semibold text-theme-primary">{layer.title}</div>
                <p className="mt-2 text-sm leading-6 text-theme-secondary">{layer.summary}</p>
              </article>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          icon={Network}
          title="Confidence and Confirmation"
          description="When the semantic layer is not secure enough, the operator should confirm the intended concept, scope, or anchor before execution."
        >
          <div className="grid gap-3">
            {COPILOT_BUILDER_FRAMEWORK.ambiguityPolicies.map((policy) => (
              <article key={policy.id} className="rounded-xl border border-border bg-background p-4">
                <div className="text-sm font-semibold text-theme-primary">{policy.title}</div>
                <p className="mt-2 text-sm leading-6 text-theme-secondary">{policy.summary}</p>
              </article>
            ))}
          </div>
        </SectionShell>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionShell
          icon={Boxes}
          title="Registry Artifacts HDL Should Author"
          description="The Copilot Menu should become the authoring surface for these governed artifacts, not just a static architecture explainer."
        >
          <div className="grid gap-3">
            {COPILOT_BUILDER_FRAMEWORK.registryArtifacts.map((bucket) => (
              <article key={bucket.id} className="rounded-xl border border-border bg-background p-4">
                <div className="text-sm font-semibold text-theme-primary">{bucket.title}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {bucket.items.map((item) => (
                    <Pill key={item}>{item}</Pill>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          icon={Activity}
          title="Continuous Audit Loops"
          description="The control plane should monitor quality continuously and feed backlog work, not just display the latest runtime state."
        >
          <div className="grid gap-3">
            {COPILOT_BUILDER_FRAMEWORK.improvementLoops.map((loop) => (
              <article key={loop.id} className="rounded-xl border border-border bg-background p-4">
                <div className="text-sm font-semibold text-theme-primary">{loop.title}</div>
                <p className="mt-2 text-sm leading-6 text-theme-secondary">{loop.summary}</p>
              </article>
            ))}
          </div>
        </SectionShell>
      </div>

      {mode === 'control' && (
        <SectionShell
          icon={Activity}
          title="Live ContextObject Audit"
          description="This audit is derived from the current ContextObject registry so the control plane can monitor how much of the semantic layer is preserved natively versus authored as node projections."
        >
          {definitionAuditState.loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-6 text-sm text-theme-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading ContextObject audit data...
            </div>
          ) : definitionAuditState.error ? (
            <div className="rounded-xl border border-border bg-background px-4 py-4 text-sm text-theme-secondary">
              {definitionAuditState.error}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-5">
                <MetricCard label="Registry Total" value={liveContextAudit.total} />
                <MetricCard label="Native Preserved" value={liveContextAudit.preservedNative} />
                <MetricCard label="Node Projection" value={liveContextAudit.nodeProjection} />
                <MetricCard label="Copilot Eligible" value={liveContextAudit.copilotEligible} />
                <MetricCard label="Strict Determinism" value={liveContextAudit.strictDeterminism} />
              </div>

              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <MetricCard label="Semantic Ready" value={liveContextAudit.semanticallyReady} />
                <MetricCard label="Descriptions" value={liveContextAudit.descriptionReady} />
                <MetricCard label="Value Sets" value={liveContextAudit.valueSetReady} />
                <MetricCard label="Hints" value={liveContextAudit.hintReady} />
                <MetricCard label="Embeddings" value={liveContextAudit.embeddingReady} />
                <MetricCard label="Ontology" value={liveContextAudit.ontologyReady} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <article className="rounded-xl border border-border bg-background p-4">
                  <div className="text-sm font-semibold text-theme-primary">Source Families</div>
                  <div className="mt-4 space-y-2">
                    {liveContextAudit.familyRows.length === 0 ? (
                      <div className="text-sm text-theme-secondary">No ContextObjects available yet.</div>
                    ) : (
                      liveContextAudit.familyRows.map((row) => (
                        <div key={row.family} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                          <span className="text-theme-primary">{row.family}</span>
                          <span className="text-theme-secondary">{row.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 text-xs text-theme-tertiary">
                    Loaded {liveContextAudit.loaded} definitions from the registry snapshot.
                  </div>
                </article>

                <article className="rounded-xl border border-border bg-background p-4">
                  <div className="text-sm font-semibold text-theme-primary">Control Sample</div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-theme-tertiary">
                        <tr>
                          <th className="pb-3 font-medium">ContextObject</th>
                          <th className="pb-3 font-medium">Family</th>
                          <th className="pb-3 font-medium">Canonical</th>
                          <th className="pb-3 font-medium">Copilot usage</th>
                          <th className="pb-3 font-medium">Determinism</th>
                          <th className="pb-3 font-medium">Semantic</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveContextAudit.sampleRows.map((row) => (
                          <tr key={row.id} className="border-t border-border">
                            <td className="py-3 pr-4 font-medium text-theme-primary">{row.name}</td>
                            <td className="py-3 pr-4 text-theme-secondary">{row.family}</td>
                            <td className="py-3 pr-4 text-theme-secondary">{row.canonicalSource}</td>
                            <td className="py-3 pr-4 text-theme-secondary">{row.copilotUsage}</td>
                            <td className="py-3 text-theme-secondary">{row.determinism}</td>
                            <td className="py-3 text-theme-secondary">{row.semanticScore}/7</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-theme-secondary">
                    Clarification governed: {liveContextAudit.confirmationReady} ContextObjects
                  </div>
                </article>
              </div>

              <article className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-theme-primary">Semantic Readiness Gaps</div>
                  <div className="text-xs text-theme-secondary">
                    Clarification on ambiguity: {liveContextAudit.clarificationOnAmbiguity}
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-theme-tertiary">
                      <tr>
                        <th className="pb-3 font-medium">ContextObject</th>
                        <th className="pb-3 font-medium">Family</th>
                        <th className="pb-3 font-medium">Semantic score</th>
                        <th className="pb-3 font-medium">Missing safeguards</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveContextAudit.gapRows.length === 0 ? (
                        <tr>
                          <td className="py-3 text-theme-secondary" colSpan={4}>No ContextObjects available yet.</td>
                        </tr>
                      ) : (
                        liveContextAudit.gapRows.map((row) => (
                          <tr key={row.id} className="border-t border-border">
                            <td className="py-3 pr-4 font-medium text-theme-primary">{row.name}</td>
                            <td className="py-3 pr-4 text-theme-secondary">{row.family}</td>
                            <td className="py-3 pr-4 text-theme-secondary">{row.semanticScore}/7</td>
                            <td className="py-3 text-theme-secondary">{row.missing.join(', ') || 'None'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          )}
        </SectionShell>
      )}

      <SectionShell
        icon={Activity}
        title="Scenario Packs Feeding Evaluation"
        description="Stable scenario packs should be generated from ContextObject instances so products can be evaluated against repeatable synthetic and mapped operational cases."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {AGENTIC_COPILOT_STRATEGY.factory.scenarioPacks.map((pack) => (
            <article key={pack.id} className="rounded-xl border border-border bg-background p-4">
              <div className="text-sm font-semibold text-theme-primary">{pack.name}</div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">
                Emits
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {pack.emits.map((item) => (
                  <Pill key={item} tone="emerald">{item}</Pill>
                ))}
              </div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">
                Exercises
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {pack.usedBy.map((item) => (
                  <Pill key={item}>{item}</Pill>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionShell>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-emerald-400" />
          <h3 className="text-base font-semibold text-theme-primary">Question to answer governance</h3>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {['Question', 'Request IR', 'Context contract', 'Semantic product', 'Answer model'].map((step, index) => (
            <div key={step} className="rounded-xl border border-border bg-background p-4 text-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Step {index + 1}</div>
              <div className="mt-2 font-semibold text-theme-primary">{step}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-theme-primary">Shared contract resolution core</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-theme-secondary">
            Copilots share the same early contract-resolution core as Retrieval. The difference is that a
            copilot branches from a resolved context contract into a governed semantic product, then uses tools,
            plans, and an answer model to produce the final experience.
          </p>
          <div className="mt-4 space-y-3">
            {AGENTIC_COPILOT_STRATEGY.contractResolution.steps.map((step, index) => (
              <div key={step.id} className="flex gap-3 rounded-xl border border-border bg-background p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-500">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-theme-primary">{step.name}</div>
                  <p className="mt-1 text-sm leading-6 text-theme-secondary">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-theme-primary">Context contracts feeding products</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {AGENTIC_COPILOT_STRATEGY.contextContracts.map((contract) => (
              <article key={contract.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-theme-primary">{contract.name}</div>
                  <span className="rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-xs font-medium text-violet-500">
                    {contract.contextType}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contract.retrievalModes.map((mode) => (
                    <span
                      key={mode}
                      className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary"
                    >
                      {mode}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-theme-primary">What contract resolution adds</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {AGENTIC_COPILOT_STRATEGY.contractResolution.capabilities.map((capability) => (
              <article key={capability.id} className="rounded-xl border border-border bg-background p-4">
                <div className="text-sm font-semibold text-theme-primary">{capability.name}</div>
                <p className="mt-2 text-sm leading-6 text-theme-secondary">{capability.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-theme-primary">Why copilots still need another layer</h3>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-theme-secondary">
            <p>
              Contract resolution gets us to the right contextual contract. Copilots then add semantic products,
              governed tool and plan selection, answer models, and a control plane for quality improvement.
            </p>
            <p>
              That separation keeps Con2L useful on its own while still letting complex answer pipelines build on
              the same resolution core.
            </p>
          </div>
        </section>
      </div>

      <SectionShell
        icon={Icon}
        title={modeFocus.title}
        description={modeFocus.summary}
      >
        <div className="flex flex-wrap gap-2">
          {modeFocus.checkpoints.map((item) => (
            <Pill key={item} tone="sky">{item}</Pill>
          ))}
        </div>
      </SectionShell>

      <KehrnelDocsPanel
        title="Kernel docs for Copilots"
        description="These kehrnel docs explain the shared context-contract and Con2L runtime that sits underneath semantic products and answer models."
        docs={AGENTIC_COPILOT_STRATEGY.docs.copilots}
      />

      {renderBody()}
    </div>
  );
};

export default CopilotsStudio;
