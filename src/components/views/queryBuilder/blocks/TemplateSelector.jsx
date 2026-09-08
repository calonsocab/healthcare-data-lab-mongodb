// src/components/views/queryBuilder/blocks/TemplateSelector.jsx
"use client";

import React, { useState } from 'react';
import { useQueryBuilderContext } from '@/providers/QueryBuilderProvider';
import { Search, Plus, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const TemplateSelector = ({ isExpanded = true, onToggleExpand }) => {
  const {
    activeTemplates,
    cachedTemplates,
    addTemplate,
    removeTemplate,
    isLoadingTemplates
  } = useQueryBuilderContext();

  const [searchTerm, setSearchTerm] = useState('');

  const getTemplateDisplayName = (doc) =>
    doc?.name ||
    doc?.metadata?.templateId ||
    doc?.webTemplate?.name ||
    doc?._id ||
    'Unnamed Template';

  // Build a list from values (cachedTemplates is now keyed by _id)
  const allTemplates = Object.values(cachedTemplates || {}).map(doc => ({
    id: doc?._id,
    name: getTemplateDisplayName(doc),
  }));

  // Filter/sort by display name
  const filteredTemplates = allTemplates
    .filter(t => t.name.toLowerCase().includes((searchTerm || '').toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-surface p-4 rounded-lg">
      {/* Header with expand/collapse functionality */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-theme-primary">Templates</h3>
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="text-theme-secondary hover:text-theme-primary p-1 rounded focus:outline-none"
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        )}
      </div>

      {/* Show only active templates when collapsed */}
      {!isExpanded && activeTemplates && activeTemplates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeTemplates.map(templateName => (
            <div
              key={templateName}
              className="bg-primary/20 text-primary px-2 py-1 rounded flex items-center gap-1"
            >
              <span className="text-xs">{templateName}</span>
              <button
                onClick={() => removeTemplate(templateName)}
                className="text-primary hover:text-error"
                title="Remove template"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Show full template selector when expanded */}
      {isExpanded && (
        <>
          {/* Search bar */}
          <div className="relative mb-2">
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 pl-10 bg-surface-hover text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={16} className="text-theme-secondary" />
            </div>
          </div>

          {/* Hint text */}
          {(!activeTemplates || activeTemplates.length === 0) && (
            <p className="text-xs text-theme-secondary mb-3 flex items-center gap-1">
              <Plus size={12} className="text-primary" />
              Click to add templates to your query
            </p>
          )}

          {/* Available templates */}
          <div className="max-h-40 overflow-y-auto pr-2">
            {isLoadingTemplates ? (
              <div className="text-center py-4 text-theme-secondary flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Loading templates…</span>
              </div>
            ) : filteredTemplates.length > 0 ? (
              <div className="space-y-2">
                {filteredTemplates.map(t => (
                  <div
                    key={t.id || t.name}
                    className={`flex items-center justify-between p-2 rounded-md ${activeTemplates?.includes(t.name)
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-hover text-theme-primary hover:bg-surface'
                      }`}
                  >
                    <span className="text-sm truncate">{t.name}</span>
                    {activeTemplates?.includes(t.name) ? (
                      <button
                        onClick={() => removeTemplate(t.name)}
                        className="p-1 text-theme-secondary hover:text-error hover:bg-surface-hover rounded"
                        title="Remove template"
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => addTemplate(t.name)}
                        className="p-1.5 text-primary/70 hover:text-primary hover:bg-primary/20 rounded-md transition-colors"
                        title="Add template to query"
                      >
                        <Plus size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-theme-secondary">
                {searchTerm ? `No templates matching "${searchTerm}"` : 'No templates available'}
              </div>
            )}
          </div>

          {/* Active templates */}
          {activeTemplates && activeTemplates.length > 0 && (
            <div className="mt-4 border-t border-theme pt-4">
              <h3 className="text-theme-primary text-sm font-medium mb-2">
                Active Templates
              </h3>
              <div className="flex flex-wrap gap-2">
                {activeTemplates.map(templateName => (
                  <div
                    key={templateName}
                    className="bg-primary/20 text-primary px-2 py-1 rounded flex items-center gap-1"
                  >
                    <span className="text-xs">{templateName}</span>
                    <button
                      onClick={() => removeTemplate(templateName)}
                      className="text-primary hover:text-error"
                      title="Remove template"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TemplateSelector;