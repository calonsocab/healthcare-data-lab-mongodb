"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  FileSearch,
  Languages,
  LayoutList,
  Loader2,
  Network,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';
import {
  isOpenEhrContextObjectDefinition,
  renderOpenEhrQueryContractAql
} from '@/lib/contextObjects/openehrSemanticArtifacts';
import { allowsExecutionTarget } from '@/lib/contextObjects/contextContract';
import { stashLabAqlDraft, stashLabAqlLaunch } from '@/lib/lab/aqlDraft';
import { resolveSemanticRetrievalQuestion } from '@/lib/contextObjects/semanticRetrieval/resolver';

function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function contractCoverageClasses(coverage) {
  if (coverage === 'covered') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
}

function decisionClasses(decision) {
  switch (decision) {
    case 'auto_execute':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'confirm_contract':
    case 'confirm_datapoint':
    case 'confirm_policy':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'unsupported':
    default:
      return 'border-red-500/30 bg-red-500/10 text-red-200';
  }
}

const DEFAULT_DEMO_QUERIES = [
  'patients with temperature above 38 C in the last 24 hours',
  'patients with fever in the last 24 hours',
  'patients with blood pressure measured on left arm',
  'patients drinking alcohol more than 3 times a day as average during this year'
];

function pickTemplateExampleQueries(shapes, contractCatalog) {
  const preferredKinds = [
    'numeric_threshold',
    'coded_equals',
    'numeric_average',
    'latest_event',
    'exists',
    'numeric_range'
  ];

  const ranked = asArray(shapes)
    .map((shape, index) => {
      const contract = asArray(contractCatalog).find((candidate) => candidate?.contractId === shape?.contractId || candidate?.id === shape?.contractId);
      const priority = preferredKinds.includes(contract?.contractKind)
        ? preferredKinds.indexOf(contract.contractKind)
        : preferredKinds.length + index;

      return {
        text: shape?.exampleText || shape?.text || '',
        contractKind: contract?.contractKind || '',
        covered: contract?.coverage === 'covered',
        priority
      };
    })
    .filter((item) => item.text)
    .sort((left, right) => {
      if (left.covered !== right.covered) return left.covered ? -1 : 1;
      if (left.priority !== right.priority) return left.priority - right.priority;
      return left.text.localeCompare(right.text);
    });

  const seenTexts = new Set();
  const seenKinds = new Set();
  const chosen = [];

  ranked.forEach((item) => {
    if (chosen.length >= 6) return;
    if (seenTexts.has(item.text)) return;
    if (item.contractKind && seenKinds.has(item.contractKind) && ranked.length > 6) return;
    seenTexts.add(item.text);
    if (item.contractKind) seenKinds.add(item.contractKind);
    chosen.push(item.text);
  });

  ranked.forEach((item) => {
    if (chosen.length >= 6) return;
    if (seenTexts.has(item.text)) return;
    seenTexts.add(item.text);
    chosen.push(item.text);
  });

  return chosen;
}

function isSemanticUnitUserFacing(unit) {
  const path = `${unit?.aqlPath || ''}`;
  const label = `${unit?.label || ''}`.trim().toLowerCase();
  if (!path) return false;
  if (/^\/(category|composer|language|territory)$/i.test(path)) return false;
  if (/\/context\/(language|territory|setting|composer)(?:\/|$)/i.test(path)) return false;
  if (['category', 'tree', 'report id', 'status'].includes(label)) return false;
  return true;
}

function formatIntentTime(intent) {
  if (intent?.time?.durationIso) return intent.time.durationIso;
  if (intent?.time?.from && intent?.time?.to) return `${intent.time.from} -> ${intent.time.to}`;
  return 'none';
}

function prettifyContractValue(value) {
  return `${value || ''}`
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
}

function describeResolverOutcome(resolverResult) {
  const decision = resolverResult?.confidence?.decision || 'unsupported';
  const errors = resolverResult?.bestCandidate?.validation?.errors || [];
  if (decision === 'auto_execute') {
    return 'the resolver is confident enough to render an executable query.';
  }
  if (decision === 'confirm_contract' && errors.includes('unit required for semantic unit')) {
    return 'the resolver found the likely contract, but a deterministic unit is still missing. Confirm the mapping below before rendering executable AQL.';
  }
  if (decision === 'confirm_contract' || decision === 'confirm_datapoint' || decision === 'confirm_policy') {
    return 'the resolver found a plausible mapping but still needs your confirmation in the map below before it can render executable output.';
  }
  return 'the resolver could not reach a safe deterministic execution path and shows the evidence below.';
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-theme bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-theme-secondary">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-theme-primary">{value}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div>
      {eyebrow && (
        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</div>
      )}
      <div className="mt-1 text-lg font-semibold text-theme-primary">{title}</div>
      {description && (
        <div className="mt-1 text-sm text-theme-secondary max-w-4xl">{description}</div>
      )}
    </div>
  );
}

