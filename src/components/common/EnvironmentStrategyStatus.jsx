// src/components/common/EnvironmentStrategyStatus.jsx
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  Server,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle2,
  XCircle,
  Circle,
  FlaskConical,
  Loader2
} from 'lucide-react';
import { getPublicKehrnelBaseUrl } from '@/lib/kehrnel/url';

/**
 * Thin, expandable status bar showing:
 * - Active environment
 * - Active strategies per protocol (openEHR, FHIR, etc.)
 * - Kehrnel connectivity status
 * - Quick links when expanded
 */
const EnvironmentStrategyStatus = ({
  activeEnvironment,
  context = 'query',
  selectedBindingId = null,
  compact = false,
  onNavigate
}) => {
  const [expanded, setExpanded] = useState(false);
  const [kehrnelStatus, setKehrnelStatus] = useState({ reachable: null, checking: true });
  const [generationJob, setGenerationJob] = useState(null);
  const kehrnelDisplayUrl = process.env.NEXT_PUBLIC_BACKEND_URL || getPublicKehrnelBaseUrl() || 'Not configured';

  // Check Kehrnel connectivity via Next.js API proxy
  // This avoids CORS and mixed content issues (HTTPS frontend -> HTTP internal service)
  useEffect(() => {
    const checkKehrnel = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch('/api/healthz', {
          signal: controller.signal,
          method: 'GET'
        });

        clearTimeout(timeoutId);

        const data = await res.json().catch(() => ({}));

        if (data.healthy) {
          setKehrnelStatus({ reachable: true, checking: false, error: null });
        } else {
          setKehrnelStatus({
            reachable: false,
            checking: false,
            error: data.error || 'Kehrnel not reachable'
          });
        }
      } catch (err) {
        let errorMessage = 'Unable to connect to Kehrnel';
        if (err.name === 'AbortError') {
          errorMessage = 'Connection timed out';
        } else if (err.message) {
          errorMessage = err.message;
        }
        setKehrnelStatus({ reachable: false, checking: false, error: errorMessage });
      }
    };

    checkKehrnel();
    const interval = setInterval(checkKehrnel, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  // Poll for active synthetic data generation jobs
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const checkActiveJobs = async () => {
      try {
        const headers = activeEnvironment?.id ? { 'x-active-env': activeEnvironment.id } : undefined;
        const res = await fetch('/api/synthetic-data/active-job', { headers });
        if (!res.ok) {
          setGenerationJob(null);
          return false;
        }

        const data = await res.json();
        const job = data?.job || null;
        const rawStatus = String(job?.rawStatus || job?.status || '').toLowerCase();
        const active = rawStatus === 'queued' || rawStatus === 'running' || rawStatus === 'canceling';
        setGenerationJob(active ? job : null);
        return active;
      } catch {
        setGenerationJob(null);
        return false;
      }
    };

    const loop = async () => {
      if (cancelled) return;
      const active = await checkActiveJobs();
      const nextMs = active ? 3000 : 30000;
      if (!cancelled) {
        timer = setTimeout(loop, nextMs);
      }
    };

    loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeEnvironment?.id]);

  // Get strategy links - prefer those matching the current context, but fall back to any active strategy
  const strategyLinks = useMemo(() => {
    const allLinks = activeEnvironment?.strategyLinks || [];
    // First try to get links that match the current context
    const contextMatched = allLinks.filter(link => link.contexts?.[context]);
    // If no context-specific links, return all links (strategy should show regardless of context)
    return contextMatched.length > 0 ? contextMatched : allLinks;
  }, [activeEnvironment, context]);

  const matchedLink = useMemo(() => {
    if (selectedBindingId) {
      const byBinding = strategyLinks.find(link => link.id === selectedBindingId);
      if (byBinding) return byBinding;
    }
    return strategyLinks[0] || null;
  }, [strategyLinks, selectedBindingId]);

  const handleNavigate = (page) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  if (compact) {
    return (
      <div className="px-3 py-2 flex flex-col gap-1">
        {activeEnvironment && (
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-[11px] text-theme-secondary">Environment:</span>
            <span className="text-[11px] font-medium text-theme-primary truncate">
              {activeEnvironment.name}
            </span>
          </div>
        )}
      </div>
    );
  }

  const StatusIndicator = ({ status }) => {
    if (status.checking) {
      return <Circle className="w-3.5 h-3.5 text-theme-secondary animate-pulse" />;
    }
    return status.reachable ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
    ) : (
      <XCircle className="w-3.5 h-3.5 text-error" />
    );
  };

  // Get protocol color
  const getProtocolColor = (protocol) => {
    switch (protocol?.toLowerCase()) {
      case 'openehr':
        return 'bg-teal-900/40 border-teal-600/50 text-teal-300';
      case 'fhir':
        return 'bg-red-900/40 border-red-600/50 text-red-300';
      case 'genomics':
        return 'bg-purple-900/40 border-purple-600/50 text-purple-300';
      default:
        return 'bg-surface-hover border-theme text-theme-secondary';
    }
  };

  return (
    <div className="rounded-lg overflow-hidden bg-gradient-to-r from-surface/80 to-surface/40 border border-theme/50">
      {/* Collapsed View - Thin single-line bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-5 flex-1">
          {/* Environment Badge - Inline */}
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-theme-muted">Environment</span>
            <span className="text-sm font-semibold text-theme-primary">
              {activeEnvironment?.name || 'None'}
            </span>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-theme/50" />

          {/* Active Strategy Badge - Inline */}
          <div className="flex items-center gap-2 flex-1">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-theme-muted">Strategy</span>
            {matchedLink ? (
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${getProtocolColor('openEHR')}`}>
                  openEHR®
                </span>
                <span className="text-sm font-medium text-theme-primary">
                  {matchedLink.alias || matchedLink.strategyName || 'Linked strategy'}
                </span>
              </div>
            ) : (
              <span className="text-sm text-theme-secondary italic">None active</span>
            )}
          </div>

          {/* Warnings - Inline */}
          {!matchedLink && (
            <>
              <div className="h-5 w-px bg-theme/50" />
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-warning/20 border border-warning/30">
                <AlertTriangle className="w-3 h-3 text-warning" />
                <span className="text-[11px] font-medium text-warning">No strategy active</span>
              </div>
            </>
          )}

          {/* Generation Status - Inline */}
          {generationJob && (
            <>
              <div className="h-5 w-px bg-theme/50" />
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-pink-900/30 border border-pink-600/40 animate-pulse">
                <FlaskConical className="w-3.5 h-3.5 text-pink-400" />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-pink-300">Generating</span>
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 text-pink-400 animate-spin" />
                    <span className="text-xs font-bold text-pink-200">
                      {generationJob.progress || 0}%
                    </span>
                  </div>
                  <span className="text-[10px] text-pink-400/70">
                    {generationJob.patientsCreated || 0}/{generationJob.totalPatients || '?'} patients
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Kehrnel Status - Compact pill on right */}
        <div className="flex items-center gap-3 ml-4">
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded-md transition-colors ${
              kehrnelStatus.reachable
                ? 'bg-success/20 border border-success/30'
                : kehrnelStatus.checking
                  ? 'bg-surface/50 border border-theme/50'
                  : 'bg-error/20 border border-error/30'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
          >
            <Zap className={`w-3 h-3 ${
              kehrnelStatus.reachable
                ? 'text-success'
                : kehrnelStatus.checking
                  ? 'text-theme-secondary'
                  : 'text-error'
            }`} />
            <span className="text-[10px] uppercase tracking-wider text-theme-muted">Kehrnel Engine</span>
            <StatusIndicator status={kehrnelStatus} />
            <span className={`text-xs font-medium ${
              kehrnelStatus.reachable
                ? 'text-success'
                : kehrnelStatus.checking
                  ? 'text-theme-secondary'
                  : 'text-error'
            }`}>
              {kehrnelStatus.checking ? 'Checking...' : kehrnelStatus.reachable ? 'Connected' : 'Failed'}
            </span>
          </div>

          {/* Expand/Collapse */}
          <div className="p-1 rounded hover:bg-surface-hover transition-colors">
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-theme-secondary" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-theme-secondary" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded View - Detailed info and links */}
      {expanded && (
        <div className="px-5 py-4 border-t border-theme/50 bg-background/30">
          <div className="grid grid-cols-3 gap-6">
            {/* Environment Details */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-theme-secondary flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-primary" />
                Environment Details
              </h4>
              <div className="space-y-2 text-sm pl-5">
                <div className="flex items-center gap-2">
                  <span className="text-theme-muted">Name:</span>
                  <span className="text-theme-primary font-medium">
                    {activeEnvironment?.name || 'Not selected'}
                  </span>
                </div>
                {matchedLink && (
                  <div className="flex items-center gap-2">
                    <span className="text-theme-muted">Link:</span>
                    <span className="text-theme-secondary">
                      {matchedLink.alias || matchedLink.strategyName}
                    </span>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigate('environments');
                  }}
                  className="mt-2 text-xs text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors font-medium"
                >
                  <Database className="w-3 h-3" />
                  Change Environment
                </button>
              </div>
            </div>

            {/* Strategy Details */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-theme-secondary flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                Active Strategies
              </h4>
              {matchedLink ? (
                <div className="space-y-2 pl-5">
                  <div className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${getProtocolColor('openEHR')}`}>
                        openEHR®
                      </span>
                      <span className="text-theme-primary font-medium">
                        {matchedLink.alias || matchedLink.strategyName || 'Linked strategy'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNavigate('strategies');
                    }}
                    className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors font-medium"
                  >
                    <Server className="w-3 h-3" />
                    Manage Strategies
                  </button>
                </div>
              ) : (
                <div className="pl-5">
                  <p className="text-sm text-theme-muted italic mb-2">No strategies active</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNavigate('strategies');
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors font-medium"
                  >
                    <Server className="w-3 h-3" />
                    Select Strategy
                  </button>
                </div>
              )}
            </div>

            {/* Kehrnel Status Details */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-theme-secondary flex items-center gap-2">
                <Zap className={`w-3.5 h-3.5 ${kehrnelStatus.reachable ? 'text-success' : 'text-error'}`} />
                Kehrnel Transform Engine
              </h4>
              <div className="space-y-3 pl-5">
                <div className="flex items-center gap-2 text-sm">
                  <StatusIndicator status={kehrnelStatus} />
                  <span className={kehrnelStatus.reachable ? 'text-success font-medium' : 'text-error font-medium'}>
                    {kehrnelStatus.checking
                      ? 'Checking connectivity...'
                      : kehrnelStatus.reachable
                        ? 'Connected'
                        : 'Connection Failed'}
                  </span>
                </div>

                {/* Connection URL */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-theme-muted">Endpoint:</span>
                  <span className="text-xs text-theme-secondary font-mono bg-surface/50 px-2 py-1 rounded">
                    {kehrnelDisplayUrl}
                  </span>
                </div>

                {/* Error message if connection failed */}
                {!kehrnelStatus.reachable && !kehrnelStatus.checking && kehrnelStatus.error && (
                  <div className="relative overflow-hidden bg-surface/80 border border-theme/20 rounded-lg p-3 mt-2 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-error">
                    <p className="text-xs text-theme-secondary font-medium mb-1">Error Details:</p>
                    <p className="text-xs text-theme-tertiary">{kehrnelStatus.error}</p>
                  </div>
                )}

                {/* Help text when offline */}
                {!kehrnelStatus.reachable && !kehrnelStatus.checking && (
                  <div className="text-xs text-theme-muted mt-2">
                    <p>The Kehrnel transform engine is required for AQL to MQL conversion.</p>
                    <p className="mt-1">Make sure the Python backend is running and accessible.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Warnings */}
          {!matchedLink && (
            <div className="mt-4 relative overflow-hidden flex items-start gap-3 px-4 py-3 rounded-lg bg-surface/80 border border-theme/20 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-warning">
              <AlertTriangle className="w-4 h-4 text-theme-secondary flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="text-sm">
                <div className="font-medium text-theme-primary">No strategy activated</div>
                <div className="mt-1 text-theme-secondary text-xs">
                  No persistence strategy is active for this environment. Go to Strategy Studio to browse and activate a strategy.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnvironmentStrategyStatus;
