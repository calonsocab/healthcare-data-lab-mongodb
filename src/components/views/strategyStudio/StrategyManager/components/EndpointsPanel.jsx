// src/components/views/strategyStudio/StrategyManager/components/EndpointsPanel.jsx
"use client";

import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Server, Terminal, Play, AlertCircle, Database, FileText, User, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

// Domain definitions with sample queries
const DOMAIN_TYPES = {
  composition: {
    label: 'Composition',
    icon: FileText,
    description: 'Clinical documents and templates',
    sampleAql: 'SELECT c FROM COMPOSITION c WHERE c/archetype_details/template_id LIKE \'*\'',
    color: 'emerald'
  },
  ehr_status: {
    label: 'EHR Status',
    icon: User,
    description: 'Patient EHR status and demographics',
    sampleAql: 'SELECT e/ehr_status FROM EHR e',
    color: 'blue'
  },
  folder: {
    label: 'Folder',
    icon: Database,
    description: 'Organizational folders for EHR content',
    sampleAql: 'SELECT f FROM FOLDER f',
    color: 'purple'
  },
  contribution: {
    label: 'Contribution',
    icon: Activity,
    description: 'Audit trail and change sets',
    sampleAql: 'SELECT c FROM CONTRIBUTION c',
    color: 'amber'
  }
};

/**
 * EndpointsPanel - Displays Kehrnel endpoints for an active strategy
 *
 * Shows the computed endpoint URLs with:
 * - Copy to clipboard functionality
 * - cURL command examples
 * - Connection status indicator
 */
