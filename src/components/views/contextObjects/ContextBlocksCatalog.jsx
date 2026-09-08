"use client";

import React from 'react';
import { Blocks, Link2, ShieldCheck, Clock3, Flag } from 'lucide-react';
import { AGENTIC_COPILOT_STRATEGY } from '@/config/agenticCopilotStrategy';
import KehrnelDocsPanel from '@/components/common/KehrnelDocsPanel';

const kindIcons = {
  anchor: Link2,
  time: Clock3,
  binding: Flag,
  governance: ShieldCheck,
  workflow: Blocks,
  signal: Flag,
};

const ContextBlocksCatalog = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-theme-primary">ContextObject Building Blocks</h2>
          <p className="mt-1 max-w-3xl text-sm text-theme-secondary">
            Review reusable fragments that can be composed into larger ContextObject definitions.
          </p>
        </div>
        <div className="rounded-lg border border-theme bg-surface px-3 py-2 text-xs text-theme-secondary">
          ContextObjects
        </div>
      </div>

      <div className="rounded-xl border border-theme bg-surface p-5">
        <p className="max-w-4xl text-sm leading-6 text-theme-secondary">
          Blocks are reusable ContextObject fragments. They behave like archetype-like lego pieces that can be
          included in larger definitions without introducing a second public vocabulary beyond ContextObjects.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AGENTIC_COPILOT_STRATEGY.blocks.map((block) => {
          const Icon = kindIcons[block.kind] || Blocks;
          return (
            <article key={block.id} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-theme-primary">{block.name}</h3>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-theme-tertiary">{block.kind}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-theme-secondary">{block.purpose}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {block.fields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-theme-secondary"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <KehrnelDocsPanel
        title="Kernel docs for ContextObject blocks"
        description="Blocks remain part of the ContextObjects vocabulary, but these docs explain how kehrnel resolves and executes the resulting contracts."
        docs={AGENTIC_COPILOT_STRATEGY.docs.contextObjects}
      />
    </div>
  );
};

export default ContextBlocksCatalog;
