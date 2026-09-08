// src/components/views/strategyStudio/StrategyManager/components/StrategyAPIExplorer.jsx
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Play,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Terminal,
  Shuffle,
  Database,
  Search,
  RefreshCw,
  Send,
  Cpu,
  Wrench,
  Zap,
  FileJson,
  Globe,
  AlertCircle,
  Upload,
  Settings,
  FlaskConical,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { getPublicKehrnelBaseUrl } from '@/lib/kehrnel/url';

/**
 * StrategyAPIExplorer - Interactive API testing panel for strategy-specific endpoints
 *
 * Architecture:
 * - OpenAPI spec is source of truth for actual HTTP endpoints (paths, methods, parameters)
 * - Manifest is used for enrichment only (friendly names, badges, grouping, descriptions)
 */
const StrategyAPIExplorer = ({
  strategy,
  kehrnelBaseUrl = '',
  activeEnvironmentId = ''
}) => {
  const [activeEndpoint, setActiveEndpoint] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({
    'Strategy Capabilities': true,
    'Strategy Info': true,
    'Maintenance Operations': true,
  });

  // OpenAPI state
  const [openApiSpec, setOpenApiSpec] = useState(null);
  const [openApiLoading, setOpenApiLoading] = useState(true);
  const [openApiError, setOpenApiError] = useState(null);
  const resolvedKehrnelBaseUrl = useMemo(
    () => kehrnelBaseUrl || getPublicKehrnelBaseUrl(),
    [kehrnelBaseUrl]
  );

  const manifest = strategy?.kehrnelManifest;
  const kehrnelId = String(strategy?.kehrnelId || manifest?.id || strategy?.id || '').trim();

  // Split strategyId into domain and strategy parts for API paths
  // e.g., "openehr.rps_dual" -> domain="openehr", strategyName="rps_dual"
  const [strategyDomain, strategyName] = useMemo(() => {
    if (!kehrnelId) return ['', ''];

    if (kehrnelId.includes('/')) {
      const parts = kehrnelId.split('/').filter(Boolean);
      const domain = parts[0] || '';
      const name = parts.slice(1).join('_');
      return [domain, name];
    }

    if (kehrnelId.includes('.')) {
      const [domain, ...rest] = kehrnelId.split('.');
      return [domain || '', rest.join('_') || ''];
    }

    const manifestDomain = String(strategy?.domain || '').trim().toLowerCase();
    return [manifestDomain, kehrnelId];
  }, [kehrnelId, strategy?.domain]);

  // Manifest data for enrichment only
  const manifestCapabilities = useMemo(
    () => (manifest?.capabilities || strategy?.capabilities || []),
    [manifest?.capabilities, strategy?.capabilities]
  );
  const manifestOps = useMemo(
    () => (manifest?.ops || strategy?.ops || []),
    [manifest?.ops, strategy?.ops]
  );

  // Fetch OpenAPI spec via Next.js proxy to avoid CORS issues
  const fetchOpenApiSpec = useCallback(async () => {
    setOpenApiLoading(true);
    setOpenApiError(null);
    setOpenApiSpec(null);

    if (!strategyDomain || !strategyName) {
      setOpenApiError('Strategy ID/domain must come from the strategy pack manifest');
      setOpenApiLoading(false);
      return;
    }

    // Use Next.js API route as proxy
    const proxyUrl = `/api/strategies/openapi?domain=${encodeURIComponent(strategyDomain)}&strategy=${encodeURIComponent(strategyName)}`;

    try {
      const res = await fetch(proxyUrl, {
        headers: activeEnvironmentId ? { 'x-active-env': activeEnvironmentId } : {}
      });

      if (res.ok) {
        const spec = await res.json();
        if (spec.paths && Object.keys(spec.paths).length > 0) {
          setOpenApiSpec(spec);
          setOpenApiLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch OpenAPI via proxy:`, err);
    }

    // Fallback: try direct fetch (might work in some environments)
    try {
      if (!resolvedKehrnelBaseUrl) {
        setOpenApiError('OpenAPI spec not available for this strategy pack');
        setOpenApiLoading(false);
        return;
      }

      const strategyOpenApiUrl = `${resolvedKehrnelBaseUrl}/openapi/strategies/${encodeURIComponent(strategyDomain)}/${encodeURIComponent(strategyName)}.json`;
      const res = await fetch(strategyOpenApiUrl, {
        headers: activeEnvironmentId ? { 'x-active-env': activeEnvironmentId } : {}
      });

      if (res.ok) {
        const spec = await res.json();
        if (spec.paths && Object.keys(spec.paths).length > 0) {
          setOpenApiSpec(spec);
          setOpenApiLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch OpenAPI directly:', err);
    }

    setOpenApiError('OpenAPI spec not available for this strategy pack');
    setOpenApiLoading(false);
  }, [resolvedKehrnelBaseUrl, strategyDomain, strategyName, activeEnvironmentId]);

  useEffect(() => {
    fetchOpenApiSpec();
  }, [fetchOpenApiSpec]);

  // Build endpoint enrichment map from manifest
  const manifestEnrichment = useMemo(() => {
    const enrichment = {};

    // Enrich capability endpoints
    const capabilityMeta = {
      ingest: {
        icon: Send,
        color: 'purple',
        friendlyName: 'Ingest via Strategy',
        description: 'Ingest data through strategy pipeline'
      },
      transform: {
        icon: Shuffle,
        color: 'indigo',
        friendlyName: 'Transform via Strategy',
        description: 'Transform data without persisting'
      },
      search: {
        icon: Search,
        color: 'blue',
        friendlyName: 'Search via Strategy',
        description: 'Execute search through strategy'
      },
      validate: {
        icon: CheckCircle,
        color: 'emerald',
        friendlyName: 'Validate via Strategy',
        description: 'Validate payload through strategy'
      },
    };

    for (const cap of manifestCapabilities) {
      const meta = capabilityMeta[cap];
      if (meta) {
        enrichment[`/strategies/{strategy_id}/${cap}`] = meta;
        enrichment[`/strategies/${kehrnelId}/${cap}`] = meta;
      }
    }

    // Enrich operation endpoints
    for (const op of manifestOps) {
      const opKey = `/strategies/{strategy_id}/ops/${op.name}`;
      const opKeyWithId = `/strategies/${kehrnelId}/ops/${op.name}`;
      const meta = {
        icon: op.kind === 'maintenance' ? Wrench : Zap,
        color: 'amber',
        friendlyName: op.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: op.summary || `Execute ${op.name} operation`,
        opSchema: op.input_schema,
        opName: op.name,
      };
      enrichment[opKey] = meta;
      enrichment[opKeyWithId] = meta;
    }

    return enrichment;
  }, [manifestCapabilities, manifestOps, kehrnelId]);

  // Parse endpoints from OpenAPI spec
  const openApiEndpoints = useMemo(() => {
    if (!openApiSpec?.paths) return [];

    const endpoints = [];
    const strategyPathPattern = new RegExp(`^/strategies/(\\{strategy_id\\}|${kehrnelId.replace(/\./g, '\\.')})`);

    for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
      // Only include strategy-related paths
      if (!strategyPathPattern.test(path)) continue;

      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
          // Get enrichment from manifest
          const enrichment = manifestEnrichment[path] || manifestEnrichment[path.replace('{strategy_id}', kehrnelId)] || {};

          // Determine category based on path
          let category = 'Strategy Capabilities';
          if (path.includes('/ops/')) {
            category = 'Maintenance Operations';
          }

          // Determine body type
          let bodyType = 'none';
          if (method.toLowerCase() === 'post' || method.toLowerCase() === 'put') {
            if (path.includes('/ingest') || path.includes('/transform') || path.includes('/validate')) {
              bodyType = 'composition';
            } else if (path.includes('/search')) {
              bodyType = 'query';
            } else if (path.includes('/ops/')) {
              bodyType = 'op';
            } else {
              bodyType = 'json';
            }
          }

          // Build the actual path with strategy ID
          const actualPath = path.replace('{strategy_id}', kehrnelId);

          endpoints.push({
            id: `${method}-${actualPath}`,
            category,
            name: enrichment.friendlyName || operation.summary || `${method.toUpperCase()} ${path}`,
            description: enrichment.description || operation.description || '',
            method: method.toUpperCase(),
            path: actualPath,
            templatePath: path,
            icon: enrichment.icon || Terminal,
            color: enrichment.color || 'slate',
            testable: true,
            bodyType,
            opSchema: enrichment.opSchema,
            opName: enrichment.opName,
            // OpenAPI metadata
            operationId: operation.operationId,
            tags: operation.tags || [],
            parameters: operation.parameters || [],
            requestBody: operation.requestBody,
          });
        }
      }
    }

    return endpoints;
  }, [openApiSpec, kehrnelId, manifestEnrichment]);

  // Fallback: Build endpoints from manifest if OpenAPI not available
  const fallbackEndpoints = useMemo(() => {
    if (openApiSpec || openApiLoading) return [];

    const base = [];

    // Standard strategy capability endpoints - always available for all strategies
    // These are the core Kehrnel strategy API patterns
    const standardCapabilities = [
      {
        id: 'strategy-transform',
        capability: 'transform',
        category: 'Strategy Capabilities',
        name: 'Transform via Strategy',
        description: `Transform data through ${kehrnelId} strategy without persisting. Returns the transformed document.`,
        method: 'POST',
        path: `/strategies/${kehrnelId}/transform`,
        icon: Shuffle,
        color: 'indigo',
        testable: true,
        bodyType: 'composition',
      },
      {
        id: 'strategy-ingest',
        capability: 'ingest',
        category: 'Strategy Capabilities',
        name: 'Ingest via Strategy',
        description: `Ingest data through ${kehrnelId} strategy. Transforms and persists the document.`,
        method: 'POST',
        path: `/strategies/${kehrnelId}/ingest`,
        icon: Send,
        color: 'purple',
        testable: true,
        bodyType: 'composition',
      },
      {
        id: 'strategy-validate',
        capability: 'validate',
        category: 'Strategy Capabilities',
        name: 'Validate via Strategy',
        description: `Validate payload through ${kehrnelId} strategy without persisting.`,
        method: 'POST',
        path: `/strategies/${kehrnelId}/validate`,
        icon: CheckCircle,
        color: 'emerald',
        testable: true,
        bodyType: 'composition',
      },
      {
        id: 'strategy-query',
        capability: 'query',
        category: 'Strategy Capabilities',
        name: 'Query via Strategy',
        description: `Execute AQL or structured query through ${kehrnelId} strategy.`,
        method: 'POST',
        path: `/strategies/${kehrnelId}/query`,
        icon: Search,
        color: 'blue',
        testable: true,
        bodyType: 'query',
      },
    ];

    // Add endpoints declared by strategy pack capabilities
    for (const cap of standardCapabilities) {
      if (manifestCapabilities.includes(cap.capability)) {
        base.push(cap);
      }
    }

    // Operation endpoints from manifest
    for (const op of manifestOps) {
      base.push({
        id: `op-${op.name}`,
        category: 'Maintenance Operations',
        name: op.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: op.summary || `Execute ${op.name} operation`,
        method: 'POST',
        path: `/strategies/${kehrnelId}/ops/${op.name}`,
        icon: op.kind === 'maintenance' ? Wrench : Zap,
        color: 'amber',
        testable: true,
        bodyType: 'op',
        opSchema: op.input_schema,
        opName: op.name,
      });
    }

    return base;
  }, [openApiSpec, openApiLoading, kehrnelId, manifestCapabilities, manifestOps]);

  // Use OpenAPI endpoints if available, otherwise fallback to manifest
  const endpoints = openApiEndpoints.length > 0 ? openApiEndpoints : fallbackEndpoints;

  // Group endpoints by category
  const groupedEndpoints = useMemo(() => {
    const groups = {};
    for (const endpoint of endpoints) {
      if (!groups[endpoint.category]) {
        groups[endpoint.category] = [];
      }
      groups[endpoint.category].push(endpoint);
    }
    return groups;
  }, [endpoints]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Build full URL for endpoint
  const buildUrl = (endpoint) => {
    return `${kehrnelBaseUrl}${endpoint.path}`;
  };

  // Build cURL command
  const buildCurl = (endpoint, body = null) => {
    const url = buildUrl(endpoint);
    let curl = `curl -X ${endpoint.method} '${url}'`;
    if (activeEnvironmentId) {
      curl += ` \\\n  -H 'x-active-env: ${activeEnvironmentId}'`;
    }

    if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
      curl += ` \\\n  -H 'Content-Type: application/json'`;
      if (body) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
        curl += ` \\\n  -d '${bodyStr.replace(/'/g, "\\'")}'`;
      }
    }

    return curl;
  };

  // Copy cURL to clipboard
  const copyCurl = async (endpoint, body = null) => {
    const curl = buildCurl(endpoint, body);
    await navigator.clipboard.writeText(curl);
    setCopiedCurl(endpoint.id);
    setTimeout(() => setCopiedCurl(null), 2000);
  };

  // Run test request
  const runTest = async (endpoint, body = null) => {
    setLoading(true);
    setTestResult(null);

    const startTime = Date.now();

    try {
      // For strategy ingest/transform, use our Next.js API route (avoids CORS)
      if ((endpoint.path.includes('/ingest') || endpoint.path.includes('/transform')) && body) {
        const isTransform = endpoint.path.includes('/transform');
        const res = await fetch('/api/strategies/preview-transform', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeEnvironmentId ? { 'x-active-env': activeEnvironmentId } : {})
          },
          body: JSON.stringify({
            strategy,
            sampleComposition: body,
            preview: isTransform,
            environment: activeEnvironmentId || undefined
          })
        });

        const data = await res.json();
        const duration = Date.now() - startTime;

        setTestResult({
          success: res.ok,
          status: res.status,
          duration,
          endpoint,
          request: {
            method: endpoint.method,
            url: buildUrl(endpoint),
            body: { payload: body }
          },
          response: data
        });
      } else {
        // Direct call to Kehrnel
        const url = buildUrl(endpoint);
        const res = await fetch(url, {
          method: endpoint.method,
          headers: {
            ...(endpoint.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
            ...(activeEnvironmentId ? { 'x-active-env': activeEnvironmentId } : {})
          },
          body: endpoint.method !== 'GET' && body ? JSON.stringify(body) : undefined
        });

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
            url
          },
          response: data
        });
      }
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
    'Strategy Capabilities': Cpu,
    'Strategy Info': FileJson,
    'Maintenance Operations': Wrench,
  };

  const categoryColors = {
    'Strategy Capabilities': 'purple',
    'Strategy Info': 'slate',
    'Maintenance Operations': 'amber',
  };

  // ReDoc documentation URL — routed through Next.js proxy to avoid exposing
  // the internal Kehrnel hostname to the browser.
  const redocUrl = strategyDomain && strategyName
    ? `/api/kehrnel/redoc/strategies/${strategyDomain}/${strategyName}`
    : null;

  // Parse tags from OpenAPI spec dynamically
  const apiTags = useMemo(() => {
    if (!openApiSpec) return [];

    // Get tags from spec (with descriptions)
    const tagMeta = {};
    if (openApiSpec.tags) {
      for (const tag of openApiSpec.tags) {
        tagMeta[tag.name] = {
          name: tag.name,
          description: tag.description || '',
          endpoints: []
        };
      }
    }

    // Count endpoints per tag
    if (openApiSpec.paths) {
      for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
            const tags = operation.tags || ['Other'];
            for (const tag of tags) {
              if (!tagMeta[tag]) {
                tagMeta[tag] = { name: tag, description: '', endpoints: [] };
              }
              tagMeta[tag].endpoints.push({
                method: method.toUpperCase(),
                path,
                summary: operation.summary || '',
                operationId: operation.operationId || ''
              });
            }
          }
        }
      }
    }

    return Object.values(tagMeta).filter(t => t.endpoints.length > 0);
  }, [openApiSpec]);

  // Icon and color mapping for common tags
  const tagConfig = {
    'Ingest': { icon: Upload, color: 'emerald', gradient: 'from-emerald-600 to-teal-600' },
    'Config': { icon: Settings, color: 'blue', gradient: 'from-blue-600 to-indigo-600' },
    'Synthetic-Data': { icon: FlaskConical, color: 'purple', gradient: 'from-purple-600 to-pink-600' },
    'Transform': { icon: Shuffle, color: 'indigo', gradient: 'from-indigo-600 to-violet-600' },
    'Query': { icon: Search, color: 'cyan', gradient: 'from-cyan-600 to-blue-600' },
    'Validate': { icon: CheckCircle, color: 'green', gradient: 'from-green-600 to-emerald-600' },
  };

  const getTagConfig = (tagName) => {
    return tagConfig[tagName] || { icon: Terminal, color: 'slate', gradient: 'from-slate-600 to-gray-600' };
  };

  return (
    <div className="space-y-4">
      {/* Strategy Info Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/20 to-slate-900/40 rounded-xl border border-primary/40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
            <Cpu className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Strategy API Endpoints</p>
            <code className="text-xs text-primary">{kehrnelId}</code>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Kehrnel Instance</p>
          <code className="text-xs text-slate-400">{kehrnelBaseUrl}</code>
        </div>
      </div>

      {/* Data Source Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {openApiSpec ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-emerald-900/30 border border-emerald-700/50 rounded-full text-emerald-300">
              <FileJson className="w-3 h-3" />
              OpenAPI
            </span>
          ) : openApiLoading ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 border border-slate-700 rounded-full text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading OpenAPI...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-900/30 border border-blue-700/50 rounded-full text-blue-300">
              <Cpu className="w-3 h-3" />
              Manifest Endpoints
            </span>
          )}
          {openApiError && !openApiLoading && (
            <span className="text-xs text-slate-500">(using fallback)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* ReDoc Link */}
          {redocUrl && (
            <a
              href={redocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 border border-primary/30 rounded-lg transition-colors"
            >
              <Globe className="w-3 h-3" />
              View Full API Docs
            </a>
          )}
          <button
            onClick={fetchOpenApiSpec}
            disabled={openApiLoading}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${openApiLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Capabilities Badge (from manifest - enrichment) */}
      {manifestCapabilities.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-400">Declared Capabilities:</span>
          {manifestCapabilities.map((cap) => (
            <span
              key={cap}
              className="px-2.5 py-1 text-xs font-medium bg-primary/20 border border-primary/40 rounded-full text-primary"
            >
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* API Categories - Inline Endpoint Display */}
      {apiTags.length > 0 && (
        <div className="space-y-4">
          {apiTags.map((tag) => {
            const config = getTagConfig(tag.name);
            const TagIcon = config.icon;
            const tagUrl = redocUrl ? `${redocUrl}#tag/${encodeURIComponent(tag.name)}` : null;
            const isExpanded = expandedCategories[tag.name] !== false; // Default to expanded

            return (
              <div key={tag.name} className="border border-slate-700 rounded-xl overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(tag.name)}
                  className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient}`}>
                      <TagIcon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white">{tag.name.replace(/-/g, ' ')}</span>
                      {tag.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{tag.description}</p>
                      )}
                    </div>
                    <span className="px-2 py-0.5 text-xs bg-slate-700/50 text-slate-400 rounded-full">
                      {tag.endpoints.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tagUrl && (
                      <a
                        href={tagUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        ReDoc
                      </a>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Endpoints List */}
                {isExpanded && (
                  <div className="divide-y divide-slate-700/50">
                    {tag.endpoints.map((ep, i) => (
                      <div key={i} className="p-4 bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <span className={`px-2 py-1 text-xs font-bold rounded flex-shrink-0 ${
                            ep.method === 'GET' ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' :
                            ep.method === 'POST' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' :
                            ep.method === 'PUT' ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30' :
                            ep.method === 'DELETE' ? 'bg-red-600/20 text-red-400 border border-red-600/30' :
                            'bg-slate-600/20 text-slate-400 border border-slate-600/30'
                          }`}>
                            {ep.method}
                          </span>
                          <div className="flex-1 min-w-0">
                            <code className="text-sm text-slate-200 font-mono break-all">{ep.path}</code>
                            {ep.summary && (
                              <p className="text-xs text-slate-400 mt-1">{ep.summary}</p>
                            )}
                            {ep.operationId && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] bg-slate-700/50 text-slate-500 rounded font-mono">
                                {ep.operationId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fallback Endpoint Categories - only show when no OpenAPI tags */}
      {apiTags.length === 0 && endpoints.length > 0 && (
        <div className="space-y-3">
          {Object.entries(groupedEndpoints).map(([category, categoryEndpoints]) => {
            const CategoryIcon = categoryIcons[category] || Terminal;
            const color = categoryColors[category] || 'slate';
            const isExpanded = expandedCategories[category];

            return (
              <div key={category} className="border border-slate-700 rounded-xl overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon className={`w-5 h-5 text-${color}-400`} />
                    <span className="text-sm font-semibold text-white">{category}</span>
                    <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                      {categoryEndpoints.length}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {/* Endpoints List */}
                {isExpanded && (
                  <div className="divide-y divide-slate-700/50">
                    {categoryEndpoints.map((endpoint) => (
                      <EndpointRow
                        key={endpoint.id}
                        endpoint={endpoint}
                        kehrnelBaseUrl={kehrnelBaseUrl}
                        kehrnelId={kehrnelId}
                        strategy={strategy}
                        activeEnvironmentId={activeEnvironmentId}
                        isActive={activeEndpoint === endpoint.id}
                        onToggle={() => setActiveEndpoint(
                          activeEndpoint === endpoint.id ? null : endpoint.id
                        )}
                        onRun={(body) => runTest(endpoint, body)}
                        onCopyCurl={(body) => copyCurl(endpoint, body)}
                        copiedCurl={copiedCurl === endpoint.id}
                        loading={loading && activeEndpoint === endpoint.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state - only when no OpenAPI tags AND no fallback endpoints */}
      {apiTags.length === 0 && endpoints.length === 0 && !openApiLoading && (
        <div className="text-center py-8 border border-slate-700 rounded-xl bg-slate-800/30">
          <Globe className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 font-medium">No API endpoints detected</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Unable to fetch OpenAPI spec from <code className="text-slate-400">{kehrnelBaseUrl}/openapi/strategies/{strategyDomain}/{strategyName}.json</code>
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Make sure the Kehrnel API is running at <code className="text-slate-400">{kehrnelBaseUrl}</code>
          </p>
          {redocUrl && (
            <a
              href={redocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 border border-primary/40 rounded-lg transition-colors"
            >
              <Globe className="w-4 h-4" />
              View Full API Documentation
            </a>
          )}
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <TestResultPanel
          result={testResult}
          onClose={() => setTestResult(null)}
        />
      )}
    </div>
  );
};

/**
 * EndpointRow - Single endpoint with expandable test panel
 */
const EndpointRow = ({
  endpoint,
  kehrnelBaseUrl,
  kehrnelId,
  strategy,
  activeEnvironmentId,
  isActive,
  onToggle,
  onRun,
  onCopyCurl,
  copiedCurl,
  loading
}) => {
  const [testBody, setTestBody] = useState('');
  const [useRandomSample, setUseRandomSample] = useState(true);
  const [randomSample, setRandomSample] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const methodColors = {
    GET: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
    POST: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
    PUT: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
    DELETE: 'bg-red-600/20 text-red-400 border-red-600/30'
  };

  const Icon = endpoint.icon || Terminal;

  // Fetch random sample
  const fetchRandomSample = async () => {
    setLoadingSample(true);
    try {
      const res = await fetch('/api/strategies/preview-transform?random=true', {
        headers: activeEnvironmentId ? { 'x-active-env': activeEnvironmentId } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sample?.composition) {
          setRandomSample(data.sample);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sample:', err);
    } finally {
      setLoadingSample(false);
    }
  };

  // Get body for request
  const getRequestBody = () => {
    if (endpoint.bodyType === 'none') return null;

    if (endpoint.bodyType === 'composition') {
      if (useRandomSample && randomSample?.composition) {
        return randomSample.composition;
      }
      if (testBody.trim()) {
        try {
          return JSON.parse(testBody);
        } catch {
          return null;
        }
      }
    }

    if (endpoint.bodyType === 'query') {
      return { query: testBody || {} };
    }

    if (endpoint.bodyType === 'activate') {
      return {
        strategy_id: kehrnelId,
        config: {}
      };
    }

    if (endpoint.bodyType === 'config' || endpoint.bodyType === 'json') {
      if (testBody.trim()) {
        try {
          return JSON.parse(testBody);
        } catch {
          return null;
        }
      }
      return {};
    }

    if (endpoint.bodyType === 'op') {
      return {};
    }

    return null;
  };

  return (
    <div className="bg-slate-900/30">
      {/* Endpoint Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-800/30 transition-colors"
      >
        <Icon className={`w-4 h-4 text-${endpoint.color}-400 flex-shrink-0`} />
        <span className={`px-2 py-0.5 text-xs font-bold rounded border ${methodColors[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <div className="flex-1 text-left min-w-0">
          <span className="text-sm font-medium text-white">{endpoint.name}</span>
          <code className="ml-2 text-xs text-slate-500 font-mono truncate block sm:inline">
            {endpoint.path}
          </code>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {endpoint.testable && (
            <span className="px-2 py-0.5 text-[10px] bg-purple-900/30 text-purple-300 rounded-full border border-purple-700/30">
              testable
            </span>
          )}
          {endpoint.operationId && (
            <span className="px-2 py-0.5 text-[10px] bg-slate-700/50 text-slate-400 rounded-full">
              {endpoint.operationId}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onCopyCurl(getRequestBody()); }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Copy cURL"
          >
            {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {isActive ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Test Panel */}
      {isActive && (
        <div className="border-t border-slate-700/50 p-4 bg-slate-950/30">
          <p className="text-sm text-slate-400 mb-4">{endpoint.description}</p>

          {/* Body Input for composition endpoints */}
          {endpoint.testable && endpoint.bodyType === 'composition' && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={useRandomSample}
                    onChange={() => setUseRandomSample(true)}
                    className="text-purple-500"
                  />
                  <span className="text-sm text-slate-300">Random Sample</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!useRandomSample}
                    onChange={() => setUseRandomSample(false)}
                    className="text-purple-500"
                  />
                  <span className="text-sm text-slate-300">Custom JSON</span>
                </label>
              </div>

              {useRandomSample ? (
                <div className="space-y-2">
                  {randomSample ? (
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">
                          Sample: {randomSample.templateName || randomSample.templateId}
                        </span>
                        <button
                          onClick={fetchRandomSample}
                          disabled={loadingSample}
                          className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                        >
                          <Shuffle className={`w-3 h-3 ${loadingSample ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                      </div>
                      <pre className="text-xs text-slate-300 overflow-auto max-h-24 font-mono">
                        {JSON.stringify(randomSample.composition, null, 2).substring(0, 300)}...
                      </pre>
                    </div>
                  ) : (
                    <button
                      onClick={fetchRandomSample}
                      disabled={loadingSample}
                      className="w-full p-4 border border-dashed border-purple-600/50 rounded-lg text-slate-400 hover:text-white hover:border-purple-500 hover:bg-purple-900/10 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      {loadingSample ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading sample...
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4" />
                          Load Random Sample Composition
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <textarea
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  placeholder='{"_type": "COMPOSITION", "name": {"value": "Test"}, ...}'
                  className="w-full h-32 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              )}
            </div>
          )}

          {/* Body Input for query endpoints */}
          {endpoint.testable && endpoint.bodyType === 'query' && (
            <div className="mb-4">
              <textarea
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                placeholder='{"aql": "SELECT c FROM COMPOSITION c LIMIT 10"}'
                className="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          )}

          {/* Generic JSON body input */}
          {endpoint.testable && endpoint.bodyType === 'json' && (
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2">Request body (JSON):</p>
              <textarea
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                placeholder='{}'
                className="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          )}

          {/* Operation body input */}
          {endpoint.testable && endpoint.bodyType === 'op' && (
            <div className="mb-4 space-y-3">
              {endpoint.opSchema?.properties && Object.keys(endpoint.opSchema.properties).length > 0 ? (
                <>
                  <p className="text-xs text-slate-400">Operation parameters:</p>
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                    {Object.entries(endpoint.opSchema.properties).map(([key, prop]) => (
                      <div key={key} className="flex items-center gap-3">
                        <label className="text-xs text-slate-300 w-24">{key}:</label>
                        {prop.type === 'boolean' ? (
                          <select
                            className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200"
                            defaultValue={prop.default?.toString() || 'false'}
                          >
                            <option value="false">false</option>
                            <option value="true">true</option>
                          </select>
                        ) : (
                          <input
                            type={prop.type === 'integer' ? 'number' : 'text'}
                            placeholder={prop.default !== undefined ? `Default: ${prop.default}` : ''}
                            className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 font-mono"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400">No parameters required</p>
                  <pre className="text-xs text-slate-300 font-mono mt-1">{'{}'}</pre>
                </div>
              )}
            </div>
          )}

          {/* Run Button */}
          {endpoint.testable && (
            <button
              onClick={() => onRun(getRequestBody())}
              disabled={loading || (endpoint.bodyType === 'composition' && useRandomSample && !randomSample)}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
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
          )}

          {!endpoint.testable && (
            <div className="text-xs text-slate-500 italic p-3 bg-slate-800/30 rounded-lg">
              This endpoint requires additional configuration. Copy the cURL command to test manually.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * TestResultPanel - Displays test request/response
 */
const TestResultPanel = ({ result, onClose }) => {
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    composition: true,
    search: false,
    meta: false
  });

  const copyResponse = async () => {
    await navigator.clipboard.writeText(JSON.stringify(result.response, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const isTransformOutput = result.response?.output?.composition || result.response?.base_doc;

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${
      result.success
        ? 'bg-emerald-900/10 border-emerald-600/40'
        : 'bg-red-900/10 border-red-600/40'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          {result.success ? (
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          )}
          <div>
            <span className={`text-sm font-semibold ${result.success ? 'text-emerald-300' : 'text-red-300'}`}>
              {result.success ? 'Success' : 'Failed'}
            </span>
            <div className="flex items-center gap-3 mt-0.5">
              {result.status && <span className="text-xs text-slate-400">Status: {result.status}</span>}
              {result.duration && <span className="text-xs text-slate-400">{result.duration}ms</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyResponse} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
            {copiedResponse ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Response */}
      <div className="p-4">
        {result.error ? (
          <div className="text-sm text-red-400">{result.error}</div>
        ) : isTransformOutput ? (
          <div className="space-y-3">
            {(result.response?.output?.composition || result.response?.base_doc) && (
              <CollapsibleSection
                title={`Composition (${(result.response?.output?.composition?.cn || result.response?.base_doc?.cn)?.length || 0} nodes)`}
                expanded={expandedSections.composition}
                onToggle={() => toggleSection('composition')}
                color="emerald"
              >
                <pre className="text-xs text-slate-300 overflow-auto max-h-64 font-mono">
                  {JSON.stringify(result.response?.output?.composition || result.response?.base_doc, null, 2)}
                </pre>
              </CollapsibleSection>
            )}
            {(result.response?.output?.search || result.response?.search_doc) && (
              <CollapsibleSection
                title="Search Doc"
                expanded={expandedSections.search}
                onToggle={() => toggleSection('search')}
                color="blue"
              >
                <pre className="text-xs text-slate-300 overflow-auto max-h-64 font-mono">
                  {JSON.stringify(result.response?.output?.search || result.response?.search_doc, null, 2)}
                </pre>
              </CollapsibleSection>
            )}
          </div>
        ) : (
          <pre className="text-xs text-slate-300 overflow-auto max-h-80 bg-slate-950 rounded-lg p-3 font-mono">
            {JSON.stringify(result.response, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

const CollapsibleSection = ({ title, expanded, onToggle, color, children }) => {
  const colorClasses = {
    emerald: 'border-emerald-700/40 bg-emerald-900/10',
    blue: 'border-blue-700/40 bg-blue-900/10',
    purple: 'border-purple-700/40 bg-purple-900/10',
  };

  return (
    <div className={`rounded-lg border overflow-hidden ${colorClasses[color] || 'border-slate-700'}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 hover:bg-slate-800/30">
        <span className="text-sm font-medium text-white">{title}</span>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {expanded && <div className="border-t border-slate-700/50 p-3 bg-slate-950/50">{children}</div>}
    </div>
  );
};

export default StrategyAPIExplorer;
