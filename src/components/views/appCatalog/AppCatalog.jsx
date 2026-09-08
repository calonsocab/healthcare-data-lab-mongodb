// src/components/views/appCatalog/AppCatalog.jsx
"use client";

import React, { useState, useMemo } from 'react';
import {
  Grid3X3, Search, CheckCircle2, ExternalLink, Github,
  FileEdit, GitMerge, BarChart3, Edit, BarChart2,
  ChevronRight, ArrowLeft, Copy, Check, AlertTriangle,
  Package, Terminal, Layers, Filter
} from 'lucide-react';
import { useTheme } from '../layout/ThemedLayout';
import { useInstalledApps } from '@/hooks/useInstalledApps';
import appRegistryConfig from '@/config/appRegistry.json';

const { apps, categories } = appRegistryConfig;

// Icon mapping
const iconMap = {
  FileEdit,
  GitMerge,
  BarChart3,
  Edit,
  BarChart2,
  Grid3X3
};

const getIcon = (iconName) => iconMap[iconName] || Grid3X3;

// Domain configuration for consistent styling
const DOMAIN_CONFIG = {
  openEHR: { name: 'openEHR®', color: '#00a99d' },
  FHIR: { name: 'FHIR®', color: '#e44e37' },
  ContextObjects: { name: 'ContextObjects', color: '#00ED64' },
  Genomics: { name: 'Genomics', color: '#6c5ce7' }
};

// Data Model Chip Component
const DataModelChip = ({ protocol, size = 'md' }) => {
  const config = DOMAIN_CONFIG[protocol] || { name: protocol, color: '#64748b' };

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[9px]',
    md: 'px-2 py-0.5 text-[10px]',
    lg: 'px-2.5 py-1 text-xs'
  };

  return (
    <span
      className={`${sizeClasses[size]} rounded font-medium whitespace-nowrap`}
      style={{
        backgroundColor: `${config.color}20`,
        color: config.color,
        border: `1px solid ${config.color}40`
      }}
      title={config.name}
    >
      {config.name}
    </span>
  );
};

