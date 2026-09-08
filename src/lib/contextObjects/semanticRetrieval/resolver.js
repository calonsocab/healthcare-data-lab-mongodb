import { buildProcessedQueryIntent } from './intentProcessor.js';
import { validateSemanticContractCandidate } from './contractValidator.js';
import { classifyResolverConfidence } from './confidence.js';
import { renderOpenEhrQueryContractAql } from '../openehrSemanticArtifacts.js';
import { allowsExecutionTarget, extractSemanticContract } from '../contextContract.js';

const STOP_TOKENS = new Set([
  'patient',
  'patients',
  'with',
  'last',
  'in',
  'the',
  'and',
  'or',
  'a',
  'an',
  'during',
  'show',
  'find',
  'list',
  'measured',
  'measurement'
]);

const POLICY_TERMS = ['fever', 'febrile', 'pyrexia', 'tachycardia', 'hypotension', 'hypertension', 'abnormal result'];
const UNIT_ALIASES = {
  '/d': ['per day', 'a day', 'daily', 'times a day', 'times per day'],
  '/wk': ['per week', 'a week', 'weekly', 'times a week', 'times per week'],
  '/mo': ['per month', 'a month', 'monthly', 'times a month', 'times per month'],
  '/h': ['per hour', 'an hour', 'hourly', 'times an hour', 'times per hour'],
  'gm/d': ['grams per day', 'g per day', 'gm per day'],
  'gm/wk': ['grams per week', 'g per week', 'gm per week'],
  'Cel': ['celsius', 'degrees c', 'temperature c']
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9%[\]\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(values = []) {
  return Array.from(
    new Set(
      asArray(values)
        .flatMap((value) => normalizeText(value).split(' '))
        .map((token) => token.trim())
        .filter((token) => token && token.length > 1 && !STOP_TOKENS.has(token))
    )
  );
}

function scoreTokenOverlap(queryTokens, candidateTokens) {
  if (!queryTokens.length || !candidateTokens.length) return 0;
  const candidateSet = new Set(candidateTokens);
  const overlap = queryTokens.filter((token) => candidateSet.has(token)).length;
  return overlap / Math.max(queryTokens.length, candidateTokens.length);
}

function scorePhrasePresence(normalizedQuery, candidateValues = []) {
  return asArray(candidateValues).reduce((best, value) => {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) return best;
    if (normalizedQuery === normalizedValue) return 1;
    if (normalizedQuery.includes(normalizedValue) || normalizedValue.includes(normalizedQuery)) return Math.max(best, 0.9);
    return best;
  }, 0);
}

function findContract(contractCatalog, contractId) {
  return asArray(contractCatalog).find((contract) => (
    contract?.contractId === contractId || contract?.id === contractId
  )) || null;
}

function findSemanticUnit(semanticUnits, semanticUnitId) {
  return asArray(semanticUnits).find((unit) => (
    unit?.semanticUnitId === semanticUnitId || unit?.id === semanticUnitId
  )) || null;
}

function getContractSemanticUnit(contract, semanticUnits) {
  const semanticUnitId = contract?.bindings?.[0]?.semanticUnitId;
  return semanticUnitId ? findSemanticUnit(semanticUnits, semanticUnitId) : null;
}

function hasExplicitNumericConstraint(intent) {
  return (intent?.operators || []).length > 0 || (intent?.values || []).length > 0;
}

function hasExplicitNumericRange(intent) {
  return Number.isFinite(intent?.range?.minValue) && Number.isFinite(intent?.range?.maxValue);
}

function expandUnitAliases(units = []) {
  return asArray(units).flatMap((unit) => [unit, ...(UNIT_ALIASES[unit] || [])]);
}

function buildQueryTokens(intent) {
  return tokenize([
    ...(intent?.terms || []),
    ...(intent?.measurements || []),
    ...(intent?.units || []),
    intent?.aggregation?.type || ''
  ]);
}

function buildSemanticContextValues(semanticUnit) {
  return [
    semanticUnit?.label,
    semanticUnit?.description,
    ...asArray(semanticUnit?.parentChain).flatMap((parent) => [parent?.name, parent?.nodeId]),
    ...asArray(semanticUnit?.containmentChain).flatMap((container) => [container?.name, container?.nodeId]),
    ...asArray(semanticUnit?.termBindings).flatMap((binding) => [binding?.system, binding?.code, binding?.target]),
    ...expandUnitAliases(semanticUnit?.allowedUnits)
  ].filter(Boolean);
}

function hasSemanticContractInput(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.keys(value).length > 0
      || value?.semanticContract
    );
}

