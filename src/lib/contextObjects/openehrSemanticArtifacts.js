import { allowsExecutionTarget, normalizeContextContract } from './contextContract.js';

function isObjectRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function uniqueBy(items = [], getKey = (value) => value) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slugify(value, fallback = 'artifact') {
  const raw = `${value || ''}`.trim().toLowerCase();
  const normalized = raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

function shortHash(value) {
  const text = `${value || ''}`;
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function toArtifactId(prefix, seed) {
  return `${prefix}_${slugify(seed, prefix)}_${shortHash(seed)}`;
}

function normalizeOccurrences(node) {
  const min = Number.isFinite(node?.min) ? Math.max(0, Math.trunc(node.min)) : 0;
  const maxRaw = node?.max;
  if (maxRaw === -1 || maxRaw === '-1' || maxRaw === '*') {
    return { min, max: '*' };
  }
  if (Number.isFinite(maxRaw)) {
    return { min, max: Math.max(min, Math.trunc(maxRaw)) };
  }
  if (typeof maxRaw === 'string' && /^\d+$/.test(maxRaw.trim())) {
    return { min, max: Math.max(min, Number(maxRaw.trim())) };
  }
  return { min, max: 1 };
}

function resolveNativeTemplateEnvelope(definition) {
  if (!isObjectRecord(definition)) return null;
  const nativeDefinition = definition?.sourceModel?.nativeDefinition;
  if (isObjectRecord(nativeDefinition)) return nativeDefinition;
  if (isObjectRecord(definition?.root)) return definition.root;
  return null;
}

function resolveNativeTemplateRoot(definition) {
  const nativeTemplate = resolveNativeTemplateEnvelope(definition);
  if (!nativeTemplate) return null;
  if (isObjectRecord(nativeTemplate?.tree)) return nativeTemplate.tree;
  return nativeTemplate;
}

export function isOpenEhrContextObjectDefinition(definition) {
  const root = resolveNativeTemplateRoot(definition);
  if (!root) return false;

  const rmType = asNonEmptyString(root?.rmType).toUpperCase();
  return Boolean(
    asNonEmptyString(definition?.sourceModel?.family).toLowerCase() === 'openehr'
    || /^openEHR-/i.test(asNonEmptyString(root?.nodeId))
    || ['COMPOSITION', 'OBSERVATION', 'EVALUATION', 'ACTION', 'INSTRUCTION', 'ADMIN_ENTRY'].includes(rmType)
  );
}

function inferSourceType(definition) {
  const sourceFormat = asNonEmptyString(definition?.sourceModel?.sourceFormat).toUpperCase();
  if (sourceFormat.includes('OPT')) return 'openEHR-opt';
  return 'openEHR-webtemplate';
}

function pickNodeName(node, fallback) {
  return asNonEmptyString(node?.localizedName)
    || asNonEmptyString(node?.localizedNames?.en)
    || asNonEmptyString(node?.name)
    || asNonEmptyString(node?.label)
    || fallback;
}

function pickNodeDescription(node, defaultLanguage = 'en') {
  return asNonEmptyString(node?.description)
    || asNonEmptyString(node?.localizedDescriptions?.[defaultLanguage])
    || asNonEmptyString(node?.localizedDescriptions?.en)
    || '';
}

function normalizeLocalizedLabels(node, defaultLanguage = 'en', fallback = '') {
  const labels = isObjectRecord(node?.localizedNames) ? { ...node.localizedNames } : {};
  const explicit = asNonEmptyString(node?.localizedName);
  if (explicit) {
    labels[defaultLanguage] = labels[defaultLanguage] || explicit;
  }

  const name = pickNodeName(node, fallback);
  if (name && !labels[defaultLanguage]) {
    labels[defaultLanguage] = name;
  }

  return labels;
}

function normalizeLocalizedDescriptions(node, defaultLanguage = 'en') {
  const descriptions = isObjectRecord(node?.localizedDescriptions) ? { ...node.localizedDescriptions } : {};
  const description = pickNodeDescription(node, defaultLanguage);
  if (description && !descriptions[defaultLanguage]) {
    descriptions[defaultLanguage] = description;
  }
  return descriptions;
}

function normalizeTermBindings(termBindings) {
  if (Array.isArray(termBindings)) {
    return uniqueBy(
      termBindings
        .map((binding) => {
          if (!isObjectRecord(binding)) return null;
          return {
            system: asNonEmptyString(binding?.system || binding?.terminology || binding?.name),
            code: asNonEmptyString(binding?.code || binding?.value || binding?.target),
            target: asNonEmptyString(binding?.target || binding?.uri)
          };
        })
        .filter((binding) => binding && (binding.system || binding.code || binding.target)),
      (binding) => `${binding.system}:${binding.code}:${binding.target}`
    );
  }

  if (isObjectRecord(termBindings)) {
    return Object.entries(termBindings).flatMap(([system, rawValue]) => {
      if (Array.isArray(rawValue)) {
        return rawValue
          .map((entry) => {
            if (typeof entry === 'string') {
              return { system, code: asNonEmptyString(entry), target: '' };
            }
            if (isObjectRecord(entry)) {
              return {
                system,
                code: asNonEmptyString(entry?.code || entry?.value || entry?.target),
                target: asNonEmptyString(entry?.target || entry?.uri)
              };
            }
            return null;
          })
          .filter(Boolean);
      }

      if (typeof rawValue === 'string') {
        return [{ system, code: asNonEmptyString(rawValue), target: '' }];
      }

      if (isObjectRecord(rawValue)) {
        return [{
          system,
          code: asNonEmptyString(rawValue?.code || rawValue?.value || rawValue?.target),
          target: asNonEmptyString(rawValue?.target || rawValue?.uri)
        }];
      }

      return [];
    });
  }

  return [];
}

function normalizeCodedOptions(node) {
  const inputs = Array.isArray(node?.inputs) ? node.inputs : [];
  const rows = inputs.flatMap((input) => {
    const list = Array.isArray(input?.list) ? input.list : [];
    return list.map((item, index) => ({
      code: asNonEmptyString(item?.value || item?.code || item?.id || item?.label || `${index + 1}`),
      label: asNonEmptyString(item?.label || item?.value || item?.code || item?.id || `${index + 1}`),
      description: asNonEmptyString(item?.description || item?.localizedDescriptions?.en),
      localizedLabels: isObjectRecord(item?.localizedLabels) ? item.localizedLabels : {},
      localizedDescriptions: isObjectRecord(item?.localizedDescriptions) ? item.localizedDescriptions : {}
    }));
  });

  return uniqueBy(
    rows.filter((row) => row.code || row.label),
    (row) => `${row.code}:${row.label}`
  );
}

function findInputBySuffix(node, suffix) {
  const normalizedSuffix = asNonEmptyString(suffix).toLowerCase();
  return (Array.isArray(node?.inputs) ? node.inputs : []).find((input) => (
    asNonEmptyString(input?.suffix).toLowerCase() === normalizedSuffix
  )) || null;
}

function humanizeSuffix(suffix) {
  const raw = asNonEmptyString(suffix).replace(/[_-]+/g, ' ');
  if (!raw) return 'value';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function mapRmTypeToValueKind(rmType) {
  const normalized = asNonEmptyString(rmType).toUpperCase();
  switch (normalized) {
    case 'DV_QUANTITY':
      return 'quantity';
    case 'DV_COUNT':
      return 'count';
    case 'DV_CODED_TEXT':
    case 'DV_ORDINAL':
    case 'CODE_PHRASE':
      return 'coded';
    case 'DV_TEXT':
    case 'DV_IDENTIFIER':
    case 'DV_URI':
      return 'text';
    case 'DV_BOOLEAN':
      return 'boolean';
    case 'DV_DATE':
    case 'DV_DATE_TIME':
    case 'DV_TIME':
      return 'datetime';
    case 'PARTY_PROXY':
      return 'party';
    default:
      return '';
  }
}

function mapInputTypeToValueKind(inputType) {
  const normalized = asNonEmptyString(inputType).toUpperCase();
  switch (normalized) {
    case 'DECIMAL':
      return 'quantity';
    case 'INTEGER':
      return 'count';
    case 'BOOLEAN':
      return 'boolean';
    case 'DATE':
    case 'DATETIME':
    case 'TIME':
      return 'datetime';
    case 'CODED_TEXT':
    case 'CODE_PHRASE':
      return 'coded';
    case 'TEXT':
    default:
      return 'text';
  }
}

function allowedOperatorsForValueKind(valueKind) {
  switch (valueKind) {
    case 'quantity':
    case 'count':
      return ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'exists', 'latest', 'avg', 'min', 'max'];
    case 'coded':
      return ['eq', 'in', 'neq', 'exists'];
    case 'text':
    case 'party':
    case 'context':
      return ['eq', 'contains', 'exists'];
    case 'datetime':
      return ['before', 'after', 'during', 'exists', 'latest'];
    case 'boolean':
      return ['eq', 'exists'];
    default:
      return ['exists'];
  }
}

function toQueryPath(aqlPath) {
  const raw = asNonEmptyString(aqlPath);
  if (!raw) return '';
  return raw.startsWith('c/') ? raw : `c${raw}`;
}

function appendQueryPath(basePath, relativePath) {
  const base = toQueryPath(basePath);
  const relative = asNonEmptyString(relativePath);
  if (!relative) return base;
  if (relative.startsWith('c/') || relative.startsWith('/')) {
    return toQueryPath(relative);
  }
  return `${base.replace(/\/$/, '')}/${relative.replace(/^\/+/, '')}`;
}

function getBindingTemplate(rmType, overrides = {}) {
  const normalized = asNonEmptyString(rmType).toUpperCase();
  const base = (() => {
    switch (normalized) {
      case 'DV_QUANTITY':
        return { valuePath: 'magnitude', unitPath: 'units', labelPath: '', timePath: '' };
      case 'DV_COUNT':
        return { valuePath: 'magnitude', unitPath: '', labelPath: '', timePath: '' };
      case 'DV_CODED_TEXT':
        return { valuePath: 'defining_code/code_string', unitPath: '', labelPath: 'value', timePath: '' };
      case 'DV_ORDINAL':
        return { valuePath: 'defining_code/code_string', unitPath: '', labelPath: 'value', timePath: '' };
      case 'CODE_PHRASE':
        return { valuePath: 'code_string', unitPath: '', labelPath: '', timePath: '' };
      case 'DV_DATE':
      case 'DV_DATE_TIME':
      case 'DV_TIME':
      case 'DV_BOOLEAN':
      case 'DV_TEXT':
      case 'DV_IDENTIFIER':
      case 'DV_URI':
        return { valuePath: 'value', unitPath: '', labelPath: '', timePath: '' };
      case 'PARTY_PROXY':
        return { valuePath: '', unitPath: '', labelPath: '', timePath: '' };
      default:
        return { valuePath: 'value', unitPath: '', labelPath: '', timePath: '' };
    }
  })();

  return {
    ...base,
    ...overrides
  };
}

function computeNodeLineageId(pathSegments) {
  return pathSegments.length > 0 ? pathSegments.join('.') : 'root';
}

function collectTemplateNodes(root, defaultLanguage = 'en') {
  const records = [];

  function visit(node, ancestry = [], pathSegments = [], indexPath = []) {
    if (!isObjectRecord(node)) return;

    const name = pickNodeName(node, `Node ${indexPath.length || 1}`);
    const lineageId = computeNodeLineageId([...pathSegments, slugify(name, 'node')]);
    const recordId = toArtifactId(
      'node',
      `${node?.aqlPath || node?.id || node?.nodeId || lineageId}:${indexPath.join('.') || '1'}`
    );

    const localizedLabels = normalizeLocalizedLabels(node, defaultLanguage, name);
    const localizedDescriptions = normalizeLocalizedDescriptions(node, defaultLanguage);
    const occurrences = normalizeOccurrences(node);
    const inputs = Array.isArray(node?.inputs) ? node.inputs : [];
    const record = {
      id: recordId,
      sourceId: asNonEmptyString(node?.id) || null,
      nodeId: asNonEmptyString(node?.nodeId) || null,
      name,
      description: pickNodeDescription(node, defaultLanguage),
      localizedLabels,
      localizedDescriptions,
      rmType: asNonEmptyString(node?.rmType) || '',
      aqlPath: asNonEmptyString(node?.aqlPath) || '',
      occurrences,
      min: occurrences.min,
      max: occurrences.max,
      isRepeating: occurrences.max === '*' || (typeof occurrences.max === 'number' && occurrences.max > 1),
      inputs,
      codedOptions: normalizeCodedOptions(node),
      termBindings: normalizeTermBindings(node?.termBindings),
      dependsOn: Array.isArray(node?.dependsOn) ? node.dependsOn.filter(Boolean) : [],
      inContext: node?.inContext === true,
      annotations: isObjectRecord(node?.annotations) ? node.annotations : {},
      parentId: ancestry.length > 0 ? ancestry[ancestry.length - 1].id : null,
      ancestry: ancestry.map((ancestor) => ({
        id: ancestor.id,
        sourceId: ancestor.sourceId,
        nodeId: ancestor.nodeId,
        name: ancestor.name,
        rmType: ancestor.rmType,
        aqlPath: ancestor.aqlPath
      })),
      childrenIds: [],
      indexPath: indexPath.join('.') || '1'
    };

    records.push(record);

    const children = Array.isArray(node?.children) ? node.children : [];
    children.forEach((childNode, childIndex) => {
      visit(
        childNode,
        [...ancestry, record],
        [...pathSegments, slugify(name, 'node')],
        [...indexPath, childIndex + 1]
      );
    });
  }

  visit(root, [], [], [1]);

  const byId = new Map(records.map((record) => [record.id, record]));
  records.forEach((record) => {
    if (record.parentId && byId.has(record.parentId)) {
      byId.get(record.parentId).childrenIds.push(record.id);
    }
  });

  return records;
}

function isContextRecord(record) {
  const aqlPath = asNonEmptyString(record?.aqlPath);
  return (
    record?.inContext === true
    || /\/context\//i.test(aqlPath)
    || /^\/(language|territory|composer)$/i.test(aqlPath)
  );
}

function buildParentChain(record) {
  return (Array.isArray(record?.ancestry) ? record.ancestry : []).map((ancestor) => ({
    id: ancestor.id,
    name: ancestor.name,
    nodeId: ancestor.nodeId || null,
    aqlPath: ancestor.aqlPath || null,
    rmType: ancestor.rmType || null
  }));
}

const CONTAINMENT_RM_TYPES = new Set([
  'COMPOSITION',
  'SECTION',
  'OBSERVATION',
  'EVALUATION',
  'ACTION',
  'INSTRUCTION',
  'ADMIN_ENTRY',
  'CLUSTER',
  'ITEM_TREE',
  'ITEM_LIST',
  'ITEM_SINGLE',
  'HISTORY',
  'POINT_EVENT',
  'INTERVAL_EVENT'
]);

function buildContainmentChain(record) {
  const ancestry = Array.isArray(record?.ancestry) ? record.ancestry : [];
  return ancestry
    .filter((ancestor) => CONTAINMENT_RM_TYPES.has(asNonEmptyString(ancestor?.rmType).toUpperCase()))
    .map((ancestor) => ({
      name: ancestor.name,
      rmType: ancestor.rmType || null,
      nodeId: ancestor.nodeId || null,
      aqlPath: ancestor.aqlPath || null
    }));
}

function rankTemporalCandidate(record) {
  const path = asNonEmptyString(record?.aqlPath);
  let score = 0;
  if (/\/context\/start_time(?:\/value)?$/i.test(path)) score += 100;
  if (/\/events\[[^/]+\]\/time(?:\/value)?$/i.test(path)) score += 95;
  if (/\/time(?:\/value)?$/i.test(path)) score += 85;
  if (/\/origin(?:\/value)?$/i.test(path)) score += 75;
  if (['DV_DATE_TIME', 'DV_DATE', 'DV_TIME'].includes(asNonEmptyString(record?.rmType).toUpperCase())) score += 40;
  if (/time|date|origin/i.test(`${record?.name || ''} ${path}`)) score += 10;
  return score;
}

function guessDefaultTemporalRecord(records = []) {
  const ranked = records
    .map((record) => ({ record, score: rankTemporalCandidate(record) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.record.name.localeCompare(right.record.name));
  return ranked[0]?.record || null;
}

function extractAllowedUnits(record) {
  const unitInput = findInputBySuffix(record, 'units') || findInputBySuffix(record, 'unit');
  const options = Array.isArray(unitInput?.list) ? unitInput.list : [];
  return uniqueStrings(
    options.flatMap((option) => [
      asNonEmptyString(option?.label),
      asNonEmptyString(option?.value),
      asNonEmptyString(option?.code)
    ])
  );
}

function expandUnitAliases(units = []) {
  const aliasesByUnit = {
    '/d': ['per day', 'a day', 'daily', 'times a day', 'times per day'],
    '/wk': ['per week', 'a week', 'weekly', 'times a week', 'times per week'],
    '/mo': ['per month', 'a month', 'monthly', 'times a month', 'times per month'],
    '/h': ['per hour', 'an hour', 'hourly', 'times an hour', 'times per hour'],
    'gm/d': ['grams per day', 'g per day', 'gm per day'],
    'gm/wk': ['grams per week', 'g per week', 'gm per week'],
    'Cel': ['celsius', 'degrees c', 'temperature c']
  };

  return uniqueStrings(
    (Array.isArray(units) ? units : []).flatMap((unit) => [unit, ...(aliasesByUnit[unit] || [])])
  );
}

function resolveRecordValuePath(record) {
  const aqlPath = asNonEmptyString(record?.aqlPath);
  if (!aqlPath) return '';

  const binding = getBindingTemplate(record?.rmType);
  const basePath = toQueryPath(aqlPath);
  if (!binding?.valuePath) return basePath;
  if (basePath.endsWith(`/${binding.valuePath}`)) return basePath;
  return appendQueryPath(aqlPath, binding.valuePath);
}

function inferFallbackTemporalPath(record) {
  const ancestry = Array.isArray(record?.ancestry) ? record.ancestry : [];
  const temporalAncestor = [...ancestry].reverse().find((ancestor) => (
    ['POINT_EVENT', 'INTERVAL_EVENT', 'EVENT'].includes(asNonEmptyString(ancestor?.rmType).toUpperCase())
    && asNonEmptyString(ancestor?.aqlPath)
  ));
  if (temporalAncestor) {
    return appendQueryPath(temporalAncestor.aqlPath, 'time/value');
  }

  const historyAncestor = [...ancestry].reverse().find((ancestor) => (
    asNonEmptyString(ancestor?.rmType).toUpperCase() === 'HISTORY'
    && asNonEmptyString(ancestor?.aqlPath)
  ));
  if (historyAncestor) {
    return appendQueryPath(historyAncestor.aqlPath, 'origin/value');
  }

  const recordPath = asNonEmptyString(record?.aqlPath);
  if (recordPath && /^\/(?:content|context)/i.test(recordPath)) {
    return 'c/context/start_time/value';
  }

  return '';
}

function resolveDefaultTimePath(defaultTemporalRecord, record) {
  return resolveRecordValuePath(defaultTemporalRecord) || inferFallbackTemporalPath(record);
}

function buildPrimarySemanticUnit(record, templateId, sourceType, defaultLanguage, defaultTemporalRecord) {
  const rmType = asNonEmptyString(record?.rmType).toUpperCase();
  const valueKind = mapRmTypeToValueKind(rmType);
  if (!valueKind) return null;

  const isContext = isContextRecord(record);
  const effectiveValueKind = valueKind || (isContext ? 'context' : '');
  const binding = getBindingTemplate(rmType);
  const allowedUnits = valueKind === 'quantity' ? extractAllowedUnits(record) : [];
  const codedOptions = valueKind === 'coded' ? record.codedOptions || [] : [];
  const semanticUnitId = toArtifactId(
    'su',
    `${templateId}:${record?.aqlPath || record?.nodeId || record?.sourceId || record?.name}:${effectiveValueKind}`
  );

  return {
    semanticUnitId,
    templateId,
    sourceType,
    sourceNodeId: record?.nodeId || null,
    nodeId: record?.sourceId || record?.nodeId || null,
    nodePath: record?.indexPath || null,
    aqlPath: record?.aqlPath || null,
    label: record?.name || 'Unnamed field',
    localizedLabels: record?.localizedLabels || { [defaultLanguage]: record?.name || 'Unnamed field' },
    description: record?.description || '',
    localizedDescriptions: record?.localizedDescriptions || {},
    rmType,
    valueKind: isContext && !['quantity', 'count', 'coded', 'text', 'datetime', 'boolean', 'party'].includes(valueKind)
      ? 'context'
      : effectiveValueKind,
    temporalPrecision: ['DV_DATE', 'DV_DATE_TIME', 'DV_TIME'].includes(rmType)
      ? rmType.replace('DV_', '').toLowerCase()
      : '',
    inputs: record?.inputs || [],
    allowedOperators: allowedOperatorsForValueKind(effectiveValueKind || 'context'),
    allowedUnits,
    codedOptions,
    termBindings: record?.termBindings || [],
    dependsOn: record?.dependsOn || [],
    parentChain: buildParentChain(record),
    containmentChain: buildContainmentChain(record),
    annotations: record?.annotations || {},
    isContext,
    queryable: Boolean(record?.aqlPath),
    isRepeating: record?.isRepeating === true,
    binding,
    defaultTimePath: resolveDefaultTimePath(defaultTemporalRecord, record)
  };
}

function buildPartySemanticUnits(record, templateId, sourceType, defaultLanguage, defaultTemporalRecord) {
  if (asNonEmptyString(record?.rmType).toUpperCase() !== 'PARTY_PROXY') {
    return [];
  }

  const inputs = Array.isArray(record?.inputs) ? record.inputs : [];
  return inputs.map((input, index) => {
    const suffix = asNonEmptyString(input?.suffix) || `field_${index + 1}`;
    const semanticUnitId = toArtifactId(
      'su',
      `${templateId}:${record?.aqlPath || record?.nodeId || record?.name}:${suffix}`
    );

    return {
      semanticUnitId,
      templateId,
      sourceType,
      sourceNodeId: record?.nodeId || null,
      nodeId: record?.sourceId || record?.nodeId || null,
      nodePath: record?.indexPath || null,
      aqlPath: record?.aqlPath || null,
      label: `${record?.name || 'Party'} ${humanizeSuffix(suffix)}`,
      localizedLabels: {
        ...(record?.localizedLabels || {}),
        [defaultLanguage]: `${record?.name || 'Party'} ${humanizeSuffix(suffix)}`
      },
      description: record?.description || '',
      localizedDescriptions: record?.localizedDescriptions || {},
      rmType: 'PARTY_PROXY',
      valueKind: 'party',
      inputs: [input],
      allowedOperators: allowedOperatorsForValueKind('party'),
      allowedUnits: [],
      codedOptions: [],
      termBindings: record?.termBindings || [],
      dependsOn: record?.dependsOn || [],
      parentChain: buildParentChain(record),
      containmentChain: buildContainmentChain(record),
      annotations: record?.annotations || {},
      isContext: isContextRecord(record),
      queryable: Boolean(record?.aqlPath),
      isRepeating: record?.isRepeating === true,
      binding: getBindingTemplate('PARTY_PROXY', { valuePath: suffix }),
      defaultTimePath: resolveDefaultTimePath(defaultTemporalRecord, record)
    };
  });
}

function compileSemanticUnits(records, templateId, sourceType, defaultLanguage, defaultTemporalRecord) {
  const units = records.flatMap((record) => {
    const primary = buildPrimarySemanticUnit(record, templateId, sourceType, defaultLanguage, defaultTemporalRecord);
    const partyUnits = buildPartySemanticUnits(record, templateId, sourceType, defaultLanguage, defaultTemporalRecord);
    return [primary, ...partyUnits].filter(Boolean);
  });

  return uniqueBy(units, (unit) => unit.semanticUnitId).sort((left, right) => (
    (left.label || '').localeCompare(right.label || '')
    || (left.aqlPath || '').localeCompare(right.aqlPath || '')
  ));
}

function buildTerminologySurface(semanticUnits, sourceTemplate) {
  return semanticUnits.map((unit) => ({
    terminologyEntryId: toArtifactId('term', `${unit.semanticUnitId}:${unit.aqlPath || unit.label}`),
    semanticUnitId: unit.semanticUnitId,
    contractIds: [],
    templateId: unit.templateId,
    aqlPath: unit.aqlPath || null,
    archetypeId: sourceTemplate?.archetypeId || null,
    sourceLabels: uniqueStrings([unit.label, ...Object.values(unit.localizedLabels || {})]),
    localizedLabels: unit.localizedLabels || {},
    descriptions: uniqueStrings([unit.description, ...Object.values(unit.localizedDescriptions || {})]),
    localizedDescriptions: unit.localizedDescriptions || {},
    annotations: unit.annotations || {},
    nodeId: unit.nodeId || null,
    sourceNodeId: unit.sourceNodeId || null,
    termBindings: unit.termBindings || [],
    codedValues: (unit.codedOptions || []).map((option) => ({
      code: option.code,
      label: option.label,
      description: option.description || '',
      localizedLabels: option.localizedLabels || {},
      localizedDescriptions: option.localizedDescriptions || {}
    })),
    unitLabels: unit.allowedUnits || [],
    unitAliases: expandUnitAliases(unit.allowedUnits || []),
    approvedSynonyms: [],
    approvedTranslations: [],
    suggested: [],
    approved: [],
    rejected: []
  }));
}

function inferOperationForContractKind(contractKind) {
  switch (contractKind) {
    case 'numeric_threshold':
    case 'count_threshold':
      return 'threshold';
    case 'numeric_range':
      return 'range';
    case 'numeric_latest':
    case 'latest_event':
      return 'latest';
    case 'numeric_average':
      return 'average';
    case 'numeric_min':
      return 'minimum';
    case 'numeric_max':
      return 'maximum';
    case 'coded_equals':
    case 'text_equals':
      return 'equals';
    case 'coded_in':
      return 'membership';
    case 'coded_not_equals':
      return 'not_equals';
    case 'text_contains':
      return 'contains';
    case 'datetime_before':
      return 'before';
    case 'datetime_after':
      return 'after';
    case 'datetime_during':
      return 'during';
    case 'exists':
    case 'numeric_exists':
    case 'coded_exists':
      return 'exists';
    case 'missing':
      return 'missing';
    case 'count_events':
      return 'count_events';
    default:
      return contractKind;
  }
}

function buildContractParameterSchema(contractKind, semanticUnit) {
  switch (contractKind) {
    case 'numeric_threshold':
    case 'count_threshold':
      return {
        operator: 'enum',
        value: semanticUnit?.valueKind === 'count' ? 'integer' : 'number',
        unit: semanticUnit?.valueKind === 'quantity' ? 'optional_unit' : 'none',
        timeWindow: 'optional_time_window',
        limit: 'optional_limit'
      };
    case 'numeric_range':
      return {
        minValue: 'number',
        maxValue: 'number',
        unit: semanticUnit?.valueKind === 'quantity' ? 'optional_unit' : 'none',
        timeWindow: 'optional_time_window',
        limit: 'optional_limit'
      };
    case 'coded_equals':
    case 'coded_not_equals':
      return {
        value: 'coded_value',
        timeWindow: 'optional_time_window',
        limit: 'optional_limit'
      };
    case 'coded_in':
      return {
        values: 'coded_value_array',
        timeWindow: 'optional_time_window',
        limit: 'optional_limit'
      };
    case 'text_contains':
    case 'text_equals':
      return {
        value: 'text',
        timeWindow: 'optional_time_window',
        limit: 'optional_limit'
      };
    case 'datetime_before':
    case 'datetime_after':
      return {
        value: 'datetime'
      };
    case 'datetime_during':
      return {
        from: 'datetime',
        to: 'datetime'
      };
    case 'numeric_average':
    case 'numeric_min':
    case 'numeric_max':
      return {
        timeWindow: 'optional_time_window'
      };
    case 'numeric_latest':
    case 'latest_event':
      return {
        timeWindow: 'optional_time_window',
        limit: 'optional_limit'
      };
    case 'exists':
    case 'missing':
    case 'numeric_exists':
    case 'coded_exists':
      return {
        timeWindow: 'optional_time_window',
        limit: 'optional_limit'
      };
    case 'count_events':
      return {
        timeWindow: 'optional_time_window'
      };
    default:
      return {};
  }
}

function sampleValueForSemanticUnit(unit) {
  if (!unit) return null;
  if (unit.valueKind === 'quantity') {
    if ((unit.allowedUnits || []).includes('Cel')) return 38;
    if ((unit.allowedUnits || []).some((candidate) => ['/d', '/wk', '/mo', '/h'].includes(candidate))) return 3;
    return 10;
  }
  if (unit.valueKind === 'count') return 1;
  if (unit.valueKind === 'coded') return unit.codedOptions?.[0]?.code || unit.codedOptions?.[0]?.label || 'value';
  if (unit.valueKind === 'text' || unit.valueKind === 'party' || unit.valueKind === 'context') return unit.label || 'value';
  if (unit.valueKind === 'datetime') return new Date().toISOString();
  if (unit.valueKind === 'boolean') return true;
  return 'value';
}

function buildExampleParameters(contractKind, semanticUnit) {
  const sampleValue = sampleValueForSemanticUnit(semanticUnit);
  switch (contractKind) {
    case 'numeric_threshold':
    case 'count_threshold':
      return {
        operator: '>',
        value: sampleValue,
        unit: semanticUnit?.allowedUnits?.[0] || '',
        timeWindow: 'P1D',
        limit: 25
      };
    case 'numeric_range':
      return {
        minValue: Number(sampleValue) || 0,
        maxValue: (Number(sampleValue) || 0) + 5,
        unit: semanticUnit?.allowedUnits?.[0] || '',
        timeWindow: 'P1D',
        limit: 25
      };
    case 'coded_equals':
    case 'coded_not_equals':
      return {
        value: sampleValue,
        timeWindow: 'P1D',
        limit: 25
      };
    case 'coded_in':
      return {
        values: (semanticUnit?.codedOptions || []).slice(0, 2).map((option) => option.code || option.label),
        timeWindow: 'P1D',
        limit: 25
      };
    case 'text_contains':
    case 'text_equals':
      return {
        value: sampleValue,
        timeWindow: 'P1D',
        limit: 25
      };
    case 'datetime_before':
    case 'datetime_after':
      return {
        value: new Date().toISOString()
      };
    case 'datetime_during':
      return {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString()
      };
    case 'numeric_average':
    case 'numeric_min':
    case 'numeric_max':
    case 'numeric_latest':
    case 'latest_event':
    case 'exists':
    case 'missing':
    case 'numeric_exists':
    case 'coded_exists':
      return {
        timeWindow: 'P1D',
        limit: 25
      };
    case 'count_events':
      return {
        timeWindow: 'P1D'
      };
    default:
      return {};
  }
}

const RENDERABLE_CONTRACT_KINDS = new Set([
  'numeric_threshold',
  'numeric_range',
  'coded_equals',
  'coded_in',
  'exists',
  'datetime_during',
  'numeric_average',
  'latest_event'
]);

function resolveContractKindsForUnit(unit) {
  switch (unit?.valueKind) {
    case 'quantity':
      return [
        'numeric_threshold',
        'numeric_range',
        'numeric_latest',
        'numeric_average',
        'numeric_min',
        'numeric_max',
        'numeric_exists',
        'exists',
        'missing',
        'latest_event',
        'count_events'
      ];
    case 'count':
      return [
        'count_threshold',
        'numeric_range',
        'numeric_latest',
        'numeric_min',
        'numeric_max',
        'numeric_exists',
        'exists',
        'missing',
        'latest_event',
        'count_events'
      ];
    case 'coded':
      return [
        'coded_equals',
        'coded_in',
        'coded_not_equals',
        'coded_exists',
        'exists',
        'missing',
        'latest_event',
        'count_events'
      ];
    case 'text':
    case 'party':
    case 'context':
      return [
        'text_contains',
        'text_equals',
        'exists',
        'missing',
        'latest_event'
      ];
    case 'datetime':
      return [
        'datetime_before',
        'datetime_after',
        'datetime_during',
        'exists',
        'latest_event'
      ];
    case 'boolean':
      return ['exists', 'missing', 'latest_event'];
    default:
      return ['exists'];
  }
}

function buildContractBinding(templateId, semanticUnit) {
  return {
    source: 'openEHR',
    templateId,
    semanticUnitId: semanticUnit.semanticUnitId,
    aqlPath: semanticUnit.aqlPath || null,
    valuePath: semanticUnit.binding?.valuePath || null,
    unitPath: semanticUnit.binding?.unitPath || null,
    labelPath: semanticUnit.binding?.labelPath || null,
    timePath: semanticUnit.defaultTimePath || null,
    containmentChain: semanticUnit.containmentChain || []
  };
}

function buildContractLabel(contractKind, semanticUnit) {
  const base = semanticUnit?.label || 'Field';
  switch (contractKind) {
    case 'numeric_threshold':
      return `${base} threshold`;
    case 'numeric_range':
      return `${base} range`;
    case 'numeric_latest':
      return `${base} latest`;
    case 'numeric_average':
      return `${base} average`;
    case 'numeric_min':
      return `${base} minimum`;
    case 'numeric_max':
      return `${base} maximum`;
    case 'numeric_exists':
      return `${base} exists`;
    case 'count_threshold':
      return `${base} threshold`;
    case 'coded_equals':
      return `${base} equals`;
    case 'coded_in':
      return `${base} in list`;
    case 'coded_not_equals':
      return `${base} not equals`;
    case 'coded_exists':
      return `${base} coded exists`;
    case 'text_contains':
      return `${base} contains`;
    case 'text_equals':
      return `${base} equals`;
    case 'datetime_before':
      return `${base} before`;
    case 'datetime_after':
      return `${base} after`;
    case 'datetime_during':
      return `${base} during`;
    case 'latest_event':
      return `${base} latest event`;
    case 'count_events':
      return `${base} event count`;
    default:
      return `${base} ${contractKind.replace(/_/g, ' ')}`;
  }
}

function buildValidationRules(contractKind, semanticUnit) {
  const rules = [
    'semantic unit exists',
    'aqlPath exists'
  ];

  if (['numeric_threshold', 'numeric_range', 'numeric_average', 'numeric_min', 'numeric_max', 'count_threshold'].includes(contractKind)) {
    rules.push('value compatible with numeric type');
  }

  if (semanticUnit?.allowedUnits?.length) {
    rules.push('unit compatible with semantic unit');
  }

  if (semanticUnit?.codedOptions?.length) {
    rules.push('coded value allowed');
  }

  if (semanticUnit?.defaultTimePath) {
    rules.push('time predicate has valid time path');
  }

  return rules;
}

function buildContractCatalog(semanticUnits, templateId) {
  return semanticUnits
    .filter((unit) => unit?.queryable)
    .flatMap((unit) => resolveContractKindsForUnit(unit).map((contractKind) => ({
      contractId: toArtifactId('contract', `${templateId}:${unit.semanticUnitId}:${contractKind}`),
      contractKind,
      label: buildContractLabel(contractKind, unit),
      description: unit?.description || '',
      sourceIndependentCore: {
        valueKind: unit?.valueKind || 'context',
        operation: inferOperationForContractKind(contractKind),
        parameters: buildContractParameterSchema(contractKind, unit)
      },
      bindings: [buildContractBinding(templateId, unit)],
      validationRules: buildValidationRules(contractKind, unit),
      coverage: RENDERABLE_CONTRACT_KINDS.has(contractKind) ? 'covered' : 'derived',
      exampleParameters: buildExampleParameters(contractKind, unit)
    })))
    .sort((left, right) => left.label.localeCompare(right.label) || left.contractKind.localeCompare(right.contractKind));
}

function findSemanticUnitById(semanticUnits, semanticUnitId) {
  return semanticUnits.find((unit) => unit.semanticUnitId === semanticUnitId) || null;
}

function buildNormalizedShapeText(contract, semanticUnit) {
  const label = slugify(semanticUnit?.label || 'field', 'field').replace(/-/g, ' ');
  switch (contract?.contractKind) {
    case 'numeric_threshold':
    case 'count_threshold':
      return `patients with ${label} op value unit in last duration`;
    case 'numeric_range':
      return `patients with ${label} between x and y unit in last duration`;
    case 'coded_equals':
      return `patients with ${label} equals code in last duration`;
    case 'coded_in':
      return `patients with ${label} in code list in last duration`;
    case 'text_contains':
      return `patients with ${label} containing text in last duration`;
    case 'datetime_during':
      return `patients with ${label} during date range`;
    case 'numeric_average':
      return `average ${label} in last duration`;
    case 'latest_event':
      return `latest ${label} event`;
    default:
      return `patients with ${label} ${contract?.contractKind || 'condition'}`;
  }
}

function buildRoleShapeText(role, contract, semanticUnit) {
  const label = semanticUnit?.label || 'field';
  switch (contract?.contractKind) {
    case 'numeric_threshold':
    case 'count_threshold':
      if (role === 'patient') return `show me records where ${label} is above x unit in the last y`;
      return `patients with ${label} above x unit in the last y`;
    case 'numeric_range':
      if (role === 'researcher') return `cohort with ${label} between x and y unit in the last z`;
      return `patients with ${label} between x and y unit in the last z`;
    case 'coded_equals':
      return role === 'patient'
        ? `show me records where ${label} is value in the last y`
        : `patients with ${label} equal to value in the last y`;
    case 'coded_in':
      return `patients with ${label} in value list in the last y`;
    case 'text_contains':
      return `patients with ${label} containing text in the last y`;
    case 'text_equals':
      return `patients with ${label} equal to text in the last y`;
    case 'datetime_during':
      return `patients with ${label} during the period from x to y`;
    case 'numeric_average':
      return `${role === 'patient' ? 'show' : 'calculate'} average ${label} in the last y`;
    case 'latest_event':
      return `latest ${label} event`;
    case 'exists':
      return `patients with ${label} recorded in the last y`;
    default:
      return `patients with ${label}`;
  }
}

function tokenizeLabelText(value) {
  return `${value || ''}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isUserFacingSemanticUnitExampleEligible(semanticUnit) {
  const path = asNonEmptyString(semanticUnit?.aqlPath);
  const label = asNonEmptyString(semanticUnit?.label).toLowerCase();
  if (!path) return false;
  if (/^\/(category|composer|language|territory)$/i.test(path)) return false;
  if (/\/context\/(language|territory|setting|composer)(?:\/|$)/i.test(path)) return false;
  if (['category', 'tree', 'report id', 'status'].includes(label)) return false;
  return true;
}

function describeExampleTime(exampleParameters = {}) {
  if (asNonEmptyString(exampleParameters?.timeWindow) === 'P1D') return 'in the last 24 hours';
  if (asNonEmptyString(exampleParameters?.timeWindow) === 'P7D') return 'in the last 7 days';
  if (asNonEmptyString(exampleParameters?.timeWindow) === 'P30D') return 'in the last 30 days';
  if (asNonEmptyString(exampleParameters?.timeWindow)) return 'in the recent period';
  if (exampleParameters?.timeFrom && exampleParameters?.timeTo) return 'during the selected period';
  return '';
}

function describeThresholdOperator(operator) {
  switch (asNonEmptyString(operator)) {
    case '>=':
      return 'at least';
    case '<':
      return 'below';
    case '<=':
      return 'at most';
    case '=':
      return 'equal to';
    case '>':
    default:
      return 'above';
  }
}

function humanizeExampleUnit(unit) {
  switch (unit) {
    case '/d':
      return 'times a day';
    case '/wk':
      return 'times a week';
    case '/mo':
      return 'times a month';
    case '/h':
      return 'times an hour';
    case 'Cel':
      return 'C';
    default:
      return unit || '';
  }
}

function buildSemanticUnitExampleLabel(semanticUnit) {
  const label = asNonEmptyString(semanticUnit?.label) || 'field';
  const ancestry = Array.isArray(semanticUnit?.parentChain) ? semanticUnit.parentChain : [];
  const contextualAncestors = ancestry
    .filter((ancestor) => ancestor?.name && !['tree', 'item tree'].includes(`${ancestor.name}`.trim().toLowerCase()))
    .map((ancestor) => ancestor.name);
  const primaryContext = contextualAncestors[contextualAncestors.length - 1];
  const labelTokens = new Set(tokenizeLabelText(label));
  const contextTokens = tokenizeLabelText(primaryContext);
  if (!primaryContext || primaryContext.toLowerCase() === label.toLowerCase()) {
    return label;
  }
  if (contextTokens.some((token) => labelTokens.has(token))) {
    return label;
  }
  return `${primaryContext} ${label}`;
}

function buildConcreteExampleText(contract, semanticUnit, role, exampleParameters = {}) {
  const label = buildSemanticUnitExampleLabel(semanticUnit);
  const value = exampleParameters?.value;
  const unit = humanizeExampleUnit(exampleParameters?.unit || '');
  const timeClause = describeExampleTime(exampleParameters);
  const codedValue = Array.isArray(exampleParameters?.values)
    ? exampleParameters.values.filter(Boolean).join(' or ')
    : asNonEmptyString(exampleParameters?.value);

  switch (contract?.contractKind) {
    case 'numeric_threshold':
    case 'count_threshold':
      return [
        role === 'patient' ? 'show me records with' : 'patients with',
        `${label} ${describeThresholdOperator(exampleParameters?.operator)} ${value}${unit ? ` ${unit}` : ''}`,
        timeClause
      ].filter(Boolean).join(' ');
    case 'numeric_range':
      return [
        role === 'researcher' ? 'cohort with' : 'patients with',
        `${label} between ${exampleParameters?.minValue} and ${exampleParameters?.maxValue}${unit ? ` ${unit}` : ''}`,
        timeClause
      ].filter(Boolean).join(' ');
    case 'coded_equals':
      return [
        role === 'patient' ? 'show me records with' : 'patients with',
        `${label} equal to ${codedValue || 'value'}`,
        timeClause
      ].filter(Boolean).join(' ');
    case 'coded_in':
      return [
        'patients with',
        `${label} equal to ${codedValue || 'one of the coded values'}`,
        timeClause
      ].filter(Boolean).join(' ');
    case 'text_contains':
      return [
        'patients with',
        `${label} containing "${codedValue || 'example text'}"`,
        timeClause
      ].filter(Boolean).join(' ');
    case 'text_equals':
      return [
        'patients with',
        `${label} equal to "${codedValue || 'example text'}"`,
        timeClause
      ].filter(Boolean).join(' ');
    case 'datetime_during':
      return `patients with ${label} during the selected period`;
    case 'numeric_average':
      return [
        role === 'patient' ? 'show' : 'calculate average',
        label,
        timeClause
      ].filter(Boolean).join(' ');
    case 'latest_event':
      return `latest ${label} event`;
    case 'exists':
      return [
        'patients with',
        `${label} recorded`,
        timeClause
      ].filter(Boolean).join(' ');
    default:
      return buildRoleShapeText(role, contract, semanticUnit);
  }
}

function buildQueryShapeLibrary(contractCatalog, semanticUnits, templateId) {
  const roles = ['doctor', 'nurse', 'researcher', 'patient', 'admin'];
  return contractCatalog.flatMap((contract) => {
    const semanticUnit = findSemanticUnitById(semanticUnits, contract?.bindings?.[0]?.semanticUnitId);
    const exampleParameters = contract?.exampleParameters || {};
    return roles.map((role) => ({
      queryShapeId: toArtifactId('shape', `${contract.contractId}:${role}:en`),
      language: 'en',
      role,
      text: buildRoleShapeText(role, contract, semanticUnit),
      exampleText: buildConcreteExampleText(contract, semanticUnit, role, exampleParameters),
      exampleEligible: isUserFacingSemanticUnitExampleEligible(semanticUnit),
      normalizedShape: buildNormalizedShapeText(contract, semanticUnit),
      contractId: contract.contractId,
      semanticUnitIds: semanticUnit ? [semanticUnit.semanticUnitId] : [],
      parameters: contract?.sourceIndependentCore?.parameters || {},
      filters: {
        templateId,
        valueKind: semanticUnit?.valueKind || '',
        contractKind: contract.contractKind
      },
      exampleParameters
    }));
  });
}

function bindTerminologySurfaceToContracts(terminologySurface, contractCatalog) {
  const contractIdsBySemanticUnitId = contractCatalog.reduce((acc, contract) => {
    const semanticUnitId = contract?.bindings?.[0]?.semanticUnitId;
    if (!semanticUnitId) return acc;
    if (!acc.has(semanticUnitId)) acc.set(semanticUnitId, []);
    acc.get(semanticUnitId).push(contract.contractId);
    return acc;
  }, new Map());

  return terminologySurface.map((entry) => ({
    ...entry,
    contractIds: contractIdsBySemanticUnitId.get(entry.semanticUnitId) || []
  }));
}

function buildRelationEdges(semanticUnits) {
  return semanticUnits
    .map((unit) => {
      const parent = unit?.parentChain?.[unit.parentChain.length - 1];
      if (!parent?.id) return null;
      return {
        id: toArtifactId('edge', `${parent.id}:${unit.semanticUnitId}`),
        fromUnitId: parent.id,
        toUnitId: unit.semanticUnitId,
        type: unit?.isContext ? 'qualifies' : 'contains'
      };
    })
    .filter(Boolean);
}

function buildSourceTemplateCatalog({ definition, envelope, root, templateId, templateLabel, sourceType, defaultLanguage, languages, records, temporalRecord }) {
  return [{
    sourceTemplateId: toArtifactId('source-template', templateId),
    sourceType,
    templateId,
    templateLabel,
    semVer: asNonEmptyString(envelope?.semVer) || asNonEmptyString(root?.semVer) || null,
    version: asNonEmptyString(envelope?.version) || asNonEmptyString(root?.version) || null,
    defaultLanguage,
    languages,
    rmType: asNonEmptyString(root?.rmType) || 'COMPOSITION',
    nodeId: asNonEmptyString(root?.nodeId) || null,
    description: pickNodeDescription(root, defaultLanguage),
    localizedLabels: normalizeLocalizedLabels(root, defaultLanguage, templateLabel),
    localizedDescriptions: normalizeLocalizedDescriptions(root, defaultLanguage),
    annotations: isObjectRecord(root?.annotations) ? root.annotations : {},
    archetypeId: asNonEmptyString(root?.nodeId) || asNonEmptyString(definition?.archetypeId) || null,
    treeRef: {
      rootAqlPath: asNonEmptyString(root?.aqlPath) || null,
      sourceNodeCount: records.length,
      defaultTemporalPath: resolveRecordValuePath(temporalRecord) || null
    }
  }];
}

function buildWarnings({ records, semanticUnits, contractCatalog, sourceTemplateCatalog }) {
  const warnings = [];

  if (records.length === 0) {
    warnings.push('No source nodes were found in the preserved openEHR template.');
  }
  if (semanticUnits.length === 0) {
    warnings.push('No semantic units were derived from the source template.');
  }
  if (!semanticUnits.some((unit) => unit?.queryable)) {
    warnings.push('No queryable semantic units were derived from the source template.');
  }
  if (!semanticUnits.some((unit) => unit?.defaultTimePath)) {
    warnings.push('No default temporal path was detected; time-window rendering is limited.');
  }
  if (contractCatalog.length === 0) {
    warnings.push('No base query contracts were generated from the semantic units.');
  }
  if (!sourceTemplateCatalog?.[0]?.semVer) {
    warnings.push('The source template did not expose semVer metadata.');
  }

  return warnings;
}

function resolveArtifactContextContract(definition, options = {}) {
  return normalizeContextContract(
    options?.contextContract || definition?.metadata?.contextContract || {},
    options?.definitionKind || definition?.kind || 'context_object'
  );
}

function buildContextContractWarnings(semanticContract, sourceType) {
  const warnings = [];
  if (!semanticContract) return warnings;

  if (
    /^openEHR-/i.test(asNonEmptyString(sourceType))
    && semanticContract.sourceOfTruth === 'node_projection'
  ) {
    warnings.push('The semantic contract declares node_projection as source of truth even though a preserved native openEHR definition is available.');
  }

  if (
    Array.isArray(semanticContract.executionTargets)
    && semanticContract.executionTargets.length > 0
    && !allowsExecutionTarget(semanticContract, 'aql')
  ) {
    warnings.push('The semantic contract does not currently allow AQL as an execution target; this panel will show semantic resolution without deterministic AQL handoff.');
  }

  return warnings;
}

export function compileOpenEhrSemanticArtifacts(definition, options = {}) {
  if (!isOpenEhrContextObjectDefinition(definition)) {
    throw new Error('The supplied definition does not contain a preserved openEHR template');
  }

  const envelope = resolveNativeTemplateEnvelope(definition);
  const root = resolveNativeTemplateRoot(definition);
  const sourceType = inferSourceType(definition);
  const defaultLanguage = asNonEmptyString(envelope?.defaultLanguage)
    || asNonEmptyString(root?.defaultLanguage)
    || 'en';
  const languages = uniqueStrings([
    ...(Array.isArray(envelope?.languages) ? envelope.languages : []),
    ...(Array.isArray(root?.languages) ? root.languages : []),
    defaultLanguage
  ]);
  const templateId = asNonEmptyString(options?.templateId)
    || asNonEmptyString(definition?.sourceModel?.templateId)
    || asNonEmptyString(envelope?.templateId)
    || asNonEmptyString(root?.templateId)
    || asNonEmptyString(definition?.archetypeId)
    || asNonEmptyString(root?.nodeId)
    || 'openEHR-template';
  const templateLabel = asNonEmptyString(definition?.name)
    || pickNodeName(root, templateId)
    || templateId;
  const contextContract = resolveArtifactContextContract(definition, options);
  const semanticContract = contextContract.semanticContract;

  const records = collectTemplateNodes(root, defaultLanguage);
  const temporalRecord = guessDefaultTemporalRecord(records);
  const sourceTemplateCatalog = buildSourceTemplateCatalog({
    definition,
    envelope,
    root,
    templateId,
    templateLabel,
    sourceType,
    defaultLanguage,
    languages,
    records,
    temporalRecord
  });
  const semanticUnits = compileSemanticUnits(records, templateId, sourceType, defaultLanguage, temporalRecord);
  const initialTerminologySurface = buildTerminologySurface(semanticUnits, sourceTemplateCatalog[0]);
  const contractCatalog = buildContractCatalog(semanticUnits, templateId);
  const terminologySurface = bindTerminologySurfaceToContracts(initialTerminologySurface, contractCatalog);
  const queryShapeLibrary = buildQueryShapeLibrary(contractCatalog, semanticUnits, templateId);
  const warnings = buildWarnings({
    records,
    semanticUnits,
    contractCatalog,
    sourceTemplateCatalog
  }).concat(buildContextContractWarnings(semanticContract, sourceType));

  return {
    version: '0.3',
    generatedAt: new Date().toISOString(),
    contextContract,
    semanticContract,
    source: {
      family: 'openEHR',
      sourceType,
      templateId,
      templateLabel,
      rmType: asNonEmptyString(root?.rmType) || asNonEmptyString(definition?.rmType) || 'COMPOSITION',
      archetypeId: asNonEmptyString(root?.nodeId) || asNonEmptyString(definition?.archetypeId) || null,
      semanticContractType: asNonEmptyString(semanticContract?.contractType) || null,
      resultShape: asNonEmptyString(semanticContract?.resultShape) || null
    },
    sourceTemplateCatalog,
    semanticUnits,
    terminologySurface,
    contractCatalog,
    queryShapeLibrary,
    foundationInventory: {
      sourceTemplateCount: sourceTemplateCatalog.length,
      sourceNodeCount: records.length,
      semanticUnitCount: semanticUnits.length,
      queryableUnitCount: semanticUnits.filter((unit) => unit.queryable).length,
      terminologyEntryCount: terminologySurface.length,
      contractCount: contractCatalog.length,
      coveredContractCount: contractCatalog.filter((contract) => contract.coverage === 'covered').length,
      queryShapeCount: queryShapeLibrary.length,
      warningCount: warnings.length,
      executionTargetCount: Array.isArray(semanticContract?.executionTargets) ? semanticContract.executionTargets.length : 0
    },
    warnings,

    // Backward-compatible aliases for the first demonstrator slice.
    templateCatalog: sourceTemplateCatalog[0] || null,
    contextUnits: semanticUnits,
    queryContracts: contractCatalog,
    storedQueryShapes: queryShapeLibrary,
    relationEdges: buildRelationEdges(semanticUnits)
  };
}

function escapeAqlString(value) {
  return `${value}`.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatMatchesLiteral(value) {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => asNonEmptyString(item))
      .filter(Boolean)
      .map((item) => `'${escapeAqlString(item)}'`);
    return `{${items.join(', ')}}`;
  }
  return `'${escapeAqlString(value)}'`;
}

function formatAqlLiteral(value, inputType, operator) {
  if (operator === 'matches') {
    return formatMatchesLiteral(value);
  }

  if (value === null || value === undefined) return "''";
  if (inputType === 'number' || inputType === 'integer' || inputType === 'quantity') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : '0';
  }
  if (inputType === 'boolean') {
    return value === true || value === 'true' ? 'true' : 'false';
  }
  return `'${escapeAqlString(value)}'`;
}

function hasFilterValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function mapLegacyOperator(operator) {
  switch (operator) {
    case 'gt':
      return '>';
    case 'gte':
      return '>=';
    case 'lt':
      return '<';
    case 'lte':
      return '<=';
    case 'matches':
      return 'MATCHES';
    case 'eq':
    default:
      return '=';
  }
}

function renderLegacyQueryContractAql(contract, params = {}) {
  const selectClauses = (Array.isArray(contract.select) ? contract.select : [])
    .map((column) => `${column.expr} AS ${column.alias}`);
  const whereClauses = [];

  (Array.isArray(contract.filters) ? contract.filters : []).forEach((filter) => {
    const value = params[filter.id];
    if (!hasFilterValue(value)) return;
    const operator = params[`${filter.id}Operator`] || filter.defaultOperator || filter.operators?.[0] || 'eq';
    const mappedOperator = mapLegacyOperator(operator);
    whereClauses.push(`${filter.path} ${mappedOperator} ${formatAqlLiteral(value, filter.inputType, operator)}`);
  });

  const orderBy = (Array.isArray(contract.orderBy) ? contract.orderBy : [])
    .map((entry) => `${entry.expr}${entry.direction ? ` ${entry.direction}` : ''}`)
    .join(', ');
  const rawLimit = Number(params[contract?.limit?.param || 'limit']);
  const defaultLimit = Number(contract?.limit?.default) || 25;
  const maxLimit = Number(contract?.limit?.max) || defaultLimit;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.trunc(rawLimit)), maxLimit)
    : defaultLimit;

  const lines = [
    'SELECT',
    `  ${selectClauses.join(',\n  ')}`,
    `FROM ${contract.from}`
  ];

  if (whereClauses.length > 0) {
    lines.push('WHERE');
    lines.push(`  ${whereClauses.join('\n  AND ')}`);
  }

  if (orderBy) {
    lines.push(`ORDER BY ${orderBy}`);
  }

  lines.push(`LIMIT ${limit}`);
  return lines.join('\n');
}

function parseDurationToMilliseconds(duration) {
  const raw = asNonEmptyString(duration).toUpperCase();
  if (!raw) return NaN;

  const match = raw.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return NaN;

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);

  return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
}

function resolveTimeWindowBounds(timeWindow, nowValue) {
  const ms = parseDurationToMilliseconds(timeWindow);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const upper = new Date(nowValue || Date.now());
  const lower = new Date(upper.getTime() - ms);
  return {
    from: lower.toISOString(),
    to: upper.toISOString()
  };
}

function normalizeContractOperator(operator) {
  const raw = asNonEmptyString(operator).toLowerCase();
  switch (raw) {
    case 'gt':
    case '>':
      return '>';
    case 'gte':
    case '>=':
      return '>=';
    case 'lt':
    case '<':
      return '<';
    case 'lte':
    case '<=':
      return '<=';
    case 'neq':
    case '!=':
      return '!=';
    case 'matches':
      return 'MATCHES';
    case 'eq':
    case '=':
    default:
      return '=';
  }
}

function formatContractLiteral(value, valueKind) {
  if (Array.isArray(value)) {
    return `{${value.map((item) => `'${escapeAqlString(item)}'`).join(', ')}}`;
  }

  if (valueKind === 'quantity' || valueKind === 'count') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw new Error('A numeric contract requires a numeric value.');
    }
    return String(numeric);
  }

  if (valueKind === 'boolean') {
    return value === true || value === 'true' ? 'true' : 'false';
  }

  return `'${escapeAqlString(value)}'`;
}

function getContractBinding(contract) {
  const binding = Array.isArray(contract?.bindings)
    ? contract.bindings.find((candidate) => candidate?.source === 'openEHR') || contract.bindings[0]
    : null;
  if (!binding?.aqlPath) {
    throw new Error('The contract does not contain an openEHR binding with an aqlPath.');
  }
  return binding;
}

function getContractValueKind(contract) {
  return asNonEmptyString(contract?.sourceIndependentCore?.valueKind) || 'text';
}

function resolveBoundPaths(contract) {
  const binding = getContractBinding(contract);
  return {
    binding,
    valuePath: binding?.valuePath ? appendQueryPath(binding.aqlPath, binding.valuePath) : toQueryPath(binding.aqlPath),
    unitPath: binding?.unitPath ? appendQueryPath(binding.aqlPath, binding.unitPath) : '',
    labelPath: binding?.labelPath ? appendQueryPath(binding.aqlPath, binding.labelPath) : '',
    timePath: binding?.timePath ? toQueryPath(binding.timePath) : ''
  };
}

function resolveSelectClauses(contract, valuePath, timePath) {
  const contractKind = asNonEmptyString(contract?.contractKind);
  switch (contractKind) {
    case 'numeric_average':
      return [
        'e/ehr_id/value AS ehrId',
        `AVG(${valuePath}) AS averageValue`
      ];
    default:
      return [
        'e/ehr_id/value AS ehrId',
        'c/uid/value AS compositionUid',
        ...(timePath ? [`${timePath} AS recordedAt`] : []),
        `${valuePath} AS value`
      ];
  }
}

function resolveFromClause(templateId) {
  return `EHR e CONTAINS COMPOSITION c[${templateId}]`;
}

function applyTimeWindowClauses(whereClauses, timePath, params) {
  if (!timePath) return;

  if (hasFilterValue(params?.timeFrom)) {
    whereClauses.push(`${timePath} >= '${escapeAqlString(params.timeFrom)}'`);
  }
  if (hasFilterValue(params?.timeTo)) {
    whereClauses.push(`${timePath} <= '${escapeAqlString(params.timeTo)}'`);
  }

  if (hasFilterValue(params?.timeWindow)) {
    const bounds = resolveTimeWindowBounds(params.timeWindow, params?._now);
    if (bounds) {
      whereClauses.push(`${timePath} >= '${escapeAqlString(bounds.from)}'`);
      whereClauses.push(`${timePath} <= '${escapeAqlString(bounds.to)}'`);
    }
  }
}

function renderOpenEhrBoundContractAql(contract, params = {}) {
  const templateId = asNonEmptyString(contract?.bindings?.[0]?.templateId);
  if (!templateId) {
    throw new Error('The contract is missing a templateId binding.');
  }

  const contractKind = asNonEmptyString(contract?.contractKind);
  if (!RENDERABLE_CONTRACT_KINDS.has(contractKind)) {
    throw new Error(`AQL rendering is not implemented for contract kind "${contractKind}".`);
  }

  const { valuePath, unitPath, timePath } = resolveBoundPaths(contract);
  const valueKind = getContractValueKind(contract);
  const whereClauses = [];
  const orderBy = [];
  const limit = Number.isFinite(Number(params?.limit)) ? Math.max(1, Math.trunc(Number(params.limit))) : 25;

  switch (contractKind) {
    case 'numeric_threshold': {
      const operator = normalizeContractOperator(params?.operator || '>=');
      if (!hasFilterValue(params?.value)) {
        throw new Error('numeric_threshold requires a numeric value.');
      }
      whereClauses.push(`${valuePath} ${operator} ${formatContractLiteral(params.value, valueKind)}`);
      if (unitPath && hasFilterValue(params?.unit)) {
        whereClauses.push(`${unitPath} = '${escapeAqlString(params.unit)}'`);
      }
      applyTimeWindowClauses(whereClauses, timePath, params);
      orderBy.push(timePath ? `${timePath} DESC` : '');
      break;
    }
    case 'numeric_range': {
      if (!hasFilterValue(params?.minValue) || !hasFilterValue(params?.maxValue)) {
        throw new Error('numeric_range requires minValue and maxValue.');
      }
      whereClauses.push(`${valuePath} >= ${formatContractLiteral(params.minValue, valueKind)}`);
      whereClauses.push(`${valuePath} <= ${formatContractLiteral(params.maxValue, valueKind)}`);
      if (unitPath && hasFilterValue(params?.unit)) {
        whereClauses.push(`${unitPath} = '${escapeAqlString(params.unit)}'`);
      }
      applyTimeWindowClauses(whereClauses, timePath, params);
      orderBy.push(timePath ? `${timePath} DESC` : '');
      break;
    }
    case 'coded_equals': {
      if (!hasFilterValue(params?.value)) {
        throw new Error('coded_equals requires a coded value.');
      }
      whereClauses.push(`${valuePath} = '${escapeAqlString(params.value)}'`);
      applyTimeWindowClauses(whereClauses, timePath, params);
      orderBy.push(timePath ? `${timePath} DESC` : '');
      break;
    }
    case 'coded_in': {
      const values = Array.isArray(params?.values)
        ? params.values
        : `${params?.values || ''}`.split(',').map((value) => value.trim()).filter(Boolean);
      if (!values.length) {
        throw new Error('coded_in requires at least one coded value.');
      }
      whereClauses.push(`${valuePath} MATCHES ${formatContractLiteral(values, valueKind)}`);
      applyTimeWindowClauses(whereClauses, timePath, params);
      orderBy.push(timePath ? `${timePath} DESC` : '');
      break;
    }
    case 'exists': {
      whereClauses.push(`EXISTS ${valuePath}`);
      applyTimeWindowClauses(whereClauses, timePath, params);
      orderBy.push(timePath ? `${timePath} DESC` : '');
      break;
    }
    case 'datetime_during': {
      if (!hasFilterValue(params?.from) || !hasFilterValue(params?.to)) {
        throw new Error('datetime_during requires from and to values.');
      }
      whereClauses.push(`${valuePath} >= '${escapeAqlString(params.from)}'`);
      whereClauses.push(`${valuePath} <= '${escapeAqlString(params.to)}'`);
      orderBy.push(`${valuePath} DESC`);
      break;
    }
    case 'numeric_average': {
      if (unitPath && hasFilterValue(params?.unit)) {
        whereClauses.push(`${unitPath} = '${escapeAqlString(params.unit)}'`);
      }
      applyTimeWindowClauses(whereClauses, timePath, params);
      break;
    }
    case 'latest_event': {
      if (timePath) {
        applyTimeWindowClauses(whereClauses, timePath, params);
        orderBy.push(`${timePath} DESC`);
      } else {
        orderBy.push(`${valuePath} DESC`);
      }
      break;
    }
    default:
      throw new Error(`AQL rendering is not implemented for contract kind "${contractKind}".`);
  }

  const lines = [
    'SELECT',
    `  ${resolveSelectClauses(contract, valuePath, timePath).join(',\n  ')}`,
    `FROM ${resolveFromClause(templateId)}`
  ];

  if (whereClauses.length) {
    lines.push('WHERE');
    lines.push(`  ${whereClauses.join('\n  AND ')}`);
  }

  const orderByClause = orderBy.filter(Boolean).join(', ');
  if (orderByClause) {
    lines.push(`ORDER BY ${orderByClause}`);
  }

  if (contractKind !== 'numeric_average') {
    lines.push(`LIMIT ${limit}`);
  }

  return lines.join('\n');
}

export function renderOpenEhrQueryContractAql(contract, params = {}) {
  if (!isObjectRecord(contract)) {
    throw new Error('contract is required');
  }

  if (contract.from && Array.isArray(contract.select)) {
    return renderLegacyQueryContractAql(contract, params);
  }

  return renderOpenEhrBoundContractAql(contract, params);
}