// Publisher Logo Component
const PublisherLogo = ({ publisher, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  if (publisher === 'MongoDB') {
    return (
      <div className={`${sizeClasses[size]} flex items-center justify-center`} title="MongoDB">
        <svg viewBox="0 0 24 24" className="w-full h-full">
          <path fill="#00ED64" d="M12.5 2c-.3.5-.6 1-1 1.4-.8.9-1.6 1.7-2.3 2.6-2 2.4-3.5 5-4 8.1-.3 2 .1 3.9 1 5.7.2.4.5.8.8 1.2.1.1.2.2.4.1.1 0 .2-.1.2-.2v-2.8c0-.3.1-.5.4-.6.2-.1.5 0 .6.2l.3.5c.3.5.6 1 1.1 1.3.3.2.6.3.9.2.3 0 .5-.2.6-.5.1-.4.2-.8.2-1.2v-1.5c0-.2.1-.4.3-.4.2-.1.4 0 .5.2.3.5.5 1.1.6 1.7.1.5.1 1 0 1.5-.1.4-.3.8-.6 1-.5.4-1.1.5-1.7.4-.7-.2-1.3-.6-1.8-1.1l-.3-.3v.8c0 .5-.1 1-.3 1.5-.2.5-.6.9-1.1 1-.4.1-.8 0-1.2-.2-.9-.5-1.5-1.2-2-2-.8-1.3-1.2-2.7-1.3-4.2-.1-2 .3-3.8 1.2-5.5.9-1.7 2-3.2 3.3-4.5.7-.7 1.4-1.3 2.2-1.9.2-.1.3-.3.5-.4l.3-.3z"/>
        </svg>
      </div>
    );
  }

  if (publisher === 'TapData') {
    return (
      <div className={`${sizeClasses[size]} rounded bg-blue-500/20 flex items-center justify-center font-bold text-blue-400 text-[8px]`} title="TapData">
        TD
      </div>
    );
  }

  // Default publisher icon
  return (
    <div className={`${sizeClasses[size]} rounded bg-slate-500/20 flex items-center justify-center`} title={publisher}>
      <span className="text-[8px] font-bold text-slate-400">
        {publisher.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
};

const AppCatalog = ({ onNavigate, activeEnvironment }) => {
  const { theme } = useTheme();
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProtocol, setSelectedProtocol] = useState('all');
  const [showCompatibleOnly, setShowCompatibleOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedStep, setCopiedStep] = useState(null);

  const {
    isInstalled,
    markInstalled,
    markUninstalled,
    getInstalledCount
  } = useInstalledApps();

  // Get active strategy from environment (with name)
  const activeStrategy = useMemo(() => {
    if (!activeEnvironment?.strategyLinks?.length) return null;
    const link = activeEnvironment.strategyLinks.find(l => l.strategyId);
    if (!link) return null;
    return {
      id: link.strategyId,
      name: link.strategyName || link.strategyId,
      protocol: link.domain || 'openEHR'
    };
  }, [activeEnvironment]);

  // Get unique protocols from apps
  const protocols = useMemo(() => {
    const uniqueProtocols = [...new Set(apps.map(app => app.compatibility.protocol))];
    return uniqueProtocols.sort();
  }, []);

  // Filter apps
  const filteredApps = useMemo(() => {
    return apps.filter(app => {
      // Category filter
      if (selectedCategory !== 'all' && app.category !== selectedCategory) {
        return false;
      }

      // Protocol/Data Model filter
      if (selectedProtocol !== 'all' && app.compatibility.protocol !== selectedProtocol) {
        return false;
      }

      // Compatible only filter
      if (showCompatibleOnly && activeStrategy) {
        const isCompat = app.compatibility.strategyIds.includes('all') ||
          app.compatibility.strategyIds.some(id =>
            activeStrategy.id.toLowerCase().includes(id.replace('_', '-').toLowerCase()) ||
            id.toLowerCase().includes(activeStrategy.id.replace('_', '-').toLowerCase())
          );
        if (!isCompat) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = app.name.toLowerCase().includes(query);
        const matchesDesc = app.description.toLowerCase().includes(query);
        const matchesPublisher = app.publisher.toLowerCase().includes(query);
        const matchesProtocol = app.compatibility.protocol.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesPublisher && !matchesProtocol) {
          return false;
        }
      }

      return true;
    });
  }, [selectedCategory, selectedProtocol, showCompatibleOnly, searchQuery, activeStrategy]);

  // Check strategy compatibility
  const isCompatible = (app) => {
    if (!activeStrategy) return true; // No strategy = show all
    if (app.compatibility.strategyIds.includes('all')) return true;
    return app.compatibility.strategyIds.some(id =>
      activeStrategy.id.toLowerCase().includes(id.replace('_', '-').toLowerCase()) ||
      id.toLowerCase().includes(activeStrategy.id.replace('_', '-').toLowerCase())
    );
  };

  // Copy to clipboard
  const copyToClipboard = (text, stepIndex) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepIndex);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  // App List View
  if (!selectedApp) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Grid3X3 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-theme-primary">App Catalog</h1>
              <p className="text-theme-secondary">Discover apps compatible with your data strategy</p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-3 mt-4 text-sm">
            <span className="text-theme-secondary">{apps.length} apps available</span>
            <span className="text-theme-secondary/30">•</span>
            <span className="text-theme-secondary">{getInstalledCount()} installed</span>
          </div>
        </div>

        {/* Active Strategy Banner */}
        {activeStrategy && (
          <div className="mb-6 p-4 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-theme-secondary">Active Strategy</p>
                  <p className="font-semibold text-theme-primary">{activeStrategy.name}</p>
                </div>
                <DataModelChip protocol={activeStrategy.protocol} size="md" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCompatibleOnly}
                  onChange={(e) => setShowCompatibleOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-theme text-primary focus:ring-primary"
                />
                <span className="text-sm text-theme-secondary">Show compatible only</span>
              </label>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-secondary" />
            <input
              type="text"
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-theme surface text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Data Model Filter */}
          <div className="flex items-center gap-1 border border-theme rounded-lg p-1">
            <button
              onClick={() => setSelectedProtocol('all')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedProtocol === 'all'
                  ? 'bg-primary text-white'
                  : 'text-theme-primary hover:bg-theme-secondary/10'
              }`}
            >
              All Models
            </button>
            {protocols.map(protocol => (
              <button
                key={protocol}
                onClick={() => setSelectedProtocol(protocol)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${
                  selectedProtocol === protocol
                    ? 'bg-primary text-white'
                    : 'text-theme-primary hover:bg-theme-secondary/10'
                }`}
              >
                <DataModelChip protocol={protocol} size="sm" />
                {protocol}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 border border-theme rounded-lg p-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-primary text-white'
                  : 'text-theme-primary hover:bg-theme-secondary/10'
              }`}
            >
              All Categories
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-white'
                    : 'text-theme-primary hover:bg-theme-secondary/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* App Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => {
            const IconComponent = getIcon(app.icon);
            const installed = isInstalled(app.id);
            const compatible = isCompatible(app);

            return (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={`text-left p-5 rounded-xl border transition-all group ${
                  !compatible
                    ? 'border-theme/50 opacity-60'
                    : 'border-theme hover:border-primary/50'
                } surface`}
              >
                {/* Header with icon and name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    app.status === 'stable' ? 'bg-emerald-500/10' :
                    app.status === 'beta' ? 'bg-blue-500/10' :
                    'bg-amber-500/10'
                  }`}>
                    <IconComponent className={`w-5 h-5 ${
                      app.status === 'stable' ? 'text-emerald-400' :
                      app.status === 'beta' ? 'text-blue-400' :
                      'text-amber-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-theme-primary group-hover:text-primary truncate">
                        {app.name}
                      </h3>
                      {installed && (
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                      )}
                    </div>
                    {/* Publisher with logo */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PublisherLogo publisher={app.publisher} size="sm" />
                      <span className="text-xs text-theme-secondary">{app.publisher}</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-theme-secondary line-clamp-2 mb-3">
                  {app.description}
                </p>

                {/* Footer with badges */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Data Model badge */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-theme-secondary/10">
                      <DataModelChip protocol={app.compatibility.protocol} size="sm" />
                      <span className="text-xs text-theme-secondary">{app.compatibility.protocol}</span>
                    </div>
                    {/* Status badge */}
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      app.status === 'stable' ? 'bg-green-900/30 text-green-400' :
                      app.status === 'beta' ? 'bg-blue-900/30 text-blue-400' :
                      'bg-amber-900/30 text-amber-400'
                    }`}>
                      {app.status}
                    </span>
                  </div>
                  {/* Compatibility indicator */}
                  {activeStrategy && (
                    compatible ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" title="Compatible with your strategy" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" title="Not compatible with your strategy" />
                    )
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {filteredApps.length === 0 && (
          <div className="text-center py-12 text-theme-secondary">
            <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No apps found matching your criteria</p>
          </div>
        )}
      </div>
    );
  }

  // App Detail View
  const IconComponent = getIcon(selectedApp.icon);
  const installed = isInstalled(selectedApp.id);
  const compatible = isCompatible(selectedApp);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => setSelectedApp(null)}
        className="flex items-center gap-2 text-sm text-theme-secondary hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to catalog
      </button>

      {/* App Header */}
      <div className="rounded-xl border border-theme surface p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${
            selectedApp.status === 'stable' ? 'bg-emerald-500/10' :
            selectedApp.status === 'beta' ? 'bg-blue-500/10' :
            'bg-amber-500/10'
          }`}>
            <IconComponent className={`w-8 h-8 ${
              selectedApp.status === 'stable' ? 'text-emerald-400' :
              selectedApp.status === 'beta' ? 'text-blue-400' :
              'text-amber-400'
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-theme-primary">{selectedApp.name}</h1>
              {installed && (
                <span className="px-2 py-0.5 text-xs rounded bg-success/20 text-success flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Installed
                </span>
              )}
            </div>
            {/* Publisher with logo */}
            <div className="flex items-center gap-2 mb-2">
              <PublisherLogo publisher={selectedApp.publisher} size="md" />
              <span className="text-sm text-theme-secondary">{selectedApp.publisher}</span>
              <span className="text-theme-secondary/50">·</span>
              <span className="text-sm text-theme-secondary">v{selectedApp.version}</span>
            </div>
            <p className="text-theme-secondary">{selectedApp.description}</p>

            {/* Status badges */}
            <div className="flex items-center gap-2 mt-4">
              {/* Data Model */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-theme-secondary/10 border border-theme">
                <DataModelChip protocol={selectedApp.compatibility.protocol} size="md" />
                <span className="text-sm text-theme-primary">{selectedApp.compatibility.protocol}</span>
              </div>
              {/* Status */}
              <span className={`px-2.5 py-1 text-sm rounded-lg ${
                selectedApp.status === 'stable' ? 'bg-green-900/30 text-green-400' :
                selectedApp.status === 'beta' ? 'bg-blue-900/30 text-blue-400' :
                'bg-amber-900/30 text-amber-400'
              }`}>
                {selectedApp.status}
              </span>
              {/* Compatibility */}
              {activeStrategy && (
                compatible ? (
                  <span className="px-2.5 py-1 text-sm rounded-lg bg-green-900/30 text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Compatible with {activeStrategy.name}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-sm rounded-lg bg-red-900/30 text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Not compatible with {activeStrategy.name}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {selectedApp.links?.repo && (
              <a
                href={selectedApp.links.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Github className="w-4 h-4" />
                View Repo
              </a>
            )}
            {installed ? (
              <button
                onClick={() => markUninstalled(selectedApp.id)}
                className="px-4 py-2 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            ) : (
              <button
                onClick={() => markInstalled(selectedApp.id)}
                className="px-4 py-2 border border-theme text-theme-primary rounded-lg hover:bg-theme-secondary/10 transition-colors"
              >
                Mark Installed
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {selectedApp.warnings?.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Important Notes</span>
          </div>
          <ul className="list-disc list-inside text-sm text-amber-300 space-y-1">
            {selectedApp.warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Features */}
      {selectedApp.features?.length > 0 && (
        <div className="rounded-xl border border-theme surface p-6 mb-6">
          <h2 className="font-semibold text-theme-primary mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Features
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {selectedApp.features.map((feature, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-theme-secondary">
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Installation */}
      {selectedApp.install && (
        <div className="rounded-xl border border-theme surface p-6 mb-6">
          <h2 className="font-semibold text-theme-primary mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Installation ({selectedApp.install.method})
          </h2>
          <div className="space-y-2">
            {selectedApp.install.quickstart.map((step, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-3 rounded-lg bg-slate-800 font-mono text-sm"
              >
                <span className="text-theme-secondary">{idx + 1}.</span>
                <code className="flex-1 text-theme-primary">{step}</code>
                <button
                  onClick={() => copyToClipboard(step, idx)}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                  title="Copy"
                >
                  {copiedStep === idx ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4 text-theme-secondary" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compatibility */}
      <div className="rounded-xl border border-theme surface p-6">
        <h2 className="font-semibold text-theme-primary mb-4">Compatibility</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-theme-secondary">Protocol</span>
            <span className="text-theme-primary">{selectedApp.compatibility.protocol}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-theme-secondary">Compatible Strategies</span>
            <span className="text-theme-primary">
              {selectedApp.compatibility.strategyIds.join(', ')}
            </span>
          </div>
          {selectedApp.compatibility.requires?.models && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-theme-secondary">Requires</span>
              <span className="text-theme-primary">
                {selectedApp.compatibility.requires.models.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppCatalog;
