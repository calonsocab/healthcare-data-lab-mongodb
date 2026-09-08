// src/components/views/settings/EnvironmentSettings.jsx
"use client";

import React, { useState } from 'react';
import {
  Database, Plus, Trash2,
  ChevronDown, ChevronUp,
  RefreshCw, Loader2, CheckCircle, XCircle, Check,
  Link2, X, Layers, List, ExternalLink, Server, FlaskConical,
  Shield, Lock, AlertCircle, Download, Upload
} from 'lucide-react';
import { usePersistenceStrategies } from '@/providers/PersistenceStrategyProvider';
import { PROMOTABLE_ENVIRONMENT_ASSETS } from '@/lib/environments/promotion';

// Kehrnel Logo Component
const KehrnelLogo = ({ size = 'sm' }) => {
  const textSize = size === 'sm' ? 'text-lg' : 'text-2xl';
  return (
    <div className={`flex items-center ${textSize} font-bold`}>
      <span className="text-[#4A9EBD]">{`{ `}</span>
      <span className="text-[#EA6635]">k</span>
      <span className="text-[#4A9EBD]">e</span>
      <span className="text-[#4A9EBD]">h</span>
      <span className="text-[#4A9EBD]">r</span>
      <span className="text-[#EA6635]">n</span>
      <span className="text-[#EA6635]">e</span>
      <span className="text-[#EA6635]">l</span>
      <span className="text-[#4A9EBD]">{` }`}</span>
    </div>
  );
};

function createEmptyEnvironmentDraft() {
  return {
    name: '',
    description: '',
    connectionString: '',
    database: 'openEHR-DataLab',
    domainDatabases: {},
    isActive: false,
    strategyLinks: [],
    kehrnel: {
      useDefault: true,
      apiUrl: ''
    }
  };
}

