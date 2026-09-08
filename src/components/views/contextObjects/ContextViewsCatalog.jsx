"use client";

import React from 'react';
import { Eye, Layers3, ArrowRightLeft, Bot } from 'lucide-react';
import { AGENTIC_COPILOT_STRATEGY } from '@/config/agenticCopilotStrategy';
import KehrnelDocsPanel from '@/components/common/KehrnelDocsPanel';

const scopeIcons = {
  subject: Eye,
  population: Layers3,
  agentic: Bot,
  retrieval: ArrowRightLeft,
};

const ContextInstancesCatalog = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-theme-primary">ContextObject Instances</h2>
          <p className="mt-1 max-w-3xl text-sm text-theme-secondary">
            Review the realized ContextObjects created from definitions, blocks, and Context Maps.
          </p>
        </div>
        <div className="rounded-lg border border-theme bg-surface px-3 py-2 text-xs text-theme-secondary">
          ContextObjects
        </div>
      </div>

      <div className="rounded-xl border border-theme bg-surface p-5">
        <p className="max-w-4xl text-sm leading-6 text-theme-secondary">
          Instances are the realized ContextObjects created from definitions, blocks, and Context Maps. They can
          be subject-scoped, population-scoped, or agentic, but they remain part of the same core vocabulary.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {AGENTIC_COPILOT_STRATEGY.instances.map((instance) => {
          const Icon = scopeIcons[instance.scope] || Eye;
          return (
            <article
              key={instance.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-theme-primary">{instance.name}</h3>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-theme-tertiary">{instance.scope}</p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-theme-secondary">{instance.purpose}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {instance.outputs.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-500"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <KehrnelDocsPanel
        title="Kernel docs for ContextObjects"
        description="These kehrnel docs explain the execution-kernel side of ContextObjects and the HDL/kehrnel contract behind this area."
        docs={AGENTIC_COPILOT_STRATEGY.docs.contextObjects}
      />
    </div>
  );
};

export default ContextInstancesCatalog;
