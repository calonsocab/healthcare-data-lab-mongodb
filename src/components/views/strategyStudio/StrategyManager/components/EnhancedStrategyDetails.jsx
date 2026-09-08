// src/components/views/strategyStudio/StrategyManager/components/EnhancedStrategyDetails.jsx
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Info, Cog, Database, Code, Check, Zap, Save, RefreshCw, ExternalLink, Terminal, TestTube, Settings, FileJson, FileCode, Layers, BookOpen, ChevronDown, ChevronRight, FlaskConical, X, AlertCircle, UserRound, Share2, Dna, ScanLine, Receipt, Boxes, Puzzle } from 'lucide-react';

// Icon mapping for domain themes (same as StrategyRow)
const DOMAIN_ICONS = {
  UserRound,   // openEHR - patient/EHR persistence
  Share2,      // FHIR - interoperability
  Dna,         // Genomics
  ScanLine,    // DICOM - imaging
  Receipt,     // X12 - claims
  Boxes,       // ContextObjects
  Puzzle       // Custom
};
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/common/Tabs";
import { getStrategyTheme } from '../constants/domainThemes';
import { getPublicKehrnelBaseUrl } from '@/lib/kehrnel/url';

/**
 * Status indicator with popover showing maturity level
 */
const StatusIndicator = ({ status, maturity, message }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Use maturity field (preferred) or fall back to status
  const effectiveStatus = maturity || status || 'preview';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Status configurations with colors and default messages
  const statusConfig = {
    published: {
      label: 'Published',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      defaultMessage: "This strategy is published and ready for production use. It has been tested and validated."
    },
    development: {
      label: 'Development',
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      defaultMessage: "This strategy is under active development. Features may change. Use for testing and feedback."
    },
    preview: {
      label: 'Preview',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      defaultMessage: "This strategy is in preview. It showcases future capabilities. Want to contribute? Join our community!"
    },
  };

  const config = statusConfig[effectiveStatus] || statusConfig.preview;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all hover:scale-105"
        style={{
          backgroundColor: config.bgColor,
          color: config.color,
          borderColor: config.borderColor,
        }}
        title="Click for details"
      >
        <FlaskConical className="w-3.5 h-3.5" />
        {config.label}
      </button>

      {isOpen && (
        <div
          className="absolute z-50 top-full left-0 mt-2 w-80 p-4 rounded-xl bg-slate-800 border border-slate-600 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5" style={{ color: config.color }} />
              <span className="text-base font-medium text-slate-200">{config.label}</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {message || config.defaultMessage}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-700">
            <span className="text-xs text-slate-500">
              Help us build the future of healthcare data interoperability.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
import DictionaryManagerPanel from './DictionaryManagerPanel';
import StrategyAPIExplorer from './StrategyAPIExplorer';
import SchemaConfigForm from './SchemaConfigForm';
import { StrategyModelViewer, DataJourneyViewer, StrategySpecViewer } from './SpecVisualization';

/**
 * Enhanced strategy details view with tabs for Overview (explanation) and Configuration (GUI + JSON)
 *
 * Key concepts (domain-first model):
 * - Strategies come from Kehrnel catalog (domain-first, no blueprint compatibility)
 * - Users ACTIVATE a strategy for their environment (one per domain)
 * - Config customizations are stored as OVERRIDES on the environment link
 * - configOverrides prop contains the diff from the strategy's default config
 * - When editing, changes go to configOverrides (not the strategy itself)
 */
const EnhancedStrategyDetails = ({
  strategy,
  isActive,
  strategyLink = null,
  activeEnv,
  configOverrides = {},
  configChanged = false,
  searchRefresh = null,
  onActivate,
  onConfigChange,
  onSaveConfig,
  onApplySearchRefresh,
  onSyncCatalog,
  activating = false,
  activationProgress = null,
  validatingActivation = false,
  savingConfig = false,
  refreshingSearch = false,
  syncingCatalog = false,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [activationReviewConfirmed, setActivationReviewConfirmed] = useState(false);

  // Full spec state (fetched on-demand from Kehrnel)
  const [fullSpec, setFullSpec] = useState(null);
  const [specLoading, setSpecLoading] = useState(false);
  const [specError, setSpecError] = useState(null);
  const [manifestDocsUrl, setManifestDocsUrl] = useState('');

  // Fetch full spec when strategy changes (for Kehrnel strategies)
  useEffect(() => {
    const kehrnelStrategyId = strategy?.kehrnelId || strategy?.kehrnel?.strategyId || strategy?.id;
    const isLikelyObjectId = typeof kehrnelStrategyId === 'string' && /^[0-9a-f]{24}$/i.test(kehrnelStrategyId);
    const shouldFetchSpec = strategy?.source === 'kehrnel'
      && !!kehrnelStrategyId
      && !strategy?._offline
      && !(isLikelyObjectId && !strategy?.kehrnelId && !strategy?.kehrnel?.strategyId);

    if (!shouldFetchSpec) {
      setFullSpec(null);
      return;
    }

    async function fetchSpec() {
      setSpecLoading(true);
      setSpecError(null);
      try {
        const params = new URLSearchParams();
        if (activeEnv?.kehrnel?.connectionId) {
          params.set('connectionId', activeEnv.kehrnel.connectionId);
        }
        const url = `/api/kehrnel/strategies/${encodeURIComponent(kehrnelStrategyId)}/spec${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch spec (${res.status})`);
        }
        const data = await res.json();
        setFullSpec(data.spec);
      } catch (err) {
        console.warn('Failed to fetch strategy spec:', err);
        setSpecError(err.message);
        setFullSpec(null);
      } finally {
        setSpecLoading(false);
      }
    }

    fetchSpec();
  }, [
    strategy?.id,
    strategy?.kehrnelId,
    strategy?.kehrnel?.strategyId,
    strategy?.source,
    strategy?._offline,
    activeEnv?.kehrnel?.connectionId
  ]);

  // Fetch docs URL directly from manifest endpoint so UI always reflects Kehrnel manifest.json.
  useEffect(() => {
    const fallbackDocsUrl = String(strategy?.ui?.links?.docs || '');
    setManifestDocsUrl(fallbackDocsUrl);

    const kehrnelStrategyId = strategy?.kehrnelId || strategy?.kehrnel?.strategyId || strategy?.id || '';
    const isLikelyObjectId = typeof kehrnelStrategyId === 'string' && /^[0-9a-f]{24}$/i.test(kehrnelStrategyId);
    const shouldFetchManifest = strategy?.source === 'kehrnel'
      && !!kehrnelStrategyId
      && !strategy?._offline
      && !(isLikelyObjectId && !strategy?.kehrnelId && !strategy?.kehrnel?.strategyId);

    if (!shouldFetchManifest) return undefined;

    let cancelled = false;

    async function fetchManifest() {
      try {
        const params = new URLSearchParams();
        if (activeEnv?.kehrnel?.connectionId) {
          params.set('connectionId', activeEnv.kehrnel.connectionId);
        }
        const url = `/api/kehrnel/strategies/${encodeURIComponent(kehrnelStrategyId)}/manifest${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        const docsUrl = String(data?.docs_url || data?.manifest?.ui?.links?.docs || '');
        if (!cancelled && docsUrl) {
          setManifestDocsUrl(docsUrl);
        }
      } catch (err) {
        console.warn('Failed to fetch strategy manifest docs URL:', err);
      }
    }

    fetchManifest();
    return () => {
      cancelled = true;
    };
  }, [
    strategy?.id,
    strategy?.kehrnelId,
    strategy?.kehrnel?.strategyId,
    strategy?.source,
    strategy?._offline,
    strategy?.ui?.links?.docs,
    activeEnv?.kehrnel?.connectionId
  ]);

  // Domain-first: merge strategy default config with overrides for display
  // Use fullSpec if available, otherwise fall back to strategy fields
  const mergedConfig = useMemo(() => {
    const defaultConfig = fullSpec?.default_config || strategy?.default_config || strategy?.config || {};
    return deepMerge(defaultConfig, configOverrides);
  }, [fullSpec?.default_config, strategy?.default_config, strategy?.config, configOverrides]);

  // Domain-first: get schema directly from strategy (Kehrnel catalog) or fullSpec
  const manifestSchema = fullSpec?.config_schema || strategy.config_schema;
  const manifestDefaultConfig = fullSpec?.default_config || strategy.default_config || strategy?.config || {};

  useEffect(() => {
    setActivationReviewConfirmed(false);
  }, [strategy?.id, activeEnv?.id, isActive, configChanged]);

  if (!strategy) {
    return (
      <div className="p-6 text-slate-400 border border-dashed border-slate-700 rounded-lg">
        Select a strategy to view details.
      </div>
    );
  }

  // Show offline warning if strategy data is limited
  const isOffline = strategy._offline || specError;

  const theme = getStrategyTheme(strategy);
  // Domain-first: use strategy.domain directly (single string)
  const domain = strategy.domain;
  const manifestLinks = strategy.ui?.links || {};
  const manifestVersion = strategy.version;
  const manifestCapabilities = strategy.capabilities || [];
  const isKehrnel = strategy.source === 'kehrnel';
  const kehrnelBaseUrl = getPublicKehrnelBaseUrl();
  const kehrnelStrategyId = getKehrnelStrategyId(strategy);
  const manifestDocumentationHref = resolveManifestDocumentationUrl(
    manifestDocsUrl || manifestLinks?.docs || '',
    { baseUrl: kehrnelBaseUrl, strategyId: kehrnelStrategyId, isKehrnel }
  );
  const refreshSourceName = searchRefresh?.source?.dataModelName || searchRefresh?.source?.templateId || null;
  const refreshJobId = searchRefresh?.jobId || null;
  const refreshJobStatus = searchRefresh?.jobStatus || null;
  const refreshJobActive = ['queued', 'running', 'canceling'].includes(String(refreshJobStatus || '').toLowerCase());
  const refreshJobLabel = refreshJobId
    ? `${refreshJobStatus || 'queued'}: ${String(refreshJobId).slice(0, 8)}`
    : null;
  const coherence = strategyLink?.kehrnel?.coherence || null;
  const workflow = activationProgress || strategyLink?.kehrnel?.activationWorkflow || null;
  const activationStatusLabel = getActivationStatusLabel(coherence?.status, validatingActivation);

  // Allow users to edit configuration while reviewing a strategy before activation.
  // Persisting overrides separately is still reserved for the active strategy.
  const canEditConfig = !!activeEnv && strategy?.maturity === 'published';
  const canSaveConfig = isActive && !!activeEnv;

  return (
    <div className="space-y-6">
      {/* Offline Warning Banner */}
      {isOffline && (
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-4 flex items-start gap-3">
          <div className="w-5 h-5 text-amber-400 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-amber-200">Kehrnel Offline</h4>
            <p className="text-sm text-amber-200/70 mt-1">
              Cannot connect to Kehrnel. Limited strategy information is available from cached activation data.
              {specError && <span className="block mt-1 text-amber-300/60">Error: {specError}</span>}
            </p>
          </div>
        </div>
      )}

      {/* Hero Section - Refined, inviting design */}
      <div
        className="dark-banner relative overflow-hidden rounded-2xl border"
        style={{
          background: `linear-gradient(145deg, ${theme.primary}12 0%, ${theme.primary}08 40%, transparent 100%)`,
          borderColor: `${theme.primary}30`
        }}
      >
        {/* Subtle decorative element */}
        <div
          className="absolute top-0 right-0 w-64 h-64 opacity-[0.07] blur-3xl rounded-full"
          style={{ backgroundColor: theme.primary }}
        />

        <div className="relative p-8">
          <div className="flex items-start gap-8">
            {/* Large logo or emoji - refined styling */}
            <div
              className="w-28 h-28 rounded-2xl flex items-center justify-center border bg-gradient-to-br from-slate-800/80 to-slate-900/90 shadow-lg flex-shrink-0"
              style={{ borderColor: `${theme.primary}50` }}
            >
              {(() => {
                if (theme.iconPath) {
                  return <img src={theme.iconPath} alt="domain icon" className="w-14 h-14 object-contain" />;
                }
                const IconComponent = DOMAIN_ICONS[theme.icon] || UserRound;
                return <IconComponent className="w-14 h-14" style={{ color: theme.primary }} />;
              })()}
            </div>

            <div className="flex-1 min-w-0">
              {/* Title with refined typography */}
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{strategy.name}</h1>

              {/* Domain and source badges - cleaner design */}
              {domain && (
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm"
                    style={{
                      backgroundColor: `${theme.primary}20`,
                      color: theme.primary,
                      border: `1px solid ${theme.primary}30`
                    }}
                  >
                    {domain}
                  </span>
                  {isKehrnel && (
                    <span className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      Kehrnel
                    </span>
                  )}
                  {manifestVersion && (
                    <span className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 border border-slate-600/50 text-slate-300">
                      v{manifestVersion}
                    </span>
                  )}
                  {/* Status indicator for preview/example strategies */}
                  <StatusIndicator
                    status={strategy.ui?.status}
                    maturity={strategy.maturity}
                    message={strategy.ui?.status_message}
                  />
                </div>
              )}

              {/* Description - improved readability */}
              {strategy.description && (
                <p className="text-slate-300 text-base leading-relaxed max-w-2xl">
                  {strategy.description}
                </p>
              )}

              {/* Capabilities and docs - refined badges */}
              <div className="flex flex-wrap items-center gap-2 mt-5">
                {manifestCapabilities.length > 0 && manifestCapabilities.slice(0, 4).map(cap => (
                  <span key={cap} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-700/40 border border-slate-600/50 text-slate-300">
                    <Check className="w-3 h-3 text-emerald-400" />
                    {cap}
                  </span>
                ))}
                {manifestCapabilities.length > 4 && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/50 border border-slate-700/50 text-slate-400">
                    +{manifestCapabilities.length - 4} more
                  </span>
                )}
                {manifestDocumentationHref && (
                  <a
                    href={manifestDocumentationHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Documentation
                  </a>
                )}
              </div>
            </div>

            {/* Actions - refined button styling */}
            <div className="flex flex-col gap-3 flex-shrink-0">
              {/* Activate / Active Status Button - only shown for published strategies */}
              {strategy.maturity === 'published' ? (
                <button
                  onClick={() => {
                    if (isActive) return;
                    setActiveTab('configuration');
                  }}
                  disabled={activating}
                  className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium transition-all shadow-sm ${
                    isActive
                      ? 'bg-emerald-500/15 border-2 border-emerald-500/50 text-emerald-400 cursor-default'
                      : 'bg-primary hover:bg-primary-hover text-primary-text border-2 border-primary hover:shadow-lg hover:shadow-primary/20'
                  }`}
                >
                  {isActive ? (
                    <>
                      {validatingActivation ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : coherence?.status === 'mismatch' || coherence?.status === 'missing' || coherence?.status === 'error' ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {activationStatusLabel}
                    </>
                  ) : activating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4" />
                      Review Activation Setup
                    </>
                  )}
                </button>
              ) : (
                <div className="px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium bg-amber-500/10 border-2 border-amber-500/30 text-amber-400">
                  <FlaskConical className="w-4 h-4" />
                  Coming Soon
                </div>
              )}

              {/* Save Config Button - only shows when active and config changed */}
              {isActive && configChanged && (
                <button
                  onClick={onSaveConfig}
                  disabled={savingConfig}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-text flex items-center justify-center gap-2 text-sm font-medium transition-all shadow-sm hover:shadow-lg"
                >
                  {savingConfig ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Configuration
                    </>
                  )}
                </button>
              )}

              {isActive && searchRefresh?.required && (
                <button
                  onClick={() => onApplySearchRefresh?.()}
                  disabled={refreshingSearch || refreshJobActive}
                  className="px-5 py-2.5 rounded-xl bg-amber-500/12 hover:bg-amber-500/18 text-amber-200 flex items-center justify-center gap-2 text-sm font-medium transition-colors border border-amber-500/35 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingSearch || refreshJobActive ? 'animate-spin' : ''}`} />
                  {refreshingSearch ? 'Queueing Refresh...' : (refreshJobActive ? 'Refresh Queued' : 'Queue Search Refresh')}
                </button>
              )}

              {/* Sync Catalog Button */}
              {onSyncCatalog && (
                <button
                  onClick={onSyncCatalog}
                  disabled={syncingCatalog}
                  className="px-4 py-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-2 text-sm font-medium transition-colors border border-slate-600/50"
                  title="Reload strategy catalog from Kehrnel"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingCatalog ? 'animate-spin' : ''}`} />
                  {syncingCatalog ? 'Syncing...' : 'Sync Catalog'}
                </button>
              )}

              {/* Environment info */}
              {activeEnv && (
                <p className="text-xs text-slate-500 text-center mt-1">
                  {isActive ? 'Validated for' : 'Ready to review for'}: <span className="text-slate-400">{activeEnv.name}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {(workflow || coherence || (!isActive && strategy.maturity === 'published')) && (
        <ActivationStatusPanel
          workflow={workflow}
          coherence={coherence}
          isActive={isActive}
          validatingActivation={validatingActivation}
        />
      )}

      {isActive && searchRefresh?.required && (
        <div className="bg-amber-900/25 border border-amber-700/40 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-100">Search projections are out of date</h3>
              <p className="text-sm text-amber-200/85 mt-1">
                The active strategy needs a slim-search refresh because the analytics template changed.
                {refreshSourceName ? ` Latest change: ${refreshSourceName}.` : ''}
                {refreshJobLabel ? ` Refresh job ${refreshJobLabel}.` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => onApplySearchRefresh?.()}
            disabled={refreshingSearch || refreshJobActive}
            className="px-4 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/20 text-amber-100 border border-amber-500/35 text-sm font-medium flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingSearch || refreshJobActive ? 'animate-spin' : ''}`} />
            {refreshingSearch ? 'Queueing...' : (refreshJobActive ? 'Queued' : 'Queue Refresh Job')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="spec" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Data Model
          </TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-2">
            <Cog className="w-4 h-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            API Explorer
          </TabsTrigger>
        </TabsList>

        {/* Overview & Schema Tab */}
        <TabsContent value="overview">
          <OverviewSchemaContent
            strategy={strategy}
            config={mergedConfig}
            theme={theme}
            manifestDocumentationHref={manifestDocumentationHref}
          />
        </TabsContent>

        {/* Full Spec Tab - includes Dictionaries */}
        <TabsContent value="spec">
          <SpecContent
            strategy={strategy}
            fullSpec={fullSpec}
            specLoading={specLoading}
            specError={specError}
            activeEnv={activeEnv}
          />
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration">
          {strategy.maturity === 'published' && (
            <ActivationPreparationPanel
              strategy={strategy}
              activeEnv={activeEnv}
              isActive={isActive}
              activating={activating}
              activationReviewConfirmed={activationReviewConfirmed}
              onReviewConfirmedChange={setActivationReviewConfirmed}
              onActivate={() => onActivate?.(strategy, { configurationConfirmedAt: new Date().toISOString() })}
              workflow={workflow}
              coherence={coherence}
            />
          )}
          <ConfigurationContent
            strategy={strategy}
            config={mergedConfig}
            manifestSchema={manifestSchema}
            manifestDefaultConfig={manifestDefaultConfig}
            configOverrides={configOverrides}
            canEdit={canEditConfig}
            canSave={canSaveConfig}
            isActive={isActive}
            onFieldChange={onConfigChange}
            onSaveConfig={onSaveConfig}
            savingConfig={savingConfig}
            configChanged={configChanged}
          />
        </TabsContent>

        {/* API Explorer Tab */}
        <TabsContent value="api">
          <div className="space-y-6">
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                <TestTube className="w-5 h-5 text-purple-400" />
                API Explorer
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                Test strategy endpoints directly. Each capability exposes specific API endpoints for transform, ingest, and search operations.
              </p>
              <StrategyAPIExplorer
                strategy={strategy}
                kehrnelBaseUrl={getPublicKehrnelBaseUrl()}
                activeEnvironmentId={activeEnv?.id || ''}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function getActivationStatusLabel(status, validatingActivation = false) {
  if (validatingActivation) return 'Validating...';
  switch (status) {
    case 'activated':
      return 'Activated';
    case 'activated_with_warnings':
      return 'Activated With Warnings';
    case 'mismatch':
      return 'Needs Attention';
    case 'missing':
      return 'Activation Missing';
    case 'error':
      return 'Validation Error';
    default:
      return 'Active Strategy';
  }
}

function activationTone(status) {
  switch (status) {
    case 'activated':
      return 'emerald';
    case 'activated_with_warnings':
      return 'amber';
    case 'mismatch':
    case 'missing':
    case 'error':
      return 'rose';
    default:
      return 'slate';
  }
}

const ActivationStatusPanel = ({
  workflow,
  coherence,
  isActive,
  validatingActivation = false,
}) => {
  const tone = activationTone(coherence?.status || workflow?.status);
  const palette = {
    emerald: 'bg-emerald-900/20 border-emerald-600/35 text-emerald-100',
    amber: 'bg-amber-900/20 border-amber-600/35 text-amber-100',
    rose: 'bg-rose-900/20 border-rose-600/35 text-rose-100',
    slate: 'bg-slate-800/40 border-slate-700 text-slate-200',
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${palette}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">
            {isActive ? getActivationStatusLabel(coherence?.status || workflow?.status, validatingActivation) : 'Activation Workflow'}
          </h3>
          <p className="text-sm opacity-85 mt-1">
            {validatingActivation
              ? 'Checking whether the runtime activation still matches this environment.'
              : (coherence?.message || workflow?.steps?.find((step) => step?.id === 'validate_environment')?.message || 'Review the configuration before activation.')}
          </p>
        </div>
        {workflow?.progress !== undefined && (
          <span className="text-xs font-medium opacity-80">
            {Math.max(0, Math.min(100, Number(workflow.progress) || 0))}%
          </span>
        )}
      </div>

      {workflow?.steps?.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="h-2 rounded-full bg-slate-900/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-current transition-all"
              style={{ width: `${Math.max(0, Math.min(100, Number(workflow.progress) || 0))}%` }}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {workflow.steps.map((step) => (
              <div key={step.id} className="rounded-lg bg-slate-950/25 border border-white/5 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{step.label}</span>
                  <StepBadge status={step.status} />
                </div>
                {step.message && (
                  <p className="text-xs opacity-80 mt-1">{step.message}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ActivationPreparationPanel = ({
  strategy,
  activeEnv,
  isActive,
  activating = false,
  activationReviewConfirmed = false,
  onReviewConfirmedChange,
  onActivate,
  workflow,
  coherence,
}) => {
  if (isActive) return null;

  return (
    <div className="mb-6 rounded-xl border border-cyan-700/35 bg-cyan-950/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-cyan-100">Activate From Reviewed Configuration</h3>
          <p className="text-sm text-cyan-100/75 mt-1">
            Start in the configuration form, confirm the environment bindings, then activate. Kehrnel will ensure collections, indexes, and final coherence before this strategy is shown as activated.
          </p>
        </div>
        <div className="px-3 py-1 rounded-full border border-cyan-500/30 text-xs font-medium text-cyan-200">
          {activeEnv?.name || 'Environment'}
        </div>
      </div>

      <div className="grid gap-2 mt-4 md:grid-cols-3">
        <div className="rounded-lg bg-slate-950/30 border border-white/5 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">1. Review</p>
          <p className="text-sm text-slate-200 mt-1">Confirm collection names, database targets, and runtime options.</p>
        </div>
        <div className="rounded-lg bg-slate-950/30 border border-white/5 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">2. Activate</p>
          <p className="text-sm text-slate-200 mt-1">Kehrnel will activate the strategy and initialize runtime artifacts.</p>
        </div>
        <div className="rounded-lg bg-slate-950/30 border border-white/5 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">3. Validate</p>
          <p className="text-sm text-slate-200 mt-1">HDL checks the activation against the environment before labeling it activated.</p>
        </div>
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-lg border border-cyan-700/25 bg-slate-950/20 px-3 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
          checked={activationReviewConfirmed}
          onChange={(event) => onReviewConfirmedChange?.(event.target.checked)}
        />
        <span className="text-sm text-slate-200">
          I reviewed the configuration for <span className="font-medium text-white">{strategy?.name}</span> in <span className="font-medium text-white">{activeEnv?.name || 'this environment'}</span> and I’m ready to activate it.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          onClick={() => onActivate?.()}
          disabled={!activationReviewConfirmed || activating}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-text text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="w-4 h-4" />
          {activating ? 'Activating...' : 'Activate Strategy'}
        </button>
        <p className="text-xs text-slate-400">
          The activation result will appear below as a step-by-step progress summary.
        </p>
      </div>

      {(workflow || coherence) && (
        <div className="mt-4">
          <ActivationStatusPanel
            workflow={workflow}
            coherence={coherence}
            isActive={false}
            validatingActivation={false}
          />
        </div>
      )}
    </div>
  );
};

const StepBadge = ({ status }) => {
  const styles = {
    completed: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    in_progress: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
    warning: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    error: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    skipped: 'bg-slate-700/50 border-slate-600/40 text-slate-300',
    pending: 'bg-slate-700/40 border-slate-600/30 text-slate-400',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${styles[status] || styles.pending}`}>
      {(status || 'pending').replace('_', ' ')}
    </span>
  );
};

// Full Spec Content - shows the complete spec.json from Kehrnel with visual canvas + Dictionaries
const SpecContent = ({ strategy, fullSpec, specLoading, specError, activeEnv }) => {
  const [specViewMode, setSpecViewMode] = useState('visual');
  const isKehrnel = strategy?.source === 'kehrnel';

  // Use fullSpec if available, otherwise fall back to strategy data from catalog
  const effectiveSpec = fullSpec || (strategy ? {
    id: strategy.id,
    name: strategy.name,
    version: strategy.version,
    domain: strategy.domain,
    summary: strategy.description,
    config_schema: strategy.config_schema,
    default_config: strategy.default_config,
    capabilities: strategy.capabilities,
    ops: strategy.ops,
    ui: strategy.ui
  } : null);

  // Determine data source for display
  const dataSource = fullSpec ? 'spec' : (strategy?.config_schema || strategy?.default_config ? 'catalog' : null);

  if (!isKehrnel) {
    return (
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center">
        <FileCode className="w-12 h-12 mx-auto mb-4 text-slate-600" />
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No Kehrnel Data Model Available</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          This strategy is not sourced from Kehrnel, so a data model visualization is not available.
        </p>
      </div>
    );
  }

  if (specLoading) {
    return (
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center">
        <RefreshCw className="w-8 h-8 mx-auto mb-4 text-blue-400 animate-spin" />
        <p className="text-sm text-slate-400">Loading data model from Kehrnel...</p>
      </div>
    );
  }

  // If we have no effective spec at all, show error
  if (!effectiveSpec) {
    return (
      <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-amber-200 mb-2">Data Model Not Available</h3>
            <p className="text-sm text-amber-300/70">
              No data model information is available for this strategy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data source indicator if using fallback */}
      {specError && dataSource === 'catalog' && (
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 flex items-center gap-3">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <p className="text-xs text-blue-300">
            Using catalog data. Full spec endpoint not available ({specError}).
          </p>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
        <button
          onClick={() => setSpecViewMode('visual')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            specViewMode === 'visual'
              ? 'bg-primary text-primary-text'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Visual Canvas
        </button>
        <button
          onClick={() => setSpecViewMode('json')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            specViewMode === 'json'
              ? 'bg-primary text-primary-text'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          }`}
        >
          <FileJson className="w-4 h-4" />
          Raw JSON
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-medium rounded border ${
            dataSource === 'spec'
              ? 'bg-emerald-900/30 text-emerald-300 border-emerald-600/40'
              : 'bg-blue-900/30 text-blue-300 border-blue-600/40'
          }`}>
            {dataSource === 'spec' ? 'Full Spec' : 'Catalog'}
          </span>
          <span className="px-2 py-1 text-xs font-mono bg-slate-700/50 text-slate-300 rounded">
            {strategy.id}
          </span>
        </div>
      </div>

      {/* Visual Canvas View - Strategy Model with Dictionaries sub-tab */}
      {specViewMode === 'visual' && (
        <StrategyModelViewer spec={effectiveSpec} strategy={strategy} activeEnv={activeEnv} />
      )}

      {/* Raw JSON View */}
      {specViewMode === 'json' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
              <FileCode className="w-5 h-5 text-purple-400" />
              Data Model
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {effectiveSpec.version && (
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Version</p>
                  <p className="text-sm font-semibold text-slate-200">{effectiveSpec.version}</p>
                </div>
              )}
              {effectiveSpec.domain && (
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Domain</p>
                  <p className="text-sm font-semibold text-slate-200">{effectiveSpec.domain}</p>
                </div>
              )}
              {effectiveSpec.capabilities && (
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Capabilities</p>
                  <p className="text-sm font-semibold text-slate-200">{effectiveSpec.capabilities?.length || 0}</p>
                </div>
              )}
              {effectiveSpec.ops && (
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Operations</p>
                  <p className="text-sm font-semibold text-slate-200">{effectiveSpec.ops?.length || 0}</p>
                </div>
              )}
            </div>
          </div>

          {/* Config Schema Section */}
          {effectiveSpec.config_schema && Object.keys(effectiveSpec.config_schema).length > 0 && (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Cog className="w-4 h-4 text-blue-400" />
                  Configuration Schema (JSON Schema)
                </h3>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(effectiveSpec.config_schema, null, 2))}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[400px]">
                <pre className="text-xs text-slate-300 font-mono whitespace-pre">
                  {JSON.stringify(effectiveSpec.config_schema, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Default Config Section */}
          {effectiveSpec.default_config && Object.keys(effectiveSpec.default_config).length > 0 && (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  Default Configuration
                </h3>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(effectiveSpec.default_config, null, 2))}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[400px]">
                <pre className="text-xs text-slate-300 font-mono whitespace-pre">
                  {JSON.stringify(effectiveSpec.default_config, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Operations Section */}
          {effectiveSpec.ops && effectiveSpec.ops.length > 0 && (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-purple-400" />
                Available Operations ({effectiveSpec.ops.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {effectiveSpec.ops.map((op, idx) => (
                  <div key={idx} className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-slate-200 font-semibold">{op.name}</h4>
                      {op.kind && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          op.kind === 'maintenance' ? 'bg-amber-900/30 text-amber-300 border border-amber-600/40' :
                          op.kind === 'query' ? 'bg-blue-900/30 text-blue-300 border border-blue-600/40' :
                          'bg-slate-700 text-slate-400 border border-slate-600'
                        }`}>
                          {op.kind}
                        </span>
                      )}
                    </div>
                    {op.summary && (
                      <p className="text-xs text-slate-400 mb-2">{op.summary}</p>
                    )}
                    {op.params && Object.keys(op.params).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <p className="text-xs text-slate-500 mb-1">Parameters:</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(op.params).map(param => (
                            <span key={param} className="px-1.5 py-0.5 text-xs bg-slate-800 text-slate-400 rounded font-mono">
                              {param}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Spec JSON */}
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <FileJson className="w-4 h-4 text-yellow-400" />
                Full Data Model JSON
              </h3>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(effectiveSpec, null, 2))}
                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
              >
                Copy JSON
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[600px]">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre">
                {JSON.stringify(effectiveSpec, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Overview Content - Clean, developer-focused documentation style
const OverviewSchemaContent = ({ strategy, config, theme, manifestDocumentationHref = '' }) => {
  const uiTags = useMemo(
    () => (Array.isArray(strategy.ui?.tags) ? strategy.ui.tags : []),
    [strategy.ui?.tags]
  );
  const isKehrnel = strategy.source === 'kehrnel';
  const kehrnelBaseUrl = getPublicKehrnelBaseUrl();
  const references = normalizeReferences(strategy.ui?.references);
  const hasReferences = references.primary.length > 0 || references.secondary.length > 0;
  const kehrnelStrategyId = getKehrnelStrategyId(strategy) || strategy.id;

  // Extract content from manifest (Kehrnel is the only source)
  const summary = strategy.summary || strategy.ui?.summary || '';
  const story = strategy.story || strategy.ui?.story || '';
  const howItWorks = strategy.ui?.how_it_works || '';
  const idealFor = strategy.ui?.ideal_for || '';
  const considerAlternatives = strategy.ui?.consider_alternatives || '';

  // Benefits - array format
  const benefitsRaw = strategy.ui?.benefits || strategy.benefits || [];
  const benefitsArray = Array.isArray(benefitsRaw) ? benefitsRaw : [];

  // Technical terms to highlight (from tags and common terms)
  const highlightTerms = useMemo(() => {
    const terms = new Set([
      // From tags
      ...uiTags.map(t => t.toLowerCase()),
      // Common technical terms
      'atlas search', 'aql', 'b-tree', 'ehr_id', 'mongodb',
      'composition', 'compositions', 'archetype',
      'patient-scoped', 'cross-patient', 'population',
      'canonical', 'search collection', 'primary collection',
      'etl', 'data warehouse'
    ]);
    return terms;
  }, [uiTags]);

  // Highlight technical terms in text
  const highlightText = (text) => {
    if (!text) return null;

    // Split by paragraphs first
    const paragraphs = text.split('\n\n');

    return paragraphs.map((paragraph, pIdx) => {
      // Simple regex to find and highlight terms
      let result = paragraph;
      const parts = [];
      let lastIndex = 0;

      // Find terms to highlight (case-insensitive)
      const regex = new RegExp(
        `\\b(${Array.from(highlightTerms).filter(t => t.length > 2).join('|')})\\b`,
        'gi'
      );

      let match;
      while ((match = regex.exec(paragraph)) !== null) {
        if (match.index > lastIndex) {
          parts.push(paragraph.slice(lastIndex, match.index));
        }
        parts.push(
          <span key={`${pIdx}-${match.index}`} className="text-emerald-400 font-medium">
            {match[0]}
          </span>
        );
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < paragraph.length) {
        parts.push(paragraph.slice(lastIndex));
      }

      return (
        <p key={pIdx} className={pIdx > 0 ? 'mt-4' : ''}>
          {parts.length > 0 ? parts : paragraph}
        </p>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary / TLDR */}
      {summary && (
        <div className="pb-6 border-b border-slate-700/50">
          <p className="text-lg text-slate-200 leading-relaxed font-medium">
            {summary}
          </p>
        </div>
      )}

      {/* Main Story */}
      {story && (
        <div className="text-slate-300 text-base leading-relaxed">
          {highlightText(story)}
        </div>
      )}

      {!story && strategy.description && !summary && (
        <div className="text-slate-300 text-base leading-relaxed">
          <p>{strategy.description}</p>
        </div>
      )}

      {/* Divider */}
      {(story || summary) && howItWorks && (
        <div className="border-t border-slate-700/50" />
      )}

      {/* How It Works */}
      {howItWorks && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">How It Works</h3>
          <div className="text-slate-300 text-base leading-relaxed">
            {highlightText(howItWorks)}
          </div>
        </div>
      )}

      {/* Divider */}
      {howItWorks && benefitsArray.length > 0 && (
        <div className="border-t border-slate-700/50" />
      )}

      {/* Benefits */}
      {benefitsArray.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Key Benefits</h3>
          <ul className="space-y-3">
            {benefitsArray.map((benefit, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <Check className="w-4 h-4 flex-shrink-0 mt-1 text-emerald-400" />
                <span className="text-slate-300 text-base leading-relaxed">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Divider */}
      {benefitsArray.length > 0 && idealFor && (
        <div className="border-t border-slate-700/50" />
      )}

      {/* When to Use / Ideal For */}
      {idealFor && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">When to Use</h3>
          <div className="text-slate-300 text-base leading-relaxed">
            {highlightText(idealFor)}
          </div>
        </div>
      )}

      {/* Considerations / Trade-offs */}
      {considerAlternatives && (
        <div className="mt-6 p-5 rounded-lg bg-amber-950/30 border border-amber-800/40">
          <h3 className="text-base font-semibold text-amber-300 mb-3">Considerations</h3>
          <div className="text-amber-200/80 text-sm leading-relaxed">
            {highlightText(considerAlternatives)}
          </div>
        </div>
      )}

      {/* Documentation */}
      {manifestDocumentationHref && (
        <div className="rounded-xl border border-sky-600/30 bg-sky-950/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-sky-200">Strategy Documentation</h3>
              <p className="text-xs text-sky-200/70 mt-1">
                Open the Kehrnel documentation page declared in this strategy manifest.
              </p>
            </div>
            <a
              href={manifestDocumentationHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/15 border border-sky-500/40 text-sky-200 hover:bg-sky-500/25 transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Docs
            </a>
          </div>
        </div>
      )}

      {/* Divider */}
      {hasReferences && (
        <div className="border-t border-slate-700/50" />
      )}

      {/* References */}
      {hasReferences && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">References</h3>
          <div className="space-y-4">
            {references.primary.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Primary</p>
                {references.primary.map((ref, index) => (
                  <ReferenceItem
                    key={`primary-${index}`}
                    refData={ref}
                    assetBaseUrl={kehrnelBaseUrl}
                    strategyId={kehrnelStrategyId}
                    isKehrnel={isKehrnel}
                  />
                ))}
              </div>
            )}

            {references.secondary.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Additional</p>
                {references.secondary.map((ref, index) => (
                  <ReferenceItem
                    key={`secondary-${index}`}
                    refData={ref}
                    assetBaseUrl={kehrnelBaseUrl}
                    strategyId={kehrnelStrategyId}
                    isKehrnel={isKehrnel}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

// Simple reference item
const ReferenceItem = ({ refData, assetBaseUrl, strategyId, isKehrnel }) => {
  const title = refData?.title || refData?.name || 'Reference';
  const authors = refData?.authors || refData?.author || '';
  const venue = refData?.venue || refData?.journal || '';
  const publisher = refData?.publisher || '';
  const refType = String(refData?.type || refData?.kind || '').trim();
  const year = refData?.year || '';
  const summary = refData?.summary || refData?.abstract || refData?.description || '';
  const asset = normalizeReferenceLink(
    refData?.asset || refData?.url || refData?.href || refData?.link,
    { baseUrl: assetBaseUrl, strategyId, isKehrnel }
  );
  const doiUrl = normalizeDoiUrl(refData?.doi || refData?.DOI || refData?.identifier?.doi);
  const authorsStr = Array.isArray(authors) ? authors.join(', ') : authors;
  const metadataLine = [authorsStr, venue || publisher, year].filter(Boolean).join(' · ');
  const isPaperLike = /paper|journal|conference|ieee|doi|publication|research/i.test(
    [title, venue, publisher, refType].filter(Boolean).join(' ')
  );

  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100 leading-relaxed">{title}</p>
          {metadataLine && (
            <p className="text-xs text-slate-400 mt-1">
              {metadataLine}
            </p>
          )}
          {summary && (
            <p className="text-xs text-slate-300/90 mt-2 leading-relaxed">
              {summary}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {isPaperLike && (
              <span className="px-2 py-0.5 rounded-md text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                Scientific paper
              </span>
            )}
            {refType && (
              <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-700/50 border border-slate-600/60 text-slate-300">
                {refType}
              </span>
            )}
            {year && (
              <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800/70 border border-slate-700 text-slate-400">
                {year}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {doiUrl && (
            <a
              href={doiUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              DOI
            </a>
          )}
          {asset && (
            <a
              href={asset}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-sky-300 bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

// Configuration Content with GUI and JSON tabs (domain-first)
const ConfigurationContent = ({
  strategy,
  config,
  manifestSchema,
  manifestDefaultConfig,
  configOverrides,
  canEdit,
  canSave,
  isActive,
  onFieldChange,
  onSaveConfig,
  savingConfig,
  configChanged,
}) => {
  const [configTab, setConfigTab] = useState('gui');
  const formDef = strategy?.tabs?.schema?.forms;

  return (
    <div className="space-y-6">
      {/* Config Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
        <button
          onClick={() => setConfigTab('gui')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            configTab === 'gui'
              ? 'bg-primary text-primary-text'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Cog className="w-4 h-4" />
            Settings
          </span>
        </button>
        <button
          onClick={() => setConfigTab('json')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            configTab === 'json'
              ? 'bg-primary text-primary-text'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            JSON Configuration
          </span>
        </button>
      </div>

      {/* GUI Settings Tab */}
      {configTab === 'gui' && (
        <div className="space-y-6">
          {/* Check if schema has actual properties to configure */}
          {(() => {
            const hasSchemaProps = manifestSchema && Object.keys(manifestSchema.properties || {}).length > 0;
            const hasDefaults = manifestDefaultConfig && Object.keys(manifestDefaultConfig).length > 0;
            const hasCollections = config.collections && Object.keys(config.collections).length > 0;
            const hasFields = config.fields && Object.keys(config.fields).length > 0;
            const hasAnyConfig = hasSchemaProps || hasDefaults || hasCollections || hasFields;

            if (!hasAnyConfig) {
              return (
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center">
                  <Settings className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">No Configuration Options</h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    This strategy has no configurable settings. It uses sensible defaults that work out of the box.
                  </p>
                  {manifestDefaultConfig && Object.keys(manifestDefaultConfig).length > 0 && (
                    <div className="mt-6 text-left max-w-lg mx-auto">
                      <p className="text-xs text-slate-500 mb-2">Default configuration:</p>
                      <pre className="p-3 bg-slate-900/60 rounded-lg text-xs text-slate-400 font-mono overflow-auto max-h-48">
                        {JSON.stringify(manifestDefaultConfig, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {/* Kehrnel Manifest Schema Form - only show if schema has properties */}
          {manifestSchema && Object.keys(manifestSchema.properties || {}).length > 0 && (
            <ConfigSection title="Strategy Configuration" icon={Cog}>
              <p className="text-xs text-slate-500 mb-4">
                Configure strategy settings. Changes are saved as overrides and don't modify the base strategy.
              </p>
              <SchemaConfigForm
                schema={manifestSchema}
                defaultConfig={manifestDefaultConfig}
                overrides={configOverrides}
                canEdit={canEdit}
                canSave={canSave}
                onChange={onFieldChange}
                onSave={onSaveConfig}
                saving={savingConfig}
                configChanged={configChanged}
              />
            </ConfigSection>
          )}

          {/* Default Config (read-only) when schema is empty but defaults exist */}
          {(!manifestSchema || Object.keys(manifestSchema.properties || {}).length === 0) &&
           manifestDefaultConfig && Object.keys(manifestDefaultConfig).length > 0 && (
            <ConfigSection title="Default Configuration" icon={FileJson}>
              <p className="text-xs text-slate-500 mb-4">
                Read-only default configuration from the strategy manifest.
              </p>
              <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700">
                <pre className="text-xs text-slate-300 font-mono overflow-auto max-h-64">
                  {JSON.stringify(manifestDefaultConfig, null, 2)}
                </pre>
              </div>
            </ConfigSection>
          )}

          {/* Collections Section */}
          {config.collections && (
            <ConfigSection title="Collections" icon={Database}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(config.collections).map(([key, collection]) => (
                  <div key={key} className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-slate-200 font-semibold capitalize">{key}</h4>
                        <p className="text-xs text-slate-500">Collection key: {key}</p>
                      </div>
                      {collection.enabled !== undefined && (
                        <ToggleSwitch
                          value={collection.enabled}
                          onChange={canEdit ? (v) => onFieldChange?.(`collections.${key}.enabled`, v) : undefined}
                          disabled={!canEdit}
                        />
                      )}
                    </div>
                    <ConfigInput
                      label="Collection Name"
                      value={collection.name || ''}
                      onChange={canEdit ? (v) => onFieldChange?.(`collections.${key}.name`, v) : undefined}
                      disabled={!canEdit}
                      placeholder={key}
                    />
                    {collection.atlas_index_name !== undefined && (
                      <ConfigInput
                        label="Atlas Search Index"
                        value={collection.atlas_index_name || ''}
                        onChange={canEdit ? (v) => onFieldChange?.(`collections.${key}.atlas_index_name`, v) : undefined}
                        disabled={!canEdit}
                        placeholder="e.g., compositions_search"
                        className="mt-3"
                      />
                    )}
                  </div>
                ))}
              </div>
            </ConfigSection>
          )}

          {/* Fields Mapping Section */}
          {config.fields && (
            <ConfigSection title="Field Mappings" icon={Code}>
              {Object.entries(config.fields).map(([sectionKey, fields]) => (
                <div key={sectionKey} className="mb-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 capitalize">{sectionKey} Fields</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(fields).map(([fieldKey, fieldValue]) => (
                      <ConfigInput
                        key={fieldKey}
                        label={fieldKey}
                        value={typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue)}
                        onChange={canEdit ? (v) => onFieldChange?.(`fields.${sectionKey}.${fieldKey}`, v) : undefined}
                        disabled={!canEdit}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </ConfigSection>
          )}

          {/* Coding/Dictionary Section */}
          {config.coding && (
            <ConfigSection title="Coding & Dictionaries" icon={Database}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.coding.archetype_ids && (
                  <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-slate-200 font-semibold">Archetype IDs</h4>
                      <ToggleSwitch
                        value={config.coding.archetype_ids.enabled}
                        onChange={canEdit ? (v) => onFieldChange?.('coding.archetype_ids.enabled', v) : undefined}
                        disabled={!canEdit}
                      />
                    </div>
                    {config.coding.archetype_ids.dictionary && (
                      <p className="text-xs text-slate-400">
                        Dictionary: <span className="text-slate-300">{config.coding.archetype_ids.dictionary}</span>
                      </p>
                    )}
                  </div>
                )}
                {config.coding.atcodes && (
                  <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-slate-200 font-semibold">AT Codes</h4>
                      <ToggleSwitch
                        value={config.coding.atcodes.enabled}
                        onChange={canEdit ? (v) => onFieldChange?.('coding.atcodes.enabled', v) : undefined}
                        disabled={!canEdit}
                      />
                    </div>
                    {config.coding.atcodes.strategy && (
                      <p className="text-xs text-slate-400">
                        Strategy: <span className="text-slate-300">{config.coding.atcodes.strategy}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </ConfigSection>
          )}

          {/* Query Engine Section */}
          {config.query_engine && (
            <ConfigSection title="Query Engine" icon={Database}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Mode</p>
                  <p className="text-slate-200 font-medium">{config.query_engine.mode || 'default'}</p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Relative Paths</p>
                  <p className="text-slate-200 font-medium">
                    {config.query_engine.supports_relative_paths ? 'Supported' : 'Not supported'}
                  </p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">CONTAINS Clause</p>
                  <p className="text-slate-200 font-medium">
                    {config.query_engine.supports_contains ? 'Supported' : 'Not supported'}
                  </p>
                </div>
              </div>
            </ConfigSection>
          )}

          {/* Custom Form Controls from Strategy Definition */}
          {formDef?.controls?.length > 0 && (
            <ConfigSection title={formDef.title || 'Additional Settings'}>
              {formDef.description && (
                <p className="text-sm text-slate-400 mb-4">{formDef.description}</p>
              )}
              <div className="space-y-3">
                {formDef.controls.map(control => (
                  <FormControl
                    key={control.binding || control.label}
                    control={control}
                    value={getNestedValue(config, control.binding)}
                    onChange={canEdit ? (v) => onFieldChange?.(control.binding, v) : undefined}
                    disabled={!canEdit}
                  />
                ))}
              </div>
              {formDef.footnote && (
                <p className="text-xs text-slate-500 mt-4">{formDef.footnote}</p>
              )}
            </ConfigSection>
          )}

          {/* Save button inline when there are changes */}
          {canSave && configChanged && (
            <div className="flex items-center justify-between bg-blue-900/20 border border-blue-700/40 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-blue-200">You have unsaved configuration changes</span>
              </div>
              <button
                onClick={onSaveConfig}
                disabled={savingConfig}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-text flex items-center gap-2 text-sm font-medium transition-colors"
              >
                {savingConfig ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}

          {!isActive && (
            <div className="bg-cyan-900/20 border border-cyan-700/40 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-cyan-200 font-medium">Configuration review is enabled</p>
                <p className="text-xs text-cyan-300/70 mt-1">
                  Any changes you make here are staged for activation. When you activate this strategy, HDL will send these overrides to Kehrnel for this environment.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* JSON Configuration Tab */}
      {configTab === 'json' && (
        <div className="space-y-4">
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Raw JSON Configuration</h3>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(config, null, 2))}
                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
              >
                Copy JSON
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[600px]">
              <pre className="text-sm text-slate-300 font-mono whitespace-pre">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            This is the complete configuration object for this strategy. All settings from the GUI tab are reflected here.
          </p>
        </div>
      )}
    </div>
  );
};

// Helper function to get nested value
const getNestedValue = (source, path) => {
  if (!source || !path) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return undefined;
  }, source);
};

// Config Section wrapper
const ConfigSection = ({ title, icon: Icon, children }) => (
  <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6">
    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
      {Icon && <Icon className="w-5 h-5 text-blue-400" />}
      {title}
    </h3>
    {children}
  </div>
);

// Config Input component
const ConfigInput = ({ label, value, onChange, disabled, placeholder, className = '' }) => (
  <div className={className}>
    <label className="block text-xs text-slate-400 mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
    />
  </div>
);

// Toggle Switch component
const ToggleSwitch = ({ value, onChange, disabled }) => (
  <button
    type="button"
    onClick={!disabled && onChange ? () => onChange(!value) : undefined}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
    } ${value ? 'bg-emerald-600' : 'bg-slate-600'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        value ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

// Form Control component for custom strategy controls
const FormControl = ({ control, value, onChange, disabled }) => {
  const type = control.type || 'toggle';

  if (type === 'input') {
    return (
      <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
        <ConfigInput
          label={control.label}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          placeholder={control.placeholder}
        />
        {control.helper && (
          <p className="text-xs text-slate-500 mt-2">{control.helper}</p>
        )}
      </div>
    );
  }

  if (type === 'select' && control.options) {
    return (
      <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
        <label className="block text-sm text-slate-200 mb-2">{control.label}</label>
        <select
          value={value ?? control.options[0]}
          onChange={onChange && !disabled ? (e) => onChange(e.target.value) : undefined}
          disabled={disabled}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-60"
        >
          {control.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {control.helper && (
          <p className="text-xs text-slate-500 mt-2">{control.helper}</p>
        )}
      </div>
    );
  }

  // Default toggle
  return (
    <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-lg p-4">
      <div>
        <p className="text-sm text-slate-200">{control.label}</p>
        {control.helper && <p className="text-xs text-slate-400 mt-1">{control.helper}</p>}
      </div>
      <ToggleSwitch value={Boolean(value)} onChange={onChange} disabled={disabled} />
    </div>
  );
};

function normalizeReferences(raw) {
  if (!raw) return { primary: [], secondary: [] };
  if (Array.isArray(raw)) return { primary: raw, secondary: [] };
  const primary = Array.isArray(raw.primary) ? raw.primary : (raw.primary ? [raw.primary] : []);
  const secondary = Array.isArray(raw.secondary) ? raw.secondary : (raw.secondary ? [raw.secondary] : []);
  return { primary, secondary };
}

function normalizeReferenceLink(asset, { baseUrl, strategyId, isKehrnel } = {}) {
  if (!asset || typeof asset !== 'string') return '';
  if (/^[a-z]+:\/\//i.test(asset)) return asset;
  if (isKehrnel && strategyId) {
    // Route through Next.js proxy to avoid exposing the internal Kehrnel hostname.
    const safeAsset = asset.replace(/^\/+/, '');
    return `/api/kehrnel/strategies/${encodeURIComponent(strategyId)}/assets/${encodeURI(safeAsset)}`;
  }
  if (asset.startsWith('/')) return asset;
  if (asset.startsWith('assets/')) return `/${asset}`;
  return `/assets/${asset}`;
}

function normalizeDoiUrl(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://doi.org/${raw.replace(/^doi:\s*/i, '')}`;
}

function getKehrnelStrategyId(strategy) {
  return strategy?.kehrnelId || strategy?.kehrnel?.strategyId || strategy?.id || '';
}

function resolveManifestDocumentationUrl(rawUrl, { baseUrl, strategyId, isKehrnel } = {}) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const value = rawUrl.trim();
  if (!value) return '';
  // Absolute URLs (e.g. external sites) are used as-is.
  if (/^[a-z]+:\/\//i.test(value)) return value;

  if (isKehrnel) {
    // Route through Next.js proxy to avoid exposing the internal Kehrnel hostname.
    if (/\.[a-z0-9]{2,8}$/i.test(value) && strategyId) {
      // Looks like a file asset — use the asset proxy.
      return normalizeReferenceLink(value, { strategyId, isKehrnel: true });
    }
    // Docs page — map docs/strategies/{domain}/{name} to the self-contained
    // ReDoc proxy route, which avoids the Kehrnel HTML having broken relative
    // references when loaded from the browser.
    const cleanPath = value.replace(/^\/+/, '');
    const docsMatch = cleanPath.match(/^docs\/strategies\/([^/]+)\/([^/]+)/);
    if (docsMatch) {
      return `/api/kehrnel/redoc/strategies/${encodeURIComponent(docsMatch[1])}/${encodeURIComponent(docsMatch[2])}`;
    }
    return `/api/kehrnel/docs/${cleanPath}`;
  }

  if (baseUrl) {
    const trimmedBase = baseUrl.replace(/\/$/, '');
    if (value.startsWith('/')) return `${trimmedBase}${value}`;
    try {
      return new URL(value, `${trimmedBase}/`).toString();
    } catch {
      // Fall through to raw value.
    }
  }

  return value;
}

/**
 * Deep merge two objects (source overrides target)
 */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export default EnhancedStrategyDetails;
