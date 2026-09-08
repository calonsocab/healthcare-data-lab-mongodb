// src/components/views/strategyStudio/StrategyManager.jsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import StrategyFilters from "./StrategyManager/components/StrategyFilters";
import StrategyList from "./StrategyManager/components/StrategyList";
import EnhancedStrategyDetails from "./StrategyManager/components/EnhancedStrategyDetails";
import DatabaseOverview from "./StrategyManager/components/DatabaseOverview";
import { DOMAIN_THEMES } from "./StrategyManager/constants/domainThemes";
import {
  RefreshCw,
  Database,
  Search,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowRight,
  Settings,
  Zap,
  AlertCircle,
  HelpCircle,
  UserRound,
  Share2,
  Dna,
  ScanLine,
  Receipt,
  Boxes,
  Puzzle
} from "lucide-react";

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
import TrademarkDisclaimers, { LicenseNotice } from "@/components/common/TrademarkDisclaimers";

const FILTER_OPTIONS = [
  { label: "All Domains", value: "all" },
  { label: "openEHR®", value: "openEHR" },
  { label: "FHIR®", value: "FHIR" },
  { label: "Genomics", value: "Genomics" },
  { label: "X12", value: "X12" },
];

function renderDomainChipLabel(domainId) {
  const showCopyright = domainId === 'openEHR' || domainId === 'FHIR';
  return (
    <span className="inline-flex items-center">
      {domainId}
      {showCopyright && (
        <sup className="ml-0.5 text-[10px] opacity-80">&copy;</sup>
      )}
    </span>
  );
}

/**
 * Transform Kehrnel catalog response to domain-first UI format
 */
function transformKehrnelCatalog(strategies) {
  return (strategies || []).map(s => ({
    id: s.id,
    name: s.name || s.id,
    description: s.summary || s.description || '',
    domain: s.domain,
    version: s.version,
    maturity: s.maturity,
    config_schema: s.config_schema,
    default_config: s.default_config,
    ops: s.ops || [],
    capabilities: s.capabilities || [],
    ui: s.ui || {},
    source: 'kehrnel',
  }));
}

/**
 * StrategyManager - Browse and activate Kehrnel strategies
 *
 * Two main views:
 * 1. Active Strategies - Shows current active strategies by domain (one per domain)
 * 2. Browse & Learn - Catalog browser + learning guide
 */
