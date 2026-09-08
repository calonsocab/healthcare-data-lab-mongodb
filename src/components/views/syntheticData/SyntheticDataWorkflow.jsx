// src/components/views/syntheticData/SyntheticDataWorkflow.jsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDataModels } from '@/providers/DataModelProvider';
import { usePersistenceStrategies } from '@/providers/PersistenceStrategyProvider';
import {
  Bot,
  Database,
  FileSpreadsheet,
  Users,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Upload,
  Info,
  ArrowRight,
  ArrowLeft,
  Server,
  History
} from 'lucide-react';
import TemplateSelector from './TemplateSelector';
import GenerationProgressPanel from './GenerationProgressPanel';
import SyntheticDataInfo from './SyntheticDataInfo';
import PatientDistributionChart from './PatientDistributionChart';
import CompositionDataImport from './CompositionDataImport';
import KehrnelSyntheticWizard from './KehrnelSyntheticWizard';
import { cn } from '@/lib/utils';

const SyntheticData = ({ onJobStatusChange, onNavigate, syntheticDataPreviewOnly }) => {
  const {
    dataModelsByName: templatesByName,
    isLoading: templatesLoading,
    error: templatesError,
    activeEnvironment
  } = useDataModels();
  const { ensureStrategyById } = usePersistenceStrategies();

  // Data source selection state
  const [dataSourceType, setDataSourceType] = useState('kehrnel'); // 'kehrnel' | 'dataLab' | 'imported'
  const [importData, setImportData] = useState(null);

  // Template selection state
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplates, setSelectedTemplates] = useState([]);

  // Data generation parameters
  const [patientCount, setPatientCount] = useState(1000);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [strategyConfig, setStrategyConfig] = useState('{}');
  const [strategyError, setStrategyError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [validationMode, setValidationMode] = useState('none'); // none | sample | all
  const [validationSampleSize, setValidationSampleSize] = useState(50);
  const [failOnValidationError, setFailOnValidationError] = useState(false);
  const [skipInvalidDocuments, setSkipInvalidDocuments] = useState(true);
  const isSyncingStrategy = React.useRef(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generationStats, setGenerationStats] = useState({
    patientsCreated: 0,
    templatesProcessed: 0,
    templatesTotal: 0,
    totalDocuments: 0,
    estimatedSize: 0
  });

  const [generationPhase, setGenerationPhase] = useState('initializing');
  const [currentBatch, setCurrentBatch] = useState(1);
  const [totalBatches, setTotalBatches] = useState(1);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [currentJobDomain, setCurrentJobDomain] = useState('openehr');
  const [selectedStrategyBinding, setSelectedStrategyBinding] = useState(null);
  const [lastCompletedJob, setLastCompletedJob] = useState(null);

  // UI state
  const [error, setError] = useState(null);
  const [progressErrors, setProgressErrors] = useState(0);
  const [showStatusMessage, setShowStatusMessage] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentStep, setCurrentStep] = useState(1); // 1: Select data source, 2: Choose templates, 3: Set parameters
  const [metadata, setMetadata] = useState(null);
  const [activeStrategyId, setActiveStrategyId] = useState(null);
  const debugLoggedRef = React.useRef(false);
  const isKehrnelFlow = dataSourceType === 'kehrnel';

  // Strategies linked to the active environment (synthetic context only)
  const syntheticStrategyLinks = useMemo(() => {
    if (!activeEnvironment?.strategyLinks) return [];
    return (activeEnvironment.strategyLinks || []).filter(link => link.contexts?.synthetic);
  }, [activeEnvironment]);

  const syntheticStrategyMap = useMemo(() => {
    return syntheticStrategyLinks.reduce((acc, link) => {
      const key = (link.strategyId || '').toString();
      if (key) acc[key] = link;
      return acc;
    }, {});
  }, [syntheticStrategyLinks]);

  const defaultSyntheticStrategyId = useMemo(() => {
    if (activeStrategyId) {
      const match = syntheticStrategyLinks.find(
        link => (link.strategyId || '').toString() === activeStrategyId
      );
      if (match) return match.strategyId;
    }
    return syntheticStrategyLinks[0]?.strategyId || null;
  }, [syntheticStrategyLinks, activeStrategyId]);

