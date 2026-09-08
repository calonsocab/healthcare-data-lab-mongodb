import { normalizeSemanticRetrievalQuery } from './normalizer.js';

function hasAggregationRequest(text) {
  return /\bcalculate average\b|\bmean\b|\bon average\b|\bwhat(?:'s| is) the average\b|\baverage of\b/.test(text);
}

function determineIntentKind(normalized) {
  const text = normalized?.normalizedText || '';
  const hasExplicitNumericConstraint = (normalized?.operators || []).length > 0 || (normalized?.numbers || []).length > 0;
  const hasPatientScope = /\bpatients?\b/.test(normalized?.rawText || '') || /\bpatients?\b/.test(text);
  if (hasAggregationRequest(text) && !hasExplicitNumericConstraint && !hasPatientScope) return 'aggregate';
  if (/\bcount\b|\bhow many\b/.test(text)) return 'count';
  if (/\blatest\b|\bmost recent\b|\blast measurement\b/.test(text)) return 'latest';
  if (text) return 'find_patients';
  return 'unknown';
}

function determineAggregation(normalized) {
  const text = normalized?.normalizedText || '';
  if (hasAggregationRequest(text)) {
    return { type: 'average' };
  }
  if (/\bcalculate min(?:imum)?\b|\bminimum of\b/.test(text)) {
    return { type: 'min' };
  }
  if (/\bcalculate max(?:imum)?\b|\bmaximum of\b/.test(text)) {
    return { type: 'max' };
  }
  return {};
}

function collectMeasurements(normalized) {
  const text = normalized?.normalizedText || '';
  const measurements = [];

  if (text.includes('temperature')) measurements.push('temperature');
  if (text.includes('blood pressure')) measurements.push('blood pressure');
  if (text.includes('diastolic')) measurements.push('diastolic blood pressure');
  if (text.includes('systolic')) measurements.push('systolic blood pressure');
  if (text.includes('oxygen')) measurements.push('oxygen');
  if (text.includes('alcohol')) measurements.push('alcohol');
  if (text.includes('alcohol use')) measurements.push('alcohol use');
  if (text.includes('drinking')) measurements.push('drinking');
  if (text.includes('frequency')) measurements.push('frequency');
  if (text.includes('left arm')) measurements.push('left arm');

  return measurements;
}

function collectAmbiguities(normalized) {
  const ambiguities = [];
  if (!(normalized?.numbers || []).length && !/\bexists\b|\bmeasured\b/.test(normalized?.normalizedText || '')) {
    ambiguities.push('missing_numeric_or_coded_value');
  }
  return ambiguities;
}

function overlaps(number, span) {
  return Number.isFinite(number?.index)
    && Number.isFinite(span?.index)
    && Number.isFinite(number?.endIndex)
    && Number.isFinite(span?.endIndex)
    && number.index >= span.index
    && number.endIndex <= span.endIndex;
}

function collectMeasurementNumbers(normalized) {
  const timeWindows = Array.isArray(normalized?.timeWindows) ? normalized.timeWindows : [];
  return (Array.isArray(normalized?.numbers) ? normalized.numbers : []).filter((number) => (
    !timeWindows.some((window) => overlaps(number, window))
  ));
}

function collectNumericRange(normalized, measurementNumbers) {
  const explicitRange = Array.isArray(normalized?.ranges) ? normalized.ranges[0] : null;
  if (explicitRange) {
    return explicitRange;
  }

  if (/\bbetween\b/.test(normalized?.normalizedText || '') && measurementNumbers.length >= 2) {
    return {
      raw: 'between',
      minValue: measurementNumbers[0].value,
      maxValue: measurementNumbers[1].value,
      unit: measurementNumbers[1].unit || measurementNumbers[0].unit || ''
    };
  }

  return null;
}

export function buildProcessedQueryIntent(rawText = '', options = {}) {
  const normalized = normalizeSemanticRetrievalQuery(rawText, options);
  const firstTimeWindow = normalized.timeWindows[0] || null;
  const firstCalendarPeriod = normalized.calendarPeriods[0] || null;
  const measurementNumbers = collectMeasurementNumbers(normalized);
  const numericRange = collectNumericRange(normalized, measurementNumbers);

  return {
    rawText: normalized.rawText,
    normalizedText: normalized.normalizedText,
    language: 'en',
    intentKind: determineIntentKind(normalized),
    terms: normalized.searchTerms,
    measurements: collectMeasurements(normalized),
    operators: normalized.operators,
    values: measurementNumbers.map((item) => item.value),
    units: normalized.units,
    time: firstTimeWindow
      ? {
        raw: firstTimeWindow.raw,
        durationIso: firstTimeWindow.durationIso,
        value: firstTimeWindow.value,
        unit: firstTimeWindow.unit
      }
      : firstCalendarPeriod
        ? {
          raw: firstCalendarPeriod.raw,
          kind: firstCalendarPeriod.kind,
          from: firstCalendarPeriod.from,
          to: firstCalendarPeriod.to
        }
        : {},
    aggregation: determineAggregation(normalized),
    range: numericRange
      ? {
        minValue: numericRange.minValue,
        maxValue: numericRange.maxValue,
        unit: numericRange.unit || ''
      }
      : null,
    ambiguities: collectAmbiguities({ ...normalized, numbers: measurementNumbers }),
    extraction: {
      ...normalized,
      measurementNumbers,
      range: numericRange
    }
  };
}
