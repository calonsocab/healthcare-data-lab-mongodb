// src/components/views/settings/StrategyManager/components/StrategyFilters.jsx
"use client";

import React from 'react';
import { Search, X } from 'lucide-react';
import { getDomainCounts } from '../constants/domainThemes';

const StrategyFilters = ({
  filter,
  options,
  onChange,
  strategies = [],
  searchTerm = '',
  onSearchChange,
  domainFilter = null,
  onDomainFilterChange
}) => {
  // Get domain counts from strategies
  const domainCounts = getDomainCounts(strategies);

  // Check if any filters are active
  const hasActiveFilters = searchTerm || domainFilter;

  const clearAllFilters = () => {
    onSearchChange?.('');
    onDomainFilterChange?.(null);
  };

  return (
    <div className="space-y-4">
      {/* Search Row */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search strategies..."
            className="w-full pl-10 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange?.('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Domain Filter Pills - text-only for branding consistency */}
      {domainCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-theme overflow-hidden w-fit">
            {/* All domains button */}
            <button
              onClick={() => onDomainFilterChange?.(null)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-r border-theme ${
                domainFilter === null
                  ? 'bg-primary text-primary-text'
                  : 'surface hover:surface-hover text-theme-primary'
              }`}
            >
              All Domains
            </button>

            {/* Domain-specific buttons */}
            {domainCounts.map(({ domain, displayName, count }) => (
              <button
                key={domain}
                onClick={() => onDomainFilterChange?.(domainFilter === domain ? null : domain)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-r border-theme last:border-r-0 ${
                  domainFilter === domain
                    ? 'bg-primary text-primary-text'
                    : 'surface hover:surface-hover text-theme-primary'
                }`}
              >
                <span>{displayName}</span>
                <span className={`text-xs rounded-full px-1.5 min-w-[20px] text-center ${
                  domainFilter === domain
                    ? 'bg-primary-hover'
                    : 'bg-surface-hover'
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
          <span className="text-xs text-slate-500">Active filters:</span>

          {searchTerm && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-900/30 border border-blue-700/40 rounded-md text-xs text-blue-300">
              Search: &quot;{searchTerm}&quot;
              <button
                onClick={() => onSearchChange?.('')}
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {domainFilter && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-purple-900/30 border border-purple-700/40 rounded-md text-xs text-purple-300">
              Domain: {domainFilter}
              <button
                onClick={() => onDomainFilterChange?.(null)}
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            onClick={clearAllFilters}
            className="text-xs text-slate-400 hover:text-slate-200 underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default StrategyFilters;
