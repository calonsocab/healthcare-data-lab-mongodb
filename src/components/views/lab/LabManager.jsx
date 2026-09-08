//src/components/views/lab/LabManager.jsx 
'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/common/Tabs";
import { Code, Database, Save, Check, Edit, RefreshCw, List, Plus, FolderTree, AlertTriangle, Clock, CheckCircle, Loader2, Play, X, ChevronDown, ChevronUp } from 'lucide-react';

// Import modular components
import AQLEditor from "../../common/AQLEditor";
import MQLPreviewTab from "./MQLPreviewTab";
import useMetadataManager from "@/hooks/useMetadata";
import QuerySelectorModal from './QuerySelectorModal';
import AQLQueryEditor from "../AQLQueryManagement/AQLQueryEditor";
import { useAQLQueries } from "@/providers/AQLQueryProvider";
import { usePersistenceStrategies } from "@/providers/PersistenceStrategyProvider";
import { extractParametersFromAQL } from "@/lib/aql-parameter-substitution";
import { viewToSherpaPath } from "@/lib/demoSherpa/hostRoutes";
import { stashSandboxAqlDraft, stashSandboxAqlLaunch } from "@/lib/sandbox/aqlDraft";
import { consumeLabAqlLaunch, readLabAqlDraft } from "@/lib/lab/aqlDraft";
import { resolveQueryAqlText } from "@/lib/lab/queryText";
import { stringifyMongoShell } from "@/lib/kehrnel/mongoShellFormatter";
import { Server } from 'lucide-react';

const DEFAULT_FROM_COMMIT_TIME = '1970-01-01T00:00:00.000Z';
const sampleEhrRequestCache = new Map();

const getUniqueAqlParameters = (aqlText) => (
  Array.from(
    new Set(
      extractParametersFromAQL(aqlText)
        .map((token) => token.replace(/^\$/, '').trim())
        .filter(Boolean)
    )
  )
);

const getDefaultParameterValue = (paramName, sampleEhrId = '') => {
  const normalized = String(paramName || '').toLowerCase();

  if (normalized === 'ehrid') {
    return sampleEhrId || '';
  }

  if (normalized.includes('from') && normalized.includes('time')) {
    return DEFAULT_FROM_COMMIT_TIME;
  }

  if (normalized.includes('to') && normalized.includes('time')) {
    return new Date().toISOString();
  }

  return '';
};

const getParameterHelperText = (paramName) => {
  const normalized = String(paramName || '').toLowerCase();

  if (normalized === 'ehrid') {
    return 'EHR identifier used by debug-style queries.';
  }

  if (normalized.includes('from') && normalized.includes('time')) {
    return 'Lower bound for commit time filtering in ISO-8601 format.';
  }

  if (normalized.includes('to') && normalized.includes('time')) {
    return 'Upper bound for commit time filtering in ISO-8601 format.';
  }

  return 'Runtime parameter passed directly to Kehrnel.';
};

const getSampleEhrRequestKey = ({ envId, domain, strategyId, connectionId }) => (
  [envId || '', domain || '', strategyId || '', connectionId || ''].join('::')
);