function ArtifactListCard({ title, icon: Icon, subtitle = '', count = null, children }) {
  return (
    <div className="rounded-xl border border-theme bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-theme-primary">
            <Icon size={16} />
            {title}
          </div>
          {subtitle && (
            <div className="mt-1 text-xs leading-relaxed text-theme-secondary">{subtitle}</div>
          )}
        </div>
        {count !== null && (
          <span className="rounded-full border border-theme bg-background px-2.5 py-1 text-[11px] text-theme-secondary">
            {count}
          </span>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ProcessOverviewCard({ step, title, description, icon: Icon, metric }) {
  return (
    <div className="rounded-xl border border-theme bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-xs font-semibold text-cyan-200">
            {step}
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-theme-primary">
              <Icon size={16} />
              {title}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-theme-secondary">{description}</div>
          </div>
        </div>
        {metric !== undefined && metric !== null && (
          <span className="rounded-full border border-theme bg-background px-2.5 py-1 text-[11px] text-theme-secondary">
            {metric}
          </span>
        )}
      </div>
    </div>
  );
}

const SemanticArtifactsPanel = ({
  definition,
  activeEnvironmentId = '',
  isCreating = false,
  onNavigate
}) => {
  const [artifacts, setArtifacts] = useState(null);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [artifactsError, setArtifactsError] = useState('');
  const [selectedShapeId, setSelectedShapeId] = useState('');
  const [persisted, setPersisted] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [resolverQuery, setResolverQuery] = useState(DEFAULT_DEMO_QUERIES[0]);
  const [resolverResult, setResolverResult] = useState(null);
  const [resolverError, setResolverError] = useState('');
  const [resolvingQuery, setResolvingQuery] = useState(false);

  const semanticObject = useMemo(() => (
    definition?.definition ? definition : { definition }
  ), [definition]);
  const definitionPayload = semanticObject?.definition || null;
  const openEhrBacked = useMemo(
    () => isOpenEhrContextObjectDefinition(definitionPayload),
    [definitionPayload]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPersistedArtifacts() {
      if (!openEhrBacked || !semanticObject?.id) {
        if (!cancelled) {
          setArtifacts(null);
          setArtifactsError('');
          setPersisted(false);
        }
        return;
      }

      try {
        setArtifactsError('');
        const response = await fetch(`/api/context-objects/semantic-artifacts?definitionId=${encodeURIComponent(semanticObject.id)}`);
        if (response.status === 404) {
          if (!cancelled) {
            setArtifacts(null);
            setPersisted(false);
          }
          return;
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load semantic artifacts');
        }

        if (!cancelled) {
          setArtifacts(data?.artifacts || null);
          setPersisted(true);
        }
      } catch (error) {
        console.error('Failed to load semantic artifacts:', error);
        if (!cancelled) {
          setArtifactsError(error.message || 'Failed to load semantic artifacts');
        }
      }
    }

    loadPersistedArtifacts();
    return () => {
      cancelled = true;
    };
  }, [openEhrBacked, semanticObject?.id]);

  useEffect(() => {
    setResolverResult(null);
    setResolverError('');
  }, [artifacts?.generatedAt, semanticObject?.id]);

  const sourceTemplateCatalog = useMemo(() => {
    if (Array.isArray(artifacts?.sourceTemplateCatalog)) return artifacts.sourceTemplateCatalog;
    if (artifacts?.templateCatalog) return [artifacts.templateCatalog];
    return [];
  }, [artifacts?.sourceTemplateCatalog, artifacts?.templateCatalog]);

  const semanticUnits = useMemo(
    () => (Array.isArray(artifacts?.semanticUnits) ? artifacts.semanticUnits : asArray(artifacts?.contextUnits)).map((unit, index) => ({
      ...unit,
      semanticUnitId: unit?.semanticUnitId || unit?.id || `semantic-unit-${index + 1}`
    })),
    [artifacts?.semanticUnits, artifacts?.contextUnits]
  );
  const terminologySurface = useMemo(
    () => asArray(artifacts?.terminologySurface),
    [artifacts?.terminologySurface]
  );
  const resolvedContextContract = useMemo(
    () => artifacts?.contextContract || semanticObject?.metadata?.contextContract || null,
    [artifacts?.contextContract, semanticObject?.metadata?.contextContract]
  );
  const resolvedSemanticContract = useMemo(
    () => artifacts?.semanticContract || resolvedContextContract?.semanticContract || null,
    [artifacts?.semanticContract, resolvedContextContract]
  );
  const aqlAllowedForContext = useMemo(
    () => allowsExecutionTarget(
      resolvedSemanticContract || resolvedContextContract || {},
      'aql',
      semanticObject?.kind || 'context_object'
    ),
    [resolvedContextContract, resolvedSemanticContract, semanticObject?.kind]
  );
  const contractCatalog = useMemo(
    () => (Array.isArray(artifacts?.contractCatalog) ? artifacts.contractCatalog : asArray(artifacts?.queryContracts)).map((contract, index) => ({
      ...contract,
      contractId: contract?.contractId || contract?.id || `contract-${index + 1}`
    })),
    [artifacts?.contractCatalog, artifacts?.queryContracts]
  );
  const queryShapeLibrary = useMemo(
    () => (Array.isArray(artifacts?.queryShapeLibrary) ? artifacts.queryShapeLibrary : asArray(artifacts?.storedQueryShapes)).map((shape, index) => ({
      ...shape,
      queryShapeId: shape?.queryShapeId || shape?.id || `query-shape-${index + 1}`,
      text: shape?.text || shape?.label || `Stored query shape ${index + 1}`,
      exampleText: shape?.exampleText || '',
      exampleEligible: shape?.exampleEligible !== false,
      normalizedShape: shape?.normalizedShape || '',
      role: shape?.role || 'doctor',
      language: shape?.language || 'en',
      semanticUnitIds: asArray(shape?.semanticUnitIds),
      exampleParameters: shape?.exampleParameters || {}
    })),
    [artifacts?.queryShapeLibrary, artifacts?.storedQueryShapes]
  );
  const doctorShapes = useMemo(() => {
    const preferred = queryShapeLibrary.filter((shape) => shape?.language === 'en' && shape?.role === 'doctor');
    return preferred.length > 0 ? preferred : queryShapeLibrary;
  }, [queryShapeLibrary]);
  const userFacingDoctorShapes = useMemo(() => doctorShapes.filter((shape) => {
    if (shape?.exampleEligible === false) return false;
    const semanticUnitId = shape?.semanticUnitIds?.[0];
    const unit = semanticUnits.find((candidate) => candidate.semanticUnitId === semanticUnitId || candidate.id === semanticUnitId);
    return isSemanticUnitUserFacing(unit);
  }), [doctorShapes, semanticUnits]);
  const displayDoctorShapes = userFacingDoctorShapes.length > 0 ? userFacingDoctorShapes : doctorShapes;
  const templateExampleQueries = useMemo(
    () => pickTemplateExampleQueries(displayDoctorShapes, contractCatalog),
    [contractCatalog, displayDoctorShapes]
  );
  const resolverExampleQueries = templateExampleQueries.length > 0 ? templateExampleQueries : DEFAULT_DEMO_QUERIES;

  useEffect(() => {
    if (!displayDoctorShapes.length) {
      setSelectedShapeId('');
      return;
    }

    if (!selectedShapeId || !displayDoctorShapes.some((shape) => shape.queryShapeId === selectedShapeId)) {
      const coveredShape = displayDoctorShapes.find((shape) => {
        const contract = contractCatalog.find((candidate) => candidate.contractId === shape.contractId);
        return contract?.coverage === 'covered';
      });
      setSelectedShapeId((coveredShape || displayDoctorShapes[0]).queryShapeId);
    }
  }, [contractCatalog, displayDoctorShapes, selectedShapeId]);

  useEffect(() => {
    if (!resolverExampleQueries.length) return;
    if (!resolverQuery.trim() || DEFAULT_DEMO_QUERIES.includes(resolverQuery)) {
      setResolverQuery(resolverExampleQueries[0]);
    }
  }, [resolverExampleQueries, resolverQuery]);

  const selectedShape = useMemo(
    () => displayDoctorShapes.find((shape) => shape.queryShapeId === selectedShapeId) || displayDoctorShapes[0] || null,
    [displayDoctorShapes, selectedShapeId]
  );
  const selectedContract = useMemo(
    () => contractCatalog.find((contract) => (
      contract.contractId === selectedShape?.contractId || contract.id === selectedShape?.contractId
    )) || contractCatalog[0] || null,
    [contractCatalog, selectedShape?.contractId]
  );
  const selectedUnit = useMemo(() => {
    const semanticUnitId = selectedContract?.bindings?.[0]?.semanticUnitId || selectedShape?.semanticUnitIds?.[0];
    return semanticUnits.find((unit) => unit.semanticUnitId === semanticUnitId || unit.id === semanticUnitId) || null;
  }, [selectedContract?.bindings, selectedShape?.semanticUnitIds, semanticUnits]);

  const previewParams = useMemo(
    () => selectedShape?.exampleParameters || selectedContract?.exampleParameters || {},
    [selectedContract?.exampleParameters, selectedShape?.exampleParameters]
  );

  const previewAqlResult = useMemo(() => {
    if (!selectedContract) {
      return {
        aql: '',
        error: 'Select a generated query shape to preview deterministic AQL.'
      };
    }
    if (!aqlAllowedForContext) {
      return {
        aql: '',
        error: 'Semantic contract executionTargets do not allow AQL preview for this ContextObject.'
      };
    }

    try {
      return {
        aql: renderOpenEhrQueryContractAql(selectedContract, previewParams),
        error: ''
      };
    } catch (error) {
      return {
        aql: '',
        error: error.message || 'Failed to render deterministic AQL.'
      };
    }
  }, [aqlAllowedForContext, previewParams, selectedContract]);

  const resolvedAqlResult = useMemo(() => {
    if (!resolverResult) {
      return { aql: '', error: '' };
    }
    if (!resolverResult.renderedAql && !resolverResult.renderedAqlError) {
      return {
        aql: '',
        error: 'Resolver did not produce executable AQL for this question.'
      };
    }
    return {
      aql: resolverResult.renderedAql || '',
      error: resolverResult.renderedAqlError || ''
    };
  }, [resolverResult]);

  const displayedAqlResult = useMemo(() => (
    resolverResult ? resolvedAqlResult : previewAqlResult
  ), [previewAqlResult, resolvedAqlResult, resolverResult]);

  const generateArtifacts = async () => {
    if (!definitionPayload) return;

    try {
      setLoadingArtifacts(true);
      setArtifactsError('');
      setLaunchError('');

      const response = await fetch('/api/context-objects/semantic-artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definitionId: semanticObject?.id || undefined,
          definition: semanticObject,
          persist: Boolean(semanticObject?.id) && !isCreating
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate semantic artifacts');
      }

      setArtifacts(data?.artifacts || null);
      setPersisted(data?.persisted === true);
    } catch (error) {
      console.error('Failed to generate semantic artifacts:', error);
      setArtifactsError(error.message || 'Failed to generate semantic artifacts');
    } finally {
      setLoadingArtifacts(false);
    }
  };

  const handleOpenInQueryLab = () => {
    if (!displayedAqlResult.aql.trim()) {
      setLaunchError(displayedAqlResult.error || 'AQL preview is not available for this contract yet.');
      return;
    }

    stashLabAqlDraft(displayedAqlResult.aql);
    stashLabAqlLaunch({
      source: 'semanticArtifacts',
      definitionId: semanticObject?.id || '',
      contractId: resolverResult?.bestCandidate?.contractId || selectedContract?.contractId || selectedContract?.id || '',
      queryShapeId: resolverResult?.bestCandidate?.queryShapeId || selectedShape?.queryShapeId || ''
    });

    setLaunchError('');
    if (typeof onNavigate === 'function') {
      onNavigate('lab');
    }
  };

  const handleResolveQuery = () => {
    if (!resolverQuery.trim()) {
      setResolverError('Enter a clinical question to resolve.');
      setResolverResult(null);
      return;
    }

    try {
      setResolvingQuery(true);
      setResolverError('');
      setLaunchError('');

      const result = resolveSemanticRetrievalQuestion({
        question: resolverQuery,
        queryShapeLibrary,
        contractCatalog,
        semanticUnits,
        terminologySurface,
        contextContract: resolvedContextContract,
        semanticContract: resolvedSemanticContract
      });

      setResolverResult(result);
      if (result?.bestCandidate?.queryShapeId) {
        setSelectedShapeId(result.bestCandidate.queryShapeId);
      }
    } catch (error) {
      console.error('Failed to resolve semantic query:', error);
      setResolverResult(null);
      setResolverError(error.message || 'Failed to resolve query');
    } finally {
      setResolvingQuery(false);
    }
  };

  if (!openEhrBacked) {
    return (
      <div className="p-5 rounded-xl border border-theme bg-surface text-sm text-theme-secondary">
        Semantic artifacts are currently available for ContextObjects backed by a preserved openEHR template import.
      </div>
    );
  }

  const sourceTemplate = sourceTemplateCatalog[0] || null;
  const foundationProcessCards = [
    {
      step: '1',
      title: 'Source Template Catalog',
      description: 'Preserve the OPT / webtemplate as the canonical source definition without replacing it.',
      icon: Database,
      metric: artifacts?.foundationInventory?.sourceTemplateCount || sourceTemplateCatalog.length || 0
    },
    {
      step: '2',
      title: 'Semantic Contract',
      description: 'Declare what kind of data product this ContextObject is and which execution targets are allowed.',
      icon: Sparkles,
      metric: resolvedSemanticContract?.contractType ? prettifyContractValue(resolvedSemanticContract.contractType) : 'n/a'
    },
    {
      step: '3',
      title: 'Semantic Units',
      description: 'Extract the queryable surfaces, paths, and value kinds directly from the source template.',
      icon: Network,
      metric: artifacts?.foundationInventory?.semanticUnitCount || semanticUnits.length || 0
    },
    {
      step: '4',
      title: 'Terminology Surface',
      description: 'Compile labels, descriptions, codes, units, and approved aliases into a searchable semantic layer.',
      icon: Languages,
      metric: artifacts?.foundationInventory?.terminologyEntryCount || terminologySurface.length || 0
    },
    {
      step: '5',
      title: 'Contract Catalog',
      description: 'Generate deterministic retrieval contracts that can later be bound to operational query renderers.',
      icon: LayoutList,
      metric: artifacts?.foundationInventory?.contractCount || contractCatalog.length || 0
    },
    {
      step: '6',
      title: 'Query Shape Library',
      description: 'Generate example natural-language patterns that resolve to contracts instead of direct AQL generation.',
      icon: FileSearch,
      metric: artifacts?.foundationInventory?.queryShapeCount || queryShapeLibrary.length || 0
    },
    {
      step: '7',
      title: 'Deterministic Execution Handoff',
      description: 'Validate the selected contract, bind parameters, then render deterministic AQL only when the target allows it.',
      icon: CheckCircle2,
      metric: aqlAllowedForContext ? 'AQL allowed' : 'AQL gated'
    },
    {
      step: '8',
      title: 'Query Lab',
      description: 'Hand the deterministic query to the existing Query Studio tooling for compilation and execution.',
      icon: ExternalLink,
      metric: activeEnvironmentId ? 'Ready' : 'Needs env'
    }
  ];

  return (
    <div className="h-full overflow-auto min-h-0 p-4 space-y-4">
      <div className="rounded-xl border border-theme bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-cyan-300" />
              <h3 className="text-base font-semibold text-theme-primary">Semantic Retrieval Foundation</h3>
            </div>
            <p className="mt-2 text-sm text-theme-secondary max-w-4xl">
              This panel now treats the openEHR template as the canonical source and exposes the visible derivation chain:
              source template catalog, semantic units, terminology surface, contract catalog, query shape library, and
              deterministic AQL handoff into Query Studio&apos;s existing Query Lab.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-200">
                Canonical source: OPT / webtemplate
              </span>
              {resolvedSemanticContract?.contractType && (
                <span className="rounded-full border border-theme bg-background px-3 py-1 text-theme-secondary">
                  Semantic contract: {prettifyContractValue(resolvedSemanticContract.contractType)}
                </span>
              )}
              {resolvedSemanticContract?.resultShape && (
                <span className="rounded-full border border-theme bg-background px-3 py-1 text-theme-secondary">
                  Result shape: {prettifyContractValue(resolvedSemanticContract.resultShape)}
                </span>
              )}
              {Array.isArray(resolvedSemanticContract?.executionTargets) && resolvedSemanticContract.executionTargets.length > 0 && (
                <span className="rounded-full border border-theme bg-background px-3 py-1 text-theme-secondary">
                  Targets: {resolvedSemanticContract.executionTargets.join(', ')}
                </span>
              )}
              <span className="rounded-full border border-theme bg-background px-3 py-1 text-theme-secondary">
                Storage: MongoDB `context_object_semantic_artifacts`
              </span>
              <span className="rounded-full border border-theme bg-background px-3 py-1 text-theme-secondary">
                Export files: JSONL not written yet
              </span>
            </div>
            {isCreating && (
              <p className="mt-3 text-xs text-amber-300">
                This ContextObject is still a draft. Artifacts can be generated from the current editor state, but persistence is skipped until the definition exists.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={generateArtifacts}
            disabled={loadingArtifacts}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loadingArtifacts ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {artifacts ? 'Regenerate' : 'Generate'} artifacts
          </button>
        </div>

        {artifactsError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertCircle size={16} />
            {artifactsError}
          </div>
        )}
      </div>

      {artifacts ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard label="Source Templates" value={artifacts?.foundationInventory?.sourceTemplateCount || sourceTemplateCatalog.length || 0} />
            <StatCard label="Semantic Units" value={artifacts?.foundationInventory?.semanticUnitCount || semanticUnits.length || 0} />
            <StatCard label="Terminology" value={artifacts?.foundationInventory?.terminologyEntryCount || terminologySurface.length || 0} />
            <StatCard label="Contracts" value={artifacts?.foundationInventory?.contractCount || contractCatalog.length || 0} />
            <StatCard label="Query Shapes" value={artifacts?.foundationInventory?.queryShapeCount || queryShapeLibrary.length || 0} />
            <StatCard label="Warnings" value={(artifacts?.warnings || []).length} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
              <SectionHeader
                eyebrow="Track A"
                title="Compile Semantic Data Product"
                description="This side of the demonstrator shows what gets compiled and stored from the source template: canonical source metadata, semantic units, terminology, contracts, and query shapes."
              />
              <div className="mt-4 space-y-2 text-sm text-theme-secondary">
                <div>Observe here when you want to understand what the ContextObject knows before any question is asked.</div>
                <div>Persistence target: MongoDB collection `context_object_semantic_artifacts`.</div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <SectionHeader
                eyebrow="Track B"
                title="Resolve Live Question"
                description="This side shows the operational story: a natural-language question is normalized, matched against query shapes and semantic units, validated against contracts, and only then rendered into deterministic AQL."
              />
              <div className="mt-4 space-y-2 text-sm text-theme-secondary">
                <div>Observe here when you want to understand why a question resolved, failed, or needs confirmation.</div>
                <div>The final handoff goes into Query Studio&apos;s existing Query Lab, not a separate custom builder.</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-theme bg-surface p-5">
            <SectionHeader
              eyebrow="Visible Walkthrough"
              title="This screen is organized as an 8-step demonstrator"
              description="Each card below corresponds to one visible stage in the pipeline, from canonical template preservation to deterministic execution handoff."
            />
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {foundationProcessCards.map((card) => (
                <ProcessOverviewCard
                  key={card.step}
                  step={card.step}
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  metric={card.metric}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-theme bg-surface p-5 space-y-4">
            <SectionHeader
              eyebrow="Part 1"
              title="Compiled Semantic Data Product"
              description="These are the generated semantic artifacts derived from the imported OPT / webtemplate. They define the deterministic retrieval surface before any runtime query is attempted."
            />

            {(artifacts?.warnings || []).length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="text-sm font-medium text-amber-200">Compiler warnings</div>
                <div className="mt-2 space-y-1 text-sm text-amber-100">
                  {(artifacts.warnings || []).map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            )}

            {resolvedSemanticContract && (
              <div className="rounded-xl border border-theme bg-background/30 p-4">
                <div className="text-sm font-medium text-theme-primary">Step 2: Semantic Data Product Contract</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                    Semantic data product contract
                  </span>
                  {resolvedSemanticContract?.resultShape && (
                    <span className="rounded-full border border-theme bg-background px-3 py-1 text-xs text-theme-secondary">
                      Result shape: {prettifyContractValue(resolvedSemanticContract.resultShape)}
                    </span>
                  )}
                  {Array.isArray(resolvedSemanticContract?.executionTargets) && resolvedSemanticContract.executionTargets.length > 0 && (
                    <span className="rounded-full border border-theme bg-background px-3 py-1 text-xs text-theme-secondary">
                      Targets: {resolvedSemanticContract.executionTargets.join(', ')}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg border border-theme bg-background/40 p-3">
                    <div className="text-xs uppercase tracking-wide text-theme-secondary">Contract type</div>
                    <div className="mt-1 text-theme-primary">{prettifyContractValue(resolvedSemanticContract.contractType) || 'n/a'}</div>
                  </div>
                  <div className="rounded-lg border border-theme bg-background/40 p-3">
                    <div className="text-xs uppercase tracking-wide text-theme-secondary">Subject</div>
                    <div className="mt-1 text-theme-primary">{resolvedSemanticContract.subject || 'n/a'}</div>
                  </div>
                  <div className="rounded-lg border border-theme bg-background/40 p-3">
                    <div className="text-xs uppercase tracking-wide text-theme-secondary">Focus</div>
                    <div className="mt-1 text-theme-primary">{resolvedSemanticContract.focus || 'n/a'}</div>
                  </div>
                  <div className="rounded-lg border border-theme bg-background/40 p-3">
                    <div className="text-xs uppercase tracking-wide text-theme-secondary">Source of truth</div>
                    <div className="mt-1 text-theme-primary">{prettifyContractValue(resolvedSemanticContract.sourceOfTruth) || 'n/a'}</div>
                  </div>
                </div>
                {resolvedSemanticContract.intent && (
                  <div className="mt-3 rounded-lg border border-theme bg-background/40 p-3">
                    <div className="text-xs uppercase tracking-wide text-theme-secondary">Intent</div>
                    <div className="mt-1 text-sm text-theme-primary">{resolvedSemanticContract.intent}</div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ArtifactListCard
                title="Step 1: Source Template Catalog"
                icon={Database}
                subtitle="Preserved source metadata from the imported OPT / webtemplate."
                count={sourceTemplateCatalog.length}
              >
                {sourceTemplate ? (
                  <div className="rounded-lg border border-theme bg-background/40 p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-theme-primary">{sourceTemplate.templateLabel || sourceTemplate.templateId}</span>
                      <span className="px-2 py-0.5 rounded border border-theme bg-background text-[10px] text-theme-secondary">
                        {sourceTemplate.sourceType || artifacts?.source?.sourceType || 'openEHR-webtemplate'}
                      </span>
                      {sourceTemplate.rmType && (
                        <span className="px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-200">
                          {sourceTemplate.rmType}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-theme-secondary">
                      <div>Template ID: <span className="text-theme-primary">{sourceTemplate.templateId || 'n/a'}</span></div>
                      <div>semVer: <span className="text-theme-primary">{sourceTemplate.semVer || 'n/a'}</span></div>
                      <div>Default language: <span className="text-theme-primary">{sourceTemplate.defaultLanguage || 'en'}</span></div>
                      <div>Languages: <span className="text-theme-primary">{(sourceTemplate.languages || []).join(', ') || 'en'}</span></div>
                      <div>Source nodes: <span className="text-theme-primary">{sourceTemplate?.treeRef?.sourceNodeCount || 0}</span></div>
                      <div>Temporal path: <span className="text-theme-primary break-all">{sourceTemplate?.treeRef?.defaultTemporalPath || 'not detected'}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-theme-secondary">Generate artifacts to inspect the preserved source template catalog.</div>
                )}
              </ArtifactListCard>

              <ArtifactListCard
                title="Step 3: Semantic Units"
                icon={Network}
                subtitle="Queryable surfaces extracted from the source definition."
                count={semanticUnits.length}
              >
                <div className="max-h-72 overflow-auto space-y-2">
                  {semanticUnits.slice(0, 14).map((unit) => (
                    <div key={unit.semanticUnitId || unit.id} className="rounded-lg border border-theme bg-background/40 p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-theme-primary">{unit.label}</span>
                        <span className="px-2 py-0.5 rounded border border-theme bg-background text-[10px] text-theme-secondary">
                          {unit.valueKind || unit.kind || 'field'}
                        </span>
                        {unit.isContext && (
                          <span className="px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-200">
                            context
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-[11px] text-theme-secondary break-all">{unit.aqlPath || unit.queryPath || 'No AQL path'}</div>
                    </div>
                  ))}
                  {semanticUnits.length > 14 && (
                    <div className="text-xs text-theme-secondary">
                      Showing 14 of {semanticUnits.length} semantic units.
                    </div>
                  )}
                </div>
              </ArtifactListCard>

              <ArtifactListCard
                title="Step 4: Terminology Surface"
                icon={Languages}
                subtitle="Labels, coded options, term bindings, and other matching vocabulary."
                count={terminologySurface.length}
              >
                <div className="max-h-72 overflow-auto space-y-2">
                  {terminologySurface.slice(0, 10).map((entry) => (
                    <div key={entry.terminologyEntryId} className="rounded-lg border border-theme bg-background/40 p-3">
                      <div className="text-sm font-medium text-theme-primary">
                        {entry.sourceLabels?.[0] || entry.semanticUnitId}
                      </div>
                      <div className="mt-1 text-[11px] text-theme-secondary break-all">{entry.aqlPath || 'No AQL path'}</div>
                      <div className="mt-2 text-[11px] text-theme-secondary">
                        Coded values: {entry.codedValues?.length || 0} | Term bindings: {entry.termBindings?.length || 0}
                      </div>
                    </div>
                  ))}
                  {terminologySurface.length > 10 && (
                    <div className="text-xs text-theme-secondary">
                      Showing 10 of {terminologySurface.length} terminology entries.
                    </div>
                  )}
                </div>
              </ArtifactListCard>

              <ArtifactListCard
                title="Step 5: Contract Catalog"
                icon={LayoutList}
                subtitle="Deterministic contracts generated from semantic units."
                count={contractCatalog.length}
              >
                <div className="max-h-80 overflow-auto space-y-2">
                  {contractCatalog.slice(0, 14).map((contract) => (
                    <div key={contract.contractId || contract.id} className="rounded-lg border border-theme bg-background/40 p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-theme-primary">{contract.label}</span>
                        <span className={`px-2 py-0.5 rounded border text-[10px] ${contractCoverageClasses(contract.coverage)}`}>
                          {contract.coverage || 'derived'}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-theme-secondary">
                        {contract.contractKind || contract.kind}
                      </div>
                    </div>
                  ))}
                  {contractCatalog.length > 14 && (
                    <div className="text-xs text-theme-secondary">
                      Showing 14 of {contractCatalog.length} contracts.
                    </div>
                  )}
                </div>
              </ArtifactListCard>

              <ArtifactListCard
                title="Step 6: Query Shape Library"
                icon={FileSearch}
                subtitle="Generated examples and normalized retrieval patterns derived from the contracts."
                count={displayDoctorShapes.length}
              >
                <div className="max-h-72 overflow-auto space-y-2">
                  {displayDoctorShapes.slice(0, 8).map((shape) => (
                    <div key={shape.queryShapeId} className="rounded-lg border border-theme bg-background/40 p-3">
                      <div className="text-sm font-medium text-theme-primary">{shape.text}</div>
                      <div className="mt-1 text-[11px] text-theme-secondary">{shape.normalizedShape || 'No normalized shape'}</div>
                      <div className="mt-2 text-[11px] text-theme-secondary">
                        Role: {shape.role || 'doctor'} | Language: {shape.language || 'en'}
                      </div>
                    </div>
                  ))}
                  {displayDoctorShapes.length > 8 && (
                    <div className="text-xs text-theme-secondary">
                      Showing 8 of {displayDoctorShapes.length} query shapes.
                    </div>
                  )}
                </div>
              </ArtifactListCard>
            </div>
          </div>

          <div className="rounded-2xl border border-theme bg-surface p-5 space-y-4">
            <SectionHeader
              eyebrow="Part 2"
              title="Live Resolution Walkthrough"
              description="Ask a question and inspect the visible reasoning path: normalization, intent extraction, retrieval evidence, contract validation, and deterministic execution preview."
            />

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-4">
              <ArtifactListCard
                title="Runtime Resolver Walkthrough"
                icon={Search}
                subtitle="Run a question through the deterministic retrieval pipeline and inspect each intermediate stage."
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-theme-secondary mb-2">
                      Natural language question
                    </label>
                    <textarea
                      value={resolverQuery}
                      onChange={(event) => setResolverQuery(event.target.value)}
                      rows={4}
                      placeholder={resolverExampleQueries[0] || 'patients with temperature above 38 C in the last 24 hours'}
                      className="w-full px-3 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary resize-none"
                    />
                    <div className="mt-2 text-[11px] text-theme-secondary">
                      {templateExampleQueries.length > 0
                        ? `Generated examples for ${sourceTemplate?.templateLabel || sourceTemplate?.templateId || 'this template'}`
                        : 'Fallback examples until template-specific artifacts are regenerated'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {resolverExampleQueries.map((query) => (
                        <button
                          key={query}
                          type="button"
                          onClick={() => setResolverQuery(query)}
                          className="px-2.5 py-1 rounded-full border border-theme bg-background text-[11px] text-theme-secondary hover:border-cyan-500/30 hover:text-cyan-200 transition-colors"
                        >
                          {query}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-theme-secondary">
                    <div className="font-medium text-theme-primary">Deterministic path</div>
                    <div className="mt-1">normalize -&gt; retrieve -&gt; validate -&gt; confidence gate -&gt; render executable target</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleResolveQuery}
                      disabled={resolvingQuery || !resolverQuery.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {resolvingQuery ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                      Resolve query
                    </button>
                    <div className="text-sm text-theme-secondary">
                      The result below shows exactly why a query resolved, abstained, or needs supervision.
                    </div>
                  </div>

                  {resolverError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      <AlertCircle size={16} />
                      {resolverError}
                    </div>
                  )}

                  {!resolverResult && !resolverError && (
                    <div className="rounded-lg border border-dashed border-theme bg-background/30 p-4 text-sm text-theme-secondary">
                      Run a query to populate the walkthrough steps below. This is where you can observe normalization, retrieval evidence, confidence, validation, and the final execution handoff.
                    </div>
                  )}

                  {resolverResult && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-theme bg-background/40 p-4">
                          <div className="text-xs uppercase tracking-wide text-theme-secondary">Step 1: Normalization</div>
                          <div className="mt-2 text-sm text-theme-primary">{resolverResult.normalizedQuery?.normalizedText || 'n/a'}</div>
                          <div className="mt-2 text-xs text-theme-secondary">
                            Operators: {(resolverResult.processedIntent?.operators || []).join(', ') || 'none'}
                          </div>
                          <div className="text-xs text-theme-secondary">
                            Units: {(resolverResult.processedIntent?.units || []).join(', ') || 'none'}
                          </div>
                          <div className="text-xs text-theme-secondary">
                            Time filter: {formatIntentTime(resolverResult.processedIntent)}
                          </div>
                        </div>

                        <div className="rounded-lg border border-theme bg-background/40 p-4">
                          <div className="text-xs uppercase tracking-wide text-theme-secondary">Step 2: Processed intent</div>
                          <div className="mt-2 text-sm text-theme-primary">
                            Intent: {resolverResult.processedIntent?.intentKind || 'unknown'}
                          </div>
                          <pre className="mt-2 max-h-52 overflow-auto text-xs text-theme-secondary whitespace-pre-wrap">
                            {prettyJson({
                              terms: resolverResult.processedIntent?.terms,
                              measurements: resolverResult.processedIntent?.measurements,
                              values: resolverResult.processedIntent?.values,
                              units: resolverResult.processedIntent?.units,
                              time: resolverResult.processedIntent?.time,
                              aggregation: resolverResult.processedIntent?.aggregation,
                              ambiguities: resolverResult.processedIntent?.ambiguities
                            })}
                          </pre>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-theme bg-background/40 p-4">
                          <div className="text-xs uppercase tracking-wide text-theme-secondary">Step 3: Query-shape retrieval</div>
                          <div className="mt-2 text-sm text-theme-secondary">The resolver first tries to match approved query-shape patterns.</div>
                          <div className="mt-3 space-y-2">
                            {(resolverResult.retrieval?.lexicalQueryShapeMatches || []).slice(0, 3).map((candidate) => (
                              <div key={`${candidate.queryShapeId}:${candidate.contractId}`} className="rounded-lg border border-theme bg-background px-3 py-2">
                                <div className="text-sm text-theme-primary">{candidate.queryShapeText || candidate.contractLabel}</div>
                                <div className="mt-1 text-[11px] text-theme-secondary">
                                  score {candidate.score.toFixed(2)} | {candidate.contractKind}
                                </div>
                              </div>
                            ))}
                            {(resolverResult.retrieval?.lexicalQueryShapeMatches || []).length === 0 && (
                              <div className="text-sm text-theme-secondary">No query-shape match above threshold.</div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-theme bg-background/40 p-4">
                          <div className="text-xs uppercase tracking-wide text-theme-secondary">Step 4: Semantic-unit fallback</div>
                          <div className="mt-2 text-sm text-theme-secondary">If query-shape recall is weak, the resolver falls back to semantic-unit matching.</div>
                          <div className="mt-3 space-y-2">
                            {(resolverResult.retrieval?.semanticUnitMatches || []).slice(0, 3).map((candidate) => (
                              <div key={`${candidate.semanticUnitId}:${candidate.contractId}`} className="rounded-lg border border-theme bg-background px-3 py-2">
                                <div className="text-sm text-theme-primary">{candidate.semanticUnitLabel || candidate.contractLabel}</div>
                                <div className="mt-1 text-[11px] text-theme-secondary">
                                  score {candidate.score.toFixed(2)} | {candidate.contractKind}
                                </div>
                              </div>
                            ))}
                            {(resolverResult.retrieval?.semanticUnitMatches || []).length === 0 && (
                              <div className="text-sm text-theme-secondary">No semantic-unit fallback match above threshold.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-theme bg-background/40 p-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs uppercase tracking-wide text-theme-secondary">Step 5: Contract + confidence gate</span>
                          <span className={`px-2 py-0.5 rounded border text-[10px] ${decisionClasses(resolverResult.confidence?.decision)}`}>
                            {resolverResult.confidence?.decision || 'unsupported'}
                          </span>
                          <span className="px-2 py-0.5 rounded border border-theme bg-background text-[10px] text-theme-secondary">
                            score {(resolverResult.confidence?.score || 0).toFixed(2)}
                          </span>
                          <span className="px-2 py-0.5 rounded border border-theme bg-background text-[10px] text-theme-secondary">
                            margin {(resolverResult.confidence?.margin || 0).toFixed(2)}
                          </span>
                        </div>

                        <div className="text-sm text-theme-secondary">
                          Outcome: {describeResolverOutcome(resolverResult)}
                        </div>

                        {(resolverResult.confidence?.reasons || []).length > 0 && (
                          <div className="text-xs text-theme-secondary">
                            Reasons: {(resolverResult.confidence.reasons || []).join(', ')}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-theme-secondary">Best contract</div>
                            <div className="mt-1 text-theme-primary">{resolverResult.bestCandidate?.contract?.label || 'n/a'}</div>
                            <div className="text-xs text-theme-secondary mt-1">
                              {resolverResult.bestCandidate?.contractKind || 'no candidate'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-theme-secondary">Best semantic unit</div>
                            <div className="mt-1 text-theme-primary">{resolverResult.bestCandidate?.semanticUnit?.label || 'n/a'}</div>
                            <div className="text-xs text-theme-secondary mt-1 break-all">
                              {resolverResult.bestCandidate?.semanticUnit?.aqlPath || 'n/a'}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-theme-secondary">Derived parameters</div>
                          <pre className="mt-2 rounded-lg bg-background p-3 text-xs text-theme-secondary whitespace-pre-wrap">
                            {prettyJson(resolverResult.bestCandidate?.params || {})}
                          </pre>
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-theme-secondary">Validation</div>
                          <pre className="mt-2 rounded-lg bg-background p-3 text-xs text-theme-secondary whitespace-pre-wrap">
                            {prettyJson(resolverResult.bestCandidate?.validation || { valid: false, errors: ['no_candidate'] })}
                          </pre>
                        </div>

                        {resolverResult.supervisionPackage && (
                          <div>
                            <div className="text-xs uppercase tracking-wide text-theme-secondary">Supervision package</div>
                            <pre className="mt-2 rounded-lg bg-background p-3 text-xs text-theme-secondary whitespace-pre-wrap">
                              {prettyJson(resolverResult.supervisionPackage)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ArtifactListCard>

              <div className="space-y-4">
                <ArtifactListCard
                  title="Matched Query Shape Translation"
                  icon={FileSearch}
                  subtitle="Inspect the stored query shape that explains the current translation from natural language into contract form."
                >
                  {selectedShape ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs uppercase tracking-wide text-theme-secondary mb-2">
                          Query shape
                        </label>
                        <select
                          value={selectedShape.queryShapeId}
                          onChange={(event) => setSelectedShapeId(event.target.value)}
                          className="w-full px-3 py-2 bg-background border border-theme rounded-lg text-theme-primary focus:outline-none focus:border-primary"
                        >
                          {displayDoctorShapes.map((shape) => (
                            <option key={shape.queryShapeId} value={shape.queryShapeId}>
                              {shape.text}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded-lg border border-theme bg-background/40 p-4 space-y-3">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-theme-secondary">Natural language</div>
                          <div className="mt-1 text-sm text-theme-primary">{selectedShape.text}</div>
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-theme-secondary">Generated example</div>
                          <div className="mt-1 text-sm text-theme-secondary">{selectedShape.exampleText || 'n/a'}</div>
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-theme-secondary">Normalized shape</div>
                          <div className="mt-1 text-sm text-theme-secondary">{selectedShape.normalizedShape || 'n/a'}</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-theme-secondary">Contract</div>
                            <div className="mt-1 text-theme-primary">{selectedContract?.label || 'n/a'}</div>
                            <div className="text-xs text-theme-secondary mt-1">{selectedContract?.contractKind || selectedContract?.kind || 'n/a'}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-theme-secondary">Semantic unit</div>
                            <div className="mt-1 text-theme-primary">{selectedUnit?.label || 'n/a'}</div>
                            <div className="text-xs text-theme-secondary mt-1 break-all">{selectedUnit?.aqlPath || 'n/a'}</div>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-theme-secondary">Example parameters</div>
                          <pre className="mt-2 rounded-lg bg-background p-3 text-xs text-theme-secondary whitespace-pre-wrap">
                            {prettyJson(previewParams)}
                          </pre>
                        </div>

                        {selectedContract?.bindings?.[0] && (
                          <div>
                            <div className="text-xs uppercase tracking-wide text-theme-secondary">Binding</div>
                            <pre className="mt-2 rounded-lg bg-background p-3 text-xs text-theme-secondary whitespace-pre-wrap">
                              {prettyJson(selectedContract.bindings[0])}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-theme-secondary">
                      Generate artifacts to preview the natural-language-to-contract translation layer.
                    </div>
                  )}
                </ArtifactListCard>

                <ArtifactListCard
                  title="Step 7: Deterministic AQL Handoff"
                  icon={CheckCircle2}
                  subtitle="This is the executable preview produced from the selected query shape or from the current resolved question."
                >
                  <div className="space-y-4">
                    <div className="rounded-lg border border-theme bg-background/40 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded border ${resolverResult ? decisionClasses(resolverResult.confidence?.decision) : contractCoverageClasses(selectedContract?.coverage)}`}>
                          {resolverResult ? (resolverResult.confidence?.decision || 'unsupported') : (selectedContract?.coverage || 'n/a')}
                        </span>
                        <span className="px-2 py-0.5 rounded border border-theme bg-background text-theme-secondary">
                          {resolverResult ? 'Resolved from current question' : 'Preview from selected query shape'}
                        </span>
                        {persisted && (
                          <span className="px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                            persisted
                          </span>
                        )}
                      </div>
                      <div className="mt-3 text-sm text-theme-secondary">
                        {resolverResult
                          ? 'This is the deterministic execution preview produced by the live resolver.'
                          : 'This preview lets you inspect the stored query-shape path even before asking a live question.'}
                      </div>
                      <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-background p-4 text-xs text-theme-secondary whitespace-pre-wrap">
                        {displayedAqlResult.aql || `-- ${displayedAqlResult.error}`}
                      </pre>
                    </div>

                    {launchError && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        <AlertCircle size={16} />
                        {launchError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleOpenInQueryLab}
                        disabled={!displayedAqlResult.aql.trim() || typeof onNavigate !== 'function'}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                      >
                        <ExternalLink size={16} />
                        Open in Query Lab
                      </button>

                      <div className="text-sm text-theme-secondary">
                        {activeEnvironmentId
                          ? 'Step 8: Query Lab can now compile and execute this deterministic query.'
                          : 'Select an active environment before compiling or executing in Query Studio.'}
                      </div>
                    </div>
                  </div>
                </ArtifactListCard>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-theme bg-surface p-6 text-sm text-theme-secondary">
          Generate artifacts to inspect the source-template-to-contract pipeline and open the deterministic AQL preview in Query Lab.
        </div>
      )}
    </div>
  );
};

export default SemanticArtifactsPanel;
