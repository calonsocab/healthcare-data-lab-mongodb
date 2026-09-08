// src/components/views/deployStrategies/CatalogBrowser.jsx
"use client";

import React, { useState, useMemo } from 'react';
import { Search, Filter, Loader2, Package, ChevronDown } from 'lucide-react';
import StrategyCard from './StrategyCard';

/**
 * CatalogBrowser - Browse and filter Kehrnel strategy catalog
 */
const CatalogBrowser = ({ strategies, activeEnvironment, loading, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [maturityFilter, setMaturityFilter] = useState('all');

  // Extract unique domains and maturity levels
  const domains = useMemo(() => {
    const set = new Set(strategies.map(s => s.domain).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [strategies]);

  const maturityLevels = useMemo(() => {
    const set = new Set(strategies.map(s => s.maturity || 'unknown').filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [strategies]);

  // Filter strategies
  const filteredStrategies = useMemo(() => {
    return strategies.filter(s => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesName = s.name?.toLowerCase().includes(search);
        const matchesId = s.id?.toLowerCase().includes(search);
        const matchesDescription = s.summary?.toLowerCase().includes(search) ||
                                   s.description?.toLowerCase().includes(search);
        const matchesTags = s.ui?.tags?.some(t => t.toLowerCase().includes(search));
        if (!matchesName && !matchesId && !matchesDescription && !matchesTags) {
          return false;
        }
      }

      // Domain filter
      if (domainFilter !== 'all' && s.domain !== domainFilter) {
        return false;
      }

      // Maturity filter
      if (maturityFilter !== 'all') {
        const strategyMaturity = s.maturity || 'unknown';
        if (strategyMaturity !== maturityFilter) {
          return false;
        }
      }

      return true;
    });
  }, [strategies, searchTerm, domainFilter, maturityFilter]);

  // Check if a strategy is active on the current environment
  const isActiveOnEnv = (strategy) => {
    if (!activeEnvironment?.strategyLinks) return false;
    return activeEnvironment.strategyLinks.some(
      link => link.strategyId === strategy.id || link.kehrnel?.strategyId === strategy.id
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin mr-3" />
        <span className="text-slate-400">Loading strategy catalog...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search strategies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Domain Filter */}
        <div className="relative">
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="appearance-none pl-3 pr-10 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            {domains.map(domain => (
              <option key={domain} value={domain}>
                {domain === 'all' ? 'All Domains' : domain}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Maturity Filter */}
        <div className="relative">
          <select
            value={maturityFilter}
            onChange={(e) => setMaturityFilter(e.target.value)}
            className="appearance-none pl-3 pr-10 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            {maturityLevels.map(level => (
              <option key={level} value={level}>
                {level === 'all' ? 'All Maturity' : level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Results count */}
        <span className="text-sm text-slate-500">
          {filteredStrategies.length} of {strategies.length} strategies
        </span>
      </div>

      {/* Strategy Grid */}
      {filteredStrategies.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/40 rounded-xl border border-slate-700">
          <Package className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No strategies found</h3>
          <p className="text-sm text-slate-500">
            {strategies.length === 0
              ? 'No strategies available in the Kehrnel catalog.'
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStrategies.map(strategy => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              isActive={isActiveOnEnv(strategy)}
              onClick={() => onSelect(strategy)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CatalogBrowser;