function buildSemanticContractValues(semanticContract) {
  if (!semanticContract) return [];
  return [
    semanticContract?.subject,
    semanticContract?.focus,
    semanticContract?.intent,
    semanticContract?.contractType,
    semanticContract?.resultShape
  ].filter(Boolean);
}

function scoreSemanticLabelBoost(intent, semanticUnit) {
  const normalizedQuery = intent?.normalizedText || '';
  const labelValues = [semanticUnit?.label, semanticUnit?.description].filter(Boolean);
  const contextValues = [
    ...asArray(semanticUnit?.parentChain).map((parent) => parent?.name),
    ...asArray(semanticUnit?.containmentChain).map((container) => container?.name)
  ].filter(Boolean);

  const labelPhrase = scorePhrasePresence(normalizedQuery, labelValues);
  const contextPhrase = scorePhrasePresence(normalizedQuery, contextValues);

  let boost = 0;
  if (labelPhrase >= 0.9) boost += 0.14;
  else if (labelPhrase >= 0.6) boost += 0.08;

  if (contextPhrase >= 0.9) boost += 0.05;
  return boost;
}

function getContractKindBoost(contractKind, intent, semanticUnit) {
  if (!contractKind) return 0;
  const explicitNumericConstraint = hasExplicitNumericConstraint(intent);
  const explicitNumericRange = hasExplicitNumericRange(intent);
  const explicitOperator = (intent?.operators || []).length > 0;
  const aggregationType = intent?.aggregation?.type || '';
  let boost = 0;

  if (!explicitNumericConstraint) {
    if (aggregationType === 'average' && contractKind === 'numeric_average') boost += 0.18;
    if (aggregationType === 'min' && contractKind === 'numeric_min') boost += 0.18;
    if (aggregationType === 'max' && contractKind === 'numeric_max') boost += 0.18;
  }

  if (intent?.intentKind === 'latest' && contractKind === 'latest_event') boost += 0.16;

  if (explicitNumericRange) {
    if (contractKind === 'numeric_range') boost += 0.3;
    if (['numeric_threshold', 'count_threshold'].includes(contractKind)) boost -= 0.18;
    if (['numeric_average', 'numeric_min', 'numeric_max'].includes(contractKind)) boost -= 0.1;
  } else if (explicitOperator) {
    if (['numeric_threshold', 'count_threshold'].includes(contractKind)) boost += 0.26;
    if (contractKind === 'numeric_range') boost -= 0.08;
    if (['numeric_average', 'numeric_min', 'numeric_max'].includes(contractKind)) boost -= 0.12;
  } else if (explicitNumericConstraint && ['numeric_threshold', 'count_threshold', 'numeric_range'].includes(contractKind)) {
    boost += 0.18;
  }

  if (!explicitNumericRange && explicitNumericConstraint && ['numeric_average', 'numeric_min', 'numeric_max'].includes(contractKind)) {
    boost -= 0.08;
  }

  if (!intent?.operators?.length && ['coded_equals', 'exists', 'latest_event'].includes(contractKind)) {
    boost += 0.05;
  }

  if (
    explicitNumericConstraint
    && aggregationType === 'average'
    && /\baverage\b/i.test(semanticUnit?.label || '')
    && ['numeric_threshold', 'count_threshold'].includes(contractKind)
  ) {
    boost += 0.08;
  }

  return boost;
}

function scoreQueryShape(shape, contract, semanticUnit, intent, semanticContract) {
  const queryTokens = buildQueryTokens(intent);
  const semanticContextValues = buildSemanticContextValues(semanticUnit);
  const semanticContractValues = buildSemanticContractValues(semanticContract);
  const candidateValues = [
    shape?.normalizedShape,
    shape?.text,
    contract?.label,
    contract?.description,
    semanticUnit?.label,
    semanticUnit?.description,
    ...semanticContextValues,
    ...semanticContractValues
  ];
  const candidateTokens = tokenize(candidateValues);
  const overlap = scoreTokenOverlap(queryTokens, candidateTokens);
  const phrase = scorePhrasePresence(intent?.normalizedText || '', candidateValues);
  const unitBoost = intent?.units?.some((unit) => asArray(semanticUnit?.allowedUnits).includes(unit)) ? 0.1 : 0;
  const measurementBoost = (intent?.measurements || []).some((measurement) => (
    scorePhrasePresence(measurement, semanticContextValues) >= 0.9
  )) ? 0.14 : 0;
  const semanticLabelBoost = scoreSemanticLabelBoost(intent, semanticUnit);
  const contractBoost = getContractKindBoost(contract?.contractKind, intent, semanticUnit);
  return Math.min(1, Math.max(0, overlap * 0.5 + phrase * 0.22 + unitBoost + measurementBoost + semanticLabelBoost + contractBoost + (shape?.role === 'doctor' ? 0.05 : 0)));
}

