"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  History,
  Info,
  Layers,
  Link2,
  Loader2,
  Play,
  Search,
  Server,
  Square
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ModelSelectionCard from './ModelSelectionCard';
import ModelConfigurationPanel from './ModelConfigurationPanel';
import { useDataModels } from '@/providers/DataModelProvider';

const ACTIVE_JOB_STATUSES = new Set(['queued', 'running', 'canceling']);
const ACTIVATION_STRATEGY_MISMATCH_PATTERN = /ACTIVATION_STRATEGY_MISMATCH|strategy differs from current manifest|active strategy differs from current manifest/i;
const SOURCE_TEMPLATE_NOT_FOUND_PATTERN = /SOURCE_TEMPLATE_NOT_FOUND|No generation source for template_id=/i;

function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return '';
  return domain.trim().toLowerCase();
}

function isActiveJob(job) {
  return ACTIVE_JOB_STATUSES.has((job?.status || '').toLowerCase());
}

function isSourceTemplateNotFound(job) {
  if (!job || typeof job !== 'object') return false;
  const code = String(job.errorCode || '').toUpperCase();
  if (code === 'SOURCE_TEMPLATE_NOT_FOUND') return true;
  const message = String(job.error || '');
  return SOURCE_TEMPLATE_NOT_FOUND_PATTERN.test(message);
}

function extractMissingTemplateId(message = '') {
  const text = String(message || '');
  const match = text.match(/template_id=([^\.]+)\./i);
  return match?.[1]?.trim() || null;
}

function isActivationStrategyMismatch(job) {
  if (!job || typeof job !== 'object') return false;
  const code = String(job.errorCode || '').toUpperCase();
  if (code === 'ACTIVATION_STRATEGY_MISMATCH') return true;
  const message = String(job.error || '');
  return ACTIVATION_STRATEGY_MISMATCH_PATTERN.test(message);
}

