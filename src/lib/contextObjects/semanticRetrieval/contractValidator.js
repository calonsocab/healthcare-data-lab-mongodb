function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function requiresNumericValue(contractKind) {
  return [
    'numeric_threshold',
    'count_threshold',
    'numeric_range'
  ].includes(contractKind);
}

function requiresCodedValue(contractKind) {
  return ['coded_equals', 'coded_not_equals', 'coded_in'].includes(contractKind);
}

function requiresTimeWindow(contractKind) {
  return ['datetime_during'].includes(contractKind);
}

function requiresDeterministicQuantityUnit(contractKind, semanticUnit) {
  if (semanticUnit?.valueKind !== 'quantity') return false;
  if (!Array.isArray(semanticUnit?.allowedUnits) || semanticUnit.allowedUnits.length <= 1) return false;
  return [
    'numeric_threshold',
    'numeric_range',
    'numeric_average',
    'numeric_min',
    'numeric_max'
  ].includes(contractKind);
}

function hasTimeFilter(params) {
  return hasValue(params?.timeWindow)
    || hasValue(params?.timeFrom)
    || hasValue(params?.timeTo)
    || hasValue(params?.from)
    || hasValue(params?.to);
}

function expandOperatorAliases(operator) {
  const raw = `${operator || ''}`.trim().toLowerCase();
  switch (raw) {
    case '>':
    case 'gt':
      return ['>', 'gt'];
    case '>=':
    case 'gte':
      return ['>=', 'gte'];
    case '<':
    case 'lt':
      return ['<', 'lt'];
    case '<=':
    case 'lte':
      return ['<=', 'lte'];
    case '!=':
    case 'neq':
      return ['!=', 'neq'];
    case '=':
    case 'eq':
      return ['=', 'eq'];
    case 'between':
      return ['between'];
    default:
      return raw ? [raw] : [];
  }
}

export function validateSemanticContractCandidate({
  contract,
  semanticUnit,
  params
} = {}) {
  const errors = [];

  if (!contract) {
    errors.push('contract exists');
  }

  if (!semanticUnit) {
    errors.push('semantic unit exists');
  }

  const binding = asArray(contract?.bindings).find((candidate) => candidate?.source === 'openEHR') || contract?.bindings?.[0];
  if (!binding?.aqlPath) {
    errors.push('aqlPath exists');
  }

  if (semanticUnit?.allowedOperators?.length && hasValue(params?.operator)) {
    const allowedOperators = new Set(asArray(semanticUnit.allowedOperators).flatMap((operator) => expandOperatorAliases(operator)));
    const operatorAliases = expandOperatorAliases(params.operator);
    if (!operatorAliases.some((operator) => allowedOperators.has(operator))) {
      errors.push('operator allowed for semantic unit');
    }
  }

  if (requiresNumericValue(contract?.contractKind)) {
    if (!hasValue(params?.value) && !(hasValue(params?.minValue) && hasValue(params?.maxValue))) {
      errors.push('value compatible with numeric type');
    }
  }

  if (requiresDeterministicQuantityUnit(contract?.contractKind, semanticUnit) && !hasValue(params?.unit)) {
    errors.push('unit required for semantic unit');
  }

  if (semanticUnit?.allowedUnits?.length && hasValue(params?.unit) && !semanticUnit.allowedUnits.includes(params.unit)) {
    errors.push('unit compatible with semantic unit');
  }

  if (requiresCodedValue(contract?.contractKind)) {
    const codedValues = asArray(semanticUnit?.codedOptions).map((option) => option?.code || option?.label).filter(Boolean);
    if (!codedValues.length) {
      errors.push('coded value allowed');
    } else if (contract?.contractKind === 'coded_in') {
      const values = Array.isArray(params?.values) ? params.values : [];
      const unsupported = values.filter((value) => !codedValues.includes(value));
      if (unsupported.length > 0) {
        errors.push('coded value allowed');
      }
    } else if (hasValue(params?.value) && !codedValues.includes(params.value)) {
      errors.push('coded value allowed');
    }
  }

  if (requiresTimeWindow(contract?.contractKind)) {
    if (!hasValue(params?.from) || !hasValue(params?.to)) {
      errors.push('time predicate has valid time path');
    }
  }

  if (hasTimeFilter(params) && !hasValue(binding?.timePath)) {
    errors.push('time predicate has valid time path');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