function buildTerminologyValues(entry, semanticUnit) {
  return [
    ...(entry?.sourceLabels || []),
    ...Object.values(entry?.localizedLabels || {}),
    ...(entry?.descriptions || []),
    ...Object.values(entry?.localizedDescriptions || {}),
    ...(entry?.codedValues || []).flatMap((option) => [
      option?.code,
      option?.label,
      option?.description,
      ...Object.values(option?.localizedLabels || {}),
      ...Object.values(option?.localizedDescriptions || {})
    ]),
    ...(semanticUnit?.allowedUnits || []),
    ...(entry?.unitAliases || []),
    ...(entry?.approvedSynonyms || []),
    ...(entry?.approvedTranslations || []),
    ...buildSemanticContextValues(semanticUnit)
  ].filter(Boolean);
}

function scoreSemanticUnit(entry, semanticUnit, intent, semanticContract) {
  const queryTokens = buildQueryTokens(intent);
  const candidateValues = [
    ...buildTerminologyValues(entry, semanticUnit),
    ...buildSemanticContractValues(semanticContract)
  ];
  const candidateTokens = tokenize(candidateValues);
  const overlap = scoreTokenOverlap(queryTokens, candidateTokens);
  const phrase = scorePhrasePresence(intent?.normalizedText || '', candidateValues);
  const codedBoost = asArray(entry?.codedValues).some((option) => {
    const optionValues = [
      option?.code,
      option?.label,
      option?.description,
      ...Object.values(option?.localizedLabels || {}),
      ...Object.values(option?.localizedDescriptions || {})
    ].filter(Boolean);
    return scorePhrasePresence(intent?.normalizedText || '', optionValues) >= 0.9;
  }) ? 0.12 : 0;
  const measurementBoost = (intent?.measurements || []).some((measurement) => (
    scorePhrasePresence(measurement, candidateValues) >= 0.9
  )) ? 0.14 : 0;
  const semanticLabelBoost = scoreSemanticLabelBoost(intent, semanticUnit);

  return Math.min(1, Math.max(0, overlap * 0.58 + phrase * 0.22 + codedBoost + measurementBoost + semanticLabelBoost));
}

function normalizeOperator(operator) {
  switch (`${operator || ''}`.trim()) {
    case '>':
    case '>=':
    case '<':
    case '<=':
    case '=':
      return operator;
    default:
      return '>=';
  }
}

function matchCodedOptions(semanticUnit, normalizedQuery) {
  const codedOptions = asArray(semanticUnit?.codedOptions);
  const exactMatches = codedOptions.filter((option) => {
    const values = [
      option?.code,
      option?.label,
      option?.description,
      ...Object.values(option?.localizedLabels || {}),
      ...Object.values(option?.localizedDescriptions || {})
    ].filter(Boolean);
    return scorePhrasePresence(normalizedQuery, values) >= 0.9;
  });

  if (exactMatches.length > 0) return exactMatches;

  return codedOptions.filter((option) => {
    const values = tokenize([
      option?.code,
      option?.label,
      option?.description,
      ...Object.values(option?.localizedLabels || {}),
      ...Object.values(option?.localizedDescriptions || {})
    ]);
    return scoreTokenOverlap(tokenize([normalizedQuery]), values) > 0.34;
  });
}

