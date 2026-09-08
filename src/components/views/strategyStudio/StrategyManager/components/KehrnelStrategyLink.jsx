// src/components/views/strategyStudio/StrategyManager/components/KehrnelStrategyLink.jsx
"use client";

import React, { useState, useEffect } from 'react';
import {
  Link2,
  Unlink,
  ExternalLink,
  FileCode,
  BookOpen,
  FolderOpen,
  CheckCircle,
  XCircle,
  RefreshCw,
  Server,
  GitBranch,
  Package
} from 'lucide-react';

/**
 * KehrnelStrategyLink - Visual representation of the connection between
 * a Strategy Studio strategy and its Kehrnel implementation.
 *
 * Shows:
 * - Connection status (connected/disconnected)
 * - Source code links (strategy file, docs, shared libs)
 * - Version and maturity info
 * - Quick health check
 */
const KehrnelStrategyLink = ({
  strategy,
  kehrnelInstance,
  onRefresh
}) => {
  const [healthStatus, setHealthStatus] = useState('unknown');
  const [checking, setChecking] = useState(false);

  const manifest = strategy?.kehrnelManifest;
  const kehrnelId = strategy?.kehrnelId || manifest?.id;
  const isConnected = !!manifest;

  // Source configuration - from manifest or instance config
  const sourceConfig = manifest?.source || strategy?.source || {};
  const githubConfig = kehrnelInstance?.github || {
    repo: 'mongodb-industry-solutions/kehrnel',
    branch: 'main',
    baseUrl: 'https://github.com/mongodb-industry-solutions/kehrnel/blob/main'
  };

  // Build GitHub URLs for source files
  const buildGitHubUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${githubConfig.baseUrl}/${path}`;
  };

  // Extract source paths from manifest - prioritize ui.links from Kehrnel manifest
  const uiLinks = manifest?.ui?.links || {};
  const sourcePaths = {
    main: uiLinks.source || sourceConfig.path || manifest?.entrypoint?.split(':')[0]?.replace(/\./g, '/') + '.py',
    docs: uiLinks.docs || sourceConfig.docs,
    libs: uiLinks.libs ? [uiLinks.libs] : sourceConfig.libs || [],
    // Additional component links from manifest
    flattener: uiLinks.flattener,
    remap: uiLinks.remap,
  };

  // Check Kehrnel health
  const checkHealth = async () => {
    if (!kehrnelInstance?.url) {
      setHealthStatus('unknown');
      return;
    }

    setChecking(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      // Use proxy to avoid CORS issues
      const res = await fetch(`/api/kehrnel/health?url=${encodeURIComponent(kehrnelInstance.url)}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => ({}));

      setHealthStatus(data.healthy ? 'healthy' : 'unhealthy');
    } catch {
      setHealthStatus('unhealthy');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (kehrnelInstance?.url) {
      checkHealth();
    }
  }, [kehrnelInstance?.url]);

  const healthColors = {
    healthy: 'text-emerald-400',
    unhealthy: 'text-red-400',
    unknown: 'text-slate-500'
  };

  // Show different labels based on both server health AND strategy link status
  const getStatusLabel = () => {
    if (!kehrnelId) {
      // Strategy not linked to Kehrnel
      return healthStatus === 'healthy' ? 'Server Online' : 'Not Linked';
    }
    // Strategy is linked
    if (healthStatus === 'healthy') return 'Linked';
    if (healthStatus === 'unhealthy') return 'Disconnected';
    return 'Unknown';
  };

  const getStatusStyle = () => {
    if (!kehrnelId) {
      return healthStatus === 'healthy'
        ? 'bg-blue-600/30 text-blue-300'  // Server online but not linked
        : 'bg-slate-700 text-slate-400';
    }
    if (healthStatus === 'healthy') return 'bg-emerald-600/30 text-emerald-300';
    if (healthStatus === 'unhealthy') return 'bg-red-600/30 text-red-300';
    return 'bg-slate-700 text-slate-400';
  };

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${
      isConnected && healthStatus === 'healthy'
        ? 'bg-gradient-to-br from-emerald-900/20 via-slate-900/40 to-slate-900/60 border-emerald-600/40'
        : isConnected
        ? 'bg-gradient-to-br from-amber-900/20 via-slate-900/40 to-slate-900/60 border-amber-600/40'
        : 'bg-gradient-to-br from-slate-900/40 to-slate-800/40 border-slate-600/40'
    }`}>

      {/* Connection Header */}
      <div className="p-5 border-b border-slate-700/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Connection Visual */}
            <div className="flex items-center gap-2">
              {/* Local Strategy Icon */}
              <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-400" />
              </div>

              {/* Connection Line */}
              <div className="flex items-center gap-1">
                <div className={`w-8 h-0.5 ${isConnected ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                {isConnected ? (
                  <Link2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Unlink className="w-4 h-4 text-slate-500" />
                )}
                <div className={`w-8 h-0.5 ${isConnected ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              </div>

              {/* Kehrnel Icon */}
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                isConnected
                  ? 'bg-emerald-900/30 border border-emerald-600/50'
                  : 'bg-slate-800 border border-slate-600'
              }`}>
                <Server className={`w-6 h-6 ${isConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
              </div>
            </div>

            {/* Connection Info */}
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                Kehrnel Connection
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusStyle()}`}>
                  {getStatusLabel()}
                </span>
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <code className="text-sm text-blue-400 font-mono">{kehrnelId || 'Not linked'}</code>
                {kehrnelInstance?.url && (
                  <span className="text-xs text-slate-500">→ {kehrnelInstance.url}</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { checkHealth(); onRefresh?.(); }}
              disabled={checking}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh connection"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Version & Maturity */}
        {isConnected && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-700/50">
            {manifest?.version && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Version</span>
                <span className="text-sm font-semibold text-white">{manifest.version}</span>
              </div>
            )}
            {manifest?.maturity && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Status</span>
                <span className={`text-sm font-semibold capitalize ${
                  manifest.maturity === 'published' ? 'text-emerald-400' :
                  manifest.maturity === 'development' ? 'text-blue-400' :
                  manifest.maturity === 'preview' ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {manifest.maturity}
                </span>
              </div>
            )}
            {manifest?.license && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">License</span>
                <span className="text-sm text-slate-300">{manifest.license}</span>
              </div>
            )}
            {manifest?.protocols?.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Protocols</span>
                <span className="text-sm text-slate-300">{manifest.protocols.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Source Implementation */}
      {isConnected && (
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Source Implementation</span>
            <a
              href={`https://github.com/${githubConfig.repo}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <GitBranch className="w-3 h-3" />
              {githubConfig.repo}
            </a>
          </div>

          <div className="space-y-2">
            {/* Main Strategy File */}
            {sourcePaths.main && (
              <SourceLink
                icon={FileCode}
                label="Strategy Implementation"
                path={sourcePaths.main}
                url={buildGitHubUrl(sourcePaths.main)}
                color="blue"
              />
            )}

            {/* Documentation */}
            {sourcePaths.docs && (
              <SourceLink
                icon={BookOpen}
                label="Documentation"
                path={sourcePaths.docs}
                url={buildGitHubUrl(sourcePaths.docs)}
                color="emerald"
              />
            )}

            {/* Shared Libraries */}
            {sourcePaths.libs?.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-2">Shared Libraries</div>
                <div className="space-y-1 pl-2 border-l-2 border-slate-700">
                  {sourcePaths.libs.map((lib, idx) => (
                    <SourceLink
                      key={idx}
                      icon={Package}
                      label={lib.split('/').pop()}
                      path={lib}
                      url={buildGitHubUrl(lib)}
                      color="purple"
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Component Files (Flattener, Remap, etc.) */}
            {(sourcePaths.flattener || sourcePaths.remap) && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-2">Components</div>
                <div className="space-y-1 pl-2 border-l-2 border-amber-700/50">
                  {sourcePaths.flattener && (
                    <SourceLink
                      icon={FileCode}
                      label="Flattener"
                      path={sourcePaths.flattener}
                      url={buildGitHubUrl(sourcePaths.flattener)}
                      color="amber"
                      compact
                    />
                  )}
                  {sourcePaths.remap && (
                    <SourceLink
                      icon={FileCode}
                      label="Remap Module"
                      path={sourcePaths.remap}
                      url={buildGitHubUrl(sourcePaths.remap)}
                      color="amber"
                      compact
                    />
                  )}
                </div>
              </div>
            )}

            {/* Entrypoint */}
            {manifest?.entrypoint && (
              <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-500 mb-1">Entrypoint</div>
                <code className="text-sm text-purple-400 font-mono">{manifest.entrypoint}</code>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Not Connected State */}
      {!isConnected && strategy?.kehrnelId && (
        <div className="p-5">
          <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Unlink className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-200 font-medium">Strategy Not Found in Kehrnel</p>
                <p className="text-xs text-amber-300/70 mt-1">
                  Expected Kehrnel ID: <code className="font-mono">{strategy.kehrnelId}</code>
                </p>
                <p className="text-xs text-amber-300/70 mt-1">
                  Make sure Kehrnel is running and the strategy is registered.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * SourceLink - Individual source file link component
 */
const SourceLink = ({ icon: Icon, label, path, url, color = 'blue', compact = false }) => {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-900/20 border-blue-700/30',
    emerald: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/30',
    purple: 'text-purple-400 bg-purple-900/20 border-purple-700/30',
    amber: 'text-amber-400 bg-amber-900/20 border-amber-700/30',
  };

  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors group py-1"
      >
        <Icon className={`w-3 h-3 ${colorClasses[color].split(' ')[0]}`} />
        <span className="font-mono">{path}</span>
        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:border-opacity-60 group ${colorClasses[color]}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-slate-400 font-mono truncate">{path}</div>
      </div>
      <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors flex-shrink-0" />
    </a>
  );
};

export default KehrnelStrategyLink;
