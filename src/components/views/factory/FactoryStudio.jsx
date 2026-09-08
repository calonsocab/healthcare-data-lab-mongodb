"use client";

import React, { useState } from 'react';
import { ArrowUpFromLine, Sparkles, Workflow, Shuffle, Wrench } from 'lucide-react';
import { AGENTIC_COPILOT_STRATEGY } from '@/config/agenticCopilotStrategy';
import KehrnelDocsPanel from '@/components/common/KehrnelDocsPanel';

const modeMeta = {
  synthetic: {
    icon: Sparkles,
    title: 'Factory / Synthetic generation',
    description:
      'Generate ContextObject instances, retrieval-ready assets, and scenario packs from recipe-driven contracts rather than only from raw templates.',
  },
  mapping: {
    icon: Workflow,
    title: 'Factory / Mapping',
    description:
      'Map source documents into ContextObjects and reusable blocks through governed Context Map recipes.',
  },
};

const FactoryStudio = ({ mode = 'synthetic', children }) => {
  const meta = modeMeta[mode] || modeMeta.synthetic;
  const Icon = meta.icon;
  const recipes =
    mode === 'mapping'
      ? AGENTIC_COPILOT_STRATEGY.factory.mappingRecipes
      : AGENTIC_COPILOT_STRATEGY.factory.generationRecipes;
  const contextMaps = AGENTIC_COPILOT_STRATEGY.factory.contextMaps;
  const scenarioPacks = AGENTIC_COPILOT_STRATEGY.factory.scenarioPacks;
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  const loadPreview = async (type, id) => {
    setPreviewLoadingId(id);
    setPreviewError(null);
    try {
      const response = await fetch('/api/context-objects/strategy-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to preview asset');
      }
      setPreviewResult(payload);
    } catch (error) {
      setPreviewResult(null);
      setPreviewError(error.message || 'Failed to preview asset');
    } finally {
      setPreviewLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-400">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Factory</p>
            <h2 className="mt-2 text-2xl font-semibold text-theme-primary">{meta.title}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-theme-secondary">{meta.description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-theme-primary">Contract-driven factory path</h3>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {['ContextObjects', 'Context Map or recipe', 'Instances', 'Retrieval or copilot'].map((step, index) => (
              <div key={step} className="rounded-xl border border-border bg-background p-4 text-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">
                  Step {index + 1}
                </div>
                <div className="mt-2 font-semibold text-theme-primary">{step}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Shuffle className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-theme-primary">Why this layer matters</h3>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-theme-secondary">
            <p>
            HDL should not stop at schema design. The same ContextObject contracts need to drive mapping, synthetic
              generation, retrieval assets, and copilot scenario packs so the platform stays coherent end to end.
            </p>
            <p>
              That means generation and mapping become governed assets, not one-off scripts. Kehrnel can then focus
              on execution engines while HDL authors the contracts and recipes.
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-emerald-400" />
          <h3 className="text-base font-semibold text-theme-primary">
            {mode === 'mapping' ? 'Mapping recipes' : 'Generation recipes'}
          </h3>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <article key={recipe.id} className="rounded-xl border border-border bg-background p-4">
              <div className="text-sm font-semibold text-theme-primary">{recipe.name}</div>
              <p className="mt-2 text-sm leading-6 text-theme-secondary">{recipe.purpose}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(recipe.outputs || recipe.stages || []).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-500"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {mode === 'mapping' ? (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-theme-primary">Context Maps</h3>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {contextMaps.map((mapAsset) => (
              <article key={mapAsset.id} className="rounded-xl border border-border bg-background p-4">
                <div className="text-sm font-semibold text-theme-primary">{mapAsset.name}</div>
                <div className="mt-3 grid gap-2 text-sm text-theme-secondary md:grid-cols-2">
                  <div>
                    <span className="font-semibold text-theme-primary">Source:</span> {mapAsset.source}
                  </div>
                  <div>
                    <span className="font-semibold text-theme-primary">Target:</span> {mapAsset.target}
                  </div>
                </div>
              <div className="mt-4 flex flex-wrap gap-2">
                  {mapAsset.blocks.map((block) => (
                    <span
                      key={block}
                      className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary"
                    >
                      {block}
                    </span>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-500">
                  {mapAsset.outcome}
                </div>
                <button
                  type="button"
                  onClick={() => loadPreview('objectMap', mapAsset.id)}
                  className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-500 hover:bg-emerald-500/10"
                >
                  {previewLoadingId === mapAsset.id ? 'Running runtime summary...' : 'Preview + run live runtime summary'}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-theme-primary">Scenario packs emitted by generation</h3>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {scenarioPacks.map((pack) => (
              <article key={pack.id} className="rounded-xl border border-border bg-background p-4">
                <div className="text-sm font-semibold text-theme-primary">{pack.name}</div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">
                  Emits
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pack.emits.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-500"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-theme-tertiary">
                  Used by
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pack.usedBy.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-theme-secondary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => loadPreview('scenarioPack', pack.id)}
                  className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-500 hover:bg-emerald-500/10"
                >
                  {previewLoadingId === pack.id ? 'Loading preview...' : 'Preview generated scenario impact'}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <KehrnelDocsPanel
        title="Kernel docs for Factory"
        description="These kehrnel docs explain Context Map execution, scenario generation contracts, and the runtime split between HDL authoring and kernel execution."
        docs={AGENTIC_COPILOT_STRATEGY.docs.factory}
      />

      {(previewResult || previewError) && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-theme-primary">Preview result</h3>
          </div>
          {previewError ? (
            <p className="mt-3 text-sm text-rose-400">{previewError}</p>
          ) : (
            <div className="mt-4 space-y-4">
              <pre className="overflow-x-auto rounded-xl border border-border bg-background p-4 text-xs leading-5 text-theme-secondary">
                {JSON.stringify(previewResult, null, 2)}
              </pre>
              {previewResult?.runtime && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-theme-primary">Live kehrnel runtime</div>
                    <span className="rounded-full border border-emerald-500/20 bg-white/60 px-3 py-1 text-xs font-medium text-emerald-600">
                      {previewResult.runtime.status || 'unknown'}
                    </span>
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs leading-5 text-theme-secondary">
                    {JSON.stringify(previewResult.runtime, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div>{children}</div>
    </div>
  );
};

export default FactoryStudio;