function deriveCandidateParams(contract, semanticUnit, intent) {
  const contractKind = contract?.contractKind;
  const measurementNumbers = intent?.extraction?.measurementNumbers || intent?.extraction?.numbers || [];
  const firstNumber = measurementNumbers[0];
  const secondNumber = measurementNumbers[1];
  const firstTimeWindow = intent?.time?.durationIso || intent?.extraction?.timeWindows?.[0]?.durationIso || '';
  const firstCalendarPeriod = (intent?.time?.from && intent?.time?.to)
    ? intent.time
    : intent?.extraction?.calendarPeriods?.[0] || null;
  const numericRange = intent?.range || intent?.extraction?.range || null;
  const firstUnit = intent?.units?.[0] || numericRange?.unit || '';
  const params = {};
  const applyTimeFilter = () => {
    if (firstTimeWindow) {
      params.timeWindow = firstTimeWindow;
      return;
    }
    if (firstCalendarPeriod?.from && firstCalendarPeriod?.to) {
      params.timeFrom = firstCalendarPeriod.from;
      params.timeTo = firstCalendarPeriod.to;
    }
  };

  if (['numeric_threshold', 'count_threshold'].includes(contractKind)) {
    if (numericRange && !(intent?.operators || []).length) {
      applyTimeFilter();
      params.limit = 25;
      return params;
    }
    params.operator = normalizeOperator(intent?.operators?.[0] || '>');
    params.value = firstNumber?.value;
    params.unit = firstUnit || (semanticUnit?.allowedUnits?.length === 1 ? semanticUnit.allowedUnits[0] : '');
    applyTimeFilter();
    params.limit = 25;
  } else if (contractKind === 'numeric_range') {
    params.minValue = numericRange?.minValue ?? firstNumber?.value;
    params.maxValue = numericRange?.maxValue ?? secondNumber?.value;
    params.unit = firstUnit || (semanticUnit?.allowedUnits?.length === 1 ? semanticUnit.allowedUnits[0] : '');
    applyTimeFilter();
    params.limit = 25;
  } else if (contractKind === 'coded_equals') {
    const matches = matchCodedOptions(semanticUnit, intent?.normalizedText || '');
    params.value = matches[0]?.code || matches[0]?.label || '';
    applyTimeFilter();
    params.limit = 25;
  } else if (contractKind === 'coded_in') {
    const matches = matchCodedOptions(semanticUnit, intent?.normalizedText || '');
    params.values = matches.map((match) => match.code || match.label).filter(Boolean);
    applyTimeFilter();
    params.limit = 25;
  } else if (contractKind === 'text_contains' || contractKind === 'text_equals') {
    params.value = intent?.terms?.[0] || '';
    applyTimeFilter();
    params.limit = 25;
  } else if (contractKind === 'datetime_during') {
    params.from = firstCalendarPeriod?.from || '';
    params.to = firstCalendarPeriod?.to || '';
  } else if (['exists', 'latest_event', 'numeric_average', 'numeric_min', 'numeric_max', 'count_events', 'numeric_latest'].includes(contractKind)) {
    applyTimeFilter();
    params.limit = 25;
  }

  return params;
}