const StrategyManager = ({ onEnvironmentRefresh }) => {
  // Tab state
  const [activeTab, setActiveTab] = useState('active');

  // Data state
  const [strategies, setStrategies] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [envLoading, setEnvLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  // Active environment and strategy state
  const [activeEnv, setActiveEnv] = useState(null);
  const [activeStrategyLink, setActiveStrategyLink] = useState(null);
  const [configOverrides, setConfigOverrides] = useState({});
  const [configChanged, setConfigChanged] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationProgress, setActivationProgress] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Refresh activation state
  const [refreshingActivation, setRefreshingActivation] = useState(false);
  const [validatingActivation, setValidatingActivation] = useState(false);
  const [refreshingSearch, setRefreshingSearch] = useState(false);
  const autoValidationRef = useRef(new Map());

  // Selected domain tab for active strategies view
  const [selectedDomain, setSelectedDomain] = useState(null);

  // Learning guide state - persisted in localStorage
  const [showGuide, setShowGuide] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hdl_strategy_guide_expanded');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  // Load active environment on mount
  useEffect(() => {
    fetchActiveEnvironment();
  }, []);

  // Load strategies on mount and when environment changes
  useEffect(() => {
    fetchStrategies();
  }, [activeEnv?.kehrnel?.connectionId]);

  // Keep activeStrategyLink in sync when environment changes
  useEffect(() => {
    if (activeEnv?.strategyLinks?.length) {
      const link = activeEnv.strategyLinks.find(l => l.domain === 'openEHR')
        || activeEnv.strategyLinks[0];
      setActiveStrategyLink(link || null);
    } else {
      setActiveStrategyLink(null);
    }
  }, [activeEnv]);

  useEffect(() => {
    const selectedId = selected?.id || null;
    const activeId = activeStrategyLink?.kehrnel?.strategyId || activeStrategyLink?.strategyId || null;
    if (!selectedId || selectedId !== activeId) return;
    setActivationProgress(activeStrategyLink?.kehrnel?.activationWorkflow || null);
  }, [selected?.id, activeStrategyLink?.kehrnel?.strategyId, activeStrategyLink?.strategyId, activeStrategyLink?.kehrnel?.activationWorkflow]);

  // Reset config overrides when selected strategy changes
  useEffect(() => {
    const linkStrategyId = activeStrategyLink?.kehrnel?.strategyId || activeStrategyLink?.strategyId;
    if (selected && linkStrategyId === selected.id) {
      setConfigOverrides(activeStrategyLink.configOverrides || {});
    } else {
      setConfigOverrides({});
    }
    setConfigChanged(false);
  }, [selected?.id, activeStrategyLink]);

  // Hydrate active selection with full catalog data when available
  useEffect(() => {
    const activeId = activeStrategyLink?.kehrnel?.strategyId || activeStrategyLink?.strategyId;
    if (!selected || !activeId || selected.id !== activeId || !selected?._offline) return;
    const found = strategies.find(s => s.id === activeId);
    if (found && found !== selected) {
      setSelected(found);
    }
  }, [strategies, activeStrategyLink?.kehrnel?.strategyId, activeStrategyLink?.strategyId, selected?.id, selected?._offline]);

  async function fetchStrategies(forceRefresh = false) {
    try {
      setLoading(true);
      setError(null);

      const connectionId = activeEnv?.kehrnel?.connectionId;
      const params = new URLSearchParams();
      if (connectionId) params.set('connectionId', connectionId);
      if (forceRefresh) params.set('refresh', 'true');

      const url = `/api/kehrnel/catalog${params.toString() ? `?${params.toString()}` : ''}`;

      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load strategies from Kehrnel (${res.status})`);
      }

      const data = await res.json();
      console.log('[StrategyManager] Catalog response:', data.strategies?.map(s => ({ id: s.id, name: s.name })));
      const kehrnelStrategies = transformKehrnelCatalog(data.strategies);
      setStrategies(kehrnelStrategies);
      return kehrnelStrategies;
    } catch (err) {
      console.error("fetchStrategies error:", err);
      setError(err.message || "Failed to load strategies from Kehrnel");
    } finally {
      setLoading(false);
    }
    return null;
  }

  async function fetchActiveEnvironment() {
    try {
      setEnvLoading(true);
      // Add cache-busting to ensure fresh data
      const res = await fetch(`/api/environments?_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!res.ok) return;
      const data = await res.json();
      const envs = data?.environments || [];
      const active = envs.find(e => e.isActive) || envs[0];
      setActiveEnv(active || null);

      const link = active?.strategyLinks?.find(l => l.domain === 'openEHR')
                || active?.strategyLinks?.[0] || null;
      setActiveStrategyLink(link);
    } catch (err) {
      console.warn('fetchActiveEnvironment error:', err);
    } finally {
      setEnvLoading(false);
    }
  }

  async function validateActivationCoherence(options = {}) {
    const { silent = false, domain = null } = options;
    if (!activeEnv?.id) return null;

    setValidatingActivation(true);
    if (!silent) {
      setActionError(null);
    }

    try {
      const res = await fetch('/api/environments/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envId: activeEnv.id,
          ...(domain ? { domain } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string'
          ? data.error
          : data.error?.message || 'Failed to validate strategy coherence');
      }

      const result = await res.json();
      setActiveEnv(result.environment || null);
      const targetDomain = String(domain || activeStrategyLink?.domain || '').toLowerCase();
      const link = result?.environment?.strategyLinks?.find((item) => String(item?.domain || '').toLowerCase() === targetDomain)
        || result?.environment?.strategyLinks?.find((item) => String(item?.domain || '').toLowerCase() === 'openehr')
        || result?.environment?.strategyLinks?.[0]
        || null;
      setActiveStrategyLink(link);

      if (selected && link) {
        const selectedStrategyId = selected?.id;
        const linkStrategyId = link?.kehrnel?.strategyId || link?.strategyId;
        if (selectedStrategyId && selectedStrategyId === linkStrategyId) {
          setActivationProgress(link?.kehrnel?.activationWorkflow || null);
        }
      }

      if (!silent) {
        setActionSuccess('Strategy coherence validated');
        setTimeout(() => setActionSuccess(null), 2500);
      }

      return result;
    } catch (err) {
      if (!silent) {
        setActionError(err.message || 'Failed to validate strategy coherence');
      } else {
        console.warn('validateActivationCoherence error:', err);
      }
      return null;
    } finally {
      setValidatingActivation(false);
    }
  }

  useEffect(() => {
    const links = Array.isArray(activeEnv?.strategyLinks) ? activeEnv.strategyLinks : [];
    if (!activeEnv?.id || links.length === 0) return;
    if (activating || savingConfig || refreshingActivation || validatingActivation) return;

    const needsValidation = links.some((link) => {
      const coherence = link?.kehrnel?.coherence;
      const checkedAt = coherence?.checkedAt;
      const currentActivationId = link?.kehrnel?.activationId || link?.activationId || null;
      const validatedActivationId = coherence?.actual?.activationId || null;
      if (!checkedAt) return true;
      if (currentActivationId && validatedActivationId && currentActivationId !== validatedActivationId) {
        return true;
      }
      return false;
    });
    if (!needsValidation) return;

    const token = `${activeEnv.id}:${activeEnv.updatedAt || ''}:${links.map((link) => {
      const activationId = link?.activationId || link?.kehrnel?.activationId || '';
      const checkedAt = link?.kehrnel?.coherence?.checkedAt || '';
      return `${link?.domain || ''}:${activationId}:${checkedAt}`;
    }).join('|')}`;

    if (autoValidationRef.current.get(activeEnv.id) === token) {
      return;
    }
    autoValidationRef.current.set(activeEnv.id, token);
    validateActivationCoherence({ silent: true });
  }, [activeEnv, activating, savingConfig, refreshingActivation, validatingActivation]);

  // Activate a strategy for the current environment
  const handleActivateStrategy = async (strategy, options = {}) => {
    if (!strategy?.id || !activeEnv?.id) {
      setActionError('No active environment. Please set an active environment first.');
      return;
    }

    setActivating(true);
    setActivationProgress({
      status: 'in_progress',
      progress: 25,
      steps: [
        {
          id: 'confirm_configuration',
          label: 'Configuration confirmed',
          status: 'completed',
          message: 'The configuration was reviewed before activation.',
        },
        {
          id: 'activate_strategy',
          label: 'Runtime activation',
          status: 'in_progress',
          message: 'Kehrnel is activating the strategy for this environment.',
        },
        {
          id: 'initialize_storage',
          label: 'Collections and indexes',
          status: 'pending',
          message: 'Waiting for runtime initialization.',
        },
        {
          id: 'bootstrap_dictionaries',
          label: 'Dictionary bootstrap',
          status: 'pending',
          message: 'Waiting for runtime initialization.',
        },
        {
          id: 'validate_environment',
          label: 'Environment coherence',
          status: 'pending',
          message: 'Validation will run after activation completes.',
        },
      ],
    });
    setActionError(null);
    setActionSuccess(null);

    try {
      const strategyId = strategy.id;
      const domain = strategy.domain;

      const res = await fetch('/api/environments/strategy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envId: activeEnv.id,
          strategyId,
          domain,
          configOverrides: configOverrides || {},
          configurationConfirmedAt: options.configurationConfirmedAt || new Date().toISOString(),
          force: options.force,
          reason: options.reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Handle both string errors and structured error objects
        const errorMsg = typeof data.error === 'string'
          ? data.error
          : data.error?.message || 'Failed to activate strategy';
        throw new Error(errorMsg);
      }

      const result = await res.json();
      setActivationProgress(result?.strategyLink?.kehrnel?.activationWorkflow || null);
      setActiveEnv(result.environment || null);
      setActiveStrategyLink(result.strategyLink);
      setActionSuccess(
        result?.strategyLink?.kehrnel?.coherence?.status === 'activated'
          ? `"${strategy.name}" is activated for ${domain}`
          : `"${strategy.name}" finished activation, but the environment still needs attention`
      );

      await fetchActiveEnvironment();

      if (onEnvironmentRefresh) {
        await onEnvironmentRefresh();
      }

      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error('activateStrategy error:', err);
      setActivationProgress((prev) => ({
        ...(prev || {}),
        status: 'failed',
        progress: 100,
        steps: Array.isArray(prev?.steps)
          ? prev.steps.map((step) => (
              step.id === 'activate_strategy'
                ? { ...step, status: 'error', message: err.message || 'Activation failed.' }
                : step
            ))
          : [],
      }));
      setActionError(err.message || 'Failed to activate strategy');
    } finally {
      setActivating(false);
    }
  };

  // Upgrade strategy activation
  const handleUpgrade = async (strategy) => {
    const domain = activeStrategyLink?.domain;
    if (!domain || !activeEnv?.id) return;

    setActivating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/kehrnel/environments/${activeEnv.id}/activations/${domain}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'manual-upgrade' })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'Upgrade failed');
      }
      await fetchActiveEnvironment();
      setActionSuccess(`Strategy upgraded for ${domain}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActivating(false);
    }
  };

  // Rollback strategy activation
  const handleRollback = async (strategy) => {
    const domain = activeStrategyLink?.domain;
    if (!domain || !activeEnv?.id) return;

    setActivating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/kehrnel/environments/${activeEnv.id}/activations/${domain}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'manual-rollback' })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'Rollback failed');
      }
      await fetchActiveEnvironment();
      setActionSuccess(`Strategy rolled back for ${domain}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActivating(false);
    }
  };

  // Delete strategy activation
  const handleDeleteActivation = async (domain) => {
    if (!domain || !activeEnv?.id) return;

    if (!confirm(`Deactivate strategy for ${domain}? You can activate another strategy later.`)) return;

    setActivating(true);
    setActionError(null);
    try {
      // Normalize domain to lowercase to match Kehrnel's storage format
      const normalizedDomain = domain.toLowerCase();
      const res = await fetch(`/api/kehrnel/environments/${activeEnv.id}/activations/${normalizedDomain}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'Deactivation failed');
      }

      // Refresh local environment state
      await fetchActiveEnvironment();
      if ((activeStrategyLink?.domain || '').toLowerCase() === normalizedDomain) {
        setActiveStrategyLink(null);
        setActivationProgress(null);
      }

      // Also refresh parent/header
      if (onEnvironmentRefresh) {
        await onEnvironmentRefresh();
      }

      setActionSuccess(`Strategy deactivated for ${domain}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActivating(false);
    }
  };

  // Refresh activation metadata and catalog from Kehrnel
  const handleRefreshActivation = async () => {
    if (!activeEnv?.id) return;

    setRefreshingActivation(true);
    setActionError(null);

    try {
      // Sync activation metadata
      const res = await fetch(`/api/kehrnel/environments/${activeEnv.id}/activations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to sync activation metadata');
      }

      // Also reload the catalog from Kehrnel (force refresh to bypass cache)
      const refreshed = await fetchStrategies(true);
      if (selected?.id && Array.isArray(refreshed)) {
        const found = refreshed.find(s => s.id === selected.id);
        if (found) setSelected(found);
      }
      await fetchActiveEnvironment();
      setActionSuccess('Catalog and activation metadata synced from Kehrnel');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error('refreshActivation error:', err);
      setActionError(err.message || 'Failed to sync from Kehrnel');
    } finally {
      setRefreshingActivation(false);
    }
  };

  // Sync catalog only (for use in strategy details) - forces cache bypass
  const handleSyncCatalog = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const refreshed = await fetchStrategies(true); // Force refresh to bypass server cache
      if (selected?.id && Array.isArray(refreshed)) {
        const found = refreshed.find(s => s.id === selected.id);
        if (found) setSelected(found);
      }
      setActionSuccess('Catalog synced from Kehrnel');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError(err.message || 'Failed to sync catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleApplySearchRefresh = async (link = activeStrategyLink) => {
    if (!activeEnv?.id || !link) return;

    const resolvedStrategyId = link?.kehrnel?.strategyId || link?.strategyId || null;
    if (!resolvedStrategyId) {
      setActionError('The active strategy could not be resolved for refresh.');
      return;
    }

    setRefreshingSearch(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/environments/strategy/search-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envId: activeEnv.id,
          domain: link?.domain || 'openEHR',
          strategyId: resolvedStrategyId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to refresh search projections');
      }

      const result = await res.json();
      await fetchActiveEnvironment();

      if (onEnvironmentRefresh) {
        await onEnvironmentRefresh();
      }

      const processed = result?.counts?.compositions;
      const jobId = result?.job?.id || result?.job?.jobId || result?.job?._id || null;
      setActionSuccess(
        Number.isFinite(processed)
          ? `Search refresh job queued for ${processed} composition${processed === 1 ? '' : 's'}${jobId ? ` (${String(jobId).slice(0, 8)})` : ''}`
          : `Search refresh job queued${jobId ? ` (${String(jobId).slice(0, 8)})` : ''}`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('handleApplySearchRefresh error:', err);
      setActionError(err.message || 'Failed to refresh search projections');
    } finally {
      setRefreshingSearch(false);
    }
  };

  // Save config overrides
  const handleSaveConfigOverrides = async () => {
    if (!activeEnv?.id || !activeStrategyLink) return;

    setSavingConfig(true);
    setActionError(null);

    try {
      const res = await fetch('/api/environments/strategy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envId: activeEnv.id,
          domain: activeStrategyLink.domain || 'openEHR',
          strategyId: activeStrategyLink.strategyId || null,
          configOverrides,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to save configuration');
      }

      const result = await res.json();
      setActiveStrategyLink(result.strategyLink);
      setConfigChanged(false);
      setActionSuccess('Configuration saved');

      if (onEnvironmentRefresh) {
        await onEnvironmentRefresh();
      }

      setTimeout(() => setActionSuccess(null), 2000);
    } catch (err) {
      console.error('saveConfigOverrides error:', err);
      setActionError(err.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleConfigChange = (path, value) => {
    setConfigOverrides(prev => {
      const updated = { ...prev };
      setNestedValue(updated, path, value);
      return updated;
    });
    setConfigChanged(true);
  };

  const handleReviewStrategy = (strategy) => {
    setSelected(strategy);
    const activeId = activeStrategyLink?.kehrnel?.strategyId || activeStrategyLink?.strategyId;
    if (!strategy?.id || strategy.id !== activeId) {
      setActivationProgress(null);
    }
  };

  const isStrategyActive = (strategy) => {
    const linkStrategyId = activeStrategyLink?.kehrnel?.strategyId || activeStrategyLink?.strategyId;
    return linkStrategyId === strategy.id;
  };

  // Get all active strategies by domain
  const activeStrategiesByDomain = useMemo(() => {
    const result = {};
    if (activeEnv?.strategyLinks) {
      for (const link of activeEnv.strategyLinks) {
        const domain = link.domain;
        const strategyId = link.kehrnel?.strategyId || link.strategyId;
        const found = strategies.find(s => s.id === strategyId);

        result[domain] = {
          link,
          strategy: found || {
            id: strategyId,
            name: link.strategyName || strategyId,
            domain: domain,
            source: 'kehrnel', // Mark as kehrnel so spec fetch is attempted
            version: link.kehrnel?.strategyVersion || null,
            maturity: link.kehrnel?.strategyMaturity || 'preview',
            description: `${domain} persistence strategy (Kehrnel offline - limited data available)`,
            kehrnel: link.kehrnel,
            capabilities: [],
            config_schema: null,
            default_config: null,
            _offline: true // Flag to indicate Kehrnel was offline
          }
        };
      }
    }
    return result;
  }, [activeEnv?.strategyLinks, strategies]);

  const hasAnyActiveStrategy = Object.keys(activeStrategiesByDomain).length > 0;

  // Filter strategies for display
  const filteredStrategies = useMemo(() => {
    return strategies.filter(strategy => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesName = strategy.name?.toLowerCase().includes(search);
        const matchesDescription = strategy.description?.toLowerCase().includes(search);
        const matchesTags = (strategy.ui?.tags || []).some(tag => tag.toLowerCase().includes(search));
        if (!matchesName && !matchesDescription && !matchesTags) {
          return false;
        }
      }

      if (domainFilter && domainFilter !== 'all') {
        if (strategy.domain !== domainFilter) {
          return false;
        }
      }

      return true;
    });
  }, [strategies, searchTerm, domainFilter]);

  const cards = useMemo(() => {
    return filteredStrategies.map(strategy => ({
      id: strategy.id,
      title: strategy.name,
      description: strategy.description || "",
      tags: strategy.ui?.tags || [],
      domain: strategy.domain,
      version: strategy.version,
      strategy,
    }));
  }, [filteredStrategies]);

  // Tabs configuration
  const tabs = [
    { id: 'active', label: 'Active Strategies', icon: Zap },
    { id: 'browse', label: 'Browse Strategies', icon: Search },
  ];

  // Render Active Strategies Tab
  const renderActiveTab = () => {
    if (envLoading || (loading && !strategies.length)) {
      return (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6 text-center">
          <RefreshCw className="w-8 h-8 text-primary mx-auto mb-3 animate-spin" />
          <h3 className="text-lg font-medium text-white mb-2">Loading strategies from Kehrnel</h3>
          <p className="text-sm text-slate-400">
            This can take a moment on first load.
          </p>
        </div>
      );
    }

    if (!activeEnv) {
      return (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-2">No Environment Configured</h3>
          <p className="text-sm text-amber-200/70">
            Please configure an environment in Settings before activating strategies.
          </p>
        </div>
      );
    }

    if (!hasAnyActiveStrategy) {
      // Empty state - invite to browse
      return (
        <div className="space-y-6">
          {/* Empty State Hero */}
          <div className="dark-banner relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 border border-slate-700 p-8 text-center">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDI4M2EiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJWMGgydjM0em0tNCAwSDI4VjBoNHYzNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />

            <div className="relative z-10">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-5">
                <Layers className="w-10 h-10 text-primary" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-3">
                No Active Strategies Yet
              </h2>
              <p className="text-slate-400 max-w-md mx-auto mb-6">
                Each data domain (openEHR, FHIR, Genomics) can have one active persistence strategy.
                Browse the catalog to find and activate the right strategy for your needs.
              </p>

              <button
                onClick={() => setActiveTab('browse')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-text rounded-xl font-medium hover:bg-primary-hover transition-all hover:shadow-lg hover:shadow-primary/20 group"
              >
                <Search className="w-5 h-5" />
                Browse Strategy Catalog
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Has active strategies - show as tabs with dashboard below each
    const activeDomains = Object.keys(activeStrategiesByDomain);

    // Keep selectedDomain in sync with available domains
    const effectiveDomain = selectedDomain && activeDomains.includes(selectedDomain)
      ? selectedDomain
      : activeDomains[0] || null;

    // Update state if it's out of sync (deferred to avoid render issues)
    if (effectiveDomain !== selectedDomain && effectiveDomain) {
      setTimeout(() => setSelectedDomain(effectiveDomain), 0);
    }

    const currentData = activeStrategiesByDomain[effectiveDomain];

    return (
      <div className="space-y-6">
        {/* Environment Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">
                Environment: <span className="text-slate-300">{activeEnv.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('browse')}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-primary transition-colors"
            >
              + Add Strategy
            </button>
            <button
              onClick={handleRefreshActivation}
              disabled={refreshingActivation}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingActivation ? 'animate-spin' : ''}`} />
              Sync
            </button>
          </div>
        </div>

        {/* Domain Tabs - when multiple active strategies (text-only for branding consistency) */}
        {activeDomains.length > 1 && (
          <div className="flex rounded-md border border-theme overflow-hidden w-fit">
            {activeDomains.map((domainId) => {
              const isSelected = effectiveDomain === domainId;
              return (
                <button
                  key={domainId}
                  onClick={() => setSelectedDomain(domainId)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-r border-theme last:border-r-0 ${
                    isSelected
                      ? 'bg-primary text-primary-text'
                      : 'surface hover:surface-hover text-theme-primary'
                  }`}
                >
                  {renderDomainChipLabel(domainId)}
                </button>
              );
            })}
          </div>
        )}

        {/* Active Strategy Card with integrated Database Overview */}
        {currentData && (
          <ActiveStrategyCard
            domainId={effectiveDomain}
            strategy={currentData.strategy}
            link={currentData.link}
            onViewDetails={() => setSelected(currentData.strategy)}
            onRefreshSearch={() => handleApplySearchRefresh(currentData.link)}
            onDeactivate={() => handleDeleteActivation(effectiveDomain)}
            activating={activating}
            refreshingSearch={refreshingSearch}
            showDatabaseOverview={true}
          />
        )}
      </div>
    );
  };

  // Render Catalog Tab (simplified)
  const toggleGuide = () => {
    const newState = !showGuide;
    setShowGuide(newState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hdl_strategy_guide_expanded', String(newState));
    }
  };

  const renderBrowseTab = () => {
    return (
      <div className="space-y-4">
        {/* Header with Sync button */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'} available from Kehrnel
          </p>
          <button
            onClick={handleSyncCatalog}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            title="Reload catalog from Kehrnel"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>

        {/* Filters */}
        <StrategyFilters
          filter={filter}
          options={FILTER_OPTIONS}
          onChange={setFilter}
          strategies={strategies}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          domainFilter={domainFilter}
          onDomainFilterChange={setDomainFilter}
        />

        {/* Strategy List */}
        {renderCatalogList()}
      </div>
    );
  };

  const renderCatalogList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Loading strategies...
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-900/30 border border-red-700 text-red-200 p-4 rounded-lg">
          {error}
          <button onClick={fetchStrategies} className="ml-3 text-sm underline">
            Retry
          </button>
        </div>
      );
    }

    if (!strategies.length) {
      return (
        <div className="text-center py-16 text-slate-400 border border-dashed border-slate-700 rounded-lg">
          No strategies available.
        </div>
      );
    }

    if (!filteredStrategies.length) {
      return (
        <div className="text-center py-12 text-slate-400 border border-dashed border-slate-700 rounded-lg">
          <p className="text-lg mb-2">No strategies match your filters</p>
          <p className="text-sm text-slate-500">Try adjusting your search or filter criteria</p>
        </div>
      );
    }

    const activeId = activeStrategyLink?.kehrnel?.strategyId || activeStrategyLink?.strategyId;

    return (
      <StrategyList
        cards={cards}
        selectedId={selected?.id}
        activeId={activeId}
        onSelect={handleReviewStrategy}
        onActivate={handleReviewStrategy}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Show full-page details when a strategy is selected */}
      {selected ? (
        <div>
          {/* Back button */}
          <button
            onClick={() => setSelected(null)}
            className="mb-4 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Strategy Studio
          </button>

          {/* Action messages */}
          {actionError && (
            <div className="mb-4 bg-red-900/30 border border-red-700 text-red-200 px-4 py-2 rounded-md text-sm">
              <span className="font-medium">Error:</span> {actionError}
            </div>
          )}
          {actionSuccess && (
            <div className="mb-4 bg-emerald-900/30 border border-emerald-700 text-emerald-200 px-4 py-2 rounded-md text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {actionSuccess}
            </div>
          )}

          {/* Full-page strategy details */}
          <EnhancedStrategyDetails
            strategy={selected}
            isActive={isStrategyActive(selected)}
            strategyLink={isStrategyActive(selected) ? activeStrategyLink : null}
            activeEnv={activeEnv}
            configOverrides={configOverrides}
            configChanged={configChanged}
            searchRefresh={isStrategyActive(selected) ? activeStrategyLink?.searchRefresh || null : null}
            onActivate={handleActivateStrategy}
            onConfigChange={handleConfigChange}
            onSaveConfig={handleSaveConfigOverrides}
            onApplySearchRefresh={handleApplySearchRefresh}
            onSyncCatalog={handleSyncCatalog}
            activating={activating}
            activationProgress={activationProgress}
            validatingActivation={validatingActivation}
            savingConfig={savingConfig}
            refreshingSearch={refreshingSearch}
            syncingCatalog={loading}
          />
        </div>
      ) : (
        /* Tab-based view */
        <>
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white">Strategy Studio</h1>
            <p className="text-sm text-slate-400">
              Manage persistence strategies for your healthcare data
            </p>
          </div>

          {/* Learn Section - visible across the Strategy Studio */}
          <div className="border border-slate-700/50 rounded-lg overflow-hidden">
            <button
              onClick={toggleGuide}
              className="w-full px-4 py-2.5 flex items-center justify-between text-sm hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-2 text-slate-400">
                <HelpCircle className="w-4 h-4" />
                <span>What is a Persistence Strategy?</span>
              </div>
              {showGuide ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
            </button>
            {showGuide && (
              <div className="px-4 pb-4 pt-2 text-sm border-t border-slate-700/50">
                <p className="text-slate-300 mb-3">
                  A <strong className="text-white">Persistence Strategy</strong> is the core of Healthcare Data Lab.
                  It defines a Data Model for a domain and a query pattern, with configurable parameters.
                </p>
                <p className="text-slate-400 mb-2">Each strategy exposes:</p>
                <ul className="text-slate-400 space-y-1 ml-4 list-disc">
                  <li>Data transformation and ingestion libraries (single document to bulk)</li>
                  <li>Indexing patterns optimized for the data model</li>
                  <li>Mapping libraries for legacy document migration</li>
                  <li>Synthetic data generation</li>
                  <li>Query patterns (FHIR, AQL for openEHR, and custom patterns)</li>
                </ul>
              </div>
            )}
          </div>

          {/* CC BY 4.0 License Notice */}
          <LicenseNotice variant="banner" />

          {/* Tab Navigation */}
          <div className="border-b border-slate-700">
            <nav className="flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const count = tab.id === 'active' ? Object.keys(activeStrategiesByDomain).length : null;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {count !== null && count > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-emerald-600/30 text-emerald-300">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Action messages */}
          {actionError && (
            <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-2 rounded-md text-sm">
              <span className="font-medium">Error:</span> {actionError}
            </div>
          )}
          {actionSuccess && (
            <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-200 px-4 py-2 rounded-md text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {actionSuccess}
            </div>
          )}

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === 'active' && renderActiveTab()}
            {activeTab === 'browse' && renderBrowseTab()}
          </div>

          {/* Trademark Disclaimers */}
          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <TrademarkDisclaimers variant="block" className="text-slate-500" />
          </div>
        </>
      )}
    </div>
  );
};

// Active Strategy Card Component - larger format with full details and collapsible database overview
const ActiveStrategyCard = ({
  domainId,
  strategy,
  link,
  onViewDetails,
  onRefreshSearch,
  onDeactivate,
  activating,
  refreshingSearch,
  showDatabaseOverview = false
}) => {
  const [dbExpanded, setDbExpanded] = useState(true);
  const refreshRequired = !!link?.searchRefresh?.required;
  const refreshSourceName = link?.searchRefresh?.source?.dataModelName || link?.searchRefresh?.source?.templateId || null;
  const refreshJobId = link?.searchRefresh?.jobId || null;
  const refreshJobStatus = link?.searchRefresh?.jobStatus || null;
  const refreshJobActive = ['queued', 'running', 'canceling'].includes(String(refreshJobStatus || '').toLowerCase());
  const refreshJobLabel = refreshJobId
    ? `${refreshJobStatus || 'queued'}: ${String(refreshJobId).slice(0, 8)}`
    : null;
  const coherenceStatus = String(link?.kehrnel?.coherence?.status || '').toLowerCase();
  const statusBadge = coherenceStatus === 'activated'
    ? {
        label: 'Activated',
        className: 'text-emerald-300 bg-emerald-900/30 border-emerald-600/40',
      }
    : coherenceStatus
      ? {
          label: coherenceStatus === 'mismatch' || coherenceStatus === 'missing' ? 'Needs Attention' : 'Validating',
          className: 'text-amber-200 bg-amber-900/30 border-amber-700/40',
        }
      : {
          label: 'Active',
          className: 'text-emerald-400 bg-emerald-900/30 border-emerald-600/40',
        };

  // Get theme from DOMAIN_THEMES (handles case-insensitive matching)
  const theme = DOMAIN_THEMES[domainId] || DOMAIN_THEMES[domainId?.toLowerCase()] ||
    Object.entries(DOMAIN_THEMES).find(([k]) => k.toLowerCase() === domainId?.toLowerCase())?.[1] ||
    DOMAIN_THEMES.Custom;

  return (
    <div
      className="dark-banner rounded-xl border bg-slate-800/40 overflow-hidden"
      style={{ borderColor: `${theme.primary}40` }}
    >
      {/* Card Header with gradient */}
      <div
        className="p-6"
        style={{ background: `linear-gradient(135deg, ${theme.primary}15 0%, transparent 100%)` }}
      >
        <div className="flex items-start gap-5">
          {/* Domain Logo/Icon - larger */}
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center border-2 bg-slate-900/60 flex-shrink-0"
            style={{ borderColor: theme.primary }}
          >
            {(() => {
              if (theme.iconPath) {
                return <img src={theme.iconPath} alt="domain icon" className="w-8 h-8 object-contain" />;
              }
              const IconComponent = DOMAIN_ICONS[theme.icon] || UserRound;
              return <IconComponent className="w-8 h-8" style={{ color: theme.primary }} />;
            })()}
          </div>

          {/* Strategy Info */}
          <div className="flex-1 min-w-0">
            {/* Domain chip - aligned with title */}
            <div className="mb-2">
              <span
                className="inline-block px-2.5 py-1 rounded-md text-xs font-medium border"
                style={{ borderColor: `${theme.primary}50`, backgroundColor: `${theme.primary}20`, color: theme.primary }}
              >
                {renderDomainChipLabel(domainId)}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-semibold text-white">{strategy.name}</h3>
              <span className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full border ${statusBadge.className}`}>
                <Zap className="w-3.5 h-3.5" />
                {statusBadge.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-3">{strategy.description}</p>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {link?.kehrnel?.strategyVersion && (
                <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded">
                  v{link.kehrnel.strategyVersion}
                </span>
              )}
              {strategy.capabilities?.slice(0, 3).map(cap => (
                <span key={cap} className="px-2 py-1 bg-purple-900/30 text-purple-300 rounded border border-purple-600/30">
                  {cap}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={onViewDetails}
              className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-primary-text rounded-lg transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Explore
            </button>
            {refreshRequired && (
              <button
                onClick={onRefreshSearch}
                disabled={refreshingSearch || refreshJobActive}
                className="px-4 py-2 text-sm bg-amber-900/30 hover:bg-amber-900/50 text-amber-200 rounded-lg transition-colors border border-amber-700/40 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${refreshingSearch || refreshJobActive ? 'animate-spin' : ''}`} />
                {refreshingSearch ? 'Queueing...' : (refreshJobActive ? 'Queued' : 'Queue Refresh')}
              </button>
            )}
            <button
              onClick={onDeactivate}
              disabled={activating}
              className="px-4 py-2 text-sm bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg transition-colors border border-red-700/40"
            >
              Deactivate
            </button>
          </div>
        </div>

        {refreshRequired && (
          <div className="mt-4 rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-100">Search projections need a refresh</p>
                <p className="text-xs text-amber-200/80 mt-1">
                  Analytics template changes affected this strategy&apos;s slim search collection.
                  {refreshSourceName ? ` Latest change: ${refreshSourceName}.` : ''}
                  {refreshJobLabel ? ` Refresh job ${refreshJobLabel}.` : ''}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activation Info Footer */}
      {link?.kehrnel && (
        <div className="px-6 py-3 bg-slate-900/40 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            {link.kehrnel.activatedAt && (
              <span>Activated: {new Date(link.kehrnel.activatedAt).toLocaleDateString()}</span>
            )}
            {link.kehrnel.activationId && (
              <span className="font-mono text-slate-600">ID: {link.kehrnel.activationId.slice(0, 8)}...</span>
            )}
          </div>
          {link.kehrnel.syncedAt && (
            <span>Last synced: {new Date(link.kehrnel.syncedAt).toLocaleTimeString()}</span>
          )}
        </div>
      )}

      {/* Collapsible Database Overview */}
      {showDatabaseOverview && (
        <div className="border-t border-slate-700/50">
          <button
            onClick={() => setDbExpanded(!dbExpanded)}
            className="w-full px-6 py-3 flex items-center justify-between text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              <span>Database Collections</span>
            </div>
            {dbExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {dbExpanded && (
            <div className="px-6 pb-5">
              <DatabaseOverview domain={domainId} inline />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StrategyManager;

// Helper: Set a nested value in an object by path
function setNestedValue(target, path, value) {
  if (!path) return;
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cursor[key] === undefined || cursor[key] === null || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}