const EnvironmentSettings = ({ team, preferences, activeEnvironment, onUpdate, onEnvironmentChange, isIndividual, currentUser }) => {
  const currentEnvironments = team?.environments || preferences?.environments || [];
  const [environments, setEnvironments] = useState(currentEnvironments);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedEnvs, setExpandedEnvs] = useState({});
  const [expandedSections, setExpandedSections] = useState({}); // Track which sections are expanded { envId: { mongodb: true, kehrnel: false } }
  const [configuredSecrets, setConfiguredSecrets] = useState({}); // Track which envs have secrets
  const [testingKehrnel, setTestingKehrnel] = useState({});
  const [kehrnelTestResults, setKehrnelTestResults] = useState({});
  const {
    strategies: strategyOptions,
    loading: strategiesLoading,
    error: strategyError
  } = usePersistenceStrategies();
  const [linkForms, setLinkForms] = useState({});
  const [showLinkForm, setShowLinkForm] = useState({});
  const [kehrnelInstances, setKehrnelInstances] = useState([]);
  const [strategyWizard, setStrategyWizard] = useState({});
  const [error, setError] = useState('');
  const [newEnvSections, setNewEnvSections] = useState({ mongodb: true, kehrnel: false }); // For Add Environment form
  // T1: Kehrnel catalog preview state
  const [showCatalogModal, setShowCatalogModal] = useState(null); // env.id when open
  const [catalogStrategies, setCatalogStrategies] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [activations, setActivations] = useState({});
  const [activationsLoading, setActivationsLoading] = useState({});
  const [activationsError, setActivationsError] = useState({});
  const [upgradeHints, setUpgradeHints] = useState({});
  const [promotionDialog, setPromotionDialog] = useState({
    open: false,
    targetEnvId: '',
    sourceEnvId: '',
    includeRuntimeConfig: false,
  });
  const [promotionSubmitting, setPromotionSubmitting] = useState(false);
  const [promotionError, setPromotionError] = useState('');
  const [bundleExporting, setBundleExporting] = useState({});
  const [bundleImportDialog, setBundleImportDialog] = useState({
    open: false,
    targetEnvId: '',
    includeRuntimeConfig: false,
    file: null,
    fileName: '',
  });
  const [bundleImportSubmitting, setBundleImportSubmitting] = useState(false);
  const [bundleImportError, setBundleImportError] = useState('');
  const environmentIdsKey = environments.map((env) => env.id).filter(Boolean).join(',');

  // Determine if current user is an admin (for team mode)
  const normalizeRole = (value = '') => String(value || '').trim().toLowerCase();
  const getUserRole = () => {
    if (isIndividual) return 'owner';

    const explicitRole = normalizeRole(team?.currentUserRole || team?.userRole);
    if (explicitRole) return explicitRole;

    if (!Array.isArray(team?.members) || !currentUser?.email) return 'member';

    const member = team.members.find(
      (m) => m.email?.toLowerCase() === currentUser.email.toLowerCase()
    );
    return normalizeRole(member?.role) || 'member';
  };
  const userRole = getUserRole();
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const [newEnvironment, setNewEnvironment] = useState({
    ...createEmptyEnvironmentDraft()
  });

  const normalizeActiveEnvironments = (envs = []) => {
    if (!envs.length) return envs;
    const activeIndex = envs.findIndex((env) => env.isActive);
    if (activeIndex === -1) {
      return envs.map((env, index) => ({ ...env, isActive: index === 0 }));
    }
    return envs.map((env, index) => ({ ...env, isActive: index === activeIndex }));
  };

  const hasNewEnvironmentDraft = () => {
    const draft = newEnvironment || {};
    const defaultDraft = createEmptyEnvironmentDraft();
    return (
      draft.name !== defaultDraft.name ||
      draft.description !== defaultDraft.description ||
      draft.connectionString !== defaultDraft.connectionString ||
      draft.database !== defaultDraft.database ||
      !!draft.isActive ||
      draft.kehrnel?.useDefault !== defaultDraft.kehrnel.useDefault ||
      (draft.kehrnel?.apiUrl || '') !== defaultDraft.kehrnel.apiUrl
    );
  };

  const buildNewEnvironmentDraft = () => {
    const name = newEnvironment.name.trim();
    const database = newEnvironment.database.trim();
    const connectionString = newEnvironment.connectionString.trim();

    if (!name) {
      throw new Error('Environment name is required');
    }
    if (!database) {
      throw new Error('Database name is required');
    }
    if (!connectionString) {
      throw new Error('Connection string is required');
    }

    return {
      ...newEnvironment,
      name,
      database,
      connectionString,
      description: (newEnvironment.description || '').trim(),
      id: `env-${Date.now()}`
    };
  };

  const resetNewEnvironmentForm = () => {
    setShowAddForm(false);
    setNewEnvironment(createEmptyEnvironmentDraft());
    setNewEnvSections({ mongodb: true, kehrnel: false });
  };

  const handleAddEnvironment = () => {
    try {
      const env = buildNewEnvironmentDraft();
      const nextEnvironments = normalizeActiveEnvironments([...environments, env]);
      setEnvironments(nextEnvironments);
      resetNewEnvironmentForm();
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to add environment');
    }
  };

  const updateEnvironmentField = (envId, field, value) => {
    setEnvironments(prev => prev.map(env =>
      env.id === envId ? { ...env, [field]: value } : env
    ));
  };

  // Toggle section expansion (MongoDB/Kehrnel) within an environment - accordion behavior
  const toggleSection = (envId, section) => {
    setExpandedSections(prev => {
      const currentState = prev[envId]?.[section];
      // If opening a section, close the other one (accordion)
      if (!currentState) {
        return {
          ...prev,
          [envId]: {
            mongodb: section === 'mongodb',
            kehrnel: section === 'kehrnel'
          }
        };
      }
      // If closing, just close it
      return {
        ...prev,
        [envId]: {
          ...prev[envId],
          [section]: false
        }
      };
    });
  };

  // Get sections state with defaults (both collapsed by default)
  const getSections = (envId) => {
    return expandedSections[envId] || { mongodb: false, kehrnel: false };
  };

  // Fetch which environments have connection secrets configured
  React.useEffect(() => {
    const fetchSecretStatus = async () => {
      if (!environmentIdsKey) {
        setConfiguredSecrets({});
        return;
      }
      try {
        const res = await fetch(`/api/environments/secure?envIds=${encodeURIComponent(environmentIdsKey)}`);
        if (res.ok) {
          const data = await res.json();
          setConfiguredSecrets(data.configured || {});
        }
      } catch (err) {
        console.error('Failed to fetch secret status:', err);
      }
    };
    fetchSecretStatus();
  }, [environmentIdsKey]);

  React.useEffect(() => {
    const loadInstances = async () => {
      try {
        const res = await fetch('/api/kehrnel/instances');
        if (res.ok) {
          const data = await res.json();
          setKehrnelInstances(data.instances || []);
        }
      } catch (err) {
        console.error('loadInstances error:', err);
      }
    };
    loadInstances();
  }, []);

  const handleRemoveEnvironment = (id) => {
    if (confirm('Are you sure you want to remove this environment?')) {
      setEnvironments(environments.filter(env => env.id !== id));
    }
  };

  const handleSetActive = (id) => {
    setEnvironments((prev) => prev.map((env) => ({
      ...env,
      isActive: env.id === id
    })));
    setError('');
    setSuccessMessage('Active environment selected. Save Environment Settings to apply the change.');
    onEnvironmentChange(id);
  };

  const promotionSourceOptions = promotionDialog.targetEnvId
    ? environments.filter((environment) => environment.id !== promotionDialog.targetEnvId)
    : [];

  const openPromotionDialog = (targetEnvId) => {
    const defaultSource = environments.find(
      (environment) => environment.id !== targetEnvId && environment.isActive
    )?.id || environments.find((environment) => environment.id !== targetEnvId)?.id || '';

    setPromotionDialog({
      open: true,
      targetEnvId,
      sourceEnvId: defaultSource,
      includeRuntimeConfig: false,
    });
    setPromotionError('');
    setError('');
  };

  const closePromotionDialog = (force = false) => {
    if (promotionSubmitting && !force) return;
    setPromotionDialog({
      open: false,
      targetEnvId: '',
      sourceEnvId: '',
      includeRuntimeConfig: false,
    });
    setPromotionError('');
  };

  const parseDownloadFileName = (contentDisposition, fallback) => {
    const match = /filename="([^"]+)"/i.exec(contentDisposition || '');
    return match?.[1] || fallback;
  };

  const triggerBlobDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleExportBundle = async (env) => {
    setBundleExporting((prev) => ({ ...prev, [env.id]: true }));
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/environments/bundle/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envId: env.id }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to export data bundle');
      }

      const blob = await response.blob();
      const filename = parseDownloadFileName(
        response.headers.get('content-disposition'),
        `${env.name || 'environment'}_asset_bundle.zip`
      );
      triggerBlobDownload(blob, filename);
      setSuccessMessage(`Exported data bundle for ${env.name}. The ZIP is optimized for large model documents, including embedded OPT XML.`);
    } catch (bundleExportError) {
      setError(bundleExportError.message || 'Failed to export data bundle');
    } finally {
      setBundleExporting((prev) => ({ ...prev, [env.id]: false }));
    }
  };

  const openBundleImportDialog = (targetEnvId) => {
    setBundleImportDialog({
      open: true,
      targetEnvId,
      includeRuntimeConfig: false,
      file: null,
      fileName: '',
    });
    setBundleImportError('');
    setError('');
  };

  const closeBundleImportDialog = (force = false) => {
    if (bundleImportSubmitting && !force) return;
    setBundleImportDialog({
      open: false,
      targetEnvId: '',
      includeRuntimeConfig: false,
      file: null,
      fileName: '',
    });
    setBundleImportError('');
  };

  const handleBundleImport = async () => {
    if (!bundleImportDialog.targetEnvId || !bundleImportDialog.file) {
      setBundleImportError('Select a bundle ZIP file first.');
      return;
    }

    setBundleImportSubmitting(true);
    setBundleImportError('');
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('envId', bundleImportDialog.targetEnvId);
      formData.append('includeRuntimeConfig', String(bundleImportDialog.includeRuntimeConfig));
      formData.append('bundle', bundleImportDialog.file);

      const response = await fetch('/api/environments/bundle/import', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to import data bundle');
      }

      if (payload?.includeRuntimeConfig && payload?.targetEnvironment?.id) {
        setEnvironments((prev) => prev.map((environment) => (
          environment.id === payload.targetEnvironment.id
            ? {
                ...environment,
                ...payload.targetEnvironment,
                connectionString: environment.connectionString || '',
              }
            : environment
        )));
      }

      const collectionSummary = Array.isArray(payload.importedCollections)
        ? payload.importedCollections
            .filter((item) => item.importedCount > 0 || item.replacedCount > 0)
            .map((item) => `${item.label}: ${item.importedCount}`)
            .join(' · ')
        : '';

      setSuccessMessage(
        `Imported ${payload.totalDocumentsImported || 0} asset documents into ${payload.target?.name || 'target'} from bundle${payload.includeRuntimeConfig ? ', including strategy/runtime configuration' : ''}.${collectionSummary ? ` ${collectionSummary}` : ''}`
      );
      closeBundleImportDialog(true);
    } catch (bundleImportRunError) {
      setBundleImportError(bundleImportRunError.message || 'Failed to import data bundle');
    } finally {
      setBundleImportSubmitting(false);
    }
  };

  const handleRunPromotion = async () => {
    if (!promotionDialog.sourceEnvId || !promotionDialog.targetEnvId) {
      setPromotionError('Choose both source and target environments.');
      return;
    }

    setPromotionSubmitting(true);
    setPromotionError('');
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/environments/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceEnvId: promotionDialog.sourceEnvId,
          targetEnvId: promotionDialog.targetEnvId,
          includeRuntimeConfig: promotionDialog.includeRuntimeConfig,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to promote environment assets');
      }

      if (payload?.includeRuntimeConfig && payload?.targetEnvironment?.id) {
        setEnvironments((prev) => prev.map((environment) => (
          environment.id === payload.targetEnvironment.id
            ? {
                ...environment,
                ...payload.targetEnvironment,
                connectionString: environment.connectionString || '',
              }
            : environment
        )));
      }

      const collectionSummary = Array.isArray(payload.promotedCollections)
        ? payload.promotedCollections
            .filter((item) => item.sourceCount > 0 || item.replacedCount > 0)
            .map((item) => `${item.label}: ${item.sourceCount}`)
            .join(' · ')
        : '';

      setSuccessMessage(
        `Promoted ${payload.totalDocumentsPromoted || 0} asset documents from ${payload.source?.name || 'source'} to ${payload.target?.name || 'target'}${payload.includeRuntimeConfig ? ', including strategy/runtime configuration' : ''}.${collectionSummary ? ` ${collectionSummary}` : ''}`
      );
      closePromotionDialog(true);
    } catch (promotionRunError) {
      setPromotionError(promotionRunError.message || 'Failed to promote environment assets');
    } finally {
      setPromotionSubmitting(false);
    }
  };

  const toggleEnvExpand = (envId) => {
    setExpandedEnvs(prev => ({ ...prev, [envId]: !prev[envId] }));
  };

  const updateEnvironmentKehrnel = (envId, kehrnelConfig) => {
    setEnvironments(prev => prev.map(env =>
      env.id === envId ? { ...env, kehrnel: kehrnelConfig } : env
    ));
  };

  const toggleLinkForm = (envId) => {
    setShowLinkForm(prev => ({ ...prev, [envId]: !prev[envId] }));
    setLinkForms(prev => ({
      ...prev,
      [envId]: prev[envId] || {
        strategyId: '',
        alias: '',
        contexts: { synthetic: true, query: true, api: false },
        apiBasePath: ''
      }
    }));
  };

  const updateLinkForm = (envId, patch) => {
    setLinkForms(prev => ({
      ...prev,
      [envId]: {
        ...(prev[envId] || { contexts: { synthetic: true, query: true, api: false } }),
        ...patch
      }
    }));
  };

  const getWizardState = (envId) => strategyWizard[envId] || {
    selectedInstanceId: kehrnelInstances.find(i => i.isDefault)?._id || '',
    catalog: [],
    loadingCatalog: false,
    selectedDomain: '',
    selectedStrategyId: '',
    defaults: {},
    overridesText: '{}',
    mergedPreview: {},
    activating: false,
    error: '',
    success: '',
    endpoints: null
  };

  const updateWizardState = (envId, patch) => {
    setStrategyWizard(prev => ({
      ...prev,
      [envId]: { ...getWizardState(envId), ...patch }
    }));
  };

  const mergeDeep = (target, source) => {
    if (typeof target !== 'object' || target === null) return source;
    const output = Array.isArray(target) ? [...target] : { ...target };
    if (typeof source !== 'object' || source === null) return output;
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = mergeDeep(output[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    });
    return output;
  };

  const loadWizardCatalog = async (envId, connectionId) => {
    updateWizardState(envId, { loadingCatalog: true, error: '', success: '' });
    try {
      const params = new URLSearchParams();
      if (connectionId) params.set('connectionId', connectionId);
      const res = await fetch(`/api/kehrnel/catalog?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load catalog');
      updateWizardState(envId, { catalog: data.strategies || [], loadingCatalog: false, selectedStrategyId: '', selectedDomain: '' });
    } catch (err) {
      updateWizardState(envId, { loadingCatalog: false, error: err.message || 'Failed to load catalog' });
    }
  };

  const handleSelectStrategy = (envId, strategyId) => {
    const state = getWizardState(envId);
    const strat = state.catalog.find(s => (s.id || s.strategy_id) === strategyId);
    const defaults = strat?.defaults || strat?.default_config || {};
    updateWizardState(envId, {
      selectedStrategyId: strategyId,
      selectedDomain: strat?.domain || state.selectedDomain,
      defaults,
      mergedPreview: mergeDeep(defaults || {}, {})
    });
  };

  const handleActivateWizard = async (envId) => {
    const state = getWizardState(envId);
    if (!state.selectedStrategyId || !state.selectedDomain) {
      updateWizardState(envId, { error: 'Select a domain and strategy first' });
      return;
    }
    let overrides = {};
    try {
      overrides = state.overridesText ? JSON.parse(state.overridesText) : {};
    } catch (err) {
      updateWizardState(envId, { error: 'Overrides must be valid JSON' });
      return;
    }
    const mergedConfig = mergeDeep(state.defaults || {}, overrides || {});
    updateWizardState(envId, { activating: true, error: '', success: '' });
    try {
      const res = await fetch(`/api/kehrnel/environments/${envId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: state.selectedStrategyId,
          domain: state.selectedDomain,
          config: mergedConfig,
          connectionId: state.selectedInstanceId || undefined,
          reason: 'HDL activation'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const errPayload = data?.error;
        const message = typeof errPayload === 'object' ? `${errPayload.code || ''} ${errPayload.message || ''}`.trim() : (errPayload || 'Activation failed');
        throw new Error(message || 'Activation failed');
      }

      // Fetch endpoints snapshot
      let endpoints = null;
      try {
        const epRes = await fetch(`/api/kehrnel/environments/${envId}/endpoints?domain=${encodeURIComponent(state.selectedDomain)}${state.selectedInstanceId ? `&connectionId=${encodeURIComponent(state.selectedInstanceId)}` : ''}`);
        const epData = await epRes.json();
        if (epRes.ok) {
          endpoints = epData.endpoints || epData;
        }
      } catch (err) {
        console.warn('Endpoints fetch failed:', err.message);
      }

      // Update environment strategyLinks in UI state
      setEnvironments(prev => prev.map(env => {
        if (env.id !== envId) return env;
        const links = Array.isArray(env.strategyLinks) ? [...env.strategyLinks] : [];
        const idx = links.findIndex(l => l.domain === state.selectedDomain);
        const newLink = {
          id: `link-${state.selectedDomain}-${Date.now()}`,
          domain: state.selectedDomain,
          strategyId: state.selectedStrategyId,
          strategyName: state.catalog.find(s => (s.id || s.strategy_id) === state.selectedStrategyId)?.name || state.selectedStrategyId,
          strategyVersion: data.strategyVersion || null,
          activationId: data.activationId || data.activation_id || null,
          configHash: data.configHash || null,
          manifestDigest: data.manifestDigest || null,
          configOverrides: overrides,
          mergedConfig,
          endpointsSnapshot: endpoints,
          contexts: { synthetic: true, query: true, api: true },
          kehrnel: {
            connectionId: data.connection?.connectionId || null,
            runtimeUrl: data.connection?.url || null,
            lastStatus: data.status || 'ok',
            activationId: data.activationId || data.activation_id || null,
            manifestDigest: data.manifestDigest || null,
            configHash: data.configHash || null,
            strategyVersion: data.strategyVersion || null,
            endpointsSnapshot: endpoints
          }
        };
        if (idx >= 0) {
          links[idx] = newLink;
        } else {
          links.push(newLink);
        }
        return { ...env, strategyLinks: links };
      }));

      updateWizardState(envId, {
        activating: false,
        success: 'Activated successfully',
        error: '',
        mergedPreview: mergedConfig,
        endpoints
      });
    } catch (err) {
      updateWizardState(envId, { activating: false, error: err.message || 'Activation failed' });
    }
  };

  const handleAddStrategyLink = (envId) => {
    const draft = linkForms[envId];
    if (!draft?.strategyId) return;
    const strategy = strategyOptions.find(s => (s._id || s.id)?.toString() === draft.strategyId);
    const domain = strategy?.blueprint?.domain?.[0] || 'openEHR';
    const newLink = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      strategyId: draft.strategyId,
      strategyName: strategy?.name || 'Strategy',
      alias: draft.alias || strategy?.name || 'Strategy',
      domain,
      contexts: {
        synthetic: !!draft.contexts?.synthetic,
        query: !!draft.contexts?.query,
        api: !!draft.contexts?.api
      },
      apiBasePath: draft.apiBasePath || ''
    };

    setEnvironments(prev => prev.map(env =>
      env.id === envId
        ? { ...env, strategyLinks: [...(env.strategyLinks || []), newLink] }
        : env
    ));
    setLinkForms(prev => ({ ...prev, [envId]: null }));
    setShowLinkForm(prev => ({ ...prev, [envId]: false }));
  };

  const loadActivations = async (envId) => {
    setActivationsLoading(prev => ({ ...prev, [envId]: true }));
    setActivationsError(prev => ({ ...prev, [envId]: '' }));
    try {
      const res = await fetch(`/api/kehrnel/environments/${envId}/activations`);
      const data = await res.json();
      if (!res.ok) {
        const errPayload = data?.error;
        const message = typeof errPayload === 'object' ? errPayload.message : data.error;
        throw new Error(message || 'Failed to load activations');
      }
      // Ensure we always get an array - API may return { activations: [...] } or [...] directly
      const list = Array.isArray(data.activations) ? data.activations
                 : Array.isArray(data) ? data
                 : [];
      setActivations(prev => ({ ...prev, [envId]: list }));
    } catch (err) {
      setActivationsError(prev => ({ ...prev, [envId]: err.message || 'Failed to load activations' }));
    } finally {
      setActivationsLoading(prev => ({ ...prev, [envId]: false }));
    }
  };

  const syncActivationToEnv = async (envId, domain) => {
    await loadActivations(envId);
    try {
      const endpointsRes = await fetch(`/api/kehrnel/environments/${envId}/endpoints?domain=${encodeURIComponent(domain)}`);
      const epJson = await endpointsRes.json().catch(() => ({}));
      const endpointsSnapshot = endpointsRes.ok ? (epJson.endpoints || epJson) : null;
      const activationList = Array.isArray(activations[envId]) ? activations[envId] : [];
      const activation = activationList.find(a => (a.domain || a.strategy_domain) === domain);
      setEnvironments(prev => prev.map(env => {
        if (env.id !== envId) return env;
        const links = (env.strategyLinks || []).map(link => {
          if (link.domain !== domain) return link;
          return {
            ...link,
            activationId: activation?.activation_id || activation?.activationId || link.activationId || null,
            manifestDigest: activation?.manifest_digest || link.manifestDigest || null,
            configHash: activation?.config_hash || link.configHash || null,
            strategyVersion: activation?.strategy_version || link.strategyVersion || null,
            kehrnel: {
              ...(link.kehrnel || {}),
              lastStatus: activation?.status || link.kehrnel?.lastStatus || 'ok',
              endpointsSnapshot: endpointsSnapshot || link.kehrnel?.endpointsSnapshot || null
            }
          };
        });
        return { ...env, strategyLinks: links };
      }));
    } catch (err) {
      console.warn('Failed to sync activation to env', err);
    }
  };

  const handleLifecycleAction = async (envId, domain, action) => {
    const reason = prompt(`Reason for ${action}? (optional)`) || undefined;
    let method = 'POST';
    let path = '';
    if (action === 'upgrade') {
      path = `/api/kehrnel/environments/${envId}/activations/${domain}/upgrade`;
    } else if (action === 'rollback') {
      path = `/api/kehrnel/environments/${envId}/activations/${domain}/rollback`;
    } else if (action === 'delete') {
      const confirmText = prompt(`Type the domain "${domain}" to confirm deletion`);
      if (confirmText !== domain) return;
      method = 'DELETE';
      path = `/api/kehrnel/environments/${envId}/activations/${domain}`;
    } else {
      return;
    }

    try {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify({ reason })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errPayload = data?.error;
        const message = typeof errPayload === 'object' ? `${errPayload.code || ''} ${errPayload.message || ''}`.trim() : (errPayload || 'Action failed');
        const error = new Error(message || 'Action failed');
        error.status = res.status;
        throw error;
      }
      setUpgradeHints(prev => {
        const current = { ...(prev[envId] || {}) };
        delete current[domain];
        return { ...prev, [envId]: current };
      });
      await syncActivationToEnv(envId, domain);
    } catch (err) {
      if (err?.status === 409) {
        setUpgradeHints(prev => ({
          ...prev,
          [envId]: { ...(prev[envId] || {}), [domain]: true }
        }));
      }
      alert(err.message || 'Action failed');
    }
  };

  const handleRemoveStrategyLink = (envId, linkId) => {
    setEnvironments(prev => prev.map(env =>
      env.id === envId
        ? { ...env, strategyLinks: (env.strategyLinks || []).filter(link => link.id !== linkId) }
        : env
    ));
  };

  const testKehrnelConnection = async (envId, config) => {
    setTestingKehrnel(prev => ({ ...prev, [envId]: true }));
    setKehrnelTestResults(prev => ({ ...prev, [envId]: { status: 'testing' } }));

    try {
      if (config?.useDefault !== false) {
        const res = await fetch('/api/kehrnel/instances');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load Kehrnel instances');
        }
        const data = await res.json();
        const defaultInstance = data.instances?.find(i => i.isDefault) || data.instances?.[0];
        if (!defaultInstance) {
          throw new Error('No Kehrnel instances configured');
        }
        const isHealthy = defaultInstance.health?.status === 'healthy';
        const version = defaultInstance.health?.version || null;
        const result = {
          status: isHealthy ? 'success' : 'error',
          version,
          error: isHealthy ? null : (defaultInstance.health?.error || 'Instance unavailable')
        };
        setKehrnelTestResults(prev => ({ ...prev, [envId]: result }));
        const lastHealth = {
          status: isHealthy ? 'ok' : 'error',
          checkedAt: new Date().toISOString(),
          version,
          error: result.error
        };
        updateEnvironmentKehrnel(envId, {
          ...config,
          useDefault: true,
          apiUrl: defaultInstance.url,
          connectionId: defaultInstance._id || null,
          lastHealth
        });
      } else {
        const apiUrl = (config?.apiUrl || '').replace(/\/$/, '');
        if (!apiUrl) throw new Error('API URL required');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        // Use proxy to avoid CORS issues
        const res = await fetch(`/api/kehrnel/health?url=${encodeURIComponent(apiUrl)}`, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json().catch(() => ({}));
        if (!data.healthy) {
          throw new Error(data.error || 'Health check failed');
        }
        const version = data.version || null;
        const result = { status: 'success', version };
        setKehrnelTestResults(prev => ({ ...prev, [envId]: result }));
        const lastHealth = {
          status: 'ok',
          checkedAt: new Date().toISOString(),
          version,
          error: null
        };
        updateEnvironmentKehrnel(envId, { ...config, lastHealth });
      }
    } catch (error) {
      const lastHealth = {
        status: 'error',
        checkedAt: new Date().toISOString(),
        version: null,
        error: error.message
      };
      setKehrnelTestResults(prev => ({
        ...prev,
        [envId]: { status: 'error', error: error.message }
      }));
      updateEnvironmentKehrnel(envId, { ...config, lastHealth });
    } finally {
      setTestingKehrnel(prev => ({ ...prev, [envId]: false }));
    }
  };

  // T1: Fetch Kehrnel catalog (strategy list)
  const fetchKehrnelCatalog = async (envId, config) => {
    setCatalogLoading(true);
    setCatalogError(null);
    setShowCatalogModal(envId);

    try {
      // Use connectionId if available, otherwise will use default resolution
      const params = new URLSearchParams();
      if (config?.connectionId) {
        params.set('connectionId', config.connectionId);
      }

      const response = await fetch(`/api/kehrnel/catalog?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch catalog (${response.status})`);
      }

      const data = await response.json();
      setCatalogStrategies(data.strategies || []);
    } catch (error) {
      setCatalogError(error.message);
      setCatalogStrategies([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const closeCatalogModal = () => {
    setShowCatalogModal(null);
    setCatalogStrategies([]);
    setCatalogError(null);
  };

  const [successMessage, setSuccessMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
     let preparedEnvironments = environments;
     if (showAddForm && hasNewEnvironmentDraft()) {
       const draftEnvironment = buildNewEnvironmentDraft();
       preparedEnvironments = normalizeActiveEnvironments([...environments, draftEnvironment]);
     }

     // Persist connection strings through the main update path as a fallback.
     // We still write them to the dedicated secure store below.
     await onUpdate({ ...team, environments: preparedEnvironments });

     // 2) seal any provided connection strings
     const secretErrors = [];
     const secretsUpdated = [];
     for (const env of preparedEnvironments) {
       if (env.connectionString && env.connectionString.trim()) {
         try {
           console.log(`Saving connection string for env: ${env.name} (${env.id})`);
           const res = await fetch('/api/environments/secure', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ envId: env.id, connectionString: env.connectionString.trim() })
           });
           const data = await res.json().catch(() => ({}));
           if (!res.ok) {
             console.error(`Failed to save connection for ${env.name}:`, data);
             secretErrors.push(`${env.name}: ${data.error || 'Failed to save connection string'}`);
           } else {
             console.log(`Successfully saved connection for ${env.name}`);
             secretsUpdated.push(env.name);
           }
         } catch (fetchErr) {
           console.error(`Network error saving connection for ${env.name}:`, fetchErr);
           secretErrors.push(`${env.name}: ${fetchErr.message || 'Network error'}`);
         }
       }
     }

     if (secretErrors.length > 0) {
       setError('Some connection strings failed to save: ' + secretErrors.join('; '));
     } else if (secretsUpdated.length > 0) {
       setSuccessMessage(`Settings saved. Connection strings updated for: ${secretsUpdated.join(', ')}`);
     } else {
       setSuccessMessage('Settings saved successfully.');
     }

     // 3) clear the plaintexts in UI state
     setEnvironments(preparedEnvironments.map((env) => ({ ...env, connectionString: '' })));
     if (showAddForm) {
       resetNewEnvironmentForm();
     }

     // 4) refresh the secret status to show configured indicators
     if (secretsUpdated.length > 0) {
       const envIds = preparedEnvironments.map(e => e.id).join(',');
       const statusRes = await fetch(`/api/environments/secure?envIds=${encodeURIComponent(envIds)}`);
       if (statusRes.ok) {
         const statusData = await statusRes.json();
         setConfiguredSecrets(statusData.configured || {});
       }
     }
    } catch (err) {
      console.error('handleSave error:', err);
      if (err?.message?.includes('403') || err?.message?.includes('admin')) {
        setError('You do not have permission to update environment settings. Only admins can make changes.');
      } else {
        setError(err?.message || 'Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Environment Settings</h1>

      {!isIndividual && !isAdmin && (
        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
          <p className="text-yellow-400 text-sm">
            <strong>View Only:</strong> Only team admins can add or modify environments. Contact your team owner or admin to request changes.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-600/30 rounded-lg">
          <p className="text-green-400 text-sm">{successMessage}</p>
        </div>
      )}

	      <div className="space-y-6">
	        {/* Current Environments */}
		        <div className="bg-surface rounded-lg p-6 border border-theme">
	          <div className="flex justify-between items-center mb-4">
	            <h2 className="text-lg font-semibold text-theme-primary">Configured Environments</h2>
	            {isAdmin && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-primary text-primary-text rounded-lg hover:opacity-90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Environment
		              </button>
		            )}
		          </div>
		          
		          <div className="space-y-4">
		            {environments.map((env) => {
		              const isExpanded = expandedEnvs[env.id];
		              const canEdit = isExpanded && isAdmin; // Directly editable when expanded (for admins)
		              const testResult = kehrnelTestResults[env.id];
		              const secretMetadata = configuredSecrets[env.id] || null;
		              const secretConfigured = !!secretMetadata?.hasSecret || !!env.sealedUri;
		              const connectionPreview = String(secretMetadata?.preview || '').trim();
                const mongoSummaryLabel = secretConfigured
                  ? (env.isActive ? 'MongoDB active' : 'MongoDB configured')
                  : 'MongoDB connection missing';

		              return (
		                <div key={env.id} className={`rounded-xl overflow-hidden border transition-all ${
                  env.isActive
                    ? 'border-[#4A9EBD]/70 ring-1 ring-[#4A9EBD]/70'
                    : 'border-theme'
                }`}>
		                  {/* Main Card Header */}
		                  <div className="p-4 bg-surface-hover">
		                    <div className="flex items-center justify-between">
		                      {/* Left: Name and status */}
		                      <div className="flex items-center gap-3">
		                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${env.isActive ? 'bg-success/20' : 'bg-surface'}`}>
		                          <Database className={`w-5 h-5 ${env.isActive ? 'text-success' : 'text-theme-secondary'}`} />
	                        </div>
		                        <div>
		                          <div className="flex items-center gap-2">
		                            <h3 className="font-semibold text-theme-primary">{env.name}</h3>
		                            {env.isActive && (
		                              <span className="px-2 py-0.5 bg-success/20 text-success text-[10px] font-medium rounded-full">
		                                ACTIVE
		                              </span>
		                            )}
		                          </div>
		                          <p className="text-xs text-theme-secondary mt-0.5">
		                            {env.database}
		                          </p>
		                        </div>
		                      </div>

		                      {/* Right: Actions */}
			                      <div className="flex items-center gap-2 justify-end">
		                        {!env.isActive && isAdmin && (
		                          <button
		                            onClick={() => handleSetActive(env.id)}
		                            className="px-3 py-1.5 text-xs rounded-lg text-success hover:bg-success/10 transition-colors"
                              title="Set this environment as active"
		                          >
		                            Set Active
		                          </button>
		                        )}
			                        <button
			                          onClick={() => toggleEnvExpand(env.id)}
			                          className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-primary/20 text-primary' : 'text-theme-secondary hover:text-theme-primary hover:bg-surface'}`}
	                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemoveEnvironment(env.id)}
                            className="p-2 text-theme-secondary hover:text-error rounded-lg hover:bg-surface transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

	                    {/* Quick Info Row */}
	                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-theme">
	                      <div className="flex items-center gap-2">
	                        <div className={`w-2 h-2 rounded-full ${secretConfigured ? 'bg-[#00ED64]' : 'bg-yellow-400'}`} />
	                        <span className={`text-xs ${secretConfigured ? 'text-[#00ED64]' : 'text-yellow-400'}`}>
	                          {mongoSummaryLabel}
	                        </span>
	                      </div>
                      {/* Kehrnel Status */}
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${env.kehrnel?.lastHealth?.status === 'ok' ? 'bg-success' : 'bg-theme-secondary'}`} />
                        <span className="text-xs text-theme-secondary">Kehrnel</span>
                        {env.kehrnel?.lastHealth?.version && (
                          <span className="text-xs text-theme-primary">v{env.kehrnel.lastHealth.version}</span>
                        )}
                      </div>
                    </div>
                  </div>

		                  {/* Expanded Details */}
		                  {isExpanded && (
		                    <div>
                          {isAdmin && (
                            <div className="border-b border-theme px-4 py-3 bg-surface/20">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] uppercase tracking-wider text-theme-secondary mr-1">
                                  Data Migration
                                </span>
                                {environments.length > 1 && (
                                  <button
                                    onClick={() => openPromotionDialog(env.id)}
                                    className="px-3 py-1.5 text-xs rounded-lg bg-[#4A9EBD]/10 text-[#4A9EBD] hover:bg-[#4A9EBD]/20 transition-colors flex items-center gap-1.5"
                                    title="Replace this environment's shared assets from another environment"
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                    Promote Assets
                                  </button>
                                )}
                                <button
                                  onClick={() => handleExportBundle(env)}
                                  disabled={!!bundleExporting[env.id]}
                                  className="px-3 py-1.5 text-xs rounded-lg bg-surface text-theme-primary hover:bg-surface-hover transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                  title="Download a data bundle for this environment"
                                >
                                  {bundleExporting[env.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                  Export Data Bundle
                                </button>
                                <button
                                  onClick={() => openBundleImportDialog(env.id)}
                                  className="px-3 py-1.5 text-xs rounded-lg bg-surface text-theme-primary hover:bg-surface-hover transition-colors flex items-center gap-1.5"
                                  title="Import a data bundle into this environment"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                  Import Data Bundle
                                </button>
                              </div>
                            </div>
                          )}
	                      {/* ===== MongoDB Atlas Section ===== */}
	                      <div className="border-b border-theme">
	                        <button
                          onClick={() => toggleSection(env.id, 'mongodb')}
                          className="w-full p-4 flex items-center justify-between hover:bg-surface/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#00ED64]/20 flex items-center justify-center">
                              <Database className="w-4 h-4 text-[#00ED64]" />
                            </div>
	                            <div className="text-left">
	                              <h4 className="text-sm font-semibold text-white">MongoDB Atlas</h4>
	                              <p className="text-xs text-theme-secondary">Database connection and configuration</p>
	                            </div>
	                            {secretConfigured && (
	                              <span className="flex items-center gap-1 px-2 py-0.5 bg-[#00ED64]/20 text-[#00ED64] text-[10px] font-medium rounded-full">
	                                <CheckCircle className="w-3 h-3" />
	                                {env.isActive ? 'Active' : 'Configured'}
	                              </span>
	                            )}
	                          </div>
                          {getSections(env.id).mongodb ? <ChevronUp className="w-4 h-4 text-theme-secondary" /> : <ChevronDown className="w-4 h-4 text-theme-secondary" />}
                        </button>

                        {getSections(env.id).mongodb && (
                          <div className="px-4 pb-4 space-y-4">
                            {/* Important Notice - always visible */}
                            <div className="rounded-lg p-3 bg-yellow-500/10 border border-yellow-500/30">
                              <div className="flex items-start space-x-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-500" />
                                <div className="text-xs">
                                  <span className="font-semibold text-yellow-500">Important:</span>
                                  <span className="text-slate-300"> Use <strong className="text-white">dedicated test users</strong> for this lab environment. This platform is for learning and prototyping—not production use.</span>
                                </div>
                              </div>
                            </div>

                            {/* Environment Details */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] uppercase tracking-wider text-theme-secondary block mb-1">Environment Name</label>
                                <input
                                  type="text"
                                  value={env.name}
                                  onChange={(e) => updateEnvironmentField(env.id, 'name', e.target.value)}
                                  disabled={!canEdit}
                                  className={`w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-white ${!canEdit ? 'opacity-70 cursor-default' : ''}`}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase tracking-wider text-theme-secondary block mb-1">Database Name</label>
                                <input
                                  type="text"
                                  value={env.database}
                                  onChange={(e) => updateEnvironmentField(env.id, 'database', e.target.value)}
                                  disabled={!canEdit}
                                  className={`w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-white font-mono ${!canEdit ? 'opacity-70 cursor-default' : ''}`}
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-theme-secondary block mb-1">Description</label>
                              <input
                                type="text"
                                value={env.description || ''}
                                onChange={(e) => updateEnvironmentField(env.id, 'description', e.target.value)}
                                placeholder="Optional description"
                                disabled={!canEdit}
                                className={`w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-white placeholder-theme-secondary ${!canEdit ? 'opacity-70 cursor-default' : ''}`}
                              />
                            </div>

                            {/* Connection String */}
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-theme-secondary block mb-1">Connection String</label>
                              {secretConfigured && connectionPreview && (
                                <div className="mb-2 rounded-lg border border-theme bg-surface-hover/60 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-wider text-theme-secondary">Current Saved Connection</div>
                                  <div className="mt-1 text-xs text-white font-mono break-all">
                                    {connectionPreview}
                                  </div>
                                </div>
                              )}
                              {canEdit ? (
                                <input
                                  type="text"
                                  value={env.connectionString || ''}
                                  onChange={(e) => updateEnvironmentField(env.id, 'connectionString', e.target.value)}
                                  placeholder={secretConfigured ? "Enter new connection string to update..." : "mongodb+srv://username:password@cluster.mongodb.net"}
                                  className="w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-theme-secondary"
                                />
                              ) : (
                                <div className="w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-theme-secondary font-mono opacity-70">
                                  {secretConfigured
                                    ? (connectionPreview || 'Connection configured')
                                    : 'Not configured'}
                                </div>
                              )}
                              <p className="mt-2 text-xs text-theme-secondary">
                                {secretConfigured
                                  ? (connectionPreview
                                    ? "Current saved connection shown above. Enter a new one to update."
                                    : "Connection configured. Enter a new one to update.")
                                  : "Enter your MongoDB Atlas connection string."
                                }
                                <a href="https://www.mongodb.com/cloud/atlas/register" target="_blank" rel="noopener noreferrer" className="text-[#00ED64] hover:underline ml-1">
                                  Get a free Atlas cluster →
                                </a>
                              </p>
                            </div>

                            {/* Security info - always visible */}
                            <div className="rounded-lg p-3 bg-[#01ec63]/10 border border-[#01ec63]/30">
                              <div className="flex items-start space-x-2">
                                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#01ec63]" />
                                <div className="text-xs text-slate-300">
                                  <span className="font-medium text-[#01ec63]">Your credentials are secure:</span>
                                  {' '}Connection strings are <strong className="text-white">encrypted with AES-256</strong> before being stored and decrypted only when needed.
                                  <span className="text-theme-secondary"> Database user must have readWrite permissions. Configure network access in Atlas to allow your IP.</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ===== Kehrnel Transform Engine Section ===== */}
                      <div className="border-b border-theme">
                        <button
                          onClick={() => toggleSection(env.id, 'kehrnel')}
                          className="w-full p-4 flex items-center justify-between hover:bg-surface/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#4A9EBD]/20 flex items-center justify-center">
                              <Server className="w-4 h-4 text-[#4A9EBD]" />
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <KehrnelLogo size="sm" />
                              </div>
                              <p className="text-xs text-theme-secondary">Transform engine for data ingestion & querying</p>
                            </div>
                            {env.kehrnel?.lastHealth?.status === 'ok' && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-[#00ED64]/20 text-[#00ED64] text-[10px] font-medium rounded-full">
                                <CheckCircle className="w-3 h-3" />
                                Connected
                              </span>
                            )}
                          </div>
                          {getSections(env.id).kehrnel ? <ChevronUp className="w-4 h-4 text-theme-secondary" /> : <ChevronDown className="w-4 h-4 text-theme-secondary" />}
                        </button>

                        {getSections(env.id).kehrnel && (
                          <div className="px-4 pb-4 space-y-4">
                            {/* What is Kehrnel? */}
                            <div className="rounded-lg p-4 bg-[#4A9EBD]/10 border border-[#4A9EBD]/30">
                              <div className="flex items-start space-x-3">
                                <FlaskConical className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#4A9EBD]" />
                                <div className="text-sm">
                                  <p className="font-semibold text-[#4A9EBD] mb-2">What is Kehrnel?</p>
                                  <p className="text-slate-300 mb-3">
                                    <strong className="text-white">Kehrnel</strong> is a modular Python toolkit (CLI + API + libraries) for working with healthcare data in a <strong className="text-white">document-centric model</strong>.
                                  </p>
                                  <p className="text-slate-300 mb-2 text-xs">It provides tools to:</p>
                                  <ul className="text-slate-300 space-y-1 list-disc list-inside text-xs">
                                    <li><strong className="text-white">Transform</strong> — Convert CDA, HL7, FHIR, CSV to openEHR</li>
                                    <li><strong className="text-white">Generate</strong> — Create synthetic data and validate schemas</li>
                                    <li><strong className="text-white">Ingest & Query</strong> — Persist and query with different strategies</li>
                                  </ul>
                                  <p className="text-slate-400 mt-3 text-xs italic">
                                    These accelerators demonstrate usage patterns for building production projects.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => fetchKehrnelCatalog(env.id, env.kehrnel)}
                                disabled={catalogLoading && showCatalogModal === env.id}
                                className="px-3 py-1.5 text-xs rounded-lg bg-[#EA6635]/20 text-[#EA6635] hover:bg-[#EA6635]/30 disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {catalogLoading && showCatalogModal === env.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <List className="w-3 h-3" />
                                )}
                                View Catalog
                              </button>
                              <button
                                onClick={() => testKehrnelConnection(env.id, env.kehrnel)}
                                disabled={testingKehrnel[env.id]}
                                className="px-3 py-1.5 text-xs rounded-lg bg-[#4A9EBD]/20 text-[#4A9EBD] hover:bg-[#4A9EBD]/30 disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {testingKehrnel[env.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                Test Connection
                              </button>
                            </div>

                            {/* Kehrnel Options */}
                            <div className="space-y-3">
                              <p className="text-xs text-theme-secondary font-medium uppercase tracking-wider">Select Instance</p>

                              {/* Shared Instance Option */}
                              <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                                env.kehrnel?.useDefault !== false
                                  ? 'border-[#4A9EBD] bg-[#4A9EBD]/10'
                                  : 'border-theme bg-surface-hover hover:border-theme-secondary'
                              }`}>
                                <input
                                  type="radio"
                                  name={`kehrnel-${env.id}`}
                                  checked={env.kehrnel?.useDefault !== false}
                                  onChange={() => updateEnvironmentKehrnel(env.id, { ...env.kehrnel, useDefault: true })}
                                  className="mt-0.5"
                                  disabled={!isAdmin}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-white">Shared Instance</span>
                                    <span className="px-1.5 py-0.5 bg-[#00ED64]/20 text-[#00ED64] text-[9px] font-medium rounded">DEFAULT</span>
                                  </div>
                                  <p className="text-xs text-slate-300">
                                    We provide a <strong className="text-white">free shared Kehrnel instance</strong> for learning and experimentation.
                                    Perfect for getting started quickly.
                                  </p>
                                  <p className="text-xs text-theme-tertiary mt-1">
                                    Note: 15-day data retention limit · Shared infrastructure
                                  </p>
                                  {env.kehrnel?.useDefault !== false && testResult?.status === 'success' && (
                                    <p className="text-xs text-[#00ED64] mt-2 flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> Connected • v{testResult.version}
                                    </p>
                                  )}
                                </div>
                              </label>

                              {/* Own Infrastructure Option */}
                              <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                                env.kehrnel?.useDefault === false
                                  ? 'border-[#4A9EBD] bg-[#4A9EBD]/10'
                                  : 'border-theme bg-surface-hover hover:border-theme-secondary'
                              }`}>
                                <input
                                  type="radio"
                                  name={`kehrnel-${env.id}`}
                                  checked={env.kehrnel?.useDefault === false}
                                  onChange={() => updateEnvironmentKehrnel(env.id, { ...env.kehrnel, useDefault: false })}
                                  className="mt-0.5"
                                  disabled={!isAdmin}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-white">Your Own Instance</span>
                                  </div>
                                  <p className="text-xs text-slate-300 mb-2">
                                    Deploy your own Kehrnel instance using <strong className="text-white">Docker</strong> for full control and no usage limits.
                                  </p>
                                  <a
                                    href="https://github.com/Paco-Mateu/kehrnel/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-[#4A9EBD] hover:underline"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View installation guide on GitHub →
                                  </a>
                                  {env.kehrnel?.useDefault === false && (
                                    <input
                                      type="text"
                                      value={env.kehrnel?.apiUrl || ''}
                                      onChange={(e) => updateEnvironmentKehrnel(env.id, { ...env.kehrnel, apiUrl: e.target.value })}
                                      placeholder="https://kehrnel.example.com"
                                      className="w-full mt-3 px-3 py-2 bg-surface-hover border border-theme rounded-lg text-sm text-white font-mono placeholder-theme-secondary focus:border-[#4A9EBD] focus:outline-none"
                                      disabled={!isAdmin}
                                    />
                                  )}
                                  {env.kehrnel?.useDefault === false && testResult?.status === 'success' && (
                                    <p className="text-xs text-[#00ED64] mt-2 flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> Connected • v{testResult.version}
                                    </p>
                                  )}
                                  {env.kehrnel?.useDefault === false && testResult?.status === 'error' && (
                                    <p className="text-xs text-red-400 mt-2">{testResult.error || 'Connection failed'}</p>
                                  )}
                                </div>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {environments.length === 0 && (
              <p className="text-center py-8 text-theme-secondary">
                No environments configured. Add your first environment to get started.
              </p>
            )}
          </div>
        </div>

        {/* Add Environment Form */}
        {showAddForm && (
          <div className="rounded-xl overflow-hidden border border-[#00ED64]/30">
            {/* Header - Green background */}
            <div className="bg-[#00ED64]/10 border-b border-[#00ED64]/20 p-4">
              <h3 className="text-lg font-semibold text-white">Add New Environment</h3>
              <p className="text-xs text-slate-300 mt-1">Configure your MongoDB connection and transform engine</p>
            </div>

            {/* Collapsible Sections - Transparent */}
            <div>
              {/* ===== MongoDB Atlas Section ===== */}
              <div className="border-b border-theme">
                <button
                  onClick={() => setNewEnvSections(prev => prev.mongodb ? { mongodb: false, kehrnel: false } : { mongodb: true, kehrnel: false })}
                  className="w-full p-4 flex items-center justify-between hover:bg-surface/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#00ED64]/20 flex items-center justify-center">
                      <Database className="w-4 h-4 text-[#00ED64]" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-semibold text-white">MongoDB Atlas</h4>
                      <p className="text-xs text-theme-secondary">Database connection and configuration</p>
                    </div>
                  </div>
                  {newEnvSections.mongodb ? <ChevronUp className="w-4 h-4 text-theme-secondary" /> : <ChevronDown className="w-4 h-4 text-theme-secondary" />}
                </button>

                {newEnvSections.mongodb && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Important Notice */}
                    <div className="rounded-lg p-3 bg-yellow-500/10 border border-yellow-500/30">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-500" />
                        <div className="text-xs">
                          <span className="font-semibold text-yellow-500">Important:</span>
                          <span className="text-slate-300"> Use <strong className="text-white">dedicated test users</strong> for this lab environment. This platform is for learning and prototyping—not production use.</span>
                        </div>
                      </div>
                    </div>

                    {/* Environment Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-theme-secondary block mb-1">Environment Name</label>
                        <input
                          type="text"
                          value={newEnvironment.name}
                          onChange={(e) => setNewEnvironment({ ...newEnvironment, name: e.target.value })}
                          placeholder="e.g., PRE, PRO, DEV"
                          className="w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-white placeholder-theme-secondary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-theme-secondary block mb-1">Database Name</label>
                        <input
                          type="text"
                          value={newEnvironment.database}
                          onChange={(e) => setNewEnvironment({ ...newEnvironment, database: e.target.value })}
                          placeholder="e.g., openehr_pre"
                          className="w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-white placeholder-theme-secondary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-theme-secondary block mb-1">Description</label>
                      <input
                        type="text"
                        value={newEnvironment.description}
                        onChange={(e) => setNewEnvironment({ ...newEnvironment, description: e.target.value })}
                        placeholder="Optional description"
                        className="w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-white placeholder-theme-secondary"
                      />
                    </div>

                    {/* Connection String */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-theme-secondary block mb-1">Connection String</label>
                      <input
                        type="text"
                        value={newEnvironment.connectionString}
                        onChange={(e) => setNewEnvironment({ ...newEnvironment, connectionString: e.target.value })}
                        placeholder="mongodb+srv://username:password@cluster.mongodb.net"
                        className="w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-theme-secondary"
                      />
                      <p className="mt-2 text-xs text-theme-secondary">
                        Enter your MongoDB Atlas connection string.
                        <a href="https://www.mongodb.com/cloud/atlas/register" target="_blank" rel="noopener noreferrer" className="text-[#00ED64] hover:underline ml-1">
                          Get a free Atlas cluster →
                        </a>
                      </p>
                    </div>

                    {/* Security info */}
                    <div className="rounded-lg p-3 bg-[#01ec63]/10 border border-[#01ec63]/30">
                      <div className="flex items-start space-x-2">
                        <Shield className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#01ec63]" />
                        <div className="text-xs text-slate-300">
                          <span className="font-medium text-[#01ec63]">Your credentials are secure:</span>
                          {' '}Connection strings are <strong className="text-white">encrypted with AES-256</strong> before being stored and decrypted only when needed.
                          <span className="text-theme-secondary"> Database user must have readWrite permissions. Configure network access in Atlas to allow your IP.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Kehrnel Transform Engine Section ===== */}
              <div className="border-b border-theme">
                <button
                  onClick={() => setNewEnvSections(prev => prev.kehrnel ? { mongodb: false, kehrnel: false } : { mongodb: false, kehrnel: true })}
                  className="w-full p-4 flex items-center justify-between hover:bg-surface/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#4A9EBD]/20 flex items-center justify-center">
                      <Server className="w-4 h-4 text-[#4A9EBD]" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <KehrnelLogo size="sm" />
                      </div>
                      <p className="text-xs text-theme-secondary">Transform engine for data ingestion & querying</p>
                    </div>
                  </div>
                  {newEnvSections.kehrnel ? <ChevronUp className="w-4 h-4 text-theme-secondary" /> : <ChevronDown className="w-4 h-4 text-theme-secondary" />}
                </button>

                {newEnvSections.kehrnel && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* What is Kehrnel? */}
                    <div className="rounded-lg p-4 bg-[#4A9EBD]/10 border border-[#4A9EBD]/30">
                      <div className="flex items-start space-x-3">
                        <FlaskConical className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#4A9EBD]" />
                        <div className="text-sm">
                          <p className="font-semibold text-[#4A9EBD] mb-2">What is Kehrnel?</p>
                          <p className="text-slate-300 mb-3">
                            <strong className="text-white">Kehrnel</strong> is a modular Python toolkit (CLI + API + libraries) for working with healthcare data in a <strong className="text-white">document-centric model</strong>.
                          </p>
                          <p className="text-slate-300 mb-2 text-xs">It provides tools to:</p>
                          <ul className="text-slate-300 space-y-1 list-disc list-inside text-xs">
                            <li><strong className="text-white">Transform</strong> — Convert CDA, HL7, FHIR, CSV to openEHR</li>
                            <li><strong className="text-white">Generate</strong> — Create synthetic data and validate schemas</li>
                            <li><strong className="text-white">Ingest & Query</strong> — Persist and query with different strategies</li>
                          </ul>
                          <p className="text-slate-400 mt-3 text-xs italic">
                            These accelerators demonstrate usage patterns for building production projects.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Instance Selection */}
                    <p className="text-xs text-theme-secondary font-medium uppercase tracking-wider">Select Instance</p>

                    {/* Shared Instance Option */}
                    <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                      newEnvironment.kehrnel?.useDefault !== false
                        ? 'border-[#4A9EBD] bg-[#4A9EBD]/10'
                        : 'border-theme bg-surface-hover hover:border-theme-secondary'
                    }`}>
                      <input
                        type="radio"
                        name="new-kehrnel"
                        checked={newEnvironment.kehrnel?.useDefault !== false}
                        onChange={() => setNewEnvironment({
                          ...newEnvironment,
                          kehrnel: { ...newEnvironment.kehrnel, useDefault: true }
                        })}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">Shared Instance</span>
                          <span className="px-1.5 py-0.5 bg-[#00ED64]/20 text-[#00ED64] text-[9px] font-medium rounded">DEFAULT</span>
                        </div>
                        <p className="text-xs text-slate-300">
                          We provide a <strong className="text-white">free shared Kehrnel instance</strong> for learning and experimentation. Perfect for getting started quickly.
                        </p>
                        <p className="text-xs text-theme-tertiary mt-1">
                          Note: 15-day data retention limit · Shared infrastructure
                        </p>
                      </div>
                    </label>

                    {/* Own Infrastructure Option */}
                    <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                      newEnvironment.kehrnel?.useDefault === false
                        ? 'border-[#4A9EBD] bg-[#4A9EBD]/10'
                        : 'border-theme bg-surface-hover hover:border-theme-secondary'
                    }`}>
                      <input
                        type="radio"
                        name="new-kehrnel"
                        checked={newEnvironment.kehrnel?.useDefault === false}
                        onChange={() => setNewEnvironment({
                          ...newEnvironment,
                          kehrnel: { ...newEnvironment.kehrnel, useDefault: false }
                        })}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">Your Own Instance</span>
                        </div>
                        <p className="text-xs text-slate-300 mb-2">
                          Deploy your own Kehrnel instance using <strong className="text-white">Docker</strong> for full control and no usage limits.
                        </p>
                        <a
                          href="https://github.com/Paco-Mateu/kehrnel/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#4A9EBD] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View installation guide on GitHub →
                        </a>
                        {newEnvironment.kehrnel?.useDefault === false && (
                          <input
                            type="text"
                            value={newEnvironment.kehrnel?.apiUrl || ''}
                            onChange={(e) => setNewEnvironment({
                              ...newEnvironment,
                              kehrnel: { ...newEnvironment.kehrnel, apiUrl: e.target.value }
                            })}
                            placeholder="https://kehrnel.example.com"
                            className="w-full mt-3 px-3 py-2 bg-surface-hover border border-theme rounded-lg text-sm text-white font-mono placeholder-theme-secondary focus:border-[#4A9EBD] focus:outline-none"
                          />
                        )}
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="setActive"
                    checked={newEnvironment.isActive}
                    onChange={(e) => setNewEnvironment({ ...newEnvironment, isActive: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="setActive" className="text-sm text-theme-secondary">
                    Set as active environment
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      resetNewEnvironmentForm();
                    }}
                    className="px-4 py-2 bg-surface-hover text-white rounded-lg hover:bg-slate-600 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddEnvironment}
                    disabled={!newEnvironment.name.trim() || !newEnvironment.database.trim() || !newEnvironment.connectionString.trim()}
                    className="px-4 py-2 bg-primary text-primary-text rounded-lg hover:bg-primary-hover text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Environment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-3 bg-primary text-primary-text rounded-lg hover:bg-primary-hover disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : (showAddForm && hasNewEnvironmentDraft()
                ? 'Add Environment And Save Settings'
                : 'Save Environment Settings')}
          </button>
        )}
      </div>

	      {bundleImportDialog.open && (
	        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
	          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full overflow-hidden">
	            <div className="flex items-center justify-between p-4 border-b border-slate-700">
	              <div className="flex items-center gap-3">
	                <div className="w-10 h-10 rounded-lg bg-[#00ED64]/15 flex items-center justify-center">
	                  <Upload className="w-5 h-5 text-[#00ED64]" />
	                </div>
	                <div>
	                  <h3 className="text-lg font-semibold text-white">
	                    Import Data Bundle Into {environments.find((environment) => environment.id === bundleImportDialog.targetEnvId)?.name || 'Environment'}
	                  </h3>
	                  <p className="text-xs text-slate-400">
	                    Import a ZIP data bundle from another team or workspace without exposing connection secrets.
	                  </p>
	                </div>
	              </div>
	              <button
	                onClick={closeBundleImportDialog}
	                disabled={bundleImportSubmitting}
	                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
	              >
	                <X className="w-5 h-5" />
	              </button>
	            </div>

	            <div className="p-5 space-y-5">
	              <div className="rounded-lg p-4 bg-[#00ED64]/10 border border-[#00ED64]/30">
	                <div className="flex items-start gap-3">
	                  <Shield className="w-5 h-5 text-[#00ED64] mt-0.5 flex-shrink-0" />
	                  <div className="text-sm text-slate-300">
	                    <p className="font-medium text-[#00ED64]">Designed for large model assets.</p>
	                    <p className="mt-1">
	                      The bundle uses a compressed ZIP archive with server-side EJSON payloads, so large `user-data-models` documents, including embedded OPT XML, keep their MongoDB IDs and timestamps intact.
	                    </p>
	                    <p className="mt-1 text-xs text-slate-400">
	                      Compressed bundle imports currently support files up to 256 MB.
	                    </p>
	                  </div>
	                </div>
	              </div>

	              <div>
	                <label className="text-[10px] uppercase tracking-wider text-theme-secondary block mb-2">
	                  Bundle ZIP
	                </label>
	                <input
	                  type="file"
	                  accept=".zip,application/zip"
	                  onChange={(event) => {
	                    const file = event.target.files?.[0] || null;
	                    setBundleImportDialog((prev) => ({
	                      ...prev,
	                      file,
	                      fileName: file?.name || '',
	                    }));
	                  }}
	                  className="w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-white file:mr-3 file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-primary file:rounded-md"
	                  disabled={bundleImportSubmitting}
	                />
	                {bundleImportDialog.fileName && (
	                  <p className="mt-2 text-xs text-theme-secondary">
	                    Selected: {bundleImportDialog.fileName}
	                  </p>
	                )}
	              </div>

	              <label className="flex items-start gap-3 rounded-lg border border-theme bg-surface-hover/50 px-4 py-3">
	                <input
	                  type="checkbox"
	                  checked={bundleImportDialog.includeRuntimeConfig}
	                  onChange={(event) => setBundleImportDialog((prev) => ({ ...prev, includeRuntimeConfig: event.target.checked }))}
	                  className="mt-1"
	                  disabled={bundleImportSubmitting}
	                />
	                <div className="text-sm">
	                  <div className="font-medium text-white">Also import strategy/runtime configuration</div>
	                  <div className="text-theme-secondary mt-1">
	                    Applies domain target databases, strategy links, and Kehrnel instance selection from the bundle while still leaving connection strings and saved secrets untouched.
	                  </div>
	                </div>
	              </label>

	              <div>
	                <div className="text-[10px] uppercase tracking-wider text-theme-secondary mb-2">
	                  Bundle Contents
	                </div>
	                <div className="grid gap-2 md:grid-cols-2">
	                  {PROMOTABLE_ENVIRONMENT_ASSETS.map((asset) => (
	                    <div
	                      key={asset.collection}
	                      className="rounded-lg border border-theme bg-surface-hover/40 px-3 py-2 text-sm text-slate-300"
	                    >
	                      {asset.label}
	                    </div>
	                  ))}
	                </div>
	              </div>

	              {bundleImportError && (
	                <div className="rounded-lg border border-red-600/30 bg-red-900/20 px-4 py-3 text-sm text-red-300">
	                  {bundleImportError}
	                </div>
	              )}
	            </div>

	            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700 bg-slate-900/40">
	              <button
	                onClick={closeBundleImportDialog}
	                disabled={bundleImportSubmitting}
	                className="px-4 py-2 bg-surface-hover text-white rounded-lg hover:bg-slate-600 text-sm disabled:opacity-50"
	              >
	                Cancel
	              </button>
	              <button
	                onClick={handleBundleImport}
	                disabled={bundleImportSubmitting || !bundleImportDialog.file}
	                className="px-4 py-2 bg-primary text-primary-text rounded-lg hover:bg-primary-hover text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
	              >
	                {bundleImportSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
	                {bundleImportSubmitting ? 'Importing...' : 'Import Data Bundle'}
	              </button>
	            </div>
	          </div>
	        </div>
	      )}

	      {/* T1: Kehrnel Catalog Modal */}
	      {promotionDialog.open && (
	        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
	          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full overflow-hidden">
	            <div className="flex items-center justify-between p-4 border-b border-slate-700">
	              <div className="flex items-center gap-3">
	                <div className="w-10 h-10 rounded-lg bg-[#4A9EBD]/15 flex items-center justify-center">
	                  <Layers className="w-5 h-5 text-[#4A9EBD]" />
	                </div>
	                <div>
	                  <h3 className="text-lg font-semibold text-white">
	                    Promote Assets Into {environments.find((environment) => environment.id === promotionDialog.targetEnvId)?.name || 'Environment'}
	                  </h3>
	                  <p className="text-xs text-slate-400">
	                    Replace the target environment&apos;s reusable assets from another environment in the same workspace.
	                  </p>
	                </div>
	              </div>
	              <button
	                onClick={closePromotionDialog}
	                disabled={promotionSubmitting}
	                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
	              >
	                <X className="w-5 h-5" />
	              </button>
	            </div>

	            <div className="p-5 space-y-5">
	              <div className="rounded-lg p-4 bg-yellow-500/10 border border-yellow-500/30">
	                <div className="flex items-start gap-3">
	                  <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
	                  <div className="text-sm text-slate-300">
	                    <p className="font-medium text-yellow-300">Promotion replaces target assets.</p>
	                    <p className="mt-1">
	                      Connection strings and database names stay untouched, but the target environment&apos;s asset collections will be replaced so queries, folders, templates, and mappings stay aligned.
	                    </p>
	                  </div>
	                </div>
	              </div>

	              <div>
	                <label className="text-[10px] uppercase tracking-wider text-theme-secondary block mb-2">
	                  Source Environment
	                </label>
	                <select
	                  value={promotionDialog.sourceEnvId}
	                  onChange={(event) => setPromotionDialog((prev) => ({ ...prev, sourceEnvId: event.target.value }))}
	                  className="w-full bg-surface-hover border border-theme rounded-lg px-3 py-2 text-sm text-white"
	                  disabled={promotionSubmitting}
	                >
	                  <option value="">Select a source environment</option>
	                  {promotionSourceOptions.map((environment) => (
	                    <option key={environment.id} value={environment.id}>
	                      {environment.name} · {environment.database}
	                    </option>
	                  ))}
	                </select>
	              </div>

	              <label className="flex items-start gap-3 rounded-lg border border-theme bg-surface-hover/50 px-4 py-3">
	                <input
	                  type="checkbox"
	                  checked={promotionDialog.includeRuntimeConfig}
	                  onChange={(event) => setPromotionDialog((prev) => ({ ...prev, includeRuntimeConfig: event.target.checked }))}
	                  className="mt-1"
	                  disabled={promotionSubmitting}
	                />
	                <div className="text-sm">
	                  <div className="font-medium text-white">Also copy strategy/runtime configuration</div>
	                  <div className="text-theme-secondary mt-1">
	                    Copies selected strategy links, domain target databases, and Kehrnel instance selection while stripping source-specific activation metadata.
	                  </div>
	                </div>
	              </label>

	              <div>
	                <div className="text-[10px] uppercase tracking-wider text-theme-secondary mb-2">
	                  Included Asset Collections
	                </div>
	                <div className="grid gap-2 md:grid-cols-2">
	                  {PROMOTABLE_ENVIRONMENT_ASSETS.map((asset) => (
	                    <div
	                      key={asset.collection}
	                      className="rounded-lg border border-theme bg-surface-hover/40 px-3 py-2 text-sm text-slate-300"
	                    >
	                      {asset.label}
	                    </div>
	                  ))}
	                </div>
	              </div>

	              {promotionError && (
	                <div className="rounded-lg border border-red-600/30 bg-red-900/20 px-4 py-3 text-sm text-red-300">
	                  {promotionError}
	                </div>
	              )}
	            </div>

	            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700 bg-slate-900/40">
	              <button
	                onClick={closePromotionDialog}
	                disabled={promotionSubmitting}
	                className="px-4 py-2 bg-surface-hover text-white rounded-lg hover:bg-slate-600 text-sm disabled:opacity-50"
	              >
	                Cancel
	              </button>
	              <button
	                onClick={handleRunPromotion}
	                disabled={promotionSubmitting || !promotionDialog.sourceEnvId}
	                className="px-4 py-2 bg-primary text-primary-text rounded-lg hover:bg-primary-hover text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
	              >
	                {promotionSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
	                {promotionSubmitting ? 'Promoting...' : 'Promote Assets'}
	              </button>
	            </div>
	          </div>
	        </div>
	      )}

	      {showCatalogModal && (
	        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
	          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <KehrnelLogo size="sm" />
                <div>
                  <h3 className="text-lg font-semibold text-white">Strategy Catalog</h3>
                  <p className="text-xs text-slate-400">Available strategies from Kehrnel runtime</p>
                </div>
              </div>
              <button
                onClick={closeCatalogModal}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {catalogLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#4A9EBD]" />
                </div>
              ) : catalogError ? (
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle className="w-5 h-5" />
                    <p className="text-sm font-medium">Failed to load catalog</p>
                  </div>
                  <p className="text-sm text-red-300 mt-1">{catalogError}</p>
                </div>
              ) : catalogStrategies.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No strategies available</p>
                  <p className="text-xs text-slate-500 mt-1">The Kehrnel instance has no registered strategies</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {catalogStrategies.map((strategy, idx) => {
                    const maturity = strategy.maturity || 'preview';
                    const isActivatable = maturity === 'published';
                    const statusConfig = {
                      published: { label: 'Published', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
                      development: { label: 'Development', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
                      preview: { label: 'Preview', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
                    };
                    const status = statusConfig[maturity] || statusConfig.preview;

                    return (
                      <div
                        key={strategy.id || idx}
                        className={`p-4 rounded-lg border transition-colors ${isActivatable ? 'bg-slate-700/50 border-slate-600 hover:border-[#4A9EBD]/50' : 'bg-slate-800/30 border-slate-700/50 opacity-80'}`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Logo */}
                          {strategy.ui?.logo && (
                            <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              <img src={strategy.ui.logo} alt="" className="w-8 h-8 object-contain" />
                            </div>
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-white">
                                {strategy.name || strategy.id}
                              </h4>
                              {strategy.domain && (
                                <span className="px-1.5 py-0.5 bg-[#4A9EBD]/20 text-[#4A9EBD] text-[10px] rounded">
                                  {strategy.domain}
                                </span>
                              )}
                              {/* Status Badge */}
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${status.bg} ${status.text} ${status.border}`}>
                                {maturity !== 'stable' && <FlaskConical className="w-3 h-3" />}
                                {status.label}
                              </span>
                              {strategy.version && (
                                <span className="px-1.5 py-0.5 bg-slate-600 text-slate-300 text-[10px] rounded">
                                  v{strategy.version}
                                </span>
                              )}
                            </div>

                            {/* Description - full text */}
                            {strategy.description && (
                              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                                {strategy.description}
                              </p>
                            )}

                            {/* Capabilities/Products */}
                            {strategy.data_product_types && strategy.data_product_types.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                {strategy.data_product_types.map((type, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-600/50 text-slate-300 text-[10px] rounded flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    {type}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Non-activatable message */}
                            {!isActivatable && (
                              <p className="text-xs text-slate-400 mt-2 italic">
                                {maturity === 'development'
                                  ? "This strategy is under development. Use for testing and feedback."
                                  : "This strategy is in preview. It showcases future capabilities."}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {strategy.github?.baseUrl && (
                              <a
                                href={strategy.github.baseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-600"
                                title="View on GitHub"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
              <p className="text-xs text-slate-400">
                {catalogStrategies.length} {catalogStrategies.length === 1 ? 'strategy' : 'strategies'} available
              </p>
              <button
                onClick={closeCatalogModal}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnvironmentSettings;