function formatJobError(job) {
  if (!job || typeof job !== 'object') return 'Synthetic job failed';
  const code = String(job.errorCode || '').trim();
  const message = String(job.error || '').trim();
  if (code && message && !message.toUpperCase().includes(code.toUpperCase())) {
    return `${code}: ${message}`;
  }
  return message || code || 'Synthetic job failed';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const STEP_TITLES = [
  'Environment + Strategy',
  'Data Model Selection',
  'Link Rules',
  'Run + Monitor'
];

const LINK_TYPES = [
  'temporal_after',
  'co_occurs',
  'prerequisite',
  'related'
];

const KehrnelSyntheticWizard = ({ activeEnvironment, onJobStatusChange, onNavigate, onBackToSource, syntheticDataPreviewOnly }) => {
  const { dataModelsByName } = useDataModels();
  const [step, setStep] = useState(1);

  // Check if team is configured for preview-only mode (demo mode)
  // Handle both boolean true and string "true" from database
  const isPreviewOnlyMode = syntheticDataPreviewOnly === true || syntheticDataPreviewOnly === 'true';

  const syntheticLinks = useMemo(() => {
    const links = Array.isArray(activeEnvironment?.strategyLinks) ? activeEnvironment.strategyLinks : [];
    return links.filter((link) => link?.contexts?.synthetic);
  }, [activeEnvironment]);

  const domainOptions = useMemo(() => {
    return Array.from(
      new Set(
        syntheticLinks
          .map((link) => normalizeDomain(link?.domain))
          .filter(Boolean)
      )
    );
  }, [syntheticLinks]);

  const [selectedDomain, setSelectedDomain] = useState('');

  useEffect(() => {
    if (!domainOptions.length) {
      setSelectedDomain('');
      return;
    }
    if (!selectedDomain || !domainOptions.includes(selectedDomain)) {
      setSelectedDomain(domainOptions[0]);
    }
  }, [domainOptions, selectedDomain]);

  const selectedStrategyLink = useMemo(() => {
    if (!selectedDomain) return null;
    return syntheticLinks.find((link) => normalizeDomain(link?.domain) === selectedDomain) || null;
  }, [syntheticLinks, selectedDomain]);

  const selectedStrategyId = useMemo(() => {
    if (!selectedStrategyLink) return '';
    return String(selectedStrategyLink?.kehrnel?.strategyId || selectedStrategyLink?.strategyId || '');
  }, [selectedStrategyLink]);

  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [models, setModels] = useState([]);
  const [modelSearch, setModelSearch] = useState('');
  const [selectedModelConfigs, setSelectedModelConfigs] = useState({});

  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState(null);
  // Suggested semantic links loaded from Mongo (used as a starting point).
  // Users can apply/merge these into the active `linkRules` list.
  const [suggestedLinkRules, setSuggestedLinkRules] = useState([]);
  const [linkRules, setLinkRules] = useState([]);

  const [patientCount, setPatientCount] = useState(1000);
  const [sourceDatabase, setSourceDatabase] = useState('');
  const [sourceCollection] = useState('');
  const [catalogDatabase, setCatalogDatabase] = useState('');
  const [catalogCollection, setCatalogCollection] = useState('user-data-models');
  const [linksDatabase, setLinksDatabase] = useState('');
  const [linksCollection, setLinksCollection] = useState('semantic_links');
  const [dryRun, setDryRun] = useState(false);
  const [planOnly, setPlanOnly] = useState(true);
  const [validationMode, setValidationMode] = useState('none');
  const [validationSampleSize, setValidationSampleSize] = useState(50);
  const [failOnValidationError, setFailOnValidationError] = useState(false);
  const [skipInvalidDocuments, setSkipInvalidDocuments] = useState(true);
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobError, setJobError] = useState(null);
  const [jobWarning, setJobWarning] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [lastSubmittedJob, setLastSubmittedJob] = useState(null);
  const autoRetryAttemptedRef = useRef(false);
  const recoveredMismatchJobsRef = useRef(new Set());
  const recoveredMissingTemplateJobsRef = useRef(new Set());
  const lastSubmittedPayloadRef = useRef(null);

  useEffect(() => {
    const envDb = activeEnvironment?.database || '';
    if (!catalogDatabase && envDb) setCatalogDatabase(envDb);
    if (!linksDatabase && envDb) setLinksDatabase(envDb);
  }, [activeEnvironment?.database, catalogDatabase, linksDatabase]);

  const selectedModels = useMemo(() => {
    return models
      .filter((model) => selectedModelConfigs[model.model_id]?.selected)
      .map((model) => {
        const cfg = selectedModelConfigs[model.model_id] || {};
        return {
          model_id: model.model_id,
          min_per_patient: Math.max(0, toInteger(cfg.min_per_patient, 0)),
          max_per_patient: Math.max(0, toInteger(cfg.max_per_patient, 1)),
          weight: Math.max(0, toNumber(cfg.weight, 1)),
          sample_pool_size: Math.max(0, toInteger(cfg.sample_pool_size, 0)),
          name: model.name,
          template_id: model.template_id
        };
      })
      .map((entry) => {
        if (entry.max_per_patient < entry.min_per_patient) {
          return { ...entry, max_per_patient: entry.min_per_patient };
        }
        return entry;
      });
  }, [models, selectedModelConfigs]);

  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    if (!query) return models;
    return models.filter((model) => {
      const hay = [
        model.model_id,
        model.name,
        model.template_id,
        model.type,
        model.version
      ].join(' ').toLowerCase();
      return hay.includes(query);
    });
  }, [modelSearch, models]);

  const selectedModelIds = useMemo(() => selectedModels.map((model) => model.model_id), [selectedModels]);

  // Full model data for selected models (for configuration panel)
  const selectedModelsWithData = useMemo(() => {
    return models.filter((model) => selectedModelConfigs[model.model_id]?.selected);
  }, [models, selectedModelConfigs]);

  // Handler for removing a model from selection
  const removeModelFromSelection = (modelId) => {
    setSelectedModelConfigs((prev) => ({
      ...prev,
      [modelId]: {
        ...(prev[modelId] || {}),
        selected: false
      }
    }));
  };

  // Handler for configuration changes from the panel
  const handleConfigChange = (modelId, key, value) => {
    updateModelConfig(modelId, key, value);
  };

  // Client-side mirror of the server's mapUserDataModelToSemanticModel so the
  // fast path returns the exact same shape the wizard expects.
  const mapUserDataModelToSemanticModel = (doc, fallback = {}) => {
    const idAsString = doc?._id ? String(doc._id) : null;
    const templateId = doc?.metadata?.templateId || null;
    const modelName = doc?.name || templateId || idAsString || 'Unnamed model';
    const domain = doc?.domain || fallback.domain || 'openehr';
    return {
      model_id: idAsString || templateId || modelName,
      template_id: templateId,
      name: modelName,
      domain,
      strategy_id: fallback.strategyId || null,
      type: domain === 'openehr' ? 'opt' : (domain === 'fhir' ? 'fhir' : 'contextobject'),
      version: doc?.templateVersion || doc?.domainData?.schema?.version || null,
      status: 'active',
      storage_ref: null,
      checksum: null,
      lookupKeys: {
        id: idAsString,
        name: doc?.name || null,
        templateId,
        legacyModelId: doc?.model_id || doc?.modelId || null,
      },
    };
  };

  const loadModels = async () => {
    if (!selectedDomain || !selectedStrategyId) return;
    setModelsLoading(true);
    setModelsError(null);
    try {
      // Fast path: when the user has not overridden the catalog source,
      // derive the list from the shared DataModelProvider cache. This is the
      // default 99% of the time and avoids a round-trip per step-2 entry.
      const usingDefaultCollection =
        !catalogCollection.trim() || catalogCollection.trim() === 'user-data-models';
      const usingDefaultDatabase =
        !catalogDatabase.trim() ||
        (activeEnvironment?.database && catalogDatabase.trim() === activeEnvironment.database);

      if (usingDefaultCollection && usingDefaultDatabase) {
        const term = modelSearch.trim().toLowerCase();
        const items = Object.values(dataModelsByName || {})
          .filter(doc => (doc?.domain || 'openehr') === selectedDomain)
          .filter(doc => {
            if (!term) return true;
            const hay = [
              doc?.name,
              doc?.metadata?.templateId,
              doc?.domainData?.schema?.id,
            ].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(term);
          })
          .map(doc => mapUserDataModelToSemanticModel(doc, {
            domain: selectedDomain,
            strategyId: selectedStrategyId,
          }))
          .filter(model => !!model.model_id)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        setModels(items);
        setSelectedModelConfigs((prev) => {
          const next = { ...prev };
          for (const item of items) {
            if (!next[item.model_id]) {
              next[item.model_id] = {
                selected: false,
                min_per_patient: 1,
                max_per_patient: 1,
                weight: 1,
                sample_pool_size: ''
              };
            }
          }
          return next;
        });
        return;
      }

      // Fallback: user has pointed at a different database/collection — defer
      // to the server, which handles semantic_models and remote catalogs.
      const params = new URLSearchParams({
        domain: selectedDomain,
        strategyId: selectedStrategyId
      });
      if (modelSearch.trim()) params.set('search', modelSearch.trim());
      if (catalogDatabase.trim()) params.set('catalogDatabase', catalogDatabase.trim());
      if (catalogCollection.trim()) params.set('catalogCollection', catalogCollection.trim());

      const res = await fetch(`/api/synthetic-data/kehrnel/models?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load models');
      }

      const items = Array.isArray(data.items) ? data.items : [];
      setModels(items);

      setSelectedModelConfigs((prev) => {
        const next = { ...prev };
        for (const item of items) {
          if (!next[item.model_id]) {
            next[item.model_id] = {
              selected: false,
              min_per_patient: 1,
              max_per_patient: 1,
              weight: 1,
              sample_pool_size: ''
            };
          }
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to load data models:', error);
      setModelsError(error.message || 'Failed to load data models');
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const loadSuggestedLinks = async () => {
    if (!selectedDomain || !selectedStrategyId || !selectedModelIds.length) {
      setSuggestedLinkRules([]);
      return;
    }

    setLinksLoading(true);
    setLinksError(null);
    try {
      const params = new URLSearchParams({
        domain: selectedDomain,
        strategyId: selectedStrategyId,
        modelIds: selectedModelIds.join(',')
      });
      if (linksDatabase.trim()) params.set('linksDatabase', linksDatabase.trim());
      if (linksCollection.trim()) params.set('linksCollection', linksCollection.trim());
      const res = await fetch(`/api/synthetic-data/kehrnel/links?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load semantic links');
      }

      const items = Array.isArray(data.items) ? data.items : [];
      setSuggestedLinkRules(items);
    } catch (error) {
      console.error('Failed to load semantic links:', error);
      setLinksError(error.message || 'Failed to load semantic links');
      setSuggestedLinkRules([]);
    } finally {
      setLinksLoading(false);
    }
  };

  const loadRecentJobs = useCallback(async () => {
    if (!selectedDomain) {
      setRecentJobs([]);
      return;
    }
    try {
      const params = new URLSearchParams({ domain: selectedDomain, limit: '15' });
      const res = await fetch(`/api/synthetic-data/kehrnel/jobs?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) return;
      setRecentJobs(Array.isArray(data.items) ? data.items : []);
    } catch {
      // Non-blocking for UX
    }
  }, [selectedDomain]);

  useEffect(() => {
    loadRecentJobs();
  }, [selectedDomain, selectedStrategyId, loadRecentJobs]);

  useEffect(() => {
    if (step >= 2) {
      loadModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedDomain, selectedStrategyId, catalogDatabase, catalogCollection]);

  useEffect(() => {
    if (step >= 3) {
      loadSuggestedLinks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedDomain, selectedStrategyId, selectedModelIds.join(','), linksDatabase, linksCollection]);

  useEffect(() => {
    const active = isActiveJob(currentJob);
    if (onJobStatusChange) {
      if (active) {
        // Running state with progress
        onJobStatusChange({
          type: 'synthetic',
          status: 'running',
          progress: currentJob?.progress || 0
        });
      } else if (currentJob?.status?.toLowerCase() === 'completed' || currentJob?.status?.toLowerCase() === 'done') {
        // Completed state with summary
        const stats = currentJob?.stats || {};
        onJobStatusChange({
          type: 'synthetic',
          status: 'completed',
          summary: {
            patients: stats.generatedPatients || stats.patientCount || 0,
            documents: stats.generatedDocuments || 0,
            models: stats.modelCount || 0
          }
        });
      } else {
        // Idle, failed, or cancelled - clear status
        onJobStatusChange(null);
      }
    }
  }, [currentJob, onJobStatusChange]);

  useEffect(() => {
    // Avoid stale cross-run errors when changing domain/strategy
    setJobError(null);
    setJobWarning(null);
  }, [selectedDomain, selectedStrategyId]);

  useEffect(() => {
    const status = String(currentJob?.status || '').toLowerCase();
    const shouldClear = currentJob && !currentJob?.error && (
      isActiveJob(currentJob) || status === 'completed' || status === 'done'
    );
    if (shouldClear) {
      setJobError(null);
    }
  }, [currentJob]);


  const runActivationMismatchRecovery = useCallback(async (failedJob) => {
    const failedJobId = failedJob?.id || null;
    if (!failedJobId) return false;
    if (autoRetryAttemptedRef.current) return false;
    if (recoveredMismatchJobsRef.current.has(failedJobId)) return false;
    if (!isActivationStrategyMismatch(failedJob)) return false;
    if (!selectedDomain || !selectedStrategyId) return false;

    const isRetryablePayload = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return false;
      // Job list payload summaries look like: { keys: [...] }
      if (Array.isArray(candidate.keys) && Object.keys(candidate).length <= 2) return false;
      // Accept current schema and compatible legacy variants
      return Boolean(
        candidate.patient_count ||
        candidate.patients ||
        Array.isArray(candidate.models) ||
        Array.isArray(candidate.templates)
      );
    };

    const retryPayloadCandidates = [
      lastSubmittedPayloadRef.current,
      failedJob?.request?.payload,
      failedJob?.payload
    ];
    const retryPayload = retryPayloadCandidates.find(isRetryablePayload) || null;
    if (!retryPayload) {
      setJobError('Synthetic job failed with activation mismatch, but no retry payload is available.');
      return false;
    }

    recoveredMismatchJobsRef.current.add(failedJobId);
    autoRetryAttemptedRef.current = true;
    setJobSubmitting(true);
    setJobError('Detected activation mismatch. Upgrading activation and retrying job once...');

    try {
      const upgradeRes = await fetch('/api/synthetic-data/kehrnel/activations/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain,
          strategyId: selectedStrategyId,
          reason: 'auto-upgrade-after-synthetic-mismatch'
        })
      });
      const upgradeData = await upgradeRes.json().catch(() => ({}));
      if (!upgradeRes.ok) {
        throw new Error(upgradeData.error || 'Failed to upgrade activation after mismatch');
      }

      const retryRes = await fetch('/api/synthetic-data/kehrnel/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain,
          strategyId: selectedStrategyId,
          payload: retryPayload
        })
      });
      const retryData = await retryRes.json();
      if (!retryRes.ok) {
        throw new Error(retryData.error || 'Failed to retry synthetic job after activation upgrade');
      }

      const retriedJob = retryData.job || null;
      setCurrentJob(retriedJob);
      await loadRecentJobs();
      setJobError(null);
      return true;
    } catch (error) {
      console.error('Activation upgrade + retry failed:', error);
      setJobError(error.message || 'Automatic recovery failed');
      return false;
    } finally {
      setJobSubmitting(false);
    }
  }, [loadRecentJobs, selectedDomain, selectedStrategyId]);

  const runMissingTemplateRecovery = useCallback(async (failedJob) => {
    const failedJobId = failedJob?.id || null;
    if (!failedJobId) return false;
    if (recoveredMissingTemplateJobsRef.current.has(failedJobId)) return false;
    if (!isSourceTemplateNotFound(failedJob)) return false;
    if (!selectedDomain || !selectedStrategyId) return false;

    const missingTemplateId = extractMissingTemplateId(failedJob?.error || '');
    if (!missingTemplateId) return false;

    const basePayload = lastSubmittedPayloadRef.current;
    if (!basePayload || !Array.isArray(basePayload.models) || basePayload.models.length <= 1) {
      return false;
    }

    const modelMetaById = new Map(
      selectedModels.map((m) => [
        String(m.model_id || '').trim(),
        {
          name: String(m.name || '').trim(),
          template_id: String(m.template_id || '').trim()
        }
      ])
    );

    const missingLc = missingTemplateId.toLowerCase();
    const shouldDropModel = (modelId) => {
      const meta = modelMetaById.get(String(modelId || '').trim()) || {};
      const candidates = [
        String(modelId || '').trim(),
        String(meta.template_id || '').trim(),
        String(meta.name || '').trim()
      ].filter(Boolean).map((v) => v.toLowerCase());
      return candidates.includes(missingLc);
    };

    const filteredModels = basePayload.models.filter((m) => !shouldDropModel(m.model_id));
    if (!filteredModels.length || filteredModels.length === basePayload.models.length) {
      return false;
    }

    recoveredMissingTemplateJobsRef.current.add(failedJobId);
    setJobSubmitting(true);
    setJobWarning(`Template '${missingTemplateId}' has no generation source. Retrying without that model.`);

    try {
      const retryPayload = {
        ...basePayload,
        models: filteredModels
      };
      lastSubmittedPayloadRef.current = retryPayload;

      const retryRes = await fetch('/api/synthetic-data/kehrnel/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain,
          strategyId: selectedStrategyId,
          payload: retryPayload
        })
      });

      const retryData = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) {
        throw new Error(retryData.error || 'Failed to retry synthetic job after dropping missing template');
      }

      const retriedJob = retryData.job || null;
      setCurrentJob(retriedJob);
      await loadRecentJobs();
      setJobError(null);
      return true;
    } catch (error) {
      console.error('Missing-template recovery failed:', error);
      setJobError(error.message || 'Automatic missing-template recovery failed');
      return false;
    } finally {
      setJobSubmitting(false);
    }
  }, [loadRecentJobs, selectedDomain, selectedStrategyId, selectedModels]);

  useEffect(() => {
    if (!currentJob?.id || !isActiveJob(currentJob)) return undefined;

    let canceled = false;
    const poll = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedDomain) params.set('domain', selectedDomain);
        const res = await fetch(`/api/synthetic-data/kehrnel/jobs/${encodeURIComponent(currentJob.id)}?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to poll synthetic job');
        }
        if (!canceled) {
          const nextJob = data.job || null;
          setCurrentJob(nextJob);
          if (!isActiveJob(nextJob)) {
            if (nextJob?.error) {
              const recoveredMissingTemplate = await runMissingTemplateRecovery(nextJob);
              if (!recoveredMissingTemplate) {
                const recoveredActivation = await runActivationMismatchRecovery(nextJob);
                if (!recoveredActivation) {
                  if (isSourceTemplateNotFound(nextJob)) {
                    const missingTemplate = extractMissingTemplateId(nextJob?.error || '') || 'unknown';
                    setJobWarning(`Template '${missingTemplate}' has no generation source. Run completed with warning.`);
                    setJobError(null);
                  } else {
                    setJobError(formatJobError(nextJob));
                  }
                }
              }
            }
            loadRecentJobs();
          }
        }
      } catch (error) {
        if (!canceled) {
          console.error('Synthetic job polling failed:', error);
        }
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      canceled = true;
      clearInterval(interval);
    };
  }, [currentJob, loadRecentJobs, runActivationMismatchRecovery, runMissingTemplateRecovery, selectedDomain]);

  const toggleModelSelection = (modelId) => {
    setSelectedModelConfigs((prev) => {
        const current = prev[modelId] || {
          selected: false,
          min_per_patient: 1,
          max_per_patient: 1,
          weight: 1,
          sample_pool_size: ''
        };
      return {
        ...prev,
        [modelId]: {
          ...current,
          selected: !current.selected
        }
      };
    });
  };

  const updateModelConfig = (modelId, key, value) => {
    setSelectedModelConfigs((prev) => ({
      ...prev,
      [modelId]: {
        ...(prev[modelId] || {
          selected: true,
          min_per_patient: 1,
          max_per_patient: 1,
          weight: 1,
          sample_pool_size: ''
        }),
        [key]: value
      }
    }));
  };

  const addLinkRule = () => {
    setLinkRules((prev) => ([
      ...prev,
      {
        from: selectedModelIds[0] || '',
        to: selectedModelIds[1] || selectedModelIds[0] || '',
        probability: 0.5,
        min_to_per_patient: 1,
        type: 'related'
      }
    ]));
  };

  const replaceWithSuggestedLinks = () => {
    setLinkRules(Array.isArray(suggestedLinkRules) ? suggestedLinkRules : []);
  };

  const mergeSuggestedLinks = () => {
    const nextSuggested = Array.isArray(suggestedLinkRules) ? suggestedLinkRules : [];
    if (!nextSuggested.length) return;

    setLinkRules((prev) => {
      const existing = Array.isArray(prev) ? prev : [];
      const seen = new Set(existing.map((r) => `${r?.from || ''}::${r?.to || ''}::${r?.type || 'related'}`));
      const merged = [...existing];
      for (const rule of nextSuggested) {
        const key = `${rule?.from || ''}::${rule?.to || ''}::${rule?.type || 'related'}`;
        if (!rule?.from || !rule?.to) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(rule);
      }
      return merged;
    });
  };

  const removeLinkRule = (idx) => {
    setLinkRules((prev) => prev.filter((_, index) => index !== idx));
  };

  const updateLinkRule = (idx, key, value) => {
    setLinkRules((prev) => prev.map((rule, index) => {
      if (index !== idx) return rule;
      return {
        ...rule,
        [key]: value
      };
    }));
  };

  const submitSyntheticJob = async ({ forcePlanOnly } = {}) => {
    if (!selectedDomain || !selectedStrategyId) {
      setJobError('Select a valid domain and linked strategy first.');
      return;
    }
    if (!selectedModels.length) {
      setJobError('Select at least one data model.');
      return;
    }

    // When team is in preview-only mode, always force plan_only regardless of user toggle
    const effectivePlanOnly = isPreviewOnlyMode ? true : (forcePlanOnly !== undefined ? forcePlanOnly : planOnly);

    const selectedModelIdSet = new Set(selectedModelIds);
    const cleanedLinks = linkRules
      .filter((rule) => rule.from && rule.to)
      .filter((rule) => selectedModelIdSet.has(rule.from) && selectedModelIdSet.has(rule.to))
      .map((rule) => ({
        from: rule.from,
        to: rule.to,
        probability: Math.max(0, Math.min(1, toNumber(rule.probability, 1))),
        min_to_per_patient: Math.max(0, toInteger(rule.min_to_per_patient, 0)),
        type: rule.type || 'related'
      }));

    const payload = {
      patient_count: Math.max(1, toInteger(patientCount, 1)),
      ...(sourceDatabase.trim() ? { source_database: sourceDatabase.trim() } : {}),
      ...(sourceCollection.trim() ? { source_collection: sourceCollection.trim() } : {}),
      model_source: {
        ...(catalogDatabase.trim() ? { database_name: catalogDatabase.trim() } : {}),
        catalog_collection: catalogCollection.trim() || 'user-data-models'
      },
      models: selectedModels.map((item) => {
        const poolSize = toInteger(item.sample_pool_size, 0);
        return {
          model_id: item.model_id,
          min_per_patient: Math.max(0, toInteger(item.min_per_patient, 0)),
          max_per_patient: Math.max(0, toInteger(item.max_per_patient, 1)),
          weight: Math.max(0, toNumber(item.weight, 1)),
          // Only include sample_pool_size if it's 1 or greater (never send 0)
          ...(poolSize >= 1 ? { sample_pool_size: poolSize } : {})
        };
      }),
      links: cleanedLinks,
      dry_run: !!dryRun,
      plan_only: !!effectivePlanOnly,
      validate_generated_docs: validationMode,
      validation_sample_size: Math.max(1, toInteger(validationSampleSize, 50)),
      fail_on_validation_error: !!failOnValidationError,
      skip_invalid_documents: !!skipInvalidDocuments
    };
    lastSubmittedPayloadRef.current = payload;
    autoRetryAttemptedRef.current = false;

    try {
      setJobSubmitting(true);
      setJobError(null);
      setJobWarning(null);

      const res = await fetch('/api/synthetic-data/kehrnel/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain,
          strategyId: selectedStrategyId,
          payload
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'SOURCE_TEMPLATE_NOT_FOUND') {
          const missingTemplate = extractMissingTemplateId(data.error || '') || 'unknown';
          setJobWarning(`Template '${missingTemplate}' has no generation source. Please remove it or provide source data.`);
          setJobError(null);
          return;
        }
        throw new Error(data.error || 'Failed to submit synthetic job');
      }

      const createdJob = data.job || null;

      // Store job info for success message instead of inline monitoring
      setLastSubmittedJob(createdJob);
      setCurrentJob(createdJob); // Keep for onJobStatusChange callback

      await loadRecentJobs();
    } catch (error) {
      console.error('Failed to submit synthetic job:', error);
      setJobError(error.message || 'Failed to submit synthetic job');
    } finally {
      setJobSubmitting(false);
    }
  };

  const cancelCurrentJob = async () => {
    if (!currentJob?.id) return;
    try {
      const params = new URLSearchParams();
      if (selectedDomain) params.set('domain', selectedDomain);
      const res = await fetch(
        `/api/synthetic-data/kehrnel/jobs/${encodeURIComponent(currentJob.id)}/cancel?${params.toString()}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel job');
      }
      setCurrentJob(data.job || { ...currentJob, status: 'canceling' });
      await loadRecentJobs();
    } catch (error) {
      console.error('Failed to cancel synthetic job:', error);
      setJobError(error.message || 'Failed to cancel job');
    }
  };

  const canProceedStep1 = Boolean(activeEnvironment?.id && selectedDomain && selectedStrategyId);
  const canProceedStep2 = selectedModels.length > 0;

  const renderLegacyStepNavigator = () => (
    <div className="flex justify-between items-center mb-8">
      {STEP_TITLES.map((title, index) => {
        const stepNumber = index + 1;
        const isCompleted = step > stepNumber;
        const isCurrent = step === stepNumber;
        const isActive = step >= stepNumber;
        return (
          <React.Fragment key={title}>
            <button
              className={cn(
                "flex items-center transition-all",
                isCurrent ? 'text-primary' : isCompleted ? 'text-success' : 'text-theme-secondary'
              )}
              onClick={() => {
                if (stepNumber <= step) setStep(stepNumber);
              }}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                isCurrent
                  ? 'bg-primary/20 border-2 border-primary shadow-lg shadow-primary/20'
                  : isCompleted
                    ? 'bg-success/20 border-2 border-success'
                    : 'bg-surface-hover border-2 border-theme/50 hover:border-theme'
              )}>
                {isCompleted ? <CheckCircle2 size={16} /> : stepNumber}
              </div>
              <span className={cn(
                "ml-2 font-medium",
                isCurrent && "text-primary"
              )}>{title}</span>
            </button>
            {stepNumber < STEP_TITLES.length && (
              <div className={cn(
                "w-20 h-0.5 mx-2 transition-all",
                isCompleted ? 'bg-success' : isCurrent ? 'bg-primary/50' : 'bg-theme/20'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {onBackToSource && (
        <div className="flex justify-start">
          <button
            onClick={onBackToSource}
            className="px-4 py-2 bg-surface-hover text-theme-primary rounded-md hover:bg-surface flex items-center"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Data Source
          </button>
        </div>
      )}

      {jobError && (
        <div className="rounded-md border border-error/50 bg-error/10 px-4 py-3 text-sm text-error flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{jobError}</span>
        </div>
      )}

      {jobWarning && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5" />
          <span>{jobWarning}</span>
        </div>
      )}

      <div className="rounded-lg border border-theme/50 p-4 bg-surface">
        {renderLegacyStepNavigator()}

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-md border border-theme/30 p-3">
              <div className="text-xs text-theme-secondary mb-1">Active environment</div>
              <div className="flex items-center gap-2 text-theme-primary font-medium">
                <Database size={14} className="text-primary" />
                {activeEnvironment?.name || 'No environment selected'}
              </div>
              {activeEnvironment?.database && (
                <div className="text-xs text-theme-secondary mt-1">Database: {activeEnvironment.database}</div>
              )}
            </div>

            {domainOptions.length > 1 ? (
              <div>
                <label className="block text-sm text-theme-primary mb-1">Select domain</label>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(normalizeDomain(e.target.value))}
                  className="w-full rounded-md border border-theme/30 bg-background px-3 py-2 text-theme-primary"
                >
                  {domainOptions.map((domain) => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded-md border border-theme/30 px-3 py-2 inline-flex items-center gap-2 text-sm text-theme-primary">
                <Layers size={14} className="text-primary" />
                Domain: {selectedDomain || 'n/a'}
              </div>
            )}

            <div className="rounded-md border border-theme/30 p-3">
              <div className="text-xs text-theme-secondary mb-1">Linked strategy for synthetic context</div>
              {selectedStrategyId ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-theme-primary font-medium">
                    <Server size={14} className="text-primary" />
                    {selectedStrategyLink?.strategyName || selectedStrategyId}
                  </div>
                  <div className="text-xs text-theme-secondary">{selectedStrategyId}</div>
                  {selectedStrategyLink?.id && (
                    <div className="text-xs text-theme-secondary">Binding: {selectedStrategyLink.id}</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-error">No strategy linked for this domain.</div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                  canProceedStep1
                    ? 'bg-primary text-primary-text hover:bg-primary/80'
                    : 'bg-surface-hover text-theme-secondary cursor-not-allowed'
                )}
              >
                Continue
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* Catalog settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-theme/30 p-3">
              <div>
                <label className="block text-xs text-theme-secondary mb-1">Model catalog database</label>
                <input
                  value={catalogDatabase}
                  onChange={(e) => setCatalogDatabase(e.target.value)}
                  placeholder={activeEnvironment?.database || 'hdl-team'}
                  className="w-full rounded border border-theme/30 bg-background px-2 py-1.5 text-sm text-theme-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-theme-secondary mb-1">Model catalog collection</label>
                <input
                  value={catalogCollection}
                  onChange={(e) => setCatalogCollection(e.target.value)}
                  placeholder="user-data-models"
                  className="w-full rounded border border-theme/30 bg-background px-2 py-1.5 text-sm text-theme-primary"
                />
              </div>
            </div>

            {/* Search bar */}
            <div className="flex items-center gap-2 rounded-md border border-theme/30 px-3 py-2">
              <Search size={15} className="text-theme-secondary" />
              <input
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Search data models by id, name, template, or type"
                className="w-full bg-transparent text-sm text-theme-primary outline-none"
              />
              <button
                onClick={loadModels}
                className="text-xs px-2 py-1 rounded border border-theme/30 text-theme-primary hover:border-theme"
              >
                Refresh
              </button>
            </div>

            {modelsError && (
              <div className="text-sm text-error bg-error/10 border border-error/40 rounded-md px-3 py-2">
                {modelsError}
              </div>
            )}

            {/* Card-based model grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-theme-primary flex items-center gap-2">
                  <Layers size={16} className="text-primary" />
                  Available Data Models
                </h4>
                <span className="text-xs text-theme-secondary">
                  Click to select data models for generation
                </span>
              </div>
              <div className="max-h-[360px] overflow-auto rounded-lg border border-theme/30 p-3">
                {modelsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-primary mb-3" />
                    <span className="text-theme-secondary">Loading data models...</span>
                  </div>
                ) : filteredModels.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                      <Database size={28} className="text-warning/60" />
                    </div>
                    <p className="text-theme-primary font-medium mb-1">No data models found</p>
                    <p className="text-sm text-theme-secondary">
                      for domain <span className="text-primary font-medium">{selectedDomain}</span> and strategy <span className="text-primary font-medium">{selectedStrategyId || 'n/a'}</span>
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredModels.map((model) => (
                      <ModelSelectionCard
                        key={model.model_id}
                        model={model}
                        selected={!!selectedModelConfigs[model.model_id]?.selected}
                        onToggle={toggleModelSelection}
                        domain={selectedDomain}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected models configuration - appears immediately when models are selected */}
            <div className="mt-6">
              <ModelConfigurationPanel
                selectedModels={selectedModelsWithData}
                configs={selectedModelConfigs}
                onConfigChange={handleConfigChange}
                onRemove={removeModelFromSelection}
              />
            </div>

            <div className="flex justify-between pt-4 border-t border-theme/30">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 rounded-md border border-theme/50 px-4 py-2 text-sm text-theme-primary hover:bg-surface-hover"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                  canProceedStep2
                    ? 'bg-primary text-primary-text hover:bg-primary/80'
                    : 'bg-surface-hover text-theme-secondary cursor-not-allowed'
                )}
              >
                Continue to Link Rules
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent-1/20 flex items-center justify-center">
                <Link2 size={20} className="text-accent-1" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-theme-primary">Link Rules</h3>
                <p className="text-xs text-theme-secondary">
                  Optional. Use link rules to generate realistic relationships between models (for example: generate follow-ups after an initial event).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-theme/30 p-3">
              <div>
                <label className="block text-xs text-theme-secondary mb-1">Suggested links database</label>
                <input
                  value={linksDatabase}
                  onChange={(e) => setLinksDatabase(e.target.value)}
                  placeholder={catalogDatabase || activeEnvironment?.database || 'hdl-team'}
                  className="w-full rounded border border-theme/30 bg-background px-2 py-1.5 text-sm text-theme-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-theme-secondary mb-1">Suggested links collection</label>
                <input
                  value={linksCollection}
                  onChange={(e) => setLinksCollection(e.target.value)}
                  placeholder="semantic_links"
                  className="w-full rounded border border-theme/30 bg-background px-2 py-1.5 text-sm text-theme-primary"
                />
              </div>
            </div>

            <div className="rounded-md border border-theme/30 bg-background/30 px-3 py-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="text-xs text-theme-secondary flex items-center gap-2">
                  <Info size={14} className="text-theme-secondary" />
                  <span>
                    Suggested links: <span className="text-theme-primary font-medium">{suggestedLinkRules.length}</span>
                    {linksLoading ? (
                      <span className="ml-2 inline-flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin" />
                        Loading…
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={loadSuggestedLinks}
                    className="inline-flex items-center gap-2 rounded-md border border-theme/50 px-3 py-1.5 text-xs text-theme-primary hover:bg-surface-hover"
                  >
                    <Search size={13} />
                    Reload suggestions
                  </button>
                  <button
                    onClick={replaceWithSuggestedLinks}
                    disabled={!suggestedLinkRules.length}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium',
                      suggestedLinkRules.length
                        ? 'bg-primary text-primary-text hover:bg-primary/80'
                        : 'bg-surface-hover text-theme-secondary cursor-not-allowed'
                    )}
                  >
                    Replace rules
                  </button>
                  <button
                    onClick={mergeSuggestedLinks}
                    disabled={!suggestedLinkRules.length}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
                      suggestedLinkRules.length
                        ? 'border-theme/50 text-theme-primary hover:bg-surface-hover'
                        : 'border-theme/30 text-theme-secondary cursor-not-allowed'
                    )}
                  >
                    Merge rules
                  </button>
                  <button
                    onClick={() => setLinkRules([])}
                    disabled={!linkRules.length}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
                      linkRules.length
                        ? 'border-error/40 text-error hover:bg-error/10'
                        : 'border-theme/30 text-theme-secondary cursor-not-allowed'
                    )}
                  >
                    Clear rules
                  </button>
                </div>
              </div>
              <div className="mt-1 text-[11px] text-theme-secondary">
                The database/collection above is only used to load suggestions. The job uses the rules in the table below.
              </div>
            </div>

            {linksError && (
              <div className="text-sm text-error bg-error/10 border border-error/40 rounded-md px-3 py-2">
                {linksError}
              </div>
            )}

            <div className="rounded-md border border-theme/30 overflow-hidden">
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background sticky top-0 border-b border-theme/30">
                    <tr className="text-theme-secondary text-xs">
                      <th className="text-left px-3 py-2">From</th>
                      <th className="text-left px-3 py-2">To</th>
                      <th className="text-left px-3 py-2 w-28">Probability</th>
                      <th className="text-left px-3 py-2 w-28">Min to / pt</th>
                      <th className="text-left px-3 py-2 w-44">Type</th>
                      <th className="text-right px-3 py-2 w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkRules.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-theme-secondary">
                          No active link rules configured.
                        </td>
                      </tr>
                    ) : (
                      linkRules.map((rule, idx) => (
                        <tr key={`${rule.from}-${rule.to}-${idx}`} className="border-t border-theme/40">
                          <td className="px-3 py-2">
                            <select
                              value={rule.from || ''}
                              onChange={(e) => updateLinkRule(idx, 'from', e.target.value)}
                              className="w-full rounded border border-theme/30 bg-background px-2 py-1 text-xs text-theme-primary"
                            >
                              {selectedModels.map((model) => (
                                <option key={model.model_id} value={model.model_id}>
                                  {model.name} ({model.model_id})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={rule.to || ''}
                              onChange={(e) => updateLinkRule(idx, 'to', e.target.value)}
                              className="w-full rounded border border-theme/30 bg-background px-2 py-1 text-xs text-theme-primary"
                            >
                              {selectedModels.map((model) => (
                                <option key={model.model_id} value={model.model_id}>
                                  {model.name} ({model.model_id})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max="1"
                              step="0.05"
                              value={rule.probability}
                              onChange={(e) => updateLinkRule(idx, 'probability', e.target.value)}
                              className="w-20 rounded border border-theme/30 bg-background px-2 py-1 text-xs text-theme-primary"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={rule.min_to_per_patient}
                              onChange={(e) => updateLinkRule(idx, 'min_to_per_patient', e.target.value)}
                              className="w-20 rounded border border-theme/30 bg-background px-2 py-1 text-xs text-theme-primary"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={rule.type || 'related'}
                              onChange={(e) => updateLinkRule(idx, 'type', e.target.value)}
                              className="w-full rounded border border-theme/30 bg-background px-2 py-1 text-xs text-theme-primary"
                            >
                              {LINK_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => removeLinkRule(idx)}
                              className="text-xs rounded border border-error/40 px-2 py-1 text-error hover:bg-error/10"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <button
                onClick={addLinkRule}
                className="inline-flex items-center gap-2 rounded-md border border-theme/50 px-3 py-1.5 text-xs text-theme-primary hover:bg-surface-hover"
              >
                <Link2 size={13} />
                Add link rule
              </button>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-md border border-theme/50 px-4 py-2 text-sm text-theme-primary hover:bg-surface-hover"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text hover:bg-primary/80"
              >
                Continue
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <Play size={20} className="text-success" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-theme-primary">Run + Monitor</h3>
                <p className="text-xs text-theme-secondary">Review settings and generate your synthetic data</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-md border border-theme/30 p-3">
                <div className="text-xs text-theme-secondary mb-1">Domain</div>
                <div className="text-sm font-medium text-theme-primary">{selectedDomain || 'n/a'}</div>
              </div>
              <div className="rounded-md border border-theme/30 p-3">
                <div className="text-xs text-theme-secondary mb-1">Strategy</div>
                <div className="text-sm font-medium text-theme-primary truncate">{selectedStrategyId || 'n/a'}</div>
              </div>
              <div className="rounded-md border border-theme/30 p-3">
                <div className="text-xs text-theme-secondary mb-1">Selected data models</div>
                <div className="text-sm font-medium text-primary">{selectedModels.length}</div>
              </div>
              <div className="rounded-md border border-theme/30 p-3">
                <div className="text-xs text-theme-secondary mb-1">Input mode</div>
                <div className="text-sm font-medium text-theme-primary">Model catalog</div>
              </div>
            </div>

            {/* Patient count slider + input + estimate */}
            <div className="rounded-lg border border-theme/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-theme-primary flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-primary" />
                  Number of Patients
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={patientCount}
                    onChange={(e) => setPatientCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                    className="w-24 rounded border border-theme/30 bg-background px-2 py-1 text-sm text-theme-primary font-semibold text-right focus:border-primary focus:outline-none"
                  />
                  <span className="text-xs text-theme-secondary">patients</span>
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={Math.min(1000, patientCount)}
                onChange={(e) => setPatientCount(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none bg-theme/20 cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-theme-secondary">
                <span>10</span>
                <span>250</span>
                <span>500</span>
                <span>1,000</span>
              </div>

              {/* Estimated output */}
              {selectedModels.length > 0 && (
                <div className="pt-4 border-t border-theme/20">
                  <div className="text-xs text-theme-secondary mb-3 font-medium uppercase tracking-wide">Estimated Output</div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-lg border border-theme/20 p-3">
                      <div className="text-xl font-bold text-theme-primary">
                        {(() => {
                          const avgDocsPerPatient = selectedModels.reduce((sum, m) => {
                            const min = toInteger(m.min_per_patient, 1);
                            const max = toInteger(m.max_per_patient, 1);
                            return sum + ((min + max) / 2);
                          }, 0);
                          return Math.round(toInteger(patientCount, 1) * avgDocsPerPatient).toLocaleString();
                        })()}
                      </div>
                      <div className="text-[10px] text-theme-secondary mt-1">Documents</div>
                    </div>
                    <div className="rounded-lg border border-theme/20 p-3">
                      <div className="text-xl font-bold text-theme-primary">
                        {(() => {
                          const avgDocsPerPatient = selectedModels.reduce((sum, m) => {
                            const min = toInteger(m.min_per_patient, 1);
                            const max = toInteger(m.max_per_patient, 1);
                            return sum + ((min + max) / 2);
                          }, 0);
                          const totalDocs = toInteger(patientCount, 1) * avgDocsPerPatient;
                          const sizeKB = totalDocs * 5; // ~5KB average per document
                          if (sizeKB < 1024) return `${Math.round(sizeKB)} KB`;
                          if (sizeKB < 1024 * 1024) return `${(sizeKB / 1024).toFixed(1)} MB`;
                          return `${(sizeKB / 1024 / 1024).toFixed(1)} GB`;
                        })()}
                      </div>
                      <div className="text-[10px] text-theme-secondary mt-1">Est. Size</div>
                    </div>
                    <div className="rounded-lg border border-theme/20 p-3">
                      <div className="text-xl font-bold text-primary">{selectedModels.length}</div>
                      <div className="text-[10px] text-theme-secondary mt-1">Data Models</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-theme/30 p-4 space-y-3">
              <div className="text-sm font-medium text-theme-primary">Validation</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-theme-secondary">Validate generated documents</span>
                  <select
                    value={validationMode}
                    onChange={(e) => setValidationMode(e.target.value)}
                    className="rounded border border-theme/30 bg-background px-2 py-2 text-sm text-theme-primary"
                  >
                    <option value="none">No validation</option>
                    <option value="sample">Validate sample</option>
                    <option value="all">Validate all</option>
                  </select>
                </label>
                {validationMode === 'sample' && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-theme-secondary">Sample size</span>
                    <input
                      type="number"
                      min="1"
                      value={validationSampleSize}
                      onChange={(e) => setValidationSampleSize(Math.max(1, toInteger(e.target.value, 50)))}
                      className="rounded border border-theme/30 bg-background px-2 py-2 text-sm text-theme-primary"
                    />
                  </label>
                )}
              </div>
              {validationMode !== 'none' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-xs text-theme-primary">
                    <input
                      type="checkbox"
                      checked={failOnValidationError}
                      onChange={(e) => setFailOnValidationError(e.target.checked)}
                      className="rounded border-theme/40 bg-background text-primary focus:ring-primary"
                    />
                    Fail job on validation errors
                  </label>
                  <label className="flex items-center gap-2 text-xs text-theme-primary">
                    <input
                      type="checkbox"
                      checked={skipInvalidDocuments}
                      onChange={(e) => setSkipInvalidDocuments(e.target.checked)}
                      className="rounded border-theme/40 bg-background text-primary focus:ring-primary"
                    />
                    Skip invalid documents
                  </label>
                </div>
              )}
            </div>

            {/* Preview-only mode banner */}
            {isPreviewOnlyMode && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400 flex items-center gap-2">
                <Info size={16} className="flex-shrink-0" />
                <span>
                  <strong>Demo Mode:</strong> This workspace is configured for preview-only. Jobs will simulate execution without writing data.
                </span>
              </div>
            )}

            {/* Show Generate button only if no job has been submitted yet */}
            {!lastSubmittedJob?.id && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => submitSyntheticJob({ forcePlanOnly: isPreviewOnlyMode ? true : false })}
                  disabled={jobSubmitting || !selectedModels.length}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                    jobSubmitting || !selectedModels.length
                      ? 'bg-surface-hover text-theme-secondary cursor-not-allowed'
                      : isPreviewOnlyMode
                        ? 'bg-amber-500 text-white hover:bg-amber-500/80'
                        : 'bg-success text-success-text hover:bg-success/80'
                  )}
                >
                  {jobSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {isPreviewOnlyMode ? 'Preview Generation' : 'Generate Synthetic Data'}
                </button>
                {currentJob?.id && isActiveJob(currentJob) && (
                  <button
                    onClick={cancelCurrentJob}
                    className="inline-flex items-center gap-2 rounded-md border border-error/40 px-4 py-2 text-sm text-error hover:bg-error/10"
                  >
                    <Square size={13} />
                    Cancel job
                  </button>
                )}
              </div>
            )}

            {/* Job Submitted Success Message - minimal and smooth */}
            {lastSubmittedJob?.id && (
              <div className="flex items-center gap-3 py-3 px-4 rounded-md border border-success/30 bg-success/5">
                <CheckCircle2 size={18} className="text-success flex-shrink-0" />
                <span className="text-sm text-theme-primary">
                  Job started successfully.{' '}
                  <button
                    onClick={() => onNavigate?.('history')}
                    className="text-primary hover:underline font-medium"
                  >
                    View in Jobs History →
                  </button>
                </span>
              </div>
            )}

            <div className="flex justify-start">
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-md border border-theme/50 px-4 py-2 text-sm text-theme-primary hover:bg-surface-hover"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default KehrnelSyntheticWizard;
