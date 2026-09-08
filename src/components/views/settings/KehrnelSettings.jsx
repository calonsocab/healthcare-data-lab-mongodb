// src/components/views/settings/KehrnelSettings.jsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Play,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Terminal,
  Activity,
  List,
  Zap
} from 'lucide-react';
import { getPublicKehrnelBaseUrl } from '@/lib/kehrnel/url';

const KehrnelSettings = ({ onConfigChange }) => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [newInstance, setNewInstance] = useState({
    name: '',
    apiUrl: '',
    apiKey: '',
    isDefault: false
  });
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);

  // Get the selected instance or default
  const selectedInstance = useMemo(() => {
    if (selectedInstanceId) {
      return instances.find(i => i._id === selectedInstanceId);
    }
    return instances.find(i => i.isDefault) || instances[0];
  }, [instances, selectedInstanceId]);

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/kehrnel/instances');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load instances');
      }
      const data = await res.json();
      setInstances(data.instances || []);
    } catch (err) {
      console.error('Failed to load Kehrnel instances:', err);
      setError(err.message || 'Failed to load instances');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInstance = async () => {
    if (!newInstance.apiUrl) {
      setError('API URL is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/kehrnel/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newInstance.name || 'Kehrnel Instance',
          url: newInstance.apiUrl,
          apiKey: newInstance.apiKey || undefined,
          isDefault: newInstance.isDefault
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save instance');
      }

      await loadInstances();
      setShowAddForm(false);
      setNewInstance({
        name: '',
        apiUrl: '',
        apiKey: '',
        isDefault: false
      });
      onConfigChange?.();
    } catch (err) {
      setError(err.message || 'Failed to save instance');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInstance = async (instance) => {
    if (!confirm('Delete this Kehrnel instance?')) return;
    try {
      const res = await fetch(`/api/kehrnel/instances?id=${encodeURIComponent(instance._id || instance.url)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete instance');
      }
      await loadInstances();
      onConfigChange?.();
    } catch (err) {
      setError(err.message || 'Failed to delete instance');
    }
  };

  const handleSetDefault = async (instance) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/kehrnel/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: instance.url,
          name: instance.name,
          isDefault: true
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update default');
      }
      await loadInstances();
      onConfigChange?.();
    } catch (err) {
      setError(err.message || 'Failed to update default');
    } finally {
      setSaving(false);
    }
  };

  const renderHealth = (health) => {
    if (!health) {
      return (
        <div className="text-xs text-theme-secondary">
          <span className="inline-block w-2 h-2 rounded-full bg-theme-secondary/60 mr-2" />
          Health pending
        </div>
      );
    }

    if (health.status === 'healthy') {
      return (
        <div className="flex items-center gap-2 text-xs text-success">
          <span className="inline-block w-2 h-2 rounded-full bg-success" />
          Healthy {health.version ? `• v${health.version}` : ''}
        </div>
      );
    }

    if (health.status === 'unhealthy') {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
          Unhealthy {health.statusCode ? `(HTTP ${health.statusCode})` : ''}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-xs text-error">
        <span className="inline-block w-2 h-2 rounded-full bg-error" />
        {health.error || 'Connection error'}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-theme-secondary">Loading Kehrnel instances...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary mb-2">Kehrnel Instances</h1>
          <p className="text-theme-secondary">
            Manage HTTP connections to Kehrnel. Strategies resolve the active instance automatically.
          </p>
        </div>
        <button
          onClick={loadInstances}
          className="px-3 py-2 text-sm border border-theme rounded-lg text-theme-secondary hover:text-primary hover:border-primary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-surface rounded-lg p-6 border border-theme">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-theme-primary">Registered Instances</h2>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-primary text-primary-text rounded-lg hover:opacity-90 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Instance
            </button>
          </div>

          <div className="space-y-4">
            {instances.map((instance) => (
              <div key={instance._id || instance.url} className="p-4 bg-surface-hover/50 rounded-lg border border-theme">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-surface rounded-lg">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-theme-primary">{instance.name}</span>
                          {instance.isDefault && (
                            <span className="px-2 py-0.5 bg-success/20 text-success text-xs rounded-full font-medium">
                              Default
                            </span>
                          )}
                          {instance.hasApiKey && (
                            <span className="px-2 py-0.5 bg-theme/40 text-theme-secondary text-[10px] rounded-full font-medium">
                              API key
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-theme-secondary font-mono truncate">
                          {instance.url}
                        </div>
                        <div className="mt-2">
                          {renderHealth(instance.health)}
                        </div>
                        {instance.discoveredStrategies?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {instance.discoveredStrategies.slice(0, 4).map(id => (
                              <span key={id} className="px-2 py-0.5 bg-surface border border-theme rounded text-[11px] text-theme-secondary">
                                {id}
                              </span>
                            ))}
                            {instance.discoveredStrategies.length > 4 && (
                              <span className="text-[11px] text-theme-secondary">
                                +{instance.discoveredStrategies.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!instance.isDefault && (
                      <button
                        onClick={() => handleSetDefault(instance)}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs rounded-lg bg-success/10 text-success hover:bg-success/20 disabled:opacity-50"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteInstance(instance)}
                      className="p-2 text-theme-secondary hover:text-error transition-colors"
                      title="Delete instance"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {instances.length === 0 && (
              <div className="text-center py-8 text-theme-muted">
                No Kehrnel instances yet. Add one to get started.
              </div>
            )}
          </div>
        </div>

        {showAddForm && (
          <div className="bg-surface rounded-lg p-6 border border-primary/50">
            <h3 className="text-lg font-semibold text-white mb-4">Add Kehrnel Instance</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1">Name</label>
                  <input
                    type="text"
                    value={newInstance.name}
                    onChange={(e) => setNewInstance(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Production Kehrnel"
                    className="w-full px-3 py-2 bg-surface-hover border border-theme rounded-lg text-white placeholder-theme-muted focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={newInstance.isDefault}
                    onChange={(e) => setNewInstance(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <label htmlFor="isDefault" className="text-sm text-theme-secondary">Set as default</label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">API URL *</label>
                <input
                  type="text"
                  value={newInstance.apiUrl}
                  onChange={(e) => setNewInstance(prev => ({ ...prev, apiUrl: e.target.value }))}
                  placeholder="https://api.kehrnel.example.com"
                  className="w-full px-3 py-2 bg-surface-hover border border-theme rounded-lg text-white placeholder-theme-muted focus:border-primary focus:outline-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">API Key (optional)</label>
                <input
                  type="password"
                  value={newInstance.apiKey}
                  onChange={(e) => setNewInstance(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Paste API key if required"
                  className="w-full px-3 py-2 bg-surface-hover border border-theme rounded-lg text-white placeholder-theme-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewInstance({ name: '', apiUrl: '', apiKey: '', isDefault: false });
                  }}
                  className="px-4 py-2 bg-surface-hover text-theme-secondary rounded-lg hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddInstance}
                  disabled={!newInstance.apiUrl || saving}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Instance
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instance API Explorer */}
        {instances.length > 0 && (
          <div className="bg-surface rounded-lg p-6 border border-theme">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold text-theme-primary">Instance API Explorer</h2>
                <p className="text-sm text-theme-secondary">Test system-level Kehrnel endpoints</p>
              </div>
              {instances.length > 1 && (
                <select
                  value={selectedInstanceId || ''}
                  onChange={(e) => setSelectedInstanceId(e.target.value || null)}
                  className="px-3 py-2 bg-surface-hover border border-theme rounded-lg text-theme-primary text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">Default Instance</option>
                  {instances.map(inst => (
                    <option key={inst._id} value={inst._id}>
                      {inst.name}{inst.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedInstance && (
              <InstanceAPIExplorer instance={selectedInstance} />
            )}
          </div>
        )}

        <div className="bg-surface/50 rounded-lg p-6 border border-theme">
          <h3 className="text-lg font-semibold text-theme-primary mb-3">How Kehrnel is used</h3>
          <div className="space-y-3 text-sm text-theme-secondary">
            <p>
              HDL never imports Kehrnel code directly. All integrations use HTTP requests to the selected Kehrnel instance.
              Instances marked as <span className="text-success font-medium">Default</span> are used automatically when activating strategies.
            </p>
            <div className="flex items-start gap-2 text-xs text-theme-secondary">
              <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
              <span>Activation endpoint: <code className="font-mono text-primary">POST /strategies/activate</code>. Errors follow the <code className="font-mono text-primary">{'{error:{code,message,details}}'}</code> envelope.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * InstanceAPIExplorer - Test system-level Kehrnel endpoints
 *
 * Shows only admin/instance-level endpoints:
 * - GET /health
 * - GET /strategies (catalog)
 * - POST /strategies/activate
 */
const InstanceAPIExplorer = ({ instance }) => {
  const [activeEndpoint, setActiveEndpoint] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({
    System: true,
    Catalog: false,
    Activation: false,
  });
  const [activateBody, setActivateBody] = useState('');

  const baseUrl = instance?.url || getPublicKehrnelBaseUrl() || '';

  const endpoints = useMemo(() => [
    // System
    {
      id: 'health',
      category: 'System',
      name: 'Health Check',
      description: 'Check if the Kehrnel instance is healthy and get version info.',
      method: 'GET',
      path: '/health',
      icon: Activity,
      color: 'emerald',
      testable: true,
      bodyType: 'none',
    },
    // Catalog
    {
      id: 'strategies-list',
      category: 'Catalog',
      name: 'List Strategies',
      description: 'Get all available strategies from the Kehrnel catalog.',
      method: 'GET',
      path: '/strategies',
      icon: List,
      color: 'blue',
      testable: true,
      bodyType: 'none',
    },
    // Activation
    {
      id: 'strategies-activate',
      category: 'Activation',
      name: 'Activate Strategy',
      description: 'Activate a strategy with optional configuration. Returns activation metadata.',
      method: 'POST',
      path: '/strategies/activate',
      icon: Zap,
      color: 'purple',
      testable: true,
      bodyType: 'activate',
    },
  ], []);

  // Group endpoints by category
  const groupedEndpoints = useMemo(() => {
    const groups = {};
    for (const endpoint of endpoints) {
      if (!groups[endpoint.category]) groups[endpoint.category] = [];
      groups[endpoint.category].push(endpoint);
    }
    return groups;
  }, [endpoints]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const buildUrl = (endpoint) => `${baseUrl}${endpoint.path}`;

  const buildCurl = (endpoint, body = null) => {
    const url = buildUrl(endpoint);
    let curl = `curl -X ${endpoint.method} '${url}'`;
    if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
      curl += ` \\\n  -H 'Content-Type: application/json'`;
      if (body) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
        curl += ` \\\n  -d '${bodyStr.replace(/'/g, "\\'")}'`;
      }
    }
    return curl;
  };

  const copyCurl = async (endpoint, body = null) => {
    const curl = buildCurl(endpoint, body);
    await navigator.clipboard.writeText(curl);
    setCopiedCurl(endpoint.id);
    setTimeout(() => setCopiedCurl(null), 2000);
  };

  const runTest = async (endpoint) => {
    setLoading(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      // Route through HDL proxy to avoid CORS
      let proxyUrl;
      let options = { method: 'GET' };

      if (endpoint.id === 'health') {
        // Use catalog route which checks health
        proxyUrl = `/api/kehrnel/catalog?connectionId=${instance._id}`;
      } else if (endpoint.id === 'strategies-list') {
        proxyUrl = `/api/kehrnel/catalog?connectionId=${instance._id}`;
      } else if (endpoint.id === 'strategies-activate') {
        // For activate, we need the user to provide body
        let body;
        try {
          body = activateBody ? JSON.parse(activateBody) : { strategy_id: 'openehr.rps_dual' };
        } catch {
          setTestResult({
            success: false,
            error: 'Invalid JSON in request body',
            endpoint,
            duration: Date.now() - startTime
          });
          setLoading(false);
          return;
        }
        proxyUrl = `/api/kehrnel/environments/test/activate`;
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategyId: body.strategy_id,
            config: body.config || {},
            connectionId: instance._id,
          })
        };
      }

      const res = await fetch(proxyUrl, options);
      let data;
      try {
        data = await res.json();
      } catch {
        data = { text: await res.text() };
      }
      const duration = Date.now() - startTime;

      setTestResult({
        success: res.ok,
        status: res.status,
        duration,
        endpoint,
        request: {
          method: endpoint.method,
          url: buildUrl(endpoint)
        },
        response: data
      });
    } catch (err) {
      setTestResult({
        success: false,
        error: err.message,
        endpoint,
        duration: Date.now() - startTime
      });
    } finally {
      setLoading(false);
    }
  };

  const categoryIcons = {
    System: Activity,
    Catalog: List,
    Activation: Zap,
  };

  const categoryColors = {
    System: 'emerald',
    Catalog: 'blue',
    Activation: 'purple',
  };

  const methodColors = {
    GET: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
    POST: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
  };

  return (
    <div className="space-y-4">
      {/* Instance Info Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-surface-hover rounded-lg border border-theme">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">{instance.name}</p>
            <code className="text-xs text-theme-secondary font-mono">{instance.url}</code>
          </div>
        </div>
        {instance.health?.status === 'healthy' && (
          <span className="px-2 py-1 text-xs bg-success/20 text-success rounded-full">
            v{instance.health.version}
          </span>
        )}
      </div>

      {/* Endpoint Categories */}
      <div className="space-y-2">
        {Object.entries(groupedEndpoints).map(([category, categoryEndpoints]) => {
          const CategoryIcon = categoryIcons[category] || Terminal;
          const color = categoryColors[category] || 'slate';
          const isExpanded = expandedCategories[category];

          return (
            <div key={category} className="border border-theme rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-3 bg-surface-hover/50 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon className={`w-4 h-4 text-${color}-400`} />
                  <span className="text-sm font-medium text-theme-primary">{category}</span>
                  <span className="text-xs text-theme-muted bg-surface px-2 py-0.5 rounded-full">
                    {categoryEndpoints.length}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-theme-secondary" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-theme-secondary" />
                )}
              </button>

              {/* Endpoints List */}
              {isExpanded && (
                <div className="divide-y divide-theme/50">
                  {categoryEndpoints.map((endpoint) => (
                    <div key={endpoint.id} className="bg-surface/30">
                      {/* Endpoint Header */}
                      <button
                        onClick={() => setActiveEndpoint(activeEndpoint === endpoint.id ? null : endpoint.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-surface-hover/30 transition-colors"
                      >
                        <endpoint.icon className={`w-4 h-4 text-${endpoint.color}-400 flex-shrink-0`} />
                        <span className={`px-2 py-0.5 text-xs font-bold rounded border ${methodColors[endpoint.method]}`}>
                          {endpoint.method}
                        </span>
                        <div className="flex-1 text-left min-w-0">
                          <span className="text-sm font-medium text-theme-primary">{endpoint.name}</span>
                          <code className="ml-2 text-xs text-theme-muted font-mono">{endpoint.path}</code>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyCurl(endpoint, endpoint.id === 'strategies-activate'
                                ? { strategy_id: 'openehr.rps_dual', config: {} }
                                : null);
                            }}
                            className="p-1.5 text-theme-secondary hover:text-theme-primary hover:bg-surface-hover rounded transition-colors"
                            title="Copy cURL"
                          >
                            {copiedCurl === endpoint.id ? (
                              <Check className="w-3.5 h-3.5 text-success" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {activeEndpoint === endpoint.id ? (
                            <ChevronDown className="w-4 h-4 text-theme-secondary" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-theme-secondary" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Test Panel */}
                      {activeEndpoint === endpoint.id && (
                        <div className="border-t border-theme/50 p-4 bg-surface/50">
                          <p className="text-sm text-theme-secondary mb-4">{endpoint.description}</p>

                          {/* Activate body input */}
                          {endpoint.id === 'strategies-activate' && (
                            <div className="mb-4">
                              <p className="text-xs text-theme-secondary mb-2">Request body (JSON):</p>
                              <textarea
                                value={activateBody}
                                onChange={(e) => setActivateBody(e.target.value)}
                                placeholder='{"strategy_id": "openehr.rps_dual", "config": {}}'
                                className="w-full h-24 px-3 py-2 bg-surface-hover border border-theme rounded-lg text-sm text-theme-primary font-mono placeholder-theme-muted focus:outline-none focus:border-primary resize-none"
                              />
                            </div>
                          )}

                          {/* Run Button */}
                          <button
                            onClick={() => runTest(endpoint)}
                            disabled={loading}
                            className="w-full px-4 py-2.5 bg-primary hover:bg-primary/80 disabled:bg-surface-hover disabled:opacity-50 text-primary-text rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            {loading && activeEndpoint === endpoint.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Running...
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4" />
                                Run Test
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`rounded-lg border overflow-hidden ${
          testResult.success
            ? 'bg-success/5 border-success/30'
            : 'bg-error/5 border-error/30'
        }`}>
          <div className="flex items-center justify-between p-3 border-b border-theme/30">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-success" />
              ) : (
                <AlertCircle className="w-4 h-4 text-error" />
              )}
              <span className={`text-sm font-medium ${testResult.success ? 'text-success' : 'text-error'}`}>
                {testResult.success ? 'Success' : 'Failed'}
              </span>
              {testResult.status && (
                <span className="text-xs text-theme-secondary">Status: {testResult.status}</span>
              )}
              {testResult.duration && (
                <span className="text-xs text-theme-secondary">{testResult.duration}ms</span>
              )}
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="p-1.5 text-theme-secondary hover:text-theme-primary hover:bg-surface-hover rounded"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3">
            {testResult.error ? (
              <div className="text-sm text-error">{testResult.error}</div>
            ) : (
              <pre className="text-xs text-theme-secondary overflow-auto max-h-48 bg-surface rounded p-3 font-mono">
                {JSON.stringify(testResult.response, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KehrnelSettings;
