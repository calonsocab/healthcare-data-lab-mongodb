// src/components/views/strategyStudio/StrategyManager/components/DatabaseOverview.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { Database, FileText, RefreshCw, AlertTriangle, Server, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * DatabaseOverview component displays statistics about the collections
 * defined in the active strategy for the current environment.
 *
 * @param {string} domain - The domain to fetch stats for
 * @param {boolean} compact - If true, render as a single row instead of full card
 * @param {boolean} inline - If true, render inline within another component (simpler layout)
 */
const DatabaseOverview = ({ domain = 'openEHR', compact = false, inline = false }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const readJsonSafely = async (response, fallbackMessage) => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    const text = await response.text().catch(() => '');
    const looksLikeHtml = /<!doctype html/i.test(text) || /<html/i.test(text);
    if (looksLikeHtml) {
      throw new Error(`${fallbackMessage} The server returned HTML instead of JSON.`);
    }

    throw new Error(text?.trim() || fallbackMessage);
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/database-stats?domain=${domain}`);

      if (!response.ok) {
        const errorData = await readJsonSafely(response, 'Failed to fetch database stats.');
        throw new Error(errorData.error || 'Failed to fetch database stats');
      }

      const data = await readJsonSafely(response, 'Failed to read database stats.');
      setStats(data);
    } catch (err) {
      console.error('Error fetching database stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [domain]);

  // Format bytes to human-readable size
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format large numbers with comma separators
  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toLocaleString();
  };

  // Compact view for row layout
  if (compact) {
    if (loading) {
      return (
        <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-slate-800/40">
          <RefreshCw size={16} className="text-primary animate-spin" />
          <span className="text-text-secondary text-sm">Loading stats...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-4 p-3 rounded-lg border border-amber-700/40 bg-amber-900/10">
          <AlertTriangle size={16} className="text-amber-400" />
          <span className="text-amber-300 text-sm flex-1">{error}</span>
          <button onClick={fetchStats} className="text-xs text-amber-400 hover:text-amber-300">
            Retry
          </button>
        </div>
      );
    }

    if (!stats || !stats.strategy) {
      return (
        <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-slate-800/40">
          <Database size={16} className="text-slate-500" />
          <span className="text-text-secondary text-sm">No strategy linked for {domain}</span>
        </div>
      );
    }

    const totals = stats.totals || { documents: 0, collections: 0, storageSize: 0 };
    const collectionNames = Object.values(stats.collections || {}).map(c => c.name).join(', ');

    return (
      <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-slate-800/40">
        <Database size={16} className="text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text">{domain}</span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400 truncate">{collectionNames || 'No collections'}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm flex-shrink-0">
          <div className="text-right">
            <span className="font-medium text-text">{formatNumber(totals.documents)}</span>
            <span className="text-xs text-slate-500 ml-1">docs</span>
          </div>
          <div className="text-right">
            <span className="font-medium text-text">{totals.collections}</span>
            <span className="text-xs text-slate-500 ml-1">collections</span>
          </div>
          <div className="text-right">
            <span className="font-medium text-text">{formatBytes(totals.storageSize)}</span>
          </div>
          <button
            onClick={fetchStats}
            className="p-1.5 text-slate-500 hover:text-slate-300 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Inline view - simpler layout for embedding in cards
  if (inline) {
    if (loading) {
      return (
        <div className="flex items-center gap-3 py-3">
          <RefreshCw size={16} className="text-primary animate-spin" />
          <span className="text-slate-400 text-sm">Loading collections...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-3 py-3 text-amber-400">
          <AlertTriangle size={16} />
          <span className="text-sm">{error}</span>
          <button onClick={fetchStats} className="text-xs underline hover:text-amber-300">Retry</button>
        </div>
      );
    }

    if (!stats || !stats.strategy) {
      return (
        <div className="py-3 text-slate-500 text-sm">
          No collections data available
        </div>
      );
    }

    const totals = stats.totals || { documents: 0, collections: 0, storageSize: 0 };
    const collections = stats.collections || {};

    return (
      <div className="space-y-4">
        {/* Summary Stats - horizontal row */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{formatNumber(totals.documents)}</span>
            <span className="text-sm text-slate-500">documents</span>
          </div>
          <div className="w-px h-6 bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{totals.collections}</span>
            <span className="text-sm text-slate-500">collections</span>
          </div>
          <div className="w-px h-6 bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{formatBytes(totals.storageSize)}</span>
            <span className="text-sm text-slate-500">storage</span>
          </div>
          <button
            onClick={fetchStats}
            className="ml-auto p-1.5 text-slate-500 hover:text-slate-300 rounded transition-colors"
            title="Refresh statistics"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Collections List - simple table */}
        <div className="space-y-2">
          {Object.entries(collections).map(([key, collection]) => (
            <div
              key={key}
              className={cn(
                "flex items-center justify-between py-2 px-3 rounded-lg",
                collection.exists
                  ? "bg-slate-800/50"
                  : "bg-slate-800/20"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  collection.exists ? "bg-emerald-500" : "bg-slate-600"
                )} />
                <span className={collection.exists ? "text-white" : "text-slate-500"}>
                  {collection.name}
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                {collection.exists ? (
                  <>
                    <span className="text-slate-400">
                      <span className="text-white font-medium">{formatNumber(collection.documentCount)}</span> docs
                    </span>
                    {collection.storageSize > 0 && (
                      <span className="text-slate-400">
                        <span className="text-white font-medium">{formatBytes(collection.storageSize)}</span>
                      </span>
                    )}
                    {collection.indexes > 0 && (
                      <span className="text-slate-400">
                        <span className="text-white font-medium">{collection.indexes}</span> indexes
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-amber-500/80 bg-amber-900/20 px-2 py-0.5 rounded">
                    Not created
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full card view (default)
  if (loading) {
    return (
      <div className="bg-surface rounded-lg border border-border p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={24} className="text-primary animate-spin mr-3" />
          <span className="text-text-secondary">Loading database statistics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-lg border border-border p-6">
        <div className="flex items-center text-amber-400 mb-4">
          <AlertTriangle size={20} className="mr-2" />
          <span className="font-medium">Unable to load database statistics</span>
        </div>
        <p className="text-text-secondary text-sm mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-surface-alt text-text-secondary rounded-md hover:bg-surface-alt/80 text-sm flex items-center"
        >
          <RefreshCw size={14} className="mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (!stats || !stats.strategy) {
    return (
      <div className="bg-surface rounded-lg border border-border p-6">
        <div className="flex items-center text-text-secondary mb-2">
          <Database size={20} className="mr-2" />
          <span className="font-medium">No Strategy Linked</span>
        </div>
        <p className="text-text-secondary text-sm">
          Link a persistence strategy to this environment to view database statistics.
        </p>
      </div>
    );
  }

  const collections = stats.collections || {};
  const totals = stats.totals || { documents: 0, collections: 0, storageSize: 0 };

  return (
    <div className="bg-surface rounded-lg border border-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Database size={20} className="text-primary mr-2" />
          <h3 className="text-lg font-medium text-text">Database Overview</h3>
        </div>
        <button
          onClick={fetchStats}
          className="p-2 text-text-secondary hover:text-text rounded-md hover:bg-surface-alt transition-colors"
          title="Refresh statistics"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Environment & Strategy Info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-surface-alt rounded-lg p-4">
          <div className="flex items-center text-text-secondary text-sm mb-1">
            <Server size={14} className="mr-1" />
            Environment
          </div>
          <p className="text-text font-medium">{stats.environment?.name || 'Unknown'}</p>
          <p className="text-text-secondary text-xs mt-1">{stats.environment?.database || 'N/A'}</p>
        </div>
        <div className="bg-surface-alt rounded-lg p-4">
          <div className="flex items-center text-text-secondary text-sm mb-1">
            <Layers size={14} className="mr-1" />
            Strategy
          </div>
          <p className="text-text font-medium">{stats.strategy?.name || 'Unknown'}</p>
          {stats.strategy?.domain && (
            <p className="text-text-secondary text-xs mt-1">
              {Array.isArray(stats.strategy.domain) ? stats.strategy.domain.join(', ') : stats.strategy.domain}
            </p>
          )}
        </div>
      </div>

      {/* Totals Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
          <div className="text-text-secondary text-sm mb-1">Total Documents</div>
          <div className="text-2xl font-bold text-text">{formatNumber(totals.documents)}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-4 border border-blue-500/20">
          <div className="text-text-secondary text-sm mb-1">Collections</div>
          <div className="text-2xl font-bold text-text">{formatNumber(totals.collections)}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg p-4 border border-purple-500/20">
          <div className="text-text-secondary text-sm mb-1">Storage Size</div>
          <div className="text-2xl font-bold text-text">{formatBytes(totals.storageSize)}</div>
        </div>
      </div>

      {/* Collections Detail */}
      <div>
        <h4 className="text-sm font-medium text-text-secondary mb-3 flex items-center">
          <FileText size={14} className="mr-2" />
          Collection Details
        </h4>

        <div className="space-y-2">
          {Object.entries(collections).map(([key, collection]) => (
            <div
              key={key}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                collection.exists
                  ? "bg-surface-alt border-border hover:border-primary/30"
                  : "bg-surface-alt/50 border-border/50"
              )}
            >
              <div className="flex items-center">
                <div className={cn(
                  "w-2 h-2 rounded-full mr-3",
                  collection.exists ? "bg-primary" : "bg-slate-500"
                )} />
                <div>
                  <p className={cn(
                    "font-medium",
                    collection.exists ? "text-text" : "text-text-secondary"
                  )}>
                    {collection.name}
                  </p>
                  <p className="text-xs text-text-secondary capitalize">
                    {key.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div>
                  <p className={cn(
                    "font-medium",
                    collection.documentCount > 0 ? "text-text" : "text-text-secondary"
                  )}>
                    {formatNumber(collection.documentCount)}
                  </p>
                  <p className="text-xs text-text-secondary">documents</p>
                </div>

                {collection.exists && collection.storageSize > 0 && (
                  <div>
                    <p className="font-medium text-text">
                      {formatBytes(collection.storageSize)}
                    </p>
                    <p className="text-xs text-text-secondary">size</p>
                  </div>
                )}

                {collection.exists && collection.indexes > 0 && (
                  <div>
                    <p className="font-medium text-text">
                      {collection.indexes}
                    </p>
                    <p className="text-xs text-text-secondary">indexes</p>
                  </div>
                )}

                {!collection.exists && (
                  <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                    Not created
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-text-secondary text-right">
          Last updated: {new Date(stats.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default DatabaseOverview;
