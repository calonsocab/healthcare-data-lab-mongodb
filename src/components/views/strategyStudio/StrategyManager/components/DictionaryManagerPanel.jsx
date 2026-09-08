// src/components/views/strategyStudio/DictionaryManagerPanel.jsx
"use client";

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Database,
  Copy,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Loader2,
  Info,
  ArrowRight,
  Server,
  Sparkles,
  AlertCircle
} from 'lucide-react';

/**
 * DictionaryManagerPanel
 *
 * Manages system dictionaries (_shortcuts, _codes) for persistence strategies.
 * Shows dictionary status and allows copying from core to tenant DB.
 *
 * Key behaviors:
 * - shortcuts: Must be copied from core before transformation (pre-computed from templates)
 * - arcodes: Generated at runtime if not present, but can be pre-seeded from core
 */
const DictionaryManagerPanel = ({ strategy, environment, onDictionariesUpdated }) => {
  const [dictionaries, setDictionaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [previewData, setPreviewData] = useState({});
  const [error, setError] = useState(null);
  const [tenantDatabase, setTenantDatabase] = useState(null);

  // Fetch dictionary status
  useEffect(() => {
    fetchDictionaries();
  }, [environment]);

  const fetchDictionaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dictionaries');
      if (res.ok) {
        const data = await res.json();
        setDictionaries(data.dictionaries || []);
        setTenantDatabase(data.tenantDatabase);
      } else {
        const err = await res.json();
        setError(err.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyDictionary = async (dictId) => {
    setCopying(dictId);
    try {
      const res = await fetch('/api/dictionaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy',
          dictionaryId: dictId
        })
      });

      if (res.ok) {
        const result = await res.json();
        // Refresh dictionary list
        await fetchDictionaries();
        onDictionariesUpdated?.();
      } else {
        const err = await res.json();
        setError(err.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCopying(null);
    }
  };

  const syncAllDictionaries = async () => {
    setCopying('all');
    try {
      const res = await fetch('/api/dictionaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' })
      });

      if (res.ok) {
        await fetchDictionaries();
        onDictionariesUpdated?.();
      } else {
        const err = await res.json();
        setError(err.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCopying(null);
    }
  };

  const previewDictionary = async (dictId) => {
    if (previewData[dictId]) {
      setExpanded(prev => ({ ...prev, [dictId]: !prev[dictId] }));
      return;
    }

    try {
      const res = await fetch('/api/dictionaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          dictionaryId: dictId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewData(prev => ({ ...prev, [dictId]: data }));
        setExpanded(prev => ({ ...prev, [dictId]: true }));
      }
    } catch (err) {
      console.error('Preview failed:', err);
    }
  };

  // Check which dictionaries are ENABLED in the strategy config
  // Dictionaries are only required if the user has enabled them
  const getDictionaryConfig = () => {
    const config = strategy?.config || {};
    const coding = config.coding || {};

    // Check if shortcuts are enabled (via coding config or blueprint dictionaries)
    const shortcutsEnabled =
      config.dictionaries?.shortcuts?.enabled ||
      strategy?.blueprint?.dictionaries?.shortcuts?.enabled_default ||
      false;

    // Check if arcodes are enabled
    const arcodesEnabled =
      coding.archetype_ids?.enabled ||
      coding.atcodes?.enabled ||
      config.dictionaries?.arcodes?.enabled ||
      strategy?.blueprint?.dictionaries?.arcodes?.enabled_default ||
      false;

    return {
      shortcuts: { enabled: shortcutsEnabled },
      arcodes: { enabled: arcodesEnabled }
    };
  };

  const dictConfig = getDictionaryConfig();

  // Get list of dictionaries that are enabled (not just available)
  const getEnabledDictionaries = () => {
    const enabled = [];
    if (dictConfig.shortcuts.enabled) enabled.push('shortcuts');
    if (dictConfig.arcodes.enabled) enabled.push('codes');
    return enabled;
  };

  const enabledDicts = getEnabledDictionaries();

  // Check if there are missing ENABLED dictionaries (that must be copied)
  const getMissingEnabledDictionaries = () => {
    return enabledDicts.filter(dictId => {
      const dict = dictionaries.find(d => d.id === dictId);
      // For shortcuts: must exist in tenant if enabled
      // For codes: can be generated at runtime, so not strictly "missing"
      if (dictId === 'shortcuts') {
        return dict && !dict.tenant?.exists;
      }
      return false; // codes are not blocking
    });
  };

  const missingEnabled = getMissingEnabledDictionaries();

  if (loading) {
    return (
      <div className="dark-banner bg-slate-800/60 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading dictionaries...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dark-banner bg-slate-800/60 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-900/40 rounded-lg">
            <BookOpen className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Dictionaries</h3>
            <p className="text-xs text-slate-400">
              Path shortcuts & archetype codes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDictionaries}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {tenantDatabase && dictionaries.some(d => d.tenant?.needsSync) && (
            <button
              onClick={syncAllDictionaries}
              disabled={copying === 'all'}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
            >
              {copying === 'all' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              Sync All
            </button>
          )}
        </div>
      </div>

      {/* Missing Enabled Dictionaries Warning */}
      {missingEnabled.length > 0 && tenantDatabase && (
        <div className="p-4 bg-red-900/20 border-b border-red-600/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">
                Enabled dictionaries missing from tenant database
              </p>
              <p className="text-xs text-red-400/80 mt-1">
                You have enabled dictionaries that are not yet copied to your tenant:
                {' '}<span className="font-mono">{missingEnabled.join(', ')}</span>
              </p>
              <button
                onClick={syncAllDictionaries}
                disabled={copying === 'all'}
                className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
              >
                {copying === 'all' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                Copy Enabled Dictionaries Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-900/20 border-b border-red-600/30">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <XCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {/* Target Info */}
      {tenantDatabase && (
        <div className="px-4 py-2 bg-slate-700/30 border-b border-slate-700">
          <div className="flex items-center gap-2 text-xs">
            <Server className="w-3 h-3 text-slate-500" />
            <span className="text-slate-400">Target:</span>
            <span className="text-emerald-400 font-mono">{tenantDatabase}</span>
          </div>
        </div>
      )}

      {/* No Tenant Warning */}
      {!tenantDatabase && (
        <div className="p-4 bg-amber-900/20 border-b border-amber-600/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">No tenant database selected</p>
              <p className="text-xs text-amber-400/80 mt-1">
                Select an environment to manage dictionaries for your tenant database.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dictionary List */}
      <div className="divide-y divide-slate-700">
        {dictionaries.map(dict => {
          const isEnabled = enabledDicts.includes(dict.id);
          const needsCopy = dict.tenant?.needsSync;
          const preview = previewData[dict.id];
          const isShortcuts = dict.id === 'shortcuts';
          const isCodes = dict.id === 'codes';

          return (
            <div key={dict.id} className={`p-4 ${isEnabled && needsCopy && isShortcuts ? 'bg-red-900/10' : ''}`}>
              {/* Dictionary Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    isShortcuts
                      ? 'bg-purple-900/40'
                      : 'bg-cyan-900/40'
                  }`}>
                    {isShortcuts ? (
                      <Database className="w-4 h-4 text-purple-400" />
                    ) : (
                      <BookOpen className="w-4 h-4 text-cyan-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{dict.name}</span>
                      {isEnabled && (
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded">
                          Enabled
                        </span>
                      )}
                      {dict.crossStrategy && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded">
                          Cross-strategy
                        </span>
                      )}
                      {dict.generatedAtRuntime && (
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Auto-generated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{dict.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => previewDictionary(dict.id)}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status Row */}
              <div className="flex items-center gap-4 mt-3">
                {/* Core Status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Core:</span>
                  {dict.core?.exists ? (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      <span className="text-xs">
                        {dict.core.stats?.totalPaths && `${dict.core.stats.totalPaths} paths`}
                        {dict.core.stats?.totalArchetypes && `${dict.core.stats.totalArchetypes} archetypes`}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-slate-400">
                      <XCircle className="w-3 h-3" />
                      <span className="text-xs">
                        {isCodes ? 'Will be generated' : 'Not found'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                {dict.tenant && (
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                )}

                {/* Tenant Status */}
                {dict.tenant && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Tenant:</span>
                    {dict.tenant.exists ? (
                      <div className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="w-3 h-3" />
                        <span className="text-xs">Synced</span>
                      </div>
                    ) : isCodes ? (
                      <div className="flex items-center gap-1 text-blue-400">
                        <Sparkles className="w-3 h-3" />
                        <span className="text-xs">Generated at runtime</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="text-xs">Not copied</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="ml-auto flex items-center gap-2">
                  {/* Copy from Core button */}
                  {dict.tenant && needsCopy && dict.core?.exists && (
                    <button
                      onClick={() => copyDictionary(dict.id)}
                      disabled={copying === dict.id}
                      className={`px-2 py-1 text-white rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                        isShortcuts && isEnabled
                          ? 'bg-red-600 hover:bg-red-500 disabled:bg-slate-600'
                          : 'bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600'
                      }`}
                    >
                      {copying === dict.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      Copy from Core
                    </button>
                  )}

                  {/* Pre-seed option for codes */}
                  {dict.tenant && isCodes && !dict.tenant.exists && dict.core?.exists && (
                    <button
                      onClick={() => copyDictionary(dict.id)}
                      disabled={copying === dict.id}
                      className="px-2 py-1 bg-primary hover:bg-primary-hover disabled:bg-slate-600 text-primary-text rounded text-xs font-medium transition-colors flex items-center gap-1"
                      title="Pre-seed arcodes from core for consistency"
                    >
                      {copying === dict.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      Pre-seed (optional)
                    </button>
                  )}
                </div>
              </div>

              {/* Info message for codes */}
              {isCodes && isEnabled && !dict.tenant?.exists && (
                <div className="mt-3 p-2 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300">
                      Archetype codes will be automatically generated during transformation if not present.
                      {dict.core?.exists && (
                        <> You can optionally pre-seed from core for consistent encoding across environments.</>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Warning for missing shortcuts */}
              {isShortcuts && isEnabled && !dict.tenant?.exists && dict.core?.exists && (
                <div className="mt-3 p-2 bg-red-900/20 border border-red-700/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">
                      <strong>Action required:</strong> Shortcuts must be copied before running transformations.
                      This dictionary is pre-computed from templates and cannot be generated at runtime.
                    </p>
                  </div>
                </div>
              )}

              {/* Preview Section */}
              {expanded[dict.id] && preview && (
                <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">
                      Preview ({preview.stats?.totalPaths || preview.stats?.totalArchetypes || 0} entries)
                    </span>
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [dict.id]: false }))}
                      className="text-slate-400 hover:text-white"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                  <pre className="text-xs text-slate-300 font-mono overflow-auto max-h-48">
                    {JSON.stringify(preview.preview, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="p-3 bg-slate-700/20 border-t border-slate-700">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-slate-500">
            <p>
              <strong className="text-slate-400">Shortcuts</strong>: Must be copied from core before transformation (pre-computed from templates).
            </p>
            <p className="mt-1">
              <strong className="text-slate-400">Arcodes</strong>: Generated automatically at runtime, but can be pre-seeded for consistency.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DictionaryManagerPanel;
