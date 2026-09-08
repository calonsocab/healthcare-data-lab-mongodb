export const VALID_CONTEXT_TYPES = ['subject', 'population', 'agentic', 'knowledge', 'building_block'];
export const VALID_PRIMARY_ANCHORS = [
  'patient',
  'encounter',
  'appointment',
  'study',
  'specimen',
  'practitioner',
  'center',
  'program',
  'cohort',
  'none',
  'custom'
];
export const VALID_TEMPORAL_MODES = ['snapshot', 'timeline', 'episode', 'windowed', 'mixed'];
export const VALID_ASSERTION_MODELS = ['observed', 'derived', 'workflow', 'guidance', 'mixed'];
export const VALID_RETRIEVAL_MODES = ['context_lookup', 'cross_subject', 'semantic_search', 'analytics', 'agentic'];
export const VALID_MATERIALIZATION_POLICIES = ['on_read', 'maintained_instance', 'materialized_snapshot', 'hybrid'];
export const VALID_DETERMINISM_LEVELS = ['guided', 'strict', 'negotiated'];
export const VALID_ACCESS_PROFILES = ['open', 'restricted', 'reviewed', 'regulated'];
export const VALID_PHI_SENSITIVITY = ['none', 'low', 'moderate', 'high'];
export const VALID_APPROVAL_WORKFLOWS = ['none', 'human_review', 'clinical_review', 'compliance_review'];
export const VALID_COPILOT_USAGES = ['primary_context', 'supporting_context', 'retrieval_only', 'not_used'];
export const VALID_TERMINOLOGY_MATCH_MODES = ['exact', 'expanded', 'hybrid'];
export const VALID_ASSERTION_DISAMBIGUATION = ['path_only', 'relation_aware', 'evidence_weighted'];
export const VALID_CLARIFICATION_POLICIES = ['never', 'on_ambiguity', 'on_low_confidence'];
export const VALID_RERANK_POLICIES = ['none', 'light', 'full'];
export const VALID_SEMANTIC_CONTRACT_TYPES = [
  'data_product',
  'document_model',
  'building_block',
  'atomic',
  'aggregate',
  'composite',
  'policy',
  'workflow'
];
export const VALID_RESULT_SHAPES = [
  'document',
  'document_set',
  'record_set',
  'entity_set',
  'timeline',
  'patient_set',
  'population_set',
  'analytic_result',
  'evidence_bundle',
  'building_block',
  'workflow_output'
];
export const VALID_EXECUTION_TARGETS = [
  'aql',
  'mql',
  'fhir_search',
  'sql',
  'graph',
  'kehrnel_service',
  'materialized_view',
  'none'
];
export const VALID_SOURCE_OF_TRUTH = ['native_definition', 'node_projection', 'mixed'];

const uniqueStrings = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => `${value || ''}`.trim())
        .filter(Boolean)
    )
  );

export function createDefaultContextContract(kind = 'context_object') {
  const isBlock = kind === 'block';

  return {
    semanticContract: {
      standardVersion: 'contextobjects.semantic_contract.v1',
      contractType: isBlock ? 'building_block' : 'data_product',
      subject: isBlock ? 'none' : 'patient',
      focus: '',
      intent: '',
      resultShape: isBlock ? 'building_block' : 'record_set',
      executionTargets: [],
      sourceOfTruth: isBlock ? 'node_projection' : 'native_definition'
    },
    contextType: isBlock ? 'building_block' : 'subject',
    primaryAnchor: isBlock ? 'none' : 'patient',
    contains: [],
    outputFamilies: [],
    viewFamilies: [],
    terminologyBindings: [],
    temporalMode: isBlock ? 'mixed' : 'snapshot',
    assertionModel: isBlock ? 'mixed' : 'observed',
    retrievalPolicy: {
      defaultMode: isBlock ? 'context_lookup' : 'context_lookup',
      allowedModes: isBlock ? ['context_lookup'] : ['context_lookup'],
      materialization: isBlock ? 'on_read' : 'maintained_instance',
      supportsCrossSubject: false,
      deterministicCompilation: 'guided',
    },
    terminologyPolicy: {
      matchMode: isBlock ? 'exact' : 'hybrid',
      descriptionSources: [],
      preferredSystems: [],
      conceptExpansion: [],
    },
    enrichmentPolicy: {
      useDescriptions: true,
      useEmbeddings: false,
      embeddingCollections: [],
      rerankPolicy: 'light',
      relationAwareScoring: true,
    },
    relationPolicy: {
      parentChildAware: true,
      siblingAware: true,
      temporalReasoning: !isBlock,
      preferenceOrder: ['anchor', 'parent-child', 'terminology', 'descriptions'],
      causalPredicates: [],
    },
    resolutionPolicy: {
      assertionDisambiguation: isBlock ? 'path_only' : 'relation_aware',
      clarificationPolicy: 'on_ambiguity',
      minimumSignalCount: 1,
      confidenceThreshold: 0.65,
    },
    governance: {
      accessProfile: 'restricted',
      phiSensitivity: isBlock ? 'none' : 'moderate',
      approvalWorkflow: 'none',
      provenanceRequired: true,
    },
    copilot: {
      eligible: !isBlock,
      preferredUsage: isBlock ? 'supporting_context' : 'primary_context',
      semanticProducts: [],
      answerModels: [],
    },
  };
}