const EndpointsPanel = ({ strategyLink, envKey, domains, className }) => {
  const [copied, setCopied] = useState(null);
  const [showCurl, setShowCurl] = useState(null);
  const [expandedType, setExpandedType] = useState(null);

  const kehrnel = strategyLink?.kehrnel;
  const endpoints = kehrnel?.endpointsSnapshot || kehrnel?.endpoints || strategyLink?.endpointsSnapshot || strategyLink?.endpoints;
  const endpointMap = Array.isArray(endpoints)
    ? endpoints.reduce((acc, ep) => {
        const key = ep?.key || ep?.name || ep?.kind;
        if (key) acc[key] = ep;
        return acc;
      }, {})
    : (endpoints || {});

  // Supported domains for displaying sample info (fallback to composition)
  const supportedDomains = domains || kehrnel?.domains || ['composition'];

  const copyToClipboard = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ok':
        return 'text-emerald-400';
      case 'error':
        return 'text-red-400';
      case 'pending':
        return 'text-amber-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'ok':
        return 'bg-emerald-400/10 border-emerald-400/20';
      case 'error':
        return 'bg-red-400/10 border-red-400/20';
      case 'pending':
        return 'bg-amber-400/10 border-amber-400/20';
      default:
        return 'bg-slate-400/10 border-slate-400/20';
    }
  };

  // Generate cURL command for an endpoint
  const generateCurl = (endpointUrl, method = 'POST', body = null) => {
    let curl = `curl -X ${method} "${endpointUrl}"`;
    curl += ` \\\n  -H "Content-Type: application/json"`;
    curl += ` \\\n  -H "x-api-key: YOUR_API_KEY"`;
    if (body) {
      curl += ` \\\n  -d '${JSON.stringify(body, null, 2)}'`;
    }
    return curl;
  };

  if (!kehrnel) {
    return (
      <div className={cn("bg-surface rounded-lg border border-border p-6", className)}>
        <div className="flex items-center gap-3 text-text-secondary">
          <Server className="w-5 h-5" />
          <div>
            <p className="font-medium">No Kehrnel Connection</p>
            <p className="text-sm">
              Activate a Kehrnel-enabled strategy to view API endpoints.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (kehrnel.lastStatus === 'error') {
    return (
      <div className={cn("bg-surface rounded-lg border border-red-500/30 p-6", className)}>
        <div className="flex items-center gap-3 text-red-400 mb-3">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">Kehrnel Activation Failed</p>
        </div>
        <p className="text-sm text-text-secondary mb-2">
          {kehrnel.error || 'Unknown error during activation'}
        </p>
        <p className="text-xs text-slate-500">
          Strategy: {kehrnel.strategyId}
        </p>
      </div>
    );
  }

  if (!endpoints) {
    return (
      <div className={cn("bg-surface rounded-lg border border-border p-6", className)}>
        <div className="flex items-center gap-3 text-amber-400">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">Endpoints Not Available</p>
            <p className="text-sm text-text-secondary">
              The strategy was activated but endpoints were not computed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const aliasMap = {
    compile: ['compile', 'compile_query', 'compile-query'],
    query: ['query', 'aql_query'],
    opsBase: ['ops', 'extensions', 'opsbase', 'ops_base']
  };

  const endpointList = [
    {
      key: 'query',
      label: 'Query',
      description: 'Execute AQL queries',
      method: 'POST',
      sampleBody: { aql: 'SELECT c FROM COMPOSITION c' }
    },
    {
      key: 'compile',
      label: 'Compile',
      description: 'Compile AQL to MongoDB pipeline',
      method: 'POST',
      sampleBody: { aql: 'SELECT c FROM COMPOSITION c' }
    },
    {
      key: 'opsBase',
      label: 'Operations',
      description: 'Strategy-specific operations',
      method: 'POST',
      isBase: true
    }
  ];

  return (
    <div className={cn("bg-surface rounded-lg border border-border p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Server className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text">Kehrnel Endpoints</h3>
            <p className="text-sm text-text-secondary">
              API endpoints for {kehrnel.strategyId}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={cn(
          "px-3 py-1 rounded-full border text-sm font-medium",
          getStatusBg(kehrnel.lastStatus)
        )}>
          <span className={getStatusColor(kehrnel.lastStatus)}>
            {kehrnel.lastStatus === 'ok' ? 'Connected' : kehrnel.lastStatus}
          </span>
        </div>
      </div>

      {/* Runtime Info */}
      <div className="bg-surface-alt rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-secondary">Runtime URL:</span>
            <p className="text-text font-mono text-xs mt-1 truncate">
              {kehrnel.runtimeUrl || 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-text-secondary">Connection:</span>
            <p className="text-text mt-1">
              {kehrnel.endpointName || 'default'}
            </p>
          </div>
        </div>
        {kehrnel.activatedAt && (
          <p className="text-xs text-text-secondary mt-3 pt-3 border-t border-border">
            Activated: {new Date(kehrnel.activatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Endpoints List */}
      <div className="space-y-3">
        {endpointList.map(({ key, label, description, method, sampleBody, isBase }) => {
          const descriptor = endpointMap[key] || Object.entries(endpointMap || {}).find(([alias]) =>
            (aliasMap[key] || []).some(a => alias.toLowerCase().includes(a))
          )?.[1];
          const url = typeof descriptor === 'string' ? descriptor : descriptor?.url || descriptor?.href || descriptor?.uri;
          const examplePayload = descriptor?.example || descriptor?.sample || descriptor?.sample_payload || descriptor?.examplePayload || descriptor?.payload;
          if (!url) return null;

          return (
            <div key={key} className="border border-border rounded-lg overflow-hidden">
              {/* Endpoint Header */}
              <div className="p-4 bg-surface-alt">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-bold",
                      method === 'GET'
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    )}>
                      {method}
                    </span>
                    <span className="font-medium text-text">{label}</span>
                    {isBase && (
                      <span className="text-xs text-text-secondary">(base URL)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCurl(showCurl === key ? null : key)}
                      className={cn(
                        "p-1.5 rounded hover:bg-surface transition-colors",
                        showCurl === key ? "text-primary" : "text-text-secondary"
                      )}
                      title="Show cURL command"
                    >
                      <Terminal className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => copyToClipboard(key, url)}
                      className="p-1.5 text-text-secondary hover:text-text hover:bg-surface rounded transition-colors"
                      title="Copy URL"
                    >
                      {copied === key ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-text-secondary mb-2">{description}</p>

                <code className="block text-xs text-slate-400 font-mono bg-surface rounded p-2 truncate">
                  {url}
                </code>

                {examplePayload && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                      <span>Example payload</span>
                      <button
                        onClick={() => copyToClipboard(`${key}-payload`, JSON.stringify(examplePayload, null, 2))}
                        className="text-primary hover:text-primary-hover"
                      >
                        {copied === `${key}-payload` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="text-[11px] bg-slate-900 text-slate-200 p-3 rounded border border-slate-700 overflow-auto">
                      {JSON.stringify(examplePayload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* cURL Example (expandable) */}
              {showCurl === key && (
                <div className="p-4 bg-slate-900 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-text-secondary">cURL Example</span>
                    <button
                      onClick={() => copyToClipboard(`${key}-curl`, generateCurl(url, method, sampleBody))}
                      className="text-xs text-primary hover:text-primary-hover"
                    >
                      {copied === `${key}-curl` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                    {generateCurl(url, method, sampleBody)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Domains Section */}
      {supportedDomains.length > 0 && endpointMap?.query && (
        <div className="mt-6 pt-6 border-t border-border">
          <h4 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Domains
          </h4>
          <div className="grid gap-3">
            {supportedDomains.map((typeKey) => {
              const typeDef = DOMAIN_TYPES[typeKey];
              if (!typeDef) return null;

              const Icon = typeDef.icon;
              const isExpanded = expandedType === typeKey;
              const queryUrl = endpoints.query;
              const fullCurl = generateCurl(queryUrl, 'POST', { aql: typeDef.sampleAql });

              return (
                <div
                  key={typeKey}
                  className={cn(
                    "border rounded-lg overflow-hidden transition-all",
                    `border-${typeDef.color}-500/30 hover:border-${typeDef.color}-500/50`
                  )}
                  style={{
                    borderColor: `var(--color-${typeDef.color}-500, #64748b)`,
                    backgroundColor: isExpanded ? `rgba(var(--color-${typeDef.color}-rgb, 100, 116, 139), 0.05)` : 'transparent'
                  }}
                >
                  <button
                    onClick={() => setExpandedType(isExpanded ? null : typeKey)}
                    className="w-full p-3 flex items-center justify-between text-left hover:bg-surface-alt/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        `bg-${typeDef.color}-500/20`
                      )}
                        style={{ backgroundColor: `rgba(var(--color-${typeDef.color}-rgb, 100, 116, 139), 0.2)` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: `var(--color-${typeDef.color}-500, #64748b)` }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text">{typeDef.label}</p>
                        <p className="text-xs text-text-secondary">{typeDef.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary font-mono">
                        {typeKey}
                      </span>
                      <svg
                        className={cn("w-4 h-4 text-text-secondary transition-transform", isExpanded && "rotate-180")}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-3 pt-0 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-text-secondary">Sample AQL Query</span>
                          <button
                            onClick={() => copyToClipboard(`aql-${typeKey}`, typeDef.sampleAql)}
                            className="text-xs text-primary hover:text-primary-hover"
                          >
                            {copied === `aql-${typeKey}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <code className="block text-xs font-mono bg-surface p-2 rounded text-slate-300 overflow-x-auto">
                          {typeDef.sampleAql}
                        </code>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-text-secondary">cURL Command</span>
                          <button
                            onClick={() => copyToClipboard(`curl-${typeKey}`, fullCurl)}
                            className="text-xs text-primary hover:text-primary-hover"
                          >
                            {copied === `curl-${typeKey}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <pre className="text-xs font-mono bg-slate-900 p-2 rounded text-slate-300 overflow-x-auto whitespace-pre-wrap">
                          {fullCurl}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          Replace <code className="bg-surface-alt px-1 rounded">YOUR_API_KEY</code> with your Kehrnel API key
        </p>
        {kehrnel.connectionId && (
          <p className="text-xs text-slate-500">
            Connection ID: {kehrnel.connectionId}
          </p>
        )}
      </div>
    </div>
  );
};

export default EndpointsPanel;