const fetchSampleEhrId = async ({ envId, domain, strategyId, connectionId }) => {
  const cacheKey = getSampleEhrRequestKey({ envId, domain, strategyId, connectionId });
  if (!cacheKey.replace(/:/g, '')) {
    return '';
  }

  if (sampleEhrRequestCache.has(cacheKey)) {
    return sampleEhrRequestCache.get(cacheKey);
  }

  const request = (async () => {
    const response = await fetch(`/api/kehrnel/environments/${encodeURIComponent(envId)}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        strategyId,
        connectionId,
        aql: "SELECT e/ehr_id/value AS ehrId FROM EHR e CONTAINS VERSION v CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.probs_base_composition.v0] ORDER BY v/commit_audit/time_committed/value LIMIT 1",
        options: {}
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return '';
    }

    const rows = data?.rows || data?.result?.rows || data?.results || data?.result?.results || [];
    return rows?.[0]?.ehrId || '';
  })()
    .finally(() => {
      window.setTimeout(() => {
        sampleEhrRequestCache.delete(cacheKey);
      }, 30000);
    });

  sampleEhrRequestCache.set(cacheKey, request);
  return request;
};

// Using a custom hook to manage the query state and make it persistent across tabs
const usePersistentQueryState = () => {
  const [selectedQuery, setSelectedQueryInternal] = useState(null);
  const [aqlInput, setAqlInput] = useState('');
  const [mqlOutput, setMqlOutput] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('SingleCollection');
  const [strategyConfig, setStrategyConfig] = useState('{}');
  const [activeStrategyDoc, setActiveStrategyDoc] = useState(null);
  const [strategyLoading, setStrategyLoading] = useState(false);

  // Modified setter function to ensure data is updated immediately
  const setSelectedQuery = useCallback((query) => {
    setSelectedQueryInternal(query);

    // Immediately load the AQL content when a query is selected
    if (query) {
      setAqlInput(resolveQueryAqlText(query));
    }
  }, []);

  return {
    selectedQuery,
    setSelectedQuery,
    aqlInput,
    setAqlInput,
    mqlOutput,
    setMqlOutput,
    selectedStrategy,
    setSelectedStrategy,
    strategyConfig,
    setStrategyConfig,
    activeStrategyDoc,
    setActiveStrategyDoc,
    strategyLoading
  };
};


const LabManager = ({ activeEnvironment, onNavigate }) => {
  const { saveQuery: saveQueryInProvider } = useAQLQueries();
  const { ensureStrategyById } = usePersistenceStrategies();
  // Use the custom hook to manage state
  const {
    selectedQuery,
    setSelectedQuery,
    aqlInput,
    setAqlInput,
    mqlOutput,
    setMqlOutput,
    selectedStrategy,
    setSelectedStrategy,
    strategyConfig,
    setStrategyConfig,
    activeStrategyDoc,
    setActiveStrategyDoc,
    strategyLoading
  } = usePersistentQueryState();

  const [showAstPanel, setShowAstPanel] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [errorHighlight, setErrorHighlight] = useState([]);
  const [saveStatus, setSaveStatus] = useState({ loading: false, success: false, error: null });
  const [transformationStatus, setTransformationStatus] = useState('pending');
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isEditingQuery, setIsEditingQuery] = useState(false);  // State to control AQLQueryEditor visibility
  const [activeTab, setActiveTab] = useState('aql');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [envStrategyOptions, setEnvStrategyOptions] = useState([]);
  const [envStrategiesLoading, setEnvStrategiesLoading] = useState(false);
  const [envStrategiesError, setEnvStrategiesError] = useState(null);
  const [selectedEnvBindingId, setSelectedEnvBindingId] = useState(null);
  const selectedEnvBindingIdRef = useRef(null);
  
  // Query execution state
  const [executeStatus, setExecuteStatus] = useState({ loading: false, error: null });
  const [queryResults, setQueryResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [queryParameters, setQueryParameters] = useState({});
  const [queryParameterNames, setQueryParameterNames] = useState([]);
  const [sampleEhrId, setSampleEhrId] = useState('');
  const [sampleEhrLoading, setSampleEhrLoading] = useState(false);

  // T4: Kehrnel compile state
  const [compileStatus, setCompileStatus] = useState({ loading: false, error: null });
  const [compileOutput, setCompileOutput] = useState(null);
  const [showCompileOutput, setShowCompileOutput] = useState(false);
  const [compileMeta, setCompileMeta] = useState(null);
  const [queryMeta, setQueryMeta] = useState(null);
  const [compileErrorDetail, setCompileErrorDetail] = useState(null);
  const [queryErrorDetail, setQueryErrorDetail] = useState(null);

  // Metadata manager for environments
  const { metadata } = useMetadataManager();
  const selectedEnvOption = envStrategyOptions.find(opt => opt.link.id === selectedEnvBindingId) || envStrategyOptions[0] || null;
  const selectedStrategyId = selectedEnvOption?.link?.strategyId || null;
  const selectedDomain = selectedEnvOption?.link?.domain || 'openEHR';
  const hasMissingParameterValues = queryParameterNames.some((name) => !String(queryParameters[name] ?? '').trim());
  const needsSampleEhrId = queryParameterNames.some((name) => String(name || '').trim().toLowerCase() === 'ehrid');

  // When a query is selected, set its transformation status and reset name editing
  useEffect(() => {
    if (selectedQuery) {
      // Get status for current active strategy, else use server-derived query status
      const currentStrategyId = activeStrategyDoc?._id;
      const strategyValidation = currentStrategyId && selectedQuery.strategyValidations?.[currentStrategyId];
      const status = strategyValidation?.status || selectedQuery.status || 'pending';

      setTransformationStatus(status);
      setTempName(selectedQuery.name || '');
      setIsEditingName(false);
    }
  }, [selectedQuery, activeStrategyDoc]);

  useEffect(() => {
    if (!selectedQuery || aqlInput.trim()) {
      return;
    }

    const selectedQueryAql = resolveQueryAqlText(selectedQuery);
    if (selectedQueryAql.trim()) {
      setAqlInput(selectedQueryAql);
    }
  }, [selectedQuery, aqlInput]);

  useEffect(() => {
    selectedEnvBindingIdRef.current = selectedEnvBindingId;
  }, [selectedEnvBindingId]);

  useEffect(() => {
    const launchContext = consumeLabAqlLaunch();
    const source = launchContext?.source || '';
    if (source !== 'contextObjects' && source !== 'semanticArtifacts') {
      return;
    }

    const preloadAql = readLabAqlDraft();
    if (!preloadAql) return;

    setSelectedQuery(null);
    setAqlInput(preloadAql);
    setMqlOutput('');
    setValidationResult(null);
    setErrorHighlight([]);
    setCompileOutput(null);
    setCompileMeta(null);
    setCompileErrorDetail(null);
    setCompileStatus({ loading: false, error: null });
    setQueryResults(null);
    setQueryMeta(null);
    setQueryErrorDetail(null);
    setExecuteStatus({ loading: false, error: null });
    setShowResults(false);
    setShowCompileOutput(false);
    setActiveTab('aql');
  }, [
    setAqlInput,
    setMqlOutput,
    setSelectedQuery
  ]);

  useEffect(() => {
    const loadEnvironmentStrategies = async () => {
      if (!activeEnvironment?.strategyLinks?.length) {
        setEnvStrategyOptions([]);
        setSelectedEnvBindingId(null);
        return;
      }
      const queryBindings = (activeEnvironment.strategyLinks || []).filter(link => link.contexts?.query);
      if (!queryBindings.length) {
        setEnvStrategyOptions([]);
        setSelectedEnvBindingId(null);
        return;
      }
      setEnvStrategiesLoading(true);
      setEnvStrategiesError(null);
      try {
        const results = await Promise.all(
          queryBindings.map(async (link) => {
            const domain = link.domain || 'openEHR';
            const storedMergedConfig = link?.mergedConfig || link?.kehrnel?.config || {};
            let mergedConfig = storedMergedConfig;

            if (!mergedConfig || Object.keys(mergedConfig).length === 0) {
              const mergedRes = await fetch(
                `/api/environments/strategy?envId=${activeEnvironment.id}&domain=${domain}`
              );

              if (mergedRes.ok) {
                const mergedData = await mergedRes.json();
                mergedConfig = mergedData.mergedConfig || {};
              }
            }

            // Resolve the full strategy doc from the shared cache.
            const strategyDoc = await ensureStrategyById(link.strategyId);
            if (!strategyDoc) {
              throw new Error(`Failed to load strategy ${link.strategyName || link.strategyId}`);
            }

            // Override the strategy config with merged config from environment
            return {
              link,
              strategy: {
                ...strategyDoc,
                config: mergedConfig // Use merged config (default + overrides)
              }
            };
          })
        );
        setEnvStrategyOptions(results);
        const existing = results.find(option => option.link.id === selectedEnvBindingIdRef.current) || results[0];
        if (existing) {
          setSelectedEnvBindingId(existing.link.id);
          setActiveStrategyDoc(existing.strategy);
          setSelectedStrategy(existing.strategy.blueprint?.id || existing.strategy.name);
          setStrategyConfig(JSON.stringify(existing.strategy.config || {}, null, 2));
        }
      } catch (err) {
        setEnvStrategiesError(err.message || 'Failed to load environment strategies');
      } finally {
        setEnvStrategiesLoading(false);
      }
    };

    loadEnvironmentStrategies();
  }, [activeEnvironment, setActiveStrategyDoc, setSelectedStrategy, setStrategyConfig, ensureStrategyById]);

  useEffect(() => {
    const params = getUniqueAqlParameters(aqlInput);
    setQueryParameterNames(params);
    setQueryParameters((prev) => {
      const next = {};
      params.forEach((name) => {
        const currentValue = prev[name];
        if (currentValue !== undefined && currentValue !== null && String(currentValue).length > 0) {
          next[name] = currentValue;
          return;
        }
        next[name] = getDefaultParameterValue(name, sampleEhrId);
      });
      return next;
    });
  }, [aqlInput, sampleEhrId]);

  useEffect(() => {
    const envId = activeEnvironment?.id;
    if (!envId) {
      setSampleEhrId('');
      setSampleEhrLoading(false);
      return undefined;
    }
    if (!needsSampleEhrId) {
      setSampleEhrId('');
      setSampleEhrLoading(false);
      return undefined;
    }
    if (activeEnvironment?.strategyLinks?.length && !selectedEnvBindingId && envStrategyOptions.length > 0) {
      setSampleEhrId('');
      setSampleEhrLoading(false);
      return undefined;
    }
    if (!selectedStrategyId || !selectedDomain) {
      setSampleEhrId('');
      setSampleEhrLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadSampleEhrId = async () => {
      setSampleEhrLoading(true);
      try {
        const nextSample = await fetchSampleEhrId({
          envId,
          domain: selectedDomain,
          strategyId: selectedStrategyId,
          connectionId: activeEnvironment?.kehrnel?.connectionId
        });
        if (!cancelled) {
          setSampleEhrId(nextSample);
        }
      } catch (error) {
        if (!cancelled) {
          setSampleEhrId('');
        }
      } finally {
        if (!cancelled) {
          setSampleEhrLoading(false);
        }
      }
    };

    loadSampleEhrId();

    return () => {
      cancelled = true;
    };
  }, [
    activeEnvironment?.id,
    activeEnvironment?.kehrnel?.connectionId,
    activeEnvironment?.strategyLinks?.length,
    envStrategyOptions.length,
    needsSampleEhrId,
    selectedDomain,
    selectedStrategyId,
    selectedEnvBindingId
  ]);

  // Start editing the query name
  const startEditingName = () => {
    if (selectedQuery?._id) {
      setTempName(selectedQuery.name);
      setIsEditingName(true);
    }
  };

  // Save the edited query name
  const saveQueryName = () => {
    if (tempName.trim() && selectedQuery) {
      setSelectedQuery({
        ...selectedQuery,
        name: tempName.trim()
      });
    }
    setIsEditingName(false);
  };

  // Handle Enter key to save query name
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveQueryName();
    }
  };

  // Reset query to initial empty state
  const handleResetQuery = () => {
    if (window.confirm('Are you sure you want to reset? All unsaved changes will be lost.')) {
      setSelectedQuery(null);
      setAqlInput('');
      setMqlOutput('');
      setTransformationStatus('pending');
    }
  };

  // Open AQLQueryEditor for adding a new query
  const openQueryEditor = () => {
    setIsEditingQuery(true);
  };


const handleSaveFromEditor = async (queryData) => {
  try {
    const savedQuery = await saveQueryInProvider(queryData);
    if (!savedQuery) {
      throw new Error("Failed to save query");
    }

    setSelectedQuery(savedQuery);
    setAqlInput(savedQuery.aqlText || '');
    setIsEditingQuery(false);
    return true;
  } catch (error) {
    console.error('Error handling query from editor:', error);
    return false;
  }
};

  const handleCancelFromEditor = () => {
    setIsEditingQuery(false);
  };

  const handleEnvironmentStrategyChange = (bindingId) => {
    setSelectedEnvBindingId(bindingId);
    const option = envStrategyOptions.find(opt => opt.link.id === bindingId);
    if (option) {
      setActiveStrategyDoc(option.strategy);
      setSelectedStrategy(option.strategy.blueprint?.id || option.strategy.name);
      setStrategyConfig(JSON.stringify(option.strategy.config || {}, null, 2));
    }
  };

  // Routes are keyed by HDL environment id; server resolves that to Kehrnel envKey.
  const getEnvId = () => {
    return activeEnvironment?.id || null;
  };

  // Open the sandbox AQL playground with the current query preloaded.
  const handleExecuteQuery = async () => {
    const effectiveAqlInput = String(aqlInput || resolveQueryAqlText(selectedQuery)).trim();

    if (!effectiveAqlInput) {
      setExecuteStatus({ loading: false, error: 'Please enter an AQL query first' });
      setQueryErrorDetail(null);
      return;
    }

    stashSandboxAqlDraft(effectiveAqlInput);
    stashSandboxAqlLaunch({ explore: 'aql', source: 'lab' });

    const sandboxUrl = `${viewToSherpaPath('sandbox')}?explore=aql&source=lab`;
    if (typeof onNavigate === 'function') {
      onNavigate('sandbox');
      return;
    }

    window.location.assign(sandboxUrl);
  };

  const compileViaKehrnel = async ({ debug, showPanel }) => {
    const effectiveAqlInput = String(aqlInput || resolveQueryAqlText(selectedQuery)).trim();

    if (!effectiveAqlInput) {
      setCompileStatus({ loading: false, error: 'Please enter an AQL query first' });
      setCompileErrorDetail(null);
      return false;
    }

    const envId = getEnvId();
    if (!envId) {
      setCompileStatus({ loading: false, error: 'No environment selected' });
      setCompileErrorDetail(null);
      return false;
    }

    if (hasMissingParameterValues) {
      setCompileStatus({ loading: false, error: 'Fill in all query parameter values before compiling.' });
      setCompileErrorDetail(null);
      return false;
    }

    setCompileStatus({ loading: true, error: null });
    setCompileErrorDetail(null);
    if (showPanel) setCompileOutput(null);

    try {
      const started = performance.now();
      const response = await fetch(`/api/kehrnel/environments/${encodeURIComponent(envId)}/compile?debug=${debug ? 'true' : 'false'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aql: effectiveAqlInput,
          domain: selectedDomain,
          strategyId: selectedStrategyId,
          options: {
            parameters: queryParameters
          },
          connectionId: activeEnvironment?.kehrnel?.connectionId
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const envelope = data?.error;
        setCompileErrorDetail(envelope || data);
        throw new Error(envelope?.message || envelope || 'Compilation failed');
      }

      const durationMs = Math.round(performance.now() - started);

      if (showPanel) {
        setCompileOutput(data);
        setShowCompileOutput(true);
      }
      setCompileStatus({ loading: false, error: null });
      setCompileMeta({ at: new Date().toISOString(), durationMs });

      // Also update the MQL output for the MQL Preview tab
      if (data.pipeline) {
        setMqlOutput(JSON.stringify(data.pipeline, null, 2));
      }
      return true;
    } catch (error) {
      console.error('Error compiling query:', error);
      setCompileStatus({ loading: false, error: error.message || 'Failed to compile query' });
      setCompileMeta(null);
      if (showPanel) setShowCompileOutput(true);
      return false;
    }
  };

  // T4: Compile AQL query via Kehrnel (show pipeline and debug info)
  const handleCompileQuery = async () => {
    return compileViaKehrnel({ debug: true, showPanel: true });
  };

  // Generate MQL for preview using Kehrnel compile (pipeline-only).
  const handleGenerateMQL = async () => {
    const ok = await compileViaKehrnel({ debug: false, showPanel: false });
    setActiveTab('mqlPreview');
    return ok;
  };

  // Sanitize AST for better display
  const sanitizeAST = (node, visited = new WeakSet()) => {
    if (!node || typeof node !== "object") return node;
    if (visited.has(node)) return undefined; // Prevent circular refs

    visited.add(node);

    let cleanNode = {};
    Object.keys(node).forEach(key => {
      if (
        key !== "parentCtx" &&
        key !== "invokingState" &&
        key !== "start" &&
        key !== "stop" &&
        key !== "ruleIndex"
      ) {
        cleanNode[key] = sanitizeAST(node[key], visited);
      }
    });

    return cleanNode;
  };

  // Update transformation status and auto-save
  const updateTransformationStatus = async (status) => {
    setTransformationStatus(status);

    // Auto-save if we have a saved query
    if (selectedQuery?._id && activeStrategyDoc) {
      try {
        const strategyId = activeStrategyDoc._id || 'default';
        const strategyName = activeStrategyDoc.name || 'Unknown';
        const protocol = activeStrategyDoc.blueprint?.protocol?.standard ||
                        activeStrategyDoc.blueprint?.domain?.[0] || 'Custom';

        const strategyValidations = {
          ...(selectedQuery.strategyValidations || {}),
          [strategyId]: {
            status,
            strategyName,
            protocol,
            updatedAt: new Date().toISOString()
          }
        };

        const updatedQuery = {
          ...selectedQuery,
          aqlText: aqlInput,
          strategyValidations
        };

        const savedQuery = await saveQueryInProvider(updatedQuery);
        if (savedQuery) {
          setSelectedQuery(savedQuery);
        }
      } catch (error) {
        console.error('Error auto-saving status:', error);
      }
    }
  };

  // Save the current query with updated content
  const handleSaveQuery = async () => {
    // For new queries without a name, open the AQLQueryEditor for proper creation
    if (!selectedQuery?._id) {
      openQueryEditor();
      return;
    }
    
    // Don't proceed if no query selected or no name
    if (!selectedQuery?.name) {
      return;
    }

    setSaveStatus({ loading: true, success: false, error: null });

    try {
      // Build per-strategy validation status
      const strategyId = activeStrategyDoc?._id || selectedStrategy || 'default';
      const strategyName = activeStrategyDoc?.name || selectedStrategy || 'Unknown';
      const protocol = activeStrategyDoc?.blueprint?.protocol?.standard ||
                      activeStrategyDoc?.blueprint?.domain?.[0] || 'Custom';

      const strategyValidations = {
        ...(selectedQuery?.strategyValidations || {}),
        [strategyId]: {
          status: transformationStatus,
          strategyName,
          protocol,
          updatedAt: new Date().toISOString()
        }
      };

      // Prepare updated query data
      const updatedQuery = {
        ...selectedQuery,
        aqlText: aqlInput,
        conversionStrategy: {
          type: selectedStrategy || 'SingleCollection',
          settings: {
            useAtlasSearch: selectedQuery?.conversionStrategy?.settings?.useAtlasSearch || false,
            indexDefinition: strategyConfig || '{}'
          },
          bindingId: selectedEnvBindingId || null,
          strategyId: activeStrategyDoc?._id || null,
          strategyName,
          protocol
        },
        // Add generated MQL as a reference if available
        generatedMql: mqlOutput || undefined,
        // Per-strategy validation status
        strategyValidations
      };

      const savedQuery = await saveQueryInProvider(updatedQuery);
      if (!savedQuery) {
        throw new Error('Failed to save query');
      }
      setSelectedQuery(savedQuery);

      setSaveStatus({ loading: false, success: true, error: null });

      // Reset success status after a delay
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, success: false }));
      }, 3000);

    } catch (error) {
      console.error('Error saving query:', error);
      setSaveStatus({
        loading: false,
        success: false,
        error: error.message || 'Failed to save query'
      });
    }
  };

  // Toggle query selector modal
  const toggleQuerySelector = () => {
    setIsSelectorOpen(!isSelectorOpen);
  };

  // Get folder name from id
  const getFolderName = (folderId) => {
    if (!folderId) return '(Root)';
    const folder = metadata.folders?.find(f => f._id === folderId);
    return folder ? folder.name : 'Unknown Folder';
  };

  // Render transformation status indicator
  const renderStatusIndicator = () => {
    let icon, color, text;

    switch(transformationStatus) {
      case 'done':
        icon = <CheckCircle size={16} />;
        color = 'text-success';
        text = 'Transformation Complete';
        break;
      case 'needs_improvement':
        icon = <AlertTriangle size={16} />;
        color = 'text-warning';
        text = 'Needs Improvement';
        break;
      case 'pending':
      default:
        icon = <Clock size={16} />;
        color = 'text-theme-secondary';
        text = 'Pending';
        break;
    }

    return (
      <div className={`flex items-center gap-2 ${color}`}>
        {icon}
        <span>{text}</span>
      </div>
    );
  };

  // Render other strategy validations summary
  const renderOtherStrategyValidations = () => {
    if (!selectedQuery?.strategyValidations) return null;

    const currentStrategyId = activeStrategyDoc?._id;
    const otherValidations = Object.entries(selectedQuery.strategyValidations)
      .filter(([strategyId]) => strategyId !== currentStrategyId);

    if (otherValidations.length === 0) return null;

    const doneCount = otherValidations.filter(([, v]) => v.status === 'done').length;
    const pendingCount = otherValidations.filter(([, v]) => v.status === 'pending').length;
    const needsWorkCount = otherValidations.filter(([, v]) => v.status === 'needs_improvement').length;

    return (
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-theme">
        <Server size={14} className="text-theme-secondary" />
        <span className="text-xs text-theme-secondary">Other strategies:</span>
        {doneCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-success-muted text-success">
            {doneCount} validated
          </span>
        )}
        {pendingCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-theme-secondary">
            {pendingCount} pending
          </span>
        )}
        {needsWorkCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-warning-muted text-warning">
            {needsWorkCount} need work
          </span>
        )}
      </div>
    );
  };

  
  // Check if this is a new query (no ID)
  const isNewQuery = !selectedQuery?._id;
  
  // Check if we have AQL content
  const hasAqlContent = aqlInput.trim().length > 0;

  // If in editing mode, show the AQLQueryEditor instead of the main UI
  if (isEditingQuery) {
    return (
      <AQLQueryEditor
        query={{ 
          name: '',
          aqlText: aqlInput, // Pass current AQL input to the editor
          conversionStrategy: {
            type: selectedStrategy || 'SingleCollection',
            settings: {
              useAtlasSearch: false,
              indexDefinition: '{}'
            }
          },
          tags: [],
          selectedEnvironments: [],
        }}
        onSave={handleSaveFromEditor}
        onCancel={handleCancelFromEditor}
      />
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-medium text-theme-primary">Query Lab</h2>
        <p className="text-sm text-theme-secondary">
          Test and validate AQL to MQL translations with your persistence strategies
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-theme-secondary leading-relaxed">
          In this lab you can type or select an AQL query from your library and transform it into MongoDB MQL
          to observe the behavior of the <strong className="text-theme-primary">deterministic translator</strong> provided
          by the active strategy. Use the <strong className="text-theme-primary">Format</strong> and <strong className="text-theme-primary">Parse</strong> buttons
          to check if the query is correctly interpreted, then click the <strong className="text-theme-primary">MongoDB MQL</strong> tab
          to see the generated aggregation pipeline. You can also <strong className="text-theme-primary">Execute</strong> to run the query against your data.
        </p>
      </div>

      {/* Main panel */}
      <div className="w-full transition-all duration-300 ease-in-out flex-1">
        {/* Display any error messages */}
        {saveStatus.error && (
          <div className="mb-4 p-3 bg-red-900/30 text-red-300 rounded-md">
            Error: {saveStatus.error}
          </div>
        )}

        {queryParameterNames.length > 0 && (
          <div className="mb-4 p-4 bg-surface rounded-lg border border-theme">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-medium text-theme-primary">Query Parameters</h3>
                <p className="text-xs text-theme-secondary mt-1">
                  Parameters are passed to Kehrnel at runtime without modifying the saved AQL.
                </p>
              </div>
              {sampleEhrLoading ? (
                <span className="text-xs text-theme-secondary flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  Loading sample EHR
                </span>
              ) : sampleEhrId ? (
                <span className="text-xs text-theme-secondary">
                  Sample EHR: <code className="text-theme-primary">{sampleEhrId}</code>
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {queryParameterNames.map((paramName) => (
                <label key={paramName} className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-theme-primary">${paramName}</span>
                  <input
                    type="text"
                    value={queryParameters[paramName] ?? ''}
                    onChange={(e) => {
                      const { value } = e.target;
                      setQueryParameters((prev) => ({ ...prev, [paramName]: value }));
                    }}
                    placeholder={getDefaultParameterValue(paramName, sampleEhrId) || `Enter ${paramName}`}
                    className="px-3 py-2 bg-background border border-theme rounded-md text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-[11px] text-theme-secondary">
                    {getParameterHelperText(paramName)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab} 
          defaultValue="aql" 
          className="w-full"
        >
          {/* Improved Header with query name editing */}
          <div className="bg-surface p-4 rounded-lg mb-4 border border-theme">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                {/* Show Select Query button only when no query is selected and no content */}
                {!selectedQuery && !hasAqlContent && (
                  <button
                    onClick={toggleQuerySelector}
                    className="px-4 py-2 mr-3 bg-primary text-primary-text rounded-md hover:bg-primary-hover transition-colors flex items-center gap-2 font-medium shadow-sm"
                    title="Select query from library"
                  >
                    <List size={16} />
                    Select Query
                  </button>
                )}
                
                {/* Display query name with click-to-edit functionality */}
                {selectedQuery?._id ? (
                  <div className="flex items-center">
                    {isEditingName ? (
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={saveQueryName}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="px-2 py-1 bg-surface-hover border border-theme rounded text-theme-primary text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      <div
                        className="flex items-center cursor-pointer group"
                        onClick={startEditingName}
                      >
                        <h2 className="text-lg font-medium text-theme-primary mr-2">{selectedQuery.name}</h2>
                        <Edit size={14} className="text-theme-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                    {selectedQuery.folderId && (
                      <div className="ml-2 flex items-center text-xs text-theme-secondary">
                        <FolderTree size={12} className="mr-1 text-warning" />
                        <span>{getFolderName(selectedQuery.folderId)}</span>
                      </div>
                    )}
                  </div>
                ) : hasAqlContent ? (
                  <div className="flex items-center text-theme-secondary">
                    <span className="text-lg font-medium">Unsaved Query</span>
                  </div>
                ) : (
                  <div className="flex items-center text-theme-secondary">
                    <span className="text-lg font-medium">New Query</span>
                  </div>
                )}
              </div>

              {compileMeta && (
                <div className="flex flex-wrap gap-4 text-[11px] text-theme-secondary mt-2">
                  <span>
                    Last MQL generation: {new Date(compileMeta.at).toLocaleTimeString()} • {compileMeta.durationMs}ms
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* Reset button */}
                {(selectedQuery || hasAqlContent) && (
                  <button
                    onClick={handleResetQuery}
                    className="px-3 py-2 bg-surface-hover text-theme-secondary rounded-md hover:bg-surface border border-theme flex items-center gap-2 transition-colors"
                    title="Reset to empty state"
                  >
                    <RefreshCw size={16} />
                    Reset
                  </button>
                )}
                
                {/* Sandbox button */}
                {hasAqlContent && (
                  <button
                    onClick={handleExecuteQuery}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    title="Open the sandbox with this AQL preloaded"
                  >
                    <>
                      <Play size={16} />
                      Run on Sandbox
                    </>
                  </button>
                )}
              
                {/* Create New / Save Changes button */}
                {hasAqlContent && (
                  <button
                    onClick={isNewQuery ? openQueryEditor : handleSaveQuery}
                    disabled={saveStatus.loading}
                    className={`px-4 py-2 text-white rounded-md hover:bg-opacity-90 flex items-center gap-2
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${isNewQuery ? 'bg-primary text-primary-text hover:bg-primary-hover' : 'bg-primary text-primary-text hover:bg-primary-hover'}`}
                  >
                    {saveStatus.loading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : saveStatus.success ? (
                      <>
                        <Check size={16} />
                        Saved!
                      </>
                    ) : isNewQuery ? (
                      <>
                        <Plus size={16} />
                        Create Query
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Transformation status controls - linked to active strategy */}
            {activeStrategyDoc && (
              <div className="mt-4 p-3 bg-surface-hover rounded-lg border border-theme">
                <div className="flex flex-wrap gap-4 justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-theme-secondary text-sm">Validation for</span>
                    <span className="px-2 py-1 rounded bg-primary-muted border border-primary/50 text-primary text-sm font-medium">
                      {activeStrategyDoc.name}
                    </span>
                    <span className="text-theme-muted text-xs">
                      ({activeStrategyDoc.blueprint?.protocol?.standard || 'Custom'})
                    </span>
                  </div>
                  {renderStatusIndicator()}
                </div>

                {/* Status selection options */}
                <div className="flex gap-2 mt-3">
                  <button
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      transformationStatus === 'pending'
                        ? 'bg-surface text-theme-primary border border-theme'
                        : 'bg-surface-hover text-theme-secondary hover:bg-surface border border-transparent'
                    }`}
                    onClick={() => updateTransformationStatus('pending')}
                  >
                    Pending
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      transformationStatus === 'needs_improvement'
                        ? 'bg-warning text-warning-text'
                        : 'bg-surface-hover text-theme-secondary hover:bg-surface border border-transparent'
                    }`}
                    onClick={() => updateTransformationStatus('needs_improvement')}
                  >
                    Needs Improvement
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      transformationStatus === 'done'
                        ? 'bg-success text-success-text'
                        : 'bg-surface-hover text-theme-secondary hover:bg-surface border border-transparent'
                    }`}
                    onClick={() => updateTransformationStatus('done')}
                  >
                    Done
                  </button>
                </div>

                {/* Show other strategy validations if any */}
                {selectedQuery?._id && renderOtherStrategyValidations()}
              </div>
            )}
          </div>

          {/* Tab navigation */}
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="aql" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              AQL Query
            </TabsTrigger>
            <TabsTrigger value="mqlPreview" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              MongoDB MQL
            </TabsTrigger>
          </TabsList>

          {/* AQL Editor Tab */}
          <TabsContent value="aql" className="relative flex w-full h-full">
            <div className="w-full relative">
              {/* Empty state overlay - shows when no content and no query selected */}
              {!hasAqlContent && !selectedQuery && (
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none" style={{ top: '100px' }}>
                  <div className="text-center p-6 rounded-lg max-w-md">
                    <div className="flex justify-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Code size={24} className="text-primary" />
                      </div>
                    </div>
                    <h3 className="text-lg font-medium text-theme-primary mb-2">Start Writing Your Query</h3>
                    <p className="text-theme-secondary text-sm mb-4">
                      Click in the editor above and start typing your AQL query, or use the
                      <span className="text-primary font-medium"> Select Query </span>
                      button to load one from your library.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xs text-theme-muted">
                      <span className="px-2 py-1 bg-surface rounded border border-theme">SELECT</span>
                      <span>+</span>
                      <span className="px-2 py-1 bg-surface rounded border border-theme">FROM</span>
                      <span>+</span>
                      <span className="px-2 py-1 bg-surface rounded border border-theme">WHERE</span>
                    </div>
                  </div>
                </div>
              )}
              <AQLEditor
                initialValue={aqlInput}
                onAqlChange={setAqlInput}
                onValidation={setValidationResult}
                showAstPanel={showAstPanel}
                onToggleAstPanel={() => setShowAstPanel(!showAstPanel)}
                key={selectedQuery?._id} // Force remounting when query changes
              />
            </div>
          </TabsContent>

          {/* MQL Preview Tab */}
          <TabsContent value="mqlPreview">
            <MQLPreviewTab
              mqlOutput={mqlOutput}
              onGenerateMQL={handleGenerateMQL}
              isGenerating={compileStatus.loading}
              error={compileStatus.error}
            />
          </TabsContent>
        </Tabs>

        {/* T4: Compile Output Panel - Shows pipeline and debug info from Kehrnel */}
        {showCompileOutput && (
          <div className="mt-4 bg-surface rounded-lg border border-warning/30 overflow-hidden">
            <div
              className="flex items-center justify-between p-4 bg-warning-muted cursor-pointer"
              onClick={() => setShowCompileOutput(!showCompileOutput)}
            >
              <div className="flex items-center gap-3">
                <Code size={20} className="text-warning" />
                <h3 className="text-lg font-semibold text-theme-primary">Compiled Pipeline</h3>
                {compileOutput && !compileStatus.error && (
                  <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs rounded-full">
                    {compileOutput.pipeline?.length || 0} stages
                  </span>
                )}
                {compileStatus.error && (
                  <span className="px-2 py-0.5 bg-error/20 text-error text-xs rounded-full">
                    Error
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCompileOutput(false);
                    setCompileOutput(null);
                    setCompileStatus({ loading: false, error: null });
                  }}
                  className="p-1.5 text-theme-secondary hover:text-theme-primary hover:bg-surface-hover rounded transition-colors"
                  title="Close compile output"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 max-h-[400px] overflow-auto">
              {compileStatus.error ? (
                <div className="p-4 bg-error-muted border border-error/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-error font-medium">Compilation Error</p>
                      <p className="text-error/80 text-sm mt-1">{compileStatus.error}</p>
                      {compileErrorDetail && (
                        <pre className="mt-2 bg-background text-error/90 text-xs p-2 rounded overflow-auto">
                          {JSON.stringify(compileErrorDetail, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ) : compileOutput ? (
                <div className="space-y-4">
                  {/* Compile metadata */}
                  {compileOutput._meta && (
                    <div className="flex flex-wrap gap-4 text-xs text-theme-secondary pb-3 border-b border-theme">
                      {compileOutput._meta.envKey && (
                        <span>Environment: <code className="text-warning">{compileOutput._meta.envKey}</code></span>
                      )}
                      {compileOutput._meta.runtimeUrl && (
                        <span>Kehrnel: <code className="text-warning">{compileOutput._meta.runtimeUrl}</code></span>
                      )}
                    </div>
                  )}

                  {/* Pipeline */}
                  {compileOutput.pipeline && (
                    <div>
                      <h4 className="text-sm font-medium text-theme-secondary mb-2">MongoDB Pipeline</h4>
                      <pre className="bg-background p-4 rounded-lg text-xs text-theme-secondary overflow-x-auto">
                        {stringifyMongoShell(compileOutput.pipeline, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Debug/Explain info */}
                  {compileOutput.explain && (
                    <div>
                      <h4 className="text-sm font-medium text-theme-secondary mb-2">Explain/Debug Info</h4>
                      <pre className="bg-background p-4 rounded-lg text-xs text-theme-secondary overflow-x-auto">
                        {JSON.stringify(compileOutput.explain, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Raw output if no structured data */}
                  {!compileOutput.pipeline && !compileOutput.explain && (
                    <pre className="bg-background p-4 rounded-lg text-xs text-theme-secondary overflow-x-auto">
                      {JSON.stringify(compileOutput, null, 2)}
                    </pre>
                  )}
                </div>
              ) : (
                <p className="text-theme-secondary text-center py-4">No compile output</p>
              )}
            </div>
          </div>
        )}

        {/* Query Execution Results Panel */}
        {showResults && (
          <div className="mt-4 bg-surface rounded-lg border border-theme overflow-hidden">
            <div
              className="flex items-center justify-between p-4 bg-surface-hover cursor-pointer"
              onClick={() => setShowResults(!showResults)}
            >
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-theme-primary">Query Results</h3>
                {queryResults && !executeStatus.error && (
                  <span className="px-2 py-0.5 bg-success/20 text-success text-xs rounded-full">
                    {Array.isArray(queryResults?.rows) ? `${queryResults.rows.length} rows` : 'Success'}
                  </span>
                )}
                {executeStatus.error && (
                  <span className="px-2 py-0.5 bg-error/20 text-error text-xs rounded-full">
                    Error
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowResults(false);
                    setQueryResults(null);
                    setExecuteStatus({ loading: false, error: null });
                  }}
                  className="p-1.5 text-theme-secondary hover:text-theme-primary hover:bg-surface rounded transition-colors"
                  title="Close results"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 max-h-[500px] overflow-auto">
              {executeStatus.error ? (
                <div className="p-4 bg-error-muted border border-error/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-error font-medium">Execution Error</p>
                      <p className="text-error/80 text-sm mt-1">{executeStatus.error}</p>
                      {queryErrorDetail && (
                        <pre className="mt-2 bg-background text-error/90 text-xs p-2 rounded overflow-auto">
                          {JSON.stringify(queryErrorDetail, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ) : queryResults ? (
                <div className="space-y-4">
                  {/* Results metadata */}
                  {queryResults.meta && (
                    <div className="flex flex-wrap gap-4 text-xs text-theme-secondary pb-3 border-b border-theme">
                      {queryResults.meta.href && (
                        <span>Endpoint: {queryResults.meta.href}</span>
                      )}
                      {queryResults.meta.created && (
                        <span>Executed: {new Date(queryResults.meta.created).toLocaleString()}</span>
                      )}
                      {queryResults.meta.generator && (
                        <span>Generator: {queryResults.meta.generator}</span>
                      )}
                    </div>
                  )}

                  {/* Results table */}
                  {queryResults.columns && queryResults.rows && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-theme">
                            {queryResults.columns.map((col, idx) => (
                              <th
                                key={idx}
                                className="text-left p-3 text-theme-secondary font-medium bg-surface-hover"
                              >
                                {col.name || col.path || `Column ${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={queryResults.columns.length}
                                className="p-4 text-center text-theme-secondary"
                              >
                                No results found
                              </td>
                            </tr>
                          ) : (
                            queryResults.rows.map((row, rowIdx) => (
                              <tr
                                key={rowIdx}
                                className="border-b border-theme/50 hover:bg-surface-hover transition-colors"
                              >
                                {queryResults.columns.map((col, colIdx) => {
                                  const cellValue = row[col.name];
                                  return (
                                    <td key={colIdx} className="p-3 text-theme-secondary">
                                      {cellValue === null || cellValue === undefined ? (
                                        <span className="text-theme-muted italic">null</span>
                                      ) : typeof cellValue === 'object' ? (
                                        <pre className="text-xs bg-background p-2 rounded overflow-auto max-w-md">
                                          {JSON.stringify(cellValue, null, 2)}
                                        </pre>
                                      ) : (
                                        String(cellValue)
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Raw JSON fallback for other response formats */}
                  {!queryResults.columns && !queryResults.rows && (
                    <pre className="text-xs text-theme-secondary bg-background p-4 rounded-lg overflow-auto">
                      {JSON.stringify(queryResults, null, 2)}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="text-center text-theme-secondary py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p>Loading results...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Query Selector Modal */}
      <QuerySelectorModal
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onSelectQuery={setSelectedQuery}
        selectedQuery={selectedQuery}
        activeStrategyDoc={activeStrategyDoc}
      />
    </div>
  );
};

export default LabManager;