export function normalizeContextContract(contract = {}, kind = 'context_object') {
  const base = createDefaultContextContract(kind);

  return {
    ...base,
    ...contract,
    semanticContract: {
      ...base.semanticContract,
      ...(contract.semanticContract || {}),
      executionTargets: uniqueStrings(
        contract?.semanticContract?.executionTargets ?? base.semanticContract.executionTargets
      ),
    },
    contains: uniqueStrings(contract.contains ?? base.contains),
    outputFamilies: uniqueStrings(contract.outputFamilies ?? base.outputFamilies),
    viewFamilies: uniqueStrings(contract.viewFamilies ?? base.viewFamilies),
    terminologyBindings: uniqueStrings(contract.terminologyBindings ?? base.terminologyBindings),
    retrievalPolicy: {
      ...base.retrievalPolicy,
      ...(contract.retrievalPolicy || {}),
      allowedModes: uniqueStrings(
        contract?.retrievalPolicy?.allowedModes?.length
          ? contract.retrievalPolicy.allowedModes
          : base.retrievalPolicy.allowedModes
      ),
      supportsCrossSubject: Boolean(
        contract?.retrievalPolicy?.supportsCrossSubject ?? base.retrievalPolicy.supportsCrossSubject
      ),
    },
    terminologyPolicy: {
      ...base.terminologyPolicy,
      ...(contract.terminologyPolicy || {}),
      descriptionSources: uniqueStrings(
        contract?.terminologyPolicy?.descriptionSources ?? base.terminologyPolicy.descriptionSources
      ),
      preferredSystems: uniqueStrings(
        contract?.terminologyPolicy?.preferredSystems ?? base.terminologyPolicy.preferredSystems
      ),
      conceptExpansion: uniqueStrings(
        contract?.terminologyPolicy?.conceptExpansion ?? base.terminologyPolicy.conceptExpansion
      ),
    },
    enrichmentPolicy: {
      ...base.enrichmentPolicy,
      ...(contract.enrichmentPolicy || {}),
      useDescriptions: Boolean(
        contract?.enrichmentPolicy?.useDescriptions ?? base.enrichmentPolicy.useDescriptions
      ),
      useEmbeddings: Boolean(
        contract?.enrichmentPolicy?.useEmbeddings ?? base.enrichmentPolicy.useEmbeddings
      ),
      relationAwareScoring: Boolean(
        contract?.enrichmentPolicy?.relationAwareScoring ?? base.enrichmentPolicy.relationAwareScoring
      ),
      embeddingCollections: uniqueStrings(
        contract?.enrichmentPolicy?.embeddingCollections ?? base.enrichmentPolicy.embeddingCollections
      ),
    },
    relationPolicy: {
      ...base.relationPolicy,
      ...(contract.relationPolicy || {}),
      parentChildAware: Boolean(
        contract?.relationPolicy?.parentChildAware ?? base.relationPolicy.parentChildAware
      ),
      siblingAware: Boolean(
        contract?.relationPolicy?.siblingAware ?? base.relationPolicy.siblingAware
      ),
      temporalReasoning: Boolean(
        contract?.relationPolicy?.temporalReasoning ?? base.relationPolicy.temporalReasoning
      ),
      preferenceOrder: uniqueStrings(
        contract?.relationPolicy?.preferenceOrder ?? base.relationPolicy.preferenceOrder
      ),
      causalPredicates: uniqueStrings(
        contract?.relationPolicy?.causalPredicates ?? base.relationPolicy.causalPredicates
      ),
    },
    resolutionPolicy: {
      ...base.resolutionPolicy,
      ...(contract.resolutionPolicy || {}),
      minimumSignalCount: Number(
        contract?.resolutionPolicy?.minimumSignalCount ?? base.resolutionPolicy.minimumSignalCount
      ),
      confidenceThreshold: Number(
        contract?.resolutionPolicy?.confidenceThreshold ?? base.resolutionPolicy.confidenceThreshold
      ),
    },
    governance: {
      ...base.governance,
      ...(contract.governance || {}),
      provenanceRequired: Boolean(
        contract?.governance?.provenanceRequired ?? base.governance.provenanceRequired
      ),
    },
    copilot: {
      ...base.copilot,
      ...(contract.copilot || {}),
      eligible: Boolean(contract?.copilot?.eligible ?? base.copilot.eligible),
      semanticProducts: uniqueStrings(contract?.copilot?.semanticProducts ?? base.copilot.semanticProducts),
      answerModels: uniqueStrings(contract?.copilot?.answerModels ?? base.copilot.answerModels),
    },
  };
}

function looksLikeSemanticContract(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      value.standardVersion !== undefined
      || value.contractType !== undefined
      || value.subject !== undefined
      || value.focus !== undefined
      || value.resultShape !== undefined
      || value.executionTargets !== undefined
      || value.sourceOfTruth !== undefined
    );
}

export function extractSemanticContract(value = {}, kind = 'context_object') {
  if (looksLikeSemanticContract(value)) {
    const base = createDefaultContextContract(kind).semanticContract;
    return {
      ...base,
      ...value,
      executionTargets: uniqueStrings(value?.executionTargets ?? base.executionTargets)
    };
  }

  return normalizeContextContract(value, kind).semanticContract;
}

export function allowsExecutionTarget(value = {}, target = '', kind = 'context_object') {
  const semanticContract = extractSemanticContract(value, kind);
  const executionTargets = uniqueStrings(semanticContract?.executionTargets || []);
  if (!asNonEmptyTarget(target)) return true;
  return executionTargets.length === 0 || executionTargets.includes(target);
}

function asNonEmptyTarget(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function ensureDefinitionContextContract(definition = {}) {
  const kind = definition?.kind || 'context_object';
  const metadata = definition?.metadata || {};
  const contextContract = normalizeContextContract(metadata.contextContract, kind);

  return {
    ...definition,
    metadata: {
      ...metadata,
      contextContract,
      temporalMode: contextContract.temporalMode,
    },
  };
}
