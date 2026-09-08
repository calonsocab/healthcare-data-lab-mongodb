// src/components/views/deployStrategies/StrategyDetailPanel.jsx
"use client";

import React, { useState } from 'react';
import {
  X,
  Package,
  Play,
  ExternalLink,
  GitBranch,
  Database,
  Search,
  Zap,
  FileInput,
  CheckCircle,
  Settings,
  FileCode,
  BookOpen,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

/**
 * StrategyDetailPanel - Slide-out panel showing full strategy details
 */
const StrategyDetailPanel = ({ strategy, activeEnvironment, onClose, onActivate }) => {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    capabilities: true,
    config: false,
    ops: false,
    links: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleActivate = async () => {
    if (!activeEnvironment) {
      setError('No active environment selected');
      return;
    }

    setActivating(true);
    setError(null);

    const result = await onActivate(strategy, {});

    setActivating(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setError(result.error || 'Failed to activate strategy');
    }
  };

  const manifest = strategy;
  const ui = manifest.ui || {};

  // Check if already active
  const isActive = activeEnvironment?.strategyLinks?.some(
    link => link.strategyId === strategy.id || link.kehrnel?.strategyId === strategy.id
  );

  // Build GitHub links from ui.links
  const links = ui.links || {};
  const githubBaseUrl = 'https://github.com/mongodb-industry-solutions/kehrnel/blob/main';

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="dark-banner w-full max-w-xl bg-slate-900 border-l border-slate-700 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-900/30 border border-purple-600/40">
                <Package className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{manifest.name}</h2>
                <code className="text-xs text-slate-500 font-mono">{manifest.id}</code>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-300">
              {manifest.domain}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-600/50 text-slate-300">
              v{manifest.version}
            </span>
            {manifest.maturity && (
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                manifest.maturity === 'published' ? 'bg-emerald-600/30 text-emerald-300' :
                manifest.maturity === 'development' ? 'bg-blue-600/30 text-blue-300' :
                'bg-amber-600/30 text-amber-300'
              }`}>
                {manifest.maturity}
              </span>
            )}
            {isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Active
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Error/Success */}
          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <p className="text-sm text-emerald-300">Strategy activated successfully!</p>
            </div>
          )}

          {/* Description */}
          {(manifest.summary || manifest.description) && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-300 text-sm">
                {manifest.summary || manifest.description}
              </p>
            </div>
          )}

          {/* Activate Button */}
          {!isActive && activeEnvironment && (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {activating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Activate on {activeEnvironment.name}
                </>
              )}
            </button>
          )}

          {/* Capabilities Section */}
          <CollapsibleSection
            title="Capabilities"
            icon={Zap}
            expanded={expandedSections.capabilities}
            onToggle={() => toggleSection('capabilities')}
          >
            <div className="flex flex-wrap gap-2">
              {(manifest.capabilities || []).map(cap => (
                <CapabilityBadge key={cap} capability={cap} />
              ))}
              {(!manifest.capabilities || manifest.capabilities.length === 0) && (
                <span className="text-sm text-slate-500">No capabilities declared</span>
              )}
            </div>
          </CollapsibleSection>

          {/* Configuration Section */}
          {manifest.config_schema && (
            <CollapsibleSection
              title="Configuration"
              icon={Settings}
              expanded={expandedSections.config}
              onToggle={() => toggleSection('config')}
            >
              <div className="space-y-3">
                {manifest.default_config && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-2">Default Config</h4>
                    <pre className="text-xs text-slate-300 bg-slate-900 rounded p-3 overflow-x-auto">
                      {JSON.stringify(manifest.default_config, null, 2)}
                    </pre>
                  </div>
                )}
                {manifest.config_schema?.properties && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-2">Schema Properties</h4>
                    <div className="space-y-2">
                      {Object.entries(manifest.config_schema.properties).map(([key, prop]) => (
                        <div key={key} className="flex items-start gap-2 text-sm">
                          <code className="text-purple-400 font-mono">{key}</code>
                          <span className="text-slate-500">:</span>
                          <span className="text-slate-400">{prop.type || 'any'}</span>
                          {prop.description && (
                            <span className="text-slate-500 text-xs">- {prop.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Operations Section */}
          {manifest.ops && manifest.ops.length > 0 && (
            <CollapsibleSection
              title={`Operations (${manifest.ops.length})`}
              icon={Settings}
              expanded={expandedSections.ops}
              onToggle={() => toggleSection('ops')}
            >
              <div className="space-y-2">
                {manifest.ops.map(op => (
                  <div key={op.name} className="bg-slate-900 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm text-blue-400 font-mono">{op.name}</code>
                      {op.kind && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                          {op.kind}
                        </span>
                      )}
                    </div>
                    {op.summary && (
                      <p className="text-xs text-slate-400">{op.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Source Links Section */}
          {(links.source || links.docs) && (
            <CollapsibleSection
              title="Source & Docs"
              icon={GitBranch}
              expanded={expandedSections.links}
              onToggle={() => toggleSection('links')}
            >
              <div className="space-y-2">
                {links.source && (
                  <SourceLink
                    icon={FileCode}
                    label="Source Code"
                    url={links.source.startsWith('http') ? links.source : `${githubBaseUrl}/${links.source}`}
                  />
                )}
                {links.docs && (
                  <SourceLink
                    icon={BookOpen}
                    label="Documentation"
                    url={links.docs.startsWith('http') ? links.docs : `${githubBaseUrl}/${links.docs}`}
                  />
                )}
                {links.flattener && (
                  <SourceLink
                    icon={FileCode}
                    label="Flattener"
                    url={links.flattener.startsWith('http') ? links.flattener : `${githubBaseUrl}/${links.flattener}`}
                  />
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Adapters */}
          {manifest.adapters && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Required Adapters
              </h4>
              <div className="flex flex-wrap gap-2">
                {manifest.adapters.storage && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-300 border border-blue-600/40">
                    Storage: {Array.isArray(manifest.adapters.storage) ? manifest.adapters.storage.join(', ') : manifest.adapters.storage}
                  </span>
                )}
                {manifest.adapters.search && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-600/20 text-purple-300 border border-purple-600/40">
                    Search: {Array.isArray(manifest.adapters.search) ? manifest.adapters.search.join(', ') : manifest.adapters.search}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* UI Metadata (Benefits, Constraints) */}
          {(ui.benefits || ui.constraints) && (
            <div className="space-y-3">
              {ui.benefits && ui.benefits.length > 0 && (
                <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-emerald-300 mb-2">Benefits</h4>
                  <ul className="text-sm text-emerald-200/80 space-y-1">
                    {ui.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-3 h-3 mt-1 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ui.constraints && ui.constraints.length > 0 && (
                <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-amber-300 mb-2">Constraints</h4>
                  <ul className="text-sm text-amber-200/80 space-y-1">
                    {ui.constraints.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertCircle className="w-3 h-3 mt-1 flex-shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Collapsible section component
const CollapsibleSection = ({ title, icon: Icon, expanded, onToggle, children }) => (
  <div className="bg-slate-800/50 rounded-lg overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-white">{title}</span>
      </div>
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-slate-400" />
      ) : (
        <ChevronRight className="w-4 h-4 text-slate-400" />
      )}
    </button>
    {expanded && (
      <div className="px-4 pb-4">
        {children}
      </div>
    )}
  </div>
);

// Capability badge component
const CapabilityBadge = ({ capability }) => {
  const icons = {
    ingest: FileInput,
    transform: Zap,
    query: Database,
    search: Search,
    validate: CheckCircle,
  };
  const Icon = icons[capability] || Zap;

  return (
    <span className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-xs">
      <Icon className="w-3 h-3" />
      {capability}
    </span>
  );
};

// Source link component
const SourceLink = ({ icon: Icon, label, url }) => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors group"
  >
    <Icon className="w-4 h-4 text-slate-400" />
    <span className="text-sm text-slate-300 flex-1">{label}</span>
    <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
  </a>
);

export default StrategyDetailPanel;
