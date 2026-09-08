"use client";

import React from 'react';
import { BookOpen, ExternalLink, Copy } from 'lucide-react';

const KehrnelDocsPanel = ({ title = 'Kernel docs', description, docs = [] }) => {
  if (!docs.length) return null;

  const copyPath = async (path) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch (_) {
      // no-op fallback; path remains visible in UI
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-emerald-400" />
        <h3 className="text-base font-semibold text-theme-primary">{title}</h3>
      </div>
      {description ? <p className="mt-3 text-sm leading-6 text-theme-secondary">{description}</p> : null}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {docs.map((doc) => (
          <article key={doc.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-theme-primary">{doc.title}</div>
                <p className="mt-2 text-sm leading-6 text-theme-secondary">{doc.summary}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(doc.topics || []).map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-500"
                >
                  {topic}
                </span>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-surface px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-theme-tertiary">Repo path</div>
              <div className="mt-1 break-all font-mono text-xs text-theme-secondary">{doc.path}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`file://${doc.path}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-500 hover:bg-emerald-500/10"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open file
              </a>
              <button
                type="button"
                onClick={() => copyPath(doc.path)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-theme-secondary hover:bg-background"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy path
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default KehrnelDocsPanel;
