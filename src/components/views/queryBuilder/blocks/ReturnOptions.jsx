// src/components/views/queryBuilder/blocks/ReturnOptions.jsx
"use client";

import React from 'react';
import PropTypes from 'prop-types';
import { ArrowDownUp, Filter, Info } from 'lucide-react';
import CollapsibleSection from '../../../common/CollapsibleSection';
import { useQueryBuilderContext } from '@/providers/QueryBuilderProvider';

const ReturnOptions = ({ isExpanded, onToggleExpand }) => {
  const {
    queryState,
    updateLimit,
    updateOffset
  } = useQueryBuilderContext();

  // Extract values from queryState with defaults
  const limit = queryState.limit || "";
  const offset = queryState.offset || "";

  return (
    <CollapsibleSection
      title="Return Options"
      isExpanded={isExpanded}
      onToggle={onToggleExpand}
    >
      <div className="space-y-6">
        <div className="bg-primary/10 border border-primary/30 rounded-md p-3 text-sm text-primary flex items-start gap-2">
          <Info size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p>Return options allow you to control how many results are returned and how they are ordered.</p>
            <p className="mt-1">Use <span className="font-mono">LIMIT</span> to restrict the number of results and <span className="font-mono">OFFSET</span> for pagination.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* LIMIT */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-theme-primary flex items-center gap-1.5">
              <Filter size={14} className="text-theme-secondary" />
              <span>LIMIT</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                value={limit}
                onChange={(e) => updateLimit(e.target.value)}
                placeholder="Number of results"
                className="w-full px-3 py-2 bg-surface-hover text-theme-primary rounded-md 
                  border border-theme focus:border-primary focus:outline-none"
              />
              <div className="absolute right-3 top-2 text-sm text-theme-secondary">
                results
              </div>
            </div>
            <p className="text-xs text-theme-secondary">
              Maximum number of results to return
            </p>
          </div>

          {/* OFFSET */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-theme-primary flex items-center gap-1.5">
              <ArrowDownUp size={14} className="text-theme-secondary" />
              <span>OFFSET</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={offset}
                onChange={(e) => updateOffset(e.target.value)}
                placeholder="Skip results"
                className="w-full px-3 py-2 bg-surface-hover text-theme-primary rounded-md 
                  border border-theme focus:border-primary focus:outline-none"
              />
              <div className="absolute right-3 top-2 text-sm text-theme-secondary">
                rows
              </div>
            </div>
            <p className="text-xs text-theme-secondary">
              Number of initial results to skip (for pagination)
            </p>
          </div>
        </div>

        {/* Example explanation */}
        <div className="text-sm text-theme-secondary mt-4 space-y-2">
          <h4 className="font-medium text-theme-primary">Usage Examples:</h4>
          <p>
            <span className="font-mono text-xs bg-surface-hover px-1.5 py-0.5 rounded">LIMIT 10</span> - Return only the first 10 results
          </p>
          <p>
            <span className="font-mono text-xs bg-surface-hover px-1.5 py-0.5 rounded">LIMIT 10 OFFSET 10</span> - Return results 11-20 (second page)
          </p>
          <p>
            <span className="font-mono text-xs bg-surface-hover px-1.5 py-0.5 rounded">LIMIT 10 OFFSET 20</span> - Return results 21-30 (third page)
          </p>
        </div>

        <div className="bg-surface p-4 rounded-lg">
          <h4 className="text-sm font-medium text-theme-primary mb-2">AQL Return Options Guide</h4>
          <div className="text-xs text-theme-secondary space-y-2">
            <p>LIMIT and OFFSET are used to restrict and paginate the result set.</p>
            <p><span className="text-primary">LIMIT row_count</span> - Limits the number of returned rows</p>
            <p><span className="text-primary">OFFSET offset</span> - Skips the specified number of initial rows</p>
            <p className="text-warning">Note: Using LIMIT/OFFSET requires ORDER BY for consistent results</p>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};

ReturnOptions.propTypes = {
  isExpanded: PropTypes.bool.isRequired,
  onToggleExpand: PropTypes.func.isRequired
};

export default ReturnOptions;