;

  const getEffectiveBinding = useCallback(() => {
    // Prefer a link whose strategyId matches the selected strategy
    const selectedId = (selectedStrategy?._id || selectedStrategy?.id || '').toString();
    const matchByStrategy = syntheticStrategyLinks.find(
      link => (link.strategyId || '').toString() === selectedId
    );
    if (matchByStrategy) return matchByStrategy;
    // Otherwise use the first available link for this environment
    return syntheticStrategyLinks[0] || null;
  }, [selectedStrategy, syntheticStrategyLinks]);

  const linkedActiveStrategyMissing = useMemo(() => {
    if (!syntheticStrategyLinks.length) return false;
    const candidateId = (selectedStrategy?._id || selectedStrategy?.id || activeStrategyId || '').toString();
    if (!candidateId) return false;
    if (selectedStrategyBinding) return false; // already linked
    return !syntheticStrategyLinks.some(link => (link.strategyId || '').toString() === candidateId);
  }, [selectedStrategy, activeStrategyId, syntheticStrategyLinks, selectedStrategyBinding]);

  // Notify parent of job status changes
  useEffect(() => {
    if (onJobStatusChange) {
      if (isGenerating) {
        // Running state with progress
        onJobStatusChange({
          type: 'synthetic',
          status: 'running',
          progress: progress || 0
        });
      } else if (generationPhase === 'completed' && generationStats?.patientsCreated > 0) {
        // Completed state with summary
        onJobStatusChange({
          type: 'synthetic',
          status: 'completed',
          summary: {
            patients: generationStats.patientsCreated || 0,
            documents: generationStats.totalDocuments || 0,
            models: generationStats.templatesProcessed || 0
          }
        });
      } else {
        // Idle or cancelled - clear status
        onJobStatusChange(null);
      }
    }
  }, [isGenerating, progress, generationPhase, generationStats, onJobStatusChange]);

  // Ensure all API response data is properly handled with bounds checking
  const updateProgress = (progressData) => {
    if (progressData && typeof progressData.progress === 'number') {
      // Clamp progress to [0, 100] range
      const clampedProgress = Math.max(0, Math.min(100, progressData.progress));
      setProgress(clampedProgress);
    } else {
      setProgress(0); // Default to 0 if progress is undefined
    }
  };

  // Calculate distribution data based on selected templates and patient count
  const calculateDistributionData = useCallback(() => {
    if (!selectedTemplates.length) return [];

    // If we have metadata and templates, calculate based on actual data
    if (metadata?.templates) {
      return selectedTemplates.map(template => {
        // Find the template data in metadata
        const templateData = Object.entries(metadata.templates)
          .find(([id, data]) => id === template.id || id === template.name || data.name === template.name);

        const compositionsPerTemplate = templateData ? templateData[1].count : 0;
        const averageCompositionsPerPatient = templateData
          ? compositionsPerTemplate / Math.max(1, metadata.filteredSyntheticDataSummary?.patient_count || 1)
          : 1;

        const estimatedDocumentCount = Math.floor(patientCount * averageCompositionsPerPatient);
        // Estimate size: assume about 10KB per composition
        const estimatedSize = estimatedDocumentCount * 0.01; // Size in MB

        return {
          templateName: template.name,
          archetypeId: template.archetypeId,
          documentCount: estimatedDocumentCount,
          estimatedSize: estimatedSize,
          compositionsPerPatient: averageCompositionsPerPatient
        };
      });
    }

    // Fallback if no metadata available - use random generation for demo
    return selectedTemplates.map(template => ({
      templateName: template.name,
      archetypeId: template.archetypeId || 'Unknown',
      documentCount: Math.floor(patientCount * (Math.random() * 3 + 1)), // Between 1-4 per patient
      estimatedSize: Math.floor(patientCount * (Math.random() * 0.3 + 0.1)), // 100-400KB per patient
      compositionsPerPatient: (Math.random() * 3 + 1).toFixed(1) // 1-4 compositions per patient
    }));
  }, [selectedTemplates, patientCount, metadata]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch('/api/synthetic-data/metadata');
        if (response.ok) {
          const data = await response.json();
          setMetadata(data);
        }
      } catch (error) {
        console.error('Error fetching metadata:', error);
      }
    };

    fetchMetadata();
  }, []);

  // Debug: compare tenant templates vs available synthetic samples
  useEffect(() => {
    if (debugLoggedRef.current) return;
    if (!metadata?.templates || !templatesByName) return;
    const metaIds = new Set(Object.keys(metadata.templates));
    const dbIds = new Set(Object.keys(templatesByName));
    const dbNames = new Set(Object.values(templatesByName).map(t => t.name));

    const missingInDb = Array.from(metaIds).filter(id => !dbIds.has(id) && !dbNames.has(id));
    const missingInSamples = Array.from(dbIds).filter(id => !metaIds.has(id));

    console.info('[SyntheticData][Debug] Template coverage check', {
      dbCount: dbIds.size,
      sampleCount: metaIds.size,
      missingInDb,
      missingInSamples
    });
    debugLoggedRef.current = true;
  }, [metadata, templatesByName]);

  // Keep strategy binding aligned with the active environment and selection
  useEffect(() => {
    const resolveLink = () => {
      if (!syntheticStrategyLinks.length) return { link: null, strategyId: null };

      const selectedId = (selectedStrategy?._id || selectedStrategy?.id || '').toString();
      if (selectedId && syntheticStrategyMap[selectedId]) {
        return { link: syntheticStrategyMap[selectedId], strategyId: selectedId };
      }

      const activeId = (activeStrategyId || '').toString();
      if (activeId && syntheticStrategyMap[activeId]) {
        return { link: syntheticStrategyMap[activeId], strategyId: activeId };
      }

      const firstLink = syntheticStrategyLinks[0];
      return { link: firstLink || null, strategyId: firstLink?.strategyId ? firstLink.strategyId.toString() : null };
    };

    const { link, strategyId } = resolveLink();
    if (link) {
      setSelectedStrategyBinding(link);
      const currentId = (selectedStrategy?._id || selectedStrategy?.id || '').toString();
      if (strategyId && strategyId !== currentId) {
        ensureStrategyById(strategyId)
          .then(data => {
            if (data?._id) {
              setSelectedStrategy({ ...data });
              setStrategyConfig(JSON.stringify(data.config || {}, null, 2));
              setActiveStrategyId(data._id.toString());
            }
          })
          .catch(err => {
            console.warn('Failed to fetch linked strategy for environment:', err);
          });
      }
    } else {
      setSelectedStrategyBinding(null);
    }
  }, [selectedStrategy, syntheticStrategyLinks, syntheticStrategyMap, activeStrategyId, ensureStrategyById]);

  // Sync strategy strictly to the environment's linked strategy (deterministic 1-1)
  // Uses merged config (default + overrides) from environment strategy endpoint
  useEffect(() => {
    const syncToEnvironmentLink = async () => {
      if (isSyncingStrategy.current) return;
      if (!syntheticStrategyLinks.length) {
        setSelectedStrategy(null);
        setSelectedStrategyBinding(null);
        setStrategyError('No persistence strategy is linked to this environment.');
        return;
      }
      const binding = syntheticStrategyLinks[0];
      if (!binding?.strategyId) return;
      const currentId = (selectedStrategy?._id || selectedStrategy?.id || '').toString();
      if (currentId === binding.strategyId.toString() && selectedStrategyBinding) {
        setStrategyError(null);
        return;
      }

      try {
        isSyncingStrategy.current = true;

        // Fetch merged config (default + overrides) from environment strategy endpoint
        let mergedConfig = {};
        if (activeEnvironment?.id) {
          const mergedRes = await fetch(
            `/api/environments/strategy?envId=${activeEnvironment.id}&domain=${binding.domain || 'openEHR'}`
          );
          if (mergedRes.ok) {
            const mergedData = await mergedRes.json();
            mergedConfig = mergedData.mergedConfig || {};
          }
        }

        // Resolve the full strategy document from the shared cache (no extra fetch
        // when the provider has already loaded the list).
        const data = await ensureStrategyById(binding.strategyId);
        if (data?._id) {
          // Override the strategy config with merged config from environment
          setSelectedStrategy({ ...data, config: mergedConfig });
          setSelectedStrategyBinding(binding);
          setStrategyConfig(JSON.stringify(mergedConfig || {}, null, 2));
          setActiveStrategyId(data._id.toString());
          setStrategyError(null);
        } else {
          console.warn('Failed to fetch linked strategy for environment');
          setStrategyError('Failed to load the linked strategy for this environment.');
        }
      } catch (err) {
        console.warn('Error syncing strategy to environment link:', err);
        setStrategyError('Failed to load the linked strategy for this environment.');
      } finally {
        isSyncingStrategy.current = false;
      }
    };

    syncToEnvironmentLink();
  }, [syntheticStrategyLinks, selectedStrategy, selectedStrategyBinding, activeEnvironment, ensureStrategyById]);

  // Set available templates from cached templates and filtered for those with synthetic data
  useEffect(() => {
    const fetchAvailableTemplates = async () => {
      try {
        // Get synthetic data metadata to filter templates
        const metadataResponse = await fetch('/api/synthetic-data/metadata');
        if (!metadataResponse.ok) throw new Error('Failed to fetch synthetic data metadata');

        const metadata = await metadataResponse.json();
        const metadataTemplates = metadata.templates || {};
        const availableTemplateIds = new Set(
          Object.entries(metadataTemplates)
            .filter(([, info]) => (info?.count || 0) > 0)
            .map(([id]) => id)
        );

        const resolveMetadataEntry = (template) => {
          const templateId = (template._id || template.id || '').toString();
          const templateName = (template.name || '').trim();
          const templateNameLc = templateName.toLowerCase();
          const templateMetaId = (template.metadata?.templateId || '').toString();
          const archetypeId = template.webTemplate?.archetype_node_id || template.webTemplate?.nodeId || '';

          return Object.entries(metadataTemplates).find(([id, entry]) => {
            const entryName = (entry.name || '').trim();
            const entryNameLc = entryName.toLowerCase();
            return (
              id === templateId ||
              id === templateName ||
              id === templateMetaId ||
              entryName === templateName ||
              entryNameLc === templateNameLc ||
              (archetypeId && entry.archetype_node_id === archetypeId)
            );
          });
        };

        if (templatesByName && Object.keys(templatesByName).length > 0) {
          // Filter templates to only include those with synthetic data available
          const filteredTemplates = Object.values(templatesByName)
            .map(template => {
              const templateId = (template._id || template.id || '').toString();
              const templateName = template.name;
              const metadataEntryPair = resolveMetadataEntry(template);
              const metadataEntry = metadataEntryPair ? metadataEntryPair[1] : null;
              const archetypeId =
                template.webTemplate?.archetype_node_id ||
                template.webTemplate?.nodeId ||
                metadataEntry?.archetype_node_id ||
                '';

              return {
                id: templateId,
                name: templateName,
                templateId: template.metadata?.templateId || template.templateId || '',
                description: template.metadata?.description || 'No description',
                archetypeId,
                compositionCount: metadataEntry?.count || 0,
                hasSyntheticData: !!metadataEntry
              };
            })
            .filter(template => template.hasSyntheticData);

          setAvailableTemplates(filteredTemplates);
        }
      } catch (error) {
        console.error('Error fetching available templates:', error);
      }
    };

    fetchAvailableTemplates();
  }, [templatesByName, importData]);

  const selectedTemplateIdsKey = useMemo(
    () => selectedTemplates.map((t) => t.id).join(','),
    [selectedTemplates]
  );

  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
  }, [
    selectedStrategy?._id,
    activeEnvironment?.id,
    patientCount,
    dataSourceType,
    importData,
    selectedTemplateIdsKey
  ]);

  // Kehrnel jobs are managed in Jobs History.
  // Show status message
  const showStatus = (message) => {
    setStatusMessage(message);
    setShowStatusMessage(true);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      setShowStatusMessage(false);
    }, 5000);
  };

  const buildStrategyPayload = useCallback(() => {
    try {
      const parsed = strategyConfig ? JSON.parse(strategyConfig) : {};
      return { ...parsed, _fullStrategy: selectedStrategy };
    } catch (err) {
      throw new Error('Invalid strategy config JSON');
    }
  }, [strategyConfig, selectedStrategy]);

  // Handle data import completion
  const handleDataImported = (data) => {
    setImportData(data);
    setDataSourceType('imported');
    showStatus(`Successfully imported ${data.summary.compositionCount} compositions from ${data.summary.patientCount} patients`);

    // Move to template selection
    setCurrentStep(2);
  };

  // Handle start generation
  const handleStartGeneration = async () => {
    if (selectedTemplates.length === 0) {
      setError('Please select at least one template');
      return;
    }

    const effectiveBinding = getEffectiveBinding();
    if (!effectiveBinding || !selectedStrategy?._id) {
      setError('This environment has no linked persistence strategy. Link one in Environment Settings.');
      return;
    }

    if (!activeEnvironment?.id) {
      setError('No active environment configured. Please configure one in Environment Settings.');
      return;
    }

    const domain = String(effectiveBinding.domain || 'openehr').toLowerCase();
    const strategyId = String(selectedStrategy?._id || effectiveBinding.strategyId || '').trim();
    if (!strategyId) {
      setError('No strategy selected for synthetic generation.');
      return;
    }

    try {
      setError(null);
      setIsGenerating(true);
      setProgress(0);
      setProgressErrors(0);
      setGenerationPhase('initializing');
      setCurrentBatch(1);
      setTotalBatches(1);

      // Reset generation stats
      setGenerationStats({
        patientsCreated: 0,
        templatesProcessed: 0,
        templatesTotal: selectedTemplates.length,
        totalDocuments: 0,
        estimatedSize: 0
      });

      const requestedModels = selectedTemplates
        .map((t) => ({
          id: String(t.id || '').trim(),
          templateId: String(t.templateId || '').trim(),
          name: String(t.name || '').trim()
        }))
        .filter((m) => m.id || m.templateId || m.name);

      const modelSource = {
        database_name: activeEnvironment?.database || null,
        catalog_collection: 'user-data-models'
      };

      let templateIds = requestedModels
        .map((m) => m.id || m.templateId || m.name)
        .filter(Boolean);

      // Preflight for model-driven mode: resolve selected entries by model_id/template_id/name and skip only unresolved ones.
      if (dataSourceType !== 'imported' && requestedModels.length > 0) {
        try {
          const params = new URLSearchParams({
            domain,
            strategyId,
            catalogDatabase: modelSource.database_name || '',
            catalogCollection: modelSource.catalog_collection || 'user-data-models'
          });
          const modelsRes = await fetch(`/api/synthetic-data/kehrnel/models?${params.toString()}`);
          const modelsData = await modelsRes.json().catch(() => ({}));
          if (!modelsRes.ok) {
            throw new Error(modelsData.error || 'Failed to validate selected models against catalog');
          }

          const catalogItems = Array.isArray(modelsData.items) ? modelsData.items : [];
          const byAnyKey = new Map();

          for (const item of catalogItems) {
            const modelId = String(item.model_id || '').trim();
            if (!modelId) continue;
            const keys = [
              modelId,
              String(item.template_id || '').trim(),
              String(item.name || '').trim(),
              String(item.localized_name || '').trim()
            ].filter(Boolean);
            for (const key of keys) {
              byAnyKey.set(key.toLowerCase(), modelId);
            }
          }

          const resolvedModelIds = [];
          const missingLabels = [];

          for (const requested of requestedModels) {
            const candidates = [requested.id, requested.templateId, requested.name].filter(Boolean);
            const resolved = candidates
              .map((key) => byAnyKey.get(key.toLowerCase()))
              .find(Boolean);

            if (resolved) {
              resolvedModelIds.push(resolved);
            } else {
              missingLabels.push(requested.name || requested.templateId || requested.id || 'unknown');
            }
          }

          const uniqueResolved = Array.from(new Set(resolvedModelIds));

          if (missingLabels.length > 0 && uniqueResolved.length > 0) {
            templateIds = uniqueResolved;
            showStatus(
              `Skipping ${missingLabels.length} model(s) not available in ${modelSource.database_name}.${modelSource.catalog_collection}. Continuing with ${uniqueResolved.length}.`
            );
          } else if (missingLabels.length > 0 && uniqueResolved.length === 0) {
            throw new Error(
              `None of the selected models are available in ${modelSource.database_name}.${modelSource.catalog_collection}.`
            );
          } else {
            templateIds = uniqueResolved;
          }
        } catch (precheckError) {
          throw new Error(precheckError.message || 'Failed to validate selected models');
        }
      }

      let kehrnelPayload;
      if (dataSourceType === 'imported') {
        const importId = importData?.importIds?.[0] || null;
        kehrnelPayload = {
          patient_count: Number(patientCount),
          generation_mode: 'from_source',
          source_database: 'hdl_core',
          source_collection: 'sample_compositions',
          source_templates: templateIds,
          ...(importId ? { source_filter: { source: `import:${importId}` } } : {}),
          links: [],
          dry_run: false,
          plan_only: false,
          validate_generated_docs: validationMode,
          validation_sample_size: Math.max(1, Number(validationSampleSize) || 50),
          fail_on_validation_error: !!failOnValidationError,
          skip_invalid_documents: !!skipInvalidDocuments
        };
      } else {
        kehrnelPayload = {
          patient_count: Number(patientCount),
          generation_mode: 'from_models',
          model_source: modelSource,
          models: templateIds.map((id) => ({
            model_id: id,
            min_per_patient: 1,
            max_per_patient: 1,
            weight: 1
          })),
          links: [],
          dry_run: false,
          plan_only: false,
          validate_generated_docs: validationMode,
          validation_sample_size: Math.max(1, Number(validationSampleSize) || 50),
          fail_on_validation_error: !!failOnValidationError,
          skip_invalid_documents: !!skipInvalidDocuments
        };
      }

      const generationRequest = {
        domain,
        strategyId,
        payload: kehrnelPayload
      };

      console.log('Starting Kehrnel synthetic job:', JSON.stringify(generationRequest, null, 2));

      const response = await fetch('/api/synthetic-data/kehrnel/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generationRequest)
      });

      const startData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(startData.error || `Failed to start synthetic generation: ${response.status}`);
      }

      const startedJob = startData.job || {};
      const jobId = startedJob.id || startedJob.jobId || null;
      if (!jobId) {
        throw new Error('Synthetic job started but no job ID was returned');
      }

      setCurrentJobId(jobId);
      setCurrentJobDomain(domain);

      let cancelled = false;
      let consecutivePollErrors = 0;
      const poll = async () => {
        if (cancelled) return;
        try {
          const params = new URLSearchParams({ domain });
          const progressResponse = await fetch(`/api/synthetic-data/kehrnel/jobs/${encodeURIComponent(jobId)}?${params.toString()}`);
          const progressData = await progressResponse.json().catch(() => ({}));

          if (!progressResponse.ok) {
            consecutivePollErrors += 1;
            setProgressErrors(consecutivePollErrors);
            if (consecutivePollErrors > 5) {
              throw new Error(progressData.error || 'Failed to fetch generation progress after multiple attempts');
            }
            return;
          }

          consecutivePollErrors = 0;
          setProgressErrors(0);
          const job = progressData.job || {};
          updateProgress({ progress: Number(job.progress || 0) });
          setGenerationPhase(job.phase || (job.status === 'completed' ? 'completed' : 'processing'));

          const stats = job.stats || {};
          const patientsCreated = Number(
            stats.generatedPatients ?? stats.patientCount ?? job.generatedPatients ?? job.patientCount ?? 0
          );
          const templatesProcessed = Number(
            stats.modelCount ?? job.modelCount ?? selectedTemplates.length
          );
          const totalDocuments = Number(
            stats.generatedDocuments ?? job.generatedDocuments ?? job.generatedDocs ?? 0
          );

          setGenerationStats({
            patientsCreated,
            templatesProcessed,
            templatesTotal: selectedTemplates.length,
            totalDocuments,
            estimatedSize: Number((totalDocuments * 0.01).toFixed(2))
          });

          const status = String(job.status || '').toLowerCase();
          if (status === 'completed') {
            cancelled = true;
            setIsGenerating(false);
            setGenerationPhase('completed');
            setLastCompletedJob({ id: jobId, stats: generationStats });
            showStatus('Generation completed successfully!');
            return;
          }
          if (status === 'failed' || status === 'error' || status === 'canceled' || status === 'cancelled') {
            cancelled = true;
            setIsGenerating(false);
            setError(job.error || `Generation ${status}`);
            return;
          }
        } catch (pollError) {
          console.error('Error fetching generation progress:', pollError);
          consecutivePollErrors += 1;
          setProgressErrors(consecutivePollErrors);
          if (consecutivePollErrors > 5) {
            cancelled = true;
            setIsGenerating(false);
            setError(pollError.message || 'Failed to fetch generation progress');
          }
        }
      };

      const progressInterval = setInterval(poll, 2000);
      await poll();

      // Cleanup interval on component unmount
      return () => {
        cancelled = true;
        clearInterval(progressInterval);
      };
    } catch (startError) {
      console.error('Error starting data generation:', startError);
      setError(startError.message || 'Failed to start data generation');
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    if (selectedTemplates.length === 0) {
      setPreviewError('Select at least one template to preview the output');
      return;
    }

    const effectiveBinding = getEffectiveBinding();
    if (!selectedStrategy?._id || !effectiveBinding) {
      setPreviewError('Link a persistence strategy to this environment before previewing.');
      return;
    }

    if (!activeEnvironment?.id) {
      setPreviewError('Configure a target environment before previewing');
      return;
    }

    try {
      const strategyConfigWithFullDoc = buildStrategyPayload();
      setPreviewLoading(true);
      setPreviewError(null);

      const previewRequest = {
        templates: selectedTemplates.map(t => t.id),
        patientCount,
        strategyId: selectedStrategy?._id,
        strategyConfig: strategyConfigWithFullDoc,
        strategyBindingId: effectiveBinding?.id || null,
        environment: activeEnvironment.id,
        importId: dataSourceType === 'imported' ? importData?.importIds?.[0] || null : null
      };

      const response = await fetch('/api/synthetic-data/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewRequest)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || response.statusText);
      }

      const data = await response.json();
      setPreview(data);
    } catch (err) {
      console.error('Error building preview:', err);
      setPreviewError(err.message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle cancel generation
  const handleCancelGeneration = async () => {
    if (!currentJobId) {
      setError('No active job to cancel');
      return;
    }

    try {
      const params = new URLSearchParams({ domain: currentJobDomain || 'openehr' });
      const res = await fetch(
        `/api/synthetic-data/kehrnel/jobs/${encodeURIComponent(currentJobId)}/cancel?${params.toString()}`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel job');
      }

      setIsGenerating(false);
      setProgress(0);
      setCurrentJobId(null);
      showStatus('Generation canceled');
    } catch (error) {
      console.error('Error canceling generation:', error);
      setError(`Failed to cancel generation: ${error.message}`);
    }
  };

  // Handle template selection complete
  const handleTemplateSelectionComplete = () => {
    if (selectedTemplates.length > 0) {
      setCurrentStep(3);
    } else {
      setError('Please select at least one template');
    }
  };

  // Render workflow steps - unified with KehrnelSyntheticWizard style
  const renderWorkflowSteps = () => {
    const step2Label = isKehrnelFlow ? 'Choose Models' : 'Choose Templates';
    const step3Label = isKehrnelFlow ? 'Run Generation' : 'Configure Deployment';
    const steps = ['Select Data Source', step2Label, step3Label];

    return (
      <div className="flex justify-between items-center mb-8">
        {steps.map((title, index) => {
          const stepNumber = index + 1;
          const isCompleted = currentStep > stepNumber;
          const isCurrent = currentStep === stepNumber;
          return (
            <React.Fragment key={title}>
              <button
                className={cn(
                  "flex items-center transition-all",
                  isCurrent ? 'text-primary' : isCompleted ? 'text-success' : 'text-theme-secondary'
                )}
                onClick={() => {
                  if (stepNumber <= currentStep) setCurrentStep(stepNumber);
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
              {stepNumber < steps.length && (
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
  };

  return (
    <div className="space-y-6">
      {templatesLoading && (
        <div className="p-3 bg-surface border border-theme rounded text-theme-primary">
          Loading templates…
        </div>
      )}
      {templatesError && (
        <div className="p-3 bg-error/20 border border-error/50 rounded text-error">
          Failed to load templates: {templatesError}
        </div>
      )}
      <div className="flex justify-between items-center">
        {/* Left-aligned title and subtitle */}
        <div>
          <h2 className="text-xl font-semibold text-theme-primary">Synthetic Data Generator</h2>
          <p className="text-sm text-theme-secondary">
            Create synthetic document instances and upload them in your database
          </p>
        </div>

        {/* Status message */}
        {showStatusMessage && (
          <div className="px-3 py-1 rounded-md border border-theme/30 text-theme-primary text-sm flex items-center">
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-error/20 text-error rounded-md border border-error/50">
          <h3 className="text-lg font-medium mb-2 flex items-center">
            <AlertCircle size={18} className="mr-2" />
            Error
          </h3>
          <p>{error}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setError(null)}
              className="px-3 py-1 rounded-md border border-theme/50 text-sm text-theme-primary hover:border-theme"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Generation progress panel (visible when generating) */}
      {isGenerating ? (
        <GenerationProgressPanel
          phase={generationPhase}
          progress={progress}
          currentBatch={currentBatch}
          totalBatches={totalBatches}
          processedPatients={generationStats.patientsCreated}
          totalPatients={patientCount}
          generationStats={generationStats}
          onCancel={handleCancelGeneration}
          environment={activeEnvironment}
          strategy={selectedStrategy}
          targetCollections={selectedStrategy?.blueprint?.collections || {
            compositions: 'compositions',
            meta: 'ehr_index'
          }}
        />
      ) : (
        <>
          {/* Workflow Steps Navigator */}
          {(!isKehrnelFlow || currentStep === 1) && renderWorkflowSteps()}

          {/* Step 1: Data Source Selection */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Kehrnel Data Source Option */}
              <div
                className={cn(
                  "bg-surface rounded-xl p-6 border-2 cursor-pointer transition-all hover:bg-surface-hover flex flex-col min-h-[400px]",
                  dataSourceType === 'kehrnel' ? "border-primary" : "border-theme"
                )}
                onClick={() => setDataSourceType('kehrnel')}
              >
                <div className="flex items-center mb-4">
                  <Bot size={24} className="text-primary mr-3" />
                  <h3 className="text-lg font-medium text-theme-primary">Model-Driven (Kehrnel)</h3>
                </div>
                <p className="text-theme-secondary mb-4">
                  Generate synthetic data from data models by domain and strategy, using Kehrnel-governed jobs.
                </p>
                <div className="bg-primary/10 p-3 rounded-md border border-primary/30 text-sm text-theme-primary flex items-start">
                  <Info size={16} className="text-primary mt-0.5 mr-2 flex-shrink-0" />
                  <span>Recommended for multi-strategy workflows. Uses models, links, and env-scoped jobs.</span>
                </div>

                <button
                  className={cn(
                    "w-full mt-auto py-3 rounded-md flex items-center justify-center text-base font-medium",
                    dataSourceType === 'kehrnel'
                      ? "bg-primary hover:bg-primary/80 text-primary-text"
                      : "bg-surface-hover text-theme-primary hover:bg-surface"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDataSourceType('kehrnel');
                    setCurrentStep(2);
                  }}
                >
                  <span className="mr-2">Continue with Model-Driven Flow</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* DataLab Data Source Option */}
              <div
                className={cn(
                  "bg-surface rounded-xl p-6 border-2 cursor-pointer transition-all hover:bg-surface-hover flex flex-col min-h-[400px]",
                  dataSourceType === 'dataLab' ? "border-primary" : "border-theme"
                )}
                onClick={() => setDataSourceType('dataLab')}
              >
                <div className="flex items-center mb-4">
                  <Database size={24} className="text-primary mr-3" />
                  <h3 className="text-lg font-medium text-theme-primary">Use Data Lab Data</h3>
                </div>
                <p className="text-theme-secondary mb-4">
                  Generate synthetic data using the templates and compositions available in the MongoDB Healthcare Data Lab.
                </p>
                <div className="bg-primary/10 p-3 rounded-md border border-primary/30 text-sm text-theme-primary flex items-start">
                  <Info size={16} className="text-primary mt-0.5 mr-2 flex-shrink-0" />
                  <span>The dataLab provides a curated set of templates with sample data ready for generation.</span>
                </div>

                <button
                  className={cn(
                    "w-full mt-auto py-3 rounded-md flex items-center justify-center text-base font-medium",
                    dataSourceType === 'dataLab'
                      ? "bg-primary hover:bg-primary/80 text-primary-text"
                      : "bg-surface-hover text-theme-primary hover:bg-surface"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDataSourceType('dataLab');
                    setCurrentStep(2);
                  }}
                >
                  <span className="mr-2">Continue with Data Lab Data</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* Import Your Own Data Option */}
              <div
                className={cn(
                  "bg-surface rounded-xl p-6 border-2 cursor-pointer transition-all hover:bg-surface-hover flex flex-col min-h-[400px]",
                  dataSourceType === 'imported' ? "border-success" : "border-theme"
                )}
                onClick={() => setDataSourceType('imported')}
              >
                <div className="flex items-center mb-4">
                  <Upload size={24} className="text-success mr-3" />
                  <h3 className="text-lg font-medium text-theme-primary">Import Your Own Data</h3>
                </div>
                <p className="text-theme-secondary mb-4">
                  Upload your own composition data files to use as templates for generating synthetic patients.
                </p>

                <div className="bg-success/10 p-3 rounded-md border border-success/30 text-sm text-theme-primary flex items-start">
                  <Info size={16} className="text-success mt-0.5 mr-2 flex-shrink-0" />
                  <span>Upload JSON or JSONL files containing composition data that follows the OpenEHR format.</span>
                </div>

                {importData ? (
                  <div className="mt-4 bg-success/20 p-3 rounded-md text-success text-sm">
                    <div className="flex items-center mb-2">
                      <CheckCircle2 size={16} className="mr-2" />
                      <span className="font-medium">Data Successfully Imported</span>
                    </div>
                    <p>Imported {importData.summary.compositionCount} compositions from {importData.summary.patientCount} patients.</p>
                    <button
                      className="w-full mt-3 py-3 bg-success hover:bg-success/80 text-success-text rounded-md flex items-center justify-center text-base font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentStep(2);
                      }}
                    >
                      <span className="mr-2">Continue with Imported Data</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    className={cn(
                      "w-full mt-auto py-3 rounded-md flex items-center justify-center text-base font-medium",
                      dataSourceType === 'imported'
                        ? "bg-success hover:bg-success/80 text-success-text"
                        : "bg-surface-hover text-theme-primary hover:bg-surface"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDataSourceType('imported');
                    }}
                  >
                    <span className="mr-2">Import Data Files</span>
                    <Upload size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Show import panel if selected */}
          {currentStep === 1 && dataSourceType === 'imported' && !importData && (
            <div className="mt-6">
              <CompositionDataImport onDataImported={handleDataImported} />
            </div>
          )}

          {/* Kehrnel Model-Driven Flow */}
          {isKehrnelFlow && currentStep >= 2 && (
            <KehrnelSyntheticWizard
              activeEnvironment={activeEnvironment}
              onJobStatusChange={onJobStatusChange}
              onNavigate={onNavigate}
              onBackToSource={() => setCurrentStep(1)}
              syntheticDataPreviewOnly={syntheticDataPreviewOnly}
            />
          )}

          {/* Step 2: Template Selection */}
          {currentStep === 2 && !isKehrnelFlow && (
            <div className="space-y-6">
              <div className="bg-primary/10 p-3 rounded-md border border-primary/30 flex items-start mb-4">
                <Info size={16} className="text-primary mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-theme-primary">
                    <span className="font-medium">Data Source:</span> {dataSourceType === 'dataLab' ? 'Data Lab Data' : 'Imported Data'}
                    {importData && dataSourceType === 'imported' && ` (${importData.summary.compositionCount} compositions from ${importData.summary.patientCount} patients)`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Template selection */}
                <div className="bg-surface rounded-lg p-4">
                  <h3 className="text-lg font-medium text-theme-primary mb-4 flex items-center">
                    <FileSpreadsheet className="mr-2" size={20} />
                    Template Selection
                  </h3>
                  <TemplateSelector
                    availableTemplates={availableTemplates}
                    selectedTemplates={selectedTemplates}
                    setSelectedTemplates={setSelectedTemplates}
                  />
                </div>

                {/* Selected Data Overview */}
                {selectedTemplates.length > 0 && (
                  <div className="bg-surface rounded-lg p-4">
                    <h3 className="text-lg font-medium text-theme-primary mb-4 flex items-center">
                      <Database className="mr-2" size={20} />
                      Selected Data Overview
                    </h3>

                    {/* Display SyntheticDataInfo component with just the selected tab content */}
                    <SyntheticDataInfo
                      importData={dataSourceType === 'imported' ? importData : null}
                      selectedTemplates={selectedTemplates}
                      patientCount={patientCount}
                      displayMode="selected" // Add this prop to control which content to display
                    />

                    {/* Data Distribution Chart */}
                    {selectedTemplates.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-theme-primary mb-3">Data Distribution</h4>
                        <PatientDistributionChart
                          distributionData={calculateDistributionData()}
                          patientCount={patientCount}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Template selection actions */}
                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="inline-flex items-center gap-2 rounded-md border border-theme/50 px-4 py-2 text-sm text-theme-primary hover:border-theme"
                  >
                    <ArrowLeft size={14} />
                    Back to Data Source
                  </button>

                  <button
                    onClick={handleTemplateSelectionComplete}
                    disabled={selectedTemplates.length === 0}
                    className={cn(
                      "px-6 py-2 rounded-md flex items-center",
                      selectedTemplates.length === 0
                        ? "bg-surface-hover text-theme-secondary cursor-not-allowed"
                        : "bg-primary hover:bg-primary/80 text-primary-text"
                    )}
                  >
                    Continue to Configuration
                    <ArrowRight size={16} className="ml-2" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Deployment Configuration */}
          {currentStep === 3 && !isKehrnelFlow && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Generation settings */}
                <div className="bg-surface rounded-lg p-4">
                  <h3 className="text-lg font-medium text-theme-primary mb-4 flex items-center">
                    <Server className="mr-2" size={20} />
                    Configure Deployment
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="patientCount" className="block text-sm font-medium text-theme-primary mb-1">
                        Number of Patients to Generate
                      </label>
                      <div className="flex items-center">
                        <input
                          id="patientCount"
                          type="range"
                          min="10"
                          max="10000"
                          step="10"
                          value={patientCount}
                          onChange={(e) => setPatientCount(Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none bg-theme/20 cursor-pointer accent-primary"
                        />
                        <input
                          type="number"
                          value={patientCount}
                          onChange={(e) => setPatientCount(Number(e.target.value))}
                          min="10"
                          max="10000"
                          className="ml-4 w-24 p-1 bg-background border border-theme/30 rounded text-theme-primary focus:border-primary focus:outline-none"
                        />
                      </div>
                      <p className="text-xs text-theme-secondary mt-1">
                        Total documents to be created: approximately {selectedTemplates.length * patientCount}
                      </p>
                    </div>

                    {/* Target Environment (read-only) */}
                    <div className="rounded-md border border-theme/30 p-3">
                      <h4 className="text-sm font-medium text-theme-primary mb-1">Target Environment</h4>
                      {activeEnvironment ? (
                        <div className="text-sm text-theme-primary flex items-center gap-2">
                          <Database size={16} className="text-primary" />
                          <div>
                            <div>{activeEnvironment.name}</div>
                            {activeEnvironment.database && (
                              <div className="text-xs text-theme-secondary">
                                Database: {activeEnvironment.database}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-error">
                          Configure an environment in Settings before generating data.
                        </div>
                      )}
                    </div>

                    {/* Strategy (read-only) */}
                    <div className="rounded-md border border-theme/30 p-3 mb-3">
                      <h4 className="text-sm font-medium text-theme-primary mb-2 flex items-center gap-2">
                        <Server size={14} className="text-primary" />
                        Active Strategy (Strategy Studio)
                      </h4>
                      {selectedStrategy ? (
                        <div className="text-sm text-theme-primary">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{selectedStrategy.name}</span>
                            {selectedStrategy.blueprint?.domain && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface border border-theme/50 text-theme-primary">
                                {Array.isArray(selectedStrategy.blueprint.domain)
                                  ? selectedStrategy.blueprint.domain.join(', ')
                                  : selectedStrategy.blueprint.domain}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-theme-secondary mt-1">
                            From Strategy Studio{selectedStrategyBinding ? ' • Linked to this environment' : ' • Not linked to this environment'}
                          </div>
                          {selectedStrategyBinding && (
                            <div className="text-xs text-primary mt-1">
                              Using environment link: {selectedStrategyBinding.alias || selectedStrategyBinding.strategyName}
                            </div>
                          )}
                          <div className="text-xs text-theme-secondary mt-2">
                            To change the active strategy, update it in Strategy Studio or Environment Settings.
                          </div>
                          {strategyError && (
                            <div className="text-xs text-error mt-2">
                              {strategyError}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-error">
                          No active strategy found. Set one in Strategy Studio.
                        </div>
                      )}
                    </div>

                    {/* Validation controls */}
                    <div className="rounded-md border border-theme/30 p-3">
                      <h4 className="text-sm font-medium text-theme-primary mb-2">Validation</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-theme-secondary mb-1">Validate generated documents</label>
                          <select
                            value={validationMode}
                            onChange={(e) => setValidationMode(e.target.value)}
                            className="w-full rounded border border-theme/30 bg-background px-2 py-2 text-sm text-theme-primary focus:border-primary focus:outline-none"
                          >
                            <option value="none">No validation</option>
                            <option value="sample">Validate sample</option>
                            <option value="all">Validate all</option>
                          </select>
                        </div>

                        {validationMode === 'sample' && (
                          <div>
                            <label className="block text-xs text-theme-secondary mb-1">Sample size</label>
                            <input
                              type="number"
                              min="1"
                              value={validationSampleSize}
                              onChange={(e) => setValidationSampleSize(Math.max(1, Number(e.target.value) || 1))}
                              className="w-full rounded border border-theme/30 bg-background px-2 py-2 text-sm text-theme-primary focus:border-primary focus:outline-none"
                            />
                          </div>
                        )}

                        {validationMode !== 'none' && (
                          <div className="space-y-2">
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
                    </div>
                  </div>
                </div>

                {/* Generation overview */}
                <div className="bg-surface rounded-lg p-4">
                  <h3 className="text-lg font-medium text-theme-primary mb-4 flex items-center">
                    <Database className="mr-2" size={20} />
                    Deployment Overview
                  </h3>

                  <div className="space-y-4">
                    {/* Selected Templates Overview */}
                    <div className="rounded-md border border-theme/30 p-3">
                      <h4 className="text-sm font-medium text-theme-primary mb-2">Selected Templates</h4>
                      <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar p-1">
                        {selectedTemplates.length === 0 ? (
                          <div className="text-sm text-theme-secondary italic">No templates selected</div>
                        ) : (
                          selectedTemplates.map(template => (
                            <div
                              key={template.id}
                              className="px-2 py-1 rounded-md border border-theme/40 text-xs text-theme-primary flex items-center"
                            >
                              <FileSpreadsheet size={12} className="mr-1 text-primary" />
                              {template.name}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="text-xs text-theme-secondary mt-2">
                        {selectedTemplates.length} templates selected
                      </div>
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="text-xs text-primary hover:text-primary/80 mt-1 flex items-center"
                      >
                        Change template selection
                      </button>
                    </div>

                    {/* Generation Details */}
                    <div className="rounded-md border border-theme/30 p-3">
                      <h4 className="text-sm font-medium text-theme-primary mb-2">Generation Details</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-theme-secondary">Patients</div>
                          <div className="text-lg font-medium text-theme-primary">{patientCount.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-theme-secondary">Total Documents</div>
                          <div className="text-lg font-medium text-theme-primary">
                            ~{(patientCount * selectedTemplates.length).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Preview panel */}
              <div className="bg-surface rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-medium text-theme-primary">Pre-generation Preview</h3>
                    <p className="text-xs text-theme-secondary">
                      Review the target database, collection names, field mappings, and a sample document before generating.
                    </p>
                  </div>
                  <button
                    onClick={handlePreview}
                    disabled={previewLoading || selectedTemplates.length === 0 || !selectedStrategy?._id || !activeEnvironment?.id}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm flex items-center gap-2",
                      previewLoading || selectedTemplates.length === 0 || !selectedStrategy?._id || !activeEnvironment?.id
                        ? "bg-surface-hover text-theme-secondary cursor-not-allowed"
                        : "bg-primary hover:bg-primary/80 text-primary-text"
                    )}
                  >
                    {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {previewLoading ? 'Building preview…' : 'Preview output'}
                  </button>
                </div>

                {previewError && (
                  <div className="mb-3 text-sm text-error bg-error/20 border border-error/50 rounded-md p-2">
                    {previewError}
                  </div>
                )}

                {preview ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div className="p-3 rounded-md border border-theme/30">
                        <h4 className="text-sm font-medium text-theme-primary mb-2">Target</h4>
                        <div className="text-xs text-theme-primary">
                          <div className="flex items-center gap-2">
                            <Database size={14} className="text-primary" />
                            <span>{preview.environment?.name}</span>
                          </div>
                          <div className="mt-1 text-theme-secondary">DB: {preview.environment?.database}</div>
                          <div className="mt-2">
                            <div className="text-theme-secondary">Collections</div>
                            <ul className="text-[11px] text-theme-primary mt-1 space-y-1">
                              <li>Compositions: {preview.collections?.compositions}</li>
                              <li>Meta: {preview.collections?.meta}</li>
                              <li>Search: {preview.collections?.search || 'disabled'}</li>
                              <li>Dictionaries: {preview.collections?.dictionaries}</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-md border border-theme/30">
                        <h4 className="text-sm font-medium text-theme-primary mb-2">Field Mappings</h4>
                        <ul className="text-xs text-theme-primary space-y-1">
                          <li>EHR ID → {preview.fieldMappings?.ehrIdField}</li>
                          <li>Template ID → {preview.fieldMappings?.templateIdField}</li>
                          <li>Version → {preview.fieldMappings?.versionField}</li>
                        </ul>
                        {preview.indexes && (
                          <div className="mt-3 text-xs text-theme-primary">
                            <div className="flex items-center gap-2">
                              <Server size={14} className="text-primary" />
                              <span>Indexes are not auto-created. Apply manually.</span>
                            </div>
                            {Array.isArray(preview.indexes.recommended) && preview.indexes.recommended.length > 0 && (
                              <div className="mt-2">
                                <div className="text-theme-secondary">Recommended indexes (manual)</div>
                                <ul className="mt-1 space-y-1 text-[11px] text-theme-primary">
                                  {preview.indexes.recommended.map((idx, i) => (
                                    <li key={i}>
                                      {idx.collection}: {Array.isArray(idx.fields) ? idx.fields.join(', ') : idx.field || 'field'}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {preview.indexes.atlasSearch && (
                              <div className="mt-2 text-[11px] text-theme-primary">
                                Atlas Search index: {preview.indexes.atlasSearch.index_name || 'n/a'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="p-3 rounded-md border border-theme/30">
                        <h4 className="text-sm font-medium text-theme-primary mb-2">Mapping Summary</h4>
                        <div className="text-xs text-theme-primary space-y-1">
                          <div className="flex justify-between">
                            <span>Preview patient</span>
                            <span className="text-primary font-mono">{preview.sample?.patientId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>EHR ID field value</span>
                            <span className="text-primary font-mono">
                              {preview.sample?.mappingSummary?.applied?.[preview.fieldMappings?.ehrIdField]}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Version</span>
                            <span className="font-mono text-primary">
                              {preview.sample?.mappingSummary?.applied?.[preview.fieldMappings?.versionField]}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Template ID</span>
                            <span className="font-mono text-primary">
                              {preview.sample?.mappingSummary?.applied?.[preview.fieldMappings?.templateIdField]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="p-3 rounded-md border border-theme/30">
                        <h4 className="text-sm font-medium text-theme-primary mb-2">Composition (preview)</h4>
                        <pre className="text-[11px] text-theme-primary bg-background p-3 rounded-md max-h-56 overflow-auto border border-theme/20">
                          {JSON.stringify(preview.sample?.composition || {}, null, 2)}
                        </pre>
                      </div>
                      <div className="p-3 rounded-md border border-theme/30">
                        <h4 className="text-sm font-medium text-theme-primary mb-2">Meta document (preview)</h4>
                        <pre className="text-[11px] text-theme-primary bg-background p-3 rounded-md max-h-56 overflow-auto border border-theme/20">
                          {JSON.stringify(preview.sample?.meta || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-theme-secondary">
                    Build a preview to see a generated document, mapped fields, and collection/index details before running the job.
                  </div>
                )}
              </div>

              {/* Job Completed Success Message - matches KehrnelSyntheticWizard style */}
              {lastCompletedJob?.id && generationPhase === 'completed' && (
                <div className="flex items-center gap-3 py-3 px-4 rounded-md border border-success/30 bg-success/5">
                  <CheckCircle2 size={18} className="text-success flex-shrink-0" />
                  <span className="text-sm text-theme-primary">
                    Generation completed successfully.{' '}
                    <button
                      onClick={() => onNavigate?.('history')}
                      className="text-primary hover:underline font-medium"
                    >
                      View in Jobs History →
                    </button>
                  </span>
                </div>
              )}

              {/* Navigation buttons - hide generate button after job completes */}
              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-2 rounded-md border border-theme/50 px-4 py-2 text-sm text-theme-primary hover:border-theme"
                >
                  <ArrowLeft size={14} />
                  Back to Template Selection
                </button>

                {!lastCompletedJob?.id && (
                  <button
                    onClick={handleStartGeneration}
                    disabled={selectedTemplates.length === 0 || !activeEnvironment?.id}
                    className={cn(
                      "px-6 py-3 rounded-md font-medium flex items-center gap-2",
                      selectedTemplates.length === 0 || !activeEnvironment?.id
                        ? "bg-surface-hover text-theme-secondary cursor-not-allowed"
                        : "bg-success hover:bg-success/80 text-success-text"
                    )}
                  >
                    <Play size={20} />
                    Generate Synthetic Data
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* About Synthetic Data Generation - Only show on first step */}
      {currentStep === 1 && (
      <div className="bg-gradient-to-br from-primary/5 to-surface rounded-lg border border-primary/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Database size={24} className="text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-theme-primary mb-2">About Synthetic Data Generation</h3>
            <p className="text-theme-secondary text-sm leading-relaxed mb-4">
              This workflow runs synthetic generation through Kehrnel jobs using the selected strategy and environment.
              You can generate from data models, from existing Data Lab instances, or from imported composition files.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-surface/50 rounded-lg p-4 border border-theme/30">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={18} className="text-primary" />
                  <h4 className="text-sm font-medium text-theme-primary">Patient Generation</h4>
                </div>
                <p className="text-xs text-theme-secondary">
                  Configure patient count and distribution rules, then run a tracked batch job.
                </p>
              </div>

              <div className="bg-surface/50 rounded-lg p-4 border border-theme/30">
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet size={18} className="text-primary" />
                  <h4 className="text-sm font-medium text-theme-primary">Template-Based</h4>
                </div>
                <p className="text-xs text-theme-secondary">
                  Model-driven mode reads configured models and applies per-model min/max and weight settings.
                </p>
              </div>

              <div className="bg-surface/50 rounded-lg p-4 border border-theme/30">
                <div className="flex items-center gap-2 mb-2">
                  <Server size={18} className="text-primary" />
                  <h4 className="text-sm font-medium text-theme-primary">Strategy-Driven</h4>
                </div>
                <p className="text-xs text-theme-secondary">
                  Output format and write behavior are defined by the active Kehrnel strategy for this environment.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-xs text-theme-primary flex items-start gap-2">
                <Info size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Getting started:</strong> Select a source mode, choose models or source instances, configure
                  generation parameters, and run the job. Review job status and errors in Run + Monitor / Jobs History.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default SyntheticData;