function buildShapeCandidates({ queryShapeLibrary, contractCatalog, semanticUnits, intent, semanticContract }) {
  return asArray(queryShapeLibrary)
    .map((shape) => {
      const contract = findContract(contractCatalog, shape?.contractId);
      if (!contract) return null;
      const semanticUnit = getContractSemanticUnit(contract, semanticUnits);
      const score = scoreQueryShape(shape, contract, semanticUnit, intent, semanticContract);
      if (score <= 0.25) return null;

      const params = deriveCandidateParams(contract, semanticUnit, intent);
      const validation = validateSemanticContractCandidate({ contract, semanticUnit, params });

      return {
        route: 'query_shape',
        score,
        queryShapeId: shape?.queryShapeId || shape?.id || '',
        queryShapeText: shape?.text || '',
        semanticUnitId: semanticUnit?.semanticUnitId || '',
        contractId: contract?.contractId || contract?.id || '',
        contractKind: contract?.contractKind || contract?.kind || '',
        contractLabel: contract?.label || '',
        semanticUnitLabel: semanticUnit?.label || '',
        params,
        validation
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

function buildSemanticUnitCandidates({ terminologySurface, contractCatalog, semanticUnits, intent, semanticContract }) {
  return asArray(terminologySurface)
    .map((entry) => {
      const semanticUnit = findSemanticUnit(semanticUnits, entry?.semanticUnitId);
      if (!semanticUnit) return [];

      const baseScore = scoreSemanticUnit(entry, semanticUnit, intent, semanticContract);
      if (baseScore <= 0.22) return [];

      return asArray(entry?.contractIds)
        .map((contractId) => {
          const contract = findContract(contractCatalog, contractId);
          if (!contract) return null;

          const score = Math.min(1, Math.max(0, baseScore + getContractKindBoost(contract?.contractKind, intent, semanticUnit)));
          const params = deriveCandidateParams(contract, semanticUnit, intent);
          const validation = validateSemanticContractCandidate({ contract, semanticUnit, params });

          return {
            route: 'semantic_unit',
            score,
            queryShapeId: '',
            queryShapeText: '',
            semanticUnitId: semanticUnit?.semanticUnitId || '',
            contractId: contract?.contractId || contract?.id || '',
            contractKind: contract?.contractKind || contract?.kind || '',
            contractLabel: contract?.label || '',
            semanticUnitLabel: semanticUnit?.label || '',
            params,
            validation
          };
        })
        .filter(Boolean);
    })
    .flat()
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.contractId}:${candidate.semanticUnitId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSupervisionPackage({ question, intent, candidates, decision }) {
  return {
    rawQuestion: question,
    processedIntent: intent,
    candidateContracts: candidates.slice(0, 5).map((candidate) => ({
      contractId: candidate.contractId,
      semanticUnitId: candidate.semanticUnitId,
      score: candidate.score,
      route: candidate.route
    })),
    candidateSemanticUnits: candidates.slice(0, 5).map((candidate) => ({
      semanticUnitId: candidate.semanticUnitId,
      label: candidate.semanticUnitLabel,
      score: candidate.score
    })),
    reason: decision,
    suggestedAction: decision === 'confirm_policy'
      ? 'create_policy_contract'
      : candidates.length > 0
        ? 'map_to_existing_contract'
        : 'reject'
  };
}

export function resolveSemanticRetrievalQuestion({
  question,
  queryShapeLibrary,
  contractCatalog,
  semanticUnits,
  terminologySurface,
  contextContract,
  semanticContract: providedSemanticContract,
  now = new Date().toISOString()
} = {}) {
  const resolvedNow = now instanceof Date ? now : new Date(now || Date.now());
  const resolvedSemanticContract = hasSemanticContractInput(providedSemanticContract || contextContract)
    ? extractSemanticContract(providedSemanticContract || contextContract, 'context_object')
    : null;
  const intent = buildProcessedQueryIntent(question || '', {
    now: Number.isFinite(resolvedNow.getTime()) ? resolvedNow : new Date()
  });
  const hasPolicyTrigger = POLICY_TERMS.some((term) => intent.normalizedText.includes(term));

  const shapeCandidates = buildShapeCandidates({
    queryShapeLibrary,
    contractCatalog,
    semanticUnits,
    intent,
    semanticContract: resolvedSemanticContract
  });
  const semanticUnitCandidates = buildSemanticUnitCandidates({
    terminologySurface,
    contractCatalog,
    semanticUnits,
    intent,
    semanticContract: resolvedSemanticContract
  });
  const combinedCandidates = dedupeCandidates([...shapeCandidates, ...semanticUnitCandidates])
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
  const bestCandidate = combinedCandidates[0] || null;
  const secondCandidate = combinedCandidates[1] || null;
  const bestContract = bestCandidate ? findContract(contractCatalog, bestCandidate.contractId) : null;
  const bestSemanticUnit = bestCandidate ? findSemanticUnit(semanticUnits, bestCandidate.semanticUnitId) : null;
  const validation = bestCandidate?.validation || { valid: false, errors: ['no_candidate'] };
  const confidence = classifyResolverConfidence({
    topScore: bestCandidate?.score || 0,
    secondScore: secondCandidate?.score || 0,
    validation,
    hasPolicyTrigger,
    hasExplicitMeasurement: (intent.measurements || []).length > 0,
    bestCandidate
  });

  let renderedAql = '';
  let renderedAqlError = '';
  const aqlAllowed = !resolvedSemanticContract || allowsExecutionTarget(resolvedSemanticContract, 'aql', 'context_object');
  if (bestContract && validation.valid && aqlAllowed) {
    try {
      renderedAql = renderOpenEhrQueryContractAql(bestContract, {
        ...bestCandidate.params,
        _now: now
      });
    } catch (error) {
      renderedAqlError = error.message || 'Failed to render AQL';
    }
  } else if (bestContract && validation.valid && !aqlAllowed) {
    renderedAqlError = 'Semantic contract executionTargets do not allow AQL rendering for this ContextObject.';
  }

  return {
    rawQuestion: question || '',
    semanticContract: resolvedSemanticContract,
    normalizedQuery: intent.extraction,
    processedIntent: intent,
    retrieval: {
      exactQueryShapeMatches: shapeCandidates.filter((candidate) => candidate.score >= 0.95),
      lexicalQueryShapeMatches: shapeCandidates,
      semanticUnitMatches: semanticUnitCandidates,
      policyMatches: hasPolicyTrigger ? [{ label: 'policy_term_detected', terms: POLICY_TERMS.filter((term) => intent.normalizedText.includes(term)) }] : []
    },
    candidates: combinedCandidates,
    bestCandidate: bestCandidate ? {
      ...bestCandidate,
      contract: bestContract,
      semanticUnit: bestSemanticUnit
    } : null,
    confidence,
    renderedAql,
    renderedAqlError,
    supervisionPackage: confidence.decision === 'auto_execute'
      ? null
      : buildSupervisionPackage({
        question,
        intent,
        candidates: combinedCandidates,
        decision: confidence.decision
      })
  };
}
