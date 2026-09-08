"use client";

import React, { useMemo, useState } from 'react';
import { Database, FilePlus2, Loader2, RefreshCw, Search } from 'lucide-react';
import { useDataModels } from '@/providers/DataModelProvider';

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getTemplateDescription(model) {
  return asNonEmptyString(model?.description)
    || asNonEmptyString(model?.metadata?.description)
    || asNonEmptyString(model?.webTemplate?.metadata?.description)
    || '';
}

function getTemplateIdentifier(model) {
  return asNonEmptyString(model?.metadata?.templateId)
    || asNonEmptyString(model?.domainData?.templateId)
    || asNonEmptyString(model?.webTemplate?.nodeId)
    || asNonEmptyString(model?.name)
    || 'Template';
}

const OpenEhrTemplateImportPanel = ({ onImport }) => {
  const { dataModelsByName, refreshDataModels, isLoading, error, activeEnvironment } = useDataModels();
  const [search, setSearch] = useState('');
  const [importingId, setImportingId] = useState('');

  const templates = useMemo(() => {
    return Object.values(dataModelsByName || {})
      .filter((model) => (model?.domain || 'openehr') === 'openehr')
      .sort((left, right) => `${left?.name || ''}`.localeCompare(`${right?.name || ''}`));
  }, [dataModelsByName]);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((model) => {
      const haystack = [
        model?.name,
        getTemplateDescription(model),
        getTemplateIdentifier(model),
        model?.webTemplate?.rmType
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search, templates]);

  const handleImport = async (modelId) => {
    if (!modelId || typeof onImport !== 'function') return;

    try {
      setImportingId(modelId);
      const envId = activeEnvironment?.id || '';
      const response = await fetch(
        `/api/context-objects/import-from-data-model/${encodeURIComponent(modelId)}${envId ? `?env=${encodeURIComponent(envId)}` : ''}`,
        {
          headers: envId ? { 'x-active-env': envId } : undefined
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to import openEHR template');
      }
      onImport(data?.draft || null);
    } catch (importError) {
      console.error('Failed to import openEHR template:', importError);
      window.alert(importError.message || 'Failed to import openEHR template');
    } finally {
      setImportingId('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-theme-secondary">
          Import a preserved openEHR template from the shared data model catalog and open it directly in the ContextObject editor.
        </div>
        <button
          type="button"
          onClick={() => refreshDataModels()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-theme bg-surface text-theme-secondary hover:text-theme-primary hover:border-primary/40 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search openEHR templates..."
          className="w-full pl-10 pr-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary"
        />
      </div>

      <div
        className="max-h-[320px] overflow-auto rounded-lg border border-theme bg-surface"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(100, 116, 139, 0.3) transparent'
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 h-32 text-theme-secondary">
            <Loader2 size={18} className="animate-spin" />
            Loading openEHR templates...
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-error">{error}</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-4 text-sm text-theme-secondary">
            No openEHR templates match the current search.
          </div>
        ) : (
          filteredTemplates.map((model) => {
            const templateId = getTemplateIdentifier(model);
            const description = getTemplateDescription(model);
            const nodeCount = model?.metadata?.counts?.nodeCount;

            return (
              <div
                key={model._id}
                className="flex items-start justify-between gap-4 p-4 border-b border-theme last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-theme-primary">{model?.name || templateId}</span>
                    <span className="px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-[10px] font-medium text-cyan-300">
                      openEHR
                    </span>
                    {model?.webTemplate?.rmType && (
                      <span className="px-2 py-0.5 rounded border border-theme bg-background/50 text-[10px] text-theme-secondary">
                        {model.webTemplate.rmType}
                      </span>
                    )}
                    {Number.isFinite(nodeCount) && (
                      <span className="px-2 py-0.5 rounded border border-theme bg-background/50 text-[10px] text-theme-secondary">
                        {nodeCount} nodes
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-theme-secondary">
                    <Database size={12} />
                    <span className="truncate">{templateId}</span>
                  </div>
                  {description && (
                    <p className="mt-2 text-sm text-theme-secondary line-clamp-2">
                      {description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleImport(model._id)}
                  disabled={importingId === model._id}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {importingId === model._id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FilePlus2 size={14} />
                      Import
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OpenEhrTemplateImportPanel;
