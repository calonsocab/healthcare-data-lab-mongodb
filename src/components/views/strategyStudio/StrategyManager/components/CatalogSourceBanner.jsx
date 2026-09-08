// src/components/views/strategyStudio/StrategyManager/components/CatalogSourceBanner.jsx
"use client";

import React, { useState } from 'react';
import { Server, Database, RefreshCw, CheckCircle, AlertTriangle, Clock, Wifi, WifiOff } from 'lucide-react';

/**
 * HDL-KHR-016: Source of truth banner
 * HDL-KHR-020: Catalog stats + empty/stale warning
 * Shows: selected env → Kehrnel instance → catalog source + health + stats
 * Provides: refresh action to sync activation metadata from Kehrnel
 */
const CatalogSourceBanner = ({
  activeEnv,
  catalogSource,
  strategies = [],
  onRefreshCatalog,
  onRefreshActivation,
  loading = false,
  refreshingActivation = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Calculate catalog stats
  const strategyCount = strategies.length;
  const domains = [...new Set(strategies.map(s => s.domain).filter(Boolean))];
  const domainCount = domains.length;

  // Determine health status based on catalog source and content
  const getHealthStatus = () => {
    if (loading) return { status: 'loading', label: 'Loading...', color: 'text-slate-400', warning: null };
    if (!catalogSource?.source) return { status: 'unknown', label: 'Unknown', color: 'text-slate-500', warning: null };
    if (catalogSource.error) return { status: 'error', label: 'Error', color: 'text-red-400', warning: catalogSource.error };

    // Check for suspicious conditions
    if (strategyCount === 0) {
      return { status: 'warning', label: 'Empty Catalog', color: 'text-amber-400', warning: 'No strategies returned from Kehrnel' };
    }

    return { status: 'healthy', label: 'Connected', color: 'text-emerald-400', warning: null };
  };

  const health = getHealthStatus();
  const instanceName = activeEnv?.kehrnel?.instanceName || catalogSource?.source || 'Default';
  const lastFetched = catalogSource?.fetchedAt ? new Date(catalogSource.fetchedAt) : null;

  // Format relative time
  const formatRelativeTime = (date) => {
    if (!date) return 'never';
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-slate-800/40 backdrop-blur border border-slate-700/50 rounded-lg overflow-hidden">
      {/* Main banner row */}
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Source info */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Environment */}
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Environment</p>
              <p className="text-sm font-medium text-white truncate">
                {activeEnv?.name || 'None selected'}
              </p>
            </div>
          </div>

          {/* Separator */}
          <div className="w-px h-8 bg-slate-700 flex-shrink-0" />

          {/* Kehrnel Instance */}
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Kehrnel Instance</p>
              <p className="text-sm font-medium text-white truncate">{instanceName}</p>
            </div>
          </div>

          {/* Separator */}
          <div className="w-px h-8 bg-slate-700 flex-shrink-0" />

          {/* Health status */}
          <div className="flex items-center gap-2">
            {health.status === 'loading' ? (
              <RefreshCw className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
            ) : health.status === 'healthy' ? (
              <Wifi className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : health.status === 'error' ? (
              <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Catalog Status</p>
              <p className={`text-sm font-medium ${health.color}`}>{health.label}</p>
            </div>
          </div>

          {/* HDL-KHR-020: Catalog Stats */}
          {!loading && strategyCount > 0 && (
            <>
              <div className="w-px h-8 bg-slate-700 flex-shrink-0" />
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">{strategyCount}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Strategies</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">{domainCount}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Domains</p>
                </div>
              </div>
            </>
          )}

          {/* Last updated */}
          {lastFetched && (
            <>
              <div className="w-px h-8 bg-slate-700 flex-shrink-0" />
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Last Refresh</p>
                  <p className="text-sm text-slate-300">{formatRelativeTime(lastFetched)}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Refresh Catalog */}
          <button
            onClick={onRefreshCatalog}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh catalog from Kehrnel"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Catalog
          </button>

          {/* HDL-KHR-017: Refresh Activation from Kehrnel */}
          {activeEnv && (
            <button
              onClick={onRefreshActivation}
              disabled={refreshingActivation || !activeEnv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-600/40 text-emerald-300 rounded-lg transition-colors disabled:opacity-50"
              title="Sync activation metadata from Kehrnel"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingActivation ? 'animate-spin' : ''}`} />
              Sync Activation
            </button>
          )}

          {/* Toggle details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            title={showDetails ? 'Hide details' : 'Show details'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable details section */}
      {showDetails && (
        <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-900/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Environment Details */}
            <div>
              <p className="text-slate-500 mb-1">Environment ID</p>
              <p className="text-slate-300 font-mono">{activeEnv?.id || 'N/A'}</p>
            </div>

            {/* Connection ID */}
            <div>
              <p className="text-slate-500 mb-1">Connection ID</p>
              <p className="text-slate-300 font-mono truncate" title={catalogSource?.connectionId}>
                {catalogSource?.connectionId || activeEnv?.kehrnel?.connectionId || 'default'}
              </p>
            </div>

            {/* Catalog Source */}
            <div>
              <p className="text-slate-500 mb-1">Catalog Source</p>
              <p className="text-slate-300">{catalogSource?.source || 'N/A'}</p>
            </div>

            {/* Active Domain Links */}
            <div>
              <p className="text-slate-500 mb-1">Active Domain Links</p>
              <p className="text-slate-300">
                {activeEnv?.strategyLinks?.length || 0} domains
              </p>
            </div>

            {/* Strategy Links details */}
            {activeEnv?.strategyLinks?.length > 0 && (
              <div className="col-span-2 md:col-span-4">
                <p className="text-slate-500 mb-2">Domain Activations</p>
                <div className="flex flex-wrap gap-2">
                  {activeEnv.strategyLinks.map((link, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs"
                    >
                      <span className="text-emerald-400">{link.domain}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-slate-300 font-mono">
                        {link.kehrnel?.strategyId || link.strategyId || 'unknown'}
                      </span>
                      {link.kehrnel?.activationId && (
                        <span className="text-slate-500" title={link.kehrnel.activationId}>
                          ({link.kehrnel.activationId.slice(0, 6)}…)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HDL-KHR-020: Domain breakdown */}
            {domains.length > 0 && (
              <div className="col-span-2 md:col-span-4 mt-2">
                <p className="text-slate-500 mb-2">Available Domains</p>
                <div className="flex flex-wrap gap-2">
                  {domains.map((domain) => {
                    const count = strategies.filter(s => s.domain === domain).length;
                    return (
                      <span
                        key={domain}
                        className="px-2 py-1 bg-slate-800/80 border border-slate-700 rounded text-xs text-slate-300"
                      >
                        {domain} <span className="text-slate-500">({count})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HDL-KHR-020: Warning Banner */}
      {health.warning && (
        <div className="px-4 py-2 border-t border-amber-700/50 bg-amber-900/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">{health.warning}</p>
          <button
            onClick={onRefreshCatalog}
            className="ml-auto px-2 py-1 text-xs font-medium bg-amber-800/50 hover:bg-amber-800 text-amber-200 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default CatalogSourceBanner;
