"use client";

import React, { useMemo } from 'react';
import { AlertTriangle, Info, AlertCircle, Wrench, Sparkles } from 'lucide-react';

const severityOrder = { error: 0, warn: 1, info: 2 };

const severityMeta = {
  error: { icon: AlertCircle, className: 'text-red-400', badge: 'bg-red-500/20 text-red-300 border-red-500/30' },
  warn: { icon: AlertTriangle, className: 'text-amber-300', badge: 'bg-amber-500/20 text-amber-200 border-amber-500/30' },
  info: { icon: Info, className: 'text-cyan-300', badge: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/30' }
};

export default function LintPanel({ issues = [], onApplyFix, onApplyAll }) {
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const sev = (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9);
      if (sev !== 0) return sev;
      return `${a.category || ''}`.localeCompare(`${b.category || ''}`);
    });
  }, [issues]);

  const grouped = useMemo(() => {
    const map = new Map();
    sortedIssues.forEach((issue) => {
      const key = issue.category || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(issue);
    });
    return Array.from(map.entries());
  }, [sortedIssues]);

  const counts = useMemo(() => ({
    error: issues.filter((i) => i.severity === 'error').length,
    warn: issues.filter((i) => i.severity === 'warn').length,
    info: issues.filter((i) => i.severity === 'info').length
  }), [issues]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-theme-primary">Schema Lint</h3>
          <p className="text-xs text-theme-secondary mt-1">Header, structure, semantics, and webtemplate export checks</p>
        </div>
        <button
          type="button"
          onClick={onApplyAll}
          disabled={!issues.some((issue) => issue?.fix?.id)}
          className="px-3 py-1.5 text-xs rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1"><Sparkles size={12} /> Fix All</span>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-300">Errors: {counts.error}</span>
        <span className="px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200">Warnings: {counts.warn}</span>
        <span className="px-2 py-1 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">Info: {counts.info}</span>
      </div>

      <div className="flex-1 overflow-auto space-y-4 pr-1 min-h-0">
        {grouped.length === 0 && (
          <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-lg p-4 text-sm text-emerald-300">
            No lint issues detected.
          </div>
        )}

        {grouped.map(([category, categoryIssues]) => (
          <div key={category} className="border border-theme rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-surface border-b border-theme text-xs font-semibold text-theme-primary uppercase tracking-wide">
              {category}
            </div>
            <div className="divide-y divide-theme">
              {categoryIssues.map((issue) => {
                const meta = severityMeta[issue.severity] || severityMeta.info;
                const Icon = meta.icon;
                return (
                  <div key={issue.id} className="p-3 bg-background/70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={14} className={meta.className} />
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.badge}`}>{issue.severity}</span>
                        </div>
                        <p className="text-sm text-theme-primary">{issue.message}</p>
                        {issue.nodePath && <p className="text-xs text-theme-secondary mt-1 font-mono">{issue.nodePath}</p>}
                        {issue.suggestion && <p className="text-xs text-theme-secondary mt-1">{issue.suggestion}</p>}
                      </div>
                      {issue?.fix?.id && (
                        <button
                          type="button"
                          onClick={() => onApplyFix(issue)}
                          className="shrink-0 px-2 py-1 text-xs rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                        >
                          <span className="inline-flex items-center gap-1"><Wrench size={11} /> {issue.fix.label || 'Fix'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
